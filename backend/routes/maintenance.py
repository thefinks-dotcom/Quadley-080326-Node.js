"""Maintenance requests routes - Tenant isolated (OWASP A01 compliance)"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List
from datetime import datetime

from models import MaintenanceRequest, MaintenanceRequestCreate
from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


async def send_maintenance_notification_task(user_id: str, status: str, issue_type: str):
    """Background task to send maintenance status update notification"""
    try:
        from routes.notifications import notify_maintenance_update
        await notify_maintenance_update(user_id, status, issue_type)
    except Exception as e:
        import logging
        logging.error(f"Failed to send maintenance notification: {e}")


@router.post("", response_model=MaintenanceRequest)
async def create_maintenance_request(
    req_data: MaintenanceRequestCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a maintenance request (tenant isolated)"""
    tenant_db, current_user = tenant_data
    
    request = MaintenanceRequest(
        student_id=current_user.id,
        student_name=f"{current_user.first_name} {current_user.last_name}",
        room_number=req_data.room_number,
        issue_type=req_data.issue_type,
        description=req_data.description,
        priority=req_data.priority
    )
    
    req_doc = request.model_dump()
    req_doc['created_at'] = req_doc['created_at'].isoformat()
    await tenant_db.maintenance.insert_one(req_doc)
    
    return request


@router.get("", response_model=List[MaintenanceRequest])
async def get_maintenance_requests(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get maintenance requests - students see own, admins/RAs see all (tenant isolated)"""
    tenant_db, current_user = tenant_data
    
    # Admins see all requests; everyone else (students, RAs) sees only their own
    query = {} if current_user.role in ['admin', 'college_admin', 'super_admin', 'superadmin'] else {"student_id": current_user.id}
    requests = await tenant_db.maintenance.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for req in requests:
        if isinstance(req.get('created_at'), str):
            req['created_at'] = datetime.fromisoformat(req['created_at'])
        if req.get('resolved_at') and isinstance(req['resolved_at'], str):
            req['resolved_at'] = datetime.fromisoformat(req['resolved_at'])
    
    return requests


@router.patch("/{request_id}")
async def update_maintenance_status(
    request_id: str,
    status_data: dict,
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update maintenance request status (RAs and admins only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_status = status_data.get('status')
    if new_status not in ['pending', 'in_progress', 'resolved']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Get the request first to find the student and issue type
    request = await tenant_db.maintenance.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    update_data = {
        "status": new_status,
        "updated_at": datetime.now().isoformat(),
        "updated_by": current_user.id
    }
    
    if new_status == 'resolved':
        update_data["resolved_at"] = datetime.now().isoformat()
        update_data["resolved_by"] = current_user.id
    elif new_status == 'in_progress':
        update_data["started_at"] = datetime.now().isoformat()
        update_data["assigned_to"] = current_user.id
    
    result = await tenant_db.maintenance.update_one(
        {"id": request_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found or unchanged")
    
    # Send push notification to student about status update
    background_tasks.add_task(
        send_maintenance_notification_task,
        request["student_id"],
        new_status.replace("_", " ").title(),
        request.get("issue_type", "Maintenance")
    )
    
    return {"message": f"Request status updated to {new_status}"}


@router.post("/{request_id}/assign")
async def assign_maintenance_request(
    request_id: str, 
    assignment: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Assign a maintenance request to a facilitator/team (RAs and admins only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    facilitator_name = assignment.get('facilitator_name')
    facilitator_email = assignment.get('facilitator_email')
    notes = assignment.get('notes', '')
    
    if not facilitator_name or not facilitator_email:
        raise HTTPException(status_code=400, detail="Facilitator name and email required")
    
    update_data = {
        "assigned_facilitator_name": facilitator_name,
        "assigned_facilitator_email": facilitator_email,
        "assignment_notes": notes,
        "assigned_at": datetime.now().isoformat(),
        "assigned_by": current_user.id,
        "assigned_by_name": f"{current_user.first_name} {current_user.last_name}",
        "updated_at": datetime.now().isoformat()
    }
    
    result = await tenant_db.maintenance.update_one(
        {"id": request_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {
        "message": f"Request assigned to {facilitator_name}",
        "facilitator_email": facilitator_email
    }


# Facilitators/Teams management
@router.get("/facilitators/list")
async def get_facilitators(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get list of facilitators/teams for assignment (tenant isolated)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get facilitators from tenant database, or return defaults
    facilitators = await tenant_db.facilitators.find({}, {"_id": 0}).to_list(100)
    
    if not facilitators:
        # Return default facilitators if none exist
        facilitators = [
            {"id": "1", "name": "Maintenance Team", "email": "maintenance@college.edu", "category": "General"},
            {"id": "2", "name": "IT Support", "email": "it@college.edu", "category": "Electrical"},
            {"id": "3", "name": "Housekeeping", "email": "housekeeping@college.edu", "category": "Cleaning"},
            {"id": "4", "name": "Facilities Manager", "email": "facilities@college.edu", "category": "HVAC"},
            {"id": "5", "name": "Plumbing Services", "email": "plumbing@college.edu", "category": "Plumbing"}
        ]
    
    return facilitators


@router.post("/facilitators")
async def add_facilitator(
    facilitator: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Add a new facilitator/team (admins only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Only admins can add facilitators")
    
    import uuid
    facilitator_doc = {
        "id": str(uuid.uuid4()),
        "name": facilitator.get("name"),
        "email": facilitator.get("email"),
        "category": facilitator.get("category", "General"),
        "created_at": datetime.now().isoformat(),
        "created_by": current_user.id
    }
    
    await tenant_db.facilitators.insert_one(facilitator_doc)
    
    return {"message": "Facilitator added", "id": facilitator_doc["id"]}


@router.put("/{request_id}/resolve")
async def resolve_maintenance_request(
    request_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Resolve a maintenance request (RAs and admins only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await tenant_db.maintenance.update_one(
        {"id": request_id},
        {
            "$set": {
                "status": "resolved",
                "resolved_at": datetime.now().isoformat(),
                "resolved_by": current_user.id
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"message": "Request resolved successfully"}
