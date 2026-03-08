"""
Custom Domain API Routes
========================
Endpoints for managing custom domains for tenants.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from pydantic import BaseModel, Field

from utils.auth import get_current_user
from utils.multi_tenant import master_db
from utils.custom_domains import (
    create_custom_domain,
    verify_custom_domain,
    list_tenant_domains,
    delete_custom_domain,
    set_primary_domain,
    get_tenant_by_domain,
    normalize_domain
)
from utils.admin_audit import log_admin_action, AdminActionType

router = APIRouter(prefix="/domains", tags=["domains"])


class AddDomainRequest(BaseModel):
    """Request to add a custom domain."""
    domain: str = Field(..., description="Custom domain (e.g., portal.college.edu)")
    tenant_code: str = Field(..., description="Tenant code to associate domain with")


class SetPrimaryRequest(BaseModel):
    """Request to set primary domain."""
    domain: str


# ==================== SUPER ADMIN ENDPOINTS ====================

@router.post("")
async def add_custom_domain(
    request: Request,
    data: AddDomainRequest,
    current_user=Depends(get_current_user)
):
    """
    Add a custom domain for a tenant.
    
    Super admin only. Returns verification instructions.
    
    The tenant must:
    1. Add a TXT record for DNS verification
    2. Add a CNAME record pointing to tenants.quadley.app
    """
    if current_user.role != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    try:
        result = await create_custom_domain(
            db=master_db,
            tenant_code=data.tenant_code,
            domain=data.domain,
            created_by=current_user.id
        )
        
        # Audit log
        await log_admin_action(
            db=master_db,
            admin_id=current_user.id,
            admin_email=current_user.email,
            action_type=AdminActionType.TENANT_UPDATE,
            target_type="domain",
            target_id=data.domain,
            target_name=data.domain,
            details={"action": "add_custom_domain", "tenant_code": data.tenant_code},
            ip_address=request.client.host if request.client else None
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{domain}/verify")
async def verify_domain(
    domain: str,
    current_user=Depends(get_current_user)
):
    """
    Verify a custom domain's DNS configuration.
    
    Checks for the TXT verification record and CNAME setup.
    """
    if current_user.role not in ['super_admin', 'admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await verify_custom_domain(master_db, domain)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def list_all_domains(
    status: Optional[str] = None,
    tenant_code: Optional[str] = None,
    current_user=Depends(get_current_user)
):
    """
    List all custom domains (super admin) or tenant's domains (tenant admin).
    """
    if current_user.role not in ['super_admin', 'admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    
    # Non-super admins can only see their tenant's domains
    if current_user.role != 'super_admin':
        if not current_user.tenant_code:
            raise HTTPException(status_code=400, detail="No tenant context")
        query["tenant_code"] = current_user.tenant_code
    elif tenant_code:
        query["tenant_code"] = tenant_code
    
    if status:
        query["status"] = status
    
    cursor = master_db.custom_domains.find(query, {"_id": 0})
    domains = await cursor.to_list(100)
    
    return {
        "domains": domains,
        "total": len(domains)
    }


@router.get("/tenant/{tenant_code}")
async def get_tenant_domains(
    tenant_code: str,
    current_user=Depends(get_current_user)
):
    """
    Get all custom domains for a specific tenant.
    """
    if current_user.role != 'super_admin':
        # Tenant admins can only view their own tenant
        if current_user.tenant_code != tenant_code:
            raise HTTPException(status_code=403, detail="Access denied")
    
    domains = await list_tenant_domains(master_db, tenant_code)
    
    return {
        "tenant_code": tenant_code,
        "domains": domains,
        "total": len(domains)
    }


@router.post("/{domain}/set-primary")
async def set_domain_as_primary(
    domain: str,
    request: Request,
    current_user=Depends(get_current_user)
):
    """
    Set a domain as the primary custom domain for its tenant.
    
    The domain must be verified and active.
    """
    if current_user.role != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # Get domain config to find tenant
    config = await master_db.custom_domains.find_one(
        {"domain": normalize_domain(domain)},
        {"tenant_code": 1}
    )
    
    if not config:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    try:
        await set_primary_domain(master_db, config["tenant_code"], domain)
        
        # Audit log
        await log_admin_action(
            db=master_db,
            admin_id=current_user.id,
            admin_email=current_user.email,
            action_type=AdminActionType.TENANT_UPDATE,
            target_type="domain",
            target_id=domain,
            details={"action": "set_primary_domain", "tenant_code": config["tenant_code"]},
            ip_address=request.client.host if request.client else None
        )
        
        return {"success": True, "message": f"{domain} is now the primary domain"}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{domain}")
async def remove_custom_domain(
    domain: str,
    request: Request,
    current_user=Depends(get_current_user)
):
    """
    Remove a custom domain configuration.
    """
    if current_user.role != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # Get domain config to find tenant
    config = await master_db.custom_domains.find_one(
        {"domain": normalize_domain(domain)},
        {"tenant_code": 1}
    )
    
    if not config:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    success = await delete_custom_domain(master_db, domain, config["tenant_code"])
    
    if success:
        # Audit log
        await log_admin_action(
            db=master_db,
            admin_id=current_user.id,
            admin_email=current_user.email,
            action_type=AdminActionType.TENANT_UPDATE,
            target_type="domain",
            target_id=domain,
            details={"action": "remove_custom_domain", "tenant_code": config["tenant_code"]},
            ip_address=request.client.host if request.client else None
        )
        
        return {"success": True, "message": f"Domain {domain} removed"}
    
    raise HTTPException(status_code=404, detail="Domain not found")


@router.get("/{domain}/status")
async def get_domain_status(
    domain: str,
    current_user=Depends(get_current_user)
):
    """
    Get the current status of a custom domain.
    """
    if current_user.role not in ['super_admin', 'admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    domain = normalize_domain(domain)
    config = await master_db.custom_domains.find_one(
        {"domain": domain},
        {"_id": 0}
    )
    
    if not config:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    # Check tenant access for non-super admins
    if current_user.role != 'super_admin':
        if config.get("tenant_code") != current_user.tenant_code:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return config


# ==================== PUBLIC ENDPOINT ====================

@router.get("/lookup/{domain}")
async def lookup_domain(domain: str):
    """
    Public endpoint to look up which tenant a domain belongs to.
    
    Used by the frontend/proxy to route requests.
    Returns only if domain is active.
    """
    tenant_code = await get_tenant_by_domain(master_db, domain)
    
    if tenant_code:
        # Get minimal tenant info
        tenant = await master_db.tenants.find_one(
            {"tenant_code": tenant_code},
            {"_id": 0, "tenant_code": 1, "college_name": 1, "logo_url": 1}
        )
        
        return {
            "found": True,
            "tenant_code": tenant_code,
            "college_name": tenant.get("college_name") if tenant else None,
            "logo_url": tenant.get("logo_url") if tenant else None
        }
    
    return {"found": False, "tenant_code": None}


# ==================== INSTRUCTIONS ENDPOINT ====================

@router.get("/setup-instructions")
async def get_setup_instructions(current_user=Depends(get_current_user)):
    """
    Get detailed instructions for setting up a custom domain.
    """
    if current_user.role not in ['super_admin', 'admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "overview": "Custom domains allow your college to use a branded URL like portal.college.edu",
        "steps": [
            {
                "step": 1,
                "title": "Add Domain in Quadley",
                "description": "Use the 'Add Custom Domain' feature to register your domain"
            },
            {
                "step": 2,
                "title": "Add DNS TXT Record (Verification)",
                "description": "Add a TXT record to prove domain ownership",
                "example": {
                    "type": "TXT",
                    "host": "@",
                    "value": "quadley-verify=<your-token>"
                },
                "alternative": "Or add to _quadley subdomain"
            },
            {
                "step": 3,
                "title": "Add DNS CNAME Record (Routing)",
                "description": "Route traffic to Quadley servers",
                "example": {
                    "type": "CNAME",
                    "host": "portal",
                    "value": "tenants.quadley.app"
                },
                "note": "For root domain, use A record with our IP or ALIAS record"
            },
            {
                "step": 4,
                "title": "Wait for DNS Propagation",
                "description": "DNS changes can take up to 48 hours to propagate globally"
            },
            {
                "step": 5,
                "title": "Verify Domain",
                "description": "Click 'Verify' to check DNS configuration"
            },
            {
                "step": 6,
                "title": "SSL Certificate",
                "description": "Automatic SSL provisioning via Let's Encrypt (handled by Quadley)"
            }
        ],
        "dns_providers": {
            "cloudflare": "Use CNAME flattening for root domains",
            "godaddy": "Standard CNAME setup",
            "namecheap": "Use URL redirect for root domain",
            "route53": "Use ALIAS record for root domains"
        },
        "troubleshooting": [
            "DNS propagation can take up to 48 hours",
            "Check for typos in TXT record value",
            "Ensure no conflicting records exist",
            "Use dig or nslookup to verify DNS locally"
        ]
    }
