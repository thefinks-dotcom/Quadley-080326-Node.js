"""GBV Training Compliance Tracker - AU National Higher Education Code Standard 3"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid

from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/gbv-training", tags=["gbv-training"])

TRAINING_TYPES = [
    "GBV Disclosure Training",
    "Trauma-Informed Response",
    "Bystander Intervention",
    "Survivor Support Coordination",
    "Mandatory Reporting Obligations",
]


class TrainingRecordCreate(BaseModel):
    user_id: str
    user_name: str
    user_role: str
    training_type: str
    training_date: str
    notes: Optional[str] = None


class GBVDeclarationUpdate(BaseModel):
    user_id: str
    has_declaration: bool
    declaration_notes: Optional[str] = None


@router.post("/record")
async def record_training(
    data: TrainingRecordCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Record a training completion for a user - Standard 3 - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    training_date = datetime.fromisoformat(data.training_date.replace("Z", "+00:00")) if "T" in data.training_date else datetime.fromisoformat(data.training_date + "T00:00:00+00:00")
    expiry_date = training_date + timedelta(days=365)

    record = {
        "id": str(uuid.uuid4()),
        "tenant_code": current_user.tenant_code,
        "user_id": data.user_id,
        "user_name": data.user_name,
        "user_role": data.user_role,
        "training_type": data.training_type,
        "training_date": training_date.isoformat(),
        "expiry_date": expiry_date.isoformat(),
        "notes": data.notes or "",
        "recorded_by": current_user.id,
        "recorded_by_name": f"{current_user.first_name} {current_user.last_name}",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }

    await tenant_db.gbv_training.insert_one(record)
    record.pop("_id", None)
    return record


@router.get("")
async def list_training_records(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """List all GBV training records for the tenant - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin", "ra"]:
        raise HTTPException(status_code=403, detail="Admins only")

    records = await tenant_db.gbv_training.find({}, {"_id": 0}).sort("training_date", -1).to_list(1000)
    return records


@router.get("/stats")
async def get_training_stats(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Training compliance stats - count trained, overdue, never-trained staff/RA - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    now = datetime.now(timezone.utc)
    warning_threshold = now + timedelta(days=60)

    staff_users = await tenant_db.users.find(
        {"role": {"$in": ["admin", "ra", "college_admin"]}, "active": True},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "role": 1, "email": 1}
    ).to_list(500)

    records = await tenant_db.gbv_training.find({}, {"_id": 0}).to_list(1000)

    latest_by_user = {}
    for r in records:
        uid = r["user_id"]
        if uid not in latest_by_user or r["training_date"] > latest_by_user[uid]["training_date"]:
            latest_by_user[uid] = r

    trained_current = 0
    expiring_soon = 0
    overdue = 0
    never_trained = 0

    staff_status = []
    for u in staff_users:
        uid = u["id"]
        record = latest_by_user.get(uid)
        if not record:
            never_trained += 1
            status = "never_trained"
            expiry = None
        else:
            expiry = datetime.fromisoformat(record["expiry_date"].replace("Z", "+00:00"))
            if expiry < now:
                overdue += 1
                status = "overdue"
            elif expiry < warning_threshold:
                expiring_soon += 1
                status = "expiring_soon"
            else:
                trained_current += 1
                status = "current"

        staff_status.append({
            "user_id": uid,
            "user_name": f"{u['first_name']} {u['last_name']}",
            "user_role": u["role"],
            "email": u.get("email", ""),
            "status": status,
            "last_training_date": record["training_date"] if record else None,
            "last_training_type": record["training_type"] if record else None,
            "expiry_date": record["expiry_date"] if record else None,
        })

    return {
        "total_staff": len(staff_users),
        "trained_current": trained_current,
        "expiring_soon": expiring_soon,
        "overdue": overdue,
        "never_trained": never_trained,
        "compliance_rate": round((trained_current / len(staff_users) * 100) if staff_users else 0, 1),
        "staff_status": staff_status,
    }


@router.get("/overdue")
async def get_overdue_training(
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """List staff whose training has expired or who have never been trained - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    stats = await get_training_stats(tenant_data)
    overdue_list = [s for s in stats["staff_status"] if s["status"] in ("overdue", "never_trained")]
    return overdue_list


@router.post("/gbv-declaration")
async def update_gbv_declaration(
    data: GBVDeclarationUpdate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Record pre-employment GBV declaration status for a staff member - Standard 1 - tenant isolated"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ["admin", "super_admin", "superadmin", "college_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")

    now = datetime.now(timezone.utc)
    await tenant_db.users.update_one(
        {"id": str(data).user_id},
        {"$set": {
            "gbv_declaration": data.has_declaration,
            "gbv_declaration_notes": data.declaration_notes or "",
            "gbv_declaration_recorded_by": f"{current_user.first_name} {current_user.last_name}",
            "gbv_declaration_date": now.isoformat(),
        }}
    )
    return {"message": "GBV declaration status updated"}
