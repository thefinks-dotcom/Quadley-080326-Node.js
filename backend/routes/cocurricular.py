"""Co-Curricular groups routes (Sports, Clubs, Cultural) - Tenant isolated"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import List
from datetime import datetime
from pathlib import Path

from models import CoCurricularGroup, CoCurricularGroupCreate, GroupType, Message, MessageGroup
from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/cocurricular", tags=["cocurricular"])


@router.post("/groups", response_model=CoCurricularGroup)
async def create_cocurricular_group(
    group_data: CoCurricularGroupCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a new co-curricular group (sports, clubs, cultural)"""
    tenant_db, current_user = tenant_data
    full_name = f"{current_user.first_name} {current_user.last_name}"
    
    # Create message group for team chat
    message_group = MessageGroup(
        name=f"{group_data.name} Chat",
        members=[current_user.id],
        member_names=[full_name],
        created_by=current_user.id,
        created_by_name=full_name
    )
    msg_group_doc = message_group.model_dump()
    msg_group_doc['created_at'] = msg_group_doc['created_at'].isoformat()
    await tenant_db.message_groups.insert_one(msg_group_doc)
    
    # Create co-curricular group linked to message group
    group = CoCurricularGroup(
        type=group_data.type,
        name=group_data.name,
        description=group_data.description,
        contact_person=current_user.id,
        contact_person_name=full_name,
        owner_id=current_user.id,
        owner_name=full_name,
        message_group_id=message_group.id,
        meeting_times=group_data.meeting_times,
        competition_times=group_data.competition_times,
        other_details=group_data.other_details,
        members=[current_user.id],
        member_names=[full_name],
        photos=[],
        send_reminders=group_data.send_reminders,
        reminder_times=group_data.reminder_times
    )
    
    group_doc = group.model_dump()
    group_doc['created_at'] = group_doc['created_at'].isoformat()
    await tenant_db.cocurricular_groups.insert_one(group_doc)
    
    # Send welcome message
    welcome_msg = Message(
        sender_id="system",
        sender_name="Quadley System",
        group_id=message_group.id,
        content=f"Welcome to {group_data.name}! This is your team chat. {full_name} created this group."
    )
    msg_doc = welcome_msg.model_dump()
    msg_doc['timestamp'] = msg_doc['timestamp'].isoformat()
    await tenant_db.messages.insert_one(msg_doc)
    
    return group


@router.get("/groups/all", response_model=List[CoCurricularGroup])
async def get_all_cocurricular_groups(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all co-curricular groups for this tenant"""
    tenant_db, current_user = tenant_data
    
    groups = await tenant_db.cocurricular_groups.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for group in groups:
        if isinstance(group.get('created_at'), str):
            group['created_at'] = datetime.fromisoformat(group['created_at'])
    
    return groups


@router.get("/groups/{group_type}", response_model=List[CoCurricularGroup])
async def get_cocurricular_groups(
    group_type: GroupType, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get all co-curricular groups of a specific type"""
    tenant_db, current_user = tenant_data
    
    groups = await tenant_db.cocurricular_groups.find(
        {"type": group_type.value},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for group in groups:
        if isinstance(group.get('created_at'), str):
            group['created_at'] = datetime.fromisoformat(group['created_at'])
    
    return groups


@router.post("/groups/{group_id}/join")
async def join_cocurricular_group(
    group_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Join a co-curricular group"""
    tenant_db, current_user = tenant_data
    
    group = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    full_name = f"{current_user.first_name} {current_user.last_name}"
    
    # Add to co-curricular group
    if current_user.id not in group.get('members', []):
        await tenant_db.cocurricular_groups.update_one(
            {"id": str(group_id)},
            {
                "$push": {
                    "members": current_user.id,
                    "member_names": full_name
                }
            }
        )
    
    # Add to message group
    message_group_id = group.get('message_group_id')
    if message_group_id:
        msg_group = await tenant_db.message_groups.find_one({"id": str(message_group_id)}, {"_id": 0})
        if msg_group and current_user.id not in msg_group.get('members', []):
            await tenant_db.message_groups.update_one(
                {"id": str(message_group_id)},
                {
                    "$push": {
                        "members": current_user.id,
                        "member_names": full_name
                    }
                }
            )
            
            # Send welcome message
            welcome_msg = Message(
                sender_id="system",
                sender_name="Quadley System",
                group_id=message_group_id,
                content=f"{full_name} has joined the group! Welcome!"
            )
            msg_doc = welcome_msg.model_dump()
            msg_doc['timestamp'] = msg_doc['timestamp'].isoformat()
            await tenant_db.messages.insert_one(msg_doc)
    
    return {"message": "Joined successfully"}


@router.post("/groups/{group_id}/message")
async def send_group_message(
    group_id: str, 
    message_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Send a message to a co-curricular group"""
    tenant_db, current_user = tenant_data
    
    group = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    message_group_id = group.get('message_group_id')
    if not message_group_id:
        raise HTTPException(status_code=400, detail="Group has no message group")
    
    message = Message(
        sender_id=current_user.id,
        sender_name=f"{current_user.first_name} {current_user.last_name}",
        group_id=message_group_id,
        content=message_data.get('content', '')
    )
    
    msg_doc = message.model_dump()
    msg_doc['timestamp'] = msg_doc['timestamp'].isoformat()
    await tenant_db.messages.insert_one(msg_doc)
    
    return message


@router.patch("/groups/{group_id}/admin")
async def change_group_admin(
    group_id: str, 
    admin_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Change the admin/owner of a co-curricular group (college_admin or super_admin only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['college_admin', 'super_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Only admins can change group ownership")
    
    group = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    new_owner_id = admin_data.get('new_owner_id')
    new_owner_name = admin_data.get('new_owner_name')
    
    if not new_owner_id:
        raise HTTPException(status_code=400, detail="new_owner_id is required")
    
    # Verify new owner exists
    new_owner = await tenant_db.users.find_one({"id": str(new_owner_id)}, {"_id": 0})
    if not new_owner:
        raise HTTPException(status_code=404, detail="New owner not found")
    
    # Update the group
    await tenant_db.cocurricular_groups.update_one(
        {"id": str(group_id)},
        {"$set": {
            "owner_id": new_owner_id,
            "owner_name": new_owner_name or f"{new_owner.get('first_name', '')} {new_owner.get('last_name', '')}"
        }}
    )
    
    # Ensure new owner is a member
    await tenant_db.cocurricular_groups.update_one(
        {"id": str(group_id), "members": {"$ne": new_owner_id}},
        {"$push": {
            "members": new_owner_id,
            "member_names": new_owner_name or f"{new_owner.get('first_name', '')} {new_owner.get('last_name', '')}"
        }}
    )
    
    return {"message": "Admin changed successfully", "new_owner_id": new_owner_id}


@router.post("/groups/{group_id}/photos/upload")
async def upload_photo_file(
    group_id: str, 
    file: UploadFile = File(...), 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Upload photo file to server (returns URL) - with security validation"""
    from utils.file_validation import validate_image_upload, generate_safe_filename
    from utils.security_logger import log_security_event, SecurityEvent
    
    tenant_db, current_user = tenant_data
    
    # Verify group exists
    group = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Authorization check - only owner, members, or admin can upload
    is_owner = group.get('owner_id') == current_user.id
    is_member = current_user.id in group.get('members', [])
    is_admin = current_user.role in ['admin', 'super_admin', 'college_admin']
    
    if not (is_owner or is_member or is_admin):
        log_security_event(
            SecurityEvent.PERMISSION_DENIED,
            user_id=current_user.id,
            user_email=current_user.email,
            details={"action": "file_upload", "group_id": str(group_id)},
            severity="WARNING"
        )
        raise HTTPException(status_code=403, detail="Not authorized to upload photos to this group")
    
    # Validate file
    is_valid, error_msg, content = await validate_image_upload(file, file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Generate safe filename
    safe_filename = generate_safe_filename(file.filename, group_id, content)
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path("/app/backend/uploads")
    upload_dir.mkdir(exist_ok=True)
    
    # Save file
    file_path = upload_dir / safe_filename
    with file_path.open("wb") as buffer:
        buffer.write(content)
    
    log_security_event(
        SecurityEvent.FILE_UPLOAD,
        user_id=current_user.id,
        user_email=current_user.email,
        details={"group_id": str(group_id), "filename": safe_filename, "size": len(content)}
    )
    
    # Return URL
    file_url = f"/api/uploads/{safe_filename}"
    return {"url": file_url}


@router.post("/groups/{group_id}/photos")
async def add_photo_to_group(
    group_id: str, 
    photo_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Add a photo URL to a co-curricular group"""
    from utils.url_validation import validate_image_url
    
    tenant_db, current_user = tenant_data
    
    group = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is owner or admin
    is_owner = group.get('owner_id') == current_user.id
    is_admin = current_user.role in ['admin', 'super_admin', 'college_admin']
    
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Only group owner or admin can add photos")
    
    photo_url = photo_data.get('photo_url', '')
    if not photo_url:
        raise HTTPException(status_code=400, detail="Photo URL is required")
    
    # Validate URL to prevent SSRF
    is_valid, error_msg = validate_image_url(photo_url)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid photo URL: {error_msg}")
    
    # Add photo to group
    await tenant_db.cocurricular_groups.update_one(
        {"id": str(group_id)},
        {"$push": {"photos": photo_url}}
    )
    
    return {"message": "Photo added successfully", "photo_url": photo_url}


@router.delete("/groups/{group_id}/photos/{photo_index}")
async def remove_photo_from_group(
    group_id: str, 
    photo_index: int, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Remove a photo from a co-curricular group"""
    tenant_db, current_user = tenant_data
    
    group = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is owner or admin
    if group.get('owner_id') != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only group owner or admin can remove photos")
    
    photos = group.get('photos', [])
    if photo_index < 0 or photo_index >= len(photos):
        raise HTTPException(status_code=400, detail="Invalid photo index")
    
    # Remove photo
    photos.pop(photo_index)
    await tenant_db.cocurricular_groups.update_one(
        {"id": str(group_id)},
        {"$set": {"photos": photos}}
    )
    
    return {"message": "Photo removed successfully"}


@router.put("/groups/{group_id}/transfer-ownership")
async def transfer_group_ownership(
    group_id: str, 
    transfer_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Transfer group ownership to another member"""
    tenant_db, current_user = tenant_data
    
    group = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if current user is owner
    if group.get('owner_id') != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can transfer ownership")
    
    new_owner_id = transfer_data.get('new_owner_id')
    if not new_owner_id:
        raise HTTPException(status_code=400, detail="New owner ID is required")
    
    # Check if new owner is a member
    if new_owner_id not in group.get('members', []):
        raise HTTPException(status_code=400, detail="New owner must be a member of the group")
    
    # Get new owner info
    new_owner = await tenant_db.users.find_one({"id": str(new_owner_id)}, {"_id": 0})
    if not new_owner:
        raise HTTPException(status_code=404, detail="New owner not found")
    
    new_owner_name = f"{new_owner.get('first_name', '')} {new_owner.get('last_name', '')}"
    
    # Transfer ownership
    await tenant_db.cocurricular_groups.update_one(
        {"id": str(group_id)},
        {
            "$set": {
                "owner_id": new_owner_id,
                "owner_name": new_owner_name,
                "contact_person": new_owner_id,
                "contact_person_name": new_owner_name
            }
        }
    )
    
    return {"message": "Ownership transferred successfully", "new_owner": new_owner_name}


@router.put("/groups/{group_id}", response_model=CoCurricularGroup)
async def update_cocurricular_group(
    group_id: str,
    group_data: CoCurricularGroupCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update a co-curricular group (admin only)"""
    tenant_db, current_user = tenant_data

    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update groups")

    group = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    update_fields = {
        "type": group_data.type,
        "name": group_data.name,
        "description": group_data.description,
        "meeting_times": group_data.meeting_times,
        "competition_times": group_data.competition_times,
        "other_details": group_data.other_details,
        "send_reminders": group_data.send_reminders,
        "reminder_times": group_data.reminder_times,
    }

    await tenant_db.cocurricular_groups.update_one(
        {"id": str(group_id)},
        {"$set": update_fields}
    )

    updated = await tenant_db.cocurricular_groups.find_one({"id": str(group_id)}, {"_id": 0})
    return CoCurricularGroup(**updated)


@router.delete("/groups/{group_id}")
async def delete_cocurricular_group(
    group_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete a co-curricular group (admin only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete groups")
    
    result = await tenant_db.cocurricular_groups.delete_one({"id": str(group_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {"message": "Group deleted successfully"}
