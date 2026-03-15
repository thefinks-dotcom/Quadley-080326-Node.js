"""
Multi-tenant management routes.
Super Admin creates tenants, invites tenant admins, manages modules.
Tenant Admins invite users, manage their college.
"""
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, BackgroundTasks, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import csv
import io
import uuid
import logging
import secrets

from models import (
    Tenant, TenantCreate, TenantUpdate, TenantResponse,
    Invitation, InvitationCreate, User, ALL_MODULES, TenantStatus, _generate_invite_code
)
from utils.auth import get_current_user, hash_password
from utils.multi_tenant import (
    master_db, get_tenant_db, generate_tenant_code,
    initialize_tenant_database, delete_tenant_database
)
from utils.email_service import (
    send_invitation_email,
    send_tenant_admin_invitation_email
)
from utils.admin_audit import log_admin_action, AdminActionType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenants", tags=["multi-tenant"])

# ========== TENANT MANAGEMENT (Super Admin Only) ==========

@router.post("", response_model=TenantResponse)
async def create_tenant(
    request: Request,
    tenant_data: TenantCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new tenant (residential college).
    Super Admin only. Also sends invitation to the contact person.
    """
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can create tenants"
        )
    
    # Generate unique tenant code
    code = generate_tenant_code(tenant_data.name)
    
    # Check if code already exists (very unlikely but possible)
    existing = await master_db.tenants.find_one({"code": code})
    while existing:
        code = generate_tenant_code(tenant_data.name)
        existing = await master_db.tenants.find_one({"code": code})
    
    # Check if contact email is already used
    existing_email = await master_db.tenants.find_one({
        "contact_person_email": tenant_data.contact_person_email
    })
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A tenant with this contact email already exists"
        )
    
    # Create tenant
    tenant = Tenant(
        code=code,
        name=tenant_data.name,
        contact_person_name=tenant_data.contact_person_name,
        contact_person_email=tenant_data.contact_person_email,
        logo_url=tenant_data.logo_url,
        primary_color=tenant_data.primary_color or "#3b82f6",
        secondary_color=tenant_data.secondary_color or "#1f2937",
        branding={
            "primary_color": tenant_data.primary_color or "#3b82f6",
            "secondary_color": tenant_data.secondary_color or "#1f2937",
            "logo_url": tenant_data.logo_url,
        },
        enabled_modules=tenant_data.enabled_modules or ALL_MODULES.copy(),
        subscription_tier=tenant_data.subscription_tier or "basic",
        status=TenantStatus.active,
        created_by=current_user.id
    )
    
    tenant_doc = tenant.model_dump()
    tenant_doc['created_at'] = tenant_doc['created_at'].isoformat()
    tenant_doc['status'] = tenant_doc['status'].value
    # Store activities (sports, clubs, cultural)
    tenant_doc['activities'] = tenant_data.activities or []
    await master_db.tenants.insert_one(tenant_doc)
    
    # Initialize the tenant's database
    await initialize_tenant_database(code)
    
    # Log admin action
    await log_admin_action(
        master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.TENANT_CREATE,
        target_type="tenant",
        target_id=code,
        target_name=tenant_data.name,
        details={"subscription_tier": tenant_data.subscription_tier or "basic"},
        tenant_code=code,
        ip_address=request.client.host if request.client else None
    )
    
    # If activities are provided, create them in the tenant's cocurricular_groups collection
    if tenant_data.activities:
        tenant_db = get_tenant_db(code)
        for activity in tenant_data.activities:
            activity_doc = {
                "id": str(uuid.uuid4()),
                "type": activity.get("type", "clubs"),  # sports, clubs, cultural
                "name": activity.get("name", ""),
                "description": activity.get("description", ""),
                "contact_person": None,
                "contact_person_name": None,
                "owner_id": None,
                "owner_name": None,
                "message_group_id": None,
                "meeting_times": "",
                "competition_times": "",
                "other_details": "",
                "members": [],
                "member_names": [],
                "photos": [],
                "send_reminders": False,
                "reminder_times": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by_super_admin": True  # Flag to indicate it was created during tenant setup
            }
            await tenant_db.cocurricular_groups.insert_one(activity_doc)
    
    # Create admin user directly in tenant database with temporary password
    # This allows immediate login even if email fails
    temp_password = secrets.token_urlsafe(12)  # Random secure password
    admin_user_id = str(uuid.uuid4())
    first_name = tenant_data.contact_person_name.split()[0] if tenant_data.contact_person_name else "Admin"
    last_name = " ".join(tenant_data.contact_person_name.split()[1:]) if len(tenant_data.contact_person_name.split()) > 1 else ""
    
    admin_doc = {
        "id": admin_user_id,
        "user_id": f"{code}-ADMIN-001",
        "email": tenant_data.contact_person_email.lower(),
        "password": hash_password(temp_password),
        "first_name": first_name,
        "last_name": last_name,
        "role": "admin",
        "tenant_code": code,
        "active": True,
        "mfa_enabled": False,
        "must_change_password": True,  # Flag to prompt password change
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
    }
    
    tenant_db = get_tenant_db(code)
    try:
        await tenant_db.users.insert_one(admin_doc)
        logger.info(f"Admin user created for tenant {code}: {tenant_data.contact_person_email}")
    except Exception as e:
        logger.error(f"Failed to create admin user for tenant {code}: {e}")
    
    # Create invitation for contact person (tenant admin) - for email verification
    invitation = Invitation(
        tenant_code=code,
        email=tenant_data.contact_person_email,
        role="admin",
        first_name=tenant_data.contact_person_name.split()[0] if tenant_data.contact_person_name else None,
        last_name=" ".join(tenant_data.contact_person_name.split()[1:]) if len(tenant_data.contact_person_name.split()) > 1 else None,
        invited_by=current_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),  # Longer expiry for admins
        invite_code=_generate_invite_code(code),
    )
    
    invitation_doc = invitation.model_dump()
    invitation_doc['created_at'] = invitation_doc['created_at'].isoformat()
    invitation_doc['expires_at'] = invitation_doc['expires_at'].isoformat()
    invitation_doc['status'] = invitation_doc['status'].value
    await master_db.invitations.insert_one(invitation_doc)
    
    # Send invitation email to contact person (async via background task)
    background_tasks.add_task(
        send_tenant_admin_invitation_email,
        to_email=tenant_data.contact_person_email,
        tenant_name=tenant_data.name,
        tenant_code=code,
        invitation_token=invitation.token,
        contact_person_name=tenant_data.contact_person_name,
        invite_code=invitation.invite_code,
    )
    
    logger.info(f"Tenant created: {code} - {tenant_data.name}")
    
    return TenantResponse(
        id=tenant.id,
        code=tenant.code,
        name=tenant.name,
        logo_url=tenant.logo_url,
        contact_person_name=tenant.contact_person_name,
        contact_person_email=tenant.contact_person_email,
        enabled_modules=tenant.enabled_modules,
        status=tenant.status.value,
        user_count=tenant.user_count,
        created_at=tenant_doc['created_at']
    )

@router.get("", response_model=List[TenantResponse])
async def list_tenants(
    current_user: User = Depends(get_current_user)
):
    """
    List all tenants (super_admin) or current tenant (admin).
    """
    if current_user.role == "super_admin":
        tenants = await master_db.tenants.find({}, {"_id": 0}).to_list(1000)
    elif current_user.role == "admin":
        tenants = await master_db.tenants.find(
            {"code": current_user.tenant_code},
            {"_id": 0}
        ).to_list(1)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return [
        TenantResponse(
            id=t['id'],
            code=t['code'],
            name=t['name'],
            logo_url=t.get('logo_url'),
            primary_color=t.get('branding', {}).get('primary_color') or t.get('primary_color', '#3b82f6'),
            secondary_color=t.get('branding', {}).get('secondary_color') or t.get('secondary_color', '#1f2937'),
            branding=t.get('branding'),
            contact_person_name=t.get('contact_person_name', ''),
            contact_person_email=t.get('contact_person_email', ''),
            enabled_modules=t.get('enabled_modules', ALL_MODULES),
            subscription_tier=t.get('subscription_tier', 'basic'),
            max_users=t.get('max_users', 100),
            status=t['status'],
            user_count=t.get('user_count', 0),
            created_at=t['created_at'] if isinstance(t['created_at'], str) else t['created_at'].isoformat(),
            authorization_doc_url=t.get('authorization_doc_url'),
            authorization_doc_filename=t.get('authorization_doc_filename'),
            authorization_doc_uploaded_at=t.get('authorization_doc_uploaded_at'),
        )
        for t in tenants
    ]

@router.post("/{tenant_code}/logo")
async def upload_tenant_logo(
    tenant_code: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload tenant logo image.
    Accepts image files (JPG, PNG, GIF, WebP). Max 5MB.
    """
    from pathlib import Path
    from utils.file_validation import validate_image_upload, generate_safe_filename
    
    # Authorization check
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Verify tenant exists
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Validate the uploaded file
    is_valid, error_msg, content = await validate_image_upload(file, file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path("/app/backend/uploads/logos")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate safe filename
    safe_filename = generate_safe_filename(file.filename, f"logo_{tenant_code}", content)
    file_path = upload_dir / safe_filename
    
    # Delete old logo if exists
    old_logo = tenant.get('logo_url')
    if old_logo and old_logo.startswith('/api/uploads/logos/'):
        old_filename = old_logo.split('/')[-1]
        old_path = upload_dir / old_filename
        if old_path.exists():
            old_path.unlink()
    
    # Save the file
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Update tenant with new logo URL
    logo_url = f"/api/uploads/logos/{safe_filename}"
    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {"logo_url": logo_url}}
    )
    
    logger.info(f"Logo uploaded for tenant {tenant_code}: {safe_filename}")
    
    return {
        "message": "Logo uploaded successfully",
        "logo_url": logo_url
    }

@router.post("/{tenant_code}/authorization-doc")
async def upload_authorization_doc(
    tenant_code: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload an authorization document for a tenant (PDF, JPG, or PNG).
    Proves the college has approved use of their name and branding. Super Admin only.
    """
    from pathlib import Path
    from utils.file_validation import generate_safe_filename

    if current_user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admins can upload authorization documents")

    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF, JPG, and PNG files are accepted.")

    upload_dir = Path("/app/backend/uploads/auth_docs")
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = generate_safe_filename(file.filename, f"authdoc_{tenant_code}", content)
    file_path = upload_dir / safe_filename

    # Remove old doc file if one already exists
    old_doc = tenant.get("authorization_doc_url")
    if old_doc and old_doc.startswith("/api/uploads/auth_docs/"):
        old_path = upload_dir / old_doc.split("/")[-1]
        if old_path.exists():
            old_path.unlink()

    with open(file_path, "wb") as f:
        f.write(content)

    doc_url = f"/api/uploads/auth_docs/{safe_filename}"
    now = datetime.now(timezone.utc).isoformat()

    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {
            "authorization_doc_url": doc_url,
            "authorization_doc_filename": file.filename,
            "authorization_doc_uploaded_at": now,
            "authorization_doc_uploaded_by": current_user.id,
        }}
    )

    logger.info(f"Authorization doc uploaded for tenant {tenant_code} by user {current_user.id}")

    return {
        "message": "Authorization document uploaded successfully",
        "authorization_doc_url": doc_url,
        "authorization_doc_filename": file.filename,
        "authorization_doc_uploaded_at": now,
    }


@router.delete("/{tenant_code}/authorization-doc")
async def delete_authorization_doc(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Remove an authorization document for a tenant. Super Admin only."""
    from pathlib import Path

    if current_user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admins can remove authorization documents")

    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    old_doc = tenant.get("authorization_doc_url")
    if old_doc and old_doc.startswith("/api/uploads/auth_docs/"):
        upload_dir = Path("/app/backend/uploads/auth_docs")
        old_path = upload_dir / old_doc.split("/")[-1]
        if old_path.exists():
            old_path.unlink()

    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$unset": {
            "authorization_doc_url": "",
            "authorization_doc_filename": "",
            "authorization_doc_uploaded_at": "",
            "authorization_doc_uploaded_by": "",
        }}
    )

    return {"message": "Authorization document removed"}


@router.get("/{tenant_code}", response_model=TenantResponse)
async def get_tenant(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Get tenant details"""
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant = await master_db.tenants.find_one({"code": tenant_code}, {"_id": 0})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return TenantResponse(
        id=tenant['id'],
        code=tenant['code'],
        name=tenant['name'],
        logo_url=tenant.get('logo_url'),
        primary_color=tenant.get('branding', {}).get('primary_color') or tenant.get('primary_color', '#3b82f6'),
        secondary_color=tenant.get('branding', {}).get('secondary_color') or tenant.get('secondary_color', '#1f2937'),
        branding=tenant.get('branding'),
        contact_person_name=tenant['contact_person_name'],
        contact_person_email=tenant['contact_person_email'],
        enabled_modules=tenant.get('enabled_modules', ALL_MODULES),
        subscription_tier=tenant.get('subscription_tier', 'basic'),
        max_users=tenant.get('max_users', 100),
        status=tenant['status'],
        user_count=tenant.get('user_count', 0),
        created_at=tenant['created_at'] if isinstance(tenant['created_at'], str) else tenant['created_at'].isoformat(),
        authorization_doc_url=tenant.get('authorization_doc_url'),
        authorization_doc_filename=tenant.get('authorization_doc_filename'),
        authorization_doc_uploaded_at=tenant.get('authorization_doc_uploaded_at'),
    )

@router.put("/{tenant_code}", response_model=TenantResponse)
async def update_tenant(
    tenant_code: str,
    tenant_data: TenantUpdate,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Update tenant settings"""
    # Super admin can update any tenant, admin can only update their own
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Admin cannot change status
    if current_user.role != "super_admin" and tenant_data.status:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can change tenant status"
        )
    
    tenant = await master_db.tenants.find_one({"code": tenant_code}, {"_id": 0})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    update_data = {}
    for k, v in tenant_data.model_dump().items():
        if v is not None:
            if k == 'status':
                update_data[k] = v.value
            else:
                update_data[k] = v
    
    # Sync branding dict whenever colors are updated
    if 'primary_color' in update_data or 'secondary_color' in update_data:
        existing_branding = tenant.get('branding') or {}
        if 'primary_color' in update_data:
            existing_branding['primary_color'] = update_data['primary_color']
        if 'secondary_color' in update_data:
            existing_branding['secondary_color'] = update_data['secondary_color']
        if 'logo_url' in update_data:
            existing_branding['logo_url'] = update_data['logo_url']
        update_data['branding'] = existing_branding
    
    if update_data:
        await master_db.tenants.update_one(
            {"code": tenant_code},
            {"$set": update_data}
        )
        
        # Log admin action
        await log_admin_action(
            master_db,
            admin_id=current_user.id,
            admin_email=current_user.email,
            action_type=AdminActionType.TENANT_UPDATE,
            target_type="tenant",
            target_id=tenant_code,
            target_name=tenant.get('name'),
            details={"updated_fields": list(update_data.keys())},
            tenant_code=tenant_code,
            ip_address=request.client.host if request.client else None
        )
    
    tenant = await master_db.tenants.find_one({"code": tenant_code}, {"_id": 0})
    
    return TenantResponse(
        id=tenant['id'],
        code=tenant['code'],
        name=tenant['name'],
        logo_url=tenant.get('logo_url'),
        primary_color=tenant.get('branding', {}).get('primary_color') or tenant.get('primary_color', '#3b82f6'),
        secondary_color=tenant.get('branding', {}).get('secondary_color') or tenant.get('secondary_color', '#1f2937'),
        branding=tenant.get('branding'),
        contact_person_name=tenant['contact_person_name'],
        contact_person_email=tenant['contact_person_email'],
        enabled_modules=tenant.get('enabled_modules', ALL_MODULES),
        subscription_tier=tenant.get('subscription_tier', 'basic'),
        max_users=tenant.get('max_users', 100),
        status=tenant['status'],
        user_count=tenant.get('user_count', 0),
        created_at=tenant['created_at'] if isinstance(tenant['created_at'], str) else tenant['created_at'].isoformat()
    )

class ContactPersonUpdateRequest(BaseModel):
    contact_person_name: str
    contact_person_email: str


@router.put("/{tenant_code}/contact-person")
async def update_contact_person(
    tenant_code: str,
    request_body: ContactPersonUpdateRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Update the contact (admin) person for a tenant.
    Super Admin can update any tenant. Admin can update their own.
    Also updates the admin user record in the tenant DB if the email changes.
    """
    if current_user.role != "super_admin" and (
        current_user.role != "admin" or getattr(current_user, 'tenant_code', None) != tenant_code
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    old_email = tenant.get('contact_person_email', '').lower()
    new_email = request_body.contact_person_email.strip().lower()
    new_name = request_body.contact_person_name.strip()

    if not new_name or not new_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name and email are required"
        )

    # Update tenant record
    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {
            "contact_person_name": new_name,
            "contact_person_email": new_email,
        }}
    )

    # If email changed, update the admin user in the tenant database
    tenant_db = get_tenant_db(tenant_code)
    email_changed = old_email != new_email

    if email_changed:
        # Check the new email isn't already taken in this tenant
        existing_user = await tenant_db.users.find_one({"email": new_email})
        if existing_user:
            # If the existing user is already an admin, just update tenant contact
            if existing_user.get('role') != 'admin':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A non-admin user with this email already exists in this tenant"
                )
        else:
            # Update the old admin user's email to the new one
            old_admin = await tenant_db.users.find_one({"email": old_email, "role": "admin"})
            if old_admin:
                first_name = new_name.split()[0] if new_name else old_admin.get('first_name', '')
                last_name = " ".join(new_name.split()[1:]) if len(new_name.split()) > 1 else old_admin.get('last_name', '')
                await tenant_db.users.update_one(
                    {"email": old_email, "role": "admin"},
                    {"$set": {
                        "email": new_email,
                        "first_name": first_name,
                        "last_name": last_name,
                    }}
                )

        # Update any pending invitations for the old email to the new email
        first_name = new_name.split()[0] if new_name else ""
        last_name = " ".join(new_name.split()[1:]) if len(new_name.split()) > 1 else ""
        updated_inv = await master_db.invitations.update_many(
            {"tenant_code": tenant_code, "email": old_email, "status": "pending"},
            {"$set": {
                "email": new_email,
                "first_name": first_name,
                "last_name": last_name,
            }}
        )
        if updated_inv.modified_count > 0:
            logger.info(f"Updated {updated_inv.modified_count} pending invitation(s) from {old_email} to {new_email} for tenant {tenant_code}")

        # Resend invitation to the new email
        invitation = await master_db.invitations.find_one({
            "tenant_code": tenant_code,
            "email": new_email,
            "status": "pending"
        })
        if invitation:
            tenant_name = tenant.get('name', tenant_code)
            try:
                await send_tenant_admin_invitation_email(
                    to_email=new_email,
                    tenant_name=tenant_name,
                    tenant_code=tenant_code,
                    invitation_token=invitation.get('token'),
                    contact_person_name=new_name,
                    invite_code=invitation.get('invite_code'),
                    ios_app_link=tenant.get('ios_app_link'),
                    android_app_link=tenant.get('android_app_link'),
                )
                logger.info(f"Invitation resent to new contact email {new_email} for tenant {tenant_code}")
            except Exception as e:
                logger.error(f"Failed to send invitation to new contact {new_email}: {e}")
    else:
        # Just update the name on the admin user
        old_admin = await tenant_db.users.find_one({"email": old_email, "role": "admin"})
        if old_admin:
            first_name = new_name.split()[0] if new_name else old_admin.get('first_name', '')
            last_name = " ".join(new_name.split()[1:]) if len(new_name.split()) > 1 else old_admin.get('last_name', '')
            await tenant_db.users.update_one(
                {"email": old_email, "role": "admin"},
                {"$set": {
                    "first_name": first_name,
                    "last_name": last_name,
                }}
            )

        # Also update name on pending invitations
        await master_db.invitations.update_many(
            {"tenant_code": tenant_code, "email": old_email, "status": "pending"},
            {"$set": {
                "first_name": new_name.split()[0] if new_name else "",
                "last_name": " ".join(new_name.split()[1:]) if len(new_name.split()) > 1 else "",
            }}
        )

    # Log admin action
    await log_admin_action(
        master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.TENANT_UPDATE,
        target_type="tenant",
        target_id=tenant_code,
        target_name=tenant.get('name'),
        details={
            "action": "contact_person_change",
            "old_email": old_email,
            "new_email": new_email,
            "new_name": new_name,
        },
        tenant_code=tenant_code,
        ip_address=request.client.host if request.client else None
    )

    logger.info(f"Contact person updated for tenant {tenant_code}: {new_name} <{new_email}>")

    return {
        "message": "Contact person updated successfully",
        "contact_person_name": new_name,
        "contact_person_email": new_email,
        "email_changed": email_changed,
    }


class ModuleUpdateRequest(BaseModel):
    enabled_modules: List[str]


class AdminInviteRequest(BaseModel):
    name: str
    email: str


@router.post("/{tenant_code}/admins")
async def add_tenant_admin(
    tenant_code: str,
    admin_data: AdminInviteRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Add an additional admin to a tenant. Super Admin only.
    Creates the admin user and sends an invitation email.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can add tenant admins")

    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_db = get_tenant_db(tenant_code)
    email = admin_data.email.strip().lower()
    name = admin_data.name.strip()

    # Check if email already exists in this tenant
    existing = await tenant_db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists in this tenant")

    # Create admin user
    admin_user_id = str(uuid.uuid4())
    temp_password = secrets.token_urlsafe(12)
    first_name = name.split()[0] if name else "Admin"
    last_name = " ".join(name.split()[1:]) if len(name.split()) > 1 else ""

    admin_doc = {
        "id": admin_user_id,
        "user_id": f"{tenant_code}-ADMIN-{uuid.uuid4().hex[:6].upper()}",
        "email": email,
        "password": hash_password(temp_password),
        "first_name": first_name,
        "last_name": last_name,
        "role": "admin",
        "tenant_code": tenant_code,
        "active": True,
        "mfa_enabled": False,
        "must_change_password": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
    }
    await tenant_db.users.insert_one(admin_doc)
    admin_doc.pop('_id', None)

    # Create invitation with invite code
    invite_code = _generate_invite_code(tenant_code)
    invitation = Invitation(
        tenant_code=tenant_code,
        email=email,
        role="admin",
        first_name=first_name,
        last_name=last_name,
        invited_by=current_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        invite_code=invite_code,
    )
    invitation_doc = invitation.model_dump()
    invitation_doc['created_at'] = invitation_doc['created_at'].isoformat()
    invitation_doc['expires_at'] = invitation_doc['expires_at'].isoformat()
    invitation_doc['status'] = invitation_doc['status'].value
    await master_db.invitations.insert_one(invitation_doc)

    # Get branding for email
    branding = tenant.get('branding', {})
    primary_color = branding.get('primary_color') or tenant.get('primary_color', '#0f172a')

    # Send invitation email
    background_tasks.add_task(
        send_tenant_admin_invitation_email,
        to_email=email,
        tenant_name=tenant.get('name', tenant_code),
        tenant_code=tenant_code,
        invitation_token=invitation.token,
        contact_person_name=name,
        invite_code=invite_code,
        primary_color=primary_color,
    )

    await log_admin_action(
        master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.USER_CREATE,
        target_type="admin",
        target_id=admin_user_id,
        target_name=name,
        details={"email": email, "role": "admin", "tenant": tenant_code},
        tenant_code=tenant_code,
        ip_address=request.client.host if request.client else None
    )

    return {
        "message": f"Admin invitation sent to {email}",
        "admin": {
            "id": admin_user_id,
            "email": email,
            "name": name,
            "role": "admin",
            "invite_code": invite_code,
        }
    }


@router.get("/{tenant_code}/admins")
async def list_tenant_admins(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """List all admins for a tenant. Super Admin only."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can view tenant admins")

    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_db = get_tenant_db(tenant_code)
    admins = await tenant_db.users.find(
        {"role": "admin"},
        {"_id": 0, "password": 0, "mfa_secret": 0, "mfa_backup_codes": 0, "setup_token": 0}
    ).to_list(100)

    return admins


class SubscriptionUpdateRequest(BaseModel):
    subscription_tier: str  # basic, pro, enterprise
    max_users: Optional[int] = None


@router.put("/{tenant_code}/subscription")
async def update_tenant_subscription(
    tenant_code: str,
    request_body: SubscriptionUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Update subscription tier for a tenant. Super Admin only."""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can update subscriptions"
        )
    
    # Validate tier
    valid_tiers = ["basic", "pro", "enterprise"]
    if request_body.subscription_tier not in valid_tiers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tier. Must be one of: {valid_tiers}"
        )
    
    # Set max users based on tier if not provided
    max_users = request_body.max_users
    if max_users is None:
        tier_defaults = {"basic": 100, "pro": 500, "enterprise": -1}  # -1 = unlimited
        max_users = tier_defaults.get(request_body.subscription_tier, 100)
    
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {
            "subscription_tier": request_body.subscription_tier,
            "max_users": max_users
        }}
    )
    
    # Log admin action
    await log_admin_action(
        master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.TENANT_UPDATE,
        target_type="tenant",
        target_id=tenant_code,
        target_name=tenant.get('name'),
        details={"subscription_tier": request_body.subscription_tier, "max_users": max_users},
        tenant_code=tenant_code,
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Subscription updated",
        "subscription_tier": request_body.subscription_tier,
        "max_users": max_users
    }


class ActivityUpdateRequest(BaseModel):
    activities: List[dict]  # List of {type, name, description}


@router.put("/{tenant_code}/modules")
async def update_tenant_modules(
    tenant_code: str,
    request_body: ModuleUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Toggle modules for a tenant. Super Admin or Tenant Admin."""
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    enabled_modules = request_body.enabled_modules
    
    # Validate modules
    invalid_modules = [m for m in enabled_modules if m not in ALL_MODULES]
    if invalid_modules:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid modules: {invalid_modules}. Valid modules are: {ALL_MODULES}"
        )
    
    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {"enabled_modules": enabled_modules}}
    )
    
    # Log admin action
    await log_admin_action(
        master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.TENANT_MODULE_UPDATE,
        target_type="tenant",
        target_id=tenant_code,
        details={"enabled_modules": enabled_modules},
        tenant_code=tenant_code,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Modules updated", "enabled_modules": enabled_modules}


@router.get("/{tenant_code}/activities")
async def get_tenant_activities(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Get activities for a tenant. Super Admin or Tenant Admin."""
    if current_user.role != "super_admin" and getattr(current_user, 'tenant_code', None) != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    activities = await tenant_db.cocurricular_groups.find({}, {"_id": 0}).to_list(200)
    
    return {"activities": activities}


@router.put("/{tenant_code}/activities")
async def update_tenant_activities(
    tenant_code: str,
    request_body: ActivityUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update activities for a tenant. Super Admin or Tenant Admin."""
    if current_user.role != "super_admin" and getattr(current_user, 'tenant_code', None) != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    
    # Get existing activities
    existing_activities = await tenant_db.cocurricular_groups.find({}, {"_id": 0}).to_list(200)
    existing_ids = {a.get('id') for a in existing_activities}
    
    new_activities = request_body.activities
    new_ids = set()
    
    for activity in new_activities:
        activity_id = activity.get('id')
        
        if activity_id and activity_id in existing_ids:
            # Update existing activity
            await tenant_db.cocurricular_groups.update_one(
                {"id": str(activity_id)},
                {"$set": {
                    "type": activity.get("type", "clubs"),
                    "name": activity.get("name", ""),
                    "description": activity.get("description", ""),
                    "meeting_times": activity.get("meeting_times", ""),
                    "competition_times": activity.get("competition_times", ""),
                    "other_details": activity.get("other_details", ""),
                }}
            )
            new_ids.add(activity_id)
        else:
            # Create new activity
            new_id = str(uuid.uuid4())
            activity_doc = {
                "id": new_id,
                "type": activity.get("type", "clubs"),
                "name": activity.get("name", ""),
                "description": activity.get("description", ""),
                "contact_person": None,
                "contact_person_name": None,
                "owner_id": None,
                "owner_name": None,
                "message_group_id": None,
                "meeting_times": activity.get("meeting_times", ""),
                "competition_times": activity.get("competition_times", ""),
                "other_details": activity.get("other_details", ""),
                "members": [],
                "member_names": [],
                "photos": [],
                "send_reminders": False,
                "reminder_times": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await tenant_db.cocurricular_groups.insert_one(activity_doc)
            new_ids.add(new_id)
    
    # Delete activities that are no longer in the list (only if they have no members)
    for existing_id in existing_ids:
        if existing_id not in new_ids:
            activity = await tenant_db.cocurricular_groups.find_one({"id": str(existing_id)})
            if activity and len(activity.get('members', [])) == 0:
                await tenant_db.cocurricular_groups.delete_one({"id": str(existing_id)})
    
    # Also update the master db tenant record
    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {"activities": new_activities}}
    )
    
    return {"message": "Activities updated", "count": len(new_activities)}


class SingleActivityRequest(BaseModel):
    type: str = "clubs"  # sports, clubs, cultural
    name: str
    description: Optional[str] = ""
    meeting_times: Optional[str] = ""
    competition_times: Optional[str] = ""
    other_details: Optional[str] = ""


@router.post("/{tenant_code}/activities")
async def create_activity(
    tenant_code: str,
    activity_data: SingleActivityRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a single activity for a tenant. Admin or Super Admin."""
    # Check permissions
    is_tenant_admin = current_user.role == "admin" and getattr(current_user, 'tenant_code', None) == tenant_code
    is_super_admin = current_user.role == "super_admin"
    
    if not is_tenant_admin and not is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Validate activity type
    valid_types = ["sports", "clubs", "cultural"]
    if activity_data.type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid activity type. Must be one of: {valid_types}"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    
    # Create new activity
    new_id = str(uuid.uuid4())
    activity_doc = {
        "id": new_id,
        "type": activity_data.type,
        "name": activity_data.name,
        "description": activity_data.description or "",
        "contact_person": None,
        "contact_person_name": None,
        "owner_id": None,
        "owner_name": None,
        "message_group_id": None,
        "meeting_times": activity_data.meeting_times or "",
        "competition_times": activity_data.competition_times or "",
        "other_details": activity_data.other_details or "",
        "members": [],
        "member_names": [],
        "photos": [],
        "send_reminders": False,
        "reminder_times": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    
    await tenant_db.cocurricular_groups.insert_one(activity_doc)
    
    # Remove MongoDB _id before returning
    activity_doc.pop('_id', None)
    
    return {"message": "Activity created", "activity": activity_doc}


@router.put("/{tenant_code}/activities/{activity_id}")
async def update_single_activity(
    tenant_code: str,
    activity_id: str,
    activity_data: SingleActivityRequest,
    current_user: User = Depends(get_current_user)
):
    """Update a single activity. Admin or Super Admin."""
    # Check permissions
    is_tenant_admin = current_user.role == "admin" and getattr(current_user, 'tenant_code', None) == tenant_code
    is_super_admin = current_user.role == "super_admin"
    
    if not is_tenant_admin and not is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    
    # Check if activity exists
    existing = await tenant_db.cocurricular_groups.find_one({"id": str(activity_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found"
        )
    
    # Update the activity
    update_data = {
        "type": activity_data.type,
        "name": activity_data.name,
        "description": activity_data.description or "",
        "meeting_times": activity_data.meeting_times or "",
        "competition_times": activity_data.competition_times or "",
        "other_details": activity_data.other_details or "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id
    }
    
    await tenant_db.cocurricular_groups.update_one(
        {"id": str(activity_id)},
        {"$set": update_data}
    )
    
    # Fetch and return updated activity
    updated = await tenant_db.cocurricular_groups.find_one({"id": str(activity_id)}, {"_id": 0})
    
    return {"message": "Activity updated", "activity": updated}


@router.delete("/{tenant_code}/activities/{activity_id}")
async def delete_single_activity(
    tenant_code: str,
    activity_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a single activity. Admin or Super Admin. Only allowed if no members."""
    # Check permissions
    is_tenant_admin = current_user.role == "admin" and getattr(current_user, 'tenant_code', None) == tenant_code
    is_super_admin = current_user.role == "super_admin"
    
    if not is_tenant_admin and not is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    
    # Check if activity exists
    activity = await tenant_db.cocurricular_groups.find_one({"id": str(activity_id)})
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found"
        )
    
    # Check if activity has members
    if len(activity.get('members', [])) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete activity with {len(activity['members'])} members. Remove members first."
        )
    
    # Delete the activity
    await tenant_db.cocurricular_groups.delete_one({"id": str(activity_id)})
    
    return {"message": "Activity deleted", "activity_id": str(activity_id)}


@router.get("/{tenant_code}/activities/{activity_id}")
async def get_single_activity(
    tenant_code: str,
    activity_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single activity by ID."""
    # Check permissions
    is_tenant_user = getattr(current_user, 'tenant_code', None) == tenant_code
    is_super_admin = current_user.role == "super_admin"
    
    if not is_tenant_user and not is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    
    activity = await tenant_db.cocurricular_groups.find_one({"id": str(activity_id)}, {"_id": 0})
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found"
        )
    
    return {"activity": activity}



async def suspend_tenant(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Suspend a tenant. Super Admin only."""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can suspend tenants"
        )
    
    result = await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {"status": "suspended"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return {"message": "Tenant suspended"}


@router.delete("/{tenant_code}/permanent")
async def delete_tenant_permanently(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Permanently delete a tenant and all its data. Super Admin only. This cannot be undone!"""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can delete tenants"
        )
    
    # Check if tenant exists
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Delete tenant database
    try:
        await delete_tenant_database(tenant_code)
    except Exception as e:
        logger.error(f"Error deleting tenant database: {e}")
    
    # Delete all invitations for this tenant
    await master_db.invitations.delete_many({"tenant_code": tenant_code})
    
    # Delete tenant record from master database
    await master_db.tenants.delete_one({"code": tenant_code})
    
    logger.info(f"Tenant permanently deleted: {tenant_code} by {current_user.email}")
    
    return {"message": "Tenant permanently deleted", "code": tenant_code}

@router.put("/{tenant_code}/reactivate")
async def reactivate_tenant(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Reactivate a suspended tenant. Super Admin only."""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can reactivate tenants"
        )
    
    result = await master_db.tenants.update_one(
        {"code": tenant_code, "status": "suspended"},
        {"$set": {"status": "active"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found or not suspended"
        )
    
    return {"message": "Tenant reactivated"}

# ========== INVITATION MANAGEMENT ==========

@router.post("/{tenant_code}/invitations")
async def create_invitation(
    tenant_code: str,
    invitation_data: InvitationCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Create an invitation for a user.
    Admin can invite to their tenant, Super Admin can invite to any tenant.
    """
    if current_user.role == "super_admin":
        pass  # Can invite to any tenant
    elif current_user.role == "admin" and current_user.tenant_code == tenant_code:
        pass  # Admin inviting to their own tenant
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Verify tenant exists and is active
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    if tenant['status'] != 'active':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot invite users to inactive tenant"
        )
    
    # Check if invitation already exists
    existing = await master_db.invitations.find_one({
        "tenant_code": tenant_code,
        "email": invitation_data.email.lower(),
        "status": "pending"
    })
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An invitation for this email already exists"
        )
    
    # Check if user already exists in tenant
    tenant_db = get_tenant_db(tenant_code)
    existing_user = await tenant_db.users.find_one({"email": invitation_data.email.lower()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists in this tenant"
        )
    
    # Create invitation
    invitation = Invitation(
        tenant_code=tenant_code,
        email=invitation_data.email.lower(),
        role=invitation_data.role,
        first_name=invitation_data.first_name,
        last_name=invitation_data.last_name,
        invited_by=current_user.id,
        invite_code=_generate_invite_code(tenant_code),
    )
    
    invitation_doc = invitation.model_dump()
    invitation_doc['created_at'] = invitation_doc['created_at'].isoformat()
    invitation_doc['expires_at'] = invitation_doc['expires_at'].isoformat()
    invitation_doc['status'] = invitation_doc['status'].value
    await master_db.invitations.insert_one(invitation_doc)
    
    # Send invitation email (async via background task)
    inviter_name = f"{current_user.first_name} {current_user.last_name}".strip() or "Administrator"
    background_tasks.add_task(
        send_invitation_email,
        to_email=invitation_data.email.lower(),
        tenant_name=tenant['name'],
        invitation_token=invitation.token,
        role=invitation_data.role,
        inviter_name=inviter_name,
        first_name=invitation_data.first_name,
        invite_code=invitation.invite_code,
        ios_app_link=tenant.get('ios_app_link'),
        android_app_link=tenant.get('android_app_link'),
    )
    
    logger.info(f"Invitation created for {invitation_data.email} to tenant {tenant_code}")
    
    return {
        "message": "Invitation created and email sent",
        "invitation_id": invitation.id,
        "token": invitation.token,
        "email": invitation.email
    }

@router.post("/{tenant_code}/invitations/bulk")
async def create_bulk_invitations(
    tenant_code: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Bulk create invitations from CSV file.
    CSV format: email,first_name,last_name,role (role is optional, defaults to student)
    """
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Verify tenant
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant or tenant['status'] != 'active':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not found or not active"
        )
    
    # Read CSV
    content = await file.read()
    try:
        csv_content = content.decode('utf-8')
    except UnicodeDecodeError:
        csv_content = content.decode('latin-1')
    
    reader = csv.DictReader(io.StringIO(csv_content))
    
    created = 0
    skipped = 0
    errors = []
    
    tenant_db = get_tenant_db(tenant_code)
    
    for row_num, row in enumerate(reader, start=2):  # Start at 2 because row 1 is header
        email = row.get('email', '').strip().lower()
        first_name = row.get('first_name', '').strip()
        last_name = row.get('last_name', '').strip()
        role = row.get('role', 'student').strip().lower()
        
        if not email:
            errors.append(f"Row {row_num}: Missing email")
            continue
        
        if role not in ['student', 'ra', 'admin']:
            role = 'student'
        
        # Check if invitation or user already exists
        existing_invitation = await master_db.invitations.find_one({
            "tenant_code": tenant_code,
            "email": email,
            "status": "pending"
        })
        
        existing_user = await tenant_db.users.find_one({"email": email})
        
        if existing_invitation or existing_user:
            skipped += 1
            continue
        
        # Create invitation
        invitation = Invitation(
            tenant_code=tenant_code,
            email=email,
            role=role,
            first_name=first_name or None,
            last_name=last_name or None,
            invited_by=current_user.id,
            invite_code=_generate_invite_code(tenant_code),
        )
        
        invitation_doc = invitation.model_dump()
        invitation_doc['created_at'] = invitation_doc['created_at'].isoformat()
        invitation_doc['expires_at'] = invitation_doc['expires_at'].isoformat()
        invitation_doc['status'] = invitation_doc['status'].value
        await master_db.invitations.insert_one(invitation_doc)
        
        created += 1
    
    return {
        "message": "Bulk invitation complete",
        "created": created,
        "skipped": skipped,
        "errors": errors[:10]  # Limit error messages
    }

@router.get("/{tenant_code}/invitations")
async def list_invitations(
    tenant_code: str,
    invitation_status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """List invitations for a tenant"""
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    query = {"tenant_code": tenant_code}
    if invitation_status:
        query["status"] = invitation_status
    
    invitations = await master_db.invitations.find(query, {"_id": 0}).to_list(1000)
    
    logger.info(f"Listing invitations for tenant {tenant_code}: found {len(invitations)} invitations")
    
    return {"invitations": invitations}


@router.post("/{tenant_code}/invitations/{invitation_id}/resend")
async def resend_invitation(
    tenant_code: str,
    invitation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Resend an invitation email"""
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Find the invitation
    invitation = await master_db.invitations.find_one({
        "id": invitation_id,
        "tenant_code": tenant_code,
        "status": "pending"
    })
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or already processed"
        )
    
    # Get tenant name
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    tenant_name = tenant.get('name', tenant_code) if tenant else tenant_code
    
    # For admin invitations, sync email with current tenant contact person
    role = invitation.get('role', 'student')
    to_email = invitation.get('email')
    if role == 'admin' and tenant:
        current_contact_email = tenant.get('contact_person_email', '').lower()
        current_contact_name = tenant.get('contact_person_name', '')
        if current_contact_email and current_contact_email != to_email:
            # Update the invitation to match current contact person
            to_email = current_contact_email
            first_name = current_contact_name.split()[0] if current_contact_name else invitation.get('first_name', '')
            last_name = " ".join(current_contact_name.split()[1:]) if len(current_contact_name.split()) > 1 else invitation.get('last_name', '')
            await master_db.invitations.update_one(
                {"id": str(invitation_id)},
                {"$set": {"email": to_email, "first_name": first_name, "last_name": last_name}}
            )
            invitation['email'] = to_email
            invitation['first_name'] = first_name
            invitation['last_name'] = last_name
            logger.info(f"Synced admin invitation email to current contact: {to_email} for tenant {tenant_code}")

    # Resend email
    inviter_name = f"{current_user.first_name} {current_user.last_name}".strip() or "Administrator"

    # Generate invite_code if missing (for older invitations)
    invite_code = invitation.get("invite_code")
    if not invite_code:
        invite_code = _generate_invite_code(tenant_code)
        await master_db.invitations.update_one(
            {"id": str(invitation_id)},
            {"$set": {"invite_code": invite_code}},
        )

    # Get download links from tenant
    ios_app_link = tenant.get('ios_app_link') if tenant else None
    android_app_link = tenant.get('android_app_link') if tenant else None

    # Send email synchronously to catch errors and report actual status
    try:
        if role == 'admin':
            email_sent = await send_tenant_admin_invitation_email(
                to_email=to_email,
                tenant_name=tenant_name,
                tenant_code=tenant_code,
                invitation_token=invitation.get('token'),
                contact_person_name=f"{invitation.get('first_name', '')} {invitation.get('last_name', '')}".strip(),
                invite_code=invite_code,
                ios_app_link=ios_app_link,
                android_app_link=android_app_link,
            )
        else:
            email_sent = await send_invitation_email(
                to_email=to_email,
                tenant_name=tenant_name,
                invitation_token=invitation.get('token'),
                role=role,
                inviter_name=inviter_name,
                first_name=invitation.get('first_name'),
                invite_code=invite_code,
                ios_app_link=ios_app_link,
                android_app_link=android_app_link,
            )
        
        if email_sent:
            logger.info(f"Invitation resent to {to_email} for tenant {tenant_code}")
            return {"message": "Invitation resent successfully", "email": to_email, "email_sent": True}
        else:
            logger.error(f"Failed to resend invitation to {to_email} for tenant {tenant_code}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send invitation email. Please try again later."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email send error for {to_email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send invitation email. Please try again later."
        )


@router.delete("/{tenant_code}/invitations/{invitation_id}")
async def cancel_invitation(
    tenant_code: str,
    invitation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel a pending invitation"""
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    result = await master_db.invitations.delete_one({
        "id": invitation_id,
        "tenant_code": tenant_code,
        "status": "pending"
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or already processed"
        )
    
    return {"message": "Invitation cancelled"}

# ========== USER MANAGEMENT FOR TENANT ==========

@router.get("/{tenant_code}/users")
async def list_tenant_users(
    tenant_code: str,
    role: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """List users in a tenant"""
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    
    query = {}
    if role:
        query["role"] = role
    
    users = await tenant_db.users.find(
        query,
        {"_id": 0, "password": 0, "mfa_secret": 0, "mfa_backup_codes": 0}
    ).to_list(10000)
    
    return users

@router.post("/{tenant_code}/users/{user_id}/reset-mfa")
async def reset_user_mfa(
    tenant_code: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Reset MFA for a user (super admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can reset MFA"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    
    result = await tenant_db.users.update_one(
        {"id": str(user_id)},
        {"$set": {"mfa_enabled": False, "mfa_secret": None, "mfa_backup_codes": []}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "MFA reset successfully"}

@router.get("/{tenant_code}/stats")
async def get_tenant_stats(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Get statistics for a tenant"""
    if current_user.role != "super_admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    tenant_db = get_tenant_db(tenant_code)
    
    # User counts by role
    user_counts = {}
    for role in ['admin', 'ra', 'student']:
        count = await tenant_db.users.count_documents({"role": role})
        user_counts[role] = count
    
    total_users = sum(user_counts.values())
    
    # Pending invitations
    pending_invitations = await master_db.invitations.count_documents({
        "tenant_code": tenant_code,
        "status": "pending"
    })
    
    return {
        "tenant_code": tenant_code,
        "tenant_name": tenant['name'],
        "status": tenant['status'],
        "enabled_modules": tenant.get('enabled_modules', ALL_MODULES),
        "total_users": total_users,
        "users_by_role": user_counts,
        "pending_invitations": pending_invitations
    }

# ========== AVAILABLE MODULES ENDPOINT ==========

@router.get("/modules/all")
async def list_all_modules():
    """List all available modules"""
    return {"modules": ALL_MODULES}
