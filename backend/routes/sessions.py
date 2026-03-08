"""
Session Management API Routes
=============================
Endpoints for viewing and managing user sessions (active devices).
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from utils.auth import get_current_user, db
from utils.session_management import (
    get_active_sessions,
    revoke_session,
    revoke_all_sessions,
    detect_concurrent_login
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


class RevokeSessionRequest(BaseModel):
    session_id: str


class RevokeAllSessionsRequest(BaseModel):
    keep_current: bool = True  # Keep current session active


@router.get("")
async def get_my_sessions(
    request: Request,
    current_user=Depends(get_current_user)
):
    """
    Get all active sessions for the current user.
    
    Returns list of sessions with device info, location hints, and timestamps.
    The current session is marked with is_current=True.
    """
    # Get token JTI from request state (set by auth middleware)
    token_jti = getattr(request.state, 'token_jti', None)
    
    sessions = await get_active_sessions(
        db=db,
        user_id=current_user.id,
        current_token_jti=token_jti
    )
    
    return {
        "sessions": sessions,
        "total": len(sessions)
    }


@router.post("/revoke")
async def revoke_single_session(
    data: RevokeSessionRequest,
    current_user=Depends(get_current_user)
):
    """
    Revoke a specific session (logout that device).
    
    Cannot revoke the current session - use /auth/logout instead.
    """
    success = await revoke_session(
        db=db,
        user_id=current_user.id,
        session_id=data.session_id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Session not found or already revoked")
    
    return {"success": True, "message": "Session revoked - device logged out"}


@router.post("/revoke-all")
async def revoke_all_user_sessions(
    request: Request,
    data: RevokeAllSessionsRequest,
    current_user=Depends(get_current_user)
):
    """
    Revoke all sessions except optionally the current one.
    
    Use this for "logout all devices" functionality.
    If keep_current=False, all sessions including current are revoked.
    """
    # Get current token JTI
    current_jti = None
    if data.keep_current:
        current_jti = getattr(request.state, 'token_jti', None)
    
    count = await revoke_all_sessions(
        db=db,
        user_id=current_user.id,
        except_current=current_jti
    )
    
    return {
        "success": True,
        "sessions_revoked": count,
        "message": f"Revoked {count} session(s)" + (" (current session kept)" if data.keep_current else "")
    }


@router.get("/security-check")
async def check_session_security(
    request: Request,
    current_user=Depends(get_current_user)
):
    """
    Check for security anomalies in current login.
    
    Returns warnings if:
    - Login from new IP address
    - Login from new device type
    - Multiple concurrent sessions
    """
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    
    # Check for anomalies
    anomaly = await detect_concurrent_login(
        db=db,
        user_id=current_user.id,
        new_ip=client_ip,
        new_user_agent=user_agent
    )
    
    # Get active session count
    sessions = await get_active_sessions(db, current_user.id)
    
    warnings = []
    
    if anomaly:
        if "new_ip" in anomaly.get("anomalies", []):
            warnings.append({
                "type": "new_location",
                "message": "This login is from a new location",
                "severity": "medium"
            })
        if "new_device" in anomaly.get("anomalies", []):
            warnings.append({
                "type": "new_device",
                "message": f"This login is from a new device type ({anomaly.get('device_type')})",
                "severity": "low"
            })
    
    if len(sessions) > 3:
        warnings.append({
            "type": "many_sessions",
            "message": f"You have {len(sessions)} active sessions",
            "severity": "info"
        })
    
    return {
        "secure": len([w for w in warnings if w["severity"] in ["high", "medium"]]) == 0,
        "warnings": warnings,
        "active_sessions": len(sessions)
    }
