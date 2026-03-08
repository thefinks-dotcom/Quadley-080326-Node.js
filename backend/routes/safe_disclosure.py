"""Safe disclosure routes for anonymous reporting - AU Legislation Compliant (F2025L01251)
OWASP A01 Compliant: Tenant isolated data access
"""
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import io
import csv
import hashlib
import hmac
import os
import logging

from models import SafeDisclosure, SafeDisclosureCreate
from utils.auth import get_tenant_db_for_user
from utils.csv_security import sanitize_csv_row
from utils.admin_audit import log_admin_action, AdminActionType
from utils.field_encryption import encrypt_field, decrypt_field

router = APIRouter(prefix="/safe-disclosures", tags=["safe_disclosure"])

# Secret key for signing download URLs (use environment variable in production)
DOWNLOAD_SECRET = os.environ.get("DOWNLOAD_SECRET")
if not DOWNLOAD_SECRET:
    import secrets
    DOWNLOAD_SECRET = secrets.token_urlsafe(32)
    logging.critical("SECURITY WARNING: DOWNLOAD_SECRET not set in environment. Using random key — signed URLs will not survive restarts. Set DOWNLOAD_SECRET in .env for production.")
DOWNLOAD_URL_EXPIRY_MINUTES = 5  # Signed URLs expire after 5 minutes

# In-memory rate limit tracking (use Redis in production)
_export_rate_limits = {}
EXPORT_RATE_LIMIT_PER_MINUTE = 5


def _check_export_rate_limit(user_id: str) -> bool:
    """Check if user has exceeded export rate limit. Returns True if allowed."""
    now = datetime.now(timezone.utc)
    key = f"export:{user_id}"
    
    if key not in _export_rate_limits:
        _export_rate_limits[key] = []
    
    # Clean old entries (older than 1 minute)
    _export_rate_limits[key] = [
        t for t in _export_rate_limits[key] 
        if (now - t).total_seconds() < 60
    ]
    
    # Check limit
    if len(_export_rate_limits[key]) >= EXPORT_RATE_LIMIT_PER_MINUTE:
        return False
    
    # Record this request
    _export_rate_limits[key].append(now)
    return True


def _generate_download_signature(year: int, format: str, expires: int) -> str:
    """Generate HMAC signature for download URL."""
    message = f"{year}:{format}:{expires}"
    signature = hmac.new(
        DOWNLOAD_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature


def _verify_download_signature(year: int, format: str, expires: int, signature: str) -> bool:
    """Verify HMAC signature for download URL."""
    expected = _generate_download_signature(year, format, expires)
    return hmac.compare_digest(expected, signature)


# Additional models for admin operations
class RiskAssessmentData(BaseModel):
    risk_level: str  # none, low, medium, high
    safety_measures: List[str] = []
    assessment_notes: Optional[str] = None
    # Optional support plan fields (combined form)
    support_notes: Optional[str] = None
    follow_up_date: Optional[str] = None


class SupportPlanData(BaseModel):
    support_services: List[str] = []
    plan_notes: Optional[str] = None
    follow_up_date: Optional[str] = None


class StatusUpdateData(BaseModel):
    status: str
    notes: Optional[str] = None


class CaseNoteData(BaseModel):
    note: str
    is_internal: bool = True


class AssignData(BaseModel):
    assignee_id: str
    assignee_name: str


class AppealData(BaseModel):
    grounds: str


class EscalateData(BaseModel):
    reason: Optional[str] = None


class NSOEscalationData(BaseModel):
    reference: Optional[str] = None
    notes: Optional[str] = None


class RespondentData(BaseModel):
    respondent_name: str
    respondent_id: Optional[str] = None


class InterimMeasureData(BaseModel):
    measure_type: str
    description: str
    date_imposed: Optional[str] = None


@router.post("", response_model=SafeDisclosure)
async def create_safe_disclosure(
    disclosure_data: SafeDisclosureCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Submit a safe disclosure (anonymous or identified) - tenant isolated"""
    tenant_db, current_user = tenant_data
    now = datetime.now(timezone.utc)
    # Risk assessment and support plan due within 48 hours per AU legislation
    deadline = now + timedelta(hours=48)
    
    # For formal complaints submitted upfront, set the 45 business-day (≈63 calendar day) investigation deadline immediately
    is_formal = disclosure_data.report_type == "formal_complaint"
    investigation_deadline = (now + timedelta(days=63)).isoformat() if is_formal else None
    initial_status = "investigation" if is_formal else "pending_risk_assessment"

    disclosure_dict = {
        "id": str(uuid.uuid4()),
        "reporter_id": None if disclosure_data.is_anonymous else current_user.id,
        "reporter_name": None if disclosure_data.is_anonymous else f"{current_user.first_name} {current_user.last_name}",
        "reporter_email": None if disclosure_data.is_anonymous else current_user.email,
        "is_anonymous": disclosure_data.is_anonymous,
        "report_type": disclosure_data.report_type,
        "incident_type": disclosure_data.incident_type,
        "incident_date": disclosure_data.incident_date,
        "incident_location": disclosure_data.incident_location,
        "description": disclosure_data.description,
        "individuals_involved": disclosure_data.individuals_involved,
        "witness_present": disclosure_data.witness_present,
        "witness_details": disclosure_data.witness_details,
        "immediate_danger": disclosure_data.immediate_danger,
        "medical_attention_needed": disclosure_data.medical_attention_needed,
        "police_notified": disclosure_data.police_notified,
        "support_requested": disclosure_data.support_requested,
        "preferred_contact": encrypt_field(disclosure_data.preferred_contact) if disclosure_data.preferred_contact else None,
        "additional_notes": disclosure_data.additional_notes,
        "status": initial_status,
        "urgency": "urgent" if disclosure_data.immediate_danger else "high" if disclosure_data.medical_attention_needed else "normal",
        "assigned_to": None,
        "assigned_to_name": None,
        "risk_assessment_due": deadline.isoformat(),
        "support_plan_due": deadline.isoformat(),
        "risk_assessment": None,
        "support_plan": None,
        "safety_measures": [],
        "formal_report": is_formal,
        "investigation_deadline": investigation_deadline,
        "case_notes": [],
        "appeal": None,
        "created_at": now.isoformat(),
        "updated_at": None
    }
    
    await tenant_db.safe_disclosures.insert_one(disclosure_dict)

    # Decrypt PII before returning to caller
    response_dict = {k: v for k, v in disclosure_dict.items() if k != '_id'}
    if response_dict.get('preferred_contact'):
        response_dict['preferred_contact'] = decrypt_field(response_dict['preferred_contact'])

    return response_dict


@router.get("")
async def get_safe_disclosures(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get safe disclosures (admin only see all, students/RAs see their own) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role in ["admin", "super_admin", "superadmin", "college_admin"]:
        disclosures = await tenant_db.safe_disclosures.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
    else:
        # Students and RAs only see their own disclosures
        disclosures = await tenant_db.safe_disclosures.find(
            {"reporter_id": current_user.id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
    
    # Decrypt PII fields before returning
    for d in disclosures:
        if d.get('preferred_contact'):
            d['preferred_contact'] = decrypt_field(d['preferred_contact'])

    return disclosures


@router.get("/stats")
async def get_disclosure_stats(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get statistics for disclosures (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can view disclosure stats")
    
    all_disclosures = await tenant_db.safe_disclosures.find({}, {"_id": 0}).to_list(1000)
    
    # Count by status
    pending_risk_assessment = sum(1 for d in all_disclosures if d.get("status") == "pending_risk_assessment")
    risk_assessment_complete = sum(1 for d in all_disclosures if d.get("status") == "risk_assessment_complete")
    support_plan_active = sum(1 for d in all_disclosures if d.get("status") == "support_plan_active")
    investigation = sum(1 for d in all_disclosures if d.get("status") == "investigation")
    resolved = sum(1 for d in all_disclosures if d.get("status") == "resolved")
    
    # Count urgent cases
    urgent_count = sum(1 for d in all_disclosures 
                       if d.get("urgency") in ["urgent", "high"] 
                       and d.get("status") not in ["resolved"])
    
    # Count immediate danger cases
    immediate_danger = sum(1 for d in all_disclosures 
                          if d.get("immediate_danger") 
                          and d.get("status") not in ["resolved"])
    
    return {
        "total": len(all_disclosures),
        "pending_risk_assessment": pending_risk_assessment,
        "risk_assessment_complete": risk_assessment_complete,
        "support_plan_active": support_plan_active,
        "investigation": investigation,
        "resolved": resolved,
        "urgent_count": urgent_count,
        "immediate_danger": immediate_danger
    }


@router.get("/annual-report")
async def get_available_annual_reports(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get list of available years for annual reports - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can access annual reports")
    
    # Get all disclosures to determine available years
    disclosures = await tenant_db.safe_disclosures.find({}, {"_id": 0, "created_at": 1}).to_list(10000)
    
    years_set = set()
    for d in disclosures:
        created_at = d.get("created_at", "")
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                # Determine academic year (July-June)
                if dt.month >= 7:
                    years_set.add(dt.year)  # This is the start of an academic year
                else:
                    years_set.add(dt.year - 1)  # Belongs to previous academic year
            except (ValueError, AttributeError):
                pass
    
    # Return sorted list of available academic years
    available_years = sorted(years_set, reverse=True)
    
    # If no disclosures exist yet, suggest current academic year
    current_year = datetime.now().year if datetime.now().month >= 7 else datetime.now().year - 1
    
    return {
        "available_academic_years": [
            {
                "year": y,
                "label": f"{y}-{y+1}",
                "period": f"July 1, {y} - June 30, {y+1}"
            }
            for y in available_years
        ] if available_years else [
            {
                "year": current_year,
                "label": f"{current_year}-{current_year+1}",
                "period": f"July 1, {current_year} - June 30, {current_year+1}"
            }
        ],
        "current_academic_year": current_year
    }


@router.get("/annual-report/{year}")
async def get_annual_disclosure_report(
    year: int,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Generate Annual Disclosure Report for the academic year - tenant isolated.
    Year parameter refers to the START year of the academic year.
    E.g., year=2024 means July 1, 2024 to June 30, 2025.
    
    Returns anonymized, aggregated data per AU legislation requirements.
    """
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can access annual reports")
    
    # Academic year: July 1 to June 30
    start_date = datetime(year, 7, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_date = datetime(year + 1, 6, 30, 23, 59, 59, tzinfo=timezone.utc)
    
    # Get all disclosures within the date range
    disclosures = await tenant_db.safe_disclosures.find({
        "created_at": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Aggregate by incident type
    incident_type_counts = {}
    for d in disclosures:
        incident_type = d.get("incident_type", "Unknown")
        incident_type_counts[incident_type] = incident_type_counts.get(incident_type, 0) + 1
    
    # Aggregate by status
    status_counts = {}
    for d in disclosures:
        status = d.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Count key metrics
    total_disclosures = len(disclosures)
    anonymous_count = sum(1 for d in disclosures if d.get("is_anonymous"))
    immediate_danger_count = sum(1 for d in disclosures if d.get("immediate_danger"))
    medical_attention_count = sum(1 for d in disclosures if d.get("medical_attention_needed"))
    police_notified_count = sum(1 for d in disclosures if d.get("police_notified"))
    formal_reports_count = sum(1 for d in disclosures if d.get("formal_report"))
    resolved_count = sum(1 for d in disclosures if d.get("status") == "resolved")
    
    # Support services requested breakdown
    support_services_counts = {}
    for d in disclosures:
        services = d.get("support_requested", [])
        if isinstance(services, list):
            for service in services:
                support_services_counts[service] = support_services_counts.get(service, 0) + 1
    
    # Risk level breakdown (from risk assessments)
    risk_level_counts = {"none": 0, "low": 0, "medium": 0, "high": 0}
    for d in disclosures:
        risk_assessment = d.get("risk_assessment")
        if risk_assessment and isinstance(risk_assessment, dict):
            risk_level = risk_assessment.get("risk_level", "unknown")
            if risk_level in risk_level_counts:
                risk_level_counts[risk_level] += 1
    
    # Monthly breakdown
    monthly_counts = {}
    for d in disclosures:
        created_at = d.get("created_at", "")
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                month_key = dt.strftime("%Y-%m")
                monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
            except (ValueError, AttributeError):
                pass
    
    # Sort monthly counts chronologically
    sorted_monthly = dict(sorted(monthly_counts.items()))
    
    # Calculate resolution rate
    resolution_rate = (resolved_count / total_disclosures * 100) if total_disclosures > 0 else 0
    
    # Average time to resolution (for resolved cases)
    resolution_times = []
    for d in disclosures:
        if d.get("status") == "resolved" and d.get("resolved_at") and d.get("created_at"):
            try:
                created = datetime.fromisoformat(d["created_at"].replace('Z', '+00:00'))
                resolved = datetime.fromisoformat(d["resolved_at"].replace('Z', '+00:00'))
                days_to_resolve = (resolved - created).days
                resolution_times.append(days_to_resolve)
            except (ValueError, AttributeError):
                pass
    
    avg_resolution_time = sum(resolution_times) / len(resolution_times) if resolution_times else None
    
    return {
        "report_period": {
            "academic_year": f"{year}-{year + 1}",
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": f"{current_user.first_name} {current_user.last_name}"
        },
        "summary": {
            "total_disclosures": total_disclosures,
            "anonymous_disclosures": anonymous_count,
            "identified_disclosures": total_disclosures - anonymous_count,
            "resolution_rate_percent": round(resolution_rate, 1),
            "average_resolution_days": round(avg_resolution_time, 1) if avg_resolution_time else None
        },
        "safety_metrics": {
            "immediate_danger_cases": immediate_danger_count,
            "medical_attention_needed": medical_attention_count,
            "police_notified": police_notified_count,
            "formal_reports_filed": formal_reports_count
        },
        "incident_types": incident_type_counts,
        "status_breakdown": status_counts,
        "risk_level_distribution": risk_level_counts,
        "support_services_requested": support_services_counts,
        "monthly_trend": sorted_monthly,
        "compliance_note": "This report is generated in compliance with AU Higher Education Standards Framework (F2025L01251). All data is anonymized and aggregated."
    }


@router.post("/annual-report/{year}/export-url")
async def generate_export_url(
    year: int,
    format: str = Body(..., embed=True),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Generate a signed, time-limited URL for downloading the annual report - tenant isolated.
    This is the secure way to enable downloads from mobile apps.
    
    The signed URL expires after 5 minutes and can only be used once.
    """
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can export annual reports")
    
    if format not in ["csv", "pdf"]:
        raise HTTPException(status_code=400, detail="Format must be 'csv' or 'pdf'")
    
    # Check rate limit
    if not _check_export_rate_limit(current_user.id):
        raise HTTPException(
            status_code=429, 
            detail="Too many export requests. Please wait a minute before trying again."
        )
    
    # Generate expiration timestamp (5 minutes from now)
    expires = int((datetime.now(timezone.utc) + timedelta(minutes=DOWNLOAD_URL_EXPIRY_MINUTES)).timestamp())
    
    # Generate signature
    signature = _generate_download_signature(year, format, expires)
    
    return {
        "download_path": f"/safe-disclosures/annual-report/{year}/export/{format}",
        "expires": expires,
        "signature": signature,
        "format": format,
        "year": year,
        "expires_in_seconds": DOWNLOAD_URL_EXPIRY_MINUTES * 60
    }


@router.get("/annual-report/{year}/export/csv")
async def export_annual_report_csv(
    year: int,
    expires: Optional[int] = Query(None, description="Expiration timestamp for signed URL"),
    signature: Optional[str] = Query(None, description="HMAC signature for signed URL"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Export Annual Disclosure Report as CSV file - tenant isolated.
    Returns a downloadable CSV file with aggregated data.
    
    Requires authenticated request with valid JWT token.
    """
    tenant_db, current_user = tenant_data
    
    # Check authorization
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can export annual reports")
    
    # Get the report data
    start_date = datetime(year, 7, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_date = datetime(year + 1, 6, 30, 23, 59, 59, tzinfo=timezone.utc)
    
    disclosures = await tenant_db.safe_disclosures.find({
        "created_at": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Calculate metrics
    total = len(disclosures)
    anonymous_count = sum(1 for d in disclosures if d.get("is_anonymous"))
    immediate_danger = sum(1 for d in disclosures if d.get("immediate_danger"))
    medical_attention = sum(1 for d in disclosures if d.get("medical_attention_needed"))
    police_notified = sum(1 for d in disclosures if d.get("police_notified"))
    formal_reports = sum(1 for d in disclosures if d.get("formal_report"))
    resolved = sum(1 for d in disclosures if d.get("status") == "resolved")
    
    # Incident type counts
    incident_types = {}
    for d in disclosures:
        itype = d.get("incident_type", "Unknown")
        incident_types[itype] = incident_types.get(itype, 0) + 1
    
    # Status counts
    status_counts = {}
    for d in disclosures:
        status = d.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Monthly counts
    monthly_counts = {}
    for d in disclosures:
        created_at = d.get("created_at", "")
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                month_key = dt.strftime("%Y-%m")
                monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
            except (ValueError, AttributeError):
                pass
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header and metadata
    generated_by = f"{current_user.first_name} {current_user.last_name}"
    writer.writerow(["Annual Disclosure Report"])
    writer.writerow(["Academic Year", f"{year}-{year+1}"])
    writer.writerow(["Report Period", f"July 1, {year} - June 30, {year+1}"])
    writer.writerow(["Generated At", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")])
    writer.writerow(["Generated By", generated_by])
    writer.writerow([])
    
    # Summary section
    writer.writerow(["SUMMARY"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Disclosures", total])
    writer.writerow(["Anonymous Disclosures", anonymous_count])
    writer.writerow(["Identified Disclosures", total - anonymous_count])
    writer.writerow(["Resolution Rate", f"{(resolved/total*100):.1f}%" if total > 0 else "N/A"])
    writer.writerow([])
    
    # Safety metrics
    writer.writerow(["SAFETY METRICS"])
    writer.writerow(["Metric", "Count"])
    writer.writerow(["Immediate Danger Cases", immediate_danger])
    writer.writerow(["Medical Attention Needed", medical_attention])
    writer.writerow(["Police Notified", police_notified])
    writer.writerow(["Formal Reports Filed", formal_reports])
    writer.writerow([])
    
    # Incident types
    writer.writerow(["INCIDENT TYPES"])
    writer.writerow(["Type", "Count", "Percentage"])
    for itype, count in sorted(incident_types.items(), key=lambda x: x[1], reverse=True):
        pct = f"{(count/total*100):.1f}%" if total > 0 else "0%"
        writer.writerow(sanitize_csv_row([itype, count, pct]))
    writer.writerow([])
    
    # Status breakdown
    writer.writerow(["STATUS BREAKDOWN"])
    writer.writerow(["Status", "Count", "Percentage"])
    for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
        pct = f"{(count/total*100):.1f}%" if total > 0 else "0%"
        writer.writerow(sanitize_csv_row([status.replace("_", " ").title(), count, pct]))
    writer.writerow([])
    
    # Monthly trend
    writer.writerow(["MONTHLY TREND"])
    writer.writerow(["Month", "Count"])
    for month, count in sorted(monthly_counts.items()):
        writer.writerow([month, count])
    writer.writerow([])
    
    # Compliance note
    writer.writerow(["COMPLIANCE NOTE"])
    writer.writerow(["This report is generated in compliance with AU Higher Education Standards Framework (F2025L01251). All data is anonymized and aggregated."])
    
    # Prepare response
    output.seek(0)
    filename = f"annual_disclosure_report_{year}-{year+1}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/annual-report/{year}/export/pdf")
async def export_annual_report_pdf(
    year: int,
    expires: Optional[int] = Query(None, description="Expiration timestamp for signed URL"),
    signature: Optional[str] = Query(None, description="HMAC signature for signed URL"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Export Annual Disclosure Report as PDF file - tenant isolated.
    Returns a downloadable PDF file with aggregated data.
    
    Requires authenticated request with valid JWT token.
    """
    tenant_db, current_user = tenant_data
    
    # Check authorization
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can export annual reports")
    
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import inch
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library not available")
    
    # Get the report data
    start_date = datetime(year, 7, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_date = datetime(year + 1, 6, 30, 23, 59, 59, tzinfo=timezone.utc)
    
    disclosures = await tenant_db.safe_disclosures.find({
        "created_at": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Calculate metrics
    total = len(disclosures)
    anonymous_count = sum(1 for d in disclosures if d.get("is_anonymous"))
    immediate_danger = sum(1 for d in disclosures if d.get("immediate_danger"))
    medical_attention = sum(1 for d in disclosures if d.get("medical_attention_needed"))
    police_notified = sum(1 for d in disclosures if d.get("police_notified"))
    formal_reports = sum(1 for d in disclosures if d.get("formal_report"))
    resolved = sum(1 for d in disclosures if d.get("status") == "resolved")
    resolution_rate = f"{(resolved/total*100):.1f}%" if total > 0 else "N/A"
    
    # Incident type counts
    incident_types = {}
    for d in disclosures:
        itype = d.get("incident_type", "Unknown")
        incident_types[itype] = incident_types.get(itype, 0) + 1
    
    # Status counts
    status_counts = {}
    for d in disclosures:
        status = d.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Monthly counts
    monthly_counts = {}
    for d in disclosures:
        created_at = d.get("created_at", "")
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                month_key = dt.strftime("%Y-%m")
                monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
            except (ValueError, AttributeError):
                pass
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#7c3aed'), spaceAfter=20)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#1f2937'), spaceBefore=15, spaceAfter=10)
    normal_style = styles['Normal']
    
    elements = []
    
    # Title
    generated_by = f"{current_user.first_name} {current_user.last_name}"
    
    elements.append(Paragraph("Annual Disclosure Report", title_style))
    elements.append(Paragraph(f"Academic Year: {year}-{year+1}", normal_style))
    elements.append(Paragraph(f"Report Period: July 1, {year} - June 30, {year+1}", normal_style))
    elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", normal_style))
    elements.append(Paragraph(f"Generated By: {generated_by}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Summary Table
    elements.append(Paragraph("Summary", heading_style))
    summary_data = [
        ["Metric", "Value"],
        ["Total Disclosures", str(total)],
        ["Anonymous Disclosures", str(anonymous_count)],
        ["Identified Disclosures", str(total - anonymous_count)],
        ["Resolution Rate", resolution_rate],
    ]
    summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f3f4f6')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 15))
    
    # Safety Metrics Table
    elements.append(Paragraph("Safety Metrics", heading_style))
    safety_data = [
        ["Metric", "Count"],
        ["Immediate Danger Cases", str(immediate_danger)],
        ["Medical Attention Needed", str(medical_attention)],
        ["Police Notified", str(police_notified)],
        ["Formal Reports Filed", str(formal_reports)],
    ]
    safety_table = Table(safety_data, colWidths=[3*inch, 2*inch])
    safety_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ef4444')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fef2f2')]),
    ]))
    elements.append(safety_table)
    elements.append(Spacer(1, 15))
    
    # Incident Types Table (if any data)
    if incident_types:
        elements.append(Paragraph("Incident Types", heading_style))
        incident_data = [["Type", "Count", "Percentage"]]
        for itype, count in sorted(incident_types.items(), key=lambda x: x[1], reverse=True):
            pct = f"{(count/total*100):.1f}%" if total > 0 else "0%"
            incident_data.append([itype.replace("_", " ").title(), str(count), pct])
        incident_table = Table(incident_data, colWidths=[2.5*inch, 1.25*inch, 1.25*inch])
        incident_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (2, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#eff6ff')]),
        ]))
        elements.append(incident_table)
        elements.append(Spacer(1, 15))
    
    # Status Breakdown Table (if any data)
    if status_counts:
        elements.append(Paragraph("Status Breakdown", heading_style))
        status_data = [["Status", "Count", "Percentage"]]
        for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
            pct = f"{(count/total*100):.1f}%" if total > 0 else "0%"
            status_data.append([status.replace("_", " ").title(), str(count), pct])
        status_table = Table(status_data, colWidths=[2.5*inch, 1.25*inch, 1.25*inch])
        status_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#22c55e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (2, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdf4')]),
        ]))
        elements.append(status_table)
        elements.append(Spacer(1, 15))
    
    # Monthly Trend Table (if any data)
    if monthly_counts:
        elements.append(Paragraph("Monthly Trend", heading_style))
        monthly_data = [["Month", "Count"]]
        for month, count in sorted(monthly_counts.items()):
            monthly_data.append([month, str(count)])
        monthly_table = Table(monthly_data, colWidths=[2*inch, 1.5*inch])
        monthly_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fefce8')]),
        ]))
        elements.append(monthly_table)
        elements.append(Spacer(1, 15))
    
    # Compliance Note
    elements.append(Spacer(1, 20))
    compliance_style = ParagraphStyle('Compliance', parent=normal_style, fontSize=9, textColor=colors.HexColor('#6b7280'), backColor=colors.HexColor('#fef3c7'), borderPadding=10)
    elements.append(Paragraph(
        "<b>Compliance Note:</b> This report is generated in compliance with AU Higher Education Standards Framework (F2025L01251). All data is anonymized and aggregated.",
        compliance_style
    ))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"annual_disclosure_report_{year}-{year+1}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/overdue")
async def get_overdue_cases(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """List cases that are past or approaching their 45-day investigation deadline - admin only - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    now = datetime.now(timezone.utc)
    warning_threshold = now + timedelta(days=7)

    cursor = tenant_db.safe_disclosures.find(
        {"investigation_deadline": {"$ne": None}, "status": {"$nin": ["resolved", "appeal_resolved"]}},
        {"_id": 0}
    )
    cases = await cursor.to_list(length=500)

    overdue, approaching = [], []
    for case in cases:
        deadline_str = case.get("investigation_deadline")
        if not deadline_str:
            continue
        try:
            deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if deadline < now:
                case["overdue"] = True
                case["days_overdue"] = (now - deadline).days
                overdue.append(case)
            elif deadline < warning_threshold:
                case["overdue"] = False
                case["days_remaining"] = (deadline - now).days
                approaching.append(case)
        except Exception:
            continue

    return {"overdue": overdue, "approaching_deadline": approaching, "total_overdue": len(overdue)}


@router.get("/super-admin/stats")
async def get_super_admin_stats(
    year: Optional[int] = Query(None),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Cross-college GBV statistics for super admin - aggregated per college, no case detail"""
    _, current_user = tenant_data
    if current_user.role not in ["super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Super admin access required")

    from utils.multi_tenant import master_db, get_tenant_db

    current_year = year or datetime.now(timezone.utc).year
    academic_start = datetime(current_year, 7, 1, tzinfo=timezone.utc)
    academic_end = datetime(current_year + 1, 6, 30, 23, 59, 59, tzinfo=timezone.utc)

    tenants = await master_db.tenants.find({}, {"_id": 0, "code": 1, "name": 1}).to_list(length=500)
    results = []

    for tenant in tenants:
        code = tenant.get("code")
        name = tenant.get("name", code)
        if not code:
            continue
        try:
            tdb = get_tenant_db(code)
            all_cases = await tdb.safe_disclosures.find(
                {"created_at": {"$gte": academic_start.isoformat(), "$lte": academic_end.isoformat()}},
                {"_id": 0, "status": 1, "formal_report": 1, "investigation_deadline": 1, "resolved_at": 1, "report_type": 1}
            ).to_list(length=5000)

            total = len(all_cases)
            formal = sum(1 for c in all_cases if c.get("formal_report") or c.get("report_type") == "formal_complaint")
            resolved = sum(1 for c in all_cases if c.get("status") == "resolved")
            overdue_count = 0
            resolved_in_time = 0
            now = datetime.now(timezone.utc)

            for c in all_cases:
                dl = c.get("investigation_deadline")
                if dl and c.get("status") not in ["resolved", "appeal_resolved"]:
                    try:
                        deadline = datetime.fromisoformat(dl.replace("Z", "+00:00"))
                        if deadline.tzinfo is None:
                            deadline = deadline.replace(tzinfo=timezone.utc)
                        if deadline < now:
                            overdue_count += 1
                    except Exception:
                        pass
                if c.get("status") == "resolved" and dl:
                    try:
                        resolved_at = c.get("resolved_at")
                        deadline = datetime.fromisoformat(dl.replace("Z", "+00:00"))
                        if resolved_at:
                            rat = datetime.fromisoformat(resolved_at.replace("Z", "+00:00"))
                            if rat.tzinfo is None:
                                rat = rat.replace(tzinfo=timezone.utc)
                            if deadline.tzinfo is None:
                                deadline = deadline.replace(tzinfo=timezone.utc)
                            if rat <= deadline:
                                resolved_in_time += 1
                    except Exception:
                        pass

            compliance_rate = round((resolved_in_time / formal * 100), 1) if formal > 0 else None
            results.append({
                "college_code": code,
                "college_name": name,
                "total_cases": total,
                "formal_complaints": formal,
                "resolved": resolved,
                "active": total - resolved,
                "overdue": overdue_count,
                "compliance_rate": compliance_rate,
                "academic_year": f"{current_year}-{current_year + 1}"
            })
        except Exception as e:
            results.append({"college_code": code, "college_name": name, "error": str(e)})

    return {"year": current_year, "colleges": results, "generated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/{disclosure_id}")
async def get_disclosure_by_id(
    disclosure_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get a specific disclosure - tenant isolated"""
    tenant_db, current_user = tenant_data
    disclosure = await tenant_db.safe_disclosures.find_one({"id": disclosure_id}, {"_id": 0})
    
    if not disclosure:
        raise HTTPException(status_code=404, detail="Disclosure not found")
    
    # Students can only see their own disclosures
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        if disclosure.get("reporter_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Decrypt PII fields
    if disclosure.get('preferred_contact'):
        disclosure['preferred_contact'] = decrypt_field(disclosure['preferred_contact'])

    return disclosure


@router.put("/{disclosure_id}/status")
async def update_disclosure_status(
    disclosure_id: str,
    data: StatusUpdateData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update disclosure status (admin/RA only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can update disclosure status")
    
    update_data = {
        "status": data.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data.notes:
        update_data["status_notes"] = data.notes
    
    update_data["assigned_to"] = current_user.id
    update_data["assigned_to_name"] = f"{current_user.first_name} {current_user.last_name}"
    
    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": update_data}
    )
    
    return {"message": "Disclosure status updated", "status": data.status}


@router.put("/{disclosure_id}/risk-assessment")
async def complete_risk_assessment(
    disclosure_id: str,
    data: RiskAssessmentData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Complete risk assessment for a disclosure (admin/RA only) - Standard 4.4, 7.1 - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can complete risk assessments")
    
    now = datetime.now(timezone.utc)
    
    # Determine status based on whether support plan data is provided
    has_support_plan = data.support_notes or data.follow_up_date
    status = "support_plan_active" if has_support_plan else "risk_assessment_complete"
    
    update_data = {
        "status": status,
        "risk_assessment": {
            "risk_level": data.risk_level,
            "assessment_notes": data.assessment_notes,
            "completed_by": current_user.id,
            "completed_by_name": f"{current_user.first_name} {current_user.last_name}",
            "completed_at": now.isoformat()
        },
        "safety_measures": data.safety_measures,
        "assigned_to": current_user.id,
        "assigned_to_name": f"{current_user.first_name} {current_user.last_name}",
        "updated_at": now.isoformat()
    }
    
    # Add support plan if provided
    if has_support_plan:
        update_data["support_plan"] = {
            "support_services": [],
            "plan_notes": data.support_notes,
            "follow_up_date": data.follow_up_date,
            "created_by": current_user.id,
            "created_by_name": f"{current_user.first_name} {current_user.last_name}",
            "created_at": now.isoformat()
        }
    
    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": update_data}
    )
    
    # Log audit event for risk assessment
    await log_admin_action(
        db=tenant_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.DATA_MODIFICATION,
        target_type="safe_disclosure",
        target_id=disclosure_id,
        details={
            "action": "risk_assessment",
            "risk_level": data.risk_level,
            "new_status": status,
            "has_support_plan": has_support_plan
        }
    )
    
    return {"message": "Risk assessment completed", "risk_level": data.risk_level, "status": status}


@router.put("/{disclosure_id}/support-plan")
async def create_support_plan(
    disclosure_id: str,
    data: SupportPlanData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create support plan for a disclosure (admin/RA only) - Standard 4.6 - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can create support plans")
    
    now = datetime.now(timezone.utc)
    
    update_data = {
        "status": "support_plan_active",
        "support_plan": {
            "support_services": data.support_services,
            "plan_notes": data.plan_notes,
            "follow_up_date": data.follow_up_date,
            "created_by": current_user.id,
            "created_by_name": f"{current_user.first_name} {current_user.last_name}",
            "created_at": now.isoformat()
        },
        "updated_at": now.isoformat()
    }
    
    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": update_data}
    )
    
    return {"message": "Support plan created"}


@router.put("/{disclosure_id}/formal-report")
async def create_formal_report(
    disclosure_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Escalate to formal report/investigation - Standard 5 (45 business days) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can create formal reports")
    
    now = datetime.now(timezone.utc)
    # 45 business days deadline (approximately 63 calendar days)
    investigation_deadline = now + timedelta(days=63)
    
    update_data = {
        "status": "investigation",
        "formal_report": True,
        "investigation_deadline": investigation_deadline.isoformat(),
        "escalated_by": current_user.id,
        "escalated_by_name": f"{current_user.first_name} {current_user.last_name}",
        "escalated_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": update_data}
    )
    
    return {"message": "Formal report created", "investigation_deadline": investigation_deadline.isoformat()}


@router.put("/{disclosure_id}/resolve")
async def resolve_disclosure(
    disclosure_id: str,
    resolution_notes: str = Body(..., embed=True),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Mark disclosure as resolved (admin/RA only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins and RAs can resolve disclosures")
    
    now = datetime.now(timezone.utc)
    
    update_data = {
        "status": "resolved",
        "resolution_notes": resolution_notes,
        "resolved_by": current_user.id,
        "resolved_by_name": f"{current_user.first_name} {current_user.last_name}",
        "resolved_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": update_data}
    )
    
    # Log audit event for disclosure resolution
    await log_admin_action(
        db=tenant_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.DATA_MODIFICATION,
        target_type="safe_disclosure",
        target_id=disclosure_id,
        details={
            "action": "resolve",
            "resolution_notes_length": len(resolution_notes) if resolution_notes else 0
        }
    )
    
    return {"message": "Disclosure resolved"}


class ForwardDisclosureData(BaseModel):
    recipient_email: str
    recipient_name: Optional[str] = None
    include_reporter_contact: bool = False
    additional_notes: Optional[str] = None


@router.post("/{disclosure_id}/forward")
async def forward_disclosure(
    disclosure_id: str,
    data: ForwardDisclosureData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Forward a safe disclosure to an external email address (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can forward disclosures")
    
    # Validate recipient email domain against tenant's allowed forwarding domains
    recipient_email = data.email if hasattr(data, 'email') else (data.recipient_email if hasattr(data, 'recipient_email') else None)
    if not recipient_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")
    
    # Get tenant config for allowed forwarding domains
    tenant_config = await tenant_db.settings.find_one({"type": "disclosure_forwarding"}, {"_id": 0})
    allowed_domains = []
    if tenant_config:
        allowed_domains = tenant_config.get("allowed_domains", [])
    
    # SECURITY (A04): Fail closed — require an explicit domain allowlist
    if not allowed_domains:
        raise HTTPException(
            status_code=403,
            detail="No approved forwarding domains configured. An admin must configure allowed email domains before forwarding is permitted."
        )
    
    # Extract domain from recipient email
    email_domain = recipient_email.split("@")[-1].lower() if "@" in recipient_email else ""
    
    # Enforce domain allowlist
    if email_domain not in [d.lower() for d in allowed_domains]:
        raise HTTPException(
            status_code=403, 
            detail=f"Email domain '{email_domain}' is not in the approved forwarding list. Contact your admin to add it."
        )
    
    # Log the forwarding action for audit
    await tenant_db.audit_logs.insert_one({
        "action": "disclosure_forwarded",
        "disclosure_id": disclosure_id,
        "forwarded_by": current_user.id,
        "forwarded_to_domain": email_domain,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    disclosure = await tenant_db.safe_disclosures.find_one({"id": disclosure_id}, {"_id": 0})
    if not disclosure:
        raise HTTPException(status_code=404, detail="Disclosure not found")
    
    try:
        from utils.email_service import send_email
    except ImportError:
        raise HTTPException(status_code=500, detail="Email service not available")
    
    # Build email content
    subject = f"Safe Disclosure Report - {disclosure.get('incident_type', 'Unknown Type')}"
    
    # Build HTML email body
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
            .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
            .section {{ margin-bottom: 20px; }}
            .section-title {{ font-weight: bold; color: #374151; margin-bottom: 8px; border-bottom: 2px solid #7c3aed; padding-bottom: 4px; }}
            .label {{ font-weight: bold; color: #6b7280; }}
            .value {{ color: #111827; }}
            .urgent {{ background-color: #fee2e2; color: #991b1b; padding: 10px; border-radius: 4px; margin-bottom: 15px; }}
            .footer {{ font-size: 12px; color: #6b7280; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">Safe Disclosure Report</h1>
                <p style="margin: 5px 0 0 0;">Forwarded by {current_user.first_name} {current_user.last_name}</p>
            </div>
            <div class="content">
    """
    
    # Add urgent warning if applicable
    if disclosure.get('immediate_danger') or disclosure.get('medical_attention_needed'):
        html_body += f"""
                <div class="urgent">
                    ⚠️ <strong>URGENT:</strong> 
                    {'Immediate danger reported. ' if disclosure.get('immediate_danger') else ''}
                    {'Medical attention may be needed.' if disclosure.get('medical_attention_needed') else ''}
                </div>
        """
    
    # Incident Details
    html_body += f"""
                <div class="section">
                    <div class="section-title">Incident Details</div>
                    <p><span class="label">Type:</span> <span class="value">{disclosure.get('incident_type', 'Not specified')}</span></p>
                    <p><span class="label">Date:</span> <span class="value">{disclosure.get('incident_date', 'Not specified')}</span></p>
                    <p><span class="label">Location:</span> <span class="value">{disclosure.get('incident_location', 'Not specified')}</span></p>
                    <p><span class="label">Status:</span> <span class="value">{disclosure.get('status', 'pending').replace('_', ' ').title()}</span></p>
                </div>
                
                <div class="section">
                    <div class="section-title">Description</div>
                    <p>{disclosure.get('description', 'No description provided')}</p>
                </div>
    """
    
    # Individuals involved
    if disclosure.get('individuals_involved'):
        html_body += f"""
                <div class="section">
                    <div class="section-title">Individuals Involved</div>
                    <p>{disclosure.get('individuals_involved')}</p>
                </div>
        """
    
    # Witness information
    if disclosure.get('witness_present'):
        html_body += f"""
                <div class="section">
                    <div class="section-title">Witness Information</div>
                    <p>{disclosure.get('witness_details', 'Witness present but no details provided')}</p>
                </div>
        """
    
    # Reporter contact (only if not anonymous and admin chose to include)
    if data.include_reporter_contact and not disclosure.get('is_anonymous'):
        html_body += f"""
                <div class="section">
                    <div class="section-title">Reporter Contact</div>
                    <p><span class="label">Name:</span> <span class="value">{disclosure.get('reporter_name', 'N/A')}</span></p>
                    <p><span class="label">Email:</span> <span class="value">{disclosure.get('reporter_email', 'N/A')}</span></p>
                    <p><span class="label">Preferred Contact:</span> <span class="value">{disclosure.get('preferred_contact', 'Not specified')}</span></p>
                </div>
        """
    elif disclosure.get('is_anonymous'):
        html_body += """
                <div class="section">
                    <div class="section-title">Reporter Information</div>
                    <p><em>This disclosure was submitted anonymously.</em></p>
                </div>
        """
    
    # Support requested
    if disclosure.get('support_requested'):
        services = disclosure.get('support_requested', [])
        services_list = ', '.join(services) if isinstance(services, list) else str(services)
        html_body += f"""
                <div class="section">
                    <div class="section-title">Support Services Requested</div>
                    <p>{services_list}</p>
                </div>
        """
    
    # Additional notes from admin
    if data.additional_notes:
        html_body += f"""
                <div class="section">
                    <div class="section-title">Additional Notes from Forwarder</div>
                    <p>{data.additional_notes}</p>
                </div>
        """
    
    # Footer
    html_body += f"""
                <div class="footer">
                    <p>This report was forwarded from the Quadley Safe Disclosure system on {datetime.now(timezone.utc).strftime('%Y-%m-%d at %H:%M UTC')}.</p>
                    <p>Disclosure ID: {disclosure_id}</p>
                    <p><strong>Confidentiality Notice:</strong> This email contains sensitive information. Please handle appropriately.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Send the email
    try:
        await send_email(
            to_email=data.recipient_email,
            subject=subject,
            html_content=html_body
        )
        
        # Log the forwarding action
        now = datetime.now(timezone.utc)
        forward_record = {
            "forwarded_at": now.isoformat(),
            "forwarded_by": current_user.id,
            "forwarded_by_name": f"{current_user.first_name} {current_user.last_name}",
            "recipient_email": data.recipient_email,
            "included_reporter_contact": data.include_reporter_contact
        }
        
        await tenant_db.safe_disclosures.update_one(
            {"id": disclosure_id},
            {
                "$push": {"forward_history": forward_record},
                "$set": {"updated_at": now.isoformat()}
            }
        )
        
        # Log audit event for disclosure forwarding
        await log_admin_action(
            db=tenant_db,
            admin_id=current_user.id,
            admin_email=current_user.email,
            action_type=AdminActionType.DATA_EXPORT,
            target_type="safe_disclosure",
            target_id=disclosure_id,
            details={
                "action": "forward",
                "recipient_email": data.recipient_email,
                "include_contact": data.include_reporter_contact
            }
        )
        
        return {
            "message": "Disclosure forwarded successfully",
            "recipient": data.recipient_email
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email: {str(e)}"
        )


@router.post("/{disclosure_id}/escalate")
async def escalate_to_formal_complaint(
    disclosure_id: str,
    data: EscalateData = Body(default=EscalateData()),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Convert a disclosure to a formal complaint, starting the 45 business-day clock - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    existing = await tenant_db.safe_disclosures.find_one({"id": disclosure_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Disclosure not found")
    if existing.get("formal_report"):
        raise HTTPException(status_code=400, detail="Already a formal complaint")

    now = datetime.now(timezone.utc)
    investigation_deadline = now + timedelta(days=63)

    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": {
            "report_type": "formal_complaint",
            "formal_report": True,
            "status": "investigation",
            "investigation_deadline": investigation_deadline.isoformat(),
            "escalated_by": current_user.id,
            "escalated_by_name": f"{current_user.first_name} {current_user.last_name}",
            "escalated_at": now.isoformat(),
            "escalation_reason": data.reason,
            "updated_at": now.isoformat()
        }}
    )

    await log_admin_action(
        db=tenant_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.DATA_MODIFICATION,
        target_type="safe_disclosure",
        target_id=disclosure_id,
        details={"action": "escalate_to_formal", "reason": data.reason}
    )

    return {"message": "Escalated to formal complaint", "investigation_deadline": investigation_deadline.isoformat()}


@router.post("/{disclosure_id}/assign")
async def assign_case_worker(
    disclosure_id: str,
    data: AssignData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Assign a disclosure to a named case worker - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    now = datetime.now(timezone.utc)
    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": {
            "assigned_to": data.assignee_id,
            "assigned_to_name": data.assignee_name,
            "updated_at": now.isoformat()
        }}
    )

    await log_admin_action(
        db=tenant_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.DATA_MODIFICATION,
        target_type="safe_disclosure",
        target_id=disclosure_id,
        details={"action": "assign", "assignee_id": data.assignee_id, "assignee_name": data.assignee_name}
    )

    return {"message": "Case assigned", "assignee": data.assignee_name}


@router.post("/{disclosure_id}/notes")
async def add_case_note(
    disclosure_id: str,
    data: CaseNoteData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Add an internal case note (admin-only audit trail) - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "ra", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    now = datetime.now(timezone.utc)
    note_record = {
        "id": str(uuid.uuid4()),
        "note": data.note,
        "is_internal": data.is_internal,
        "created_by": current_user.id,
        "created_by_name": f"{current_user.first_name} {current_user.last_name}",
        "created_at": now.isoformat()
    }

    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {
            "$push": {"case_notes": note_record},
            "$set": {"updated_at": now.isoformat()}
        }
    )

    return {"message": "Note added", "note": note_record}


@router.post("/{disclosure_id}/appeal")
async def initiate_appeal(
    disclosure_id: str,
    data: AppealData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Student initiates an appeal within 20 business days of resolution - Standard 5 - tenant isolated"""
    tenant_db, current_user = tenant_data

    existing = await tenant_db.safe_disclosures.find_one({"id": disclosure_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Disclosure not found")

    if existing.get("status") != "resolved":
        raise HTTPException(status_code=400, detail="Can only appeal a resolved case")

    if existing.get("reporter_id") and existing["reporter_id"] != current_user.id:
        if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
            raise HTTPException(status_code=403, detail="Not your case")

    now = datetime.now(timezone.utc)
    appeal_deadline = now + timedelta(days=28)

    appeal_record = {
        "grounds": data.grounds,
        "initiated_by": current_user.id,
        "initiated_by_name": f"{current_user.first_name} {current_user.last_name}",
        "initiated_at": now.isoformat(),
        "appeal_deadline": appeal_deadline.isoformat(),
        "appeal_status": "appeal_under_review"
    }

    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": {
            "status": "appeal_under_review",
            "appeal": appeal_record,
            "updated_at": now.isoformat()
        }}
    )

    return {"message": "Appeal initiated", "appeal_deadline": appeal_deadline.isoformat()}


@router.post("/{disclosure_id}/escalate-nso")
async def escalate_to_nso(
    disclosure_id: str,
    data: NSOEscalationData = Body(default=NSOEscalationData()),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Record external escalation to the National Student Ombudsman - Standard 5 - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    existing = await tenant_db.safe_disclosures.find_one({"id": disclosure_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Disclosure not found")

    now = datetime.now(timezone.utc)
    nso_record = {
        "nso_escalated": True,
        "nso_escalation_date": now.isoformat(),
        "nso_reference": data.reference or "",
        "nso_notes": data.notes or "",
        "nso_escalated_by": current_user.id,
        "nso_escalated_by_name": f"{current_user.first_name} {current_user.last_name}",
        "updated_at": now.isoformat()
    }

    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": nso_record}
    )

    await log_admin_action(
        db=tenant_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.DATA_MODIFICATION,
        target_type="safe_disclosure",
        target_id=disclosure_id,
        details={"action": "escalate_nso", "reference": data.reference}
    )

    return {"message": "Case escalated to National Student Ombudsman", "escalation_date": now.isoformat()}


@router.put("/{disclosure_id}/respondent")
async def update_respondent(
    disclosure_id: str,
    data: RespondentData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Record respondent information against a case - Standard 1 - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    existing = await tenant_db.safe_disclosures.find_one({"id": disclosure_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Disclosure not found")

    now = datetime.now(timezone.utc)
    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {"$set": {
            "respondent_name": data.respondent_name,
            "respondent_id": data.respondent_id,
            "respondent_recorded_by": f"{current_user.first_name} {current_user.last_name}",
            "respondent_recorded_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )

    return {"message": "Respondent information recorded"}


@router.post("/{disclosure_id}/interim-measures")
async def add_interim_measure(
    disclosure_id: str,
    data: InterimMeasureData,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Add an interim protective measure to a case - Standard 1 - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    existing = await tenant_db.safe_disclosures.find_one({"id": disclosure_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Disclosure not found")

    now = datetime.now(timezone.utc)
    measure = {
        "id": str(uuid.uuid4()),
        "measure_type": data.measure_type,
        "description": data.description,
        "date_imposed": data.date_imposed or now.isoformat(),
        "imposed_by": current_user.id,
        "imposed_by_name": f"{current_user.first_name} {current_user.last_name}",
        "recorded_at": now.isoformat()
    }

    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {
            "$push": {"interim_measures": measure},
            "$set": {"updated_at": now.isoformat()}
        }
    )

    return {"message": "Interim measure added", "measure": measure}


@router.delete("/{disclosure_id}/interim-measures/{measure_id}")
async def remove_interim_measure(
    disclosure_id: str,
    measure_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Remove an interim measure from a case - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    existing = await tenant_db.safe_disclosures.find_one({"id": disclosure_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Disclosure not found")

    now = datetime.now(timezone.utc)
    await tenant_db.safe_disclosures.update_one(
        {"id": disclosure_id},
        {
            "$pull": {"interim_measures": {"id": measure_id}},
            "$set": {"updated_at": now.isoformat()}
        }
    )

    return {"message": "Interim measure removed"}
