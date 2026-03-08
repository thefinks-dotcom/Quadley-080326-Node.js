"""
Admin Audit Dashboard API Routes
================================
Endpoints for super admins to view audit trails and admin activity.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

from utils.auth import get_current_user
from utils.multi_tenant import master_db  # Use master_db for consistent audit logging
from utils.admin_audit import (
    get_audit_log,
    get_admin_activity_summary,
    AdminActionType
)

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditQueryParams(BaseModel):
    admin_id: Optional[str] = None
    admin_email: Optional[str] = None
    action_type: Optional[str] = None
    action_types: Optional[List[str]] = None
    tenant_code: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    severity: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


@router.get("")
async def query_audit_log(
    admin_id: Optional[str] = Query(None),
    admin_email: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    tenant_code: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user)
):
    """
    Query the admin audit log.
    
    Super admins can view all audit entries.
    Tenant admins can only view entries for their tenant.
    
    Filters:
    - admin_id: Filter by admin who performed action
    - admin_email: Filter by admin email (partial match)
    - action_type: Filter by action type (e.g., user_create, tenant_update)
    - tenant_code: Filter by tenant
    - target_type: Filter by target entity type (user, tenant, event, etc.)
    - severity: Filter by severity (normal, high)
    - date_from/date_to: Date range filter (ISO format)
    """
    # Authorization check
    if current_user.role not in ['super_admin', 'admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build filters
    filters = {}
    
    if admin_id:
        filters["admin_id"] = admin_id
    if admin_email:
        filters["admin_email"] = admin_email
    if action_type:
        filters["action_type"] = action_type
    if target_type:
        filters["target_type"] = target_type
    if severity:
        filters["severity"] = severity
    if date_from:
        filters["date_from"] = date_from
    if date_to:
        filters["date_to"] = date_to
    
    # Tenant admins can only see their tenant's logs
    if current_user.role != 'super_admin':
        filters["tenant_code"] = current_user.tenant_code
    elif tenant_code:
        filters["tenant_code"] = tenant_code
    
    result = await get_audit_log(
        db=master_db,
        filters=filters,
        skip=skip,
        limit=limit
    )
    
    return result


@router.get("/summary")
async def get_audit_summary(
    admin_id: Optional[str] = Query(None),
    tenant_code: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_user)
):
    """
    Get summary statistics of admin activity.
    
    Returns:
    - Total actions in period
    - Actions by type
    - Most active admins
    - Recent high-severity actions
    """
    if current_user.role not in ['super_admin', 'admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Tenant admins can only see their tenant
    if current_user.role != 'super_admin':
        tenant_code = current_user.tenant_code
    
    summary = await get_admin_activity_summary(
        db=master_db,
        admin_id=admin_id,
        tenant_code=tenant_code,
        days=days
    )
    
    return summary


@router.get("/action-types")
async def get_action_types(current_user=Depends(get_current_user)):
    """
    Get list of available action types for filtering.
    """
    if current_user.role not in ['super_admin', 'admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Group action types by category
    categories = {
        "User Management": [
            AdminActionType.USER_CREATE,
            AdminActionType.USER_UPDATE,
            AdminActionType.USER_DELETE,
            AdminActionType.USER_SUSPEND,
            AdminActionType.USER_ACTIVATE,
            AdminActionType.USER_ROLE_CHANGE,
            AdminActionType.USER_PASSWORD_RESET,
        ],
        "Tenant Management": [
            AdminActionType.TENANT_CREATE,
            AdminActionType.TENANT_UPDATE,
            AdminActionType.TENANT_SUSPEND,
            AdminActionType.TENANT_REACTIVATE,
            AdminActionType.TENANT_DELETE,
            AdminActionType.TENANT_MODULE_UPDATE,
        ],
        "Content Management": [
            AdminActionType.ANNOUNCEMENT_CREATE,
            AdminActionType.ANNOUNCEMENT_UPDATE,
            AdminActionType.ANNOUNCEMENT_DELETE,
            AdminActionType.EVENT_CREATE,
            AdminActionType.EVENT_UPDATE,
            AdminActionType.EVENT_DELETE,
            AdminActionType.JOB_CREATE,
            AdminActionType.JOB_UPDATE,
            AdminActionType.JOB_DELETE,
        ],
        "Data & Reports": [
            AdminActionType.DATA_EXPORT,
            AdminActionType.REPORT_GENERATE,
            AdminActionType.BULK_OPERATION,
        ],
        "Security": [
            AdminActionType.MFA_DISABLE,
            AdminActionType.SESSION_REVOKE,
            AdminActionType.PERMISSION_GRANT,
            AdminActionType.PERMISSION_REVOKE,
        ],
        "System": [
            AdminActionType.SETTINGS_UPDATE,
            AdminActionType.INTEGRATION_UPDATE,
        ],
    }
    
    result = {}
    for category, actions in categories.items():
        result[category] = [{"value": a.value, "label": a.value.replace("_", " ").title()} for a in actions]
    
    return result


@router.get("/my-activity")
async def get_my_activity(
    days: int = Query(30, ge=1, le=365),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user=Depends(get_current_user)
):
    """
    Get the current admin's own audit trail.
    
    Useful for admins to review their recent actions.
    """
    if current_user.role not in ['super_admin', 'admin', 'college_admin', 'ra']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    date_from = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    result = await get_audit_log(
        db=master_db,
        filters={
            "admin_id": current_user.id,
            "date_from": date_from
        },
        skip=skip,
        limit=limit
    )
    
    return result


@router.get("/high-severity")
async def get_high_severity_actions(
    days: int = Query(7, ge=1, le=30),
    tenant_code: Optional[str] = Query(None),
    current_user=Depends(get_current_user)
):
    """
    Get recent high-severity admin actions.
    
    High severity includes: deletions, role changes, suspensions,
    MFA disables, data exports, bulk operations.
    """
    if current_user.role != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    date_from = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    filters = {
        "severity": "high",
        "date_from": date_from
    }
    
    if tenant_code:
        filters["tenant_code"] = tenant_code
    
    result = await get_audit_log(
        db=master_db,
        filters=filters,
        skip=0,
        limit=50
    )
    
    return result
