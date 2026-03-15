"""
Comprehensive Security Utilities (OWASP Top 10 Compliance)
==========================================================
This module provides security utilities for:
- A01: Access Control (role/tenant decorators)
- A02: Cryptographic validation
- A03: Injection prevention (NoSQL sanitization)
- A07: Authentication strengthening
- A09: Security event logging
- A10: SSRF protection
"""
from fastapi import HTTPException, Request
import bleach
import re
import os
import logging
from typing import Optional, List
from datetime import datetime, timezone
from urllib.parse import urlparse

from utils.password_policy import PasswordPolicy

# ============ SECURITY LOGGING (A09) ============

security_logger = logging.getLogger('security_events')
security_logger.setLevel(logging.INFO)

# Ensure handler exists
if not security_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '%(asctime)s | SECURITY | %(levelname)s | %(message)s'
    ))
    security_logger.addHandler(handler)


class SecurityEventType:
    """Security event types for consistent logging"""
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGIN_BLOCKED = "LOGIN_BLOCKED"
    LOGOUT = "LOGOUT"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST"
    PASSWORD_RESET_COMPLETE = "PASSWORD_RESET_COMPLETE"
    PRIVILEGE_ESCALATION_ATTEMPT = "PRIVILEGE_ESCALATION_ATTEMPT"
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS"
    TENANT_VIOLATION = "TENANT_VIOLATION"
    INJECTION_ATTEMPT = "INJECTION_ATTEMPT"
    SSRF_ATTEMPT = "SSRF_ATTEMPT"
    ADMIN_ACTION = "ADMIN_ACTION"
    TOKEN_REVOKED = "TOKEN_REVOKED"
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"


def log_security_event(
    event_type: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict] = None,
    severity: str = "INFO"
):
    """
    Log security events for monitoring and incident response (OWASP A09)
    """
    log_data = {
        "event": event_type,
        "user": user_id or "anonymous",
        "ip": ip_address or "unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": details or {}
    }
    
    message = f"[{event_type}] user={log_data['user']} ip={log_data['ip']} details={log_data['details']}"
    
    if severity == "CRITICAL":
        security_logger.critical(message)
    elif severity == "ERROR":
        security_logger.error(message)
    elif severity == "WARNING":
        security_logger.warning(message)
    else:
        security_logger.info(message)
    
    return log_data


async def store_security_audit(db, event_data: dict):
    """Store security event in database for audit trail"""
    try:
        event_data["_stored_at"] = datetime.now(timezone.utc).isoformat()
        await db.security_audit_log.insert_one(event_data)
    except Exception as e:
        security_logger.warning(f"Failed to store audit log: {e}")


# ============ ACCESS CONTROL HELPERS (A01) ============

def require_roles(*allowed_roles: str):
    """
    Decorator factory for role-based access control (OWASP A01)
    
    Usage:
        async def get_users(user = Depends(require_roles("admin"))):
    """
    from utils.auth import get_current_user
    
    async def role_checker(request: Request):
        
        current_user = await get_current_user(request)
        
        if current_user.role not in allowed_roles:
            log_security_event(
                SecurityEventType.UNAUTHORIZED_ACCESS,
                user_id=current_user.id,
                details={"required_roles": list(allowed_roles), "user_role": current_user.role},
                severity="WARNING"
            )
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    
    return role_checker


def require_admin():
    """Shortcut for admin-only access"""
    return require_roles("admin", "super_admin", "superadmin")


def require_staff():
    """Shortcut for staff access (RA, admin, super_admin)"""
    return require_roles("ra", "admin", "super_admin", "superadmin")


def get_tenant_filter(user) -> dict:
    """
    Get MongoDB filter for tenant-scoped queries (OWASP A01)
    """
    # Super admins see all
    if hasattr(user, 'role') and user.role in ["super_admin", "superadmin"]:
        return {}
    
    tenant_id = getattr(user, 'tenant_id', None)
    if tenant_id:
        return {"tenant_id": str(tenant_id)}
    
    return {}


def validate_resource_tenant(resource: dict, user, resource_name: str = "resource"):
    """Validate that a resource belongs to the user's tenant."""
    if hasattr(user, 'role') and user.role in ["super_admin", "superadmin"]:
        return True
    
    user_tenant = getattr(user, 'tenant_id', None)
    resource_tenant = resource.get('tenant_id')
    
    if not user_tenant and not resource_tenant:
        return True
    
    if user_tenant and resource_tenant and user_tenant != resource_tenant:
        log_security_event(
            SecurityEventType.TENANT_VIOLATION,
            user_id=getattr(user, 'id', None),
            details={"user_tenant": user_tenant, "resource_tenant": resource_tenant},
            severity="WARNING"
        )
        raise HTTPException(status_code=404, detail=f"{resource_name} not found")
    
    return True


# ============ CRYPTOGRAPHIC VALIDATION (A02) ============

def validate_jwt_secret():
    """Validate JWT secret strength at startup (OWASP A02)"""
    jwt_secret = os.environ.get('JWT_SECRET', '')
    
    if not jwt_secret:
        raise ValueError("JWT_SECRET environment variable is not set")
    
    if len(jwt_secret) < 32:
        raise ValueError("JWT_SECRET must be at least 32 characters for security")
    
    weak_secrets = ['secret', 'password', 'changeme', 'your-secret-key']
    if jwt_secret.lower() in weak_secrets:
        raise ValueError("JWT_SECRET is too weak - use a strong random secret")
    
    return True


# ============ INJECTION PREVENTION (A03) ============

DANGEROUS_MONGO_OPERATORS = [
    '$where', '$expr', '$function', '$accumulator',
    '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin',
    '$regex', '$text', '$mod', '$exists', '$type',
    '$or', '$and', '$nor', '$not',
    '$elemMatch', '$size', '$all',
    '$set', '$unset', '$inc', '$push', '$pull', '$addToSet'
]


def sanitize_mongo_input(value, allow_operators: List[str] = None):
    """
    Sanitize user input for MongoDB queries (OWASP A03 - NoSQL Injection Prevention)
    """
    allow_operators = allow_operators or []
    
    if isinstance(value, dict):
        for key in value:
            if key.startswith('$') and key not in allow_operators:
                log_security_event(
                    SecurityEventType.INJECTION_ATTEMPT,
                    details={"operator": key},
                    severity="WARNING"
                )
                raise HTTPException(status_code=400, detail="Invalid query parameter")
        return {k: sanitize_mongo_input(v, allow_operators) for k, v in value.items()}
    
    if isinstance(value, list):
        return [sanitize_mongo_input(item, allow_operators) for item in value]
    
    if isinstance(value, str):
        for op in DANGEROUS_MONGO_OPERATORS:
            if op in value and op not in allow_operators:
                log_security_event(
                    SecurityEventType.INJECTION_ATTEMPT,
                    details={"operator": op, "value": value[:100]},
                    severity="WARNING"
                )
                raise HTTPException(status_code=400, detail="Invalid input")
    
    return value


def escape_regex(pattern: str) -> str:
    """Escape special regex characters for safe MongoDB $regex queries"""
    special_chars = r'\.^$*+?{}[]|()'
    for char in special_chars:
        pattern = pattern.replace(char, '\\' + char)
    return pattern


def safe_search_query(field: str, search_term: str, case_insensitive: bool = True) -> dict:
    """Build a safe MongoDB search query"""
    escaped_term = escape_regex(search_term)
    options = "i" if case_insensitive else ""
    return {field: {"$regex": escaped_term, "$options": options}}


# ============ SSRF PROTECTION (A10) ============

ALLOWED_EXTERNAL_HOSTS = []

BLOCKED_IP_PATTERNS = [
    r'^localhost$', r'^127\.', r'^10\.', r'^172\.(1[6-9]|2[0-9]|3[0-1])\.',
    r'^192\.168\.', r'^0\.', r'^169\.254\.', r'^::1$', r'^fc00:', r'^fe80:',
]


def validate_external_url(url: str, allow_list: List[str] = None) -> bool:
    """Validate URL is safe to fetch (OWASP A10 - SSRF Prevention)"""
    allow_list = allow_list or []
    all_allowed = ALLOWED_EXTERNAL_HOSTS + allow_list
    
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")
    
    if parsed.scheme not in ['https']:
        raise HTTPException(status_code=400, detail="Only HTTPS URLs are allowed")
    
    hostname = parsed.hostname or ''
    
    for pattern in BLOCKED_IP_PATTERNS:
        if re.match(pattern, hostname, re.IGNORECASE):
            log_security_event(
                SecurityEventType.SSRF_ATTEMPT,
                details={"url": url, "hostname": hostname},
                severity="WARNING"
            )
            raise HTTPException(status_code=400, detail="Internal URLs are not allowed")
    
    if all_allowed and hostname not in all_allowed:
        log_security_event(
            SecurityEventType.SSRF_ATTEMPT,
            details={"url": url, "hostname": hostname},
            severity="WARNING"
        )
        raise HTTPException(status_code=400, detail="URL host is not in the allowed list")
    
    return True


# ============ INPUT SANITIZATION ============

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal"""
    filename = os.path.basename(filename)
    filename = filename.replace('/', '').replace('\\', '')
    filename = filename.replace('\x00', '')
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255 - len(ext)] + ext
    return filename


def get_client_ip(request: Request) -> str:
    """Get client IP address, handling proxies"""
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return 'unknown'


# ============ ORIGINAL FUNCTIONS ============

def sanitize_html(text: str, max_length: int = 10000) -> str:
    """Sanitize user input to prevent XSS attacks"""
    if not text:
        return ""
    text = text[:max_length]
    clean_text = bleach.clean(text, tags=[], strip=True)
    return clean_text


def sanitize_rich_html(text: str, max_length: int = 10000) -> str:
    """Sanitize HTML allowing safe formatting tags"""
    if not text:
        return ""
    allowed_tags = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'b', 'i']
    allowed_attrs = {'a': ['href', 'title']}
    clean = bleach.clean(text, tags=allowed_tags, attributes=allowed_attrs, strip=True)
    return clean[:max_length]


def sanitize_search_query(query: str) -> str:
    """Sanitize search query for MongoDB - remove regex special characters"""
    if not query:
        return ""
    # Remove regex special characters that could be exploited
    return re.sub(r'[${}()|[\]\\^*+?."]', '', query)[:200]


def validate_password_strength(password: str, email: Optional[str] = None) -> bool:
    """
    Validate password meets complexity requirements.
    Raises HTTPException if validation fails.
    """
    is_valid, errors = PasswordPolicy.validate(password, email)
    
    if not is_valid:
        raise HTTPException(
            status_code=400, 
            detail={
                "message": "Password does not meet requirements",
                "errors": errors,
                "requirements": PasswordPolicy.get_requirements_text()
            }
        )
    
    return True


def get_password_requirements() -> dict:
    """Return password requirements for frontend display"""
    return {
        "min_length": PasswordPolicy.MIN_LENGTH,
        "require_uppercase": PasswordPolicy.REQUIRE_UPPERCASE,
        "require_lowercase": PasswordPolicy.REQUIRE_LOWERCASE,
        "require_digit": PasswordPolicy.REQUIRE_DIGIT,
        "require_special": PasswordPolicy.REQUIRE_SPECIAL,
        "description": PasswordPolicy.get_requirements_text()
    }
