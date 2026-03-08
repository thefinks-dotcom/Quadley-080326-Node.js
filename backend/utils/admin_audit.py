"""
Admin Audit Trail System
========================
Comprehensive audit logging for all admin actions with query/reporting capabilities.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import uuid
from enum import Enum

logger = logging.getLogger(__name__)


class AdminActionType(str, Enum):
    """Types of admin actions to audit."""
    # User management
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"
    USER_SUSPEND = "user_suspend"
    USER_ACTIVATE = "user_activate"
    USER_ROLE_CHANGE = "user_role_change"
    USER_PASSWORD_RESET = "user_password_reset"
    USER_INVITED = "user_invited"
    
    # Tenant management
    TENANT_CREATE = "tenant_create"
    TENANT_UPDATE = "tenant_update"
    TENANT_SUSPEND = "tenant_suspend"
    TENANT_REACTIVATE = "tenant_reactivate"
    TENANT_DELETE = "tenant_delete"
    TENANT_MODULE_UPDATE = "tenant_module_update"
    
    # Content management
    ANNOUNCEMENT_CREATE = "announcement_create"
    ANNOUNCEMENT_UPDATE = "announcement_update"
    ANNOUNCEMENT_DELETE = "announcement_delete"
    EVENT_CREATE = "event_create"
    EVENT_UPDATE = "event_update"
    EVENT_DELETE = "event_delete"
    JOB_CREATE = "job_create"
    JOB_UPDATE = "job_update"
    JOB_DELETE = "job_delete"
    
    # Safe Disclosure management
    DISCLOSURE_FORWARD = "disclosure_forward"
    DISCLOSURE_RISK_ASSESSMENT = "disclosure_risk_assessment"
    DISCLOSURE_SUPPORT_PLAN = "disclosure_support_plan"
    DISCLOSURE_RESOLVE = "disclosure_resolve"
    
    # Data access
    DATA_EXPORT = "data_export"
    DATA_MODIFICATION = "data_modification"
    REPORT_GENERATE = "report_generate"
    BULK_OPERATION = "bulk_operation"
    
    # Security actions
    MFA_DISABLE = "mfa_disable"
    SESSION_REVOKE = "session_revoke"
    PERMISSION_GRANT = "permission_grant"
    PERMISSION_REVOKE = "permission_revoke"
    
    # System
    SETTINGS_UPDATE = "settings_update"
    INTEGRATION_UPDATE = "integration_update"


async def log_admin_action(
    db,
    admin_id: str,
    admin_email: str,
    action_type: AdminActionType,
    target_type: str,
    target_id: Optional[str] = None,
    target_name: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    tenant_code: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> str:
    """
    Log an admin action to the audit trail.
    
    Args:
        db: Database connection
        admin_id: ID of admin performing action
        admin_email: Email of admin (for easy searching)
        action_type: Type of action performed
        target_type: Type of entity affected (user, tenant, event, etc.)
        target_id: ID of affected entity
        target_name: Human-readable name of affected entity
        details: Additional action details (changes made, etc.)
        tenant_code: Tenant context (if applicable)
        ip_address: Admin's IP address
        user_agent: Admin's browser/client
    
    Returns:
        Audit log entry ID
    """
    try:
        # Sanitize details - remove any sensitive data
        safe_details = _sanitize_details(details) if details else {}
        
        audit_entry = {
            "id": f"audit_{uuid.uuid4().hex[:12]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "admin_id": admin_id,
            "admin_email": admin_email,
            "action_type": action_type.value if isinstance(action_type, AdminActionType) else action_type,
            "target_type": target_type,
            "target_id": target_id,
            "target_name": target_name,
            "details": safe_details,
            "tenant_code": tenant_code,
            "ip_address": ip_address,
            "user_agent": user_agent[:200] if user_agent else None,
            "severity": _get_action_severity(action_type)
        }
        
        await db.admin_audit_log.insert_one(audit_entry)
        
        # Also log to application logs for immediate visibility
        logger.info(
            f"ADMIN_AUDIT: {action_type} by {admin_email} on {target_type}:{target_id} "
            f"tenant={tenant_code}"
        )
        
        return audit_entry["id"]
        
    except Exception as e:
        logger.error(f"Failed to log admin action: {e}")
        return ""


async def get_audit_log(
    db,
    filters: Optional[Dict[str, Any]] = None,
    skip: int = 0,
    limit: int = 50,
    sort_order: int = -1  # -1 for newest first
) -> Dict[str, Any]:
    """
    Query the admin audit log with filters.
    
    Args:
        db: Database connection
        filters: Query filters (admin_id, action_type, tenant_code, date_from, date_to)
        skip: Pagination offset
        limit: Results per page (max 100)
        sort_order: -1 for newest first, 1 for oldest first
    
    Returns:
        Dict with entries, total count, and pagination info
    """
    try:
        query = {}
        
        if filters:
            if filters.get("admin_id"):
                query["admin_id"] = filters["admin_id"]
            if filters.get("admin_email"):
                query["admin_email"] = {"$regex": filters["admin_email"], "$options": "i"}
            if filters.get("action_type"):
                query["action_type"] = filters["action_type"]
            if filters.get("action_types"):  # List of types
                query["action_type"] = {"$in": filters["action_types"]}
            if filters.get("tenant_code"):
                query["tenant_code"] = filters["tenant_code"]
            if filters.get("target_type"):
                query["target_type"] = filters["target_type"]
            if filters.get("target_id"):
                query["target_id"] = filters["target_id"]
            if filters.get("severity"):
                query["severity"] = filters["severity"]
            
            # Date range
            if filters.get("date_from") or filters.get("date_to"):
                query["timestamp"] = {}
                if filters.get("date_from"):
                    query["timestamp"]["$gte"] = filters["date_from"]
                if filters.get("date_to"):
                    query["timestamp"]["$lte"] = filters["date_to"]
        
        # Enforce limit
        limit = min(limit, 100)
        
        # Get total count
        total = await db.admin_audit_log.count_documents(query)
        
        # Get entries
        cursor = db.admin_audit_log.find(
            query,
            {"_id": 0}
        ).sort("timestamp", sort_order).skip(skip).limit(limit)
        
        entries = await cursor.to_list(limit)
        
        return {
            "entries": entries,
            "total": total,
            "skip": skip,
            "limit": limit,
            "has_more": (skip + limit) < total
        }
        
    except Exception as e:
        logger.error(f"Failed to query audit log: {e}")
        return {"entries": [], "total": 0, "skip": skip, "limit": limit, "has_more": False}


async def get_admin_activity_summary(
    db,
    admin_id: Optional[str] = None,
    tenant_code: Optional[str] = None,
    days: int = 30
) -> Dict[str, Any]:
    """
    Get summary statistics of admin activity.
    
    Args:
        db: Database connection
        admin_id: Filter by specific admin
        tenant_code: Filter by tenant
        days: Number of days to analyze
    
    Returns:
        Summary with action counts, most active admins, etc.
    """
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        
        match_stage = {"timestamp": {"$gte": cutoff}}
        if admin_id:
            match_stage["admin_id"] = admin_id
        if tenant_code:
            match_stage["tenant_code"] = tenant_code
        
        # Action counts by type
        pipeline_by_type = [
            {"$match": match_stage},
            {"$group": {"_id": "$action_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        # Most active admins
        pipeline_by_admin = [
            {"$match": match_stage},
            {"$group": {
                "_id": {"id": "$admin_id", "email": "$admin_email"},
                "action_count": {"$sum": 1}
            }},
            {"$sort": {"action_count": -1}},
            {"$limit": 10}
        ]
        
        # High severity actions
        pipeline_high_severity = [
            {"$match": {**match_stage, "severity": "high"}},
            {"$sort": {"timestamp": -1}},
            {"$limit": 10},
            {"$project": {"_id": 0}}
        ]
        
        by_type = await db.admin_audit_log.aggregate(pipeline_by_type).to_list(50)
        by_admin = await db.admin_audit_log.aggregate(pipeline_by_admin).to_list(10)
        high_severity = await db.admin_audit_log.aggregate(pipeline_high_severity).to_list(10)
        
        total_actions = await db.admin_audit_log.count_documents(match_stage)
        
        return {
            "period_days": days,
            "total_actions": total_actions,
            "actions_by_type": {item["_id"]: item["count"] for item in by_type},
            "most_active_admins": [
                {"admin_id": item["_id"]["id"], "email": item["_id"]["email"], "actions": item["action_count"]}
                for item in by_admin
            ],
            "recent_high_severity": high_severity
        }
        
    except Exception as e:
        logger.error(f"Failed to get activity summary: {e}")
        return {"period_days": days, "total_actions": 0, "actions_by_type": {}, "most_active_admins": []}


def _sanitize_details(details: Dict[str, Any]) -> Dict[str, Any]:
    """Remove sensitive data from audit details."""
    if not details:
        return {}
    
    safe = details.copy()
    
    # Remove sensitive fields
    sensitive_keys = ["password", "password_hash", "token", "secret", "api_key", "credit_card"]
    for key in list(safe.keys()):
        key_lower = key.lower()
        if any(s in key_lower for s in sensitive_keys):
            safe[key] = "[REDACTED]"
    
    return safe


def _get_action_severity(action_type) -> str:
    """Determine severity level of an action."""
    high_severity = [
        AdminActionType.USER_DELETE,
        AdminActionType.USER_ROLE_CHANGE,
        AdminActionType.TENANT_DELETE,
        AdminActionType.TENANT_SUSPEND,
        AdminActionType.MFA_DISABLE,
        AdminActionType.SESSION_REVOKE,
        AdminActionType.PERMISSION_GRANT,
        AdminActionType.PERMISSION_REVOKE,
        AdminActionType.DATA_EXPORT,
        AdminActionType.BULK_OPERATION,
    ]
    
    if isinstance(action_type, str):
        action_type_str = action_type
    else:
        action_type_str = action_type.value if hasattr(action_type, 'value') else str(action_type)
    
    for ha in high_severity:
        if ha.value == action_type_str:
            return "high"
    
    return "normal"
