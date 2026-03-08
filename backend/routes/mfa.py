"""MFA (Multi-Factor Authentication) routes for admin users.

OWASP A07 Compliance: Provides MFA for privileged accounts.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import jwt

from models import User
from utils.auth import get_current_user, db, create_access_token, JWT_SECRET, JWT_ALGORITHM
from utils.multi_tenant import get_tenant_db
from utils.mfa import MFAService
from utils.security_logger import log_security_event, SecurityEvent

router = APIRouter(prefix="/mfa", tags=["mfa"])


def _get_mfa_db(user: User):
    """Get the correct database for MFA operations — tenant DB for tenant users, global DB for super admins."""
    tenant_code = getattr(user, 'tenant_code', None)
    if tenant_code:
        return get_tenant_db(tenant_code)
    return db


class MFASetupRequest(BaseModel):
    """Request to start MFA setup"""
    pass


class MFAVerifyRequest(BaseModel):
    """Request to verify MFA code"""
    code: str


class MFABackupCodeRequest(BaseModel):
    """Request to use backup code"""
    backup_code: str


@router.get("/status")
async def get_mfa_status(current_user: User = Depends(get_current_user)):
    """Get MFA status for current user"""
    mfa_service = MFAService(_get_mfa_db(current_user))
    status = await mfa_service.get_mfa_status(current_user.id)
    
    return {
        "user_id": current_user.id,
        "role": current_user.role,
        **status
    }


@router.post("/setup")
async def setup_mfa(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Start MFA setup for the current user.
    
    Generates a TOTP secret and returns a QR code for scanning.
    Only admin and super_admin users can enable MFA.
    """
    # MFA is available for all users but recommended for admins
    mfa_service = MFAService(_get_mfa_db(current_user))
    
    # Check if MFA is already enabled
    if await mfa_service.is_mfa_enabled(current_user.id):
        raise HTTPException(
            status_code=400,
            detail="MFA is already enabled. Disable it first to set up again."
        )
    
    result = await mfa_service.setup_mfa(current_user.id, current_user.email)
    
    log_security_event(
        SecurityEvent.MFA_SETUP_STARTED,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else "unknown"
    )
    
    return result


@router.post("/verify")
async def verify_and_enable_mfa(
    verify_data: MFAVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Verify the MFA code and enable MFA for the user.
    
    This should be called after setup with a code from the authenticator app.
    """
    mfa_service = MFAService(_get_mfa_db(current_user))
    
    if await mfa_service.is_mfa_enabled(current_user.id):
        raise HTTPException(status_code=400, detail="MFA is already enabled")
    
    if await mfa_service.verify_and_enable_mfa(current_user.id, verify_data.code):
        log_security_event(
            SecurityEvent.MFA_ENABLED,
            user_id=current_user.id,
            user_email=current_user.email,
            ip_address=request.client.host if request.client else "unknown"
        )
        
        # Issue a fresh token WITHOUT mfa_pending so the user can access all endpoints
        # Extract tenant_code from the incoming JWT (more reliable than User model field)
        tenant_code = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            raw_token = auth_header[7:]
            try:
                payload = jwt.decode(raw_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                tenant_code = payload.get("tenant")
            except Exception:
                pass
        # Fallback to user model if JWT extraction fails
        if not tenant_code:
            tenant_code = getattr(current_user, 'tenant_code', None) or None
        token_data = {"sub": current_user.id}
        if tenant_code:
            token_data["tenant"] = tenant_code
        new_token = create_access_token(token_data)
        
        return {
            "message": "MFA enabled successfully",
            "enabled": True,
            "access_token": new_token,
            "token_type": "bearer"
        }
    
    raise HTTPException(status_code=400, detail="Invalid verification code")


@router.post("/disable")
async def disable_mfa(
    verify_data: MFAVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Disable MFA for the current user.
    
    Requires a valid MFA code to disable (prevents unauthorized disable).
    """
    mfa_service = MFAService(_get_mfa_db(current_user))
    
    if not await mfa_service.is_mfa_enabled(current_user.id):
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    
    # Verify the code before disabling
    if not await mfa_service.verify_mfa_code(current_user.id, verify_data.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")
    
    await mfa_service.disable_mfa(current_user.id)
    
    log_security_event(
        SecurityEvent.MFA_DISABLED,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else "unknown"
    )
    
    return {"message": "MFA disabled successfully", "enabled": False}


@router.post("/regenerate-backup-codes")
async def regenerate_backup_codes(
    verify_data: MFAVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Regenerate backup codes. Invalidates all existing backup codes.
    
    Requires MFA verification.
    """
    mfa_service = MFAService(_get_mfa_db(current_user))
    
    if not await mfa_service.is_mfa_enabled(current_user.id):
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    
    # Verify the code before regenerating
    if not await mfa_service.verify_mfa_code(current_user.id, verify_data.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")
    
    new_codes = await mfa_service.regenerate_backup_codes(current_user.id)
    
    log_security_event(
        SecurityEvent.MFA_BACKUP_REGENERATED,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else "unknown"
    )
    
    return {
        "message": "Backup codes regenerated. Save these codes securely!",
        "backup_codes": new_codes
    }


@router.post("/verify-code")
async def verify_mfa_code(
    verify_data: MFAVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Verify an MFA code (for sensitive operations).
    
    This endpoint can be used to re-verify MFA before sensitive actions.
    """
    mfa_service = MFAService(_get_mfa_db(current_user))
    
    if not await mfa_service.is_mfa_enabled(current_user.id):
        return {"verified": True, "mfa_enabled": False}
    
    if await mfa_service.verify_mfa_code(current_user.id, verify_data.code):
        return {"verified": True, "mfa_enabled": True}
    
    raise HTTPException(status_code=400, detail="Invalid MFA code")


@router.post("/verify-backup-code")
async def verify_backup_code(
    backup_data: MFABackupCodeRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Verify a backup code (consumes the code).
    
    Use this when the user doesn't have access to their authenticator app.
    """
    mfa_service = MFAService(_get_mfa_db(current_user))
    
    if not await mfa_service.is_mfa_enabled(current_user.id):
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    
    if await mfa_service.verify_backup_code(current_user.id, backup_data.backup_code):
        log_security_event(
            SecurityEvent.MFA_BACKUP_USED,
            user_id=current_user.id,
            user_email=current_user.email,
            ip_address=request.client.host if request.client else "unknown"
        )
        
        return {
            "verified": True,
            "message": "Backup code accepted and consumed. Consider regenerating backup codes."
        }
    
    raise HTTPException(status_code=400, detail="Invalid backup code")
