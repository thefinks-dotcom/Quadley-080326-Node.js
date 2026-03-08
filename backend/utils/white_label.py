"""
White-Label Branding Configuration
===================================
Allows tenants to customize the look and feel of their portal with
custom logos, colors, fonts, and messaging.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator
from enum import Enum
import re

logger = logging.getLogger(__name__)


class FontFamily(str, Enum):
    """Available font families for branding."""
    INTER = "Inter"
    ROBOTO = "Roboto"
    OPEN_SANS = "Open Sans"
    LATO = "Lato"
    POPPINS = "Poppins"
    MONTSERRAT = "Montserrat"
    SOURCE_SANS = "Source Sans Pro"
    NUNITO = "Nunito"
    RALEWAY = "Raleway"
    PLAYFAIR = "Playfair Display"
    SYSTEM = "system-ui"


class BrandingTheme(str, Enum):
    """Pre-built themes."""
    LIGHT = "light"
    DARK = "dark"
    AUTO = "auto"  # Follow system preference


class BrandingConfig(BaseModel):
    """Complete branding configuration for a tenant."""
    
    # Basic Identity
    logo_url: Optional[str] = Field(None, description="Primary logo URL")
    logo_dark_url: Optional[str] = Field(None, description="Logo for dark mode")
    favicon_url: Optional[str] = Field(None, description="Favicon URL (32x32 recommended)")
    app_name: Optional[str] = Field(None, description="Custom app name (default: Quadley)")
    tagline: Optional[str] = Field(None, description="Tagline shown on login page")
    
    # Colors
    primary_color: str = Field(default="#3B82F6", description="Primary brand color (hex)")
    secondary_color: str = Field(default="#c9cdd5", description="Background/secondary color for home screen (hex)")
    background_color: str = Field(default="#FFFFFF", description="Main background color")
    text_color: str = Field(default="#1F2937", description="Primary text color")
    header_bg_color: Optional[str] = Field(None, description="Header background (defaults to primary)")
    header_text_color: str = Field(default="#FFFFFF", description="Header text color")
    sidebar_bg_color: Optional[str] = Field(None, description="Sidebar background color")
    sidebar_text_color: Optional[str] = Field(None, description="Sidebar text color")
    button_color: Optional[str] = Field(None, description="Button color (defaults to primary)")
    button_text_color: str = Field(default="#FFFFFF", description="Button text color")
    link_color: Optional[str] = Field(None, description="Link color (defaults to primary)")
    success_color: str = Field(default="#10B981", description="Success state color")
    warning_color: str = Field(default="#F59E0B", description="Warning state color")
    error_color: str = Field(default="#EF4444", description="Error state color")
    
    # Typography
    heading_font: FontFamily = Field(default=FontFamily.INTER, description="Font for headings")
    body_font: FontFamily = Field(default=FontFamily.INTER, description="Font for body text")
    font_size_base: str = Field(default="16px", description="Base font size")
    
    # Theme
    theme: BrandingTheme = Field(default=BrandingTheme.LIGHT, description="Color theme")
    enable_dark_mode: bool = Field(default=True, description="Allow users to toggle dark mode")
    
    # Login Page Customization
    login_bg_image: Optional[str] = Field(None, description="Login page background image URL")
    login_bg_color: Optional[str] = Field(None, description="Login page background color")
    login_welcome_text: Optional[str] = Field(None, description="Welcome text on login page")
    login_footer_text: Optional[str] = Field(None, description="Footer text on login page")
    show_powered_by: bool = Field(default=True, description="Show 'Powered by Quadley' badge")
    
    # Email Branding
    email_header_bg: Optional[str] = Field(None, description="Email header background color")
    email_footer_text: Optional[str] = Field(None, description="Custom email footer text")
    email_logo_url: Optional[str] = Field(None, description="Logo for emails (defaults to logo_url)")
    
    # Advanced
    custom_css: Optional[str] = Field(None, description="Custom CSS (sanitized)")
    custom_head_html: Optional[str] = Field(None, description="Custom HTML in <head> (sanitized)")
    
    # Metadata
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None
    
    @field_validator('primary_color', 'secondary_color', 'background_color', 'text_color', 
                     'header_text_color', 'button_text_color', 'success_color', 
                     'warning_color', 'error_color', mode='before')
    @classmethod
    def validate_hex_color(cls, v):
        if v and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError(f'Invalid hex color: {v}')
        return v


class BrandingPreset(BaseModel):
    """Pre-built branding preset."""
    name: str
    description: str
    config: Dict[str, Any]


# Pre-built branding presets
BRANDING_PRESETS = {
    "classic_blue": BrandingPreset(
        name="Classic Blue",
        description="Professional blue theme, perfect for traditional institutions",
        config={
            "primary_color": "#1E40AF",
            "secondary_color": "#3B82F6",
            "header_bg_color": "#1E3A8A",
            "heading_font": "Inter",
            "body_font": "Inter"
        }
    ),
    "modern_purple": BrandingPreset(
        name="Modern Purple",
        description="Contemporary purple theme with vibrant accents",
        config={
            "primary_color": "#7C3AED",
            "secondary_color": "#A78BFA",
            "header_bg_color": "#5B21B6",
            "heading_font": "Poppins",
            "body_font": "Inter"
        }
    ),
    "nature_green": BrandingPreset(
        name="Nature Green",
        description="Fresh green theme evoking growth and sustainability",
        config={
            "primary_color": "#059669",
            "secondary_color": "#34D399",
            "header_bg_color": "#047857",
            "heading_font": "Nunito",
            "body_font": "Open Sans"
        }
    ),
    "warm_orange": BrandingPreset(
        name="Warm Orange",
        description="Energetic orange theme for dynamic communities",
        config={
            "primary_color": "#EA580C",
            "secondary_color": "#FB923C",
            "header_bg_color": "#C2410C",
            "heading_font": "Montserrat",
            "body_font": "Lato"
        }
    ),
    "elegant_dark": BrandingPreset(
        name="Elegant Dark",
        description="Sophisticated dark theme for premium feel",
        config={
            "primary_color": "#6366F1",
            "secondary_color": "#818CF8",
            "background_color": "#111827",
            "text_color": "#F9FAFB",
            "header_bg_color": "#1F2937",
            "theme": "dark",
            "heading_font": "Playfair Display",
            "body_font": "Source Sans Pro"
        }
    ),
    "minimal_gray": BrandingPreset(
        name="Minimal Gray",
        description="Clean, minimalist grayscale design",
        config={
            "primary_color": "#374151",
            "secondary_color": "#6B7280",
            "header_bg_color": "#1F2937",
            "heading_font": "Inter",
            "body_font": "Inter"
        }
    )
}


def get_default_branding() -> Dict[str, Any]:
    """Get default branding configuration."""
    return BrandingConfig().model_dump()


def merge_branding_config(
    base: Dict[str, Any],
    overrides: Dict[str, Any]
) -> Dict[str, Any]:
    """Merge branding configuration with overrides."""
    result = base.copy()
    
    for key, value in overrides.items():
        if value is not None:
            result[key] = value
    
    return result


def apply_preset(
    current: Dict[str, Any],
    preset_name: str
) -> Dict[str, Any]:
    """Apply a branding preset to current configuration."""
    if preset_name not in BRANDING_PRESETS:
        raise ValueError(f"Unknown preset: {preset_name}")
    
    preset = BRANDING_PRESETS[preset_name]
    return merge_branding_config(current, preset.config)


def sanitize_custom_css(css: str) -> str:
    """Sanitize custom CSS to prevent XSS and dangerous properties."""
    if not css:
        return ""
    
    # Remove potentially dangerous content
    dangerous_patterns = [
        r'javascript:',
        r'expression\s*\(',
        r'behavior\s*:',
        r'@import',
        r'@charset',
        r'url\s*\([^)]*data:',
        r'</style>',
        r'<script',
    ]
    
    sanitized = css
    for pattern in dangerous_patterns:
        sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)
    
    # Limit length
    return sanitized[:10000]


def generate_css_variables(config: Dict[str, Any]) -> str:
    """Generate CSS custom properties from branding config."""
    css_vars = []
    
    mappings = {
        'primary_color': '--color-primary',
        'secondary_color': '--color-secondary',
        'background_color': '--color-background',
        'text_color': '--color-text',
        'header_bg_color': '--color-header-bg',
        'header_text_color': '--color-header-text',
        'sidebar_bg_color': '--color-sidebar-bg',
        'sidebar_text_color': '--color-sidebar-text',
        'button_color': '--color-button',
        'button_text_color': '--color-button-text',
        'link_color': '--color-link',
        'success_color': '--color-success',
        'warning_color': '--color-warning',
        'error_color': '--color-error',
    }
    
    for config_key, css_var in mappings.items():
        value = config.get(config_key)
        if value:
            css_vars.append(f"  {css_var}: {value};")
    
    # Font variables
    heading_font = config.get('heading_font', 'Inter')
    body_font = config.get('body_font', 'Inter')
    css_vars.append(f"  --font-heading: '{heading_font}', system-ui, sans-serif;")
    css_vars.append(f"  --font-body: '{body_font}', system-ui, sans-serif;")
    css_vars.append(f"  --font-size-base: {config.get('font_size_base', '16px')};")
    
    return ":root {\n" + "\n".join(css_vars) + "\n}"


async def get_tenant_branding(db, tenant_code: str) -> Dict[str, Any]:
    """Get branding configuration for a tenant."""
    tenant = await db.tenants.find_one(
        {"code": tenant_code},
        {"branding": 1, "logo_url": 1, "name": 1, "primary_color": 1}
    )
    
    if not tenant:
        return get_default_branding()
    
    # Start with defaults
    branding = get_default_branding()
    
    # Apply tenant's stored branding
    if tenant.get("branding"):
        branding = merge_branding_config(branding, tenant["branding"])
    
    # Legacy field support
    if tenant.get("logo_url") and not branding.get("logo_url"):
        branding["logo_url"] = tenant["logo_url"]
    if tenant.get("primary_color") and branding.get("primary_color") == "#3B82F6":
        branding["primary_color"] = tenant["primary_color"]
    if tenant.get("name"):
        branding["app_name"] = branding.get("app_name") or tenant["name"]
    
    return branding


async def update_tenant_branding(
    db,
    tenant_code: str,
    branding_updates: Dict[str, Any],
    updated_by: str
) -> Dict[str, Any]:
    """Update branding configuration for a tenant."""
    # Validate updates
    try:
        # Create a config to validate
        current = await get_tenant_branding(db, tenant_code)
        merged = merge_branding_config(current, branding_updates)
        validated = BrandingConfig(**merged)
    except Exception as e:
        raise ValueError(f"Invalid branding configuration: {e}")
    
    # Sanitize custom CSS if present
    if branding_updates.get("custom_css"):
        branding_updates["custom_css"] = sanitize_custom_css(branding_updates["custom_css"])
    
    # Add metadata
    branding_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    branding_updates["updated_by"] = updated_by
    
    # Update in database
    await db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {"branding": validated.model_dump()}}
    )
    
    return validated.model_dump()


def get_available_presets() -> List[Dict[str, Any]]:
    """Get list of available branding presets."""
    return [
        {
            "id": preset_id,
            "name": preset.name,
            "description": preset.description,
            "preview": preset.config
        }
        for preset_id, preset in BRANDING_PRESETS.items()
    ]
