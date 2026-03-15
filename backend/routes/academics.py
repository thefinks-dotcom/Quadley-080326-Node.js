"""Academics routes - Study groups and tutoring - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
import uuid

from models import StudyGroup, StudyGroupCreate, TutoringRequest, TutoringRequestCreate
from utils.auth import get_tenant_db_for_user

router = APIRouter(tags=["academics"])


@router.post("/study-groups", response_model=StudyGroup)
async def create_study_group(
    group_data: StudyGroupCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a study group - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    # Create message group for study group chat
    message_group_id = str(uuid.uuid4())
    message_group = {
        "id": message_group_id,
        "name": f"Study Group: {group_data.name}",
        "type": "study_group",
        "members": [current_user.id],
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await tenant_db.message_groups.insert_one(message_group)
    
    group = StudyGroup(
        name=group_data.name,
        subject=group_data.subject,
        location=group_data.location,
        created_by=current_user.id,
        members=[current_user.id],
        max_members=group_data.max_members,
        meeting_schedule=group_data.meeting_schedule,
        message_group_id=message_group_id
    )
    
    group_doc = group.model_dump()
    group_doc['created_at'] = group_doc['created_at'].isoformat()
    await tenant_db.study_groups.insert_one(group_doc)
    
    return group


@router.get("/study-groups", response_model=List[StudyGroup])
async def get_study_groups(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all study groups - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    groups = await tenant_db.study_groups.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for group in groups:
        if isinstance(group.get('created_at'), str):
            group['created_at'] = datetime.fromisoformat(group['created_at'])
    
    return groups


@router.post("/study-groups/{group_id}/join")
async def join_study_group(
    group_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Join a study group - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    group = await tenant_db.study_groups.find_one({"id": str(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    members = group.get('members', [])
    if current_user.id in members:
        raise HTTPException(status_code=400, detail="Already a member")
    
    if len(members) >= group.get('max_members', 10):
        raise HTTPException(status_code=400, detail="Group is full")
    
    members.append(current_user.id)
    await tenant_db.study_groups.update_one({"id": str(group_id)}, {"$set": {"members": members}})
    
    # Add user to message group
    if group.get('message_group_id'):
        await tenant_db.message_groups.update_one(
            {"id": str(group)['message_group_id']},
            {"$addToSet": {"members": current_user.id}}
        )
    
    return {"message": "Joined study group"}


@router.post("/tutoring", response_model=TutoringRequest)
async def request_tutoring(
    request_data: TutoringRequestCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Request tutoring - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    tutoring = TutoringRequest(
        student_id=current_user.id,
        student_name=f"{current_user.first_name} {current_user.last_name}",
        subject=request_data.subject,
        description=request_data.description
    )
    
    tutoring_doc = tutoring.model_dump()
    tutoring_doc['created_at'] = tutoring_doc['created_at'].isoformat()
    await tenant_db.tutoring.insert_one(tutoring_doc)
    
    return tutoring


@router.get("/tutoring", response_model=List[TutoringRequest])
async def get_tutoring_requests(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get tutoring requests - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role in ['ra', 'admin']:
        requests = await tenant_db.tutoring.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        requests = await tenant_db.tutoring.find({"student_id": str(current_user).id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for req in requests:
        if isinstance(req.get('created_at'), str):
            req['created_at'] = datetime.fromisoformat(req['created_at'])
    
    return requests


@router.post("/tutoring/start-chat/{tutor_id}")
async def start_tutor_chat(
    tutor_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create or get existing chat with a tutor - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    # Check if chat already exists
    existing_chat = await tenant_db.message_groups.find_one({
        "type": "tutor_chat",
        "members": {"$all": [current_user.id, tutor_id]}
    })
    
    if existing_chat:
        return {"message_group_id": existing_chat['id']}
    
    # Get tutor info
    tutor = await tenant_db.users.find_one({"id": str(tutor_id)}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    # Create new chat
    message_group_id = str(uuid.uuid4())
    message_group = {
        "id": message_group_id,
        "name": f"Tutoring Chat: {tutor.get('first_name', 'Tutor')} {tutor.get('last_name', '')}",
        "type": "tutor_chat",
        "members": [current_user.id, tutor_id],
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await tenant_db.message_groups.insert_one(message_group)
    
    return {"message_group_id": message_group_id}
