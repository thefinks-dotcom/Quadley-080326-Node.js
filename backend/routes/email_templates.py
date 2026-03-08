"""
Email Template Customization routes.
Allows tenants to customize email templates for invitations, welcomes, etc.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid
import logging

from utils.auth import get_current_user
from utils.multi_tenant import master_db
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email-templates", tags=["email-templates"])


# Email Template Types
TEMPLATE_TYPES = [
    "invitation",
    "welcome", 
    "password_reset",
    "announcement",
    "event_reminder",
    "parcel_notification",
    "maintenance_update"
]

# Default Templates
DEFAULT_TEMPLATES = {
    "invitation": {
        "subject": "You're invited to join {{tenant_name}} on Quadley",
        "body": """
<p>Hi {{first_name}},</p>
<p>You've been invited to join <strong>{{tenant_name}}</strong> on Quadley as a <strong>{{role}}</strong>.</p>
<p>Click the button below to set up your account:</p>
<p><a href="{{setup_url}}" style="background:#3b82f6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Set Up Your Account</a></p>
<p>This invitation expires in {{expiry_days}} days.</p>
"""
    },
    "welcome": {
        "subject": "Welcome to {{tenant_name}} on Quadley!",
        "body": """
<p>Hi {{first_name}},</p>
<p>Welcome to <strong>{{tenant_name}}</strong>! Your account has been created successfully.</p>
<p>Here's what you can do:</p>
<ul>
<li>Complete your profile</li>
<li>Explore events and activities</li>
<li>Connect with your community</li>
</ul>
<p><a href="{{login_url}}" style="background:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Log In Now</a></p>
"""
    },
    "password_reset": {
        "subject": "Reset Your Quadley Password",
        "body": """
<p>Hi {{first_name}},</p>
<p>We received a request to reset your password.</p>
<p>Click the button below to create a new password:</p>
<p><a href="{{reset_url}}" style="background:#f59e0b;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Reset Password</a></p>
<p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
"""
    },
    "event_reminder": {
        "subject": "Reminder: {{event_title}} is coming up!",
        "body": """
<p>Hi {{first_name}},</p>
<p>This is a reminder that <strong>{{event_title}}</strong> is happening soon!</p>
<p><strong>When:</strong> {{event_date}}</p>
<p><strong>Where:</strong> {{event_location}}</p>
<p>We look forward to seeing you there!</p>
"""
    },
    "parcel_notification": {
        "subject": "You have a parcel waiting!",
        "body": """
<p>Hi {{first_name}},</p>
<p>You have a parcel waiting for collection.</p>
<p><strong>From:</strong> {{sender_name}}</p>
<p><strong>Tracking:</strong> {{tracking_number}}</p>
<p>Please collect it from the front desk at your earliest convenience.</p>
"""
    },
    "announcement": {
        "subject": "{{announcement_title}}",
        "body": """
<p>{{announcement_content}}</p>
<p>— {{tenant_name}} Administration</p>
"""
    },
    "maintenance_update": {
        "subject": "Update on your maintenance request",
        "body": """
<p>Hi {{first_name}},</p>
<p>There's an update on your maintenance request:</p>
<p><strong>Issue:</strong> {{issue_type}}</p>
<p><strong>Status:</strong> {{status}}</p>
<p>{{update_message}}</p>
"""
    }
}


class EmailTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_code: str
    template_type: str
    subject: str
    body: str
    variables: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    created_by: str


class EmailTemplateCreate(BaseModel):
    template_type: str
    subject: str
    body: str


class EmailTemplateUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/types")
async def get_template_types(
    current_user: User = Depends(get_current_user)
):
    """Get available email template types"""
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {
        "types": TEMPLATE_TYPES,
        "descriptions": {
            "invitation": "Sent when inviting new users",
            "welcome": "Sent after user completes registration",
            "password_reset": "Sent when user requests password reset",
            "announcement": "Sent for important announcements",
            "event_reminder": "Sent before events",
            "parcel_notification": "Sent when parcel arrives",
            "maintenance_update": "Sent for maintenance request updates"
        }
    }


@router.get("/defaults")
async def get_default_templates(
    current_user: User = Depends(get_current_user)
):
    """Get default email templates (for reference)"""
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"templates": DEFAULT_TEMPLATES}


@router.get("/tenant/{tenant_code}")
async def get_tenant_templates(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Get all email templates for a tenant"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get custom templates
    custom_templates = await master_db.email_templates.find(
        {"tenant_code": tenant_code},
        {"_id": 0}
    ).to_list(100)
    
    # Build response with defaults merged
    templates = {}
    for template_type in TEMPLATE_TYPES:
        # Start with default
        templates[template_type] = {
            "type": template_type,
            "subject": DEFAULT_TEMPLATES.get(template_type, {}).get("subject", ""),
            "body": DEFAULT_TEMPLATES.get(template_type, {}).get("body", ""),
            "is_custom": False,
            "is_active": True
        }
    
    # Override with custom templates
    for custom in custom_templates:
        template_type = custom.get("template_type")
        if template_type in templates:
            templates[template_type] = {
                "id": custom.get("id"),
                "type": template_type,
                "subject": custom.get("subject"),
                "body": custom.get("body"),
                "is_custom": True,
                "is_active": custom.get("is_active", True),
                "updated_at": custom.get("updated_at")
            }
    
    return {"tenant_code": tenant_code, "templates": templates}


@router.post("/tenant/{tenant_code}")
async def create_or_update_template(
    tenant_code: str,
    template_data: EmailTemplateCreate,
    current_user: User = Depends(get_current_user)
):
    """Create or update an email template for a tenant"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if template_data.template_type not in TEMPLATE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid template type. Valid types: {TEMPLATE_TYPES}"
        )
    
    # Check if custom template exists
    existing = await master_db.email_templates.find_one({
        "tenant_code": tenant_code,
        "template_type": template_data.template_type
    })
    
    if existing:
        # Update existing
        await master_db.email_templates.update_one(
            {"tenant_code": tenant_code, "template_type": template_data.template_type},
            {
                "$set": {
                    "subject": template_data.subject,
                    "body": template_data.body,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {"message": "Template updated", "template_type": template_data.template_type}
    else:
        # Create new
        template = EmailTemplate(
            tenant_code=tenant_code,
            template_type=template_data.template_type,
            subject=template_data.subject,
            body=template_data.body,
            created_by=current_user.id
        )
        
        template_doc = template.model_dump()
        template_doc['created_at'] = template_doc['created_at'].isoformat()
        await master_db.email_templates.insert_one(template_doc)
        
        return {"message": "Template created", "template_id": template.id}


@router.put("/tenant/{tenant_code}/{template_type}")
async def update_template(
    tenant_code: str,
    template_type: str,
    template_data: EmailTemplateUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a specific template"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if template_type not in TEMPLATE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid template type")
    
    update_data = {}
    if template_data.subject is not None:
        update_data["subject"] = template_data.subject
    if template_data.body is not None:
        update_data["body"] = template_data.body
    if template_data.is_active is not None:
        update_data["is_active"] = template_data.is_active
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await master_db.email_templates.update_one(
        {"tenant_code": tenant_code, "template_type": template_type},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template updated"}


@router.delete("/tenant/{tenant_code}/{template_type}")
async def reset_to_default(
    tenant_code: str,
    template_type: str,
    current_user: User = Depends(get_current_user)
):
    """Reset a template to default (deletes custom template)"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await master_db.email_templates.delete_one({
        "tenant_code": tenant_code,
        "template_type": template_type
    })
    
    if result.deleted_count == 0:
        return {"message": "Already using default template"}
    
    return {"message": "Template reset to default"}


@router.post("/preview")
async def preview_template(
    template_type: str,
    subject: str,
    body: str,
    sample_data: Optional[Dict] = None,
    current_user: User = Depends(get_current_user)
):
    """Preview a template with sample data"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Default sample data
    default_sample = {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "tenant_name": "Sample College",
        "role": "Student",
        "setup_url": "https://quadley.com/setup?token=sample",
        "login_url": "https://quadley.com/login",
        "reset_url": "https://quadley.com/reset?token=sample",
        "expiry_days": "7",
        "event_title": "Sample Event",
        "event_date": "January 30, 2026 at 6:00 PM",
        "event_location": "Main Hall",
        "sender_name": "Amazon",
        "tracking_number": "TRK123456789",
        "announcement_title": "Important Update",
        "announcement_content": "This is a sample announcement content.",
        "issue_type": "Plumbing",
        "status": "In Progress",
        "update_message": "Our maintenance team is working on this."
    }
    
    # Merge with provided sample data
    if sample_data:
        default_sample.update(sample_data)
    
    # Replace variables in template
    preview_subject = subject
    preview_body = body
    
    for key, value in default_sample.items():
        preview_subject = preview_subject.replace(f"{{{{{key}}}}}", str(value))
        preview_body = preview_body.replace(f"{{{{{key}}}}}", str(value))
    
    return {
        "subject": preview_subject,
        "body": preview_body,
        "variables_used": list(default_sample.keys())
    }
