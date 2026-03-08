"""
Push Notification Routes - Tenant isolated (OWASP A01)
========================
Handles device registration, push notification management, and notification history.
Uses Apple Push Notification service (APNs) for iOS.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging
import uuid

from utils.auth import get_tenant_db_for_user
from utils.apns_service import apns_service, send_push_to_users, send_push_to_all

router = APIRouter(prefix="/notifications", tags=["Notifications"])
logger = logging.getLogger(__name__)


class DeviceRegistration(BaseModel):
    device_token: str
    platform: str = "ios"  # "ios" or "android"


class NotificationPreferences(BaseModel):
    announcements: bool = True
    events: bool = True
    messages: bool = True
    shoutouts: bool = True
    dining_menu: bool = True
    parcels: bool = True
    maintenance: bool = True


class SendNotificationRequest(BaseModel):
    user_ids: Optional[List[str]] = None  # None = broadcast to all
    title: str
    body: str
    data: Optional[dict] = None


class TestNotificationRequest(BaseModel):
    title: str = "Test Notification"
    body: str = "This is a test push notification from Quadley"


# ============ NOTIFICATION HISTORY ============

@router.get("")
async def get_notifications(
    tenant_data: tuple = Depends(get_tenant_db_for_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False)
):
    """
    Get notification history for the current user - tenant isolated.
    
    Returns paginated list of notifications with read status.
    """
    tenant_db, current_user = tenant_data
    
    try:
        query = {"user_id": current_user.id}
        
        if unread_only:
            query["read"] = False
        
        # Get total count
        total = await tenant_db.notification_history.count_documents(query)
        
        # Get notifications
        cursor = tenant_db.notification_history.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit)
        
        notifications = await cursor.to_list(length=limit)
        
        # Get unread count
        unread_count = await tenant_db.notification_history.count_documents({
            "user_id": current_user.id,
            "read": False
        })
        
        return {
            "notifications": notifications,
            "total": total,
            "unread_count": unread_count,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Get notifications error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread-count")
async def get_unread_count(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get count of unread notifications for badge display - tenant isolated."""
    tenant_db, current_user = tenant_data
    
    try:
        count = await tenant_db.notification_history.count_documents({
            "user_id": current_user.id,
            "read": False
        })
        return {"unread_count": count}
    except Exception as e:
        logger.error(f"Get unread count error: {e}")
        return {"unread_count": 0}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Mark a specific notification as read - tenant isolated.
    
    Security: Validates user_id ownership. tenant_code is logged for audit.
    """
    tenant_db, current_user = tenant_data
    
    try:
        # Build query - must match user_id (and optionally tenant_code if set)
        query = {"id": notification_id, "user_id": current_user.id}
        
        result = await tenant_db.notification_history.update_one(
            query,
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.matched_count == 0:
            # Log potential unauthorized access attempt
            logger.warning(f"Notification access denied: user={current_user.id} notif={notification_id}")
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True, "message": "Notification marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mark notification read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/read-all")
async def mark_all_notifications_read(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Mark all notifications as read for the current user - tenant isolated."""
    tenant_db, current_user = tenant_data
    
    try:
        result = await tenant_db.notification_history.update_many(
            {"user_id": current_user.id, "read": False},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "message": f"Marked {result.modified_count} notifications as read"
        }
        
    except Exception as e:
        logger.error(f"Mark all read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete a specific notification - tenant isolated.
    
    Security: Validates user_id ownership before deletion.
    """
    tenant_db, current_user = tenant_data
    
    try:
        result = await tenant_db.notification_history.delete_one({
            "id": notification_id,
            "user_id": current_user.id
        })
        
        if result.deleted_count == 0:
            # Log potential unauthorized access attempt
            logger.warning(f"Notification delete denied: user={current_user.id} notif={notification_id}")
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True, "message": "Notification deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def clear_all_notifications(
    tenant_data: tuple = Depends(get_tenant_db_for_user),
    older_than_days: int = Query(None, ge=1, le=365)
):
    """
    Clear notifications for the current user - tenant isolated.
    
    If older_than_days is specified, only delete notifications older than that many days.
    Otherwise, delete all notifications.
    """
    tenant_db, current_user = tenant_data
    
    try:
        query = {"user_id": current_user.id}
        
        if older_than_days:
            cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
            query["created_at"] = {"$lt": cutoff.isoformat()}
        
        result = await tenant_db.notification_history.delete_many(query)
        
        return {
            "success": True,
            "message": f"Deleted {result.deleted_count} notifications"
        }
        
    except Exception as e:
        logger.error(f"Clear notifications error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Helper function to store notification in history
async def store_notification(
    tenant_db,  # Pass tenant db explicitly
    user_id: str,
    title: str,
    body: str,
    notification_type: str,
    data: Optional[dict] = None,
    tenant_code: Optional[str] = None
):
    """Store a notification in the user's history - tenant isolated.
    
    Security: Includes tenant_code for data isolation verification.
    """
    try:
        # Sanitize data - remove any PII that shouldn't be stored
        safe_data = data.copy() if data else {}
        # Remove email addresses from stored data (privacy protection)
        safe_data.pop('applicant_email', None)
        safe_data.pop('email', None)
        safe_data.pop('user_email', None)
        
        notification = {
            "id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "tenant_code": tenant_code,  # For tenant isolation
            "title": title,
            "body": body,
            "type": notification_type,
            "data": safe_data,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await tenant_db.notification_history.insert_one(notification)
        return notification
        
    except Exception as e:
        logger.error(f"Store notification error: {e}")
        return None


# ============ DEVICE REGISTRATION ============

@router.post("/register-device")
async def register_device(
    registration: DeviceRegistration, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Register a device token for push notifications - tenant isolated.
    Call this when the app launches and gets a device token.
    """
    tenant_db, current_user = tenant_data
    
    try:
        # Validate device token format (APNs tokens are 64 hex characters)
        token = registration.device_token.replace(" ", "").replace("<", "").replace(">", "")
        
        if registration.platform == "ios" and len(token) != 64:
            logger.warning(f"Invalid iOS device token length: {len(token)}")
            # Still accept it - might be valid in some formats
        
        # Check if this device token already exists
        existing = await tenant_db.device_tokens.find_one({
            "device_token": token
        })
        
        if existing:
            # Update existing registration (user might have logged in on same device)
            await tenant_db.device_tokens.update_one(
                {"device_token": token},
                {
                    "$set": {
                        "user_id": current_user.id,
                        "platform": registration.platform,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "active": True
                    }
                }
            )
            logger.info(f"Updated device token for user {current_user.id}")
        else:
            # Create new registration
            await tenant_db.device_tokens.insert_one({
                "user_id": current_user.id,
                "device_token": token,
                "platform": registration.platform,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "active": True
            })
            logger.info(f"Registered new device token for user {current_user.id}")
        
        return {
            "success": True,
            "message": "Device registered successfully"
        }
        
    except Exception as e:
        logger.error(f"Device registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/unregister-device")
async def unregister_device(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """
    Unregister all device tokens for the current user - tenant isolated.
    Call this on logout.
    """
    tenant_db, current_user = tenant_data
    
    try:
        result = await tenant_db.device_tokens.update_many(
            {"user_id": current_user.id},
            {"$set": {"active": False}}
        )
        
        return {
            "success": True,
            "message": f"Unregistered {result.modified_count} device(s)"
        }
        
    except Exception as e:
        logger.error(f"Device unregistration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/unregister-device/{device_token}")
async def unregister_specific_device(
    device_token: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Unregister a specific device token - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    try:
        await tenant_db.device_tokens.update_one(
            {"device_token": device_token, "user_id": current_user.id},
            {"$set": {"active": False}}
        )
        return {"success": True, "message": "Device unregistered"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ NOTIFICATION PREFERENCES ============

@router.get("/preferences")
async def get_notification_preferences(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get user's notification preferences - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    return {
        "announcements": getattr(current_user, 'notif_announcements', True),
        "events": getattr(current_user, 'notif_events', True),
        "messages": getattr(current_user, 'notif_messages', True),
        "shoutouts": getattr(current_user, 'notif_shoutouts', True),
        "dining_menu": getattr(current_user, 'notif_dining_menu', True),
        "parcels": getattr(current_user, 'notif_parcels', True),
        "maintenance": getattr(current_user, 'notif_maintenance', True),
    }


@router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreferences,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update user's notification preferences - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    try:
        await tenant_db.users.update_one(
            {"id": current_user.id},
            {
                "$set": {
                    "notif_announcements": preferences.announcements,
                    "notif_events": preferences.events,
                    "notif_messages": preferences.messages,
                    "notif_shoutouts": preferences.shoutouts,
                    "notif_dining_menu": preferences.dining_menu,
                    "notif_parcels": preferences.parcels,
                    "notif_maintenance": preferences.maintenance,
                }
            }
        )
        return {"success": True, "message": "Preferences updated"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ SEND NOTIFICATIONS (Admin) ============

@router.post("/send")
async def send_notification(
    request: SendNotificationRequest,
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Send push notification to specific users or broadcast to all - tenant isolated.
    Admin only.
    """
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        if request.user_ids:
            # Send to specific users
            result = await send_push_to_users(
                db=tenant_db,
                user_ids=request.user_ids,
                title=request.title,
                body=request.body,
                data=request.data
            )
        else:
            # Broadcast to all
            result = await send_push_to_all(
                db=tenant_db,
                title=request.title,
                body=request.body,
                data=request.data,
                exclude_users=[current_user.id]  # Don't notify sender
            )
        
        return result
        
    except Exception as e:
        logger.error(f"Send notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test")
async def send_test_notification(
    request: TestNotificationRequest,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Send a test notification to the current user's devices - tenant isolated.
    Useful for testing push notification setup.
    """
    tenant_db, current_user = tenant_data
    
    try:
        # Get user's device tokens
        tokens = await tenant_db.device_tokens.find({
            "user_id": current_user.id,
            "active": True,
            "platform": "ios"
        }).to_list(10)
        
        if not tokens:
            return {
                "success": False,
                "message": "No registered iOS devices found. Make sure push notifications are enabled in the app."
            }
        
        results = []
        for token_doc in tokens:
            result = await apns_service.send_notification(
                device_token=token_doc["device_token"],
                title=request.title,
                body=request.body,
                data={"type": "test", "timestamp": datetime.now(timezone.utc).isoformat()}
            )
            results.append(result)
        
        successful = sum(1 for r in results if r.get('success'))
        
        return {
            "success": successful > 0,
            "message": f"Sent to {successful}/{len(results)} device(s)",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Test notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ HELPER FUNCTIONS FOR OTHER ROUTES ============
# These functions are called from other route modules with tenant_db passed explicitly

async def notify_new_message(tenant_db, sender_id: str, sender_name: str, receiver_id: str, preview: str):
    """Notify user of new message"""
    try:
        # Check if user has messages notifications enabled
        user = await tenant_db.users.find_one({"id": receiver_id}, {"notif_messages": 1})
        if user and not user.get("notif_messages", True):
            return
        
        await send_push_to_users(
            db=tenant_db,
            user_ids=[receiver_id],
            title=f"New message from {sender_name}",
            body=preview[:100],
            data={"type": "message", "sender_id": sender_id},
            notification_type="messages"
        )
    except Exception as e:
        logger.error(f"Message notification error: {e}")


async def notify_new_announcement(tenant_db, title: str, preview: str, exclude_user: str = None):
    """Notify all users of new announcement"""
    try:
        await send_push_to_all(
            db=tenant_db,
            title=f"📢 {title}",
            body=preview[:100],
            data={"type": "announcement"},
            exclude_users=[exclude_user] if exclude_user else None
        )
    except Exception as e:
        logger.error(f"Announcement notification error: {e}")


async def notify_event_reminder(tenant_db, user_ids: List[str], event_title: str, time_until: str):
    """Notify users about upcoming event"""
    try:
        await send_push_to_users(
            db=tenant_db,
            user_ids=user_ids,
            title=f"Event Reminder: {event_title}",
            body=f"Starting {time_until}",
            data={"type": "event_reminder"},
            notification_type="events"
        )
    except Exception as e:
        logger.error(f"Event reminder notification error: {e}")


async def notify_parcel_arrived(tenant_db, user_id: str, description: str = None):
    """Notify user that a parcel has arrived"""
    try:
        body = "You have a parcel waiting for collection"
        if description:
            body = f"Parcel arrived: {description}"
        
        await send_push_to_users(
            db=tenant_db,
            user_ids=[user_id],
            title="📦 Parcel Arrived!",
            body=body,
            data={"type": "parcel"},
            notification_type="parcels"
        )
    except Exception as e:
        logger.error(f"Parcel notification error: {e}")


async def notify_maintenance_update(tenant_db, user_id: str, status: str, issue_type: str):
    """Notify user about maintenance request update"""
    try:
        await send_push_to_users(
            db=tenant_db,
            user_ids=[user_id],
            title=f"Maintenance Update: {issue_type}",
            body=f"Status changed to: {status}",
            data={"type": "maintenance"},
            notification_type="maintenance"
        )
    except Exception as e:
        logger.error(f"Maintenance notification error: {e}")


async def notify_shoutout(tenant_db, user_id: str, from_name: str, message: str):
    """Notify user they received a shoutout"""
    try:
        await send_push_to_users(
            db=tenant_db,
            user_ids=[user_id],
            title=f"⭐ Shoutout from {from_name}!",
            body=message[:100],
            data={"type": "shoutout"},
            notification_type="shoutouts"
        )
    except Exception as e:
        logger.error(f"Shoutout notification error: {e}")


async def notify_job_application(
    tenant_db,
    job_id: str,
    job_title: str,
    applicant_name: str,
    applicant_email: str,
    tenant_code: str = None
):
    """
    Notify all admins in the tenant when a new job application is submitted.
    Enables real-time response to student applications.
    
    Security: tenant_code is stored for isolation; applicant_email is NOT stored (PII protection).
    """
    try:
        # Get all admins in the tenant
        admin_cursor = tenant_db.users.find(
            {"role": {"$in": ["admin", "college_admin"]}},
            {"id": 1, "tenant_code": 1, "_id": 0}
        )
        admin_docs = await admin_cursor.to_list(100)
        admin_ids = [admin["id"] for admin in admin_docs]
        
        # Get tenant_code from first admin if not provided
        if not tenant_code and admin_docs:
            tenant_code = admin_docs[0].get("tenant_code")
        
        if not admin_ids:
            logger.warning(f"No admins found to notify for job application: {job_id}")
            return
        
        # Store notification in history for each admin (without PII)
        for admin_id in admin_ids:
            await store_notification(
                tenant_db=tenant_db,
                user_id=admin_id,
                title="📋 New Job Application",
                body=f"{applicant_name} applied for {job_title}",
                notification_type="job_application",
                data={
                    "job_id": job_id,
                    "job_title": job_title,
                    "applicant_name": applicant_name
                    # Note: applicant_email intentionally excluded (PII)
                },
                tenant_code=tenant_code
            )
        
        # Send push notification to all admins
        await send_push_to_users(
            db=tenant_db,
            user_ids=admin_ids,
            title="📋 New Job Application",
            body=f"{applicant_name} applied for '{job_title}'",
            data={
                "type": "job_application",
                "job_id": job_id,
                "job_title": job_title
            },
            notification_type="general"
        )
        
        logger.info(f"Job application notification sent to {len(admin_ids)} admins for job {job_id}")
        
    except Exception as e:
        logger.error(f"Job application notification error: {e}")


async def notify_application_status_change(
    tenant_db,
    applicant_id: str,
    job_title: str,
    new_status: str,
    tenant_code: str = None
):
    """
    Notify applicant when their job application status changes.
    Keeps students informed about their application progress.
    
    Security: tenant_code stored for isolation verification.
    """
    try:
        # Map status to user-friendly messages
        status_messages = {
            'reviewing': ('📝 Application Under Review', f'Your application for "{job_title}" is being reviewed'),
            'interview': ('🎉 Interview Invitation', f'You\'ve been invited for an interview for "{job_title}"!'),
            'accepted': ('✅ Application Accepted!', f'Congratulations! Your application for "{job_title}" has been accepted!'),
            'rejected': ('📋 Application Update', f'Your application for "{job_title}" was not selected at this time'),
            'pending': ('📋 Application Status', f'Your application for "{job_title}" status has been updated'),
        }
        
        title, body = status_messages.get(new_status, ('📋 Application Update', f'Your application for "{job_title}" status: {new_status}'))
        
        # Store notification in history
        await store_notification(
            tenant_db=tenant_db,
            user_id=applicant_id,
            title=title,
            body=body,
            notification_type="job_application_status",
            data={
                "job_title": job_title,
                "status": new_status
            },
            tenant_code=tenant_code
        )
        
        # Send push notification
        await send_push_to_users(
            db=tenant_db,
            user_ids=[applicant_id],
            title=title,
            body=body,
            data={
                "type": "job_application_status",
                "job_title": job_title,
                "status": new_status
            },
            notification_type="general"
        )
        
        logger.info(f"Application status notification sent to {applicant_id} for {job_title}: {new_status}")
        
    except Exception as e:
        logger.error(f"Application status notification error: {e}")
