"""Security Events API Routes - Tenant isolated (OWASP A09 Compliance)

Provides endpoints for:
1. Viewing security event logs (admin only)
2. Retrieving security metrics and alerts
3. Managing security settings
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import logging

from utils.auth import get_tenant_db_for_user
from utils.security_logger import SecurityEvent, log_security_event_async

router = APIRouter(prefix="/security", tags=["Security"])
logger = logging.getLogger(__name__)


class SecurityEventResponse(BaseModel):
    id: Optional[str] = None
    timestamp: str
    event: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None
    details: Optional[dict] = None
    severity: str = "INFO"


class SecurityMetrics(BaseModel):
    period_start: str
    period_end: str
    total_events: int
    login_successes: int
    login_failures: int
    suspicious_activities: int
    data_exports: int
    password_resets: int
    mfa_events: int
    alerts: List[dict] = []


class ClientSecurityEventBatch(BaseModel):
    """Batch of security events from mobile/web clients"""
    events: List[dict]


@router.get("/events")
async def get_security_events(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity: INFO, WARNING, ERROR, CRITICAL"),
    user_email: Optional[str] = Query(None, description="Filter by user email"),
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Get security event logs - tenant isolated.
    
    Admin/Super Admin only. Returns paginated list of security events.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build query
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query = {"timestamp": {"$gte": start_date}}
    
    if event_type:
        query["event"] = event_type
    if severity:
        query["severity"] = severity
    if user_email:
        query["user_email"] = {"$regex": user_email, "$options": "i"}
    
    # Get total count
    total = await tenant_db.security_logs.count_documents(query)
    
    # Get events
    events = await tenant_db.security_logs.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    
    return {
        "events": events,
        "total": total,
        "limit": limit,
        "offset": offset,
        "filters": {
            "event_type": event_type,
            "severity": severity,
            "user_email": user_email,
            "days": days
        }
    }


@router.get("/metrics")
async def get_security_metrics(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Get security metrics and alerts - tenant isolated.
    
    Admin/Super Admin only. Returns aggregated security statistics.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get all events in the period
    events = await tenant_db.security_logs.find(
        {"timestamp": {"$gte": start_date}},
        {"_id": 0, "event": 1, "severity": 1, "user_email": 1, "ip_address": 1}
    ).to_list(10000)
    
    # Count by event type
    login_successes = sum(1 for e in events if e.get("event") == "LOGIN_SUCCESS")
    login_failures = sum(1 for e in events if e.get("event") == "LOGIN_FAILURE")
    suspicious = sum(1 for e in events if e.get("event") == "SUSPICIOUS_ACTIVITY")
    data_exports = sum(1 for e in events if e.get("event") == "DATA_EXPORT")
    password_resets = sum(1 for e in events if e.get("event") in ["PASSWORD_RESET_REQUEST", "PASSWORD_RESET_COMPLETE"])
    mfa_events = sum(1 for e in events if "MFA" in e.get("event", ""))
    
    # Generate alerts
    alerts = []
    
    # Alert: High login failure rate
    if login_failures > login_successes * 0.5 and login_failures > 10:
        alerts.append({
            "type": "high_failure_rate",
            "severity": "WARNING",
            "message": f"High login failure rate: {login_failures} failures vs {login_successes} successes",
            "action": "Review failed login attempts for potential brute force attacks"
        })
    
    # Alert: Suspicious activity detected
    if suspicious > 5:
        alerts.append({
            "type": "suspicious_activity",
            "severity": "HIGH",
            "message": f"{suspicious} suspicious activities detected in the last {days} days",
            "action": "Review suspicious activity logs immediately"
        })
    
    # Alert: Multiple data exports
    if data_exports > 10:
        alerts.append({
            "type": "excessive_exports",
            "severity": "MEDIUM",
            "message": f"{data_exports} data export events in the last {days} days",
            "action": "Verify all data exports were authorized"
        })
    
    # Alert: Critical severity events
    critical_events = sum(1 for e in events if e.get("severity") == "CRITICAL")
    if critical_events > 0:
        alerts.append({
            "type": "critical_events",
            "severity": "CRITICAL",
            "message": f"{critical_events} critical security events detected",
            "action": "Immediate review required"
        })
    
    return {
        "period_start": start_date,
        "period_end": now.isoformat(),
        "days_analyzed": days,
        "total_events": len(events),
        "breakdown": {
            "login_successes": login_successes,
            "login_failures": login_failures,
            "suspicious_activities": suspicious,
            "data_exports": data_exports,
            "password_resets": password_resets,
            "mfa_events": mfa_events
        },
        "by_severity": {
            "INFO": sum(1 for e in events if e.get("severity") == "INFO"),
            "WARNING": sum(1 for e in events if e.get("severity") == "WARNING"),
            "ERROR": sum(1 for e in events if e.get("severity") == "ERROR"),
            "CRITICAL": sum(1 for e in events if e.get("severity") == "CRITICAL")
        },
        "alerts": alerts,
        "alerts_count": len(alerts)
    }


@router.get("/event-types")
async def get_event_types(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get list of all security event types - tenant isolated."""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "event_types": [
            {"value": e.value, "name": e.name.replace("_", " ").title()}
            for e in SecurityEvent
        ]
    }


@router.get("/failed-logins")
async def get_failed_logins(
    hours: int = Query(24, ge=1, le=168, description="Hours to look back"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Get recent failed login attempts - tenant isolated.
    
    Useful for identifying potential brute force attacks.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    start_date = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    
    # Get failed logins
    failed_logins = await tenant_db.security_logs.find(
        {
            "event": "LOGIN_FAILURE",
            "timestamp": {"$gte": start_date}
        },
        {"_id": 0}
    ).sort("timestamp", -1).to_list(500)
    
    # Group by email and IP
    by_email = {}
    by_ip = {}
    
    for login in failed_logins:
        email = login.get("user_email", "unknown")
        ip = login.get("ip_address", "unknown")
        
        by_email[email] = by_email.get(email, 0) + 1
        by_ip[ip] = by_ip.get(ip, 0) + 1
    
    # Sort by count
    top_emails = sorted(by_email.items(), key=lambda x: x[1], reverse=True)[:10]
    top_ips = sorted(by_ip.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "period_hours": hours,
        "total_failed_logins": len(failed_logins),
        "top_targeted_emails": [{"email": e, "attempts": c} for e, c in top_emails],
        "top_source_ips": [{"ip": ip, "attempts": c} for ip, c in top_ips],
        "recent_attempts": failed_logins[:20]
    }


@router.post("/report")
async def report_client_security_events(
    batch: ClientSecurityEventBatch,
    request: Request,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Report security events from client applications - tenant isolated.
    
    Used by mobile and web clients to report security-relevant events
    such as jailbreak/root detection, tampering attempts, etc.
    """
    tenant_db, current_user = tenant_data
    ip_address = request.client.host if request.client else "unknown"
    
    stored_count = 0
    for event in batch.events[:50]:  # Limit to 50 events per batch
        try:
            await log_security_event_async(
                db=tenant_db,
                event=SecurityEvent.SUSPICIOUS_ACTIVITY,
                user_id=current_user.id,
                user_email=current_user.email,
                ip_address=ip_address,
                details={
                    "source": "client",
                    "event_type": event.get("type", "unknown"),
                    "client_timestamp": event.get("timestamp"),
                    "platform": event.get("platform"),
                    "details": event.get("details", {}),
                    "device_info": event.get("device_info", {})
                },
                severity=event.get("severity", "WARNING")
            )
            stored_count += 1
        except Exception as e:
            logger.error(f"Failed to store client security event: {e}")
    
    return {
        "received": len(batch.events),
        "stored": stored_count,
        "message": "Security events recorded"
    }


@router.get("/locked-accounts")
async def get_locked_accounts(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """
    Get list of currently locked accounts - tenant isolated.
    
    Admin only. Returns accounts that are temporarily locked due to failed login attempts.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Get accounts with active lockouts
    locked_accounts = await tenant_db.account_lockouts.find(
        {
            "locked_until": {"$gt": now.isoformat()},
            "failed_attempts": {"$gte": 5}
        },
        {"_id": 0}
    ).to_list(100)
    
    return {
        "locked_count": len(locked_accounts),
        "accounts": [
            {
                "email": acc.get("email"),
                "failed_attempts": acc.get("failed_attempts"),
                "locked_until": acc.get("locked_until"),
                "last_attempt": acc.get("last_attempt_at")
            }
            for acc in locked_accounts
        ]
    }


@router.post("/unlock-account")
async def unlock_account(
    email: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Manually unlock a locked account - tenant isolated.
    
    Admin only. Clears the lockout for the specified email.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Clear the lockout
    result = await tenant_db.account_lockouts.delete_one({"email": email.lower()})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account lockout not found")
    
    # Log the admin action
    await log_security_event_async(
        db=tenant_db,
        event=SecurityEvent.ACCOUNT_UNLOCKED,
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "unlocked_email": email,
            "admin_action": True
        }
    )
    
    return {"message": f"Account {email} has been unlocked"}
