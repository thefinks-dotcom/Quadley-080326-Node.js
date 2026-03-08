"""Houses and house points routes - tenant-isolated"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from models import HousePoints
from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/houses", tags=["houses"])


class AwardPointsRequest(BaseModel):
    house_name: str
    points: int
    reason: Optional[str] = None


async def award_house_points(tenant_db, house_name: str, points: int):
    """Helper function to award points to a house (tenant-isolated)"""
    current_year = datetime.now(timezone.utc).year
    house = await tenant_db.house_points.find_one({"house_name": house_name, "year": current_year})

    if house:
        new_points = house.get('points', 0) + points
        await tenant_db.house_points.update_one(
            {"house_name": house_name, "year": current_year},
            {"$set": {"points": new_points, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        house_point = HousePoints(house_name=house_name, points=points, year=current_year)
        house_doc = house_point.model_dump()
        house_doc['updated_at'] = house_doc['updated_at'].isoformat()
        await tenant_db.house_points.insert_one(house_doc)


@router.get("/leaderboard")
async def get_house_leaderboard(
    tenant_data: tuple = Depends(get_tenant_db_for_user),
    year: Optional[int] = None
):
    """Get house points leaderboard for the current tenant"""
    tenant_db, current_user = tenant_data
    current_year = year or datetime.now(timezone.utc).year
    houses = await tenant_db.house_points.find({"year": current_year}, {"_id": 0}).sort("points", -1).to_list(100)

    for house in houses:
        if isinstance(house.get('updated_at'), str):
            house['updated_at'] = datetime.fromisoformat(house['updated_at'])

    return houses


@router.post("/award")
async def award_points(
    request: AwardPointsRequest,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Award points to a house (admin/RA only)"""
    tenant_db, current_user = tenant_data
    if current_user.role not in ['admin', 'ra']:
        raise HTTPException(status_code=403, detail="Only admins and RAs can award house points")

    await award_house_points(tenant_db, request.house_name, request.points)
    return {"success": True, "house_name": request.house_name, "points_awarded": request.points}
