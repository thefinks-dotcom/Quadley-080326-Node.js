"""
IP-based Anomaly Detection Utility
===================================
Detects suspicious login patterns:
- Login from a previously unseen IP address
- Rapid IP changes (multiple distinct IPs in a short window)
- Brute-force indicators (many failed attempts from one IP)
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from utils.multi_tenant import master_db

logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {
    "new_ip_alerts_enabled": True,
    "rapid_ip_window_minutes": 60,
    "rapid_ip_threshold": 3,
    "brute_force_window_minutes": 15,
    "brute_force_threshold": 5,
    "alert_email_enabled": True,
}


async def get_anomaly_settings() -> dict:
    """Get anomaly detection settings from master DB."""
    settings = await master_db.ip_anomaly_settings.find_one(
        {"_key": "global"}, {"_id": 0}
    )
    if not settings:
        return dict(DEFAULT_SETTINGS)
    merged = dict(DEFAULT_SETTINGS)
    merged.update({k: v for k, v in settings.items() if k != "_key"})
    return merged


async def record_login_ip(
    user_id: str,
    email: str,
    ip_address: str,
    tenant_code: Optional[str] = None,
    user_agent: Optional[str] = None,
    success: bool = True,
):
    """Record an IP used during a login attempt."""
    await master_db.ip_login_history.insert_one({
        "user_id": user_id,
        "email": email,
        "ip_address": ip_address,
        "tenant_code": tenant_code,
        "user_agent": user_agent or "",
        "success": success,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def detect_anomalies(
    user_id: str,
    email: str,
    ip_address: str,
    tenant_code: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """Run all anomaly checks after a successful login. Returns list of alerts created."""
    settings = await get_anomaly_settings()
    alerts = []

    # --- 1. New IP Detection ---
    if settings.get("new_ip_alerts_enabled", True):
        known = await master_db.ip_login_history.find_one({
            "user_id": user_id,
            "ip_address": ip_address,
            "success": True,
        })
        if not known:
            alert = await _create_alert(
                alert_type="new_ip",
                severity="medium",
                user_id=user_id,
                email=email,
                ip_address=ip_address,
                tenant_code=tenant_code,
                details={
                    "message": f"First login from IP {ip_address}",
                    "user_agent": user_agent or "",
                },
            )
            alerts.append(alert)

    # --- 2. Rapid IP Change Detection ---
    window_mins = settings.get("rapid_ip_window_minutes", 60)
    threshold = settings.get("rapid_ip_threshold", 3)
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=window_mins)).isoformat()

    recent_logins = await master_db.ip_login_history.find(
        {"user_id": user_id, "success": True, "timestamp": {"$gte": cutoff}},
        {"_id": 0, "ip_address": 1},
    ).to_list(500)

    distinct_ips = set(r["ip_address"] for r in recent_logins)
    distinct_ips.add(ip_address)

    if len(distinct_ips) >= threshold:
        already_alerted = await master_db.ip_anomaly_alerts.find_one({
            "user_id": user_id,
            "alert_type": "rapid_ip_change",
            "resolved": False,
            "created_at": {"$gte": cutoff},
        })
        if not already_alerted:
            alert = await _create_alert(
                alert_type="rapid_ip_change",
                severity="high",
                user_id=user_id,
                email=email,
                ip_address=ip_address,
                tenant_code=tenant_code,
                details={
                    "message": f"{len(distinct_ips)} distinct IPs in {window_mins} min",
                    "ips": list(distinct_ips),
                },
            )
            alerts.append(alert)

    # --- 3. Brute-Force Detection (per IP, across all users) ---
    bf_window = settings.get("brute_force_window_minutes", 15)
    bf_threshold = settings.get("brute_force_threshold", 5)
    bf_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=bf_window)).isoformat()

    failed_count = await master_db.ip_login_history.count_documents({
        "ip_address": ip_address,
        "success": False,
        "timestamp": {"$gte": bf_cutoff},
    })

    if failed_count >= bf_threshold:
        already_alerted = await master_db.ip_anomaly_alerts.find_one({
            "ip_address": ip_address,
            "alert_type": "brute_force",
            "resolved": False,
            "created_at": {"$gte": bf_cutoff},
        })
        if not already_alerted:
            alert = await _create_alert(
                alert_type="brute_force",
                severity="critical",
                user_id=user_id,
                email=email,
                ip_address=ip_address,
                tenant_code=tenant_code,
                details={
                    "message": f"{failed_count} failed logins from {ip_address} in {bf_window} min",
                    "failed_count": failed_count,
                },
            )
            alerts.append(alert)

    return alerts


async def _create_alert(
    alert_type: str,
    severity: str,
    user_id: str,
    email: str,
    ip_address: str,
    tenant_code: Optional[str],
    details: dict,
) -> dict:
    """Persist an anomaly alert and optionally email admins."""
    import uuid

    alert = {
        "id": f"alert_{uuid.uuid4().hex[:12]}",
        "alert_type": alert_type,
        "severity": severity,
        "user_id": user_id,
        "email": email,
        "ip_address": ip_address,
        "tenant_code": tenant_code,
        "details": details,
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await master_db.ip_anomaly_alerts.insert_one(alert)
    logger.warning(f"IP Anomaly Alert [{severity.upper()}]: {alert_type} — {email} @ {ip_address}")

    # Send email to super admins if enabled
    settings = await get_anomaly_settings()
    if settings.get("alert_email_enabled", True):
        try:
            await _email_admins(alert)
        except Exception as e:
            logger.error(f"Failed to email admins about IP anomaly: {e}")

    # Remove _id before returning
    alert.pop("_id", None)
    return alert


async def _email_admins(alert: dict):
    """Send alert email to all super admins."""
    from utils.email import send_email

    admins = await master_db.super_admins.find(
        {}, {"_id": 0, "email": 1, "first_name": 1}
    ).to_list(50)

    severity_colors = {
        "low": "#3b82f6",
        "medium": "#f59e0b",
        "high": "#f97316",
        "critical": "#ef4444",
    }
    color = severity_colors.get(alert["severity"], "#6b7280")

    type_labels = {
        "new_ip": "New IP Address Detected",
        "rapid_ip_change": "Rapid IP Change",
        "brute_force": "Brute-Force Attempt",
    }
    label = type_labels.get(alert["alert_type"], alert["alert_type"])

    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:{color}">Security Alert: {label}</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;font-weight:600">Severity</td><td>{alert['severity'].upper()}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600">User</td><td>{alert['email']}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600">IP Address</td><td>{alert['ip_address']}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600">Details</td><td>{alert['details'].get('message','')}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600">Time (UTC)</td><td>{alert['created_at']}</td></tr>
      </table>
      <p style="margin-top:16px;color:#64748b;font-size:13px">
        Review this alert in the Quadley Security Alerts dashboard.
      </p>
    </div>
    """

    for admin in admins:
        try:
            send_email(
                to=admin["email"],
                subject=f"[Quadley Security] {label} — {alert['email']}",
                html_content=html,
            )
        except Exception as e:
            logger.error(f"Failed to send IP anomaly email to {admin['email']}: {e}")
