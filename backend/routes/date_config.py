"""Date Configuration routes for academic calendar - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, HTTPException, Depends
import uuid

from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/date-config", tags=["date_config"])

# Also create a config router for compatibility
config_router = APIRouter(prefix="/config", tags=["config"])


@config_router.get("/dates")
async def get_config_dates(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get key dates for banners (move-in, o-week) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    config = await tenant_db.app_config.find_one({"type": "dates"}, {"_id": 0})
    
    if not config:
        # Default dates if none configured
        config = {
            "move_in_date": "2025-02-01",
            "o_week_start": "2025-02-03",
            "o_week_end": "2025-02-09"
        }
    
    return config


@config_router.put("/dates")
async def update_config_dates(
    date_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update key dates (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Only admins can update dates")
    
    await tenant_db.app_config.update_one(
        {"type": "dates"},
        {"$set": {
            "type": "dates",
            "move_in_date": date_data.get("move_in_date"),
            "o_week_start": date_data.get("o_week_start"),
            "o_week_end": date_data.get("o_week_end")
        }},
        upsert=True
    )
    
    return {"message": "Dates updated"}


@router.get("/academic-year")
async def get_academic_year_dates(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get academic year important dates - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    dates = await tenant_db.academic_dates.find({"active": True}, {"_id": 0}).to_list(100)
    
    if not dates:
        # Default dates if none configured
        dates = [
            {"id": str(uuid.uuid4()), "name": "Fall Semester Start", "date": "2025-09-01", "type": "semester", "active": True},
            {"id": str(uuid.uuid4()), "name": "Fall Break", "date": "2025-10-15", "type": "break", "active": True},
            {"id": str(uuid.uuid4()), "name": "Thanksgiving Break", "date": "2025-11-27", "type": "break", "active": True},
            {"id": str(uuid.uuid4()), "name": "Fall Semester End", "date": "2025-12-20", "type": "semester", "active": True},
            {"id": str(uuid.uuid4()), "name": "Spring Semester Start", "date": "2026-01-15", "type": "semester", "active": True},
            {"id": str(uuid.uuid4()), "name": "Spring Break", "date": "2026-03-15", "type": "break", "active": True},
            {"id": str(uuid.uuid4()), "name": "Spring Semester End", "date": "2026-05-15", "type": "semester", "active": True}
        ]
    
    return dates


@router.post("/academic-year")
async def create_academic_date(
    date_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create academic calendar date (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can manage academic calendar")
    
    date_dict = {
        "id": str(uuid.uuid4()),
        "name": date_data.get('name'),
        "date": date_data.get('date'),
        "type": date_data.get('type', 'other'),
        "description": date_data.get('description'),
        "active": True
    }
    
    await tenant_db.academic_dates.insert_one(date_dict)
    return date_dict
