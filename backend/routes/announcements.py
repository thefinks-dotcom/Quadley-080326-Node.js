"""Announcements routes - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List
from datetime import datetime, timezone
import uuid
import bleach

from models import Announcement, AnnouncementCreate
from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/announcements", tags=["announcements"])


async def send_announcement_notification(title: str, content: str, is_emergency: bool, exclude_user_id: str):
    """Background task to send push notifications for new announcements"""
    try:
        from routes.notifications import notify_new_announcement
        
        # Add emergency indicator to title if applicable
        notification_title = f"🚨 URGENT: {title}" if is_emergency else title
        
        # Send to all users except the creator
        await notify_new_announcement(
            title=notification_title,
            preview=content[:150],
            exclude_user=exclude_user_id
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to send announcement notification: {e}")


@router.post("")
async def create_announcement(
    ann_data: AnnouncementCreate, 
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a new announcement (RAs and admins only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now()
    
    # Handle both is_emergency and emergency field names (mobile app sends 'emergency')
    is_emergency = ann_data.is_emergency or (ann_data.emergency if ann_data.emergency is not None else False)
    
    ann_doc = {
        "id": str(uuid.uuid4()),
        "title": bleach.clean(ann_data.title, tags=[], strip=True) if ann_data.title else "",
        "content": bleach.clean(ann_data.content, tags=[], strip=True) if ann_data.content else "",
        "created_by": current_user.id,
        "created_by_name": f"{current_user.first_name} {current_user.last_name}",
        "target_audience": ann_data.target_audience,
        "house": ann_data.house,
        "priority": ann_data.priority,
        "is_emergency": is_emergency,
        "emergency": is_emergency,
        "status": ann_data.status if ann_data.status else "published",
        "scheduled_date": ann_data.scheduled_date,
        "expires_at": ann_data.expires_at,
        "created_at": now.isoformat()
    }
    
    # If scheduled_date provided, ensure status is scheduled
    if ann_data.scheduled_date:
        ann_doc['status'] = 'scheduled'
    
    await tenant_db.announcements.insert_one(ann_doc)
    
    # Send push notification in background (only for published, non-scheduled announcements)
    if ann_doc['status'] == 'published':
        background_tasks.add_task(
            send_announcement_notification,
            ann_doc['title'],
            ann_doc['content'],
            is_emergency,
            current_user.id
        )
    
    # Return the document (without _id)
    ann_doc.pop('_id', None)
    return ann_doc


@router.get("", response_model=List[Announcement])
async def get_announcements(
    include_scheduled: bool = False, 
    include_archived: bool = False, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get all announcements relevant to current user - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    # Admins can see scheduled announcements
    is_admin = current_user.role in ['ra', 'admin', 'super_admin', 'college_admin']
    
    now = datetime.now(timezone.utc).isoformat()
    
    audience_conditions = [
        {"target_audience": "all"},
        {"target_audience": "students"},
        {"target_audience": "everyone"},
        {"target_audience": {"$exists": False}},
        {"target_audience": None},
        {"target_audience": ""},
        {"target_audience": "specific_house", "house": current_user.floor}
    ]

    if is_admin:
        audience_conditions += [
            {"target_audience": "ra"},
            {"target_audience": "staff"},
        ]

    query = {"$or": audience_conditions}
    
    # Build status filter
    status_filter = []
    
    # Always include published announcements that haven't expired
    status_filter.append({
        "$and": [
            {"$or": [{"status": {"$exists": False}}, {"status": "published"}]},
            {"$or": [{"expires_at": {"$exists": False}}, {"expires_at": None}, {"expires_at": {"$gt": now}}]}
        ]
    })
    
    # Include scheduled announcements for admins if requested
    if is_admin and include_scheduled:
        status_filter.append({"status": "scheduled"})
    
    # Include archived announcements for admins if requested
    if is_admin and include_archived:
        status_filter.append({"status": "archived"})
    
    query["$and"] = [{"$or": status_filter}]
    
    announcements = await tenant_db.announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Batch fetch read statuses to avoid N+1 queries
    announcement_ids = [ann['id'] for ann in announcements]
    read_records = await tenant_db.announcement_reads.find({
        "announcement_id": {"$in": announcement_ids},
        "user_id": current_user.id
    }, {"_id": 0, "announcement_id": 1}).to_list(100)
    
    read_ids = {record['announcement_id'] for record in read_records}
    
    # Add read status to each announcement
    for ann in announcements:
        if isinstance(ann.get('created_at'), str):
            ann['created_at'] = datetime.fromisoformat(ann['created_at'])
        ann['is_read'] = ann['id'] in read_ids
    
    return announcements


@router.get("/archived")
async def get_archived_announcements(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get archived announcements (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get announcements that are either:
    # 1. Explicitly archived (status = 'archived')
    # 2. Expired (expires_at < now)
    query = {
        "$or": [
            {"status": "archived"},
            {"expires_at": {"$lt": now, "$ne": None}}
        ]
    }
    
    announcements = await tenant_db.announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for ann in announcements:
        if isinstance(ann.get('created_at'), str):
            ann['created_at'] = datetime.fromisoformat(ann['created_at'])
    
    return announcements


@router.put("/{announcement_id}/archive")
async def archive_announcement(
    announcement_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Manually archive an announcement (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await tenant_db.announcements.find_one({"id": announcement_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    await tenant_db.announcements.update_one(
        {"id": announcement_id},
        {"$set": {
            "status": "archived",
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "archived_by": current_user.id
        }}
    )
    
    return {"message": "Announcement archived"}


@router.put("/{announcement_id}/restore")
async def restore_announcement(
    announcement_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Restore an archived announcement (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await tenant_db.announcements.find_one({"id": announcement_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    await tenant_db.announcements.update_one(
        {"id": announcement_id},
        {
            "$set": {"status": "published"},
            "$unset": {"archived_at": "", "archived_by": "", "expires_at": ""}
        }
    )
    
    return {"message": "Announcement restored"}


@router.post("/{announcement_id}/mark-read")
async def mark_announcement_read(
    announcement_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Mark an announcement as read - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    # Check if already marked as read
    existing = await tenant_db.announcement_reads.find_one({
        "announcement_id": announcement_id,
        "user_id": current_user.id
    })
    
    if not existing:
        read_record = {
            "id": str(uuid.uuid4()),
            "announcement_id": announcement_id,
            "user_id": current_user.id,
            "read_at": datetime.now(timezone.utc).isoformat()
        }
        await tenant_db.announcement_reads.insert_one(read_record)
        
        # Update read count on the announcement
        await tenant_db.announcements.update_one(
            {"id": announcement_id},
            {
                "$addToSet": {"read_by": current_user.id},
                "$inc": {"read_count": 1}
            }
        )
    
    return {"message": "Announcement marked as read"}


@router.get("/{announcement_id}/read-stats")
async def get_announcement_read_stats(
    announcement_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get read statistics for an announcement (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the announcement
    announcement = await tenant_db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    # Get all read records with user details
    read_records = await tenant_db.announcement_reads.find(
        {"announcement_id": announcement_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Get user details for those who read
    user_ids = [r['user_id'] for r in read_records]
    users = await tenant_db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "floor": 1}
    ).to_list(1000)
    
    user_map = {u['id']: u for u in users}
    
    # Enrich read records with user info
    readers = []
    for record in read_records:
        user = user_map.get(record['user_id'], {})
        readers.append({
            "user_id": record['user_id'],
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "email": user.get('email', ''),
            "floor": user.get('floor', ''),
            "read_at": record.get('read_at', '')
        })
    
    # Get total target audience count
    total_students = await tenant_db.users.count_documents({"role": "student"})
    
    return {
        "announcement_id": announcement_id,
        "title": announcement.get('title', ''),
        "total_reads": len(readers),
        "total_target_audience": total_students,
        "read_percentage": round((len(readers) / total_students * 100), 1) if total_students > 0 else 0,
        "readers": readers
    }


@router.get("/read-stats/summary")
async def get_all_announcements_read_stats(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get read statistics summary for all announcements (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all announcements with read counts
    announcements = await tenant_db.announcements.find(
        {},
        {"_id": 0, "id": 1, "title": 1, "created_at": 1, "read_count": 1, "target_audience": 1}
    ).sort("created_at", -1).to_list(100)
    
    # Get total students for percentage calculation
    total_students = await tenant_db.users.count_documents({"role": "student"})
    
    result = []
    for ann in announcements:
        read_count = ann.get('read_count', 0)
        result.append({
            "id": ann['id'],
            "title": ann['title'],
            "created_at": ann.get('created_at', ''),
            "read_count": read_count,
            "total_target": total_students,
            "read_percentage": round((read_count / total_students * 100), 1) if total_students > 0 else 0
        })
    
    return result
