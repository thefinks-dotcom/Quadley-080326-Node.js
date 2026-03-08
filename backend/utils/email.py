"""
Email utility for sending transactional emails via SendGrid.
Supports invitation emails, welcome emails, and password reset emails.
"""
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'support@quadley.com')
FRONTEND_URL = os.environ.get('FRONTEND_URL')


class EmailDeliveryError(Exception):
    """Exception raised when email delivery fails"""
    pass


def send_email(to: str, subject: str, html_content: str) -> bool:
    """
    Send email via SendGrid
    
    Args:
        to: Recipient email address
        subject: Email subject line
        html_content: HTML content of the email
    
    Returns:
        True if email was sent successfully
    """
    if not SENDGRID_API_KEY:
        logger.warning("SendGrid API key not configured. Email not sent.")
        return False
    
    message = Mail(
        from_email=SENDGRID_FROM_EMAIL,
        to_emails=to,
        subject=subject,
        html_content=html_content
    )
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        if response.status_code in [200, 201, 202]:
            logger.info(f"Email sent successfully to {to}")
            return True
        else:
            logger.error(f"SendGrid returned status {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        raise EmailDeliveryError(f"Failed to send email: {str(e)}")


def send_invitation_email(
    to_email: str,
    tenant_name: str,
    invitation_token: str,
    role: str,
    inviter_name: Optional[str] = None,
    first_name: Optional[str] = None,
    invite_code: Optional[str] = None,
    ios_app_link: Optional[str] = None,
    android_app_link: Optional[str] = None,
    primary_color: str = "#0f172a",
    secondary_color: str = "#c9cdd5"
) -> bool:
    """
    Send invitation email to a new user with tenant branding.
    Directs them to download the app and use their invite code.
    """
    greeting = f"Hi {first_name}," if first_name else "Hello,"
    
    role_display = {
        'admin': 'Tenant Administrator',
        'ra': 'Resident Advisor (RA)',
        'student': 'Student'
    }.get(role, role.title())

    code_display = invite_code or "Check with your administrator"
    
    # Build download links section
    download_links = ""
    if ios_app_link:
        download_links += f'<a href="{ios_app_link}" style="color: {primary_color}; text-decoration: underline;">Download for iPhone</a>'
    if android_app_link:
        if download_links:
            download_links += '&nbsp;&nbsp;|&nbsp;&nbsp;'
        download_links += f'<a href="{android_app_link}" style="color: {primary_color}; text-decoration: underline;">Download for Android</a>'
    if not download_links:
        download_links = '<span style="color: #6b7280; font-size: 14px;">Contact your administrator for the download link</span>'

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{tenant_name} Invitation</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 16px;">
        
        <!-- Header -->
        <div style="background: {primary_color}; padding: 24px 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">{tenant_name}</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Community App</p>
        </div>
        
        <!-- Invite Code — FIRST, most important -->
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px 20px; text-align: center;">
            <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px;">Your personal invite code:</p>
            <div style="background: {primary_color}; color: white; display: inline-block; padding: 16px 28px; border-radius: 10px; font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: bold; letter-spacing: 4px;">
                {code_display}
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0;">Expires in 7 days</p>
        </div>
        
        <!-- Steps -->
        <div style="background: #f9fafb; padding: 24px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 8px; font-size: 15px;">{greeting}</p>
            <p style="margin: 0 0 16px; font-size: 15px;">You've been invited to join <strong>{tenant_name}</strong> as a <strong>{role_display}</strong>.</p>
            
            {f'<p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;"><em>Invited by: {inviter_name}</em></p>' if inviter_name else ''}
            
            <p style="font-weight: 600; font-size: 14px; margin: 0 0 12px; color: #1f2937;">How to get started:</p>
            
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                    <td style="width: 32px; vertical-align: top; padding: 6px 10px 14px 0;">
                        <div style="background: {primary_color}; color: white; width: 24px; height: 24px; border-radius: 12px; text-align: center; line-height: 24px; font-weight: bold; font-size: 13px;">1</div>
                    </td>
                    <td style="vertical-align: top; padding: 6px 0 14px;">
                        <strong style="font-size: 14px; color: #1f2937;">Download the app</strong><br>
                        <span style="font-size: 13px; color: #6b7280;">{download_links}</span>
                    </td>
                </tr>
                <tr>
                    <td style="width: 32px; vertical-align: top; padding: 6px 10px 14px 0;">
                        <div style="background: {primary_color}; color: white; width: 24px; height: 24px; border-radius: 12px; text-align: center; line-height: 24px; font-weight: bold; font-size: 13px;">2</div>
                    </td>
                    <td style="vertical-align: top; padding: 6px 0 14px;">
                        <strong style="font-size: 14px; color: #1f2937;">Tap "Join with Invite Code"</strong><br>
                        <span style="font-size: 13px; color: #6b7280;">Enter the code shown above</span>
                    </td>
                </tr>
                <tr>
                    <td style="width: 32px; vertical-align: top; padding: 6px 10px 0 0;">
                        <div style="background: {primary_color}; color: white; width: 24px; height: 24px; border-radius: 12px; text-align: center; line-height: 24px; font-weight: bold; font-size: 13px;">3</div>
                    </td>
                    <td style="vertical-align: top; padding: 6px 0 0;">
                        <strong style="font-size: 14px; color: #1f2937;">Set your password and you're in!</strong>
                    </td>
                </tr>
            </table>
        </div>
        
        <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 20px;">
            If you didn't expect this, you can safely ignore this email.<br>
            &copy; 2026 {tenant_name}
        </p>
    </body>
    </html>
    """
    
    subject = f"You're invited to join the {tenant_name} App"
    return send_email(to_email, subject, html_content)


def send_welcome_email(
    to_email: str,
    tenant_name: str,
    first_name: str,
    role: str,
    primary_color: str = "#0f172a"
) -> bool:
    """Send welcome email after user completes registration."""
    login_url = f"{FRONTEND_URL}/login"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to {tenant_name}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: {primary_color}; margin-bottom: 5px;">{tenant_name}</h1>
            <p style="color: #6b7280; font-size: 14px;">Community App</p>
        </div>
        
        <div style="background: {primary_color}; color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0 0 10px 0;">Welcome to {tenant_name}!</h2>
            <p style="margin: 0; opacity: 0.9;">Your account is ready</p>
        </div>
        
        <div style="background: #f9fafb; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <p>Hi {first_name},</p>
            
            <p>Welcome to <strong>{tenant_name}</strong>! Your account has been successfully created.</p>
            
            <p>Here's what you can do next:</p>
            <ul style="color: #4b5563;">
                <li>Complete your profile</li>
                <li>Explore events and activities</li>
                <li>Connect with your community</li>
                <li>Stay updated with announcements</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{login_url}" style="display: inline-block; background: {primary_color}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Log In Now
                </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
                Download our mobile app for the best experience on the go!
            </p>
        </div>
        
        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
            <p>Need help? Contact your college administrator.</p>
            <p>&copy; 2026 {tenant_name}. All rights reserved.</p>
        </div>
    </body>
    </html>
    """
    
    subject = f"Welcome to {tenant_name}!"
    return send_email(to_email, subject, html_content)


def send_password_reset_email(
    to_email: str,
    reset_token: str,
    first_name: Optional[str] = None,
    tenant_name: str = "Your College",
    primary_color: str = "#0f172a"
) -> bool:
    """Send password reset email."""
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    greeting = f"Hi {first_name}," if first_name else "Hello,"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: {primary_color}; margin-bottom: 5px;">{tenant_name}</h1>
            <p style="color: #6b7280; font-size: 14px;">Password Reset Request</p>
        </div>
        
        <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <p>{greeting}</p>
            
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" style="display: inline-block; background: {primary_color}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Reset Password
                </a>
            </div>
            
            <p style="color: #92400e; font-size: 14px;">
                This link will expire in 1 hour. If you didn't request a password reset, please ignore this email - your password will remain unchanged.
            </p>
            
            <p style="word-break: break-all; font-size: 13px; color: #4b5563; background: #fef9c3; padding: 10px; border-radius: 4px;">
                {reset_url}
            </p>
        </div>
        
        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
            <p>If you didn't request this password reset, your account is still secure.</p>
            <p>&copy; 2026 {tenant_name}. All rights reserved.</p>
        </div>
    </body>
    </html>
    """
    
    subject = f"Reset Your {tenant_name} Password"
    return send_email(to_email, subject, html_content)


def send_tenant_admin_invitation_email(
    to_email: str,
    tenant_name: str,
    tenant_code: str,
    invitation_token: str,
    contact_person_name: str,
    invite_code: Optional[str] = None,
    ios_app_link: Optional[str] = None,
    android_app_link: Optional[str] = None,
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

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{tenant_name} Admin Invitation</title>
    </head>
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
            
            <p>Great news! <strong>{tenant_name}</strong> has been set up, and you've been designated as the <strong>Administrator</strong>.</p>
            
            <p>As an administrator, you'll be able to:</p>
            <ul style="color: #4b5563;">
                <li>Invite and manage users (students, RAs, staff)</li>
                <li>Configure college-specific modules and features</li>
                <li>Customize branding and settings</li>
                <li>View analytics and reports</li>
            </ul>
            
            <p><strong>Getting started:</strong></p>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 20px 0;">
                <div style="display: flex; align-items: flex-start; margin-bottom: 18px;">
                    <div style="background: {primary_color}; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; margin-right: 12px; flex-shrink: 0;">1</div>
                    <div>
                        <strong style="color: #1f2937;">Download the {tenant_name} app</strong>
                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">{download_links}</p>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 18px;">
                    <div style="background: {primary_color}; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; margin-right: 12px; flex-shrink: 0;">2</div>
                    <div>
                        <strong style="color: #1f2937;">Open the app and tap "Join with Invite Code"</strong>
                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Enter your personal invite code below</p>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start;">
                    <div style="background: {primary_color}; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; margin-right: 12px; flex-shrink: 0;">3</div>
                    <div>
                        <strong style="color: #1f2937;">Set your password and start managing!</strong>
                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Create a secure password to access your admin dashboard</p>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin: 25px 0;">
                <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">Your personal invite code:</p>
                <div style="background: {primary_color}; color: white; display: inline-block; padding: 14px 32px; border-radius: 10px; font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
                    {code_display}
                </div>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
                This code expires in 30 days. If it expires, contact your support contact to resend.
            </p>
        </div>
        
        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
            <p>&copy; 2026 {tenant_name}. All rights reserved.</p>
        </div>
    </body>
    </html>
    """
    
    subject = f"You're the Administrator for {tenant_name}"
    return send_email(to_email, subject, html_content)
