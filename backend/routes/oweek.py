"""O-Week (Orientation Week) routes - tenant-isolated"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid

from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/o-week", tags=["oweek"])


class OWeekActivityCreate(BaseModel):
    name: str
    description: str
    activity_type: str  # social, informational, challenge
    points: int = 0
    date: Optional[str] = None


@router.get("/data")
async def get_o_week_data(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get O-Week schedule and activities for the current tenant"""
    tenant_db, current_user = tenant_data
    activities = await tenant_db.oweek_activities.find({"active": True}, {"_id": 0}).sort("created_at", 1).to_list(100)

    welcome_message = (
        f"Welcome to O-Week, {current_user.first_name}!\n\n"
        "Orientation Week is all about getting to know your new home, making friends, "
        "and settling in. Check out the schedule below and join as many activities as you can."
    )

    return {"welcome_message": welcome_message, "activities": activities, "total_activities": len(activities)}


@router.post("/activities")
async def create_o_week_activity(
    activity: OWeekActivityCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create an O-Week activity (admin only)"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ['admin', 'ra']:
        raise HTTPException(status_code=403, detail="Only admins and RAs can create O-Week activities")

    doc = activity.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["active"] = True
    doc["created_by"] = current_user.id
    doc["created_at"] = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
    await tenant_db.oweek_activities.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/activities/{activity_id}")
async def delete_o_week_activity(
    activity_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete an O-Week activity (admin only)"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ['admin', 'ra']:
        raise HTTPException(status_code=403, detail="Only admins and RAs can delete O-Week activities")

    result = await tenant_db.oweek_activities.update_one(
        {"id": str(activity_id)},
        {"$set": {"active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"success": True}
