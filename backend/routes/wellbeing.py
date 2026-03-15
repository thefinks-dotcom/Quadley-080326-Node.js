"""Wellbeing resources and pastoral care routes - Tenant isolated"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime

from models import WellbeingResource, WellbeingResourceCreate
from utils.auth import get_tenant_db_for_user

router = APIRouter(tags=["wellbeing"])


@router.get("/wellbeing/resources", response_model=List[WellbeingResource])
async def get_wellbeing_resources(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all wellbeing resources for this tenant"""
    tenant_db, current_user = tenant_data
    
    resources = await tenant_db.wellbeing_resources.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for res in resources:
        if isinstance(res.get('created_at'), str):
            res['created_at'] = datetime.fromisoformat(res['created_at'])
    
    return resources


@router.post("/wellbeing/resources", response_model=WellbeingResource)
async def create_wellbeing_resource(
    resource_data: WellbeingResourceCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create wellbeing resource (admin/RA only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    resource = WellbeingResource(
        title=resource_data.title,
        description=resource_data.description,
        category=resource_data.category,
        link=resource_data.link,
        created_by=current_user.id
    )
    
    resource_doc = resource.model_dump()
    resource_doc['created_at'] = resource_doc['created_at'].isoformat()
    await tenant_db.wellbeing_resources.insert_one(resource_doc)
    
    return resource


@router.put("/wellbeing/resources/{resource_id}", response_model=WellbeingResource)
async def update_wellbeing_resource(
    resource_id: str,
    resource_data: WellbeingResourceCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update a wellbeing resource (admin/RA only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await tenant_db.wellbeing_resources.find_one({"id": str(resource_id)}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    await tenant_db.wellbeing_resources.update_one(
        {"id": str(resource_id)},
        {"$set": {
            "title": resource_data.title,
            "description": resource_data.description,
            "category": resource_data.category,
            "link": resource_data.link,
        }}
    )
    
    updated = await tenant_db.wellbeing_resources.find_one({"id": str(resource_id)}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return updated


@router.delete("/wellbeing/resources/{resource_id}")
async def delete_wellbeing_resource(
    resource_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete a wellbeing resource (admin/RA only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await tenant_db.wellbeing_resources.find_one({"id": str(resource_id)}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    await tenant_db.wellbeing_resources.delete_one({"id": str(resource_id)})
    
    return {"message": "Wellbeing resource deleted"}
