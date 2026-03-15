"""Admin and RA Floor Management routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Request, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, EmailStr
import uuid
import secrets
import csv
import io
import re

from models import User, _generate_invite_code
from utils.auth import db, get_current_user, get_tenant_db_for_user
from utils.multi_tenant import master_db  # For audit logging consistency
from utils.email_service import send_invitation_email
from utils.email_service import send_setup_reminder_email, is_email_enabled, send_student_invite_email
from utils.admin_audit import log_admin_action, AdminActionType

router = APIRouter(prefix="/admin", tags=["admin"])


# ========== USER LISTING ==========

@router.get("/users")
async def list_users(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """List all users in the current tenant. Admin or RA only."""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'ra', 'college_admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = await tenant_db.users.find(
        {},
        {"_id": 0}
    ).to_list(1000)
    
    # Compute pending_setup from actual data — don't trust the field
    for user in users:
        has_password = bool(user.get('password'))
        is_active = user.get('active', False)
        # User is pending ONLY if they have no password and are not active
        user['pending_setup'] = not has_password and not is_active
        # Remove sensitive fields
        user.pop('password', None)
        user.pop('mfa_secret', None)
        user.pop('mfa_backup_codes', None)
        user.pop('setup_token', None)
    
    return users


@router.get("/ai-moderation")
async def get_ai_moderation_status(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get AI content moderation status for this tenant. Admin only."""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    import os
    tenant = await master_db.tenants.find_one(
        {"code": current_user.tenant_code}, {"_id": 0, "ai_moderation_enabled": 1}
    )
    return {
        "ai_moderation_enabled": bool((tenant or {}).get("ai_moderation_enabled", False)),
        "openai_configured": bool(os.environ.get("OPENAI_API_KEY")),
    }


@router.put("/ai-moderation")
async def toggle_ai_moderation(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Toggle AI content moderation for this tenant. Admin only."""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant = await master_db.tenants.find_one(
        {"code": current_user.tenant_code}, {"_id": 0, "ai_moderation_enabled": 1}
    )
    new_state = not bool((tenant or {}).get("ai_moderation_enabled", False))
    await master_db.tenants.update_one(
        {"code": current_user.tenant_code},
        {"$set": {"ai_moderation_enabled": new_state}}
    )
    status = "enabled" if new_state else "disabled"
    return {
        "ai_moderation_enabled": new_state,
        "message": f"AI content moderation {status} for this campus."
    }


@router.put("/users/{user_id}/messaging-suspend")
async def toggle_messaging_suspend(
    user_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Toggle messaging suspension for a user (admin kill switch). Admin/RA only."""
    tenant_db, current_user = tenant_data

    if current_user.role not in ["admin", "super_admin", "college_admin", "ra"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    user_doc = await tenant_db.users.find_one({"id": user_id}, {"_id": 0, "messaging_suspended": 1, "first_name": 1, "last_name": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    new_state = not user_doc.get("messaging_suspended", False)
    await tenant_db.users.update_one(
        {"id": user_id}, {"$set": {"messaging_suspended": new_state}}
    )

    action = "suspended" if new_state else "reinstated"
    return {
        "user_id": user_id,
        "messaging_suspended": new_state,
        "message": f"Messaging {action} for {user_doc.get('first_name', '')} {user_doc.get('last_name', '')}"
    }


@router.get("/users/directory")
async def get_user_directory(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Minimal user directory (id, name, role) for all active tenant users.
    Accessible to all authenticated roles — used for messaging and contact lookups."""
    tenant_db, current_user = tenant_data
    users = await tenant_db.users.find(
        {"active": True},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "role": 1}
    ).to_list(1000)
    return [u for u in users if u.get("id") != current_user.id]


class InviteStudentRequest(BaseModel):
    """Request model for inviting a new user"""
    email: EmailStr
    first_name: str
    last_name: str
    role: Optional[str] = "student"
    floor: Optional[str] = None
    room: Optional[str] = None


@router.post("/users/invite")
async def invite_student(
    invite_data: InviteStudentRequest,
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Invite a new student by email. Creates an invitation with an invite code
    and sends an email with instructions to download the app and join.
    Only admins and super_admins can invite students.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_code = current_user.tenant_code or "UNKN"
    
    # Check if email already exists in this tenant
    existing = await tenant_db.users.find_one({"email": invite_data.email.lower()})
    if existing:
        # Allow re-inviting pending users
        if existing.get('pending_setup') or not existing.get('active') or not existing.get('password'):
            # Reset their invitation — delete old user record and invitation, create fresh
            await tenant_db.users.delete_one({"email": invite_data.email.lower()})
            await master_db.invitations.delete_many({
                "tenant_code": tenant_code,
                "email": invite_data.email.lower(),
            })
        else:
            raise HTTPException(status_code=400, detail="This user is already registered and active")
    
    # Generate invite code and create invitation in master DB
    invite_code = _generate_invite_code(tenant_code)
    invitation_id = str(uuid.uuid4())
    invitation_token = str(uuid.uuid4())
    
    invitation_doc = {
        "id": invitation_id,
        "tenant_code": tenant_code,
        "email": invite_data.email.lower(),
        "role": invite_data.role or "student",
        "first_name": invite_data.first_name,
        "last_name": invite_data.last_name,
        "token": invitation_token,
        "invite_code": invite_code,
        "status": "pending",
        "invited_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "accepted_at": None,
    }
    
    await master_db.invitations.insert_one(invitation_doc)
    
    # Also create user record in tenant DB so they appear in user management
    user_id = str(uuid.uuid4())
    role_prefix = {"admin": "ADMIN", "ra": "RA"}.get(invite_data.role, "STU")
    formatted_user_id = f"{tenant_code}-{role_prefix}-{uuid.uuid4().hex[:8].upper()}"
    user_doc = {
        "id": user_id,
        "user_id": formatted_user_id,
        "email": invite_data.email.lower(),
        "first_name": invite_data.first_name,
        "last_name": invite_data.last_name,
        "role": invite_data.role or "student",
        "floor": getattr(invite_data, 'floor', None),
        "room": getattr(invite_data, 'room', None),
        "active": False,
        "password": None,
        "pending_setup": True,
        "setup_token": invitation_token,
        "setup_token_expires": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "invited_by": current_user.id,
        "invited_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "tenant_code": tenant_code,
        "invite_code": invite_code,
    }
    await tenant_db.users.insert_one(user_doc)
    user_doc.pop('_id', None)
    
    # Log audit event
    await log_admin_action(
        db=master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.USER_CREATE,
        target_type="user",
        target_id=invitation_id,
        target_name=f"{invite_data.first_name} {invite_data.last_name}",
        details={
            "email": invite_data.email,
            "invite_code": invite_code,
            "method": "invite_code"
        },
        tenant_code=tenant_code
    )
    
    # Get tenant info for email
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    tenant_name = tenant.get('name', tenant_code) if tenant else tenant_code
    ios_app_link = tenant.get('ios_app_link') if tenant else None
    android_app_link = tenant.get('android_app_link') if tenant else None
    inviter_name = f"{current_user.first_name} {current_user.last_name}".strip() or "Administrator"
    t_branding = tenant.get('branding', {}) if tenant else {}
    t_primary = t_branding.get('primary_color') or tenant.get('primary_color', '#0f172a') if tenant else '#0f172a'
    
    # Send invitation email in the background — response returns immediately
    background_tasks.add_task(
        send_invitation_email,
        to_email=invite_data.email.lower(),
        tenant_name=tenant_name,
        invitation_token=invitation_token,
        role=invite_data.role or "student",
        inviter_name=inviter_name,
        first_name=invite_data.first_name,
        invite_code=invite_code,
        ios_app_link=ios_app_link,
        android_app_link=android_app_link,
        primary_color=t_primary,
    )
    email_sent = True
    
    # Return response (exclude _id)
    invitation_doc.pop('_id', None)
    
    return {
        "message": f"Invitation sent to {invite_data.email}",
        "user": {
            "id": user_id,
            "email": invite_data.email.lower(),
            "first_name": invite_data.first_name,
            "last_name": invite_data.last_name,
            "role": invite_data.role or "student",
            "invite_code": invite_code,
            "pending_setup": True,
            "created_at": invitation_doc["created_at"],
        },
        "email_sent": email_sent,
        "email_status": "sent" if email_sent else "failed"
    }


@router.post("/users/resend-invite/{user_id}")
async def resend_invite(
    user_id: str,
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Resend invitation email to a pending user."""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_code = current_user.tenant_code or "UNKN"
    
    # Find the pending invitation in master DB
    invitation = await master_db.invitations.find_one({
        "id": user_id,
        "tenant_code": tenant_code,
        "status": "pending"
    })
    
    # Also try finding by looking up user in tenant DB first
    if not invitation:
        user = await tenant_db.users.find_one({"id": user_id})
        if user and user.get("email"):
            invitation = await master_db.invitations.find_one({
                "email": user["email"],
                "tenant_code": tenant_code,
                "status": "pending"
            })
            
            # If user exists but no invitation (created via old flow), create one
            if not invitation and (user.get("pending_setup") or not user.get("password")):
                invite_code = _generate_invite_code(tenant_code)
                invitation_id = str(uuid.uuid4())
                invitation_token = str(uuid.uuid4())
                invitation = {
                    "id": invitation_id,
                    "tenant_code": tenant_code,
                    "email": user["email"],
                    "role": user.get("role", "student"),
                    "first_name": user.get("first_name", ""),
                    "last_name": user.get("last_name", ""),
                    "token": invitation_token,
                    "invite_code": invite_code,
                    "status": "pending",
                    "invited_by": current_user.id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                    "accepted_at": None,
                }
                await master_db.invitations.insert_one(invitation)
                invitation.pop('_id', None)
    
    if not invitation:
        raise HTTPException(status_code=404, detail="No pending invitation found for this user")
    
    # Get tenant info for email
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    tenant_name = tenant.get('name', tenant_code) if tenant else tenant_code
    ios_app_link = tenant.get('ios_app_link') if tenant else None
    android_app_link = tenant.get('android_app_link') if tenant else None
    inviter_name = f"{current_user.first_name} {current_user.last_name}".strip() or "Administrator"
    t_branding2 = tenant.get('branding', {}) if tenant else {}
    t_primary2 = t_branding2.get('primary_color') or tenant.get('primary_color', '#0f172a') if tenant else '#0f172a'
    
    # Send invitation email in the background — response returns immediately
    background_tasks.add_task(
        send_invitation_email,
        to_email=invitation["email"],
        tenant_name=tenant_name,
        invitation_token=invitation["token"],
        role=invitation.get("role", "student"),
        inviter_name=inviter_name,
        first_name=invitation.get("first_name"),
        invite_code=invitation.get("invite_code"),
        ios_app_link=ios_app_link,
        android_app_link=android_app_link,
        primary_color=t_primary2,
    )
    
    return {
        "message": f"Invitation resent to {invitation['email']}",
        "email_sent": True
    }


@router.post("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Manually activate a pending user and send them a fresh invite.
    Admin can use this when a user is stuck in pending state.
    """
    tenant_db, current_user = tenant_data

    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_code = current_user.tenant_code or "UNKN"

    user = await tenant_db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = user.get("email", "")

    # Generate new invite code and setup token
    invite_code = _generate_invite_code(tenant_code)
    setup_token = str(uuid.uuid4())

    # Update user record — keep them pending but refresh the token
    await tenant_db.users.update_one(
        {"id": user_id},
        {"$set": {
            "pending_setup": True,
            "active": False,
            "password": None,
            "setup_token": setup_token,
            "setup_token_expires": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "invite_code": invite_code,
        }}
    )

    # Upsert invitation in master DB
    await master_db.invitations.update_one(
        {"email": email.lower(), "tenant_code": tenant_code},
        {"$set": {
            "id": str(uuid.uuid4()),
            "tenant_code": tenant_code,
            "email": email.lower(),
            "role": user.get("role", "student"),
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "token": setup_token,
            "invite_code": invite_code,
            "status": "pending",
            "invited_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "accepted_at": None,
        }},
        upsert=True
    )

    # Send fresh invitation email
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    tenant_name = tenant.get('name', tenant_code) if tenant else tenant_code
    t_branding = tenant.get('branding', {}) if tenant else {}
    t_primary = t_branding.get('primary_color') or tenant.get('primary_color', '#0f172a') if tenant else '#0f172a'

    # Fire email in the background — response returns immediately
    background_tasks.add_task(
        send_invitation_email,
        to_email=email.lower(),
        tenant_name=tenant_name,
        invitation_token=setup_token,
        role=user.get("role", "student"),
        inviter_name=f"{current_user.first_name} {current_user.last_name}".strip() or "Administrator",
        first_name=user.get("first_name"),
        invite_code=invite_code,
        primary_color=t_primary,
    )

    return {
        "message": f"Fresh invitation sent to {email}",
        "invite_code": invite_code,
        "user_id": user_id,
    }


@router.post("/users/{user_id}/force-activate")
async def force_activate_user(
    user_id: str,
    request: Request,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Force-activate a user without requiring them to go through the invite flow.
    Sets a temporary password that the user must change on first login.
    """
    tenant_db, current_user = tenant_data

    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")

    user = await tenant_db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temp_password = secrets.token_urlsafe(10)

    await tenant_db.users.update_one(
        {"id": user_id},
        {"$set": {
            "active": True,
            "pending_setup": False,
            "password": hash_password(temp_password),
            "must_change_password": True,
        }}
    )

    # Mark any pending invitation as accepted
    tenant_code = current_user.tenant_code or "UNKN"
    await master_db.invitations.update_many(
        {"email": user.get("email", "").lower(), "tenant_code": tenant_code, "status": "pending"},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {
        "message": f"User {user.get('first_name')} {user.get('last_name')} activated",
        "temporary_password": temp_password,
        "must_change_password": True,
        "note": "Share this temporary password with the user. They must change it on first login.",
    }


class BulkImportResult(BaseModel):
    """Result of bulk student import"""
    total_rows: int
    successful: int
    failed: int
    errors: List[dict]
    created_users: List[dict]


def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip().lower()))


def sanitize_csv_value(value: str) -> str:
    """
    Sanitize CSV input to prevent formula injection (OWASP A03).
    CSV formula injection can occur when a cell starts with =, +, -, @, or tab/carriage return.
    """
    if not value:
        return value
    
    # Characters that can trigger formula execution in spreadsheet apps
    formula_triggers = ('=', '+', '-', '@', '\t', '\r', '\n')
    
    # If value starts with a formula trigger, prefix with single quote to neutralize
    if value.startswith(formula_triggers):
        # Remove the dangerous character entirely for security
        return value.lstrip('=+-@\t\r\n').strip()
    
    return value.strip()


@router.post("/users/bulk-invite", response_model=BulkImportResult)
async def bulk_invite_students(
    file: UploadFile = File(...),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Bulk invite students from a CSV file.
    
    Expected CSV format (with headers):
    first_name,last_name,email,floor,room
    
    - first_name: Required
    - last_name: Required  
    - email: Required (must be valid email format)
    - floor: Optional
    - room: Optional
    
    Returns summary of successful and failed imports.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")
    
    # Read file content
    try:
        content = await file.read()
        # Try to decode as UTF-8, fall back to latin-1
        try:
            text_content = content.decode('utf-8')
        except UnicodeDecodeError:
            text_content = content.decode('latin-1')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    # Parse CSV
    try:
        csv_reader = csv.DictReader(io.StringIO(text_content))
        rows = list(csv_reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    
    # Validate headers
    required_headers = {'first_name', 'last_name', 'email'}
    actual_headers = set(rows[0].keys()) if rows else set()
    missing_headers = required_headers - actual_headers
    
    if missing_headers:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required columns: {', '.join(missing_headers)}. Expected: first_name, last_name, email, floor (optional), room (optional)"
        )
    
    # Process each row
    results = {
        "total_rows": len(rows),
        "successful": 0,
        "failed": 0,
        "errors": [],
        "created_users": []
    }
    
    # Get existing emails to check for duplicates
    existing_emails = set()
    async for user in tenant_db.users.find({}, {"email": 1}):
        existing_emails.add(user["email"].lower())
    
    # Get tenant branding for emails
    tenant_code = current_user.tenant_code or ""
    tenant_info = await master_db.tenants.find_one({"code": tenant_code}, {"_id": 0})
    tenant_name = tenant_info.get("name", tenant_code) if tenant_info else tenant_code
    branding = tenant_info.get("branding", {}) if tenant_info else {}
    primary_color = branding.get("primary_color") or tenant_info.get("primary_color", "#1e3a5f") if tenant_info else "#1e3a5f"
    
    # Track emails in this batch to prevent duplicates within the file
    batch_emails = set()
    
    for row_num, row in enumerate(rows, start=2):  # Start at 2 to account for header row
        # Sanitize all CSV inputs to prevent formula injection (OWASP A03)
        first_name = sanitize_csv_value(row.get('first_name', ''))
        last_name = sanitize_csv_value(row.get('last_name', ''))
        email = sanitize_csv_value(row.get('email', '')).lower()
        role = sanitize_csv_value(row.get('role', 'student')).lower().strip() or 'student'
        floor = sanitize_csv_value(row.get('floor', '')) or None
        room = sanitize_csv_value(row.get('room', '')) or None
        
        # Validate role - only allow student or ra from CSV
        if role not in ('student', 'ra'):
            role = 'student'
        
        # Validation
        errors_for_row = []
        
        if not first_name:
            errors_for_row.append("First name is required")
        if not last_name:
            errors_for_row.append("Last name is required")
        if not email:
            errors_for_row.append("Email is required")
        elif not validate_email(email):
            errors_for_row.append(f"Invalid email format: {email}")
        elif email in existing_emails:
            errors_for_row.append(f"Email already exists: {email}")
        elif email in batch_emails:
            errors_for_row.append(f"Duplicate email in file: {email}")
        
        if errors_for_row:
            results["failed"] += 1
            results["errors"].append({
                "row": row_num,
                "email": email or "N/A",
                "name": f"{first_name} {last_name}".strip() or "N/A",
                "errors": errors_for_row
            })
            continue
        
        # Create user
        try:
            setup_token = secrets.token_urlsafe(32)
            token_expiry = datetime.now(timezone.utc) + timedelta(days=7)
            user_id = str(uuid.uuid4())
            # Generate a unique user_id
            tenant_code = current_user.tenant_code or "UNKN"
            formatted_user_id = f"{tenant_code}-STU-{uuid.uuid4().hex[:8].upper()}"
            
            user_doc = {
                "id": user_id,
                "user_id": formatted_user_id,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "floor": floor,
                "room": room,
                "active": False,
                "password": None,
                "pending_setup": True,
                "setup_token": setup_token,
                "setup_token_expires": token_expiry.isoformat(),
                "invited_by": current_user.id,
                "invited_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            
            await tenant_db.users.insert_one(user_doc)
            
            # Send invite email (don't fail if email fails)
            try:
                await send_student_invite_email(
                    to_email=email,
                    user_name=first_name,
                    setup_token=setup_token,
                    floor=floor,
                    room=room,
                    tenant_name=tenant_name,
                    primary_color=primary_color
                )
            except Exception:
                pass  # Email failure shouldn't fail the import
            
            # Track success
            batch_emails.add(email)
            existing_emails.add(email)
            results["successful"] += 1
            results["created_users"].append({
                "id": user_id,
                "email": email,
                "name": f"{first_name} {last_name}",
                "floor": floor,
                "room": room
            })
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "row": row_num,
                "email": email,
                "name": f"{first_name} {last_name}",
                "errors": [f"Database error: {str(e)}"]
            })
    
    # Log bulk import audit
    # Log bulk import audit to master database
    await log_admin_action(
        db=master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.BULK_OPERATION,
        target_type="user",
        details={
            "operation": "bulk_invite",
            "total_processed": results["successful"] + results["failed"],
            "successful": results["successful"],
            "failed": results["failed"],
            "filename": file.filename
        },
        tenant_code=current_user.tenant_code
    )
    
    return results


@router.post("/users/bulk-invite-with-progress")
async def bulk_invite_students_with_progress(
    file: UploadFile = File(...),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Bulk invite students from a CSV file with detailed progress information.
    Returns progress data including total rows for frontend progress bar.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")
    
    try:
        content = await file.read()
        try:
            text_content = content.decode('utf-8')
        except UnicodeDecodeError:
            text_content = content.decode('latin-1')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    try:
        csv_reader = csv.DictReader(io.StringIO(text_content))
        rows = list(csv_reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    
    total_rows = len(rows)
    
    # Validate headers
    required_headers = {'first_name', 'last_name', 'email'}
    actual_headers = set(rows[0].keys()) if rows else set()
    missing_headers = required_headers - actual_headers
    
    if missing_headers:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required columns: {', '.join(missing_headers)}"
        )
    
    # Get existing emails
    existing_emails = set()
    async for user in tenant_db.users.find({}, {"email": 1}):
        existing_emails.add(user["email"].lower())
    
    # Get tenant branding for emails
    tenant_code = current_user.tenant_code or ""
    tenant_info = await master_db.tenants.find_one({"code": tenant_code}, {"_id": 0})
    tenant_name = tenant_info.get("name", tenant_code) if tenant_info else tenant_code
    branding = tenant_info.get("branding", {}) if tenant_info else {}
    primary_color = branding.get("primary_color") or tenant_info.get("primary_color", "#1e3a5f") if tenant_info else "#1e3a5f"
    
    batch_emails = set()
    results = {
        "total_rows": total_rows,
        "processed": 0,
        "successful": 0,
        "failed": 0,
        "skipped": 0,
        "errors": [],
        "created_users": [],
        "progress_percent": 0
    }
    
    for row_num, row in enumerate(rows, start=2):
        # Sanitize all CSV inputs to prevent formula injection (OWASP A03)
        first_name = sanitize_csv_value(row.get('first_name', ''))
        last_name = sanitize_csv_value(row.get('last_name', ''))
        email = sanitize_csv_value(row.get('email', '')).lower()
        role = sanitize_csv_value(row.get('role', 'student')).lower().strip() or 'student'
        floor = sanitize_csv_value(row.get('floor', '')) or None
        room = sanitize_csv_value(row.get('room', '')) or None
        
        # Validate role - only allow student or ra from CSV
        if role not in ('student', 'ra'):
            role = 'student'
        
        results["processed"] += 1
        results["progress_percent"] = round((results["processed"] / total_rows) * 100, 1)
        
        # Validation
        errors_for_row = []
        
        if not first_name:
            errors_for_row.append("First name is required")
        if not last_name:
            errors_for_row.append("Last name is required")
        if not email:
            errors_for_row.append("Email is required")
        elif not validate_email(email):
            errors_for_row.append("Invalid email format")
        elif email in existing_emails:
            results["skipped"] += 1
            results["errors"].append({
                "row": row_num,
                "email": email,
                "name": f"{first_name} {last_name}".strip(),
                "errors": ["Email already exists"],
                "type": "skipped"
            })
            continue
        elif email in batch_emails:
            results["skipped"] += 1
            results["errors"].append({
                "row": row_num,
                "email": email,
                "name": f"{first_name} {last_name}".strip(),
                "errors": ["Duplicate in file"],
                "type": "skipped"
            })
            continue
        
        if errors_for_row:
            results["failed"] += 1
            results["errors"].append({
                "row": row_num,
                "email": email or "N/A",
                "name": f"{first_name} {last_name}".strip() or "N/A",
                "errors": errors_for_row,
                "type": "error"
            })
            continue
        
        try:
            setup_token = secrets.token_urlsafe(32)
            token_expiry = datetime.now(timezone.utc) + timedelta(days=7)
            user_id = str(uuid.uuid4())
            # Generate a unique user_id
            tenant_code = current_user.tenant_code or "UNKN"
            formatted_user_id = f"{tenant_code}-STU-{uuid.uuid4().hex[:8].upper()}"
            
            user_doc = {
                "id": user_id,
                "user_id": formatted_user_id,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "floor": floor,
                "room": room,
                "active": False,
                "password": None,
                "pending_setup": True,
                "setup_token": setup_token,
                "setup_token_expires": token_expiry.isoformat(),
                "invited_by": current_user.id,
                "invited_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            
            await tenant_db.users.insert_one(user_doc)
            
            try:
                await send_student_invite_email(
                    to_email=email,
                    user_name=first_name,
                    setup_token=setup_token,
                    floor=floor,
                    room=room,
                    tenant_name=tenant_name,
                    primary_color=primary_color
                )
            except Exception:
                pass
            
            batch_emails.add(email)
            existing_emails.add(email)
            results["successful"] += 1
            results["created_users"].append({
                "id": user_id,
                "email": email,
                "name": f"{first_name} {last_name}",
                "floor": floor,
                "room": room
            })
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "row": row_num,
                "email": email,
                "name": f"{first_name} {last_name}",
                "errors": [str(e)],
                "type": "error"
            })
    
    results["progress_percent"] = 100
    
    return results


@router.get("/users/bulk-invite/template")
async def get_bulk_invite_template(current_user: User = Depends(get_current_user)):
    """
    Get a sample CSV template for bulk student import.
    Returns the template as a downloadable string.
    """
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    template = """first_name,last_name,email,floor,room
John,Doe,john.doe@example.com,Floor 1,101
Jane,Smith,jane.smith@example.com,Floor 2,205
Bob,Johnson,bob.j@example.com,,"""
    
    return {
        "template": template,
        "instructions": "Save this as a .csv file. Required columns: first_name, last_name, email. Optional columns: floor, room"
    }


@router.get("/csv-templates")
async def get_all_csv_templates(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """
    Get all available CSV templates for admin functions.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Generate dynamic dates for examples
    today = datetime.now(timezone.utc)
    today_str = today.strftime('%Y-%m-%d')
    tomorrow_str = (today + timedelta(days=1)).strftime('%Y-%m-%d')
    day_after_str = (today + timedelta(days=2)).strftime('%Y-%m-%d')
    
    templates = {
        "users": {
            "name": "Bulk User Import",
            "description": "Import multiple students and RAs at once. System will send invitation emails to each user.",
            "filename": "user_import_template.csv",
            "headers": "first_name,last_name,email,role,floor,room",
            "example_rows": [
                "John,Doe,john.doe@example.com,student,Level 1 - Wing A,101",
                "Jane,Smith,jane.smith@example.com,ra,Level 2 - Wing B,205",
                "Bob,Johnson,bob.j@example.com,student,Level 1 - Wing A,102"
            ],
            "required_fields": ["first_name", "last_name", "email"],
            "optional_fields": ["role", "floor", "room"],
            "notes": [
                "Email must be unique - duplicates will be skipped",
                "Users will receive an email to set their password",
                "Role: student (default) or ra",
                "Floor and room are optional but recommended"
            ],
            "can_export": False
        },
        "dining_menu": {
            "name": "Dining Menu Import",
            "description": "Import menu items for the dining hall. Can import multiple days at once.",
            "filename": "dining_menu_template.csv",
            "headers": "name,description,meal_type,date,dietary_tags,nutrition_info",
            "example_rows": [
                f"Scrambled Eggs,Fluffy scrambled eggs with herbs,Breakfast,{today_str},Vegetarian|Gluten-Free,250 cal",
                f"Grilled Chicken Salad,Fresh greens with grilled chicken,Lunch,{today_str},Gluten-Free,350 cal",
                f"Pasta Primavera,Penne with seasonal vegetables,Dinner,{today_str},Vegetarian,450 cal",
                f"Fresh Fruit Bowl,Seasonal fresh fruits,Snacks,{tomorrow_str},Vegan|Gluten-Free,120 cal"
            ],
            "required_fields": ["name", "meal_type", "date"],
            "optional_fields": ["description", "dietary_tags", "nutrition_info"],
            "notes": [
                "meal_type must be: Breakfast, Lunch, Dinner, or Snacks",
                f"date format: YYYY-MM-DD (e.g., {today_str})",
                "dietary_tags: separate multiple with | (e.g., Vegetarian|Gluten-Free)",
                "Available tags: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Halal, Kosher",
                "⚠️ IMPORTANT: Update dates to current/future dates to see items in the menu!"
            ],
            "can_export": True,
            "export_endpoint": "/dining/menu/export/csv"
        },
        "events": {
            "name": "Events Import",
            "description": "Import multiple events at once.",
            "filename": "events_template.csv",
            "headers": "title,description,date,time,location,category,max_attendees",
            "example_rows": [
                f"Movie Night,Join us for a classic film screening,{tomorrow_str},19:00,Common Room,social,50",
                f"Study Group,Midterm preparation session,{day_after_str},14:00,Library Room 2,academic,20",
                f"Floor BBQ,Annual floor barbecue event,{day_after_str},17:00,Courtyard,floor_event,100"
            ],
            "required_fields": ["title", "description", "date", "location", "category"],
            "optional_fields": ["time", "max_attendees"],
            "notes": [
                "date format: DD/MM/YYYY (e.g., 15/02/2026) or YYYY-MM-DD",
                "time format: HH:MM in 24-hour format (e.g., 18:00 for 6pm)",
                "If time is not provided, defaults to 12:00",
                "category options: social, academic, sports, cultural, floor_event, other"
            ],
            "can_export": True,
            "export_endpoint": "/events/export/csv"
        }
    }
    
    return templates


class UpdateUserRoleRequest(BaseModel):
    """Request model for updating a user's role"""
    role: str


class UpdateUserEmailRequest(BaseModel):
    """Request model for admin email correction"""
    email: EmailStr


class UpdateUserDetailsRequest(BaseModel):
    """Request model for admin editing user details"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None


@router.patch("/users/{user_id}")
async def update_user_role(
    user_id: str,
    update_data: UpdateUserRoleRequest,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Update a user's role. Only admins and super_admins can do this.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find the target user in tenant database
    target_user = await tenant_db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent changing your own role
    if target_user["id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    # Prevent modifying super_admins unless you're a super_admin
    if target_user.get("role") == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify super admin")
    
    # Validate role
    valid_roles = ['student', 'ra', 'admin', 'super_admin', 'college_admin']
    if update_data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Prevent creating super_admins unless you're a super_admin
    if update_data.role == 'super_admin' and current_user.role != 'super_admin':
        raise HTTPException(status_code=403, detail="Only super admins can create super admins")
    
    old_role = target_user.get("role", "unknown")
    
    # Update the role in tenant database
    await tenant_db.users.update_one(
        {"id": user_id},
        {"$set": {"role": update_data.role}}
    )
    
    # Log role change audit to master database
    await log_admin_action(
        db=master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.USER_ROLE_CHANGE,
        target_type="user",
        target_id=user_id,
        target_name=target_user.get("email"),
        details={
            "old_role": old_role,
            "new_role": update_data.role
        },
        tenant_code=current_user.tenant_code
    )
    
    return {
        "message": f"User role updated to {update_data.role}",
        "user_id": user_id,
        "new_role": update_data.role
    }


@router.patch("/users/{user_id}/email")
async def update_user_email(
    user_id: str,
    update_data: UpdateUserEmailRequest,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Correct a user's email address. Only admins can do this.
    Validates the new email is not already taken within the tenant.
    """
    tenant_db, current_user = tenant_data

    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")

    target_user = await tenant_db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    new_email = update_data.email.lower().strip()
    old_email = target_user.get("email", "")

    if new_email == old_email.lower():
        raise HTTPException(status_code=400, detail="New email is the same as the current email")

    # Check the new email isn't already in use within this tenant
    existing = await tenant_db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
    if existing:
        raise HTTPException(status_code=409, detail="This email address is already in use")

    await tenant_db.users.update_one(
        {"id": user_id},
        {"$set": {"email": new_email}}
    )

    # Also update any pending invitation records so they match
    tenant_code = current_user.tenant_code
    await tenant_db.invitations.update_many(
        {"email": old_email.lower(), "tenant_code": tenant_code},
        {"$set": {"email": new_email}}
    )

    return {
        "message": "Email address updated successfully",
        "user_id": user_id,
        "old_email": old_email,
        "new_email": new_email
    }


@router.patch("/users/{user_id}/details")
async def update_user_details(
    user_id: str,
    update_data: UpdateUserDetailsRequest,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Edit a user's name and/or email address. Only admins can do this.
    Only updates the fields that are provided and differ from the current value.
    """
    tenant_db, current_user = tenant_data

    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")

    target_user = await tenant_db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}

    if update_data.first_name is not None:
        first_name = update_data.first_name.strip()
        if not first_name:
            raise HTTPException(status_code=400, detail="First name cannot be empty")
        updates["first_name"] = first_name

    if update_data.last_name is not None:
        last_name = update_data.last_name.strip()
        if not last_name:
            raise HTTPException(status_code=400, detail="Last name cannot be empty")
        updates["last_name"] = last_name

    if update_data.email is not None:
        new_email = str(update_data.email).lower().strip()
        old_email = target_user.get("email", "").lower()
        if new_email != old_email:
            existing = await tenant_db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
            if existing:
                raise HTTPException(status_code=409, detail="This email address is already in use")
            updates["email"] = new_email
            # Keep invitation records in sync
            tenant_code = current_user.tenant_code
            await tenant_db.invitations.update_many(
                {"email": old_email, "tenant_code": tenant_code},
                {"$set": {"email": new_email}}
            )

    if not updates:
        raise HTTPException(status_code=400, detail="No changes to save")

    await tenant_db.users.update_one({"id": user_id}, {"$set": updates})

    return {"message": "User details updated", "user_id": user_id, "updated_fields": list(updates.keys())}


@router.get("/stats")
async def get_admin_dashboard_stats(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get admin dashboard statistics for current tenant"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Total users count - from tenant-specific database
    total_users = await tenant_db.users.count_documents({})
    
    # Count by role
    admin_count = await tenant_db.users.count_documents({"role": "admin"})
    ra_count = await tenant_db.users.count_documents({"role": "ra"})
    student_count = await tenant_db.users.count_documents({"role": "student"})
    
    # Active events count (events with end_date >= today or no end_date)
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    active_events = await tenant_db.events.count_documents({
        "$or": [
            {"end_date": {"$gte": today}},
            {"date": {"$gte": today}},
            {"end_date": None},
            {"end_date": {"$exists": False}}
        ]
    })
    
    # Pending service/maintenance requests
    pending_requests = await tenant_db.maintenance.count_documents({"status": "pending"})
    
    # Total job applications (all statuses)
    total_applications = await tenant_db.job_applications.count_documents({})
    
    # Total announcements - stored in tenant db
    total_announcements = await tenant_db.announcements.count_documents({
        "$or": [{"status": {"$exists": False}}, {"status": "published"}]
    })
    
    # Total shoutouts
    total_shoutouts = await tenant_db.shoutouts.count_documents({})
    
    # Active jobs
    active_jobs = await tenant_db.jobs.count_documents({"status": "active"})
    
    return {
        "total_users": total_users,
        "users_by_role": {
            "admin": admin_count,
            "ra": ra_count,
            "student": student_count
        },
        "active_events": active_events,
        "total_events": active_events,
        "pending_requests": pending_requests,
        "pending_applications": total_applications,
        "total_announcements": total_announcements,
        "total_shoutouts": total_shoutouts,
        "active_jobs": active_jobs
    }


@router.get("/setup-stats")
async def get_account_setup_stats(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """
    Get account setup completion statistics for current tenant.
    Shows how many invited users have completed their account setup vs. pending.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Total invited users (those with pending_setup field) - tenant specific
    total_invited = await tenant_db.users.count_documents({"invited_by": {"$exists": True}})
    
    # Pending setup (invited but not completed)
    pending_setup = await tenant_db.users.count_documents({
        "pending_setup": True,
        "active": False
    })
    
    # Completed setup (invited and setup completed)
    completed_setup = await tenant_db.users.count_documents({
        "invited_by": {"$exists": True},
        "$or": [
            {"pending_setup": False},
            {"pending_setup": {"$exists": False}, "active": True}
        ]
    })
    
    # Users who completed setup without invitation (self-registered or admin-created)
    self_registered = await tenant_db.users.count_documents({
        "invited_by": {"$exists": False},
        "active": True
    })
    
    # Get pending users details (limited to 50) - exclude sensitive fields
    pending_users = await tenant_db.users.find(
        {"pending_setup": True, "active": False},
        {"_id": 0, "id": 1, "email": 1, "first_name": 1, "last_name": 1, "floor": 1, "room": 1, "invited_at": 1, "setup_token_expires": 1}
    ).sort("invited_at", -1).to_list(50)
    
    # Calculate completion rate
    completion_rate = 0
    if total_invited > 0:
        completion_rate = round((completed_setup / total_invited) * 100, 1)
    
    # Get setup completion by time periods
    now = datetime.now(timezone.utc)
    last_7_days = (now - timedelta(days=7)).isoformat()
    last_30_days = (now - timedelta(days=30)).isoformat()
    
    # Setups completed in last 7 days
    recent_completions_7d = await tenant_db.users.count_documents({
        "invited_by": {"$exists": True},
        "$or": [
            {"pending_setup": False},
            {"pending_setup": {"$exists": False}, "active": True}
        ],
        "created_at": {"$gte": last_7_days}
    })
    
    # Setups completed in last 30 days
    recent_completions_30d = await tenant_db.users.count_documents({
        "invited_by": {"$exists": True},
        "$or": [
            {"pending_setup": False},
            {"pending_setup": {"$exists": False}, "active": True}
        ],
        "created_at": {"$gte": last_30_days}
    })
    
    # Expired invitations (token expired but setup not completed)
    expired_invitations = 0
    now_iso = now.isoformat()
    async for user in tenant_db.users.find({"pending_setup": True, "setup_token_expires": {"$exists": True}}):
        if user.get("setup_token_expires") and user["setup_token_expires"] < now_iso:
            expired_invitations += 1
    
    # Breakdown by role (for completed users)
    role_breakdown = {}
    async for user in db.users.find({"active": True}, {"role": 1}):
        role = user.get("role", "student")
        role_breakdown[role] = role_breakdown.get(role, 0) + 1
    
    return {
        "summary": {
            "total_invited": total_invited,
            "completed_setup": completed_setup,
            "pending_setup": pending_setup,
            "completion_rate": completion_rate,
            "self_registered": self_registered,
            "expired_invitations": expired_invitations
        },
        "recent_activity": {
            "completions_last_7_days": recent_completions_7d,
            "completions_last_30_days": recent_completions_30d
        },
        "role_breakdown": role_breakdown,
        "pending_users": pending_users
    }


@router.post("/send-setup-reminders")
async def send_setup_reminders(
    min_days: int = 3,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Send reminder emails to users who haven't completed account setup.
    
    Args:
        min_days: Minimum days since invitation before sending reminder (default: 3)
    
    Sends reminders to users who:
    - Have pending_setup = True
    - Were invited at least min_days ago
    - Have a valid (non-expired) setup token
    - Haven't been sent a reminder in the last 24 hours
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not is_email_enabled():
        raise HTTPException(status_code=400, detail="Email service is not configured")
    
    now = datetime.now(timezone.utc)
    cutoff_date = (now - timedelta(days=min_days)).isoformat()
    
    # Find users who need reminders - tenant specific
    pending_users = await tenant_db.users.find({
        "pending_setup": True,
        "active": False,
        "invited_at": {"$lte": cutoff_date},
        "setup_token": {"$exists": True},
        "$or": [
            {"last_reminder_sent": {"$exists": False}},
            {"last_reminder_sent": {"$lte": (now - timedelta(hours=24)).isoformat()}}
        ]
    }).to_list(100)
    
    results = {
        "total_found": len(pending_users),
        "reminders_sent": 0,
        "failed": 0,
        "skipped_expired": 0,
        "errors": [],
        "sent_to": []
    }
    
    for user in pending_users:
        # Check if token is expired
        token_expires = user.get("setup_token_expires")
        if token_expires and token_expires < now.isoformat():
            results["skipped_expired"] += 1
            continue
        
        # Calculate days since invite
        invited_at = user.get("invited_at")
        if invited_at:
            try:
                invite_date = datetime.fromisoformat(invited_at.replace('Z', '+00:00'))
                days_since = (now - invite_date).days
            except (ValueError, TypeError):
                days_since = min_days
        else:
            days_since = min_days
        
        # Regenerate token if it will expire within 2 days
        setup_token = user.get("setup_token")
        if token_expires:
            try:
                expire_date = datetime.fromisoformat(token_expires.replace('Z', '+00:00'))
                if (expire_date - now).days < 2:
                    # Regenerate token
                    setup_token = secrets.token_urlsafe(32)
                    new_expiry = now + timedelta(days=7)
                    await tenant_db.users.update_one(
                        {"id": user["id"]},
                        {"$set": {
                            "setup_token": setup_token,
                            "setup_token_expires": new_expiry.isoformat()
                        }}
                    )
            except (ValueError, TypeError):
                pass
        
        # Send reminder email
        try:
            email_result = await send_setup_reminder_email(
                to_email=user["email"],
                user_name=user.get("first_name", "there"),
                setup_token=setup_token,
                days_since_invite=days_since,
                floor=user.get("floor"),
                room=user.get("room")
            )
            
            if email_result.get("success"):
                results["reminders_sent"] += 1
                results["sent_to"].append({
                    "email": user["email"],
                    "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                    "days_since_invite": days_since
                })
                
                # Update last reminder sent timestamp
                await tenant_db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"last_reminder_sent": now.isoformat()}}
                )
            else:
                results["failed"] += 1
                results["errors"].append({
                    "email": user["email"],
                    "error": email_result.get("error", "Unknown error")
                })
                
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "email": user["email"],
                "error": str(e)
            })
    
    return results


@router.get("/users/search")
async def search_users(
    q: str = Query(default="", min_length=0),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Search users by name or email (for messaging). 
    Students can only see other students on their floor.
    RAs can see all students on their floor.
    Admins can see all users.
    Uses tenant-specific database for proper data isolation.
    """
    tenant_db, current_user = tenant_data
    
    is_admin = current_user.role in ['admin', 'super_admin', 'college_admin']
    is_ra = current_user.role == 'ra'
    
    # Build base query
    if q and len(q) >= 2:
        import re
        # SECURITY (OWASP A03): Prevent NoSQL injection
        safe_q = str(q)[:100]
        safe_q = safe_q.replace('$', '').replace('{', '').replace('}', '').replace('\x00', '')
        safe_q = safe_q.strip()
        if safe_q and len(safe_q) >= 2:
            safe_q = re.escape(safe_q)
            search_query = {
                "$or": [
                    {"first_name": {"$regex": safe_q, "$options": "i"}},
                    {"last_name": {"$regex": safe_q, "$options": "i"}},
                    {"email": {"$regex": safe_q, "$options": "i"}}
                ]
            }
        else:
            search_query = {}
    else:
        search_query = {}
    
    # Apply role-based filters
    if is_admin:
        # Admins can see all users
        query = search_query
    elif is_ra:
        # RAs can see all students (but not other admins)
        if search_query:
            query = {"$and": [search_query, {"role": {"$in": ["student", "ra"]}}]}
        else:
            query = {"role": {"$in": ["student", "ra"]}}
    else:
        # Students can see all other students in the tenant
        # (Removed floor restriction for better messaging experience)
        if search_query:
            query = {"$and": [search_query, {"role": {"$in": ["student", "ra"]}}]}
        else:
            query = {"role": {"$in": ["student", "ra"]}}
    
    # Use tenant-specific database for user search
    users = await tenant_db.users.find(query, {"_id": 0, "password": 0}).limit(50).to_list(50)
    
    # Format response - limit data exposure for non-admins
    result = []
    for u in users:
        if u.get('id') != current_user.id:  # Exclude current user
            user_data = {
                "id": u.get('id'),
                "first_name": u.get('first_name'),
                "last_name": u.get('last_name'),
                "name": f"{u.get('first_name', '')} {u.get('last_name', '')}".strip(),
                "photo_url": u.get('photo_url')
            }
            # Only admins can see email and role
            if is_admin:
                user_data["email"] = u.get('email')
                user_data["role"] = u.get('role')
                user_data["floor"] = u.get('floor')
            result.append(user_data)
    
    return result


@router.post("/incidents")
async def create_incident(incident_data: dict, tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Create incident report (RA/Admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Only RAs and admins can create incidents")
    
    incident_dict = {
        "id": str(uuid.uuid4()),
        "reported_by": current_user.id,
        "reported_by_name": f"{current_user.first_name} {current_user.last_name}",
        "incident_type": incident_data.get('incident_type'),
        "description": incident_data.get('description'),
        "location": incident_data.get('location'),
        "severity": incident_data.get('severity', 'low'),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None
    }
    
    await tenant_db.incidents.insert_one(incident_dict)
    incident_dict.pop('_id', None)
    return incident_dict


@router.get("/incidents")
async def get_incidents(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get incidents (RA/Admin see all, students see none) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role in ['ra', 'admin']:
        incidents = await tenant_db.incidents.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        incidents = []
    return incidents


@router.put("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Resolve incident (Admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can resolve incidents")
    
    await tenant_db.incidents.update_one(
        {"id": incident_id},
        {"$set": {"status": "resolved", "resolved_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Incident resolved"}
