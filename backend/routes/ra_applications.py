"""RA Applications routes - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime

from models import RAApplication, RAApplicationCreate, RAApplicationSubmission, RAApplicationSubmissionCreate
from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/ra-applications", tags=["ra_applications"])


@router.post("", response_model=RAApplication)
async def create_ra_application(
    ra_app_data: RAApplicationCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create RA application posting (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create RA applications")
    
    ra_app = RAApplication(
        title=ra_app_data.title,
        description=ra_app_data.description,
        requirements=ra_app_data.requirements,
        due_date=ra_app_data.due_date,
        created_by=current_user.id
    )
    
    ra_app_doc = ra_app.model_dump()
    ra_app_doc['created_at'] = ra_app_doc['created_at'].isoformat()
    await tenant_db.ra_applications.insert_one(ra_app_doc)
    
    return ra_app


@router.get("", response_model=List[RAApplication])
async def get_ra_applications(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all RA applications - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    applications = await tenant_db.ra_applications.find(
        {"status": "open"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for app in applications:
        if isinstance(app.get('created_at'), str):
            app['created_at'] = datetime.fromisoformat(app['created_at'])
    
    return applications


@router.post("/{ra_app_id}/submit", response_model=RAApplicationSubmission)
async def submit_ra_application(
    ra_app_id: str, 
    submission_data: RAApplicationSubmissionCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Submit RA application - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    ra_app = await tenant_db.ra_applications.find_one({"id": ra_app_id}, {"_id": 0})
    if not ra_app:
        raise HTTPException(status_code=404, detail="RA application not found")
    
    # Check if already submitted
    existing = await tenant_db.ra_application_submissions.find_one({
        "ra_application_id": ra_app_id,
        "applicant_id": current_user.id
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted an application")
    
    submission = RAApplicationSubmission(
        ra_application_id=ra_app_id,
        applicant_id=current_user.id,
        applicant_name=f"{current_user.first_name} {current_user.last_name}",
        applicant_email=current_user.email,
        responses=submission_data.responses,
        resume_url=submission_data.resume_url
    )
    
    submission_doc = submission.model_dump()
    submission_doc['submitted_at'] = submission_doc['submitted_at'].isoformat()
    await tenant_db.ra_application_submissions.insert_one(submission_doc)
    
    return submission


@router.get("/{ra_app_id}/submissions", response_model=List[RAApplicationSubmission])
async def get_ra_application_submissions(
    ra_app_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get submissions for RA application (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view submissions")
    
    submissions = await tenant_db.ra_application_submissions.find(
        {"ra_application_id": ra_app_id},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(1000)
    
    for sub in submissions:
        if isinstance(sub.get('submitted_at'), str):
            sub['submitted_at'] = datetime.fromisoformat(sub['submitted_at'])
    
    return submissions
