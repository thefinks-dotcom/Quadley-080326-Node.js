"""Messages and conversations routes - Multi-tenant aware"""
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from models import Message, MessageCreate, MessageGroup, MessageGroupCreate
from utils.auth import get_tenant_db_for_user
from utils.security import sanitize_html

logger = logging.getLogger(__name__)

class MessageReportCreate(BaseModel):
    category: str  # harassment | threats | inappropriate | bullying | other
    details: Optional[str] = None

class MessageReportAction(BaseModel):
    action: str  # suspend | warn | dismiss | remove_message

router = APIRouter(tags=["messages"])

# In-memory typing status (would use Redis in production)
typing_status = {}


async def _check_ai_moderation(content: str, tenant_code: str) -> dict | None:
    """
    Call OpenAI Moderation API if enabled for this tenant.
    Returns the flagged result dict, or None if not flagged / not configured.
    Failures are non-blocking — always returns None on any error.
    """
    import os
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from utils.multi_tenant import master_db
        tenant = await master_db.tenants.find_one(
            {"code": tenant_code}, {"_id": 0, "ai_moderation_enabled": 1}
        )
        if not tenant or not tenant.get("ai_moderation_enabled"):
            return None

        import httpx
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.post(
                "https://api.openai.com/v1/moderations",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"input": content},
            )
            if res.status_code == 200:
                result = res.json().get("results", [{}])[0]
                return result if result.get("flagged") else None
    except Exception as e:
        logger.warning(f"AI moderation check skipped (non-blocking): {e}")
    return None

class TypingStatus(BaseModel):
    is_typing: bool


@router.post("/messages/typing/{conversation_id}")
async def set_typing_status(
    conversation_id: str,
    status: TypingStatus,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Set typing status for a conversation"""
    tenant_db, current_user = tenant_data
    key = f"{conversation_id}_{current_user.id}"
    if status.is_typing:
        typing_status[key] = {
            "user_id": current_user.id,
            "user_name": f"{current_user.first_name} {current_user.last_name}",
            "timestamp": datetime.now(timezone.utc)
        }
    else:
        typing_status.pop(key, None)
    return {"status": "ok"}


@router.get("/messages/typing/{conversation_id}")
async def get_typing_status(
    conversation_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get typing status for a conversation"""
    tenant_db, current_user = tenant_data
    # Clean up old typing statuses (older than 5 seconds)
    now = datetime.now(timezone.utc)
    keys_to_remove = []
    for key, value in typing_status.items():
        if key.startswith(conversation_id) and (now - value["timestamp"]).total_seconds() > 5:
            keys_to_remove.append(key)
    for key in keys_to_remove:
        typing_status.pop(key, None)
    
    # Find active typers (not current user)
    typers = []
    for key, value in typing_status.items():
        if key.startswith(conversation_id) and value["user_id"] != current_user.id:
            typers.append(value)
    
    if typers:
        return {"is_typing": True, "user_id": typers[0]["user_id"], "user_name": typers[0]["user_name"]}
    return {"is_typing": False}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete a message (only by sender)"""
    tenant_db, current_user = tenant_data
    message = await tenant_db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["sender_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")

    # EVIDENCE PRESERVATION: Cannot delete a message under active review (OSA compliance)
    if message.get("has_report"):
        raise HTTPException(
            status_code=403,
            detail="This message cannot be deleted — it is under active review."
        )

    await tenant_db.messages.delete_one({"id": message_id})
    return {"message": "Message deleted"}


@router.post("/messages", response_model=Message)
async def send_message(
    msg_data: MessageCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Send a new message (direct or group)"""
    tenant_db, current_user = tenant_data

    # SAFETY: Check messaging suspension (admin kill switch)
    user_doc = await tenant_db.users.find_one(
        {"id": current_user.id}, {"_id": 0, "messaging_suspended": 1}
    )
    if user_doc and user_doc.get("messaging_suspended"):
        raise HTTPException(
            status_code=403,
            detail="Your messaging access has been suspended. Please contact your RA or administrator."
        )

    # Sanitize message content
    clean_content = sanitize_html(msg_data.content, max_length=5000)

    # AI CONTENT MODERATION (optional, per-tenant) — skipped when user explicitly overrides nudge
    ai_flag = None if msg_data.force_send else await _check_ai_moderation(clean_content, current_user.tenant_code)
    if ai_flag:
        flagged_cats = [
            k.replace("/", " / ").replace("_", " ")
            for k, v in ai_flag.get("categories", {}).items() if v
        ]
        raise HTTPException(
            status_code=422,
            detail={
                "code": "content_flagged",
                "categories": flagged_cats,
                "message": "This message was flagged by AI content moderation."
            }
        )
    
    # Generate conversation_id for direct messages (sorted user IDs)
    conversation_id = None
    if msg_data.receiver_id and not msg_data.group_id:
        user_ids = sorted([current_user.id, msg_data.receiver_id])
        conversation_id = f"{user_ids[0]}_{user_ids[1]}"
    
    message = Message(
        sender_id=current_user.id,
        sender_name=f"{current_user.first_name} {current_user.last_name}",
        receiver_id=msg_data.receiver_id,
        group_id=msg_data.group_id,
        conversation_id=conversation_id,
        content=clean_content,
        file_url=msg_data.file_url
    )
    
    msg_doc = message.model_dump()
    msg_doc['timestamp'] = msg_doc['timestamp'].isoformat()
    await tenant_db.messages.insert_one(msg_doc)
    
    return message


@router.get("/messages", response_model=List[Message])
async def get_messages(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all messages for current user"""
    tenant_db, current_user = tenant_data
    messages = await tenant_db.messages.find(
        {"$or": [{"sender_id": current_user.id}, {"receiver_id": current_user.id}]},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    
    for msg in messages:
        if isinstance(msg.get('timestamp'), str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return messages


@router.get("/conversations")
async def get_conversations(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all conversations for the current user with last message preview"""
    tenant_db, current_user = tenant_data
    all_conversations = []
    
    # 1. Get direct message conversations (exclude deleted by current user)
    messages = await tenant_db.messages.find(
        {
            "$and": [
                {"$or": [{"sender_id": current_user.id}, {"receiver_id": current_user.id}]},
                {"$or": [{"deleted_by": {"$exists": False}}, {"deleted_by": {"$nin": [current_user.id]}}]}
            ]
        },
        {"_id": 0}
    ).sort("timestamp", -1).to_list(1000)
    
    # Group by conversation_id
    conversations_dict = {}
    for msg in messages:
        if isinstance(msg.get('timestamp'), str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
        
        conv_id = msg.get('conversation_id')
        if not conv_id:
            continue
        
        # Skip if missing required fields
        if 'receiver_id' not in msg or 'sender_id' not in msg:
            continue
            
        if conv_id not in conversations_dict:
            # Determine the other user in conversation
            other_user_id = msg['receiver_id'] if msg['sender_id'] == current_user.id else msg['sender_id']
            
            # Get other user info from tenant database
            other_user = await tenant_db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
            
            if other_user:
                # Count unread messages (exclude self-messages)
                unread_count = await tenant_db.messages.count_documents({
                    "conversation_id": conv_id,
                    "receiver_id": current_user.id,
                    "read": False,
                    "sender_id": {"$ne": current_user.id}
                })
                
                conversations_dict[conv_id] = {
                    "conversation_id": conv_id,
                    "type": "direct",
                    "other_user": {
                        "id": other_user['id'],
                        "name": f"{other_user.get('first_name', '')} {other_user.get('last_name', '')}",
                        "photo_url": other_user.get('photo_url'),
                        "role": other_user.get('role')
                    },
                    "last_message": msg,
                    "unread_count": unread_count,
                    "timestamp": msg['timestamp']
                }
    
    all_conversations.extend(conversations_dict.values())
    
    # 2. Get group conversations
    groups = await tenant_db.message_groups.find(
        {"members": current_user.id, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    for group in groups:
        if isinstance(group.get('created_at'), str):
            group['created_at'] = datetime.fromisoformat(group['created_at'])
        
        # Get last message in group
        last_msg = await tenant_db.messages.find_one(
            {"group_id": group['id']},
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
        
        if last_msg and isinstance(last_msg.get('timestamp'), str):
            last_msg['timestamp'] = datetime.fromisoformat(last_msg['timestamp'])
        
        # Count unread messages in group (messages not in user's read_by list)
        unread_count = await tenant_db.messages.count_documents({
            "group_id": group['id'],
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$nin": [current_user.id]}
        })
        
        all_conversations.append({
            "conversation_id": group['id'],
            "type": "group",
            "group_name": group['name'],
            "members": group['members'],
            "member_names": group['member_names'],
            "last_message": last_msg,
            "unread_count": unread_count,
            "timestamp": last_msg['timestamp'] if last_msg else group['created_at']
        })
    
    # Sort all conversations by most recent
    all_conversations.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return all_conversations


@router.get("/conversations/{conversation_id}/messages", response_model=List[Message])
async def get_conversation_messages(
    conversation_id: str,
    limit: int = Query(default=50, le=200, description="Max messages to return"),
    before: Optional[str] = Query(default=None, description="Get messages before this timestamp (ISO format)"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get messages in a specific conversation with pagination"""
    tenant_db, current_user = tenant_data

    # SECURITY: Verify the requesting user is a participant in this conversation
    # before returning any messages — prevents IDOR attacks.
    is_authorized = False

    # Direct message conversation_id is "{user_a_id}_{user_b_id}" (UUIDs use only hyphens,
    # so the single underscore is always the separator between the two participant IDs).
    parts = conversation_id.rsplit('_', 1)
    if len(parts) == 2 and current_user.id in (parts[0], parts[1]):
        is_authorized = True

    if not is_authorized:
        # Group conversation: user must be an active member
        group = await tenant_db.message_groups.find_one(
            {"id": conversation_id, "members": current_user.id, "is_active": True},
            {"_id": 0, "id": 1}
        )
        if group:
            is_authorized = True

    if not is_authorized:
        # Fallback: verify via an existing message (handles any edge-case ID formats)
        existing_msg = await tenant_db.messages.find_one(
            {"conversation_id": conversation_id,
             "$or": [{"sender_id": current_user.id}, {"receiver_id": current_user.id}]},
            {"_id": 0, "id": 1}
        )
        if existing_msg:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to view this conversation")

    # Build query with optional timestamp filter for pagination
    query = {"conversation_id": conversation_id}
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace('Z', '+00:00'))
            query["timestamp"] = {"$lt": before_dt}
        except ValueError:
            pass
    
    # Try to find messages by conversation_id first
    messages = await tenant_db.messages.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # If no messages found by conversation_id, try to find by user pair
    if not messages:
        # conversation_id might be a user_id, search for messages between current user and that user
        pair_query = {"$or": [
            {"sender_id": current_user.id, "receiver_id": conversation_id},
            {"sender_id": conversation_id, "receiver_id": current_user.id}
        ]}
        if before:
            try:
                before_dt = datetime.fromisoformat(before.replace('Z', '+00:00'))
                pair_query["timestamp"] = {"$lt": before_dt}
            except ValueError:
                pass
        
        messages = await tenant_db.messages.find(
            pair_query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Reverse to get chronological order (oldest first)
    messages.reverse()
    
    for msg in messages:
        if isinstance(msg.get('timestamp'), str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return messages


@router.put("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Mark a single message as read"""
    tenant_db, current_user = tenant_data
    result = await tenant_db.messages.update_one(
        {"id": message_id, "receiver_id": current_user.id},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found or already read")
    
    return {"message": "Message marked as read"}


@router.put("/conversations/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Mark all messages in a conversation as read"""
    tenant_db, current_user = tenant_data
    result = await tenant_db.messages.update_many(
        {"conversation_id": conversation_id, "receiver_id": current_user.id, "read": False},
        {"$set": {"read": True}}
    )
    
    return {"message": f"Marked {result.modified_count} messages as read"}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete a conversation (hides all messages for the current user)"""
    tenant_db, current_user = tenant_data
    
    # For direct messages, mark as deleted for this user (soft delete)
    # This allows the other user to still see the messages
    result = await tenant_db.messages.update_many(
        {"conversation_id": conversation_id},
        {"$addToSet": {"deleted_by": current_user.id}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"message": "Conversation deleted", "messages_hidden": result.modified_count}


@router.delete("/message-groups/{group_id}/leave")
async def leave_message_group(
    group_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Leave a message group"""
    tenant_db, current_user = tenant_data
    
    # Verify user is a member
    group = await tenant_db.message_groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if current_user.id not in group.get('members', []):
        raise HTTPException(status_code=400, detail="You are not a member of this group")
    
    # Remove user from group
    await tenant_db.message_groups.update_one(
        {"id": group_id},
        {
            "$pull": {
                "members": current_user.id,
                "member_names": f"{current_user.first_name} {current_user.last_name}"
            }
        }
    )
    
    # Add system message
    leave_msg = {
        "id": str(uuid.uuid4()),
        "sender_id": "system",
        "sender_name": "System",
        "group_id": group_id,
        "content": f"{current_user.first_name} {current_user.last_name} left the group",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await tenant_db.messages.insert_one(leave_msg)
    
    return {"message": "Left the group"}


@router.post("/message-groups", response_model=MessageGroup)
async def create_message_group(
    group_data: MessageGroupCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a new message group"""
    tenant_db, current_user = tenant_data
    
    # Get member details from tenant database
    member_names = []
    for member_id in group_data.member_ids:
        user = await tenant_db.users.find_one({"id": member_id}, {"_id": 0, "first_name": 1, "last_name": 1})
        if user:
            member_names.append(f"{user.get('first_name', '')} {user.get('last_name', '')}")
    
    # Add creator to members if not already included
    if current_user.id not in group_data.member_ids:
        group_data.member_ids.append(current_user.id)
        member_names.append(f"{current_user.first_name} {current_user.last_name}")
    
    group = MessageGroup(
        name=group_data.name,
        description=group_data.description,
        created_by=current_user.id,
        created_by_name=f"{current_user.first_name} {current_user.last_name}",
        members=group_data.member_ids,
        member_names=member_names
    )
    
    group_doc = group.model_dump()
    group_doc['created_at'] = group_doc['created_at'].isoformat()
    await tenant_db.message_groups.insert_one(group_doc)
    
    return group


@router.get("/message-groups", response_model=List[MessageGroup])
async def get_user_message_groups(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all message groups the user is a member of"""
    tenant_db, current_user = tenant_data
    groups = await tenant_db.message_groups.find(
        {"members": current_user.id, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    for group in groups:
        if isinstance(group.get('created_at'), str):
            group['created_at'] = datetime.fromisoformat(group['created_at'])
    
    return groups


@router.get("/message-groups/{group_id}/messages", response_model=List[Message])
async def get_group_messages(
    group_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get all messages in a message group"""
    tenant_db, current_user = tenant_data
    
    # Verify user is a member
    group = await tenant_db.message_groups.find_one({"id": group_id}, {"_id": 0})
    if not group or current_user.id not in group.get('members', []):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    messages = await tenant_db.messages.find(
        {"group_id": group_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    for msg in messages:
        if isinstance(msg.get('timestamp'), str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return messages


@router.put("/message-groups/{group_id}/read")
async def mark_group_messages_read(
    group_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Mark all messages in a group as read for current user"""
    tenant_db, current_user = tenant_data
    
    # Verify user is a member
    group = await tenant_db.message_groups.find_one({"id": group_id}, {"_id": 0})
    if not group or current_user.id not in group.get('members', []):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Add current user to read_by array for all messages they haven't read yet
    result = await tenant_db.messages.update_many(
        {
            "group_id": group_id,
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$ne": current_user.id}
        },
        {"$addToSet": {"read_by": current_user.id}}
    )
    
    return {"message": f"Marked {result.modified_count} messages as read"}


@router.post("/messages/{message_id}/report")
async def report_message(
    message_id: str,
    report_data: MessageReportCreate,
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Report a message — preserves evidence, notifies admins, auto-suspends at threshold."""
    tenant_db, current_user = tenant_data

    message = await tenant_db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Verify caller is a conversation participant
    conv_id = message.get("conversation_id") or message.get("group_id")
    is_participant = (
        message.get("sender_id") == current_user.id or
        message.get("receiver_id") == current_user.id
    )
    if not is_participant and conv_id:
        parts = (conv_id or "").rsplit("_", 1)
        if len(parts) == 2 and current_user.id in (parts[0], parts[1]):
            is_participant = True
    if not is_participant:
        group = await tenant_db.message_groups.find_one(
            {"id": conv_id, "members": current_user.id}, {"_id": 0, "id": 1}
        )
        is_participant = bool(group)
    if not is_participant:
        raise HTTPException(status_code=403, detail="You cannot report this message")

    # Prevent duplicate reports from the same user
    existing = await tenant_db.message_reports.find_one(
        {"message_id": message_id, "reporter_id": current_user.id}, {"_id": 0, "id": 1}
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already reported this message")

    reported_user_id = message.get("sender_id")

    report_doc = {
        "id": str(uuid.uuid4()),
        "message_id": message_id,
        "message_content_snapshot": message.get("content", ""),
        "conversation_id": conv_id,
        "reporter_id": current_user.id,
        "reporter_name": f"{current_user.first_name} {current_user.last_name}",
        "reported_user_id": reported_user_id,
        "reported_user_name": message.get("sender_name", "Unknown"),
        "category": report_data.category,
        "details": report_data.details or "",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "tenant_code": current_user.tenant_code,
    }
    await tenant_db.message_reports.insert_one(report_doc)

    # Flag the message to prevent deletion (evidence preservation)
    await tenant_db.messages.update_one(
        {"id": message_id}, {"$set": {"has_report": True}}
    )

    # Count open reports against this user for auto-suspend threshold
    open_report_count = await tenant_db.message_reports.count_documents({
        "reported_user_id": reported_user_id, "status": "pending"
    })

    auto_suspended = False
    if open_report_count >= 3:
        await tenant_db.users.update_one(
            {"id": reported_user_id},
            {"$set": {"messaging_suspended": True}}
        )
        auto_suspended = True

    # Background: email all tenant admins
    background_tasks.add_task(
        _notify_admins_of_report, tenant_db, report_doc, auto_suspended
    )

    return {
        "message": "Report submitted. Thank you for helping keep this community safe.",
        "report_id": report_doc["id"],
        "auto_suspended": auto_suspended
    }


async def _notify_admins_of_report(tenant_db, report_doc: dict, auto_suspended: bool):
    """Background task: email all tenant admins about a new message report."""
    try:
        from utils.email import send_email
        admins = await tenant_db.users.find(
            {"role": {"$in": ["admin", "college_admin", "ra"]}, "active": True, "email": {"$exists": True}},
            {"_id": 0, "email": 1, "first_name": 1}
        ).to_list(50)

        subject = f"{'🚨 AUTO-SUSPENDED — ' if auto_suspended else ''}Message Report: {report_doc['category'].title()}"
        suspension_note = (
            "<p style='background:#fee2e2;padding:12px;border-radius:8px;color:#991b1b;'>"
            "<strong>⚠️ This user has been automatically suspended from messaging</strong> "
            "due to reaching the report threshold (3+ reports). Review and take action.</p>"
        ) if auto_suspended else ""

        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#dc2626;">Message Report — Action Required</h2>
          {suspension_note}
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;font-weight:bold;width:160px;">Category</td>
                <td style="padding:8px;">{report_doc['category'].title()}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:bold;">Reported User</td>
                <td style="padding:8px;">{report_doc['reported_user_name']}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Reported By</td>
                <td style="padding:8px;">{report_doc['reporter_name']}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:bold;">Details</td>
                <td style="padding:8px;">{report_doc.get('details') or '—'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Message (snapshot)</td>
                <td style="padding:8px;background:#fef2f2;border-left:3px solid #dc2626;">
                  <em>{report_doc['message_content_snapshot'][:500]}</em></td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:bold;">Report ID</td>
                <td style="padding:8px;font-family:monospace;font-size:12px;">{report_doc['id']}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Reported At</td>
                <td style="padding:8px;">{report_doc['created_at']}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:12px;margin-top:24px;">
            Under the Online Safety Act 2021, you have a non-delegable duty to review and act on this report.
            Log in to Quadley to manage this report.
          </p>
        </div>"""

        for admin in admins:
            send_email(to=admin["email"], subject=subject, html_content=html)
    except Exception as e:
        logger.error(f"Failed to send report notification emails: {e}")


@router.get("/admin/message-reports")
async def get_message_reports(
    status: Optional[str] = Query(default=None),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """List all message reports for this tenant. Admin/RA only."""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "college_admin", "ra"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status
    reports = await tenant_db.message_reports.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return reports


@router.put("/admin/message-reports/{report_id}/action")
async def action_on_report(
    report_id: str,
    body: MessageReportAction,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Take action on a report: suspend | warn | dismiss | remove_message"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "college_admin", "ra"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    report = await tenant_db.message_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    action = body.action
    update_fields = {
        "status": "resolved",
        "action_taken": action,
        "actioned_by": current_user.id,
        "actioned_at": datetime.now(timezone.utc).isoformat(),
    }

    if action == "suspend":
        await tenant_db.users.update_one(
            {"id": report["reported_user_id"]},
            {"$set": {"messaging_suspended": True}}
        )
    elif action == "warn":
        pass  # Future: send in-app warning notification
    elif action == "remove_message":
        # OSA compliance: remove content but preserve the report record
        await tenant_db.messages.update_one(
            {"id": report["message_id"]},
            {"$set": {"content": "[Message removed by moderator]", "removed": True}}
        )
        update_fields["status"] = "content_removed"
    elif action == "dismiss":
        # Remove the report flag from the message if dismissed
        await tenant_db.messages.update_one(
            {"id": report["message_id"]},
            {"$set": {"has_report": False}}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    await tenant_db.message_reports.update_one({"id": report_id}, {"$set": update_fields})
    return {"message": f"Action '{action}' applied to report {report_id}"}


@router.get("/admin/messages/overview")
async def get_messages_overview(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get messages overview for college admin (admin only) - no message content for privacy"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from datetime import timedelta
    
    # Get stats from tenant database
    total_messages = await tenant_db.messages.count_documents({})
    total_groups = await tenant_db.message_groups.count_documents({"is_active": True})
    
    # Calculate date ranges
    now = datetime.now()
    
    # Last 30 days (month)
    month_ago = now - timedelta(days=30)
    messages_last_month = await tenant_db.messages.count_documents({
        "timestamp": {"$gte": month_ago.isoformat()}
    })
    
    # Last 90 days (quarter)
    quarter_ago = now - timedelta(days=90)
    messages_last_quarter = await tenant_db.messages.count_documents({
        "timestamp": {"$gte": quarter_ago.isoformat()}
    })
    
    # Last 365 days (year)
    year_ago = now - timedelta(days=365)
    messages_last_year = await tenant_db.messages.count_documents({
        "timestamp": {"$gte": year_ago.isoformat()}
    })
    
    # Get daily message counts for charts
    # Last 30 days - daily breakdown
    daily_counts_month = []
    for i in range(30, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = await tenant_db.messages.count_documents({
            "timestamp": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
        })
        daily_counts_month.append({
            "date": day_start.strftime("%b %d"),
            "count": count
        })
    
    # Last 90 days - weekly breakdown
    weekly_counts_quarter = []
    for i in range(12, -1, -1):
        week_start = now - timedelta(weeks=i+1)
        week_end = now - timedelta(weeks=i)
        count = await tenant_db.messages.count_documents({
            "timestamp": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
        })
        weekly_counts_quarter.append({
            "date": f"Week {12-i}",
            "count": count
        })
    
    # Last 365 days - monthly breakdown
    monthly_counts_year = []
    for i in range(11, -1, -1):
        month_start = (now - timedelta(days=i*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i > 0:
            month_end = (now - timedelta(days=(i-1)*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            month_end = now
        count = await tenant_db.messages.count_documents({
            "timestamp": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
        })
        monthly_counts_year.append({
            "date": month_start.strftime("%b"),
            "count": count
        })
    
    return {
        "stats": {
            "total_messages": total_messages,
            "total_groups": total_groups,
            "messages_last_month": messages_last_month,
            "messages_last_quarter": messages_last_quarter,
            "messages_last_year": messages_last_year
        },
        "chart_data": {
            "month": daily_counts_month,
            "quarter": weekly_counts_quarter,
            "year": monthly_counts_year
        }
    }
