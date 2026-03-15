"""
IP Anomaly Detection Routes
=============================
Endpoints for viewing, managing, and configuring IP-based security alerts.
All endpoints require admin or super_admin role.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

from models import User
from utils.auth import get_current_user
from utils.multi_tenant import master_db
from utils.ip_anomaly import get_anomaly_settings, DEFAULT_SETTINGS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/security", tags=["security"])


def _require_admin(user: User):
    if user.role not in ("admin", "super_admin", "college_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")


# ========== ALERTS ==========

@router.get("/alerts")
async def list_alerts(
    severity: Optional[str] = Query(None),
    alert_type: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
):
    """List IP anomaly alerts with optional filters."""
    _require_admin(current_user)

    query = {}
    if severity:
        query["severity"] = severity
    if alert_type:
        query["alert_type"] = alert_type
    if resolved is not None:
        query["resolved"] = resolved

    # Non-super-admins only see their tenant
    if current_user.role != "super_admin" and hasattr(current_user, "tenant_code") and current_user.tenant_code:
        query["tenant_code"] = current_user.tenant_code

    total = await master_db.ip_anomaly_alerts.count_documents(query)
    alerts = (
        await master_db.ip_anomaly_alerts.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
        .to_list(limit)
    )

    return {"alerts": alerts, "total": total, "limit": limit, "offset": offset}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
):
    """Mark an alert as resolved."""
    _require_admin(current_user)

    result = await master_db.ip_anomaly_alerts.update_one(
        {"id": str(alert_id), "resolved": False},
        {
            "$set": {
                "resolved": True,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolved_by": current_user.email,
            }
        },
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved")

    return {"message": "Alert resolved", "alert_id": alert_id}


@router.post("/alerts/resolve-all")
async def resolve_all_alerts(
    current_user: User = Depends(get_current_user),
):
    """Resolve all unresolved alerts."""
    _require_admin(current_user)

    query = {"resolved": False}
    if current_user.role != "super_admin" and hasattr(current_user, "tenant_code") and current_user.tenant_code:
        query["tenant_code"] = current_user.tenant_code

    result = await master_db.ip_anomaly_alerts.update_many(
        query,
        {
            "$set": {
                "resolved": True,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolved_by": current_user.email,
            }
        },
    )
    return {"message": f"{result.modified_count} alerts resolved"}


# ========== STATS ==========

@router.get("/alerts/stats")
async def alert_stats(current_user: User = Depends(get_current_user)):
    """Aggregate alert statistics for the dashboard."""
    _require_admin(current_user)

    base_query = {}
    if current_user.role != "super_admin" and hasattr(current_user, "tenant_code") and current_user.tenant_code:
        base_query["tenant_code"] = current_user.tenant_code

    total = await master_db.ip_anomaly_alerts.count_documents(base_query)
    unresolved = await master_db.ip_anomaly_alerts.count_documents({**base_query, "resolved": False})

    # Counts by severity
    severity_counts = {}
    for sev in ("low", "medium", "high", "critical"):
        severity_counts[sev] = await master_db.ip_anomaly_alerts.count_documents(
            {**base_query, "severity": sev, "resolved": False}
        )

    # Counts by type
    type_counts = {}
    for atype in ("new_ip", "rapid_ip_change", "brute_force"):
        type_counts[atype] = await master_db.ip_anomaly_alerts.count_documents(
            {**base_query, "alert_type": atype, "resolved": False}
        )

    # Recent 24h
    cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    last_24h = await master_db.ip_anomaly_alerts.count_documents(
        {**base_query, "created_at": {"$gte": cutoff_24h}}
    )

    # Recent 7d
    cutoff_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    last_7d = await master_db.ip_anomaly_alerts.count_documents(
        {**base_query, "created_at": {"$gte": cutoff_7d}}
    )

    return {
        "total": total,
        "unresolved": unresolved,
        "last_24h": last_24h,
        "last_7d": last_7d,
        "by_severity": severity_counts,
        "by_type": type_counts,
    }


# ========== SETTINGS ==========

@router.get("/alerts/settings")
async def get_settings(current_user: User = Depends(get_current_user)):
    """Get current anomaly detection settings."""
    _require_admin(current_user)
    return await get_anomaly_settings()


@router.post("/alerts/settings")
async def update_settings(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Update anomaly detection settings. Super admin only."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin required")

    allowed_keys = set(DEFAULT_SETTINGS.keys())
    update = {k: v for k, v in body.items() if k in allowed_keys}

    if not update:
        raise HTTPException(status_code=400, detail="No valid settings provided")

    await master_db.ip_anomaly_settings.update_one(
        {"_key": "global"},
        {"$set": update},
        upsert=True,
    )
    return {"message": "Settings updated", "settings": await get_anomaly_settings()}


# ========== LOGIN HISTORY ==========

@router.get("/login-history")
async def login_history(
    email: Optional[str] = Query(None),
    ip_address: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
):
    """View recent login history. Super admin only."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin required")

    query = {}
    if email:
        query["email"] = email.lower()
    if ip_address:
        query["ip_address"] = ip_address

    records = (
        await master_db.ip_login_history.find(query, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
        .to_list(limit)
    )
    return {"records": records, "count": len(records)}
