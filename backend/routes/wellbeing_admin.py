"""Wellbeing admin routes for managing wellbeing requests - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/wellbeing-admin", tags=["wellbeing_admin"])


# Models for wellbeing requests
class WellbeingRequestCreate(BaseModel):
    type: str  # Counseling, General Support, Academic Stress, etc.
    description: str
    urgency: str = "normal"  # urgent, high, normal


class WellbeingRequestUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None


@router.post("/requests")
async def create_wellbeing_request(
    data: WellbeingRequestCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Submit a wellbeing request (student) - tenant isolated"""
    tenant_db, current_user = tenant_data
    now = datetime.now(timezone.utc)
    
    request_dict = {
        "id": str(uuid.uuid4()),
        "student_id": current_user.id,
        "student_name": f"{current_user.first_name} {current_user.last_name}",
        "student_email": current_user.email,
        "type": data.type,
        "description": data.description,
        "urgency": data.urgency,
        "status": "pending",
        "scheduled_time": None,
        "assigned_to": None,
        "assigned_to_name": None,
        "notes": None,
        "created_at": now.isoformat(),
        "updated_at": None
    }
    
    await tenant_db.wellbeing_requests.insert_one(request_dict)
    
    return {"message": "Wellbeing request submitted", "id": str(request_dict)["id"]}


@router.get("/requests")
async def get_wellbeing_requests(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get wellbeing requests (admin/RA see all, students see their own) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role in ["admin", "ra", "super_admin", "superadmin"]:
        requests = await tenant_db.wellbeing_requests.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
    else:
        requests = await tenant_db.wellbeing_requests.find(
            {"student_id": str(current_user).id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
    
    return requests


@router.get("/requests/stats")
async def get_wellbeing_stats(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get statistics for wellbeing requests (admin/RA only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can view stats")
    
    all_requests = await tenant_db.wellbeing_requests.find({}, {"_id": 0}).to_list(1000)
    
    # Count by status
    pending = sum(1 for r in all_requests if r.get("status") == "pending")
    scheduled = sum(1 for r in all_requests if r.get("status") == "scheduled")
    in_progress = sum(1 for r in all_requests if r.get("status") == "in_progress")
    resolved = sum(1 for r in all_requests if r.get("status") == "resolved")
    
    # Count urgent cases
    urgent_count = sum(1 for r in all_requests 
                       if r.get("urgency") in ["urgent", "high"] 
                       and r.get("status") not in ["resolved"])
    
    return {
        "total": len(all_requests),
        "pending": pending,
        "scheduled": scheduled,
        "in_progress": in_progress,
        "resolved": resolved,
        "urgent_count": urgent_count
    }


@router.get("/requests/{request_id}")
async def get_wellbeing_request(
    request_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get a specific wellbeing request - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    request = await tenant_db.wellbeing_requests.find_one({"id": str(request_id)}, {"_id": 0})
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Students can only see their own requests
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        if request.get("student_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return request


@router.put("/requests/{request_id}")
async def update_wellbeing_request(
    request_id: str,
    data: WellbeingRequestUpdate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update a wellbeing request (admin/RA only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can update requests")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.status:
        update_data["status"] = data.status
    if data.scheduled_time:
        update_data["scheduled_time"] = data.scheduled_time
    if data.notes:
        update_data["notes"] = data.notes
    if data.assigned_to:
        update_data["assigned_to"] = data.assigned_to
        # Look up name
        assigned_user = await tenant_db.users.find_one({"id": str(data).assigned_to}, {"_id": 0})
        if assigned_user:
            update_data["assigned_to_name"] = f"{assigned_user.get('first_name', '')} {assigned_user.get('last_name', '')}"
    
    await tenant_db.wellbeing_requests.update_one(
        {"id": str(request_id)},
        {"$set": update_data}
    )
    
    return {"message": "Request updated"}


@router.put("/requests/{request_id}/schedule")
async def schedule_wellbeing_appointment(
    request_id: str,
    scheduled_time: str = Body(..., embed=True),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Schedule an appointment for a wellbeing request - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can schedule appointments")
    
    update_data = {
        "status": "scheduled",
        "scheduled_time": scheduled_time,
        "assigned_to": current_user.id,
        "assigned_to_name": f"{current_user.first_name} {current_user.last_name}",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await tenant_db.wellbeing_requests.update_one(
        {"id": str(request_id)},
        {"$set": update_data}
    )
    
    return {"message": "Appointment scheduled", "scheduled_time": scheduled_time}


@router.put("/requests/{request_id}/resolve")
async def resolve_wellbeing_request(
    request_id: str,
    resolution_notes: str = Body(..., embed=True),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Mark a wellbeing request as resolved - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can resolve requests")
    
    now = datetime.now(timezone.utc)
    
    update_data = {
        "status": "resolved",
        "resolution_notes": resolution_notes,
        "resolved_by": current_user.id,
        "resolved_by_name": f"{current_user.first_name} {current_user.last_name}",
        "resolved_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await tenant_db.wellbeing_requests.update_one(
        {"id": str(request_id)},
        {"$set": update_data}
    )
    
    return {"message": "Request resolved"}
