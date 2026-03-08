"""
White-Label Branding API Routes
================================
Allows tenants to customize branding (logo, colors, fonts, login page).
Super admins can manage any tenant's branding. Tenant admins can manage their own.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from pydantic import BaseModel
import logging

from models import User
from utils.auth import get_current_user
from utils.multi_tenant import master_db
from utils.white_label import (
    get_tenant_branding,
    update_tenant_branding,
    get_default_branding,
    get_available_presets,
    generate_css_variables,
    BRANDING_PRESETS
)
from utils.admin_audit import log_admin_action, AdminActionType

router = APIRouter(prefix="/branding", tags=["branding"])
logger = logging.getLogger(__name__)


class BrandingUpdateRequest(BaseModel):
    """Request to update branding settings"""
    # Basic Identity
    logo_url: Optional[str] = None
    logo_dark_url: Optional[str] = None
    favicon_url: Optional[str] = None
    app_name: Optional[str] = None
    tagline: Optional[str] = None
    
    # Colors
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    header_bg_color: Optional[str] = None
    header_text_color: Optional[str] = None
    sidebar_bg_color: Optional[str] = None
    sidebar_text_color: Optional[str] = None
    button_color: Optional[str] = None
    button_text_color: Optional[str] = None
    link_color: Optional[str] = None
    success_color: Optional[str] = None
    warning_color: Optional[str] = None
    error_color: Optional[str] = None
    
    # Typography
    heading_font: Optional[str] = None
    body_font: Optional[str] = None
    font_size_base: Optional[str] = None
    
    # Theme
    theme: Optional[str] = None
    enable_dark_mode: Optional[bool] = None
    
    # Login Page
    login_bg_image: Optional[str] = None
    login_bg_color: Optional[str] = None
    login_welcome_text: Optional[str] = None
    login_footer_text: Optional[str] = None
    show_powered_by: Optional[bool] = None
    
    # Email
    email_header_bg: Optional[str] = None
    email_footer_text: Optional[str] = None
    email_logo_url: Optional[str] = None
    
    # Advanced
    custom_css: Optional[str] = None


class PresetApplyRequest(BaseModel):
    """Request to apply a branding preset"""
    preset_id: str


@router.get("/defaults")
async def get_branding_defaults():
    """
    Get default branding configuration.
    Public endpoint - no auth required.
    """
    return {
        "defaults": get_default_branding(),
        "fonts": [
            "Inter", "Roboto", "Open Sans", "Lato", "Poppins", 
            "Montserrat", "Source Sans Pro", "Nunito", "Raleway", 
            "Playfair Display", "system-ui"
        ],
        "themes": ["light", "dark", "auto"]
    }


@router.get("/presets")
async def list_branding_presets():
    """
    Get available branding presets.
    Public endpoint - no auth required.
    """
    return {
        "presets": get_available_presets()
    }


@router.get("/tenant/{tenant_code}")
async def get_tenant_branding_config(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get branding configuration for a tenant.
    Super admins can access any tenant. Tenant admins can access their own.
    """
    # Authorization check
    if current_user.role not in ['super_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user.role == 'admin':
        if not hasattr(current_user, 'tenant_code') or current_user.tenant_code != tenant_code:
            raise HTTPException(status_code=403, detail="Can only access your own tenant's branding")
    
    # Verify tenant exists
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    branding = await get_tenant_branding(master_db, tenant_code)
    
    return {
        "tenant_code": tenant_code,
        "tenant_name": tenant.get('name'),
        "branding": branding,
        "css_variables": generate_css_variables(branding)
    }


@router.put("/tenant/{tenant_code}")
async def update_tenant_branding_config(
    tenant_code: str,
    request: Request,
    updates: BrandingUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update branding configuration for a tenant.
    Super admins can update any tenant. Tenant admins can update their own.
    """
    # Authorization check
    if current_user.role not in ['super_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user.role == 'admin':
        if not hasattr(current_user, 'tenant_code') or current_user.tenant_code != tenant_code:
            raise HTTPException(status_code=403, detail="Can only update your own tenant's branding")
    
    # Verify tenant exists
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Convert to dict and filter out None values
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    try:
        updated_branding = await update_tenant_branding(
            master_db,
            tenant_code,
            update_data,
            current_user.id
        )
        
        # Log admin action
        await log_admin_action(
            master_db,
            admin_id=current_user.id,
            admin_email=current_user.email,
            action_type=AdminActionType.SETTINGS_UPDATE,
            target_type="branding",
            target_id=tenant_code,
            target_name=tenant.get('name'),
            details={"updated_fields": list(update_data.keys())},
            tenant_code=tenant_code,
            ip_address=request.client.host if request.client else None
        )
        
        return {
            "success": True,
            "branding": updated_branding,
            "css_variables": generate_css_variables(updated_branding)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tenant/{tenant_code}/apply-preset")
async def apply_branding_preset(
    tenant_code: str,
    request: Request,
    preset_data: PresetApplyRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Apply a branding preset to a tenant.
    Super admins can update any tenant. Tenant admins can update their own.
    """
    # Authorization check
    if current_user.role not in ['super_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user.role == 'admin':
        if not hasattr(current_user, 'tenant_code') or current_user.tenant_code != tenant_code:
            raise HTTPException(status_code=403, detail="Can only update your own tenant's branding")
    
    # Verify tenant exists
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Verify preset exists
    if preset_data.preset_id not in BRANDING_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unknown preset: {preset_data.preset_id}")
    
    try:
        # Get preset config
        preset_config = BRANDING_PRESETS[preset_data.preset_id].config
        
        updated_branding = await update_tenant_branding(
            master_db,
            tenant_code,
            preset_config,
            current_user.id
        )
        
        # Log admin action
        await log_admin_action(
            master_db,
            admin_id=current_user.id,
            admin_email=current_user.email,
            action_type=AdminActionType.SETTINGS_UPDATE,
            target_type="branding",
            target_id=tenant_code,
            target_name=tenant.get('name'),
            details={"preset_applied": preset_data.preset_id},
            tenant_code=tenant_code,
            ip_address=request.client.host if request.client else None
        )
        
        return {
            "success": True,
            "preset_applied": preset_data.preset_id,
            "branding": updated_branding,
            "css_variables": generate_css_variables(updated_branding)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tenant/{tenant_code}/reset")
async def reset_tenant_branding(
    tenant_code: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Reset branding to defaults for a tenant.
    Super admins can reset any tenant. Tenant admins can reset their own.
    """
    # Authorization check
    if current_user.role not in ['super_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user.role == 'admin':
        if not hasattr(current_user, 'tenant_code') or current_user.tenant_code != tenant_code:
            raise HTTPException(status_code=403, detail="Can only reset your own tenant's branding")
    
    # Verify tenant exists
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Reset branding to defaults
    defaults = get_default_branding()
    
    await master_db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {"branding": defaults}}
    )
    
    # Log admin action
    await log_admin_action(
        master_db,
        admin_id=current_user.id,
        admin_email=current_user.email,
        action_type=AdminActionType.SETTINGS_UPDATE,
        target_type="branding",
        target_id=tenant_code,
        target_name=tenant.get('name'),
        details={"action": "reset_to_defaults"},
        tenant_code=tenant_code,
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "success": True,
        "branding": defaults,
        "css_variables": generate_css_variables(defaults)
    }


@router.get("/public/{tenant_code}")
async def get_public_branding(tenant_code: str):
    """
    Get public branding for a tenant (login page, etc).
    No authentication required - used for pre-login branding.
    """
    tenant = await master_db.tenants.find_one({"code": tenant_code})
    if not tenant:
        # Return defaults for unknown tenants
        defaults = get_default_branding()
        return {
            "branding": {
                "app_name": "Quadley",
                "logo_url": defaults.get("logo_url"),
                "primary_color": defaults.get("primary_color"),
                "login_welcome_text": defaults.get("login_welcome_text"),
                "login_bg_color": defaults.get("login_bg_color"),
                "login_bg_image": defaults.get("login_bg_image"),
                "show_powered_by": True
            },
            "css_variables": generate_css_variables(defaults)
        }
    
    branding = await get_tenant_branding(master_db, tenant_code)
    
    # Return only public-facing branding fields
    public_branding = {
        "app_name": branding.get("app_name") or tenant.get("name"),
        "logo_url": branding.get("logo_url"),
        "logo_dark_url": branding.get("logo_dark_url"),
        "favicon_url": branding.get("favicon_url"),
        "primary_color": branding.get("primary_color"),
        "secondary_color": branding.get("secondary_color"),
        "background_color": branding.get("background_color"),
        "text_color": branding.get("text_color"),
        "login_bg_color": branding.get("login_bg_color"),
        "login_bg_image": branding.get("login_bg_image"),
        "login_welcome_text": branding.get("login_welcome_text"),
        "login_footer_text": branding.get("login_footer_text"),
        "show_powered_by": branding.get("show_powered_by", True),
        "theme": branding.get("theme"),
        "heading_font": branding.get("heading_font"),
        "body_font": branding.get("body_font")
    }
    
    return {
        "tenant_name": tenant.get("name"),
        "branding": public_branding,
        "css_variables": generate_css_variables(branding)
    }
