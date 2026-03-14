"""Authentication routes with httpOnly cookie support (OWASP A02 compliance)"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
import bleach

def sanitize_html(text, max_length=10000):
    if not text:
        return ""
    text = str(text)[:max_length]
    return bleach.clean(text, tags=[], strip=True)
import logging
import os
import jwt
import httpx

from models import User, UserCreate, UserUpdate, UserLogin, StudyStreak, ALL_MODULES
from utils.auth import (
    db, hash_password, verify_password, create_access_token, get_current_user,
    TOKEN_EXPIRE_MINUTES,
    JWT_SECRET, JWT_ALGORITHM
)
from utils.security import validate_password_strength
from utils.security_logger import log_security_event, SecurityEvent
from utils.ip_anomaly import record_login_ip, detect_anomalies
from utils.account_lockout import check_account_lockout, record_failed_login, clear_login_attempts
from utils.token_blacklist import (
    blacklist_token, generate_password_reset_token, store_password_reset_token,
    validate_password_reset_token, mark_reset_token_used
)
from utils.mfa import MFAService
from utils.email_service import send_password_reset_email, is_email_enabled
from utils.multi_tenant import master_db, get_tenant_db, generate_user_id

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
logger = logging.getLogger(__name__)

# Cookie configuration (OWASP A02 - Secure token storage)
# For web deployment: Secure=True (HTTPS only), SameSite=None for cross-origin cookie support
COOKIE_SECURE = True  # Always use secure cookies for production web deployment
COOKIE_SAMESITE = "lax"  # SECURITY (OWASP A07): Prevents CSRF - cookies not sent on cross-origin POST/PUT/DELETE
COOKIE_HTTPONLY = True   # Prevents XSS access to token
COOKIE_MAX_AGE = TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds

# Frontend URL for password reset links
FRONTEND_URL = os.environ.get('FRONTEND_URL')


@router.post("/register")
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate):
    """Register a new user — validates password complexity and requires tenant code"""
    import re
    
    # SECURITY: Strong password complexity validation (PEN test requirement)
    password = user_data.password
    password_errors = []
    if len(password) < 12:
        password_errors.append("Password must be at least 12 characters")
    if not re.search(r'[A-Z]', password):
        password_errors.append("Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', password):
        password_errors.append("Password must contain at least one lowercase letter")
    if not re.search(r'[0-9]', password):
        password_errors.append("Password must contain at least one number")
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]', password):
        password_errors.append("Password must contain at least one special character")
    if re.search(r'(.)\1{2,}', password):
        password_errors.append("Password must not contain 3+ consecutive identical characters")
    
    common_passwords = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome', 'monkey', 'dragon']
    if password.lower() in common_passwords:
        password_errors.append("Password is too common")
    
    if password_errors:
        raise HTTPException(status_code=400, detail={
            "message": "Password does not meet complexity requirements",
            "requirements": {
                "min_length": 12,
                "uppercase": True,
                "lowercase": True,
                "numeric": True,
                "special_character": True,
                "no_repeated_chars": True,
                "not_common": True
            },
            "errors": password_errors
        })
    
    # SECURITY: Self-registration requires valid tenant code
    if not hasattr(user_data, 'tenant_code') or not user_data.tenant_code:
        raise HTTPException(
            status_code=403,
            detail="Self-registration requires a valid tenant registration code. Contact your administrator."
        )
    # Validate password strength
    validate_password_strength(user_data.password)
    
    # Check if password has been exposed in data breaches (OWASP A07)
    try:
        from utils.password_breach import validate_password_security
        is_valid, warning = await validate_password_security(user_data.password, strict_mode=False)
        if not is_valid:
            raise HTTPException(status_code=400, detail=warning or "Password has been compromised in data breaches. Please choose a different password.")
    except ImportError:
        pass  # Password breach check not available
    except Exception as e:
        logging.warning(f"Password breach check failed (non-blocking): {e}")
    
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        first_name=sanitize_html(user_data.first_name, 100),
        last_name=sanitize_html(user_data.last_name, 100),
        role=user_data.role,
        floor=sanitize_html(user_data.floor, 50) if user_data.floor else user_data.floor,
        year=user_data.year,
        student_id=sanitize_html(user_data.student_id, 50) if user_data.student_id else user_data.student_id,
        birthday=user_data.birthday
    )
    
    user_doc = user.model_dump()
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    user_doc['password'] = hash_password(user_data.password)
    
    await db.users.insert_one(user_doc)
    
    # Initialize study streak for student
    if user.role == 'student':
        streak = StudyStreak(student_id=user.id)
        streak_doc = streak.model_dump()
        streak_doc['updated_at'] = streak_doc['updated_at'].isoformat()
        await db.study_streaks.insert_one(streak_doc)
    
    access_token = create_access_token({"sub": user.id})
    
    # Create response with httpOnly cookie (OWASP A02 compliance)
    response = JSONResponse(content={
        "access_token": access_token,  # Still return token for backward compatibility / mobile apps
        "token_type": "bearer",
        "user": user.model_dump(mode='json')
    })
    
    # SECURITY: No cookie set — Bearer-only auth prevents CSRF (PEN test A.9.4)
    
    log_security_event(
        SecurityEvent.REGISTRATION,
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else "unknown"
    )
    
    return response


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin):
    """Login user with httpOnly cookie token storage (OWASP A02 compliance)
    
    Multi-tenant: Searches super_admins first, then all tenant databases.
    """
    ip_address = request.client.host if request.client else "unknown"
    email = credentials.email.lower()
    
    try:
        # Check if account is locked (database-backed lockout)
        is_locked, minutes_remaining = await check_account_lockout(db, email)
        if is_locked:
            log_security_event(
                SecurityEvent.LOGIN_FAILURE,
                user_email=email,
                ip_address=ip_address,
                details={"reason": "account_locked", "lockout_remaining_minutes": minutes_remaining},
                severity="WARNING"
            )
            raise HTTPException(
                status_code=429,
                detail=f"Account temporarily locked. Try again in {minutes_remaining} minutes."
            )
        
        user_doc = None
        tenant_code = None
        tenant_info = None
        
        # Multi-tenant login flow
        try:
            # 1. Check super_admins first
            user_doc = await master_db.super_admins.find_one({"email": email})
            
            # 2. If not super admin, find which tenant they belong to
            if not user_doc:
                # Get all active tenants
                tenants = await master_db.tenants.find({"status": "active"}).to_list(1000)
                
                for tenant in tenants:
                    try:
                        tenant_db = get_tenant_db(tenant['code'])
                        candidate = await tenant_db.users.find_one({"email": email})
                        if candidate:
                            candidate_pw = candidate.get('password', '')
                            if candidate_pw and verify_password(credentials.password, candidate_pw):
                                user_doc = candidate
                                tenant_code = tenant['code']
                                tenant_info = {
                                    "code": tenant['code'],
                                    "name": tenant['name'],
                                    "enabled_modules": tenant.get('enabled_modules', []),
                                    "branding": tenant.get('branding'),
                                    "logo_url": tenant.get('logo_url'),
                                }
                                break
                    except Exception as e:
                        logger.warning(f"Error checking tenant {tenant['code']}: {e}")
                        continue
            
            # 3. Fallback: Check old database for backwards compatibility
            if not user_doc:
                user_doc = await db.users.find_one({"email": email})
                
        except Exception as db_error:
            logger.error(f"Database error during login for {email}: {type(db_error).__name__}: {db_error}")
            raise HTTPException(
                status_code=503,
                detail="Database temporarily unavailable. Please try again later."
            )
        
        # Always perform password check to prevent timing attacks
        password_valid = False
        if user_doc:
            password_valid = verify_password(credentials.password, user_doc.get('password', ''))
        else:
            # Dummy check to prevent timing attacks - use a valid bcrypt hash
            verify_password(credentials.password, "$2b$12$paGxvBcoAy7MLmniCpjsX.sV60mvsTMrzwO4gjrfwkQqhckcsRMoa")
        
        if not user_doc or not password_valid:
            # Record failed login IP for anomaly detection
            await record_login_ip(
                user_id=user_doc.get("id", "") if user_doc else "",
                email=email,
                ip_address=ip_address,
                tenant_code=tenant_code,
                user_agent=request.headers.get("user-agent"),
                success=False,
            )
            # Record failed attempt
            attempt_count = await record_failed_login(db, email)
            
            log_security_event(
                SecurityEvent.LOGIN_FAILURE,
                user_email=email,
                ip_address=ip_address,
                details={"reason": "invalid_credentials", "attempt_number": attempt_count},
                severity="WARNING" if attempt_count >= 3 else "INFO"
            )
            
            # Generic error - same for wrong email OR wrong password
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Check if account is active
        if not user_doc.get('active', True):
            log_security_event(
                SecurityEvent.LOGIN_FAILURE,
                user_email=email,
                ip_address=ip_address,
                details={"reason": "account_deactivated"},
                severity="WARNING"
            )
            raise HTTPException(status_code=403, detail="Account is deactivated. Contact support.")
        
        # Check if tenant is active (for non-super-admin users)
        if tenant_code:
            tenant = await master_db.tenants.find_one({"code": tenant_code})
            if not tenant or tenant.get('status') != 'active':
                raise HTTPException(
                    status_code=403, 
                    detail="Your organization account is currently suspended. Contact support."
                )
        
        # Success - clear login attempts
        await clear_login_attempts(db, email)
        
        # Auto-fix: if user has pending_setup but can log in, they've completed setup
        if user_doc.get('pending_setup') or not user_doc.get('active', True):
            if tenant_code:
                fix_db = get_tenant_db(tenant_code)
            else:
                fix_db = db
            await fix_db.users.update_one(
                {"email": email},
                {"$set": {"pending_setup": False, "active": True}}
            )
            user_doc['pending_setup'] = False
            user_doc['active'] = True
        
        if isinstance(user_doc.get('created_at'), str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        user = User(**{k: v for k, v in user_doc.items() if k != 'password' and k != '_id'})
        
        # Check MFA requirements for privileged users (OWASP A07)
        is_privileged = user.role in ['admin', 'ra', 'super_admin', 'superadmin']
        mfa_enabled = user_doc.get('mfa_enabled', False)
        
        # Auto-migrate: if MFA was set up in global DB but not tenant DB, copy it over
        if not mfa_enabled and tenant_code:
            global_user = await db.users.find_one({"id": user.id}, {"_id": 0, "mfa_enabled": 1, "mfa_secret": 1, "mfa_backup_codes": 1})
            if global_user and global_user.get('mfa_enabled'):
                tenant_db_fix = get_tenant_db(tenant_code)
                await tenant_db_fix.users.update_one(
                    {"id": user.id},
                    {"$set": {
                        "mfa_enabled": True,
                        "mfa_secret": global_user.get("mfa_secret"),
                        "mfa_backup_codes": global_user.get("mfa_backup_codes", []),
                    }}
                )
                mfa_enabled = True
                logger.info(f"Migrated MFA data from global DB to tenant DB for user {email}")
        
        mfa_exempt = user_doc.get('mfa_exempt', False)
        mfa_required = is_privileged and not mfa_exempt  # MFA is mandatory for admin/RA users (unless exempt)
        
        # Create access token with tenant info
        token_data = {"sub": user.id}
        if tenant_code:
            token_data["tenant"] = tenant_code
        access_token = create_access_token(token_data)
        
        log_security_event(
            SecurityEvent.LOGIN_SUCCESS,
            user_id=user.id,
            user_email=email,
            ip_address=ip_address,
            details={"mfa_required": mfa_required, "mfa_enabled": mfa_enabled, "tenant": tenant_code}
        )
        
        # IP anomaly detection (non-blocking)
        try:
            user_agent = request.headers.get("user-agent")
            await detect_anomalies(user.id, email, ip_address, tenant_code, user_agent)
            await record_login_ip(user.id, email, ip_address, tenant_code, user_agent, success=True)
        except Exception as e:
            logger.warning(f"IP anomaly detection error (non-blocking): {e}")
        
        # Build response content
        response_content = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user.model_dump(mode='json'),
            "mfa_required": mfa_required,
            "mfa_enabled": mfa_enabled
        }
        
        # Add tenant info if user belongs to a tenant
        if tenant_info:
            response_content["tenant"] = tenant_info
        elif user.role == 'super_admin':
            response_content["tenant"] = {
                "code": None,
                "name": "Super Admin",
                "enabled_modules": ALL_MODULES
            }
        
        # If admin needs to set up MFA, indicate this in the response
        if mfa_required and not mfa_enabled:
            response_content["mfa_setup_required"] = True
            response_content["message"] = "MFA setup is required for admin accounts. Please set up MFA to continue."
        
        response = JSONResponse(content=response_content)

        # Set httpOnly cookie for fully-authenticated users only.
        # MFA-pending users are NOT given a cookie yet — they must complete MFA first,
        # at which point the MFA endpoint sets the cookie.
        # SameSite=Lax protects against CSRF on mutating methods (RFC 6265bis §8.8.2).
        if not mfa_required:
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=COOKIE_HTTPONLY,
                secure=COOKIE_SECURE,
                samesite=COOKIE_SAMESITE,
                max_age=COOKIE_MAX_AGE,
                path="/",
            )

        return response
    
    except HTTPException:
        # Re-raise HTTP exceptions (they're intentional)
        raise
    except Exception as e:
        # Log unexpected errors and return generic message
        logger.error(f"Login error for {email}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again later."
        )


class MFALoginRequest(BaseModel):
    """Request for MFA-verified login"""
    mfa_code: str
    backup_code: Optional[bool] = False


@router.post("/login/mfa")
@limiter.limit("10/minute")
async def login_with_mfa(
    request: Request,
    mfa_data: MFALoginRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Complete login with MFA verification (OWASP A07 compliance).
    
    This endpoint is called after initial login when MFA is enabled.
    The user must provide their MFA code to complete authentication.
    """
    ip_address = request.client.host if request.client else "unknown"
    tenant_code = getattr(current_user, 'tenant_code', None)
    mfa_db = get_tenant_db(tenant_code) if tenant_code else db
    mfa_service = MFAService(mfa_db)
    
    # Check if user has MFA enabled
    if not await mfa_service.is_mfa_enabled(current_user.id):
        return {"verified": True, "message": "MFA not enabled for this account"}
    
    # Verify MFA code
    verified = False
    if mfa_data.backup_code:
        verified = await mfa_service.verify_backup_code(current_user.id, mfa_data.mfa_code)
        if verified:
            log_security_event(
                SecurityEvent.MFA_BACKUP_USED,
                user_id=current_user.id,
                user_email=current_user.email,
                ip_address=ip_address
            )
    else:
        verified = await mfa_service.verify_mfa_code(current_user.id, mfa_data.mfa_code)
        if verified:
            log_security_event(
                SecurityEvent.MFA_VERIFICATION_SUCCESS,
                user_id=current_user.id,
                user_email=current_user.email,
                ip_address=ip_address
            )
    
    if not verified:
        log_security_event(
            SecurityEvent.MFA_VERIFICATION_FAILURE,
            user_id=current_user.id,
            user_email=current_user.email,
            ip_address=ip_address,
            severity="WARNING"
        )
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    # Issue a fresh access token now that MFA is confirmed
    new_token = create_access_token(data={
        "sub": current_user.id,
        "tenant": tenant_code,
        "role": current_user.role,
    })

    # Fetch tenant info for the response
    tenant_data = None
    if tenant_code:
        try:
            tenant_doc = await master_db.tenants.find_one({"code": tenant_code}, {"_id": 0})
            if tenant_doc:
                tenant_data = {
                    "code": tenant_doc.get("code"),
                    "name": tenant_doc.get("name"),
                    "logo_url": tenant_doc.get("logo_url"),
                    "primary_color": tenant_doc.get("primary_color"),
                    "secondary_color": tenant_doc.get("secondary_color"),
                    "enabled_modules": tenant_doc.get("enabled_modules", []),
                }
        except Exception:
            pass

    response = JSONResponse(content={
        "verified": True,
        "message": "MFA verification successful",
        "access_token": new_token,
        "token_type": "bearer",
        "user": current_user.model_dump(mode='json'),
        "tenant": tenant_data,
    })

    # Set httpOnly cookie — matches behaviour of non-MFA login path
    response.set_cookie(
        key="access_token",
        value=new_token,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )

    return response

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user, including tenant enabled_modules"""
    user_data = current_user.model_dump(mode='json')
    if current_user.role == 'super_admin':
        user_data['enabled_modules'] = ALL_MODULES
    else:
        tenant_code = current_user.tenant_code or ''
        # Handle old tokens / sessions where tenant_code was not embedded in the JWT.
        # Search tenant DBs to find which tenant this user belongs to, so they
        # still get the correct module list even with a legacy token.
        if not tenant_code:
            try:
                active_tenants = await master_db.tenants.find(
                    {"status": "active"}, {"_id": 0, "code": 1}
                ).to_list(100)
                for t in active_tenants:
                    try:
                        t_db = get_tenant_db(t['code'])
                        found = await t_db.users.find_one(
                            {"id": current_user.id}, {"_id": 0, "id": 1}
                        )
                        if found:
                            tenant_code = t['code']
                            break
                    except Exception:
                        continue
            except Exception as e:
                logger.warning(f"Tenant lookup fallback failed for user {current_user.id}: {e}")

        if tenant_code:
            tenant = await master_db.tenants.find_one(
                {"code": tenant_code}, {"_id": 0, "enabled_modules": 1}
            )
            user_data['enabled_modules'] = tenant.get('enabled_modules', ALL_MODULES) if tenant else ALL_MODULES
        else:
            user_data['enabled_modules'] = ALL_MODULES
    return user_data


@router.post("/refresh")
@limiter.limit("20/hour")
async def refresh_token(request: Request, current_user: User = Depends(get_current_user)):
    """Refresh access token - blacklists old token and issues a new one (OWASP A07 compliance)"""
    ip_address = request.client.host if request.client else "unknown"
    
    # Get the old token
    old_token = None
    access_token_cookie = request.cookies.get("access_token")
    if access_token_cookie:
        old_token = access_token_cookie
    else:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            old_token = auth_header[7:]
    
    # Blacklist the old token
    if old_token:
        try:
            payload = jwt.decode(old_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            expiry = datetime.fromtimestamp(payload.get("exp", 0), tz=timezone.utc)
            await blacklist_token(db, old_token, current_user.id, expiry)
        except jwt.InvalidTokenError:
            pass
    
    # Issue new token
    tenant_code = getattr(current_user, 'tenant_code', None)
    new_token = create_access_token({"sub": current_user.id, "tenant": tenant_code})
    
    log_security_event(
        SecurityEvent.TOKEN_REFRESH,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=ip_address
    )
    
    response = JSONResponse(content={
        "access_token": new_token,
        "token_type": "bearer"
    })
    
    response.set_cookie(
        key="access_token",
        value=new_token,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
    
    return response


class ClientSecurityEvent(BaseModel):
    event: str
    timestamp: str
    email: Optional[str] = None
    reason: Optional[str] = None
    endpoint: Optional[str] = None
    statusCode: Optional[int] = None
    detail: Optional[str] = None

class ClientSecurityBatch(BaseModel):
    events: List[ClientSecurityEvent]

@router.post("/security-events")
@limiter.limit("30/minute")
async def report_security_events(
    batch: ClientSecurityBatch,
    request: Request,
):
    """Receive client-side security events for monitoring (OWASP A09 compliance)."""
    ip_address = request.client.host if request.client else "unknown"
    
    for event in batch.events[:20]:  # Limit to 20 events per batch
        log_security_event(
            SecurityEvent.SUSPICIOUS_ACTIVITY,
            user_id=None,
            user_email=event.email,
            ip_address=ip_address,
            details={
                "source": "client",
                "event_type": event.event,
                "client_timestamp": event.timestamp,
                "reason": event.reason,
                "endpoint": event.endpoint,
                "detail": event.detail,
            }
        )
    
    return {"received": len(batch.events)}




@router.post("/logout")
async def logout(request: Request, current_user: User = Depends(get_current_user)):
    """Logout user, blacklist token, and clear httpOnly cookie (OWASP A02, A04 compliance)"""
    ip_address = request.client.host if request.client else "unknown"
    
    # Get the token to blacklist it
    token = None
    access_token_cookie = request.cookies.get("access_token")
    if access_token_cookie:
        token = access_token_cookie
    else:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    # Blacklist the token if found
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            expiry = datetime.fromtimestamp(payload.get("exp", 0), tz=timezone.utc)
            await blacklist_token(db, token, current_user.id, expiry)
        except jwt.InvalidTokenError:
            pass  # Token already invalid, no need to blacklist
    
    log_security_event(
        SecurityEvent.LOGOUT,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=ip_address
    )
    
    response = JSONResponse(content={"message": "Logged out successfully"})
    
    # Clear the httpOnly cookie
    response.delete_cookie(
        key="access_token",
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE
    )
    
    return response


@router.patch("/me")
async def update_me(updates: UserUpdate, current_user: User = Depends(get_current_user)):
    """Update current user profile with XSS sanitization"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    # Sanitize all string fields to prevent stored XSS
    text_fields = ["first_name", "last_name", "floor", "student_id", "birthday", "photo_url"]
    for field in text_fields:
        if field in update_data and isinstance(update_data[field], str):
            update_data[field] = sanitize_html(update_data[field], 200)
    if update_data:
        if current_user.tenant_code:
            target_db = get_tenant_db(current_user.tenant_code)
        else:
            target_db = db
        await target_db.users.update_one({"id": current_user.id}, {"$set": update_data})
    return {"message": "Profile updated"}


@router.post("/change-password")
async def change_password(
    password_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Change user password"""
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Both current and new password are required")
    
    # Get user from database with password
    user_doc = await db.users.find_one({"id": current_user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(current_password, user_doc['password']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password strength
    validate_password_strength(new_password)
    
    # Hash and update new password
    hashed_password = hash_password(new_password)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"password": hashed_password}}
    )
    
    return {"message": "Password changed successfully"}


@router.post("/request-email-change")
async def request_email_change(
    request: Request,
    email_data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Step 1: Request email change. Validates password, sends a 6-digit
    verification code to the NEW email address.
    """
    import re
    import random
    import string

    new_email = email_data.get("new_email", "").lower().strip()
    current_password = email_data.get("current_password", "")

    if not new_email or not current_password:
        raise HTTPException(status_code=400, detail="New email and current password are required")

    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, new_email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    is_super_admin = current_user.role == 'super_admin'
    user_doc = (
        await master_db.super_admins.find_one({"id": current_user.id})
        if is_super_admin
        else await db.users.find_one({"id": current_user.id})
    )
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(current_password, user_doc['password']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if new_email == current_user.email.lower():
        raise HTTPException(status_code=400, detail="New email is the same as current email")

    # Check uniqueness across all tenant DBs and super_admins
    existing_user = await db.users.find_one({"email": new_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email address is already in use")
    existing_super = await master_db.super_admins.find_one({"email": new_email})
    if existing_super:
        raise HTTPException(status_code=400, detail="Email address is already in use")

    # Also check across all tenant databases
    tenants = await master_db.tenants.find({"status": "active"}).to_list(1000)
    for tenant in tenants:
        try:
            tenant_db = get_tenant_db(tenant['code'])
            if await tenant_db.users.find_one({"email": new_email}):
                raise HTTPException(status_code=400, detail="Email address is already in use")
        except HTTPException:
            raise
        except Exception:
            continue

    # Generate 6-digit verification code
    code = ''.join(random.choices(string.digits, k=6))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Store the pending change in DB
    await db.email_change_requests.delete_many({"user_id": current_user.id})
    await db.email_change_requests.insert_one({
        "user_id": current_user.id,
        "old_email": current_user.email,
        "new_email": new_email,
        "code": code,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_super_admin": is_super_admin,
    })

    # Send verification email to the NEW address
    if is_email_enabled():
        try:
            from utils.email_service import send_email as send_email_svc
            await send_email_svc(
                to_email=new_email,
                subject="Verify Your New Email Address - Quadley",
                html_content=f"""
                <!DOCTYPE html>
                <html>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1f2937; margin-bottom: 5px;">Quadley</h1>
                    </div>
                    <div style="background: #f9fafb; padding: 25px; border-radius: 8px;">
                        <p>Hi,</p>
                        <p>A request was made to change the email address on a Quadley account to this address.</p>
                        <p>Your verification code is:</p>
                        <div style="text-align: center; margin: 25px 0;">
                            <div style="background: #0f172a; color: white; display: inline-block; padding: 14px 32px; border-radius: 10px; font-family: 'Courier New', monospace; font-size: 28px; font-weight: bold; letter-spacing: 6px;">
                                {code}
                            </div>
                        </div>
                        <p style="color: #6b7280; font-size: 14px; text-align: center;">This code expires in 15 minutes.</p>
                        <p style="color: #6b7280; font-size: 14px;">If you did not request this change, you can safely ignore this email.</p>
                    </div>
                </body>
                </html>
                """,
            )
        except Exception as e:
            logger.warning(f"Failed to send email verification: {e}")

    logger.info(f"Email change requested for user {current_user.id}: -> {new_email}")
    return {"message": "Verification code sent to new email address", "email_sent_to": new_email}


@router.post("/verify-email-change")
async def verify_email_change(
    request: Request,
    verify_data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Step 2: Verify the 6-digit code and complete the email change.
    """
    code = verify_data.get("code", "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Verification code is required")

    pending = await db.email_change_requests.find_one(
        {"user_id": current_user.id},
        {"_id": 0}
    )
    if not pending:
        raise HTTPException(status_code=400, detail="No pending email change request found. Please start over.")

    # Check expiry
    expires_at = datetime.fromisoformat(pending['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        await db.email_change_requests.delete_many({"user_id": current_user.id})
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    if pending['code'] != code:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    new_email = pending['new_email']
    old_email = pending['old_email']
    is_super_admin = pending.get('is_super_admin', False)

    update_data = {
        "email": new_email,
        "email_changed_at": datetime.now(timezone.utc).isoformat(),
        "previous_email": old_email,
    }

    if is_super_admin:
        await master_db.super_admins.update_one({"id": current_user.id}, {"$set": update_data})
    else:
        await db.users.update_one({"id": current_user.id}, {"$set": update_data})

    # Also update across tenant databases if applicable
    if current_user.tenant_code:
        try:
            tenant_db = get_tenant_db(current_user.tenant_code)
            await tenant_db.users.update_one({"id": current_user.id}, {"$set": update_data})
        except Exception as e:
            logger.warning(f"Failed to update email in tenant DB: {e}")

    # Clean up the request
    await db.email_change_requests.delete_many({"user_id": current_user.id})

    logger.info(f"Email changed for user {current_user.id}: {old_email} -> {new_email}")

    # Notify old email
    if is_email_enabled():
        try:
            from utils.email_service import send_email as send_email_svc
            await send_email_svc(
                to_email=old_email,
                subject="Email Address Changed - Quadley",
                html_content=f"""
                <h2>Email Address Changed</h2>
                <p>Your email address on Quadley has been changed to: <strong>{new_email}</strong></p>
                <p>If you did not make this change, please contact your administrator immediately.</p>
                """,
            )
        except Exception as e:
            logger.warning(f"Failed to send email change notification: {e}")

    return {"message": "Email changed successfully", "new_email": new_email}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, request_data: dict):
    """
    Send password reset link to user's email (OWASP A04 compliance).
    Rate limited to prevent abuse.
    """
    email = request_data.get("email")
    ip_address = request.client.host if request.client else "unknown"
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    email = email.lower().strip()
    
    # Always return same message to prevent email enumeration
    response_message = "If an account exists with this email, a password reset link has been sent."

    # Find user across all tenant DBs and master DB
    user, user_db, tenant_code = await _find_user_by_email(email)
    
    if user:
        # Generate reset token — store in the user's actual DB
        reset_token = generate_password_reset_token(email)
        await store_password_reset_token(user_db, email, reset_token)
        
        # Log the password reset request
        log_security_event(
            SecurityEvent.PASSWORD_RESET_REQUEST,
            user_id=user.get("id"),
            user_email=email,
            ip_address=ip_address
        )
        
        # SECURITY: Never log password reset tokens/links
        logger.info(f"Password reset requested for user_id={user.get('id')}")
        
        # Send password reset email
        email_result = await send_password_reset_email(
            to_email=email,
            reset_token=reset_token,
            user_name=user.get("first_name")
        )
        
        if not email_result.get("success") and not email_result.get("simulated"):
            logger.error(f"Failed to send password reset email: {email_result.get('error')}")
    
    return {"message": response_message}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, request_data: dict):
    """
    Reset password using a valid reset token (OWASP A04 compliance).
    """
    token = request_data.get("token")
    new_password = request_data.get("new_password")
    ip_address = request.client.host if request.client else "unknown"
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required")
    
    # Find user and their DB first (needed to validate token from their DB)
    # We try all DBs since we don't know which one holds the token
    email = await validate_password_reset_token(db, token)
    user_db = db
    if not email:
        # Try master DB (super_admins)
        email = await validate_password_reset_token(master_db, token)
        if email:
            user_db = master_db
        else:
            # Try all active tenant DBs
            try:
                tenants = await master_db.tenants.find({"status": "active"}).to_list(1000)
                for tenant in tenants:
                    try:
                        t_db = get_tenant_db(tenant["code"])
                        email = await validate_password_reset_token(t_db, token)
                        if email:
                            user_db = t_db
                            break
                    except Exception:
                        continue
            except Exception:
                pass

    if not email:
        log_security_event(
            SecurityEvent.PASSWORD_RESET_REQUEST,
            ip_address=ip_address,
            details={"reason": "invalid_or_expired_token"},
            severity="WARNING"
        )
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Get user from the correct DB
    user = await user_db.users.find_one({"email": email}) if user_db != master_db else await master_db.super_admins.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    # Validate new password strength
    validate_password_strength(new_password, email)
    
    # Hash and update password in the correct DB
    hashed_password = hash_password(new_password)
    if user_db == master_db:
        await master_db.super_admins.update_one({"email": email}, {"$set": {"password": hashed_password}})
    else:
        await user_db.users.update_one({"email": email}, {"$set": {"password": hashed_password}})
    
    # Mark token as used in the correct DB
    await mark_reset_token_used(user_db, token)
    
    # Log successful password reset
    log_security_event(
        SecurityEvent.PASSWORD_RESET_COMPLETE,
        user_id=user.get("id"),
        user_email=email,
        ip_address=ip_address
    )
    
    return {"message": "Password has been reset successfully. Please login with your new password."}


@router.get("/validate-reset-token")
async def validate_reset_token(token: str):
    """Check if a password reset token is valid (for frontend validation)"""
    email = await validate_password_reset_token(db, token)
    
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Return masked email for user confirmation
    parts = email.split("@")
    masked_email = f"{parts[0][:2]}***@{parts[1]}" if len(parts) == 2 else "***"
    
    return {"valid": True, "email": masked_email}


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Activate or deactivate a user. Only admins and super_admins can do this."""
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find the target user
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deactivating yourself
    if target_user["id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")
    
    # Prevent deactivating super_admins unless you're a super_admin
    if target_user.get("role") == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify super admin status")
    
    active = status_data.get("active", True)
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"active": active}}
    )
    
    action = "activated" if active else "deactivated"
    logger.info(f"User {user_id} {action} by {current_user.id}")
    
    return {"message": f"User {action} successfully", "active": active}


async def _find_user_by_email(email: str):
    """
    Search for a user by email across the shared DB, all tenant DBs, and super_admins.
    Returns (user_doc, target_db, tenant_code) or (None, None, None) if not found.
    """
    # Check super_admins first
    user = await master_db.super_admins.find_one({"email": email}, {"_id": 0})
    if user:
        return user, master_db, None

    # Check shared/default DB
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        return user, db, user.get("tenant_code")

    # Search all active tenant databases
    try:
        tenants = await master_db.tenants.find({"status": "active"}).to_list(1000)
        for tenant in tenants:
            try:
                tenant_db = get_tenant_db(tenant["code"])
                user = await tenant_db.users.find_one({"email": email}, {"_id": 0})
                if user:
                    return user, tenant_db, tenant["code"]
            except Exception:
                continue
    except Exception:
        pass

    return None, None, None


async def _find_user_by_setup_token(token: str):
    """
    Search for a user with a given setup_token across the shared DB and all tenant DBs.
    Returns (user_doc, target_db) or (None, None) if not found.
    """
    # Check shared DB first (legacy / non-tenant users)
    user = await db.users.find_one({"setup_token": token}, {"_id": 0})
    if user:
        return user, db

    # Search all active tenant databases
    try:
        tenants = await master_db.tenants.find({"status": "active"}).to_list(1000)
        for tenant in tenants:
            try:
                tenant_db = get_tenant_db(tenant["code"])
                user = await tenant_db.users.find_one({"setup_token": token}, {"_id": 0})
                if user:
                    return user, tenant_db
            except Exception:
                continue
    except Exception:
        pass

    return None, None


@router.get("/validate-setup-token")
async def validate_setup_token(token: str):
    """Check if a setup token is valid (for frontend validation)"""
    user, _ = await _find_user_by_setup_token(token)

    if not user:
        raise HTTPException(status_code=400, detail="Invalid setup token")

    # Check expiry
    expiry = user.get("setup_token_expires")
    if expiry:
        expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry_dt:
            raise HTTPException(status_code=400, detail="Setup token has expired")

    return {
        "valid": True,
        "email": user.get("email"),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name")
    }


@router.post("/setup-password")
@limiter.limit("5/minute")
async def setup_password(request: Request, request_data: dict):
    """
    Set up password for a newly invited user.
    This is used when a user clicks the invite link from their email.
    """
    token = request_data.get("token")
    new_password = request_data.get("password")
    ip_address = request.client.host if request.client else "unknown"

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and password are required")

    # Find user by setup token across shared DB and all tenant DBs
    user, target_db = await _find_user_by_setup_token(token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid setup token")

    # Check expiry
    expiry = user.get("setup_token_expires")
    if expiry:
        expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry_dt:
            raise HTTPException(status_code=400, detail="Setup token has expired. Please contact your admin for a new invite.")

    # Validate password strength
    validate_password_strength(new_password, user.get("email"))

    # Hash password and activate account in the correct database
    hashed_password = hash_password(new_password)

    await target_db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password": hashed_password,
            "active": True,
            "pending_setup": False,
            "setup_completed_at": datetime.now(timezone.utc).isoformat()
        },
        "$unset": {
            "setup_token": "",
            "setup_token_expires": ""
        }}
    )
    
    log_security_event(
        SecurityEvent.REGISTRATION,
        user_id=user["id"],
        user_email=user["email"],
        ip_address=ip_address,
        details={"method": "invite_setup"}
    )
    
    # Notify the admin who invited this user
    invited_by = user.get("invited_by")
    if invited_by:
        try:
            import uuid
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": invited_by,
                "type": "student_setup_complete",
                "title": "Student Account Activated",
                "message": f"{user['first_name']} {user['last_name']} ({user['email']}) has completed their account setup.",
                "data": {
                    "student_id": user["id"],
                    "student_name": f"{user['first_name']} {user['last_name']}",
                    "student_email": user["email"]
                },
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await target_db.notifications.insert_one(notification)
        except Exception as e:
            logger.warning(f"Failed to create admin notification: {e}")
    
    return {"message": "Password set successfully. You can now log in."}



# ========== INVITATION-BASED REGISTRATION (Multi-Tenant) ==========

class InvitationVerifyRequest(BaseModel):
    """Request to verify an invitation token"""
    token: str

class InvitationRegisterRequest(BaseModel):
    """Request to complete registration via invitation"""
    token: str
    first_name: str
    last_name: str
    password: str

@router.post("/invitation/verify")
async def verify_invitation(data: InvitationVerifyRequest):
    """
    Verify an invitation token and return invitation details.
    Used by frontend to pre-populate the registration form.
    """
    invitation = await master_db.invitations.find_one({
        "token": data.token,
        "status": "pending"
    })
    
    if not invitation:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired invitation"
        )
    
    # Check expiration
    expires_at = invitation.get('expires_at')
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    
    if expires_at and datetime.now(timezone.utc) > expires_at:
        # Mark as expired
        await master_db.invitations.update_one(
            {"token": data.token},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(
            status_code=400,
            detail="This invitation has expired"
        )
    
    # Get tenant info
    tenant = await master_db.tenants.find_one({"code": invitation['tenant_code']})
    if not tenant or tenant['status'] != 'active':
        raise HTTPException(
            status_code=400,
            detail="The associated organization is no longer active"
        )
    
    return {
        "valid": True,
        "email": invitation['email'],
        "first_name": invitation.get('first_name'),
        "last_name": invitation.get('last_name'),
        "role": invitation['role'],
        "tenant_name": tenant['name'],
        "tenant_code": tenant['code']
    }

@router.post("/invitation/register")
@limiter.limit("5/minute")
async def register_via_invitation(request: Request, data: InvitationRegisterRequest):
    """
    Complete registration using an invitation token.
    Creates user in the tenant's database with a unique user ID.
    """
    ip_address = request.client.host if request.client else "unknown"
    
    # Validate password
    validate_password_strength(data.password)
    
    # Find and validate invitation
    invitation = await master_db.invitations.find_one({
        "token": data.token,
        "status": "pending"
    })
    
    if not invitation:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired invitation"
        )
    
    # Check expiration
    expires_at = invitation.get('expires_at')
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    
    if expires_at and datetime.now(timezone.utc) > expires_at:
        await master_db.invitations.update_one(
            {"token": data.token},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(
            status_code=400,
            detail="This invitation has expired"
        )
    
    tenant_code = invitation['tenant_code']
    
    # Get tenant and check status
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant or tenant['status'] != 'active':
        raise HTTPException(
            status_code=400,
            detail="The associated organization is no longer active"
        )
    
    # Get tenant database
    tenant_db = get_tenant_db(tenant_code)
    
    # Check if user already exists in tenant
    existing = await tenant_db.users.find_one({"email": invitation['email'].lower()})
    if existing:
        # Allow completing registration if user was pre-created during tenant setup
        # (has must_change_password flag or has no/empty password)
        has_password = existing.get('password') or existing.get('password_hash')
        must_change = existing.get('must_change_password', False)
        if has_password and not must_change:
            raise HTTPException(
                status_code=400,
                detail="User already registered"
            )
        
        # Update the existing user with password and registration details
        await tenant_db.users.update_one(
            {"email": invitation['email'].lower()},
            {"$set": {
                "password": hash_password(data.password),
                "first_name": data.first_name,
                "last_name": data.last_name,
                "active": True,
            }}
        )
        
        user_id = existing.get('user_id') or existing.get('id')
        
        # Mark invitation as accepted
        await master_db.invitations.update_one(
            {"token": data.token},
            {"$set": {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Create access token
        access_token = create_access_token({"sub": existing.get('id', user_id), "tenant": tenant_code})
        
        logger.info(f"User completed registration via invitation: {invitation['email']} in {tenant_code}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": existing.get('id', user_id),
                "user_id": user_id,
                "email": invitation['email'].lower(),
                "first_name": data.first_name,
                "last_name": data.last_name,
                "role": invitation['role'],
                "tenant_code": tenant_code,
                "tenant_name": tenant.get('name', tenant_code),
            }
        }
    
    # Generate unique user ID and update sequence
    next_seq = tenant.get('next_user_sequence', 1)
    user_id = generate_user_id(tenant_code, next_seq)
    
    # Create user in tenant database
    user = User(
        user_id=user_id,
        tenant_code=tenant_code,
        email=invitation['email'].lower(),
        first_name=data.first_name,
        last_name=data.last_name,
        role=invitation['role']
    )
    
    user_doc = user.model_dump()
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    user_doc['password'] = hash_password(data.password)
    user_doc['active'] = True
    
    await tenant_db.users.insert_one(user_doc)
    
    # Update tenant stats
    await master_db.tenants.update_one(
        {"code": tenant_code},
        {
            "$inc": {"user_count": 1, "next_user_sequence": 1}
        }
    )
    
    # Mark invitation as accepted
    await master_db.invitations.update_one(
        {"token": data.token},
        {
            "$set": {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create access token
    access_token = create_access_token({"sub": user.id, "tenant": tenant_code})
    
    log_security_event(
        SecurityEvent.REGISTRATION,
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        details={"tenant": tenant_code, "user_id": user_id, "via": "invitation"}
    )
    
    # Create response
    response = JSONResponse(content={
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.model_dump(mode='json'),
        "tenant": {
            "code": tenant['code'],
            "name": tenant['name'],
            "enabled_modules": tenant.get('enabled_modules', [])
        }
    })
    
    # Set httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/"
    )
    
    return response


# ========== INVITE CODE FLOW (Mobile App Onboarding) ==========

class InviteCodeVerifyRequest(BaseModel):
    """Request to verify an invite code"""
    invite_code: str

class InviteCodeRegisterRequest(BaseModel):
    """Request to register via invite code"""
    invite_code: str
    first_name: str
    last_name: str
    password: str


@router.post("/invite-code/verify")
@limiter.limit("10/minute")
async def verify_invite_code(request: Request, data: InviteCodeVerifyRequest):
    """
    Verify an invite code and return invitation + tenant details.
    Used by the mobile app to show branded registration screen.
    """
    code = data.invite_code.strip().upper()

    invitation = await master_db.invitations.find_one({
        "invite_code": code,
        "status": "pending",
    })

    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    # Check expiration
    expires_at = invitation.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)

    if expires_at and datetime.now(timezone.utc) > expires_at:
        await master_db.invitations.update_one(
            {"invite_code": code},
            {"$set": {"status": "expired"}},
        )
        raise HTTPException(status_code=400, detail="This invite code has expired")

    # Get tenant info + branding
    tenant = await master_db.tenants.find_one(
        {"code": invitation["tenant_code"]},
        {"_id": 0, "code": 1, "name": 1, "status": 1, "logo_url": 1,
         "primary_color": 1, "secondary_color": 1, "branding": 1},
    )
    if not tenant or tenant.get("status") != "active":
        raise HTTPException(status_code=400, detail="The associated organization is no longer active")

    branding = tenant.get("branding") or {}

    return {
        "valid": True,
        "email": invitation["email"],
        "first_name": invitation.get("first_name"),
        "last_name": invitation.get("last_name"),
        "role": invitation["role"],
        "tenant_code": tenant["code"],
        "tenant_name": tenant["name"],
        "tenant_logo": branding.get("logo_url") or tenant.get("logo_url"),
        "tenant_primary_color": branding.get("primary_color") or tenant.get("primary_color", "#3b82f6"),
    }


@router.post("/invite-code/register")
@limiter.limit("5/minute")
async def register_with_invite_code(request: Request, data: InviteCodeRegisterRequest):
    """
    Complete registration using an invite code from the mobile app.
    Creates user in the tenant's database with a unique user ID.
    """
    ip_address = request.client.host if request.client else "unknown"
    code = data.invite_code.strip().upper()

    validate_password_strength(data.password)

    invitation = await master_db.invitations.find_one({
        "invite_code": code,
        "status": "pending",
    })

    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invite code")

    # Check expiration
    expires_at = invitation.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)

    if expires_at and datetime.now(timezone.utc) > expires_at:
        await master_db.invitations.update_one(
            {"invite_code": code},
            {"$set": {"status": "expired"}},
        )
        raise HTTPException(status_code=400, detail="This invite code has expired")

    tenant_code = invitation["tenant_code"]

    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant or tenant.get("status") != "active":
        raise HTTPException(status_code=400, detail="The associated organization is no longer active")

    tenant_db = get_tenant_db(tenant_code)

    existing = await tenant_db.users.find_one({"email": invitation["email"].lower()})
    if existing:
        # Allow completing registration if user was pre-created during tenant setup
        has_password = existing.get('password') or existing.get('password_hash')
        must_change = existing.get('must_change_password', False)
        if has_password and not must_change:
            raise HTTPException(status_code=400, detail="User already registered")
        
        # Update the existing user with new password and registration details
        await tenant_db.users.update_one(
            {"email": invitation["email"].lower()},
            {"$set": {
                "password": hash_password(data.password),
                "first_name": data.first_name,
                "last_name": data.last_name,
                "active": True,
                "pending_setup": False,
                "must_change_password": False,
            }}
        )
        
        # Mark invitation as accepted
        await master_db.invitations.update_one(
            {"invite_code": code},
            {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}},
        )
        
        access_token = create_access_token({"sub": existing.get('id'), "tenant": tenant_code})
        
        log_security_event(
            SecurityEvent.REGISTRATION,
            user_id=existing.get('id'),
            user_email=invitation["email"].lower(),
            ip_address=ip_address,
            details={"tenant": tenant_code, "user_id": existing.get('user_id'), "via": "invite_code", "pre_existing": True},
        )
        
        logger.info(f"Pre-created user completed registration: {invitation['email']} in {tenant_code}")
        
        response = JSONResponse(content={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": existing.get('id'),
                "user_id": existing.get('user_id'),
                "email": invitation["email"].lower(),
                "first_name": data.first_name,
                "last_name": data.last_name,
                "role": invitation["role"],
                "tenant_code": tenant_code,
            },
            "tenant": {
                "code": tenant["code"],
                "name": tenant["name"],
                "enabled_modules": tenant.get("enabled_modules", []),
            },
        })
        
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=COOKIE_HTTPONLY,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=COOKIE_MAX_AGE,
            path="/",
        )
        
        return response

    next_seq = tenant.get("next_user_sequence", 1)
    user_id = generate_user_id(tenant_code, next_seq)

    user = User(
        user_id=user_id,
        tenant_code=tenant_code,
        email=invitation["email"].lower(),
        first_name=data.first_name,
        last_name=data.last_name,
        role=invitation["role"],
    )

    user_doc = user.model_dump()
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    user_doc["password"] = hash_password(data.password)
    user_doc["active"] = True
    user_doc["pending_setup"] = False

    await tenant_db.users.insert_one(user_doc)

    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$inc": {"user_count": 1, "next_user_sequence": 1}},
    )

    await master_db.invitations.update_one(
        {"invite_code": code},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}},
    )

    access_token = create_access_token({"sub": user.id, "tenant": tenant_code})

    log_security_event(
        SecurityEvent.REGISTRATION,
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        details={"tenant": tenant_code, "user_id": user_id, "via": "invite_code"},
    )

    response = JSONResponse(content={
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.model_dump(mode="json"),
        "tenant": {
            "code": tenant["code"],
            "name": tenant["name"],
            "enabled_modules": tenant.get("enabled_modules", []),
        },
    })

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )

    return response


# ---------------------------------------------------------------------------
# Social / OAuth Auth
# ---------------------------------------------------------------------------
_apple_jwks_cache: dict = {}
_apple_jwks_cached_at: float = 0.0

GOOGLE_WEB_CLIENT_ID = os.environ.get("GOOGLE_WEB_CLIENT_ID", "")

APPLE_TEAM_ID = os.environ.get("APPLE_TEAM_ID", "")

# Maps bundle ID → (key_id_env_var, private_key_env_var)
# These are used for server-to-server Apple API calls (e.g. token revocation).
# Identity token verification uses Apple's public JWKS and does NOT need the private key.
APPLE_BUNDLE_KEY_MAP = {
    "com.gracecollege.app": {
        "key_id": os.environ.get("APPLE_KEY_ID_GRACE", ""),
        "private_key": os.environ.get("APPLE_PRIVATE_KEY_GRACE", ""),
    },
    "com.quadley.app": {
        "key_id": os.environ.get("APPLE_KEY_ID_QUADLEY", ""),
        "private_key": os.environ.get("APPLE_PRIVATE_KEY_QUADLEY", ""),
    },
    "com.ormond.college.app": {
        "key_id": os.environ.get("APPLE_KEY_ID_QUADLEY", ""),
        "private_key": os.environ.get("APPLE_PRIVATE_KEY_QUADLEY", ""),
    },
    "com.murphyshark.app": {
        "key_id": os.environ.get("APPLE_KEY_ID_QUADLEY", ""),
        "private_key": os.environ.get("APPLE_PRIVATE_KEY_QUADLEY", ""),
    },
}

ALL_TENANT_BUNDLE_IDS = list(APPLE_BUNDLE_KEY_MAP.keys())


async def _verify_google_token(id_token_str: str) -> dict:
    """Verify a Google ID token and return the payload claims."""
    import asyncio
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    if not GOOGLE_WEB_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google Sign-In is not configured on this server")

    def _sync_verify():
        return google_id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            GOOGLE_WEB_CLIENT_ID,
        )

    try:
        return await asyncio.to_thread(_sync_verify)
    except Exception as e:
        logger.warning(f"Google token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired Google token")


async def _get_apple_public_keys() -> list:
    """Fetch Apple's JWKS (cached for 1 hour)."""
    import time
    global _apple_jwks_cache, _apple_jwks_cached_at
    if time.time() - _apple_jwks_cached_at < 3600 and _apple_jwks_cache:
        return _apple_jwks_cache.get("keys", [])
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get("https://appleid.apple.com/auth/keys")
        resp.raise_for_status()
        _apple_jwks_cache = resp.json()
        _apple_jwks_cached_at = time.time()
    return _apple_jwks_cache.get("keys", [])


async def _verify_apple_token(identity_token: str, bundle_id: str) -> dict:
    """Verify an Apple identity token and return the payload claims."""
    import jwt as pyjwt
    from jwt.algorithms import RSAAlgorithm

    try:
        header = pyjwt.get_unverified_header(identity_token)
        kid = header.get("kid")
        keys = await _get_apple_public_keys()
        for jwk in keys:
            if jwk.get("kid") == kid:
                public_key = RSAAlgorithm.from_jwk(jwk)
                payload = pyjwt.decode(
                    identity_token,
                    public_key,
                    algorithms=["RS256"],
                    audience=bundle_id,
                    issuer="https://appleid.apple.com",
                )
                return payload
        raise HTTPException(status_code=401, detail="Apple public key not found for this token")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Apple token has expired")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Apple token: {str(e)}")


async def _find_user_by_email_for_social(email: str):
    """Search all active tenant DBs for a user by email.
    Returns (user_doc, tenant_code, tenant_info) or (None, None, None)."""
    email = email.lower()

    super_admin = await master_db.super_admins.find_one({"email": email})
    if super_admin:
        return super_admin, None, {"code": None, "name": "Super Admin", "enabled_modules": ALL_MODULES}

    tenants = await master_db.tenants.find({"status": "active"}).to_list(1000)
    for tenant in tenants:
        try:
            t_db = get_tenant_db(tenant["code"])
            candidate = await t_db.users.find_one({"email": email})
            if candidate:
                tenant_info = {
                    "code": tenant["code"],
                    "name": tenant["name"],
                    "enabled_modules": tenant.get("enabled_modules", []),
                    "branding": tenant.get("branding"),
                    "logo_url": tenant.get("logo_url"),
                }
                return candidate, tenant["code"], tenant_info
        except Exception as e:
            logger.warning(f"Social auth tenant search error for {tenant['code']}: {e}")
            continue

    fallback = await db.users.find_one({"email": email})
    if fallback:
        return fallback, None, None

    return None, None, None


def _build_social_session_response(user_doc: dict, tenant_code: str, tenant_info: dict) -> JSONResponse:
    """Build a standard login JSONResponse for social auth flows."""
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

    user = User(**{k: v for k, v in user_doc.items() if k not in ("password", "_id")})
    token_data: dict = {"sub": user.id}
    if tenant_code:
        token_data["tenant"] = tenant_code
    access_token = create_access_token(token_data)

    resp_content: dict = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.model_dump(mode="json"),
        "mfa_required": False,
        "mfa_enabled": False,
    }
    if tenant_info:
        resp_content["tenant"] = tenant_info

    response = JSONResponse(content=resp_content)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
    return response


async def _complete_invite_registration_social(
    code: str,
    first_name: str,
    last_name: str,
    provider: str,
    social_id: str,
    ip_address: str,
) -> JSONResponse:
    """Shared logic for invite-code registration via Google or Apple."""
    invitation = await master_db.invitations.find_one({"invite_code": code, "status": "pending"})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invite code")

    expires_at = invitation.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and datetime.now(timezone.utc) > expires_at:
        await master_db.invitations.update_one(
            {"invite_code": code},
            {"$set": {"status": "expired"}},
        )
        raise HTTPException(status_code=400, detail="This invite code has expired")

    tenant_code = invitation["tenant_code"]
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant or tenant.get("status") != "active":
        raise HTTPException(status_code=400, detail="The associated organisation is no longer active")

    tenant_db = get_tenant_db(tenant_code)
    email = invitation["email"].lower()

    existing = await tenant_db.users.find_one({"email": email})
    if existing:
        has_password = existing.get("password") or existing.get("password_hash")
        must_change = existing.get("must_change_password", False)
        if has_password and not must_change and not existing.get("pending_setup"):
            raise HTTPException(status_code=400, detail="User already registered")

        await tenant_db.users.update_one(
            {"email": email},
            {"$set": {
                "first_name": first_name,
                "last_name": last_name,
                "active": True,
                "pending_setup": False,
                "must_change_password": False,
                "social_provider": provider,
                "social_id": social_id,
            }},
        )
        await master_db.invitations.update_one(
            {"invite_code": code},
            {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}},
        )

        access_token = create_access_token({"sub": existing.get("id"), "tenant": tenant_code})
        log_security_event(
            SecurityEvent.REGISTRATION,
            user_id=existing.get("id"),
            user_email=email,
            ip_address=ip_address,
            details={"tenant": tenant_code, "via": "invite_code", "provider": provider, "pre_existing": True},
        )

        response = JSONResponse(content={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": existing.get("id"),
                "user_id": existing.get("user_id"),
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "role": invitation["role"],
                "tenant_code": tenant_code,
            },
            "tenant": {
                "code": tenant["code"],
                "name": tenant["name"],
                "enabled_modules": tenant.get("enabled_modules", []),
            },
        })
        response.set_cookie(
            key="access_token", value=access_token,
            httponly=COOKIE_HTTPONLY, secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE, max_age=COOKIE_MAX_AGE, path="/",
        )
        return response

    next_seq = tenant.get("next_user_sequence", 1)
    user_id = generate_user_id(tenant_code, next_seq)

    user = User(
        user_id=user_id,
        tenant_code=tenant_code,
        email=email,
        first_name=first_name,
        last_name=last_name,
        role=invitation["role"],
    )
    user_doc = user.model_dump()
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    user_doc["active"] = True
    user_doc["pending_setup"] = False
    user_doc["social_provider"] = provider
    user_doc["social_id"] = social_id

    await tenant_db.users.insert_one(user_doc)
    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$inc": {"user_count": 1, "next_user_sequence": 1}},
    )
    await master_db.invitations.update_one(
        {"invite_code": code},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}},
    )

    access_token = create_access_token({"sub": user.id, "tenant": tenant_code})
    log_security_event(
        SecurityEvent.REGISTRATION,
        user_id=user.id,
        user_email=email,
        ip_address=ip_address,
        details={"tenant": tenant_code, "via": "invite_code", "provider": provider},
    )

    response = JSONResponse(content={
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.model_dump(mode="json"),
        "tenant": {
            "code": tenant["code"],
            "name": tenant["name"],
            "enabled_modules": tenant.get("enabled_modules", []),
        },
    })
    response.set_cookie(
        key="access_token", value=access_token,
        httponly=COOKIE_HTTPONLY, secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE, max_age=COOKIE_MAX_AGE, path="/",
    )
    return response


class SocialGoogleRequest(BaseModel):
    id_token: str


class SocialAppleRequest(BaseModel):
    identity_token: str
    bundle_id: str


class InviteCodeGoogleRequest(BaseModel):
    invite_code: str
    id_token: str
    first_name: str
    last_name: str


class InviteCodeAppleRequest(BaseModel):
    invite_code: str
    identity_token: str
    bundle_id: str
    first_name: str
    last_name: str


@router.post("/social/google")
@limiter.limit("10/minute")
async def social_login_google(request: Request, data: SocialGoogleRequest):
    """Sign in with an existing account using a Google ID token from the mobile app."""
    ip_address = request.client.host if request.client else "unknown"

    claims = await _verify_google_token(data.id_token)
    email = claims.get("email", "").lower()
    if not email or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    user_doc, tenant_code, tenant_info = await _find_user_by_email_for_social(email)
    if not user_doc:
        raise HTTPException(
            status_code=404,
            detail="No Quadley account found for this Google account. Please use your invite code to create an account first."
        )
    if not user_doc.get("active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact your administrator.")

    log_security_event(
        SecurityEvent.LOGIN_SUCCESS, user_id=user_doc.get("id"), user_email=email,
        ip_address=ip_address, details={"provider": "google", "tenant": tenant_code},
    )
    return _build_social_session_response(user_doc, tenant_code, tenant_info)


@router.post("/social/apple")
@limiter.limit("10/minute")
async def social_login_apple(request: Request, data: SocialAppleRequest):
    """Sign in with an existing account using an Apple identity token from the mobile app."""
    ip_address = request.client.host if request.client else "unknown"

    claims = await _verify_apple_token(data.identity_token, data.bundle_id)
    email = claims.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Could not retrieve email from Apple ID. Ensure email sharing is enabled.")

    user_doc, tenant_code, tenant_info = await _find_user_by_email_for_social(email)
    if not user_doc:
        raise HTTPException(
            status_code=404,
            detail="No Quadley account found for this Apple ID. Please use your invite code to create an account first."
        )
    if not user_doc.get("active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact your administrator.")

    log_security_event(
        SecurityEvent.LOGIN_SUCCESS, user_id=user_doc.get("id"), user_email=email,
        ip_address=ip_address, details={"provider": "apple", "tenant": tenant_code},
    )
    return _build_social_session_response(user_doc, tenant_code, tenant_info)


@router.post("/invite-code/register-google")
@limiter.limit("5/minute")
async def register_with_invite_code_google(request: Request, data: InviteCodeGoogleRequest):
    """Complete account setup using an invite code + Google ID token (no password needed)."""
    ip_address = request.client.host if request.client else "unknown"
    code = data.invite_code.strip().upper()

    claims = await _verify_google_token(data.id_token)
    google_email = claims.get("email", "").lower()
    if not google_email or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    invitation = await master_db.invitations.find_one({"invite_code": code, "status": "pending"})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invite code")

    if invitation["email"].lower() != google_email:
        raise HTTPException(
            status_code=400,
            detail=f"Your Google account ({google_email}) doesn't match the invited email ({invitation['email']}). Please sign in with the correct Google account."
        )

    return await _complete_invite_registration_social(
        code=code,
        first_name=data.first_name,
        last_name=data.last_name,
        provider="google",
        social_id=claims.get("sub", ""),
        ip_address=ip_address,
    )


@router.post("/invite-code/register-apple")
@limiter.limit("5/minute")
async def register_with_invite_code_apple(request: Request, data: InviteCodeAppleRequest):
    """Complete account setup using an invite code + Apple identity token (no password needed)."""
    ip_address = request.client.host if request.client else "unknown"
    code = data.invite_code.strip().upper()

    claims = await _verify_apple_token(data.identity_token, data.bundle_id)
    apple_email = claims.get("email", "").lower()
    if not apple_email:
        raise HTTPException(
            status_code=401,
            detail="Could not retrieve email from Apple ID. Please enable email sharing in your Apple ID settings."
        )

    invitation = await master_db.invitations.find_one({"invite_code": code, "status": "pending"})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invite code")

    if invitation["email"].lower() != apple_email:
        raise HTTPException(
            status_code=400,
            detail=f"Your Apple ID ({apple_email}) doesn't match the invited email ({invitation['email']}). Please sign in with the correct Apple ID."
        )

    return await _complete_invite_registration_social(
        code=code,
        first_name=data.first_name,
        last_name=data.last_name,
        provider="apple",
        social_id=claims.get("sub", ""),
        ip_address=ip_address,
    )


@router.get("/tenant/config")
async def get_tenant_config(current_user: User = Depends(get_current_user)):
    """
    Get the tenant configuration for the current user.
    Returns enabled modules and tenant info.
    """
    if current_user.role == "super_admin":
        # Super admin sees all modules
        from models import ALL_MODULES
        return {
            "tenant_code": None,
            "tenant_name": "Super Admin",
            "enabled_modules": ALL_MODULES,
            "is_super_admin": True
        }
    
    if not current_user.tenant_code:
        raise HTTPException(
            status_code=400,
            detail="User not associated with a tenant"
        )
    
    tenant = await master_db.tenants.find_one({"code": current_user.tenant_code})
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )
    
    return {
        "tenant_code": tenant['code'],
        "tenant_name": tenant['name'],
        "enabled_modules": tenant.get('enabled_modules', []),
        "logo_url": tenant.get('logo_url'),
        "is_super_admin": False
    }


@router.get("/public/tenant/{tenant_code}/branding")
async def get_public_tenant_branding(tenant_code: str):
    """
    Public endpoint — no auth required.
    Returns branding info for the login page of a specific tenant.
    """
    tenant = await master_db.tenants.find_one(
        {"code": tenant_code.upper(), "status": "active"},
        {"_id": 0, "code": 1, "name": 1, "branding": 1,
         "primary_color": 1, "secondary_color": 1, "logo_url": 1, "enabled_modules": 1}
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="College not found")

    branding = tenant.get("branding") or {}
    return {
        "tenant_code": tenant["code"],
        "tenant_name": tenant["name"].strip(),
        "primary_color": branding.get("primary_color") or tenant.get("primary_color", "#3b82f6"),
        "secondary_color": branding.get("secondary_color") or tenant.get("secondary_color", "#1f2937"),
        "background_color": branding.get("background_color", "#FFFFFF"),
        "logo_url": branding.get("logo_url") or tenant.get("logo_url"),
        "app_name": branding.get("app_name") or tenant["name"].strip(),
        "tagline": branding.get("tagline"),
        "login_welcome_text": branding.get("login_welcome_text"),
        "enabled_modules": tenant.get("enabled_modules", []),
    }




# ─── Account Deletion (Apple App Store compliance) ────────────────────────────

class DeleteAccountRequest(BaseModel):
    password: str


@router.delete("/users/me")
@limiter.limit("3/hour")
async def delete_my_account(
    request: Request,
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Self-service account deletion per Apple App Store Review Guideline 5.1.1(v).
    Requires password re-authentication before anonymising all personal data.
    Rate-limited to 3 attempts per hour.
    """
    tenant_code = current_user.tenant_code
    tenant_db = get_tenant_db(tenant_code)
    user_id = current_user.id

    # Re-authenticate: verify the supplied password matches the stored hash
    user_doc = await tenant_db.users.find_one({"id": user_id}, {"_id": 0, "password": 1})
    if not user_doc or not verify_password(body.password, user_doc.get("password", "")):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
    deleted_at = datetime.now(timezone.utc).isoformat()
    anon_email = f"deleted_{user_id}@deleted.invalid"

    # Anonymise user record — keep the document for referential integrity but
    # strip all personally-identifiable fields.
    await tenant_db.users.update_one(
        {"id": user_id},
        {"$set": {
            "email": anon_email,
            "first_name": "Deleted",
            "last_name": "User",
            "is_active": False,
            "account_deleted": True,
            "account_deleted_at": deleted_at,
            "phone": None,
            "bio": None,
            "profile_image": None,
            "student_id": None,
        }}
    )

    # Remove personal message content (keep structure for conversation continuity)
    await tenant_db.messages.update_many(
        {"sender_id": user_id},
        {"$set": {"content": "[Message deleted]", "removed": True, "file_url": None}}
    )

    # Delete push notification tokens
    await tenant_db.push_tokens.delete_many({"user_id": user_id})

    # Log deletion for compliance audit trail
    await tenant_db.audit_log.insert_one({
        "event": "account_self_deleted",
        "user_id": user_id,
        "tenant_code": tenant_code,
        "deleted_at": deleted_at,
        "ip": request.client.host if request.client else None,
    })

    logger.info(f"Account self-deleted: user_id={user_id} tenant={tenant_code} at={deleted_at}")

    # Expire the auth cookie
    response = JSONResponse(content={
        "message": "Your account has been permanently deleted.",
        "deleted_at": deleted_at,
    })
    response.delete_cookie("access_token")
    return response
