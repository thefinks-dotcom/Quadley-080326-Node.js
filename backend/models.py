"""Pydantic models for Quadley backend"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid
import random
import string


def _generate_invite_code(tenant_prefix: str = "") -> str:
    """Generate a short, readable invite code like ORMD-7K3X."""
    prefix = tenant_prefix[:4].upper() if tenant_prefix else "QUAD"
    chars = string.ascii_uppercase + string.digits
    # Remove ambiguous characters
    chars = chars.replace("O", "").replace("0", "").replace("I", "").replace("1", "").replace("L", "")
    suffix = "".join(random.choices(chars, k=4))
    return f"{prefix}-{suffix}"

# ====== ENUMS ======

class GroupType(str, Enum):
    sports = "sports"
    clubs = "clubs"
    cultural = "cultural"

class InvitationStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    expired = "expired"

class TenantStatus(str, Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"

# All available modules
ALL_MODULES = [
    "events",
    "announcements", 
    "messages",
    "jobs",
    "dining",
    "maintenance",
    "recognition",
    "wellbeing",
    "academics",
    "cocurricular",
    "floor",
    "birthdays",
    "finance",
    "safe_disclosure",
    "parcels",
    "bookings"
]

# ====== TENANT MODELS ======

class Tenant(BaseModel):
    """Tenant (Residential College) model - stored in master database"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # Unique code e.g., "ORMD0001"
    name: str  # College name
    logo_url: Optional[str] = None
    # Branding
    primary_color: str = "#3b82f6"
    secondary_color: str = "#1f2937"
    branding: Optional[dict] = None
    # Contact
    contact_person_name: str
    contact_person_email: EmailStr
    # Features
    enabled_modules: List[str] = Field(default_factory=lambda: ALL_MODULES.copy())
    # Subscription/Billing
    subscription_tier: str = "basic"  # basic, pro, enterprise
    subscription_status: str = "active"  # active, past_due, cancelled
    max_users: int = 100  # Based on subscription tier
    # Status
    status: TenantStatus = TenantStatus.pending
    user_count: int = 0
    next_user_sequence: int = 1
    # App download links (per tenant white-label apps)
    ios_app_link: Optional[str] = None
    android_app_link: Optional[str] = None
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None  # Super admin who created it

class TenantCreate(BaseModel):
    """Model for creating a new tenant"""
    name: str = Field(..., min_length=2, max_length=100)
    contact_person_name: str = Field(..., min_length=2, max_length=100)
    contact_person_email: EmailStr
    logo_url: Optional[str] = None
    primary_color: Optional[str] = "#3b82f6"
    secondary_color: Optional[str] = "#1f2937"
    subscription_tier: Optional[str] = "basic"
    enabled_modules: Optional[List[str]] = None  # Defaults to all modules
    activities: Optional[List[dict]] = None  # List of {type, name, description}

class TenantUpdate(BaseModel):
    """Model for updating tenant settings"""
    name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    contact_person_name: Optional[str] = None
    contact_person_email: Optional[EmailStr] = None
    enabled_modules: Optional[List[str]] = None
    subscription_tier: Optional[str] = None
    max_users: Optional[int] = None
    status: Optional[TenantStatus] = None
    activities: Optional[List[dict]] = None
    ios_app_link: Optional[str] = None
    android_app_link: Optional[str] = None

class TenantResponse(BaseModel):
    """Response model for tenant (excludes sensitive data)"""
    id: str
    code: str
    name: str
    logo_url: Optional[str] = None
    primary_color: str = "#3b82f6"
    secondary_color: str = "#1f2937"
    branding: Optional[dict] = None
    contact_person_name: str
    contact_person_email: str
    enabled_modules: List[str]
    subscription_tier: str = "basic"
    max_users: int = 100
    activities: Optional[List[dict]] = None
    ios_app_link: Optional[str] = None
    android_app_link: Optional[str] = None
    status: str
    user_count: int
    created_at: str

# ====== INVITATION MODELS ======

class Invitation(BaseModel):
    """Invitation model - stored in master database"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_code: str
    email: EmailStr
    role: str = "student"  # student, ra, admin
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invite_code: Optional[str] = None  # Short code like ORMD-7K3X
    status: InvitationStatus = InvitationStatus.pending
    invited_by: str  # User ID of who sent the invitation
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))
    accepted_at: Optional[datetime] = None

from datetime import timedelta

class InvitationCreate(BaseModel):
    """Model for creating an invitation"""
    email: EmailStr
    role: str = "student"
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class BulkInvitationCreate(BaseModel):
    """Model for bulk creating invitations via CSV"""
    invitations: List[InvitationCreate]

# ====== USER MODELS ======

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""  # Tenant-specific ID e.g., "ORMD-000001"
    tenant_code: str = ""  # Required for all users except super_admin
    email: EmailStr
    first_name: str
    last_name: str
    role: str = "student"  # super_admin, admin, ra, student
    floor: Optional[str] = None
    year: Optional[str | int] = None
    student_id: Optional[str] = None
    birthday: Optional[str] = None
    photo_url: Optional[str] = None
    phone: Optional[str] = None
    dietary_restrictions: List[str] = []
    location_sharing: bool = False
    birthday_notifications: bool = True
    photo_opt_in: bool = True
    notif_announcements: bool = True
    notif_events: bool = True
    notif_dining_menu: bool = True
    notif_messages: bool = True
    notif_shoutouts: bool = True
    notif_parcels: bool = True
    notif_maintenance: bool = True
    notif_trip_reminders: bool = True
    notif_floor_posts: bool = True
    notif_finance: bool = True
    notif_memory_lane: bool = True
    notif_tutoring_reminders: bool = True
    notif_study_group_reminders: bool = True
    onboarding_completed: bool = False
    active: bool = True
    mfa_exempt: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "student"
    floor: Optional[str] = None
    year: Optional[str | int] = None
    student_id: Optional[str] = None
    birthday: Optional[str] = None
    phone: Optional[str] = None
    tenant_id: Optional[str] = None

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    floor: Optional[str] = None
    year: Optional[str | int] = None
    student_id: Optional[str] = None
    birthday: Optional[str] = None
    photo_url: Optional[str] = None
    phone: Optional[str] = None
    dietary_restrictions: Optional[List[str]] = None
    location_sharing: Optional[bool] = None
    birthday_notifications: Optional[bool] = None
    photo_opt_in: Optional[bool] = None
    notif_announcements: Optional[bool] = None
    notif_events: Optional[bool] = None
    notif_dining_menu: Optional[bool] = None
    notif_messages: Optional[bool] = None
    notif_shoutouts: Optional[bool] = None
    notif_parcels: Optional[bool] = None
    notif_maintenance: Optional[bool] = None
    notif_trip_reminders: Optional[bool] = None
    notif_floor_posts: Optional[bool] = None
    notif_finance: Optional[bool] = None
    notif_memory_lane: Optional[bool] = None
    notif_tutoring_reminders: Optional[bool] = None
    notif_study_group_reminders: Optional[bool] = None
    onboarding_completed: Optional[bool] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# ====== MESSAGE MODELS ======

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    receiver_id: Optional[str] = None
    group_id: Optional[str] = None
    conversation_id: Optional[str] = None
    content: str
    file_url: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read: bool = False
    read_by: List[str] = Field(default_factory=list)

class MessageCreate(BaseModel):
    receiver_id: Optional[str] = None
    group_id: Optional[str] = None
    content: str
    file_url: Optional[str] = None

class MessageGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    members: List[str] = []
    member_names: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class MessageGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    member_ids: List[str] = []

# ====== EVENT MODELS ======

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    date: datetime
    location: str
    created_by: str
    attendees: List[str] = []
    max_attendees: Optional[int] = None
    category: str
    house_event: bool = False
    house_name: Optional[str] = None
    points: int = 0
    floor: Optional[str] = None  # For floor-specific events
    event_type: Optional[str] = None  # 'floor', 'house', 'campus', etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventCreate(BaseModel):
    title: str
    description: str
    date: datetime
    location: str
    max_attendees: Optional[int] = None
    category: str
    house_event: bool = False
    house_name: Optional[str] = None
    points: int = 0
    floor: Optional[str] = None  # For floor-specific events
    event_type: Optional[str] = None  # 'floor', 'house', 'campus', etc.

class EventRSVP(BaseModel):
    response: str

# ====== ANNOUNCEMENT MODELS ======

class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    created_by: str
    created_by_name: Optional[str] = None
    target_audience: str
    house: Optional[str] = None
    priority: str = "normal"
    is_emergency: bool = False
    status: str = "published"  # published, scheduled, draft, archived
    scheduled_date: Optional[datetime] = None
    expires_at: Optional[datetime] = None  # When the announcement should be auto-archived
    archived_at: Optional[datetime] = None  # When it was archived
    read_by: List[str] = []  # List of user IDs who have read this announcement
    read_count: int = 0  # Total count of users who read
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    target_audience: str = "all"  # Default for mobile app
    house: Optional[str] = None
    priority: str = "normal"
    is_emergency: bool = False
    emergency: Optional[bool] = None  # Mobile app sends this field
    status: str = "published"
    scheduled_date: Optional[str] = None
    expires_at: Optional[str] = None  # Expiry date for auto-archiving

# ====== MAINTENANCE MODELS ======

class MaintenanceRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    room_number: str
    issue_type: str
    description: str
    status: str = "pending"
    priority: str = "normal"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

class MaintenanceRequestCreate(BaseModel):
    room_number: str
    issue_type: str
    description: str
    priority: str = "normal"

# ====== BOOKING MODELS ======

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    facility: str
    date: datetime
    duration: int
    purpose: Optional[str] = None
    booking_type: str = "facility"
    status: str = "confirmed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BookingCreate(BaseModel):
    facility: str
    date: datetime
    duration: int
    purpose: Optional[str] = None
    booking_type: str = "facility"

# ====== FINANCE MODELS ======

class Bill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    amount: float
    description: str
    due_date: datetime
    status: str = "unpaid"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paid_at: Optional[datetime] = None

# ====== STUDY GROUP MODELS ======

class StudyGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    subject: str
    location: Optional[str] = None
    created_by: str
    members: List[str] = []
    max_members: int = 10
    meeting_schedule: Optional[str] = None
    send_reminders: bool = False
    reminder_times: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudyGroupCreate(BaseModel):
    name: str
    subject: str
    location: Optional[str] = None
    max_members: int = 10
    meeting_schedule: Optional[str] = None
    send_reminders: bool = False
    reminder_times: List[str] = []

class TutoringRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    subject: str
    description: str
    status: str = "pending"
    tutor_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TutoringRequestCreate(BaseModel):
    subject: str
    description: str

# ====== CO-CURRICULAR MODELS ======

class CoCurricularGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    name: str
    description: Optional[str] = ""
    contact_person: Optional[str] = None
    contact_person_name: Optional[str] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    message_group_id: Optional[str] = None
    meeting_times: Optional[str] = None
    competition_times: Optional[str] = None
    other_details: Optional[str] = None
    members: List[str] = []
    member_names: List[str] = []
    photos: List[str] = []
    send_reminders: bool = False
    reminder_times: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CoCurricularGroupCreate(BaseModel):
    type: str
    name: str
    description: str
    meeting_times: Optional[str] = None
    competition_times: Optional[str] = None
    other_details: Optional[str] = None
    send_reminders: bool = False
    reminder_times: List[str] = []

# ====== WELLBEING MODELS ======

class WellbeingResource(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    link: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WellbeingResourceCreate(BaseModel):
    title: str
    description: str
    category: str
    link: Optional[str] = None

# ====== DINING MODELS ======

class MenuItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    meal_type: str
    date: str
    dietary_tags: List[str] = []
    nutrition_info: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MenuItemCreate(BaseModel):
    name: str
    description: str
    meal_type: str
    date: str
    dietary_tags: List[str] = []
    nutrition_info: Optional[str] = None

class LateMealRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    meal_type: str
    date: str
    reason: str
    dietary_requirements: Optional[str] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LateMealRequestCreate(BaseModel):
    meal_type: str
    date: str
    reason: Optional[str] = ""  # Made optional for mobile app compatibility
    dietary_requirements: Optional[str] = None

# ====== HOUSE POINTS ======

class HousePoints(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    house_name: str
    points: int = 0
    year: int
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ====== SHOUTOUT MODELS ======

class Shoutout(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: Optional[str] = None
    from_user_id: str
    from_user_name: str
    sender_name: Optional[str] = None  # Mobile app compatibility
    to_user_id: Optional[str] = None  # Optional - can recognize by name only
    to_user_name: Optional[str] = None  # Made optional for backward compatibility
    recipient_name: Optional[str] = None  # Mobile app compatibility
    message: str
    category: str
    broadcast: bool = True  # Default to true
    status: str = "published"  # published, scheduled
    scheduled_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoutoutCreate(BaseModel):
    to_user_id: Optional[str] = None
    to_user_name: Optional[str] = None
    # Mobile app field names (aliases)
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=500)
    category: str
    broadcast: bool = True  # Default to true so recognitions are visible to all
    status: str = "published"
    scheduled_date: Optional[str] = None

# ====== STUDY STREAK ======

class StudyStreak(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: Optional[str] = None
    student_id: str
    current_streak: int = 0
    longest_streak: int = 0
    total_visits: int = 0
    last_visit: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ====== FLOOR MODELS ======

class FloorEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by: str
    created_by_name: str
    floor: Optional[str] = None
    title: str
    description: str
    date: datetime
    location: str
    attendees: List[str] = []
    max_attendees: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FloorEventCreate(BaseModel):
    floor: Optional[str] = None
    title: str
    description: str
    date: datetime
    location: str
    max_attendees: Optional[int] = None

# ====== JOB MODELS ======
# (Moved to bottom of file - see JobStatus, Job, JobCreate, JobUpdate, JobApplication, JobApplicationCreate classes)

# ====== RA APPLICATION MODELS ======

class RAApplication(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    requirements: Optional[str] = None
    due_date: Optional[str] = None
    status: str = "open"
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RAApplicationCreate(BaseModel):
    title: str
    description: str
    requirements: Optional[str] = None
    due_date: Optional[str] = None

class RAApplicationSubmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ra_application_id: str
    applicant_id: str
    applicant_name: str
    applicant_email: str
    responses: str
    resume_url: Optional[str] = None
    status: str = "pending"
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RAApplicationSubmissionCreate(BaseModel):
    ra_application_id: str
    responses: str
    resume_url: Optional[str] = None

# ====== TUTOR MODELS ======

class TutorApplication(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    student_email: str
    subjects: List[str] = []
    bio: Optional[str] = None
    available_times: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

class TutorApplicationCreate(BaseModel):
    subjects: List[str]
    bio: Optional[str] = None
    available_times: str

# ====== PARCEL MODELS ======

class ParcelNotification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    student_email: str
    tracking_number: Optional[str] = None
    sender_name: Optional[str] = None
    description: Optional[str] = None
    status: str = "waiting"
    created_by: str
    created_by_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    collected_at: Optional[datetime] = None

class ParcelNotificationCreate(BaseModel):
    student_id: str
    tracking_number: Optional[str] = None
    sender_name: Optional[str] = None
    description: Optional[str] = None

# ====== SAFE DISCLOSURE MODELS ======

class SafeDisclosure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reporter_id: Optional[str] = None
    reporter_name: Optional[str] = None
    is_anonymous: bool = False
    incident_type: str
    incident_date: Optional[str] = None
    incident_location: Optional[str] = None
    description: str
    individuals_involved: Optional[str] = None
    witness_present: bool = False
    witness_details: Optional[str] = None
    immediate_danger: bool = False
    medical_attention_needed: bool = False
    police_notified: bool = False
    support_requested: List[str] = []
    preferred_contact: Optional[str] = None
    additional_notes: Optional[str] = None
    status: str = "pending"
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class SafeDisclosureCreate(BaseModel):
    is_anonymous: bool = False
    report_type: str = "disclosure"  # "disclosure" | "formal_complaint"
    incident_type: str
    incident_date: Optional[str] = None
    incident_location: Optional[str] = None
    description: str
    individuals_involved: Optional[str] = None
    witness_present: bool = False
    witness_details: Optional[str] = None
    immediate_danger: bool = False
    medical_attention_needed: bool = False
    police_notified: bool = False
    support_requested: List[str] = []
    preferred_contact: Optional[str] = None
    additional_notes: Optional[str] = None

# ====== CSV USER IMPORT MODELS ======

class CSVUserRow(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role: str = "student"
    floor: Optional[str] = None
    phone: Optional[str] = None
    student_id: Optional[str] = None
    year: Optional[str | int] = None
    birthday: Optional[str] = None

class BulkUserImportResult(BaseModel):
    success_count: int
    error_count: int
    errors: List[dict]
    created_users: List[str]

class APIUserSync(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: str = "student"
    floor: Optional[str] = None
    phone: Optional[str] = None
    student_id: Optional[str] = None
    year: Optional[str | int] = None
    active: bool = True

class BulkSyncRequest(BaseModel):
    users: List[APIUserSync]

class BulkSyncResult(BaseModel):
    created: int
    updated: int
    deactivated: int
    errors: List[dict]

# ====== COLLEGE JOBS MODELS ======

class JobStatus(str, Enum):
    draft = "draft"
    active = "active"
    closed = "closed"
    filled = "filled"

class ApplicationStatus(str, Enum):
    pending = "pending"
    reviewing = "reviewing"
    interview = "interview"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"

class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Basic fields
    title: str
    description: str
    category: str  # Free-form category
    hours_per_week: Optional[int] = None
    pay_rate: Optional[str] = None  # e.g., "$15/hr" or "Stipend"
    # Advanced fields
    department: Optional[str] = None
    supervisor: Optional[str] = None
    location: Optional[str] = None
    required_skills: List[str] = []
    preferred_qualifications: Optional[str] = None
    responsibilities: Optional[str] = None
    application_deadline: Optional[str] = None  # ISO date string
    positions_available: int = 1
    # Metadata
    status: str = "active"
    created_by: str
    created_by_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    applications_count: int = 0

class JobCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)
    category: str = Field(..., min_length=2, max_length=100)
    hours_per_week: Optional[int] = Field(default=None, ge=1, le=40)
    pay_rate: Optional[str] = None
    department: Optional[str] = None
    supervisor: Optional[str] = None
    location: Optional[str] = None
    required_skills: List[str] = []
    preferred_qualifications: Optional[str] = None
    responsibilities: Optional[str] = None
    application_deadline: Optional[str] = None
    positions_available: int = Field(default=1, ge=1, le=50)
    status: str = "active"

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    hours_per_week: Optional[int] = None
    pay_rate: Optional[str] = None
    department: Optional[str] = None
    supervisor: Optional[str] = None
    location: Optional[str] = None
    required_skills: Optional[List[str]] = None
    preferred_qualifications: Optional[str] = None
    responsibilities: Optional[str] = None
    application_deadline: Optional[str] = None
    positions_available: Optional[int] = None
    status: Optional[str] = None

class JobApplication(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    job_title: str
    # Applicant info
    applicant_id: str
    applicant_name: str
    applicant_email: str
    # Application content
    cover_letter: Optional[str] = None
    resume_url: Optional[str] = None
    # Structured form fields
    availability: Optional[str] = None  # e.g., "Mon-Fri 2pm-6pm"
    start_date: Optional[str] = None
    experience: Optional[str] = None
    relevant_coursework: Optional[str] = None
    references: List[dict] = []  # [{name, relationship, contact}]
    why_interested: Optional[str] = None
    additional_info: Optional[str] = None
    # Status
    status: str = "pending"
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

class JobApplicationCreate(BaseModel):
    cover_letter: Optional[str] = None
    availability: Optional[str] = None
    start_date: Optional[str] = None
    experience: Optional[str] = None
    relevant_coursework: Optional[str] = None
    references: List[dict] = []
    why_interested: Optional[str] = None
    additional_info: Optional[str] = None

class JobApplicationStatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None
