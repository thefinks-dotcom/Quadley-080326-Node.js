"""Floor-specific routes (houses/floors) - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
import uuid

from models import User, FloorEvent, FloorEventCreate
from utils.auth import get_tenant_db_for_user


router = APIRouter(tags=["floor"])


@router.get("/floor/users", response_model=List[User])
async def get_floor_users(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all users on the same floor - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    users = await tenant_db.users.find(
        {"floor": current_user.floor},
        {"_id": 0, "password": 0}
    ).to_list(100)
    
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    
    return users


@router.get("/floor-events", response_model=List[FloorEvent])
async def get_floor_events(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get floor events - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    query = {"_id": 0}
    floor_filter = {}
    if current_user.floor:
        floor_filter["floor"] = current_user.floor
    
    events = await tenant_db.floor_events.find(
        floor_filter,
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    for event in events:
        if isinstance(event.get('created_at'), str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
        if isinstance(event.get('date'), str):
            event['date'] = datetime.fromisoformat(event['date'])
    
    return events


@router.post("/floor-events", response_model=FloorEvent)
async def create_floor_event(
    event_data: FloorEventCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a floor event (RA only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Only RAs can create floor events")
    
    event = FloorEvent(
        title=event_data.title,
        description=event_data.description,
        date=event_data.date,
        location=event_data.location,
        floor=current_user.floor or event_data.floor or "Unassigned",
        created_by=current_user.id,
        created_by_name=f"{current_user.first_name} {current_user.last_name}",
        max_attendees=event_data.max_attendees
    )
    
    event_doc = event.model_dump()
    event_doc['created_at'] = event_doc['created_at'].isoformat()
    event_doc['date'] = event_doc['date'].isoformat()
    await tenant_db.floor_events.insert_one(event_doc)
    
    return event


@router.put("/floor-events/{event_id}", response_model=FloorEvent)
async def update_floor_event(
    event_id: str,
    event_data: FloorEventCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update a floor event (creator or RA/admin) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    existing = await tenant_db.floor_events.find_one({"id": str(event_id)}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Floor event not found")
    
    if existing.get('created_by') != current_user.id and current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "title": event_data.title,
        "description": event_data.description,
        "date": event_data.date.isoformat(),
        "location": event_data.location,
    }
    if event_data.max_attendees is not None:
        update_data["max_attendees"] = event_data.max_attendees
    
    await tenant_db.floor_events.update_one({"id": str(event_id)}, {"$set": update_data})
    
    updated = await tenant_db.floor_events.find_one({"id": str(event_id)}, {"_id": 0})
    if isinstance(updated.get('date'), str):
        updated['date'] = datetime.fromisoformat(updated['date'])
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return updated


@router.delete("/floor-events/{event_id}")
async def delete_floor_event(
    event_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete a floor event (creator or RA/admin) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    existing = await tenant_db.floor_events.find_one({"id": str(event_id)}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Floor event not found")
    
    if existing.get('created_by') != current_user.id and current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await tenant_db.floor_events.delete_one({"id": str(event_id)})
    return {"message": "Floor event deleted"}


@router.post("/floor-events/{event_id}/rsvp")
async def rsvp_floor_event(
    event_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """RSVP to a floor event - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    event = await tenant_db.floor_events.find_one({"id": str(event_id)})
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    attendees = event.get('attendees', [])
    
    if current_user.id in attendees:
        raise HTTPException(status_code=400, detail="Already RSVP'd")
    
    attendees.append(current_user.id)
    
    await tenant_db.floor_events.update_one(
        {"id": str(event_id)},
        {"$set": {"attendees": attendees}}
    )
    
    return {"message": "RSVP successful"}


@router.get("/emergency-contacts")
async def get_emergency_contacts(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get emergency contacts - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    contacts = await tenant_db.emergency_contacts.find({}, {"_id": 0}).to_list(100)
    
    for contact in contacts:
        if isinstance(contact.get('created_at'), str):
            contact['created_at'] = datetime.fromisoformat(contact['created_at'])
    
    return contacts


@router.post("/emergency-contacts")
async def add_emergency_contact(
    contact_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Add emergency contact (RA/Admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Only RAs/Admins can add emergency contacts")
    
    contact = {
        "id": str(uuid.uuid4()),
        "name": contact_data.get('name'),
        "role": contact_data.get('role'),
        "phone": contact_data.get('phone'),
        "email": contact_data.get('email'),
        "available_hours": contact_data.get('available_hours'),
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await tenant_db.emergency_contacts.insert_one(contact)
    
    return contact


@router.get("/floor-message-groups")
async def get_floor_message_groups(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get floor message groups - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    groups = await tenant_db.floor_message_groups.find(
        {
            "$or": [
                {"floor": current_user.floor, "is_floor_wide": True},
                {"floor": current_user.floor, "members": current_user.id}
            ]
        },
        {"_id": 0}
    ).to_list(100)
    
    for group in groups:
        if isinstance(group.get('created_at'), str):
            group['created_at'] = datetime.fromisoformat(group['created_at'])
    
    return groups


@router.post("/floor-message-groups")
async def create_floor_message_group(
    group_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a floor message group - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    group = {
        "id": str(uuid.uuid4()),
        "name": group_data.get('name'),
        "description": group_data.get('description', ''),
        "floor": current_user.floor,
        "is_floor_wide": group_data.get('is_floor_wide', True),
        "members": group_data.get('members', []),
        "created_by": current_user.id,
        "created_by_name": f"{current_user.first_name} {current_user.last_name}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await tenant_db.floor_message_groups.insert_one(group)
    
    return group


@router.post("/floor-surveys")
async def create_floor_survey(survey_data: dict, tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Create floor survey (RA/Admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Only RAs and admins can create surveys")

    survey_dict = {
        "id": str(uuid.uuid4()),
        "title": survey_data.get('title'),
        "description": survey_data.get('description'),
        "questions": survey_data.get('questions', []),
        "question_type": survey_data.get('question_type', 'free_form'),
        "poll_options": survey_data.get('poll_options'),
        "target_floor": survey_data.get('target_floor'),
        "closes_at": survey_data.get('closes_at'),
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True
    }

    await tenant_db.floor_surveys.insert_one(survey_dict)
    survey_dict.pop('_id', None)
    return survey_dict


@router.get("/floor-surveys")
async def get_floor_surveys(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get floor surveys for the current user's floor - tenant isolated"""
    tenant_db, current_user = tenant_data
    surveys = await tenant_db.floor_surveys.find(
        {"$or": [{"target_floor": current_user.floor}, {"target_floor": "all"}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    for survey in surveys:
        if isinstance(survey.get('created_at'), str):
            try:
                survey['created_at'] = datetime.fromisoformat(survey['created_at'])
            except ValueError:
                pass

    return surveys


@router.post("/floor-surveys/{survey_id}/respond")
async def respond_to_floor_survey(survey_id: str, response_data: dict, tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Submit a floor survey response - tenant isolated"""
    tenant_db, current_user = tenant_data
    survey = await tenant_db.floor_surveys.find_one({"id": str(survey_id)})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    existing = await tenant_db.floor_survey_responses.find_one({
        "survey_id": survey_id,
        "student_id": current_user.id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already responded to this survey")

    response = {
        "id": str(uuid.uuid4()),
        "survey_id": survey_id,
        "student_id": current_user.id,
        "student_name": f"{current_user.first_name} {current_user.last_name}",
        "answers": response_data.get('answers', []),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await tenant_db.floor_survey_responses.insert_one(response)
    response.pop('_id', None)
    return response


@router.get("/floor-surveys/{survey_id}/responses")
async def get_survey_responses(survey_id: str, tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all responses for a survey (RA/Admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")

    responses = await tenant_db.floor_survey_responses.find(
        {"survey_id": str(survey_id)},
        {"_id": 0}
    ).to_list(100)

    for resp in responses:
        if isinstance(resp.get('created_at'), str):
            try:
                resp['created_at'] = datetime.fromisoformat(resp['created_at'])
            except ValueError:
                pass

    return responses
