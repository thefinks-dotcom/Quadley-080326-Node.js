"""Emergency Roll Call — tenant isolated evacuation tracking"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/emergency-rollcall", tags=["emergency-rollcall"])

ADMIN_ROLES = ["admin", "super_admin", "superadmin", "college_admin"]
STAFF_ROLES  = ["admin", "super_admin", "superadmin", "college_admin", "ra"]

RESPONSE_OPTIONS = ["evacuated", "not_at_college"]


class RespondPayload(BaseModel):
    status: str
    notes: Optional[str] = None


class RaReportPayload(BaseModel):
    report_text: str


async def create_rollcall_for_announcement(announcement_id: str, tenant_code: str, created_by: str, db):
    """Called as a background task when an emergency announcement is published."""
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.emergency_rollcalls.find_one({
        "announcement_id": announcement_id, "status": "active"
    })
    if existing:
        return

    doc = {
        "id": str(uuid.uuid4()),
        "announcement_id": announcement_id,
        "tenant_code": tenant_code,
        "status": "active",
        "created_at": now,
        "created_by": created_by,
        "closed_at": None,
        "closed_by": None,
    }
    await db.emergency_rollcalls.insert_one(doc)


@router.post("")
async def create_rollcall(
    announcement_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Manually create a roll call for an announcement (admin only) — tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admins only")

    await create_rollcall_for_announcement(
        announcement_id, current_user.tenant_code, current_user.id, tenant_db
    )
    rollcall = await tenant_db.emergency_rollcalls.find_one(
        {"announcement_id": str(announcement_id), "status": "active"}, {"_id": 0}
    )
    return rollcall


@router.get("/active")
async def get_active_rollcalls(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Return active rollcalls the current user needs to respond to — tenant isolated"""
    tenant_db, current_user = tenant_data

    rollcalls = await tenant_db.emergency_rollcalls.find(
        {"status": "active"}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    if not rollcalls:
        return []

    rollcall_ids = [r["id"] for r in rollcalls]
    my_responses = await tenant_db.rollcall_responses.find(
        {"rollcall_id": {"$in": rollcall_ids}, "user_id": str(current_user).id},
        {"_id": 0, "rollcall_id": 1, "status": 1}
    ).to_list(20)

    responded_ids = {r["rollcall_id"]: r["status"] for r in my_responses}

    result = []
    for r in rollcalls:
        rc = dict(r)
        ann = await tenant_db.announcements.find_one(
            {"id": str(rc)["announcement_id"]}, {"_id": 0, "title": 1, "content": 1, "created_at": 1}
        )
        rc["announcement_title"] = ann.get("title", "") if ann else ""
        rc["announcement_content"] = ann.get("content", "") if ann else ""
        rc["my_response"] = responded_ids.get(rc["id"])
        result.append(rc)

    return result


@router.post("/{rollcall_id}/respond")
async def respond_to_rollcall(
    rollcall_id: str,
    payload: RespondPayload,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Student or staff records their evacuation status — tenant isolated"""
    tenant_db, current_user = tenant_data

    if payload.status not in RESPONSE_OPTIONS:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {RESPONSE_OPTIONS}")

    rollcall = await tenant_db.emergency_rollcalls.find_one({"id": str(rollcall_id)})
    if not rollcall:
        raise HTTPException(status_code=404, detail="Roll call not found")
    if rollcall["status"] != "active":
        raise HTTPException(status_code=400, detail="Roll call is no longer active")

    now = datetime.now(timezone.utc).isoformat()
    existing = await tenant_db.rollcall_responses.find_one({
        "rollcall_id": rollcall_id, "user_id": current_user.id
    })

    if existing:
        await tenant_db.rollcall_responses.update_one(
            {"rollcall_id": rollcall_id, "user_id": str(current_user).id},
            {"$set": {"status": payload.status, "notes": payload.notes or "", "responded_at": now}}
        )
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "rollcall_id": rollcall_id,
            "announcement_id": rollcall["announcement_id"],
            "user_id": current_user.id,
            "user_name": f"{current_user.first_name} {current_user.last_name}",
            "user_floor": current_user.floor or "",
            "user_role": current_user.role,
            "status": payload.status,
            "notes": payload.notes or "",
            "responded_at": now,
        }
        await tenant_db.rollcall_responses.insert_one(doc)

    return {"message": "Response recorded", "status": payload.status}


@router.get("/{rollcall_id}/summary")
async def get_rollcall_summary(
    rollcall_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Full roll call summary — admin sees all floors, RA sees their floor only — tenant isolated"""
    tenant_db, current_user = tenant_data

    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Staff only")

    rollcall = await tenant_db.emergency_rollcalls.find_one({"id": str(rollcall_id)}, {"_id": 0})
    if not rollcall:
        raise HTTPException(status_code=404, detail="Roll call not found")

    ann = await tenant_db.announcements.find_one(
        {"id": str(rollcall)["announcement_id"]}, {"_id": 0, "title": 1, "content": 1}
    )
    rollcall["announcement_title"] = ann.get("title", "") if ann else ""
    rollcall["announcement_content"] = ann.get("content", "") if ann else ""

    responses = await tenant_db.rollcall_responses.find(
        {"rollcall_id": rollcall_id}, {"_id": 0}
    ).to_list(2000)

    if current_user.role == "ra":
        responses = [r for r in responses if r.get("user_floor") == current_user.floor]

    responded_user_ids = {r["user_id"] for r in responses}

    user_query = {"role": {"$in": ["student", "ra"]}}
    if current_user.role == "ra":
        user_query["floor"] = current_user.floor

    all_students = await tenant_db.users.find(
        user_query,
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "floor": 1, "role": 1, "email": 1}
    ).to_list(2000)

    pending = []
    for u in all_students:
        if u["id"] not in responded_user_ids:
            pending.append({
                "user_id": u["id"],
                "user_name": f"{u['first_name']} {u['last_name']}",
                "user_floor": u.get("floor", ""),
                "user_role": u.get("role", ""),
                "email": u.get("email", ""),
                "status": "pending",
            })

    floors = {}
    for r in responses + pending:
        fl = r.get("user_floor") or "Unassigned"
        if fl not in floors:
            floors[fl] = {"evacuated": [], "not_at_college": [], "pending": []}
        floors[fl][r["status"]].append(r)

    ra_reports = await tenant_db.rollcall_ra_reports.find(
        {"rollcall_id": rollcall_id}, {"_id": 0}
    ).sort("sent_at", -1).to_list(100)

    if current_user.role == "ra":
        ra_reports = [r for r in ra_reports if r.get("ra_floor") == current_user.floor]

    my_report = next((r for r in ra_reports if r.get("ra_id") == current_user.id), None)

    return {
        "rollcall": rollcall,
        "total_residents": len(all_students),
        "total_responded": len(responses),
        "total_evacuated": sum(1 for r in responses if r["status"] == "evacuated"),
        "total_not_at_college": sum(1 for r in responses if r["status"] == "not_at_college"),
        "total_pending": len(pending),
        "response_pct": round(len(responses) / len(all_students) * 100, 1) if all_students else 0,
        "floors": floors,
        "responses": responses,
        "pending": pending,
        "ra_reports": ra_reports,
        "my_ra_report": my_report,
    }


@router.post("/{rollcall_id}/ra-report")
async def submit_ra_report(
    rollcall_id: str,
    payload: RaReportPayload,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """RA submits a floor-level clearance report to admin — tenant isolated"""
    tenant_db, current_user = tenant_data

    if current_user.role not in ["ra", *ADMIN_ROLES]:
        raise HTTPException(status_code=403, detail="RA or admin only")

    rollcall = await tenant_db.emergency_rollcalls.find_one({"id": str(rollcall_id)})
    if not rollcall:
        raise HTTPException(status_code=404, detail="Roll call not found")

    now = datetime.now(timezone.utc).isoformat()

    existing = await tenant_db.rollcall_ra_reports.find_one({
        "rollcall_id": rollcall_id, "ra_id": current_user.id
    })
    if existing:
        await tenant_db.rollcall_ra_reports.update_one(
            {"rollcall_id": rollcall_id, "ra_id": current_user.id},
            {"$set": {"report_text": payload.report_text, "sent_at": now}}
        )
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "rollcall_id": rollcall_id,
            "announcement_id": rollcall["announcement_id"],
            "ra_id": current_user.id,
            "ra_name": f"{current_user.first_name} {current_user.last_name}",
            "ra_floor": current_user.floor or "",
            "report_text": payload.report_text,
            "sent_at": now,
        }
        await tenant_db.rollcall_ra_reports.insert_one(doc)

    return {"message": "Clearance report submitted"}


@router.post("/{rollcall_id}/close")
async def close_rollcall(
    rollcall_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Admin closes the roll call — tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admins only")

    rollcall = await tenant_db.emergency_rollcalls.find_one({"id": str(rollcall_id)})
    if not rollcall:
        raise HTTPException(status_code=404, detail="Roll call not found")

    now = datetime.now(timezone.utc).isoformat()
    await tenant_db.emergency_rollcalls.update_one(
        {"id": str(rollcall_id)},
        {"$set": {"status": "closed", "closed_at": now, "closed_by": current_user.id}}
    )
    return {"message": "Roll call closed"}


@router.get("/by-announcement/{announcement_id}")
async def get_rollcall_by_announcement(
    announcement_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get the rollcall (if any) for a given announcement — staff only — tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Staff only")

    rollcall = await tenant_db.emergency_rollcalls.find_one(
        {"announcement_id": str(announcement_id)}, {"_id": 0},
        sort=[("created_at", -1)]
    )
    if not rollcall:
        return None

    total_residents = await tenant_db.users.count_documents(
        {"role": {"$in": ["student", "ra"]}}
    )
    total_responded = await tenant_db.rollcall_responses.count_documents(
        {"rollcall_id": rollcall["id"]}
    )
    evacuated = await tenant_db.rollcall_responses.count_documents(
        {"rollcall_id": rollcall["id"], "status": "evacuated"}
    )
    not_at_college = await tenant_db.rollcall_responses.count_documents(
        {"rollcall_id": rollcall["id"], "status": "not_at_college"}
    )

    rollcall["total_residents"] = total_residents
    rollcall["total_responded"] = total_responded
    rollcall["evacuated"] = evacuated
    rollcall["not_at_college"] = not_at_college
    rollcall["pending"] = total_residents - total_responded
    return rollcall
