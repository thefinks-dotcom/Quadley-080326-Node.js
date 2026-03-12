"""Relationship Disclosure Tracking — governance compliance for staff/student and student/student relationships"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/relationship-disclosures", tags=["relationship-disclosures"])

RELATIONSHIP_TYPES = [
    "Romantic / Personal Intimate",
    "Close Personal Friendship",
    "Family Relationship",
    "Financial Dependency",
    "Prior Supervisory Relationship",
    "Other",
]

STATUS_VALUES = ["active", "under_review", "management_plan_issued", "resolved", "closed"]

ADMIN_ROLES = ["admin", "super_admin", "superadmin", "college_admin"]


class DisclosureCreate(BaseModel):
    disclosed_by_id: Optional[str] = None
    disclosed_by_name: Optional[str] = None
    disclosed_by_role: Optional[str] = None
    other_party_name: str
    other_party_id: Optional[str] = None
    other_party_role: str
    relationship_type: str
    disclosure_date: str
    notes: Optional[str] = None


class DisclosureUpdate(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None
    management_plan: Optional[str] = None


@router.post("")
async def create_disclosure(
    data: DisclosureCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Submit a relationship disclosure — any authenticated user (self-disclosure) or admin on behalf of user — tenant isolated"""
    tenant_db, current_user = tenant_data

    is_admin = current_user.role in ADMIN_ROLES
    disclosed_by_id = data.disclosed_by_id if (is_admin and data.disclosed_by_id) else current_user.id
    disclosed_by_name = data.disclosed_by_name if (is_admin and data.disclosed_by_name) else f"{current_user.first_name} {current_user.last_name}"
    disclosed_by_role = data.disclosed_by_role if (is_admin and data.disclosed_by_role) else current_user.role

    now = datetime.now(timezone.utc)
    disclosure_date_str = data.disclosure_date
    try:
        disclosure_dt = datetime.fromisoformat(disclosure_date_str.replace("Z", "+00:00")) if "T" in disclosure_date_str else datetime.fromisoformat(disclosure_date_str + "T00:00:00+00:00")
    except Exception:
        disclosure_dt = now

    doc = {
        "id": str(uuid.uuid4()),
        "tenant_code": current_user.tenant_code,
        "disclosed_by_id": disclosed_by_id,
        "disclosed_by_name": disclosed_by_name,
        "disclosed_by_role": disclosed_by_role,
        "other_party_name": data.other_party_name,
        "other_party_id": data.other_party_id or "",
        "other_party_role": data.other_party_role,
        "relationship_type": data.relationship_type,
        "disclosure_date": disclosure_dt.isoformat(),
        "notes": data.notes or "",
        "status": "active",
        "resolution_notes": "",
        "management_plan": "",
        "resolution_date": None,
        "resolved_by": "",
        "created_at": now.isoformat(),
        "logged_by": f"{current_user.first_name} {current_user.last_name}",
        "logged_by_id": current_user.id,
        "activity_log": [
            {
                "action": "Disclosure submitted",
                "by": f"{current_user.first_name} {current_user.last_name}",
                "at": now.isoformat(),
                "note": "",
            }
        ],
    }

    await tenant_db.relationship_disclosures.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/my")
async def get_my_disclosures(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get the current user's own submitted disclosures — tenant isolated"""
    tenant_db, current_user = tenant_data
    records = await tenant_db.relationship_disclosures.find(
        {"disclosed_by_id": current_user.id},
        {"_id": 0}
    ).sort("disclosure_date", -1).to_list(200)
    return records


@router.get("/stats")
async def get_stats(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Summary stats for admin dashboard — tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admins only")

    all_records = await tenant_db.relationship_disclosures.find({}, {"_id": 0, "status": 1, "relationship_type": 1, "disclosed_by_role": 1}).to_list(2000)

    total = len(all_records)
    by_status = {}
    by_type = {}
    staff_student = 0
    student_student = 0

    for r in all_records:
        s = r.get("status", "active")
        by_status[s] = by_status.get(s, 0) + 1

        t = r.get("relationship_type", "Other")
        by_type[t] = by_type.get(t, 0) + 1

        dr = r.get("disclosed_by_role", "")
        if dr in ["admin", "ra", "college_admin"]:
            staff_student += 1
        else:
            student_student += 1

    return {
        "total": total,
        "active": by_status.get("active", 0),
        "under_review": by_status.get("under_review", 0),
        "management_plan_issued": by_status.get("management_plan_issued", 0),
        "resolved": by_status.get("resolved", 0) + by_status.get("closed", 0),
        "staff_student": staff_student,
        "student_student": student_student,
        "by_type": by_type,
    }


@router.get("")
async def list_disclosures(
    status: Optional[str] = None,
    relationship_type: Optional[str] = None,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """List all disclosures for the tenant — admins only — tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admins only")

    query = {}
    if status:
        query["status"] = status
    if relationship_type:
        query["relationship_type"] = relationship_type

    records = await tenant_db.relationship_disclosures.find(query, {"_id": 0}).sort("disclosure_date", -1).to_list(1000)
    return records


@router.get("/{disclosure_id}")
async def get_disclosure(
    disclosure_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get a single disclosure — admin or the disclosing user — tenant isolated"""
    tenant_db, current_user = tenant_data
    doc = await tenant_db.relationship_disclosures.find_one({"id": disclosure_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Disclosure not found")
    if current_user.role not in ADMIN_ROLES and doc["disclosed_by_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return doc


@router.patch("/{disclosure_id}")
async def update_disclosure(
    disclosure_id: str,
    data: DisclosureUpdate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Admin updates disclosure status, resolution notes, or management plan — tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admins only")

    doc = await tenant_db.relationship_disclosures.find_one({"id": disclosure_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Disclosure not found")

    now = datetime.now(timezone.utc)
    updates = {}
    activity_note = []

    if data.status and data.status != doc.get("status"):
        updates["status"] = data.status
        activity_note.append(f"Status changed to '{data.status}'")
        if data.status in ("resolved", "closed"):
            updates["resolution_date"] = now.isoformat()
            updates["resolved_by"] = f"{current_user.first_name} {current_user.last_name}"

    if data.resolution_notes is not None:
        updates["resolution_notes"] = data.resolution_notes
        if data.resolution_notes:
            activity_note.append("Resolution notes updated")

    if data.management_plan is not None:
        updates["management_plan"] = data.management_plan
        if data.management_plan:
            activity_note.append("Management plan updated")

    if updates:
        log_entry = {
            "action": "; ".join(activity_note) if activity_note else "Updated",
            "by": f"{current_user.first_name} {current_user.last_name}",
            "at": now.isoformat(),
            "note": data.resolution_notes or "",
        }
        await tenant_db.relationship_disclosures.update_one(
            {"id": disclosure_id},
            {"$set": updates, "$push": {"activity_log": log_entry}}
        )

    updated = await tenant_db.relationship_disclosures.find_one({"id": disclosure_id}, {"_id": 0})
    return updated
