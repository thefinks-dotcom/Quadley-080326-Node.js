"""
Data Privacy Dashboard API Routes
==================================
Provides encryption status, PII field inventory, one-click migration,
scheduled compliance reports, and audit logging (GDPR/privacy reporting).
Super Admin and College Admin access only.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging
import uuid

from models import User
from utils.auth import get_current_user
from utils.multi_tenant import master_db, get_tenant_db, get_tenant_db_name
from utils.field_encryption import (
    encrypt_field,
    ENCRYPTED_PREFIX,
    DEFAULT_PII_FIELDS,
    is_encryption_enabled,
)
from utils.admin_audit import log_admin_action, AdminActionType

router = APIRouter(prefix="/privacy", tags=["privacy"])
logger = logging.getLogger(__name__)

# Collections and their PII fields to scan
PII_FIELD_MAP = {
    "users": ["phone", "emergency_contact", "emergency_contact_phone", "emergency_contact_name", "medical_info"],
    "safe_disclosures": ["preferred_contact"],
}


def _require_admin(user: User):
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")


async def _scan_collection(db, collection_name: str, fields: list[str]) -> dict:
    """Scan a collection and count encrypted vs unencrypted PII values."""
    total_docs = await db[collection_name].count_documents({})
    if total_docs == 0:
        return {
            "collection": collection_name,
            "total_documents": 0,
            "fields": {f: {"encrypted": 0, "unencrypted": 0, "empty": 0} for f in fields},
        }

    field_stats = {}
    for field in fields:
        encrypted = 0
        unencrypted = 0
        empty = 0
        cursor = db[collection_name].find({}, {"_id": 0, field: 1})
        async for doc in cursor:
            val = doc.get(field)
            if not val or not isinstance(val, str) or val.strip() == "":
                empty += 1
            elif val.startswith(ENCRYPTED_PREFIX):
                encrypted += 1
            else:
                unencrypted += 1
        field_stats[field] = {"encrypted": encrypted, "unencrypted": unencrypted, "empty": empty}

    return {
        "collection": collection_name,
        "total_documents": total_docs,
        "fields": field_stats,
    }


@router.get("/status")
async def get_encryption_status(current_user: User = Depends(get_current_user)):
    """
    Get encryption status across all relevant collections.
    Super admins see all tenants; college admins see their own tenant.
    """
    _require_admin(current_user)

    encryption_enabled = is_encryption_enabled()
    results = []

    if current_user.role == "super_admin":
        # Scan master DB collections
        for coll, fields in PII_FIELD_MAP.items():
            stats = await _scan_collection(master_db, coll, fields)
            stats["database"] = "quadley_master"
            results.append(stats)

        # Scan each tenant DB
        tenants = await master_db.tenants.find({}, {"_id": 0, "code": 1, "name": 1}).to_list(200)
        for tenant in tenants:
            t_db = get_tenant_db(tenant["code"])
            for coll, fields in PII_FIELD_MAP.items():
                stats = await _scan_collection(t_db, coll, fields)
                stats["database"] = get_tenant_db_name(tenant["code"])
                stats["tenant_code"] = tenant["code"]
                stats["tenant_name"] = tenant.get("name", tenant["code"])
                results.append(stats)
    else:
        # College admin — scan own tenant only
        tenant_code = getattr(current_user, "tenant_code", None)
        if not tenant_code:
            raise HTTPException(status_code=400, detail="No tenant context found")
        t_db = get_tenant_db(tenant_code)
        for coll, fields in PII_FIELD_MAP.items():
            stats = await _scan_collection(t_db, coll, fields)
            stats["database"] = get_tenant_db_name(tenant_code)
            stats["tenant_code"] = tenant_code
            results.append(stats)

    # Compute overall summary
    total_encrypted = 0
    total_unencrypted = 0
    total_empty = 0
    for r in results:
        for f_stats in r["fields"].values():
            total_encrypted += f_stats["encrypted"]
            total_unencrypted += f_stats["unencrypted"]
            total_empty += f_stats["empty"]

    total_pii = total_encrypted + total_unencrypted
    coverage_pct = round((total_encrypted / total_pii * 100) if total_pii > 0 else 100, 1)

    return {
        "encryption_enabled": encryption_enabled,
        "algorithm": "AES-256-GCM",
        "summary": {
            "total_pii_values": total_pii,
            "encrypted": total_encrypted,
            "unencrypted": total_unencrypted,
            "empty_fields": total_empty,
            "coverage_percent": coverage_pct,
        },
        "collections": results,
        "pii_field_definitions": PII_FIELD_MAP,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/fields")
async def get_pii_field_inventory(current_user: User = Depends(get_current_user)):
    """Return the PII field inventory — which fields are tracked for encryption."""
    _require_admin(current_user)

    inventory = []
    for coll, fields in PII_FIELD_MAP.items():
        for field in fields:
            inventory.append({
                "collection": coll,
                "field": field,
                "encryption_type": "AES-256-GCM",
                "is_default": field in DEFAULT_PII_FIELDS,
            })

    return {
        "encryption_enabled": is_encryption_enabled(),
        "algorithm": "AES-256-GCM",
        "key_source": "ENCRYPTION_KEY or JWT_SECRET (SHA-256 derived)",
        "fields": inventory,
        "total_tracked_fields": len(inventory),
    }


@router.post("/migrate")
async def migrate_encrypt_pii(
    request: Request,
    current_user: User = Depends(get_current_user),
    dry_run: bool = False,
):
    """
    One-click migration: encrypt all unencrypted PII values in the database.
    Pass ?dry_run=true to preview without making changes.
    """
    _require_admin(current_user)

    if not is_encryption_enabled():
        raise HTTPException(status_code=400, detail="Encryption is not configured. Set ENCRYPTION_KEY or JWT_SECRET.")

    migration_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc)
    results = []
    total_migrated = 0

    async def _migrate_collection(db, db_name: str, coll_name: str, fields: list[str], tenant_code: str = None):
        nonlocal total_migrated
        migrated = 0
        cursor = db[coll_name].find({}, {"_id": 1, **{f: 1 for f in fields}})
        async for doc in cursor:
            updates = {}
            for field in fields:
                val = doc.get(field)
                if val and isinstance(val, str) and not val.startswith(ENCRYPTED_PREFIX):
                    updates[field] = encrypt_field(val)
            if updates and not dry_run:
                await db[coll_name].update_one({"_id": doc["_id"]}, {"$set": updates})
                migrated += len(updates)
            elif updates:
                migrated += len(updates)
        total_migrated += migrated
        results.append({
            "database": db_name,
            "collection": coll_name,
            "tenant_code": tenant_code,
            "fields_encrypted": migrated,
        })

    if current_user.role == "super_admin":
        # Master DB
        for coll, fields in PII_FIELD_MAP.items():
            await _migrate_collection(master_db, "quadley_master", coll, fields)

        # All tenant DBs
        tenants = await master_db.tenants.find({}, {"_id": 0, "code": 1}).to_list(200)
        for tenant in tenants:
            t_db = get_tenant_db(tenant["code"])
            for coll, fields in PII_FIELD_MAP.items():
                await _migrate_collection(t_db, get_tenant_db_name(tenant["code"]), coll, fields, tenant["code"])
    else:
        tenant_code = getattr(current_user, "tenant_code", None)
        if not tenant_code:
            raise HTTPException(status_code=400, detail="No tenant context found")
        t_db = get_tenant_db(tenant_code)
        for coll, fields in PII_FIELD_MAP.items():
            await _migrate_collection(t_db, get_tenant_db_name(tenant_code), coll, fields, tenant_code)

    # Log the migration
    migration_record = {
        "id": migration_id,
        "type": "pii_encryption_migration",
        "dry_run": dry_run,
        "admin_id": current_user.id,
        "admin_email": current_user.email,
        "total_fields_encrypted": total_migrated,
        "details": results,
        "started_at": now.isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    if not dry_run:
        await master_db.privacy_audit_log.insert_one(migration_record)

    # Audit log
    if not dry_run:
        await log_admin_action(
            master_db,
            admin_id=current_user.id,
            admin_email=current_user.email,
            action_type=AdminActionType.DATA_MODIFICATION,
            target_type="pii_encryption",
            target_id=migration_id,
            target_name="PII Field Encryption Migration",
            details={"total_fields_encrypted": total_migrated},
            tenant_code=getattr(current_user, "tenant_code", "system"),
            ip_address=request.client.host if request.client else None,
        )

    return {
        "migration_id": migration_id,
        "dry_run": dry_run,
        "total_fields_encrypted": total_migrated,
        "details": results,
        "started_at": now.isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/audit-log")
async def get_privacy_audit_log(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
):
    """Get history of encryption migrations and privacy-related actions."""
    _require_admin(current_user)

    logs = await master_db.privacy_audit_log.find(
        {},
        {"_id": 0},
    ).sort("completed_at", -1).to_list(limit)

    return {"logs": logs, "total": len(logs)}


# ──────────────────────────────────────────────
# Weekly Privacy Compliance Report
# ──────────────────────────────────────────────

SCHEDULE_DOC_ID = "privacy_compliance_schedule"

DEFAULT_SCHEDULE = {
    "id": SCHEDULE_DOC_ID,
    "enabled": True,
    "frequency": "weekly",
    "day_of_week": "monday",      # monday–sunday
    "hour_utc": 8,                # 0–23
    "recipients": "super_admins", # super_admins | all_admins
    "last_sent_at": None,
    "next_run_at": None,
}


class ScheduleUpdate(BaseModel):
    enabled: Optional[bool] = None
    day_of_week: Optional[str] = None
    hour_utc: Optional[int] = None
    recipients: Optional[str] = None


async def _generate_compliance_report_data() -> dict:
    """Scan all DBs and build a compliance report payload (reuses _scan_collection)."""
    results = []
    # Master DB
    for coll, fields in PII_FIELD_MAP.items():
        stats = await _scan_collection(master_db, coll, fields)
        stats["database"] = "quadley_master"
        results.append(stats)

    # Tenant DBs
    tenants = await master_db.tenants.find({}, {"_id": 0, "code": 1, "name": 1}).to_list(200)
    for tenant in tenants:
        t_db = get_tenant_db(tenant["code"])
        for coll, fields in PII_FIELD_MAP.items():
            stats = await _scan_collection(t_db, coll, fields)
            stats["database"] = get_tenant_db_name(tenant["code"])
            stats["tenant_code"] = tenant["code"]
            stats["tenant_name"] = tenant.get("name", tenant["code"])
            results.append(stats)

    total_enc = sum(f["encrypted"] for r in results for f in r["fields"].values())
    total_unenc = sum(f["unencrypted"] for r in results for f in r["fields"].values())
    total_empty = sum(f["empty"] for r in results for f in r["fields"].values())
    total_pii = total_enc + total_unenc
    coverage = round((total_enc / total_pii * 100) if total_pii > 0 else 100, 1)

    # Collect flagged items (unencrypted PII)
    flagged = []
    for r in results:
        for field_name, stats in r["fields"].items():
            if stats["unencrypted"] > 0:
                flagged.append({
                    "database": r["database"],
                    "collection": r["collection"],
                    "field": field_name,
                    "unencrypted_count": stats["unencrypted"],
                    "tenant_code": r.get("tenant_code"),
                    "tenant_name": r.get("tenant_name"),
                })

    return {
        "total_pii_values": total_pii,
        "encrypted": total_enc,
        "unencrypted": total_unenc,
        "empty_fields": total_empty,
        "coverage_percent": coverage,
        "collections_scanned": len(results),
        "tenants_scanned": len(tenants),
        "flagged_items": flagged,
        "encryption_enabled": is_encryption_enabled(),
        "algorithm": "AES-256-GCM",
    }


def _build_report_html(report: dict, generated_at: str) -> str:
    """Build a styled HTML email for the compliance report."""
    coverage = report["coverage_percent"]
    color = "#16a34a" if coverage == 100 else "#d97706" if coverage >= 80 else "#dc2626"
    status_text = "COMPLIANT" if coverage == 100 else "ACTION NEEDED" if coverage >= 80 else "AT RISK"

    flagged_rows = ""
    for f in report["flagged_items"]:
        tenant_label = f.get("tenant_name") or f.get("tenant_code") or "master"
        flagged_rows += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">{tenant_label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px;">{f['collection']}.{f['field']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#dc2626;font-weight:600;">{f['unencrypted_count']}</td>
        </tr>"""

    flagged_section = ""
    if flagged_rows:
        flagged_section = f"""
        <div style="margin-top:24px;">
          <h3 style="margin:0 0 12px;font-size:16px;color:#dc2626;">Flagged: Unencrypted PII</h3>
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Tenant</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Collection.Field</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#6b7280;">Count</th>
              </tr>
            </thead>
            <tbody>{flagged_rows}</tbody>
          </table>
        </div>"""
    else:
        flagged_section = """
        <div style="margin-top:24px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;">
          <p style="margin:0;color:#16a34a;font-weight:600;">All PII data is encrypted. No action required.</p>
        </div>"""

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;max-width:640px;margin:0 auto;padding:20px;background:#f8fafc;">
  <div style="background:#0f172a;padding:28px 32px;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Privacy Compliance Report</h1>
    <p style="color:#94a3b8;margin:6px 0 0;font-size:14px;">{generated_at}</p>
  </div>
  <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <div>
        <p style="margin:0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Encryption Coverage</p>
        <p style="margin:4px 0 0;font-size:36px;font-weight:700;color:{color};">{coverage}%</p>
      </div>
      <div style="padding:8px 16px;background:{color}15;border:2px solid {color};border-radius:8px;">
        <span style="font-weight:700;font-size:14px;color:{color};">{status_text}</span>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:12px;text-align:center;background:#f0fdf4;border-radius:8px;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">{report['encrypted']}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Encrypted</p>
        </td>
        <td style="width:12px;"></td>
        <td style="padding:12px;text-align:center;background:#fef2f2;border-radius:8px;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626;">{report['unencrypted']}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Unencrypted</p>
        </td>
        <td style="width:12px;"></td>
        <td style="padding:12px;text-align:center;background:#f8fafc;border-radius:8px;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#475569;">{report['empty_fields']}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Empty</p>
        </td>
      </tr>
    </table>

    <div style="padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:8px;">
      <span style="font-size:13px;color:#64748b;">Algorithm:</span>
      <span style="font-size:13px;font-weight:600;color:#0f172a;margin-left:8px;">{report['algorithm']}</span>
    </div>
    <div style="padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:8px;">
      <span style="font-size:13px;color:#64748b;">Collections scanned:</span>
      <span style="font-size:13px;font-weight:600;color:#0f172a;margin-left:8px;">{report['collections_scanned']}</span>
    </div>
    <div style="padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <span style="font-size:13px;color:#64748b;">Tenants scanned:</span>
      <span style="font-size:13px;font-weight:600;color:#0f172a;margin-left:8px;">{report['tenants_scanned']}</span>
    </div>

    {flagged_section}

    <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
      Quadley Privacy Compliance &mdash; Automated weekly report
    </p>
  </div>
</body></html>"""


async def send_compliance_report(triggered_by: str = "scheduler") -> dict:
    """Generate and email the compliance report to all super admins."""
    from utils.email_service import send_email as send_email_async, is_email_enabled

    report_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc)
    generated_at = now.strftime("%B %d, %Y at %H:%M UTC")

    # Generate report data
    report_data = await _generate_compliance_report_data()
    html = _build_report_html(report_data, generated_at)

    # Find super admin emails
    super_admins = await master_db.super_admins.find({}, {"_id": 0, "email": 1}).to_list(50)
    recipients = [sa["email"] for sa in super_admins if sa.get("email")]

    # Optionally include tenant admins
    schedule = await master_db.privacy_schedule.find_one({"id": SCHEDULE_DOC_ID}, {"_id": 0})
    if schedule and schedule.get("recipients") == "all_admins":
        tenants = await master_db.tenants.find({}, {"_id": 0, "code": 1}).to_list(200)
        for t in tenants:
            t_db = get_tenant_db(t["code"])
            admins = await t_db.users.find({"role": "admin"}, {"_id": 0, "email": 1}).to_list(50)
            recipients.extend(a["email"] for a in admins if a.get("email"))
    recipients = list(set(recipients))

    # Send emails
    email_results = []
    if is_email_enabled() and recipients:
        subject = f"Quadley Privacy Report — {report_data['coverage_percent']}% Coverage"
        for email in recipients:
            result = await send_email_async(email, subject, html)
            email_results.append({"email": email, "success": result.get("success", False)})
    else:
        for email in recipients:
            email_results.append({"email": email, "success": False, "reason": "email_disabled"})

    # Store report
    report_record = {
        "id": report_id,
        "type": "compliance_report",
        "triggered_by": triggered_by,
        "report_data": report_data,
        "recipients": email_results,
        "recipients_count": len(recipients),
        "emails_sent": sum(1 for r in email_results if r.get("success")),
        "generated_at": now.isoformat(),
    }
    await master_db.privacy_compliance_reports.insert_one(report_record)

    # Update schedule last_sent_at
    await master_db.privacy_schedule.update_one(
        {"id": SCHEDULE_DOC_ID},
        {"$set": {"last_sent_at": now.isoformat()}},
        upsert=True,
    )

    return {
        "report_id": report_id,
        "coverage_percent": report_data["coverage_percent"],
        "flagged_count": len(report_data["flagged_items"]),
        "recipients_count": len(recipients),
        "emails_sent": sum(1 for r in email_results if r.get("success")),
        "email_results": email_results,
        "generated_at": now.isoformat(),
    }


@router.get("/compliance-reports")
async def list_compliance_reports(
    current_user: User = Depends(get_current_user),
    limit: int = 20,
):
    """List past compliance reports."""
    _require_admin(current_user)
    reports = await master_db.privacy_compliance_reports.find(
        {}, {"_id": 0}
    ).sort("generated_at", -1).to_list(limit)
    return {"reports": reports, "total": len(reports)}


@router.post("/compliance-reports/send")
async def send_report_now(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a compliance report send."""
    _require_admin(current_user)
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can send compliance reports")

    result = await send_compliance_report(triggered_by=current_user.email)
    return result


@router.get("/compliance-reports/schedule")
async def get_report_schedule(current_user: User = Depends(get_current_user)):
    """Get the current compliance report schedule."""
    _require_admin(current_user)
    schedule = await master_db.privacy_schedule.find_one({"id": SCHEDULE_DOC_ID}, {"_id": 0})
    if not schedule:
        schedule = dict(DEFAULT_SCHEDULE)
    return schedule


@router.post("/compliance-reports/schedule")
async def update_report_schedule(
    update: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update the compliance report schedule."""
    _require_admin(current_user)
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can configure the schedule")

    valid_days = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
    if update.day_of_week and update.day_of_week.lower() not in valid_days:
        raise HTTPException(status_code=400, detail=f"day_of_week must be one of {valid_days}")
    if update.hour_utc is not None and not (0 <= update.hour_utc <= 23):
        raise HTTPException(status_code=400, detail="hour_utc must be 0–23")
    if update.recipients and update.recipients not in ("super_admins", "all_admins"):
        raise HTTPException(status_code=400, detail="recipients must be 'super_admins' or 'all_admins'")

    update_fields = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_fields.get("day_of_week"):
        update_fields["day_of_week"] = update_fields["day_of_week"].lower()
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    await master_db.privacy_schedule.update_one(
        {"id": SCHEDULE_DOC_ID},
        {"$set": update_fields, "$setOnInsert": {k: v for k, v in DEFAULT_SCHEDULE.items() if k not in update_fields}},
        upsert=True,
    )

    schedule = await master_db.privacy_schedule.find_one({"id": SCHEDULE_DOC_ID}, {"_id": 0})
    return schedule
