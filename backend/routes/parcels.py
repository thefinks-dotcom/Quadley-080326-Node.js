"""Parcel notification routes - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
import uuid

from models import ParcelNotification, ParcelNotificationCreate
from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/parcels", tags=["parcels"])


async def send_parcel_notification_task(user_id: str, description: str = None):
    """Background task to send parcel notification"""
    try:
        from routes.notifications import notify_parcel_arrived
        await notify_parcel_arrived(user_id, description)
    except Exception as e:
        import logging
        logging.error(f"Failed to send parcel notification: {e}")


@router.post("", response_model=ParcelNotification)
async def create_parcel_notification(
    parcel_data: ParcelNotificationCreate,
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a parcel notification (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "ra"]:
        raise HTTPException(status_code=403, detail="Only admins can create parcel notifications")
    
    student = await tenant_db.users.find_one({"id": parcel_data.student_id}, {"_id": 0})
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    parcel_dict = {
        "id": str(uuid.uuid4()),
        "student_id": parcel_data.student_id,
        "student_name": f"{student['first_name']} {student['last_name']}",
        "student_email": student["email"],
        "tracking_number": parcel_data.tracking_number,
        "sender_name": parcel_data.sender_name,
        "description": parcel_data.description,
        "status": "waiting",
        "created_by": current_user.id,
        "created_by_name": f"{current_user.first_name} {current_user.last_name}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "collected_at": None
    }
    
    await tenant_db.parcel_notifications.insert_one(parcel_dict)
    
    # Send push notification to student
    background_tasks.add_task(
        send_parcel_notification_task,
        parcel_data.student_id,
        parcel_data.description or f"From: {parcel_data.sender_name}"
    )
    
    return ParcelNotification(**parcel_dict)


@router.get("")
async def get_parcels(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get parcel notifications - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role == "admin":
        parcels = await tenant_db.parcel_notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        parcels = await tenant_db.parcel_notifications.find({"student_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return parcels


@router.get("/my-pending")
async def get_my_pending_parcels(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get current user's pending/waiting parcels - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    parcels = await tenant_db.parcel_notifications.find(
        {"student_id": current_user.id, "status": "waiting"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return parcels


@router.put("/{parcel_id}/collect")
async def mark_parcel_collected(
    parcel_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Mark parcel as collected - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    parcel = await tenant_db.parcel_notifications.find_one({"id": parcel_id})
    
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    
    if parcel["student_id"] != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await tenant_db.parcel_notifications.update_one(
        {"id": parcel_id},
        {"$set": {
            "status": "collected",
            "collected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Parcel marked as collected"}
