"""Delight features - shoutouts and study streaks - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
import logging

from models import Shoutout, ShoutoutCreate, StudyStreak
from utils.auth import get_tenant_db_for_user
from utils.limiter import limiter

router = APIRouter(tags=["delight"])
logger = logging.getLogger(__name__)


@router.get("/recognition/participants")
async def get_recognition_participants(
    search: str = Query("", description="Search by name or email", max_length=50),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get users in the tenant for the recognition picker. Any authenticated user can call this."""
    tenant_db, current_user = tenant_data

    import re

    query = {"active": {"$ne": False}}
    if search:
        # Escape regex special characters to prevent ReDoS
        safe_search = re.escape(search.strip())
        search_regex = {"$regex": safe_search, "$options": "i"}
        query["$or"] = [
            {"first_name": search_regex},
            {"last_name": search_regex},
        ]

    users = await tenant_db.users.find(
        query,
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "role": 1, "floor": 1}
    ).sort("first_name", 1).to_list(200)

    participants = []
    for u in users:
        name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or "Unknown"
        participants.append({
            "id": u.get("id"),
            "name": name,
            "email": u.get("email", ""),
            "role": u.get("role", "student"),
            "floor": u.get("floor"),
        })

    return participants


@router.post("/shoutouts")
async def create_shoutout(
    shoutout_data: ShoutoutCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a shoutout - Rate limited to 10 per minute to prevent spam - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    # Rate limiting: 10 recognitions per minute
    from utils.rate_limit import check_rate_limit
    import uuid
    check_rate_limit(current_user.id, action="shoutout", max_requests=10, window_minutes=1)
    
    # Determine if this is a scheduled recognition
    is_scheduled = getattr(shoutout_data, 'scheduled_date', None) is not None and getattr(shoutout_data, 'status', None) == "scheduled"
    
    # Handle both mobile app field names (recipient_name) and web field names (to_user_name)
    to_user_name = shoutout_data.to_user_name or getattr(shoutout_data, 'recipient_name', None) or "Someone special"
    to_user_id = shoutout_data.to_user_id or getattr(shoutout_data, 'recipient_id', None) or ""
    
    shoutout_doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": None,
        "from_user_id": current_user.id,
        "from_user_name": f"{current_user.first_name} {current_user.last_name}",
        "sender_name": f"{current_user.first_name} {current_user.last_name}",  # For mobile app compatibility
        "to_user_id": to_user_id,
        "to_user_name": to_user_name,
        "recipient_name": to_user_name,  # For mobile app compatibility
        "message": shoutout_data.message,
        "category": shoutout_data.category,
        "broadcast": getattr(shoutout_data, 'broadcast', True),
        "status": "scheduled" if is_scheduled else "published",
        "scheduled_date": getattr(shoutout_data, 'scheduled_date', None) if is_scheduled else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await tenant_db.shoutouts.insert_one(shoutout_doc)
    
    # Remove _id before returning
    shoutout_doc.pop('_id', None)

    # Send notification to the recognized person
    if to_user_id:
        try:
            from routes.notifications import notify_shoutout, store_notification
            sender_name = f"{current_user.first_name} {current_user.last_name}"
            await store_notification(
                tenant_db=tenant_db,
                user_id=to_user_id,
                title=f"You were recognized by {sender_name}!",
                body=shoutout_data.message[:100],
                notification_type="shoutout",
                data={"shoutout_id": str(shoutout_doc)["id"], "category": shoutout_data.category},
            )
            await notify_shoutout(tenant_db, to_user_id, sender_name, shoutout_data.message)
            logger.info(f"Shoutout notification sent to {to_user_id} from {current_user.id}")
        except Exception as e:
            logger.error(f"Failed to send shoutout notification: {e}")

    return shoutout_doc


@router.get("/shoutouts", response_model=List[Shoutout])
async def get_shoutouts(
    user_id: Optional[str] = None, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get shoutouts - shows broadcast shoutouts OR shoutouts involving the user - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    query = {
        "$or": [
            {"broadcast": True},  # Broadcast recognitions visible to all
            {"from_user_id": current_user.id},  # Sent by user
            {"to_user_id": current_user.id}  # Received by user
        ]
    }
    
    shoutouts = await tenant_db.shoutouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for shoutout in shoutouts:
        if isinstance(shoutout.get('created_at'), str):
            shoutout['created_at'] = datetime.fromisoformat(shoutout['created_at'])
    
    return shoutouts


@router.post("/study-streaks/checkin")
async def checkin_library(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Check in to library for study streak - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    streak = await tenant_db.study_streaks.find_one({"student_id": str(current_user).id})
    
    if not streak:
        streak = StudyStreak(student_id=current_user.id, current_streak=1, longest_streak=1, total_visits=1, last_visit=datetime.now(timezone.utc))
        streak_doc = streak.model_dump()
        streak_doc['last_visit'] = streak_doc['last_visit'].isoformat()
        streak_doc['updated_at'] = streak_doc['updated_at'].isoformat()
        await tenant_db.study_streaks.insert_one(streak_doc)
        return {"message": "Streak started!", "streak": 1}
    else:
        last_visit = datetime.fromisoformat(streak['last_visit']) if isinstance(streak['last_visit'], str) else streak['last_visit']
        now = datetime.now(timezone.utc)
        
        if (now - last_visit).days == 1:
            current_streak = streak.get('current_streak', 0) + 1
        elif (now - last_visit).days == 0:
            return {"message": "Already checked in today", "streak": streak.get('current_streak', 0)}
        else:
            current_streak = 1
        
        longest_streak = max(current_streak, streak.get('longest_streak', 0))
        
        await tenant_db.study_streaks.update_one(
            {"student_id": str(current_user).id},
            {"$set": {
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "total_visits": streak.get('total_visits', 0) + 1,
                "last_visit": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        
        return {"message": "Checked in!", "streak": current_streak}


@router.get("/study-streaks/my-streak")
async def get_my_streak(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get current user's study streak - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    streak = await tenant_db.study_streaks.find_one({"student_id": str(current_user).id}, {"_id": 0})
    
    if not streak:
        return {"current_streak": 0, "longest_streak": 0, "total_visits": 0}
    
    if isinstance(streak.get('last_visit'), str):
        streak['last_visit'] = datetime.fromisoformat(streak['last_visit'])
    if isinstance(streak.get('updated_at'), str):
        streak['updated_at'] = datetime.fromisoformat(streak['updated_at'])
    
    return streak
