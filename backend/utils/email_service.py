"""Email service for transactional emails (password reset, notifications, etc.)

Uses SendGrid API for reliable email delivery.
"""
import os
import asyncio
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# SendGrid configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDER_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', os.environ.get('SENDER_EMAIL', 'support@quadley.com'))
FRONTEND_URL = os.environ.get('FRONTEND_URL')

# Check if SendGrid is configured
EMAIL_ENABLED = bool(SENDGRID_API_KEY)

sg_client = None
if EMAIL_ENABLED:
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        sg_client = SendGridAPIClient(SENDGRID_API_KEY)
        logger.info("Email service initialized with SendGrid")
    except ImportError:
        logger.warning("SendGrid package not installed. Email service disabled.")
        EMAIL_ENABLED = False
else:
    logger.warning("SENDGRID_API_KEY not configured. Email service disabled.")


def is_email_enabled() -> bool:
    """Check if email service is enabled."""
    return EMAIL_ENABLED


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> dict:
    """
    Send an email using SendGrid API.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML body of the email
        text_content: Plain text body (optional fallback)
    
    Returns:
        Dict with success status and message_id or error
    """
    if not EMAIL_ENABLED or not sg_client:
        logger.warning(f"Email service disabled. Would send to {to_email}: {subject}")
        return {"success": False, "error": "Email service not configured"}
    
    try:
        from sendgrid.helpers.mail import Mail
        
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content
        )
        
        if text_content:
            message.plain_text_content = text_content
        
        response = await asyncio.to_thread(sg_client.send, message)
        
        if response.status_code in [200, 201, 202]:
            logger.info(f"Email sent successfully to {to_email}")
            return {
                "success": True,
                "message_id": response.headers.get('X-Message-Id', 'unknown'),
                "status_code": response.status_code
            }
        else:
            logger.error(f"SendGrid returned status {response.status_code}")
            return {"success": False, "error": f"SendGrid returned status {response.status_code}"}
            
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return {"success": False, "error": str(e)}


async def send_password_reset_email(
    to_email: str,
    user_name: str,
    reset_token: str,
    tenant_name: str = "Your College",
    primary_color: str = "#1e3a5f"
) -> dict:
    """Send password reset email with reset link."""
    
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: {primary_color}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset Request</h1>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p>Hi {user_name},</p>
            
            <p>We received a request to reset your password for your {tenant_name} account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background-color: {primary_color}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
            
            <p style="color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{reset_link}" style="color: {primary_color}; word-break: break-all;">{reset_link}</a>
            </p>
        </div>
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            &copy; {datetime.now().year} {tenant_name}. All rights reserved.
        </p>
    </body>
    </html>
    """
    
    text_content = f"""
Hi {user_name},

We received a request to reset your password for your {tenant_name} account.

Click this link to reset your password:
{reset_link}

This link will expire in 1 hour.

If you didn't request this, you can ignore this email.

- The {tenant_name} Team
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"Reset Your {tenant_name} Password",
        html_content=html_content,
        text_content=text_content
    )


async def send_welcome_email(
    to_email: str,
    user_name: str,
    tenant_name: str = "Your College",
    primary_color: str = "#1e3a5f"
) -> dict:
    """Send welcome email to new users."""
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: {primary_color}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to {tenant_name}!</h1>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p>Hi {user_name},</p>
            
            <p>Welcome to {tenant_name}! Your account has been created successfully.</p>
            
            <p>With the {tenant_name} app, you can:</p>
            <ul>
                <li>Stay updated with college announcements and events</li>
                <li>Connect with fellow residents</li>
                <li>Access dining menus and request late meals</li>
                <li>Submit maintenance requests</li>
                <li>And much more!</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{FRONTEND_URL}" style="background-color: {primary_color}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Get Started</a>
            </div>
            
            <p>If you have any questions, reach out to your RA or college admin.</p>
            
            <p>Best,<br>The {tenant_name} Team</p>
        </div>
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            &copy; {datetime.now().year} {tenant_name}. All rights reserved.
        </p>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"Welcome to {tenant_name}!",
        html_content=html_content
    )


async def send_student_invite_email(
    to_email: str,
    user_name: str,
    setup_token: str,
    floor: Optional[str] = None,
    room: Optional[str] = None,
    tenant_name: str = "Your College",
    primary_color: str = "#1e3a5f",
    secondary_color: str = "#c9cdd5"
) -> dict:
    """Send invite email to new student with tenant branding."""
    
    setup_link = f"{FRONTEND_URL}/setup-password?token={setup_token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 16px;">
        
        <!-- Header -->
        <div style="background: {primary_color}; padding: 24px 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">{tenant_name}</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Community App</p>
        </div>
        
        <!-- CTA — immediately visible -->
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px 20px; text-align: center;">
            <p style="margin: 0 0 6px; font-size: 15px;">Hi {user_name}, you're invited!</p>
            <p style="margin: 0 0 20px; color: #6b7280; font-size: 13px;">Tap below to set up your account</p>
            <a href="{setup_link}" style="background-color: {primary_color}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Set Up Your Password</a>
            <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0;">Link expires in 7 days</p>
        </div>
        
        <!-- Details -->
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 14px; margin: 0 0 12px;">With the {tenant_name} app you can:</p>
            <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
                <li style="margin-bottom: 6px;">Get college announcements and events</li>
                <li style="margin-bottom: 6px;">Connect with fellow residents</li>
                <li style="margin-bottom: 6px;">View dining menus</li>
                <li>Submit maintenance requests</li>
            </ul>
            <p style="font-size: 13px; color: #6b7280; margin: 16px 0 0;">Questions? Contact your RA or college admin.</p>
        </div>
        
        <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 16px;">
            If the button doesn't work: <a href="{setup_link}" style="color: {primary_color}; word-break: break-all;">{setup_link}</a>
        </p>
        <p style="text-align: center; color: #9ca3af; font-size: 11px;">&copy; {datetime.now().year} {tenant_name}</p>
    </body>
    </html>
    """
    
    text_content = f"""
Hi {user_name},

You're invited to join the {tenant_name} app!

To get started, please set up your password by visiting:
{setup_link}

This link will expire in 7 days.

If you have any questions, reach out to your RA or college admin.

- The {tenant_name} Team
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"You're Invited to Join the {tenant_name} App",
        html_content=html_content,
        text_content=text_content
    )


async def send_mfa_enabled_email(
    to_email: str,
    user_name: str,
    tenant_name: str = "Your College",
    primary_color: str = "#1e3a5f"
) -> dict:
    """Send notification email when MFA is enabled on an account."""
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #22c55e; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">MFA Enabled Successfully</h1>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p>Hi {user_name},</p>
            
            <p>Two-factor authentication (MFA) has been successfully enabled on your {tenant_name} account.</p>
            
            <p>From now on, you'll need to enter a verification code from your authenticator app when logging in.</p>
            
            <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                <strong style="color: #166534;">Security Tip:</strong>
                <p style="margin: 8px 0 0 0; color: #166534;">Make sure to keep your backup codes in a safe place in case you lose access to your authenticator app.</p>
            </div>
            
            <p style="color: #666; font-size: 14px;">If you didn't enable MFA, please contact your administrator immediately.</p>
            
            <p>Best,<br>The {tenant_name} Team</p>
        </div>
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            &copy; {datetime.now().year} {tenant_name}. All rights reserved.
        </p>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"MFA Enabled on Your {tenant_name} Account",
        html_content=html_content
    )


async def send_setup_reminder_email(
    to_email: str,
    user_name: str,
    setup_token: str,
    days_since_invite: int,
    floor: Optional[str] = None,
    room: Optional[str] = None,
    tenant_name: str = "Your College",
    primary_color: str = "#1e3a5f"
) -> dict:
    """Send reminder email to users who haven't completed account setup."""
    
    setup_link = f"{FRONTEND_URL}/setup-password?token={setup_token}"
    location_info = ""
    if floor or room:
        parts = []
        if floor:
            parts.append(f"Floor: {floor}")
        if room:
            parts.append(f"Room: {room}")
        location_info = f"<p style='color: #666;'>Your assigned location: {', '.join(parts)}</p>"
    
    urgency_message = ""
    if days_since_invite >= 5:
        urgency_message = """
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <strong style="color: #991b1b;">Your invitation expires soon!</strong>
            <p style="margin: 8px 0 0 0; color: #991b1b;">Please complete your account setup before the link expires.</p>
        </div>
        """
    elif days_since_invite >= 3:
        urgency_message = f"""
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">Friendly Reminder</strong>
            <p style="margin: 8px 0 0 0; color: #92400e;">Don't forget to set up your {tenant_name} account to stay connected with your residential community!</p>
        </div>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: {primary_color}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Complete Your Account Setup</h1>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p>Hi {user_name},</p>
            
            <p>We noticed you haven't completed your {tenant_name} account setup yet. You're missing out on connecting with your residential community!</p>
            
            {urgency_message}
            
            {location_info}
            
            <p>Click the button below to set up your password and get started:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{setup_link}" style="background-color: {primary_color}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Complete Setup Now</a>
            </div>
            
            <p>With the {tenant_name} app, you can:</p>
            <ul>
                <li>Get important announcements from your college</li>
                <li>Discover and RSVP to events</li>
                <li>View dining menus and request late meals</li>
                <li>Submit maintenance requests</li>
                <li>Connect with fellow residents</li>
            </ul>
            
            <p>If you're having trouble or need help, please contact your RA or college admin.</p>
            
            <p>Best,<br>The {tenant_name} Team</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{setup_link}" style="color: {primary_color}; word-break: break-all;">{setup_link}</a>
            </p>
        </div>
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            &copy; {datetime.now().year} {tenant_name}. All rights reserved.
        </p>
    </body>
    </html>
    """
    
    text_content = f"""
Hi {user_name},

We noticed you haven't completed your {tenant_name} account setup yet.

Click this link to set up your password and get started:
{setup_link}

With the {tenant_name} app, you can stay updated with announcements, discover events, view dining menus, and connect with fellow residents.

If you need help, contact your RA or college admin.

- The {tenant_name} Team
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"Reminder: Complete Your {tenant_name} Account Setup",
        html_content=html_content,
        text_content=text_content
    )


async def send_invitation_email(
    to_email: str,
    tenant_name: str,
    invitation_token: str,
    role: str,
    inviter_name: str = None,
    first_name: str = None,
    invite_code: str = None,
    ios_app_link: str = None,
    android_app_link: str = None,
    primary_color: str = "#0f172a",
    secondary_color: str = "#c9cdd5"
) -> bool:
    """Send invitation email to a new user with tenant branding."""
    greeting = f"Hi {first_name}," if first_name else "Hello,"
    role_display = {
        'admin': 'Tenant Administrator',
        'ra': 'Resident Advisor (RA)',
        'student': 'Student'
    }.get(role, role.title())
    code_display = invite_code or "Check with your administrator"

    download_links = ""
    if ios_app_link:
        download_links += f'<a href="{ios_app_link}" style="color: {primary_color}; text-decoration: underline;">Download for iPhone</a>'
    if android_app_link:
        if download_links:
            download_links += '&nbsp;&nbsp;|&nbsp;&nbsp;'
        download_links += f'<a href="{android_app_link}" style="color: {primary_color}; text-decoration: underline;">Download for Android</a>'
    if not download_links:
        download_links = '<span style="color: #6b7280; font-size: 14px;">Contact your administrator for the download link</span>'

    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{tenant_name} Invitation</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 16px;">
  <div style="background: {primary_color}; padding: 24px 20px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">{tenant_name}</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Community App</p>
  </div>
  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px 20px; text-align: center;">
    <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px;">Your personal invite code:</p>
    <div style="background: {primary_color}; color: white; display: inline-block; padding: 16px 28px; border-radius: 10px; font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: bold; letter-spacing: 4px;">{code_display}</div>
    <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0;">Expires in 7 days</p>
  </div>
  <div style="background: #f9fafb; padding: 24px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 8px; font-size: 15px;">{greeting}</p>
    <p style="margin: 0 0 16px; font-size: 15px;">You've been invited to join <strong>{tenant_name}</strong> as a <strong>{role_display}</strong>.</p>
    {f'<p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;"><em>Invited by: {inviter_name}</em></p>' if inviter_name else ''}
    <p style="font-weight: 600; font-size: 14px; margin: 0 0 12px; color: #1f2937;">How to get started:</p>
    <ol style="padding-left: 20px; color: #4b5563; font-size: 14px;">
      <li style="margin-bottom: 8px;"><strong>Download the app</strong> — {download_links}</li>
      <li style="margin-bottom: 8px;"><strong>Tap "Join with Invite Code"</strong> and enter the code above</li>
      <li><strong>Set your password and you're in!</strong></li>
    </ol>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 20px;">If you didn't expect this, you can safely ignore this email.<br>&copy; 2026 {tenant_name}</p>
</body>
</html>"""

    return await send_email(
        to_email=to_email,
        subject=f"You're invited to join the {tenant_name} App",
        html_content=html_content
    )


async def send_tenant_admin_invitation_email(
    to_email: str,
    tenant_name: str,
    tenant_code: str,
    invitation_token: str,
    contact_person_name: str,
    invite_code: str = None,
    ios_app_link: str = None,
    android_app_link: str = None,
    primary_color: str = "#0f172a"
) -> bool:
    """Send invitation email to a new tenant admin (college administrator)."""
    first_name = contact_person_name.split()[0] if contact_person_name else "Administrator"
    code_display = invite_code or "Check with your support contact"

    download_links = ""
    if ios_app_link:
        download_links += f'<a href="{ios_app_link}" style="color: {primary_color}; text-decoration: underline;">Download for iPhone</a>'
    if android_app_link:
        if download_links:
            download_links += '&nbsp;&nbsp;|&nbsp;&nbsp;'
        download_links += f'<a href="{android_app_link}" style="color: {primary_color}; text-decoration: underline;">Download for Android</a>'
    if not download_links:
        download_links = '<span style="color: #6b7280; font-size: 14px;">Contact your support contact for the download link</span>'

    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{tenant_name} Admin Invitation</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: {primary_color}; margin-bottom: 5px;">{tenant_name}</h1>
    <p style="color: #6b7280; font-size: 14px;">Administration Platform</p>
  </div>
  <div style="background: {primary_color}; color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
    <h2 style="margin: 0 0 10px 0;">Welcome, Administrator!</h2>
    <p style="margin: 0; opacity: 0.9;">{tenant_name} is ready for you</p>
  </div>
  <div style="background: #f9fafb; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
    <p>Hi {first_name},</p>
    <p><strong>{tenant_name}</strong> has been set up and you've been designated as the <strong>Administrator</strong>.</p>
    <p>Your admin invite code:</p>
    <div style="background: {primary_color}; color: white; display: inline-block; padding: 12px 24px; border-radius: 10px; font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: bold; letter-spacing: 4px;">{code_display}</div>
    <p style="margin-top: 20px;"><strong>Getting started:</strong></p>
    <ol style="padding-left: 20px; color: #4b5563; font-size: 14px;">
      <li style="margin-bottom: 8px;"><strong>Download the {tenant_name} app</strong> — {download_links}</li>
      <li style="margin-bottom: 8px;"><strong>Tap "Join with Invite Code"</strong> and enter your code</li>
      <li><strong>Set your password and start managing!</strong></li>
    </ol>
  </div>
  <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
    <p>&copy; 2026 {tenant_name}. All rights reserved.</p>
  </div>
</body>
</html>"""

    return await send_email(
        to_email=to_email,
        subject=f"Welcome, Administrator — {tenant_name} is ready for you",
        html_content=html_content
    )
