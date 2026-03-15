"""Tenant management routes"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List

from models import Tenant, TenantCreate, TenantUpdate, User
from utils.auth import hash_password, get_current_user
from utils.multi_tenant import master_db as db

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.post("", response_model=Tenant)
async def create_tenant_request(tenant_data: TenantCreate):
    """
    Request to create a new tenant (self-service registration).
    Status will be 'pending' until super_admin approves.
    """
    # Check if tenant_id or domain already exists
    existing = await db.tenants.find_one({
        "$or": [
            {"tenant_id": str(tenant_data).tenant_id},
            {"domain": tenant_data.domain}
        ]
    })
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID or domain already exists"
        )
    
    # Create tenant with pending status
    tenant = Tenant(
        tenant_id=tenant_data.tenant_id,
        tenant_name=tenant_data.tenant_name,
        domain=tenant_data.domain,
        contact_email=tenant_data.contact_email,
        capacity=tenant_data.capacity,
        status="pending"
    )
    
    tenant_doc = tenant.model_dump()
    tenant_doc['created_at'] = tenant_doc['created_at'].isoformat()
    await db.tenants.insert_one(tenant_doc)
    
    # Create admin user for tenant (but inactive until approved)
    admin_user = User(
        tenant_id=tenant_data.tenant_id,
        email=tenant_data.admin_email,
        first_name=tenant_data.admin_first_name,
        last_name=tenant_data.admin_last_name,
        role="admin"
    )
    
    admin_doc = admin_user.model_dump()
    admin_doc['created_at'] = admin_doc['created_at'].isoformat()
    admin_doc['password'] = hash_password(tenant_data.admin_password)
    admin_doc['active'] = False  # Inactive until tenant approved
    await db.users.insert_one(admin_doc)
    
    return tenant

@router.get("", response_model=List[Tenant])
async def list_tenants(current_user: User = Depends(get_current_user)):
    """
    List all tenants (super_admin) or current tenant (admin).
    """
    if current_user.role == "super_admin":
        # Super admin sees all tenants
        tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    else:
        # Regular admin sees only their tenant
        tenants = await db.tenants.find(
            {"tenant_id": str(current_user).tenant_id},
            {"_id": 0}
        ).to_list(1)
    
    return tenants

@router.get("/{tenant_id}", response_model=Tenant)
async def get_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get tenant details"""
    # Super admin can see any tenant, others only their own
    if current_user.role != "super_admin" and current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    tenant = await db.tenants.find_one(
        {"$or": [{"tenant_id": str(tenant_id)}, {"code": tenant_id}]},
        {"_id": 0}
    )
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant

@router.put("/{tenant_id}/approve")
async def approve_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Approve a pending tenant or reactivate a suspended tenant (super_admin only).
    Activates tenant and admin user.
    """
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can approve tenants"
        )
    
    # Check if tenant exists and get current status
    tenant = await db.tenants.find_one({"tenant_id": str(tenant_id)}, {"_id": 0})
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Only allow approval/reactivation for pending or suspended tenants
    if tenant["status"] not in ["pending", "suspended"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant is already active"
        )
    
    # Update tenant status to active
    result = await db.tenants.update_one(
        {"tenant_id": str(tenant_id), "status": {"$in": ["pending", "suspended"]}},
        {"$set": {"status": "active"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found or already active"
        )
    
    # Activate admin user
    await db.users.update_many(
        {"tenant_id": str(tenant_id), "role": "admin"},
        {"$set": {"active": True}}
    )
    
    action = "approved" if tenant["status"] == "pending" else "reactivated"
    return {"message": f"Tenant {action} and activated"}

@router.put("/{tenant_id}", response_model=Tenant)
async def update_tenant(
    tenant_id: str,
    tenant_data: TenantUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update tenant settings"""
    # Only tenant admin or super_admin can update
    if current_user.role == "super_admin" or \
       (current_user.role == "admin" and current_user.tenant_id == tenant_id):
        
        update_data = {k: v for k, v in tenant_data.model_dump().items() if v is not None}
        
        if update_data:
            await db.tenants.update_one(
                {"tenant_id": str(tenant_id)},
                {"$set": update_data}
            )
        
        tenant = await db.tenants.find_one({"tenant_id": str(tenant_id)}, {"_id": 0})
        return tenant
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

@router.delete("/{tenant_id}")
async def suspend_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Suspend a tenant (super_admin only).
    Users won't be able to login.
    """
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can suspend tenants"
        )
    
    result = await db.tenants.update_one(
        {"tenant_id": str(tenant_id)},
        {"$set": {"status": "suspended"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return {"message": "Tenant suspended"}
