"""College Jobs routes - Job posting, applications, and management
REFACTORED: Now uses tenant-isolated database for data security.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from typing import List, Optional, Tuple
from datetime import datetime, timezone
from pathlib import Path
import hashlib
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import (
    User, Job, JobCreate, JobUpdate, 
    JobApplication, JobApplicationCreate, JobApplicationStatusUpdate
)
from utils.auth import get_tenant_db_for_user
from utils.security_logger import log_security_event, SecurityEvent

router = APIRouter(prefix="/jobs", tags=["jobs"])

# Allowed roles for job management
JOB_ADMIN_ROLES = ['admin', 'super_admin', 'college_admin']

# Allowed file types for resume upload
ALLOWED_RESUME_EXTENSIONS = {'.pdf', '.doc', '.docx'}
MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5MB

# Magic bytes for allowed resume file types
ALLOWED_MAGIC_BYTES = [
    b'%PDF',          # PDF
    b'PK\x03\x04',   # DOCX (ZIP)
    b'\xd0\xcf\x11\xe0',  # DOC (Compound Binary)
]


# ====== JOB CRUD ENDPOINTS ======

@router.post("", response_model=Job)
async def create_job(
    job_data: JobCreate, 
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Create a new job posting (College Admin and Super Admin only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in JOB_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can create job postings")
    
    job = Job(
        title=job_data.title,
        description=job_data.description,
        category=job_data.category,
        hours_per_week=job_data.hours_per_week,
        pay_rate=job_data.pay_rate,
        department=job_data.department,
        supervisor=job_data.supervisor,
        location=job_data.location,
        required_skills=job_data.required_skills,
        preferred_qualifications=job_data.preferred_qualifications,
        responsibilities=job_data.responsibilities,
        application_deadline=job_data.application_deadline,
        positions_available=job_data.positions_available,
        status=job_data.status,
        created_by=current_user.id,
        created_by_name=f"{current_user.first_name} {current_user.last_name}"
    )
    
    job_doc = job.model_dump()
    job_doc['created_at'] = job_doc['created_at'].isoformat()
    await tenant_db.jobs.insert_one(job_doc)
    
    # Log admin action
    log_security_event(
        SecurityEvent.ADMIN_ACTION,
        user_id=current_user.id,
        user_email=current_user.email,
        details={"action": "create_job", "job_id": job.id, "title": job.title}
    )
    
    return job


@router.get("", response_model=List[Job])
async def get_jobs(
    status: Optional[str] = None,
    category: Optional[str] = None,
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Get all jobs (students see active only, admins see all)"""
    tenant_db, current_user = tenant_data
    query = {}
    
    # Students only see active jobs
    if current_user.role not in JOB_ADMIN_ROLES:
        query["status"] = "active"
    elif status:
        query["status"] = status
    
    if category:
        query["category"] = category
    
    jobs = await tenant_db.jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for job in jobs:
        if isinstance(job.get('created_at'), str):
            job['created_at'] = datetime.fromisoformat(job['created_at'])
        if job.get('updated_at') and isinstance(job['updated_at'], str):
            job['updated_at'] = datetime.fromisoformat(job['updated_at'])
        
        # Get applications count
        app_count = await tenant_db.job_applications.count_documents({"job_id": job['id']})
        job['applications_count'] = app_count
    
    return jobs


@router.get("/categories")
async def get_job_categories(
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Get all unique job categories"""
    tenant_db, current_user = tenant_data
    pipeline = [
        {"$group": {"_id": "$category"}},
        {"$sort": {"_id": 1}}
    ]
    categories = await tenant_db.jobs.aggregate(pipeline).to_list(100)
    return [cat['_id'] for cat in categories if cat['_id']]


@router.get("/my/applications", response_model=List[JobApplication])
async def get_my_applications(
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Get current user's job applications"""
    tenant_db, current_user = tenant_data
    applications = await tenant_db.job_applications.find(
        {"applicant_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for app in applications:
        if isinstance(app.get('created_at'), str):
            app['created_at'] = datetime.fromisoformat(app['created_at'])
        if app.get('updated_at') and isinstance(app['updated_at'], str):
            app['updated_at'] = datetime.fromisoformat(app['updated_at'])
    
    return applications


@router.get("/admin/stats")
async def get_jobs_stats(
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Get job statistics for admin dashboard"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in JOB_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Job counts by status
    active_jobs = await tenant_db.jobs.count_documents({"status": "active"})
    closed_jobs = await tenant_db.jobs.count_documents({"status": "closed"})
    filled_jobs = await tenant_db.jobs.count_documents({"status": "filled"})
    
    # Application counts by status
    pending_apps = await tenant_db.job_applications.count_documents({"status": "pending"})
    reviewing_apps = await tenant_db.job_applications.count_documents({"status": "reviewing"})
    interview_apps = await tenant_db.job_applications.count_documents({"status": "interview"})
    
    # Recent applications
    recent_apps = await tenant_db.job_applications.find(
        {},
        {"_id": 0, "id": 1, "job_title": 1, "applicant_name": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "jobs": {
            "active": active_jobs,
            "closed": closed_jobs,
            "filled": filled_jobs,
            "total": active_jobs + closed_jobs + filled_jobs
        },
        "applications": {
            "pending": pending_apps,
            "reviewing": reviewing_apps,
            "interview": interview_apps,
            "total": pending_apps + reviewing_apps + interview_apps
        },
        "recent_applications": recent_apps
    }


@router.get("/admin/all-applications", response_model=List[JobApplication])
async def get_all_applications(
    status: Optional[str] = None,
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Get all job applications across all jobs (Admin only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in JOB_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can view all applications")
    
    query = {}
    if status:
        query["status"] = status
    
    applications = await tenant_db.job_applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    for app in applications:
        if isinstance(app.get('created_at'), str):
            app['created_at'] = datetime.fromisoformat(app['created_at'])
    
    return applications


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: str, 
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Get a specific job by ID"""
    tenant_db, current_user = tenant_data
    job = await tenant_db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Students can only see active jobs
    if current_user.role not in JOB_ADMIN_ROLES and job.get('status') != 'active':
        raise HTTPException(status_code=404, detail="Job not found")
    
    if isinstance(job.get('created_at'), str):
        job['created_at'] = datetime.fromisoformat(job['created_at'])
    
    # Get applications count
    app_count = await tenant_db.job_applications.count_documents({"job_id": job_id})
    job['applications_count'] = app_count
    
    return job


@router.patch("/{job_id}", response_model=Job)
async def update_job(
    job_id: str, 
    job_data: JobUpdate, 
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Update a job posting (Admin only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in JOB_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can update job postings")
    
    job = await tenant_db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    update_data = {k: v for k, v in job_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await tenant_db.jobs.update_one({"id": job_id}, {"$set": update_data})
    
    updated_job = await tenant_db.jobs.find_one({"id": job_id}, {"_id": 0})
    if isinstance(updated_job.get('created_at'), str):
        updated_job['created_at'] = datetime.fromisoformat(updated_job['created_at'])
    if isinstance(updated_job.get('updated_at'), str):
        updated_job['updated_at'] = datetime.fromisoformat(updated_job['updated_at'])
    
    return updated_job


@router.delete("/{job_id}")
async def delete_job(
    job_id: str, 
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Delete a job posting (Admin only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in JOB_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can delete job postings")
    
    job = await tenant_db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Delete job and all its applications
    await tenant_db.jobs.delete_one({"id": job_id})
    await tenant_db.job_applications.delete_many({"job_id": job_id})
    
    log_security_event(
        SecurityEvent.ADMIN_ACTION,
        user_id=current_user.id,
        user_email=current_user.email,
        details={"action": "delete_job", "job_id": job_id}
    )
    
    return {"message": "Job deleted successfully"}


# ====== APPLICATION ENDPOINTS ======

@router.post("/{job_id}/apply", response_model=JobApplication)
async def apply_for_job(
    job_id: str, 
    application: JobApplicationCreate,
    background_tasks: BackgroundTasks,
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Apply for a job - sends real-time notification to admins"""
    tenant_db, current_user = tenant_data
    
    # Get job
    job = await tenant_db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.get('status') != 'active':
        raise HTTPException(status_code=400, detail="This job is no longer accepting applications")
    
    # Check deadline
    if job.get('application_deadline'):
        try:
            deadline_str = job['application_deadline']
            # Handle both with and without timezone
            if 'Z' in deadline_str or '+' in deadline_str:
                deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
            else:
                # Assume end of day in UTC for dates without time
                deadline = datetime.fromisoformat(deadline_str + 'T23:59:59+00:00')
            
            if datetime.now(timezone.utc) > deadline:
                raise HTTPException(status_code=400, detail="Application deadline has passed")
        except (ValueError, AttributeError):
            pass  # Invalid deadline format, skip check
    
    # Check if already applied
    existing = await tenant_db.job_applications.find_one({
        "job_id": job_id,
        "applicant_id": current_user.id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied for this job")
    
    # Create application
    applicant_name = f"{current_user.first_name} {current_user.last_name}"
    job_application = JobApplication(
        job_id=job_id,
        job_title=job['title'],
        applicant_id=current_user.id,
        applicant_name=applicant_name,
        applicant_email=current_user.email,
        cover_letter=application.cover_letter,
        availability=application.availability,
        start_date=application.start_date,
        experience=application.experience,
        relevant_coursework=application.relevant_coursework,
        references=application.references,
        why_interested=application.why_interested,
        additional_info=application.additional_info
    )
    
    app_doc = job_application.model_dump()
    app_doc['created_at'] = app_doc['created_at'].isoformat()
    await tenant_db.job_applications.insert_one(app_doc)
    
    # Send real-time notification to admins (background task for fast response)
    # Security: Pass tenant_code for notification isolation
    from routes.notifications import notify_job_application
    background_tasks.add_task(
        notify_job_application,
        tenant_db,
        job_id,
        job['title'],
        applicant_name,
        current_user.email,
        current_user.tenant_code  # For tenant isolation
    )
    
    return job_application


@router.post("/{job_id}/apply/resume")
async def upload_resume(
    job_id: str,
    file: UploadFile = File(...),
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Upload resume for job application"""
    tenant_db, current_user = tenant_data
    
    # Verify job exists
    job = await tenant_db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if user has an application
    application = await tenant_db.job_applications.find_one({
        "job_id": job_id,
        "applicant_id": current_user.id
    })
    if not application:
        raise HTTPException(status_code=400, detail="Please submit your application first")
    
    # Validate file
    filename = file.filename or "resume"
    ext = Path(filename).suffix.lower()
    
    if ext not in ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type {ext} not allowed. Allowed: {', '.join(ALLOWED_RESUME_EXTENSIONS)}"
        )
    
    content = await file.read()
    if len(content) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5MB")

    if not any(content.startswith(magic) for magic in ALLOWED_MAGIC_BYTES):
        raise HTTPException(status_code=400, detail="File content does not match expected type. Only PDF and Word documents are permitted.")
    
    # Generate safe filename
    file_hash = hashlib.sha256(content).hexdigest()[:12]
    safe_filename = f"resume_{current_user.id}_{file_hash}{ext}"
    
    # Save file
    upload_dir = Path("/app/backend/uploads/resumes")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / safe_filename
    with file_path.open("wb") as buffer:
        buffer.write(content)
    
    resume_url = f"/api/uploads/resumes/{safe_filename}"
    
    # Update application with resume URL
    await tenant_db.job_applications.update_one(
        {"id": application['id']},
        {"$set": {"resume_url": resume_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"url": resume_url, "filename": safe_filename}


@router.get("/{job_id}/applications", response_model=List[JobApplication])
async def get_job_applications(
    job_id: str,
    status: Optional[str] = None,
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Get all applications for a job (Admin only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in JOB_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can view all applications")
    
    query = {"job_id": job_id}
    if status:
        query["status"] = status
    
    applications = await tenant_db.job_applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for app in applications:
        if isinstance(app.get('created_at'), str):
            app['created_at'] = datetime.fromisoformat(app['created_at'])
        if app.get('updated_at') and isinstance(app['updated_at'], str):
            app['updated_at'] = datetime.fromisoformat(app['updated_at'])
    
    return applications


@router.patch("/applications/{application_id}/status")
async def update_application_status(
    application_id: str,
    status_update: JobApplicationStatusUpdate,
    background_tasks: BackgroundTasks,
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Update application status (Admin only) - sends notification to applicant"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in JOB_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can update application status")
    
    application = await tenant_db.job_applications.find_one({"id": application_id})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    valid_statuses = ['pending', 'reviewing', 'interview', 'accepted', 'rejected', 'withdrawn']
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {
        "status": status_update.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": current_user.id,
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status_update.admin_notes:
        update_data["admin_notes"] = status_update.admin_notes
    
    await tenant_db.job_applications.update_one({"id": application_id}, {"$set": update_data})
    
    # Notify the applicant of status change (background task)
    # Security: Pass tenant_code for notification isolation
    from routes.notifications import notify_application_status_change
    background_tasks.add_task(
        notify_application_status_change,
        application['applicant_id'],
        application['job_title'],
        status_update.status,
        current_user.tenant_code  # For tenant isolation
    )
    
    log_security_event(
        SecurityEvent.ADMIN_ACTION,
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "action": "update_application_status",
            "application_id": application_id,
            "new_status": status_update.status
        }
    )
    
    return {"message": f"Application status updated to {status_update.status}"}


@router.delete("/applications/{application_id}")
async def withdraw_application(
    application_id: str, 
    tenant_data: Tuple[AsyncIOMotorDatabase, User] = Depends(get_tenant_db_for_user)
):
    """Withdraw own application or delete any application (admin)"""
    tenant_db, current_user = tenant_data
    
    application = await tenant_db.job_applications.find_one({"id": application_id})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Students can only withdraw their own applications
    if current_user.role not in JOB_ADMIN_ROLES:
        if application['applicant_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="You can only withdraw your own applications")
        
        # Mark as withdrawn instead of deleting
        await tenant_db.job_applications.update_one(
            {"id": application_id},
            {"$set": {"status": "withdrawn", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Application withdrawn"}
    
    # Admins can delete applications
    await tenant_db.job_applications.delete_one({"id": application_id})
    return {"message": "Application deleted"}
