"""Tutoring routes - tutor applications and management (Tenant isolated)"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid

from models import TutorApplication, TutorApplicationCreate
from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/tutoring", tags=["tutoring"])


class AdminTutorCreate(BaseModel):
    """Model for admin to directly create a tutor"""
    student_email: str
    subjects: List[str]
    bio: Optional[str] = None
    available_times: List[str]


@router.post("/apply", response_model=TutorApplication)
async def apply_to_tutor(
    application_data: TutorApplicationCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Apply to become a tutor"""
    tenant_db, current_user = tenant_data
    
    existing = await tenant_db.tutor_applications.find_one({
        "student_id": current_user.id,
        "status": {"$in": ["pending", "approved"]}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending or approved tutor application")
    
    application_dict = {
        "id": str(uuid.uuid4()),
        "student_id": current_user.id,
        "student_name": f"{current_user.first_name} {current_user.last_name}",
        "student_email": current_user.email,
        "subjects": application_data.subjects,
        "bio": application_data.bio,
        "available_times": application_data.available_times,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None
    }
    
    await tenant_db.tutor_applications.insert_one(application_dict)
    
    return TutorApplication(**application_dict)


@router.get("/applications")
async def get_tutor_applications(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get tutor applications"""
    tenant_db, current_user = tenant_data
    
    if current_user.role in ["admin", "super_admin", "college_admin"]:
        applications = await tenant_db.tutor_applications.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        applications = await tenant_db.tutor_applications.find(
            {"student_id": current_user.id}, 
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    
    return applications


@router.put("/applications/{application_id}/review")
async def review_tutor_application(
    application_id: str,
    status: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Review tutor application (admin only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can review applications")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    existing = await tenant_db.tutor_applications.find_one({"id": application_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Application not found")
    
    await tenant_db.tutor_applications.update_one(
        {"id": application_id},
        {"$set": {
            "status": status,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": current_user.id
        }}
    )
    
    return {"message": f"Application {status}"}


@router.get("/approved")
async def get_approved_tutors(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all approved tutors"""
    tenant_db, current_user = tenant_data
    
    applications = await tenant_db.tutor_applications.find({"status": "approved"}, {"_id": 0}).to_list(100)
    
    # Transform to ApprovedTutor format
    approved_tutors = []
    for app in applications:
        tutor = {
            "id": app["id"],
            "student_id": app["student_id"],
            "student_name": app["student_name"],
            "student_email": app["student_email"],
            "subjects": app["subjects"],
            "bio": app.get("bio"),
            "available_times": app["available_times"],
            "approved_at": app.get("reviewed_at", app["created_at"])
        }
        approved_tutors.append(tutor)
    
    return approved_tutors


@router.post("/admin/create")
async def admin_create_tutor(
    tutor_data: AdminTutorCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Admin directly creates a tutor without application process"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can directly create tutors")
    
    # Find the student by email
    student = await tenant_db.users.find_one({"email": tutor_data.student_email}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with email {tutor_data.student_email} not found")
    
    # Check if already a tutor
    existing = await tenant_db.tutor_applications.find_one({
        "student_id": student["id"],
        "status": "approved"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="This student is already an approved tutor")
    
    now = datetime.now(timezone.utc)
    
    # Create approved tutor application directly
    tutor_doc = {
        "id": str(uuid.uuid4()),
        "student_id": student["id"],
        "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
        "student_email": student["email"],
        "subjects": tutor_data.subjects,
        "bio": tutor_data.bio or "",
        "available_times": tutor_data.available_times,
        "status": "approved",
        "created_at": now.isoformat(),
        "reviewed_at": now.isoformat(),
        "reviewed_by": current_user.id,
        "created_by_admin": True
    }
    
    await tenant_db.tutor_applications.insert_one(tutor_doc)
    
    return {
        "message": "Tutor created successfully",
        "tutor": {
            "id": tutor_doc["id"],
            "student_name": tutor_doc["student_name"],
            "student_email": tutor_doc["student_email"],
            "subjects": tutor_doc["subjects"],
            "available_times": tutor_doc["available_times"]
        }
    }


@router.delete("/admin/{tutor_id}")
async def admin_remove_tutor(
    tutor_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Admin removes a tutor (revokes approved status)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can remove tutors")
    
    existing = await tenant_db.tutor_applications.find_one({"id": tutor_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    await tenant_db.tutor_applications.update_one(
        {"id": tutor_id},
        {"$set": {
            "status": "revoked",
            "revoked_at": datetime.now(timezone.utc).isoformat(),
            "revoked_by": current_user.id
        }}
    )
    
    return {"message": "Tutor status revoked"}
