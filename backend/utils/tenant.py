"""Tenant-aware authorization utilities"""
from fastapi import HTTPException, Depends, status
from models import User
from utils.auth import get_current_user, db

class TenantContext:
    """Thread-local tenant context"""
    def __init__(self, tenant_id: str, user: User):
        self.tenant_id = tenant_id
        self.user = user
        self.is_super_admin = user.role == "super_admin"
        self.is_admin = user.role in ["admin", "super_admin"]
        self.is_ra = user.role in ["ra", "admin", "super_admin"]
        self.is_student = user.role == "student"

async def get_tenant_context(
    current_user: User = Depends(get_current_user)
) -> TenantContext:
    """
    Extract tenant context from current user.
    MUST be used in ALL route handlers.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="User has no tenant assignment"
        )
    
    return TenantContext(
        tenant_id=current_user.tenant_id,
        user=current_user
    )

def require_role(*allowed_roles: str):
    """
    Decorator to require specific roles.
    Usage: @require_role("ra", "admin")
    """
    async def role_checker(ctx: TenantContext = Depends(get_tenant_context)):
        if ctx.user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(allowed_roles)}"
            )
        return ctx
    return role_checker

async def verify_resource_access(
    resource_id: str,
    collection_name: str,
    ctx: TenantContext
) -> dict:
    """
    Verify user has access to a specific resource.
    Automatically filters by tenant_id.
    """
    query = {"id": str(resource_id)}
    
    # Super admins can access any tenant's resources
    if not ctx.is_super_admin:
        query["tenant_id"] = ctx.tenant_id
    
    resource = await db[collection_name].find_one(query, {"_id": 0})
    
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{collection_name} not found or access denied"
        )
    
    return resource

async def verify_resource_ownership(
    resource_id: str,
    collection_name: str,
    ctx: TenantContext,
    owner_field: str = "owner_id"
) -> dict:
    """
    Verify user owns a specific resource.
    Use for DELETE/UPDATE operations.
    """
    resource = await verify_resource_access(resource_id, collection_name, ctx)
    
    # Admins/RAs can access any resource in their tenant
    if ctx.is_ra:
        return resource
    
    # Students can only access their own resources
    if resource.get(owner_field) != ctx.user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify this resource"
        )
    
    return resource
