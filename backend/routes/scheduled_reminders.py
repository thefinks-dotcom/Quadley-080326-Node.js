"""
Scheduled Daily Auto-Reminders system.
Sends automated reminders for events, birthdays, maintenance, etc.
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import uuid
import logging
import asyncio

from utils.auth import get_current_user
from utils.multi_tenant import master_db, get_tenant_db
from utils.email_service import send_email
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reminders", tags=["reminders"])


# Reminder Types
REMINDER_TYPES = [
    "event_reminder",       # Remind about upcoming events
    "birthday_reminder",    # Birthday notifications
    "maintenance_followup", # Follow up on pending maintenance
    "parcel_pickup",        # Remind about uncollected parcels
    "daily_digest"          # Daily summary of activities
]


class ReminderSchedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_code: str
    reminder_type: str
    is_enabled: bool = True
    send_time: str = "09:00"  # 24h format
    days_before: int = 1  # For event reminders - how many days before
    include_weekends: bool = True
    recipient_roles: List[str] = ["student", "ra", "admin"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    created_by: str


class ReminderScheduleCreate(BaseModel):
    reminder_type: str
    send_time: str = "09:00"
    days_before: int = 1
    include_weekends: bool = True
    recipient_roles: List[str] = ["student", "ra", "admin"]


class ReminderScheduleUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    send_time: Optional[str] = None
    days_before: Optional[int] = None
    include_weekends: Optional[bool] = None
    recipient_roles: Optional[List[str]] = None


class ReminderLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_code: str
    reminder_type: str
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    recipients_count: int
    success_count: int
    failure_count: int
    details: Optional[Dict] = None


# Default reminder settings
DEFAULT_SCHEDULES = {
    "event_reminder": {
        "send_time": "09:00",
        "days_before": 1,
        "include_weekends": True,
        "recipient_roles": ["student", "ra", "admin"]
    },
    "birthday_reminder": {
        "send_time": "08:00",
        "days_before": 0,  # On the day
        "include_weekends": True,
        "recipient_roles": ["admin", "ra"]  # Notify admins/RAs about birthdays
    },
    "maintenance_followup": {
        "send_time": "10:00",
        "days_before": 3,  # Follow up if pending for 3+ days
        "include_weekends": False,
        "recipient_roles": ["admin"]
    },
    "parcel_pickup": {
        "send_time": "14:00",
        "days_before": 2,  # Remind if uncollected for 2+ days
        "include_weekends": True,
        "recipient_roles": ["student"]
    },
    "daily_digest": {
        "send_time": "18:00",
        "days_before": 0,
        "include_weekends": True,
        "recipient_roles": ["admin"]
    }
}


@router.get("/types")
async def get_reminder_types(
    current_user: User = Depends(get_current_user)
):
    """Get available reminder types"""
    if current_user.role not in ['admin', 'ra', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {
        "types": REMINDER_TYPES,
        "descriptions": {
            "event_reminder": "Remind users about upcoming events",
            "birthday_reminder": "Notify about resident birthdays",
            "maintenance_followup": "Follow up on pending maintenance requests",
            "parcel_pickup": "Remind about uncollected parcels",
            "daily_digest": "Daily summary of activities for admins"
        },
        "default_settings": DEFAULT_SCHEDULES
    }


@router.get("/tenant/{tenant_code}")
async def get_tenant_reminder_schedules(
    tenant_code: str,
    current_user: User = Depends(get_current_user)
):
    """Get all reminder schedules for a tenant"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get custom schedules
    custom_schedules = await master_db.reminder_schedules.find(
        {"tenant_code": tenant_code},
        {"_id": 0}
    ).to_list(100)
    
    # Build response with defaults
    schedules = {}
    for reminder_type in REMINDER_TYPES:
        default = DEFAULT_SCHEDULES.get(reminder_type, {})
        schedules[reminder_type] = {
            "type": reminder_type,
            "is_enabled": False,  # Disabled by default until configured
            "send_time": default.get("send_time", "09:00"),
            "days_before": default.get("days_before", 1),
            "include_weekends": default.get("include_weekends", True),
            "recipient_roles": default.get("recipient_roles", ["student"]),
            "is_custom": False
        }
    
    # Override with custom schedules
    for custom in custom_schedules:
        reminder_type = custom.get("reminder_type")
        if reminder_type in schedules:
            schedules[reminder_type] = {
                "id": custom.get("id"),
                "type": reminder_type,
                "is_enabled": custom.get("is_enabled", True),
                "send_time": custom.get("send_time"),
                "days_before": custom.get("days_before"),
                "include_weekends": custom.get("include_weekends"),
                "recipient_roles": custom.get("recipient_roles"),
                "is_custom": True,
                "updated_at": custom.get("updated_at")
            }
    
    return {"tenant_code": tenant_code, "schedules": schedules}


@router.post("/tenant/{tenant_code}")
async def create_reminder_schedule(
    tenant_code: str,
    schedule_data: ReminderScheduleCreate,
    current_user: User = Depends(get_current_user)
):
    """Create or enable a reminder schedule for a tenant"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if schedule_data.reminder_type not in REMINDER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid reminder type. Valid types: {REMINDER_TYPES}"
        )
    
    # Check if schedule exists
    existing = await master_db.reminder_schedules.find_one({
        "tenant_code": tenant_code,
        "reminder_type": schedule_data.reminder_type
    })
    
    if existing:
        # Update existing
        await master_db.reminder_schedules.update_one(
            {"tenant_code": tenant_code, "reminder_type": schedule_data.reminder_type},
            {
                "$set": {
                    "is_enabled": True,
                    "send_time": schedule_data.send_time,
                    "days_before": schedule_data.days_before,
                    "include_weekends": schedule_data.include_weekends,
                    "recipient_roles": schedule_data.recipient_roles,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {"message": "Reminder schedule updated", "reminder_type": schedule_data.reminder_type}
    else:
        # Create new
        schedule = ReminderSchedule(
            tenant_code=tenant_code,
            reminder_type=schedule_data.reminder_type,
            send_time=schedule_data.send_time,
            days_before=schedule_data.days_before,
            include_weekends=schedule_data.include_weekends,
            recipient_roles=schedule_data.recipient_roles,
            created_by=current_user.id
        )
        
        schedule_doc = schedule.model_dump()
        schedule_doc['created_at'] = schedule_doc['created_at'].isoformat()
        await master_db.reminder_schedules.insert_one(schedule_doc)
        
        return {"message": "Reminder schedule created", "schedule_id": schedule.id}


@router.put("/tenant/{tenant_code}/{reminder_type}")
async def update_reminder_schedule(
    tenant_code: str,
    reminder_type: str,
    schedule_data: ReminderScheduleUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a reminder schedule"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {}
    if schedule_data.is_enabled is not None:
        update_data["is_enabled"] = schedule_data.is_enabled
    if schedule_data.send_time is not None:
        update_data["send_time"] = schedule_data.send_time
    if schedule_data.days_before is not None:
        update_data["days_before"] = schedule_data.days_before
    if schedule_data.include_weekends is not None:
        update_data["include_weekends"] = schedule_data.include_weekends
    if schedule_data.recipient_roles is not None:
        update_data["recipient_roles"] = schedule_data.recipient_roles
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await master_db.reminder_schedules.update_one(
        {"tenant_code": tenant_code, "reminder_type": reminder_type},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Reminder schedule updated"}


@router.delete("/tenant/{tenant_code}/{reminder_type}")
async def disable_reminder(
    tenant_code: str,
    reminder_type: str,
    current_user: User = Depends(get_current_user)
):
    """Disable a reminder (doesn't delete, just sets is_enabled=False)"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await master_db.reminder_schedules.update_one(
        {"tenant_code": tenant_code, "reminder_type": reminder_type},
        {
            "$set": {
                "is_enabled": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Reminder disabled"}


@router.get("/logs/{tenant_code}")
async def get_reminder_logs(
    tenant_code: str,
    reminder_type: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get reminder delivery logs for a tenant"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"tenant_code": tenant_code}
    if reminder_type:
        query["reminder_type"] = reminder_type
    
    logs = await master_db.reminder_logs.find(
        query,
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)
    
    return {"logs": logs}


@router.post("/trigger/{tenant_code}/{reminder_type}")
async def trigger_reminder_manually(
    tenant_code: str,
    reminder_type: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Manually trigger a reminder (for testing or immediate send)"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "admin" and current_user.tenant_code != tenant_code:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if reminder_type not in REMINDER_TYPES:
        raise HTTPException(status_code=400, detail="Invalid reminder type")
    
    # Queue the reminder job
    background_tasks.add_task(
        process_reminder,
        tenant_code=tenant_code,
        reminder_type=reminder_type
    )
    
    return {"message": f"Reminder '{reminder_type}' triggered for {tenant_code}"}


async def process_reminder(tenant_code: str, reminder_type: str):
    """Process a single reminder type for a tenant"""
    logger.info(f"Processing {reminder_type} reminder for tenant {tenant_code}")
    
    try:
        tenant = await master_db.tenants.find_one({"code": tenant_code})
        if not tenant or tenant.get('status') != 'active':
            logger.warning(f"Tenant {tenant_code} not found or inactive")
            return
        
        tenant_db = get_tenant_db(tenant_code)
        tenant_name = tenant.get('name', tenant_code)
        
        recipients_count = 0
        success_count = 0
        failure_count = 0
        
        if reminder_type == "event_reminder":
            # Get events happening tomorrow
            tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
            tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0)
            tomorrow_end = tomorrow.replace(hour=23, minute=59, second=59)
            
            events = await tenant_db.events.find({
                "start_time": {
                    "$gte": tomorrow_start.isoformat(),
                    "$lte": tomorrow_end.isoformat()
                }
            }).to_list(100)
            
            if events:
                # Get all users
                users = await tenant_db.users.find({
                    "email": {"$exists": True}
                }).to_list(1000)
                
                for user in users:
                    recipients_count += 1
                    try:
                        event_list = "\n".join([
                            f"• {e.get('title')} at {e.get('start_time')}"
                            for e in events[:5]
                        ])
                        
                        await send_email(
                            to=user.get('email'),
                            subject=f"Tomorrow's Events at {tenant_name}",
                            html_content=f"""
                            <p>Hi {user.get('first_name', 'there')},</p>
                            <p>Here are the events happening tomorrow:</p>
                            <pre>{event_list}</pre>
                            <p>See you there!</p>
                            """
                        )
                        success_count += 1
                    except Exception:
                        failure_count += 1
        
        elif reminder_type == "birthday_reminder":
            # Get today's birthdays
            today = datetime.now(timezone.utc)
            month_day = today.strftime("%m-%d")
            
            birthday_users = await tenant_db.users.find({
                "date_of_birth": {"$regex": f"-{month_day}$"}
            }).to_list(100)
            
            if birthday_users:
                # Notify admins
                admins = await tenant_db.users.find({
                    "role": {"$in": ["admin", "ra"]}
                }).to_list(100)
                
                birthday_names = ", ".join([
                    f"{u.get('first_name')} {u.get('last_name')}"
                    for u in birthday_users
                ])
                
                for admin in admins:
                    recipients_count += 1
                    try:
                        await send_email(
                            to=admin.get('email'),
                            subject=f"Birthdays Today at {tenant_name}",
                            html_content=f"""
                            <p>Hi {admin.get('first_name')},</p>
                            <p>The following residents have birthdays today:</p>
                            <p><strong>{birthday_names}</strong></p>
                            <p>Consider wishing them a happy birthday!</p>
                            """
                        )
                        success_count += 1
                    except Exception:
                        failure_count += 1
        
        elif reminder_type == "parcel_pickup":
            # Get uncollected parcels older than 2 days
            cutoff = datetime.now(timezone.utc) - timedelta(days=2)
            
            parcels = await tenant_db.parcels.find({
                "status": "pending",
                "created_at": {"$lte": cutoff.isoformat()}
            }).to_list(100)
            
            for parcel in parcels:
                user_id = parcel.get('user_id')
                user = await tenant_db.users.find_one({"id": user_id})
                
                if user and user.get('email'):
                    recipients_count += 1
                    try:
                        await send_email(
                            to=user.get('email'),
                            subject=f"Parcel Reminder - {tenant_name}",
                            html_content=f"""
                            <p>Hi {user.get('first_name')},</p>
                            <p>You have a parcel waiting for pickup!</p>
                            <p>Please collect it from the front desk at your earliest convenience.</p>
                            """
                        )
                        success_count += 1
                    except Exception:
                        failure_count += 1
        
        # Log the reminder execution
        log = ReminderLog(
            tenant_code=tenant_code,
            reminder_type=reminder_type,
            recipients_count=recipients_count,
            success_count=success_count,
            failure_count=failure_count,
            details={"triggered_manually": True}
        )
        
        log_doc = log.model_dump()
        log_doc['sent_at'] = log_doc['sent_at'].isoformat()
        await master_db.reminder_logs.insert_one(log_doc)
        
        logger.info(f"Reminder {reminder_type} for {tenant_code}: {success_count}/{recipients_count} sent")
        
    except Exception as e:
        logger.error(f"Failed to process reminder {reminder_type} for {tenant_code}: {e}")


# Scheduled job runner (would be called by a cron/scheduler)
async def run_scheduled_reminders():
    """Run all scheduled reminders that are due"""
    current_time = datetime.now(timezone.utc)
    current_hour_minute = current_time.strftime("%H:%M")
    is_weekend = current_time.weekday() >= 5
    
    # Get all enabled schedules for this time
    schedules = await master_db.reminder_schedules.find({
        "is_enabled": True,
        "send_time": current_hour_minute
    }).to_list(1000)
    
    for schedule in schedules:
        # Skip weekends if configured
        if is_weekend and not schedule.get('include_weekends', True):
            continue
        
        tenant_code = schedule.get('tenant_code')
        reminder_type = schedule.get('reminder_type')
        
        # Process async
        asyncio.create_task(process_reminder(tenant_code, reminder_type))
    
    logger.info(f"Scheduled reminders triggered at {current_hour_minute}: {len(schedules)} schedules")
