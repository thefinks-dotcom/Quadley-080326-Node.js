"""Student Activity Reporting Routes - Admin search and reporting for student activities - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import io
import csv

from utils.auth import get_tenant_db_for_user
from utils.csv_security import sanitize_csv_row

router = APIRouter(prefix="/student-reports", tags=["student_reports"])


class StudentActivitySummary(BaseModel):
    """Summary of a student's activities within the college"""
    student_id: str
    student_name: str
    email: str
    role: str
    floor: Optional[str] = None
    enrollment_year: Optional[int] = None
    
    # Activity counts
    events_attended: int = 0
    jobs_held: int = 0
    clubs_joined: int = 0
    study_groups: int = 0
    mentoring_sessions: int = 0
    tutoring_sessions: int = 0
    shoutouts_given: int = 0
    shoutouts_received: int = 0
    service_requests: int = 0
    
    # Detailed activities
    activities: dict = {}


@router.get("/search")
async def search_students(
    query: Optional[str] = Query(None, description="Search by name or email"),
    year: Optional[int] = Query(None, description="Filter by enrollment year"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type: events, jobs, clubs, study_groups, mentoring, tutoring"),
    floor: Optional[str] = Query(None, description="Filter by floor"),
    role: Optional[str] = Query(None, description="Filter by role: student, ra, admin"),
    include_inactive: bool = Query(False, description="Include inactive/graduated students"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Search for students with optional filters - tenant isolated.
    Returns basic student info with activity counts.
    Admins only.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can access student reports")
    
    # Build search query
    search_filter = {}
    
    if query:
        # Search by name or email (case-insensitive)
        search_filter["$or"] = [
            {"first_name": {"$regex": query, "$options": "i"}},
            {"last_name": {"$regex": query, "$options": "i"}},
            {"email": {"$regex": query, "$options": "i"}}
        ]
    
    if year:
        search_filter["enrollment_year"] = year
    
    if floor:
        search_filter["floor"] = {"$regex": floor, "$options": "i"}
    
    if role:
        search_filter["role"] = role
    
    if not include_inactive:
        search_filter["is_active"] = {"$ne": False}
    
    # Get students matching basic criteria
    students = await tenant_db.users.find(
        search_filter,
        {"_id": 0, "password": 0}
    ).skip(offset).limit(limit).to_list(limit)
    
    # Get total count for pagination
    total_count = await tenant_db.users.count_documents(search_filter)
    
    # Enrich with activity counts
    results = []
    for student in students:
        student_id = student.get("id")
        
        # Get activity counts (parallel queries would be better in production)
        events_count = await tenant_db.event_registrations.count_documents({"user_id": str(student_id)})
        jobs_count = await tenant_db.job_applications.count_documents({"applicant_id": student_id})
        clubs_count = await tenant_db.club_memberships.count_documents({"user_id": str(student_id)})
        study_groups_count = await tenant_db.study_group_members.count_documents({"user_id": str(student_id)})
        mentoring_count = await tenant_db.mentoring_sessions.count_documents({
            "$or": [{"mentor_id": student_id}, {"mentee_id": student_id}]
        })
        tutoring_count = await tenant_db.tutoring_sessions.count_documents({
            "$or": [{"tutor_id": student_id}, {"student_id": str(student_id)}]
        })
        shoutouts_given = await tenant_db.shoutouts.count_documents({"from_user_id": student_id})
        shoutouts_received = await tenant_db.shoutouts.count_documents({"to_user_id": student_id})
        service_requests = await tenant_db.maintenance.count_documents({"student_id": str(student_id)})
        
        # Apply activity filter if specified
        if activity_type:
            activity_counts = {
                "events": events_count,
                "jobs": jobs_count,
                "clubs": clubs_count,
                "study_groups": study_groups_count,
                "mentoring": mentoring_count,
                "tutoring": tutoring_count
            }
            if activity_counts.get(activity_type, 0) == 0:
                continue  # Skip students without this activity
        
        results.append({
            "student_id": student_id,
            "first_name": student.get("first_name"),
            "last_name": student.get("last_name"),
            "email": student.get("email"),
            "role": student.get("role"),
            "floor": student.get("floor"),
            "enrollment_year": student.get("enrollment_year"),
            "is_active": student.get("is_active", True),
            "activity_counts": {
                "events_attended": events_count,
                "jobs_held": jobs_count,
                "clubs_joined": clubs_count,
                "study_groups": study_groups_count,
                "mentoring_sessions": mentoring_count,
                "tutoring_sessions": tutoring_count,
                "shoutouts_given": shoutouts_given,
                "shoutouts_received": shoutouts_received,
                "service_requests": service_requests
            },
            "total_activities": events_count + jobs_count + clubs_count + study_groups_count + mentoring_count + tutoring_count
        })
    
    return {
        "students": results,
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "filters_applied": {
            "query": query,
            "year": year,
            "activity_type": activity_type,
            "floor": floor,
            "role": role,
            "include_inactive": include_inactive
        }
    }


@router.get("/student/{student_id}")
async def get_student_activity_detail(
    student_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Get detailed activity report for a specific student - tenant isolated.
    Includes all activities across all categories.
    Admins only.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can access student reports")
    
    # Get student info
    student = await tenant_db.users.find_one({"id": str(student_id)}, {"_id": 0, "password": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get all events attended
    event_registrations = await tenant_db.event_registrations.find(
        {"user_id": str(student_id)}, {"_id": 0}
    ).to_list(1000)
    
    events_attended = []
    for reg in event_registrations:
        event = await tenant_db.events.find_one({"id": str(reg).get("event_id")}, {"_id": 0})
        if event:
            events_attended.append({
                "event_id": event.get("id"),
                "title": event.get("title"),
                "date": event.get("date"),
                "category": event.get("category"),
                "registered_at": reg.get("registered_at")
            })
    
    # Get all job applications/positions
    job_applications = await tenant_db.job_applications.find(
        {"applicant_id": student_id}, {"_id": 0}
    ).to_list(1000)
    
    jobs = []
    for app in job_applications:
        job = await tenant_db.jobs.find_one({"id": str(app).get("job_id")}, {"_id": 0})
        if job:
            jobs.append({
                "job_id": job.get("id"),
                "title": job.get("title"),
                "category": job.get("category"),
                "status": app.get("status"),
                "applied_at": app.get("applied_at")
            })
    
    # Get club memberships
    club_memberships = await tenant_db.club_memberships.find(
        {"user_id": str(student_id)}, {"_id": 0}
    ).to_list(1000)
    
    clubs = []
    for membership in club_memberships:
        club = await tenant_db.clubs.find_one({"id": str(membership).get("club_id")}, {"_id": 0})
        if club:
            clubs.append({
                "club_id": club.get("id"),
                "name": club.get("name"),
                "category": club.get("category"),
                "role": membership.get("role", "member"),
                "joined_at": membership.get("joined_at")
            })
    
    # Get study groups
    study_group_memberships = await tenant_db.study_group_members.find(
        {"user_id": str(student_id)}, {"_id": 0}
    ).to_list(1000)
    
    study_groups = []
    for membership in study_group_memberships:
        group = await tenant_db.study_groups.find_one({"id": str(membership).get("group_id")}, {"_id": 0})
        if group:
            study_groups.append({
                "group_id": group.get("id"),
                "name": group.get("name"),
                "subject": group.get("subject"),
                "role": membership.get("role", "member"),
                "joined_at": membership.get("joined_at")
            })
    
    # Get mentoring sessions (as mentor or mentee)
    mentoring_as_mentor = await tenant_db.mentoring_sessions.find(
        {"mentor_id": student_id}, {"_id": 0}
    ).to_list(1000)
    
    mentoring_as_mentee = await tenant_db.mentoring_sessions.find(
        {"mentee_id": student_id}, {"_id": 0}
    ).to_list(1000)
    
    mentoring = {
        "as_mentor": [{
            "session_id": s.get("id"),
            "mentee_name": s.get("mentee_name"),
            "subject": s.get("subject"),
            "date": s.get("date"),
            "status": s.get("status")
        } for s in mentoring_as_mentor],
        "as_mentee": [{
            "session_id": s.get("id"),
            "mentor_name": s.get("mentor_name"),
            "subject": s.get("subject"),
            "date": s.get("date"),
            "status": s.get("status")
        } for s in mentoring_as_mentee]
    }
    
    # Get tutoring sessions (as tutor or student)
    tutoring_as_tutor = await tenant_db.tutoring_sessions.find(
        {"tutor_id": student_id}, {"_id": 0}
    ).to_list(1000)
    
    tutoring_as_student = await tenant_db.tutoring_sessions.find(
        {"student_id": str(student_id)}, {"_id": 0}
    ).to_list(1000)
    
    tutoring = {
        "as_tutor": [{
            "session_id": s.get("id"),
            "student_name": s.get("student_name"),
            "subject": s.get("subject"),
            "date": s.get("date"),
            "status": s.get("status")
        } for s in tutoring_as_tutor],
        "as_student": [{
            "session_id": s.get("id"),
            "tutor_name": s.get("tutor_name"),
            "subject": s.get("subject"),
            "date": s.get("date"),
            "status": s.get("status")
        } for s in tutoring_as_student]
    }
    
    # Get shoutouts given and received
    shoutouts_given = await tenant_db.shoutouts.find(
        {"from_user_id": student_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    shoutouts_received = await tenant_db.shoutouts.find(
        {"to_user_id": student_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get service/maintenance requests
    service_requests = await tenant_db.maintenance.find(
        {"student_id": str(student_id)}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Compile activity summary
    return {
        "student": {
            "id": student.get("id"),
            "first_name": student.get("first_name"),
            "last_name": student.get("last_name"),
            "email": student.get("email"),
            "role": student.get("role"),
            "floor": student.get("floor"),
            "enrollment_year": student.get("enrollment_year"),
            "is_active": student.get("is_active", True),
            "created_at": student.get("created_at")
        },
        "activity_summary": {
            "events_attended": len(events_attended),
            "jobs_applied": len(jobs),
            "clubs_joined": len(clubs),
            "study_groups": len(study_groups),
            "mentoring_sessions": len(mentoring["as_mentor"]) + len(mentoring["as_mentee"]),
            "tutoring_sessions": len(tutoring["as_tutor"]) + len(tutoring["as_student"]),
            "shoutouts_given": len(shoutouts_given),
            "shoutouts_received": len(shoutouts_received),
            "service_requests": len(service_requests)
        },
        "activities": {
            "events": events_attended,
            "jobs": jobs,
            "clubs": clubs,
            "study_groups": study_groups,
            "mentoring": mentoring,
            "tutoring": tutoring,
            "shoutouts_given": [{
                "id": s.get("id"),
                "to_user_name": s.get("to_user_name") or s.get("recipient_name"),
                "message": s.get("message"),
                "category": s.get("category"),
                "created_at": s.get("created_at")
            } for s in shoutouts_given],
            "shoutouts_received": [{
                "id": s.get("id"),
                "from_user_name": s.get("from_user_name") or s.get("sender_name"),
                "message": s.get("message"),
                "category": s.get("category"),
                "created_at": s.get("created_at")
            } for s in shoutouts_received],
            "service_requests": [{
                "id": s.get("id"),
                "issue_type": s.get("issue_type"),
                "description": s.get("description"),
                "status": s.get("status"),
                "created_at": s.get("created_at")
            } for s in service_requests]
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/activity-types")
async def get_activity_types(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get available activity types for filtering - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can access student reports")
    
    return {
        "activity_types": [
            {"id": "events", "name": "Events Attended", "description": "College events and activities"},
            {"id": "jobs", "name": "Jobs", "description": "Job applications and positions held"},
            {"id": "clubs", "name": "Clubs & Societies", "description": "Club and society memberships"},
            {"id": "study_groups", "name": "Study Groups", "description": "Academic study group participation"},
            {"id": "mentoring", "name": "Mentoring", "description": "Mentoring sessions (as mentor or mentee)"},
            {"id": "tutoring", "name": "Tutoring", "description": "Tutoring sessions (as tutor or student)"}
        ]
    }


@router.get("/years")
async def get_enrollment_years(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get list of enrollment years with student counts - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can access student reports")
    
    # Aggregate enrollment years
    pipeline = [
        {"$match": {"enrollment_year": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$enrollment_year", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}}
    ]
    
    years = await tenant_db.users.aggregate(pipeline).to_list(100)
    
    return {
        "years": [
            {"year": y["_id"], "student_count": y["count"]}
            for y in years if y["_id"]
        ]
    }


@router.get("/floors")
async def get_floors(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get list of floors with student counts - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can access student reports")
    
    # Aggregate floors
    pipeline = [
        {"$match": {"floor": {"$exists": True, "$nin": [None, ""]}}},
        {"$group": {"_id": "$floor", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    
    floors = await tenant_db.users.aggregate(pipeline).to_list(100)
    
    return {
        "floors": [
            {"floor": f["_id"], "student_count": f["count"]}
            for f in floors if f["_id"]
        ]
    }


@router.get("/export/csv")
async def export_student_report_csv(
    query: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    activity_type: Optional[str] = Query(None),
    floor: Optional[str] = Query(None),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Export student activity report as CSV - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can export reports")
    
    # Get students (reuse search logic)
    search_result = await search_students(
        query=query,
        year=year,
        activity_type=activity_type,
        floor=floor,
        role=None,
        include_inactive=True,
        limit=1000,
        offset=0,
        tenant_data=tenant_data
    )
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Student ID", "First Name", "Last Name", "Email", "Role", "Floor",
        "Enrollment Year", "Active", "Events", "Jobs", "Clubs", 
        "Study Groups", "Mentoring", "Tutoring", "Shoutouts Given",
        "Shoutouts Received", "Service Requests", "Total Activities"
    ])
    
    # Data rows
    for student in search_result["students"]:
        counts = student["activity_counts"]
        writer.writerow(sanitize_csv_row([
            student["student_id"],
            student["first_name"],
            student["last_name"],
            student["email"],
            student["role"],
            student["floor"] or "",
            student["enrollment_year"] or "",
            "Yes" if student["is_active"] else "No",
            counts["events_attended"],
            counts["jobs_held"],
            counts["clubs_joined"],
            counts["study_groups"],
            counts["mentoring_sessions"],
            counts["tutoring_sessions"],
            counts["shoutouts_given"],
            counts["shoutouts_received"],
            counts["service_requests"],
            student["total_activities"]
        ]))
    
    output.seek(0)
    filename = f"student_activity_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
