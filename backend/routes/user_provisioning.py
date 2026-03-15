"""User provisioning routes - CSV upload and API sync - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header, status
from typing import Optional
import csv
import io
import hmac
from datetime import datetime, timezone

from models import (
    User, BulkUserImportResult,
    BulkSyncRequest, BulkSyncResult
)
from utils.auth import hash_password
from utils.multi_tenant import master_db, get_tenant_db
from utils.tenant import TenantContext, require_role
from utils.email_service import send_student_invite_email, is_email_enabled
from datetime import timedelta
import uuid
import secrets

router = APIRouter(prefix="/user-provisioning", tags=["user-provisioning"])

# Allowed roles for user creation
ALLOWED_ROLES = ["student", "ra", "admin"]

async def validate_user_data(
    user_data: dict,
    tenant_id: str,
    tenant_domain: str,
    tenant_db  # Pass tenant db explicitly
) -> tuple[bool, Optional[str]]:
    """
    Validate user data before import.
    Returns (is_valid, error_message)
    """
    # Validate email format
    email = user_data.get("email", "").lower().strip()
    if not email:
        return False, "Email is required"
    
    # Students must use college domain
    role = user_data.get("role", "student")
    if role == "student" and not email.endswith(f"@{tenant_domain}"):
        return False, f"Students must use @{tenant_domain} email"
    
    # Check if email already exists in tenant
    existing = await tenant_db.users.find_one({
        "email": email,
        "tenant_id": tenant_id
    })
    if existing:
        return False, f"Email already registered: {email}"
    
    # Validate role
    if role not in ALLOWED_ROLES:
        return False, f"Invalid role: {role}. Must be one of: {ALLOWED_ROLES}"
    
    return True, None


@router.post("/csv-upload", response_model=BulkUserImportResult)
async def upload_users_csv(
    file: UploadFile = File(...),
    send_welcome_emails: bool = False,
    ctx: TenantContext = Depends(require_role("admin", "super_admin"))
):
    """
    Upload CSV file to bulk create users.
    
    CSV Format:
    first_name,last_name,email,role,floor,phone,student_id,year,birthday
    
    Only admins and super_admins can upload.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    # Get tenant database
    tenant_db = get_tenant_db(ctx.tenant_id)
    
    # Get tenant info from master database
    tenant = await master_db.tenants.find_one({"tenant_id": str(ctx).tenant_id})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    tenant_domain = tenant["domain"]
    
    # Read CSV
    contents = await file.read()
    csv_data = contents.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_data))
    
    success_count = 0
    error_count = 0
    errors = []
    created_users = []

    # Fetch tenant branding for invite emails
    tenant_branding = tenant.get('branding', {}) if tenant else {}
    primary_color = tenant_branding.get('primary_color') or tenant.get('primary_color', '#0f172a') if tenant else '#0f172a'
    tenant_display_name = tenant.get('name', ctx.tenant_id) if tenant else ctx.tenant_id

    for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (1 is header)
        try:
            # Sanitize CSV values to prevent formula injection
            from utils.file_validation import sanitize_csv_value
            
            # Clean and validate data - sanitize all inputs
            user_data = {
                "first_name": sanitize_csv_value(row.get("first_name", "").strip()),
                "last_name": sanitize_csv_value(row.get("last_name", "").strip()),
                "email": row.get("email", "").lower().strip(),  # Email doesn't need formula sanitization
                "role": row.get("role", "student").lower().strip(),
                "floor": sanitize_csv_value(row.get("floor", "").strip()) or None,
                "phone": sanitize_csv_value(row.get("phone", "").strip()) or None,
                "student_id": sanitize_csv_value(row.get("student_id", "").strip()) or None,
                "birthday": sanitize_csv_value(row.get("birthday", "").strip()) or None,  # Format: DD-Mon (e.g., 15-Jan)
            }
            
            # Validate required fields
            if not user_data["first_name"]:
                errors.append({"row": row_num, "email": user_data["email"], "error": "first_name is required"})
                error_count += 1
                continue
            if not user_data["last_name"]:
                errors.append({"row": row_num, "email": user_data["email"], "error": "last_name is required"})
                error_count += 1
                continue
            if not user_data["floor"]:
                errors.append({"row": row_num, "email": user_data["email"], "error": "floor is required"})
                error_count += 1
                continue
            
            # Validate
            is_valid, error_msg = await validate_user_data(
                user_data, 
                ctx.tenant_id,
                tenant_domain,
                tenant_db
            )
            
            if not is_valid:
                errors.append({
                    "row": row_num,
                    "email": user_data["email"],
                    "error": error_msg
                })
                error_count += 1
                continue
            
            # Create user
            user = User(
                tenant_id=ctx.tenant_id,
                email=user_data["email"],
                first_name=user_data["first_name"],
                last_name=user_data["last_name"],
                role=user_data["role"],
                floor=user_data["floor"],
                phone=user_data["phone"],
                student_id=user_data["student_id"],
                birthday=user_data["birthday"]
            )
            
            # Use setup-token flow — no default password stored or transmitted
            setup_token = secrets.token_urlsafe(32)
            token_expiry = datetime.now(timezone.utc) + timedelta(days=7)

            user_doc = user.model_dump()
            user_doc['created_at'] = user_doc['created_at'].isoformat()
            user_doc['password'] = None
            user_doc['pending_setup'] = True
            user_doc['active'] = False
            user_doc['setup_token'] = setup_token
            user_doc['setup_token_expires'] = token_expiry.isoformat()

            await tenant_db.users.insert_one(user_doc)

            success_count += 1
            created_users.append(user_data["email"])

            # Send invite email with setup link (no password in email)
            if send_welcome_emails and is_email_enabled():
                try:
                    await send_student_invite_email(
                        to_email=user_data["email"],
                        user_name=user_data["first_name"],
                        setup_token=setup_token,
                        floor=user_data.get("floor"),
                        room=None,
                        tenant_name=tenant_display_name,
                        primary_color=primary_color,
                    )
                except Exception:
                    # Log but don't fail the import if email fails
                    pass
            
        except Exception as e:
            errors.append({
                "row": row_num,
                "email": row.get("email", "unknown"),
                "error": str(e)
            })
            error_count += 1
    
    return BulkUserImportResult(
        success_count=success_count,
        error_count=error_count,
        errors=errors,
        created_users=created_users
    )


@router.get("/csv-template")
async def download_csv_template(
    ctx: TenantContext = Depends(require_role("admin", "super_admin"))
):
    """
    Download CSV template for user import.
    
    Required fields: first_name, last_name, email, role, floor
    Optional fields: phone, student_id, birthday (format: DD-Mon e.g., 15-Jan)
    """
    from fastapi.responses import Response
    
    template = """first_name,last_name,email,role,floor,phone,student_id,birthday
John,Doe,john.doe@college.edu,student,Floor 1,555-123-4567,STU001,15-Jan
Jane,Smith,jane.smith@college.edu,ra,Floor 2,555-234-5678,RA001,20-Mar
Bob,Wilson,bob.wilson@college.edu,student,Floor 1,,,08-Dec
Alice,Brown,alice.brown@college.edu,admin,Floor 3,555-345-6789,ADM001,
"""
    
    filename = f"{ctx.tenant_id}_user_import_template.csv"
    
    return Response(
        content=template,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.post("/api-sync", response_model=BulkSyncResult)
async def bulk_sync_users(
    sync_request: BulkSyncRequest,
    api_key: str = Header(..., alias="X-API-Key"),
    tenant_id: str = Header(..., alias="X-Tenant-ID")
):
    """
    Bulk sync users via API (for integration with college SIS).
    
    Requires API key authentication.
    Creates new users, updates existing ones, and deactivates removed ones.
    
    Headers:
    - X-API-Key: API key for authentication
    - X-Tenant-ID: Tenant identifier
    """
    # Verify API key from master database
    tenant = await master_db.tenants.find_one({"tenant_id": str(tenant_id)})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Verify tenant is active
    if tenant.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant is not active"
        )
    
    # Secure API key validation using constant-time comparison to prevent timing attacks
    stored_api_key = tenant.get("api_key")
    if not stored_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key not configured for this tenant"
        )
    
    # Use hmac.compare_digest for constant-time comparison (prevents timing attacks)
    if not hmac.compare_digest(api_key.encode('utf-8'), stored_api_key.encode('utf-8')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    # Get tenant database for data operations
    tenant_db = get_tenant_db(tenant_id)
    
    tenant_domain = tenant["domain"]
    created = 0
    updated = 0
    deactivated = 0
    errors = []
    
    # Get list of emails in sync request
    sync_emails = {user.email.lower() for user in sync_request.users}
    
    # Process each user in sync request
    for user_data in sync_request.users:
        try:
            email = user_data.email.lower()
            
            # Check if user exists
            existing_user = await tenant_db.users.find_one({
                "email": email,
                "tenant_id": tenant_id
            })
            
            if existing_user:
                # Update existing user
                update_data = {
                    "first_name": user_data.first_name,
                    "last_name": user_data.last_name,
                    "role": user_data.role,
                    "active": user_data.active
                }
                
                if user_data.floor:
                    update_data["floor"] = user_data.floor
                if user_data.phone:
                    update_data["phone"] = user_data.phone
                if user_data.student_id:
                    update_data["student_id"] = user_data.student_id
                if user_data.year:
                    update_data["year"] = user_data.year
                
                await tenant_db.users.update_one(
                    {"email": email, "tenant_id": str(tenant_id)},
                    {"$set": update_data}
                )
                updated += 1
            else:
                # Create new user
                # Validate first
                is_valid, error_msg = await validate_user_data(
                    {
                        "email": email,
                        "role": user_data.role
                    },
                    tenant_id,
                    tenant_domain,
                    tenant_db
                )
                
                if not is_valid:
                    errors.append({
                        "email": email,
                        "error": error_msg
                    })
                    continue
                
                # Create user with random password (they'll use SSO or reset)
                new_user = User(
                    tenant_id=tenant_id,
                    email=email,
                    first_name=user_data.first_name,
                    last_name=user_data.last_name,
                    role=user_data.role,
                    floor=user_data.floor,
                    phone=user_data.phone,
                    student_id=user_data.student_id,
                    year=user_data.year
                )
                
                user_doc = new_user.model_dump()
                user_doc['created_at'] = user_doc['created_at'].isoformat()
                user_doc['password'] = hash_password(str(uuid.uuid4()))  # Random password
                user_doc['active'] = user_data.active
                user_doc['synced_from_api'] = True
                
                await tenant_db.users.insert_one(user_doc)
                created += 1
                
        except Exception as e:
            errors.append({
                "email": user_data.email,
                "error": str(e)
            })
    
    # Deactivate users not in sync request (removed from college system)
    deactivate_result = await tenant_db.users.update_many(
        {
            "tenant_id": tenant_id,
            "email": {"$nin": list(sync_emails)},
            "synced_from_api": True,
            "active": True
        },
        {"$set": {"active": False}}
    )
    deactivated = deactivate_result.modified_count
    
    return BulkSyncResult(
        created=created,
        updated=updated,
        deactivated=deactivated,
        errors=errors
    )


@router.post("/generate-api-key")
async def generate_api_key(
    ctx: TenantContext = Depends(require_role("admin", "super_admin"))
):
    """
    Generate a new API key for the tenant (for API sync integration).
    Only admins can generate keys.
    """
    # Generate secure API key
    api_key = f"qdk_{ctx.tenant_id}_{uuid.uuid4().hex}"
    
    # Store API key in master tenant database
    await master_db.tenants.update_one(
        {"tenant_id": str(ctx).tenant_id},
        {
            "$set": {
                "api_key": api_key,
                "api_key_created_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "api_key": api_key,
        "message": "Store this key securely. It won't be shown again.",
        "usage": {
            "endpoint": "/api/user-provisioning/api-sync",
            "headers": {
                "X-API-Key": api_key,
                "X-Tenant-ID": ctx.tenant_id,
                "Content-Type": "application/json"
            }
        }
    }


@router.delete("/revoke-api-key")
async def revoke_api_key(
    ctx: TenantContext = Depends(require_role("admin", "super_admin"))
):
    """
    Revoke the current API key for the tenant.
    """
    await master_db.tenants.update_one(
        {"tenant_id": str(ctx).tenant_id},
        {
            "$unset": {"api_key": ""},
            "$set": {"api_key_revoked_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "API key revoked"}
