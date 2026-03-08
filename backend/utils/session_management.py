"""
Session Management Utilities
============================
Provides session tracking, concurrent login detection, and "logout all devices" functionality.
"""
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import uuid

logger = logging.getLogger(__name__)

# Session expiry (should match JWT expiry)
SESSION_EXPIRY_DAYS = 7


async def create_session(
    db,
    user_id: str,
    token_jti: str,
    ip_address: str,
    user_agent: str,
    device_info: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Create a new session record when user logs in.
    
    Args:
        db: Database connection
        user_id: User ID
        token_jti: JWT token ID (jti claim)
        ip_address: Client IP address
        user_agent: Browser/app user agent string
        device_info: Optional device metadata
    
    Returns:
        Session document
    """
    try:
        # Parse device info from user agent
        device_type = _detect_device_type(user_agent)
        
        session = {
            "id": f"sess_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "token_jti": token_jti,
            "ip_address": ip_address,
            "ip_hash": hashlib.sha256(ip_address.encode()).hexdigest()[:16],  # For privacy
            "user_agent": user_agent[:500],  # Truncate long user agents
            "device_type": device_type,
            "device_info": device_info or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)).isoformat(),
            "is_active": True,
            "is_current": True  # Will be updated when checking sessions
        }
        
        await db.user_sessions.insert_one(session)
        
        # Log for security audit
        logger.info(f"Session created: user={user_id} device={device_type} ip_hash={session['ip_hash']}")
        
        return session
        
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        return {}


async def get_active_sessions(db, user_id: str, current_token_jti: Optional[str] = None) -> List[Dict]:
    """
    Get all active sessions for a user.
    
    Args:
        db: Database connection
        user_id: User ID
        current_token_jti: Current token's JTI to mark as "current"
    
    Returns:
        List of active sessions
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        # Find active, non-expired sessions
        cursor = db.user_sessions.find(
            {
                "user_id": user_id,
                "is_active": True,
                "expires_at": {"$gt": now}
            },
            {"_id": 0, "token_jti": 0}  # Don't expose token JTI
        ).sort("last_active", -1)
        
        sessions = await cursor.to_list(50)
        
        # Mark current session
        for session in sessions:
            session["is_current"] = False
        
        if current_token_jti:
            # Find and mark current session
            current = await db.user_sessions.find_one(
                {"user_id": user_id, "token_jti": current_token_jti},
                {"id": 1}
            )
            if current:
                for session in sessions:
                    if session["id"] == current["id"]:
                        session["is_current"] = True
                        break
        
        return sessions
        
    except Exception as e:
        logger.error(f"Failed to get sessions: {e}")
        return []


async def update_session_activity(db, token_jti: str):
    """Update last_active timestamp for a session."""
    try:
        await db.user_sessions.update_one(
            {"token_jti": token_jti},
            {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
        )
    except Exception as e:
        logger.warning(f"Failed to update session activity: {e}")


async def revoke_session(db, user_id: str, session_id: str) -> bool:
    """
    Revoke a specific session (logout that device).
    
    Args:
        db: Database connection
        user_id: User ID (for ownership verification)
        session_id: Session ID to revoke
    
    Returns:
        True if session was revoked
    """
    try:
        result = await db.user_sessions.update_one(
            {"id": session_id, "user_id": user_id},
            {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.modified_count > 0:
            logger.info(f"Session revoked: user={user_id} session={session_id}")
            return True
        return False
        
    except Exception as e:
        logger.error(f"Failed to revoke session: {e}")
        return False


async def revoke_all_sessions(db, user_id: str, except_current: Optional[str] = None) -> int:
    """
    Revoke all sessions for a user (logout all devices).
    
    Args:
        db: Database connection
        user_id: User ID
        except_current: Token JTI to keep active (current session)
    
    Returns:
        Number of sessions revoked
    """
    try:
        query = {"user_id": user_id, "is_active": True}
        
        if except_current:
            query["token_jti"] = {"$ne": except_current}
        
        result = await db.user_sessions.update_many(
            query,
            {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"All sessions revoked: user={user_id} count={result.modified_count}")
        return result.modified_count
        
    except Exception as e:
        logger.error(f"Failed to revoke all sessions: {e}")
        return 0


async def check_session_valid(db, token_jti: str) -> bool:
    """Check if a session is still valid (not revoked)."""
    try:
        session = await db.user_sessions.find_one(
            {"token_jti": token_jti, "is_active": True}
        )
        return session is not None
    except Exception as e:
        logger.warning(f"Session validity check failed: {e}")
        return True  # Fail open to not break auth


async def detect_concurrent_login(
    db,
    user_id: str,
    new_ip: str,
    new_user_agent: str
) -> Optional[Dict]:
    """
    Detect if this login is from a new location/device.
    
    Returns:
        Dict with anomaly info if detected, None otherwise
    """
    try:
        # Get recent sessions
        recent = await db.user_sessions.find(
            {"user_id": user_id, "is_active": True},
            {"ip_hash": 1, "device_type": 1, "created_at": 1}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        if not recent:
            return None  # First login, no anomaly
        
        new_ip_hash = hashlib.sha256(new_ip.encode()).hexdigest()[:16]
        new_device = _detect_device_type(new_user_agent)
        
        # Check if this IP/device combo has been seen before
        seen_ips = {s.get("ip_hash") for s in recent}
        seen_devices = {s.get("device_type") for s in recent}
        
        anomalies = []
        if new_ip_hash not in seen_ips:
            anomalies.append("new_ip")
        if new_device not in seen_devices:
            anomalies.append("new_device")
        
        if anomalies:
            return {
                "type": "concurrent_login",
                "anomalies": anomalies,
                "new_ip": new_ip_hash != list(seen_ips)[0] if seen_ips else False,
                "new_device": new_device not in seen_devices,
                "device_type": new_device
            }
        
        return None
        
    except Exception as e:
        logger.warning(f"Concurrent login detection failed: {e}")
        return None


async def cleanup_expired_sessions(db) -> int:
    """Remove expired sessions (run periodically)."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        result = await db.user_sessions.delete_many({
            "expires_at": {"$lt": now}
        })
        return result.deleted_count
    except Exception as e:
        logger.error(f"Session cleanup failed: {e}")
        return 0


def _detect_device_type(user_agent: str) -> str:
    """Detect device type from user agent string."""
    ua_lower = user_agent.lower()
    
    if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
        if "iphone" in ua_lower or "ipad" in ua_lower:
            return "iOS"
        elif "android" in ua_lower:
            return "Android"
        return "Mobile"
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        return "Tablet"
    elif "windows" in ua_lower:
        return "Windows"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        return "macOS"
    elif "linux" in ua_lower:
        return "Linux"
    elif "expo" in ua_lower or "react-native" in ua_lower:
        return "Mobile App"
    else:
        return "Unknown"
