"""Security event logging utility"""
import logging
from datetime import datetime, timezone
from typing import Optional
from enum import Enum

class SecurityEvent(Enum):
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILURE = "LOGIN_FAILURE"
    LOGOUT = "LOGOUT"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST"
    PASSWORD_RESET_COMPLETE = "PASSWORD_RESET_COMPLETE"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    DATA_EXPORT = "DATA_EXPORT"
    ADMIN_ACTION = "ADMIN_ACTION"
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"
    FILE_UPLOAD = "FILE_UPLOAD"
    REGISTRATION = "REGISTRATION"
    TOKEN_REFRESH = "TOKEN_REFRESH"
    # MFA Events (OWASP A07)
    MFA_SETUP_STARTED = "MFA_SETUP_STARTED"
    MFA_ENABLED = "MFA_ENABLED"
    MFA_DISABLED = "MFA_DISABLED"
    MFA_VERIFICATION_SUCCESS = "MFA_VERIFICATION_SUCCESS"
    MFA_VERIFICATION_FAILURE = "MFA_VERIFICATION_FAILURE"
    MFA_BACKUP_USED = "MFA_BACKUP_USED"
    MFA_BACKUP_REGENERATED = "MFA_BACKUP_REGENERATED"

# Configure security logger
security_logger = logging.getLogger('security')
security_logger.setLevel(logging.INFO)

# Console handler for security events
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(
    '%(asctime)s | SECURITY | %(levelname)s | %(message)s'
))
security_logger.addHandler(console_handler)

def log_security_event(
    event: SecurityEvent,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict] = None,
    severity: str = "INFO"
):
    """Log security-relevant events synchronously"""
    
    message = (
        f"[{event.value}] "
        f"user={user_email or 'anonymous'} "
        f"user_id={user_id or 'N/A'} "
        f"ip={ip_address or 'unknown'} "
        f"details={details or {}}"
    )
    
    if severity == "WARNING":
        security_logger.warning(message)
    elif severity == "ERROR":
        security_logger.error(message)
    elif severity == "CRITICAL":
        security_logger.critical(message)
    else:
        security_logger.info(message)

async def log_security_event_async(
    db,
    event: SecurityEvent,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict] = None,
    severity: str = "INFO"
):
    """Log security-relevant events with database storage"""
    
    # Log to console/file
    log_security_event(event, user_id, user_email, ip_address, details, severity)
    
    # Store in database for querying
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event.value,
        "user_id": user_id,
        "user_email": user_email,
        "ip_address": ip_address,
        "details": details or {},
        "severity": severity
    }
    
    try:
        await db.security_logs.insert_one(log_entry)
    except Exception as e:
        security_logger.error(f"Failed to store security log in DB: {e}")
