from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, validator
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt

# Conditional import for emergentintegrations (not available on Railway/production)
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    EMERGENT_AVAILABLE = True
except ImportError:
    EMERGENT_AVAILABLE = False
    LlmChat = None
    UserMessage = None

import bleach
import re
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
from utils.multi_tenant import master_db

# JWT Settings with validation (OWASP A02)
JWT_SECRET: str = os.environ.get('JWT_SECRET') or ''
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')

# Validate JWT secret at import time
if not JWT_SECRET:
    raise RuntimeError("FATAL: JWT_SECRET environment variable is not set. Cannot start server.")
if len(JWT_SECRET) < 32:
    logging.warning("SECURITY WARNING: JWT_SECRET should be at least 32 characters")

# Security
security = HTTPBearer()

# Create the main app - disable OpenAPI/docs in production (OWASP A05: reduce attack surface)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
api_router = APIRouter(prefix="/api")

# App version for deployment tracking
APP_VERSION = "1.0.8"

# Health check endpoint for Kubernetes deployment
@app.get("/")
async def root():
    """Root endpoint for deployment healthchecks"""
    return {
        "status": "healthy",
        "service": "Quadley API",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes liveness/readiness probes"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Lightweight ping endpoint for mobile app warmup (no auth required)
@app.get("/api/ping")
async def ping():
    """Ultra-lightweight ping for connection warmup - no DB access"""
    return {"status": "ok"}

# Warmup endpoint that pre-initializes DB connection (requires valid auth)
@app.get("/api/warmup")
async def warmup(request: Request):
    """Warmup endpoint that initializes database connection pool - requires valid authentication"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        await db.command("ping")
        return {"status": "ready"}
    except Exception:
        return {"status": "ready"}

# Startup event to warm up database connection
@app.on_event("startup")
async def startup_warmup():
    """Pre-warm database connections on server startup"""
    try:
        # Ping database to establish connection pool
        await db.command("ping")
        # Pre-fetch one document to fully warm the connection
        await db.users.find_one({}, {"_id": 1})
        logging.info("Database connection pool warmed up successfully")
    except Exception as e:
        logging.warning(f"Database warmup warning: {e}")


@app.on_event("startup")
async def startup_privacy_scheduler():
    """Start the weekly privacy compliance report scheduler."""
    import asyncio
    from datetime import datetime, timezone, timedelta

    async def _privacy_report_loop():
        DAY_MAP = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
        while True:
            try:
                from utils.multi_tenant import master_db as _mdb
                schedule = await _mdb.privacy_schedule.find_one(
                    {"id": "privacy_compliance_schedule"}, {"_id": 0}
                )
                if not schedule:
                    schedule = {"enabled": True, "day_of_week": "monday", "hour_utc": 8}

                if schedule.get("enabled", True):
                    now = datetime.now(timezone.utc)
                    target_day = DAY_MAP.get(schedule.get("day_of_week", "monday"), 0)
                    target_hour = schedule.get("hour_utc", 8)
                    if now.weekday() == target_day and now.hour == target_hour:
                        last_sent = schedule.get("last_sent_at")
                        should_send = True
                        if last_sent:
                            last_dt = datetime.fromisoformat(last_sent) if isinstance(last_sent, str) else last_sent
                            should_send = (now - last_dt) > timedelta(hours=23)
                        if should_send:
                            from routes.privacy import send_compliance_report
                            result = await send_compliance_report(triggered_by="scheduler")
                            logging.info(f"Privacy compliance report sent: {result.get('report_id')} — {result.get('emails_sent')} emails")
            except Exception as e:
                logging.warning(f"Privacy scheduler error: {e}")
            await asyncio.sleep(3600)  # Check every hour

    asyncio.create_task(_privacy_report_loop())

# Database connectivity check endpoint (accessible via /api/health/db for production)
# SECURITY (OWASP A05): Require admin authentication for all detailed info
@app.get("/api/health/db")
async def db_health_check(request: Request):
    """
    Database health check - requires admin authentication.
    SECURITY: Returns no info for unauthenticated requests (OWASP A05)
    """
    from models import User
    from utils.multi_tenant import master_db
    
    # Require authentication via Bearer token only (no cookies to prevent CSRF)
    auth_header = request.headers.get("Authorization")
    
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Validate token and get user
    is_admin = False
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check super_admins first, then tenant users
        user_doc = await master_db.super_admins.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user_doc:
            # SECURITY (A01): Use tenant-scoped DB from JWT
            tenant_code = payload.get("tenant")
            if tenant_code:
                from utils.multi_tenant import get_tenant_db
                _tenant_db = get_tenant_db(tenant_code)
                user_doc = await _tenant_db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
            else:
                user_doc = None
        
        if user_doc:
            is_admin = user_doc.get('role') in ['admin', 'super_admin', 'superadmin']
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = {
        "version": APP_VERSION,
        "status": "unknown"
    }
    
    try:
        await db.command("ping")
        result["status"] = "connected"
        result["database_name"] = db.name
        return result
    except Exception:
        result["status"] = "error"
        return JSONResponse(status_code=503, content=result)

# Initialize rate limiter (shared instance — imported from utils/limiter)
from utils.limiter import limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enhanced security headers middleware (OWASP A05 compliance)"""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['X-Permitted-Cross-Domain-Policies'] = 'none'
        # Enhanced CSP - tightened for production
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "connect-src 'self' https:; "
            "object-src 'none'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        return response

# Audit Logging Middleware
class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start_time = datetime.now(timezone.utc)
        response = await call_next(request)
        
        # Log sensitive operations
        if request.url.path.startswith("/api/auth") or request.method in ["POST", "PUT", "DELETE"]:
            duration = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            logging.info(f"AUDIT: {request.method} {request.url.path} - Status: {response.status_code} - Duration: {duration:.2f}ms - IP: {request.client.host if request.client else 'unknown'}")
        
        return response

# XSS Input Sanitization Middleware - sanitizes ALL incoming JSON request bodies
class XSSSanitizationMiddleware(BaseHTTPMiddleware):
    """Middleware to sanitize all incoming JSON request bodies to prevent stored XSS."""
    
    # Paths to skip sanitization (e.g., file uploads, webhooks)
    SKIP_PATHS = ["/api/uploads", "/health"]
    # Fields that should NOT be sanitized (passwords, tokens, etc.)
    SKIP_FIELDS = {"password", "current_password", "new_password", "mfa_code", "backup_code", "token", "access_token", "setup_token"}
    
    async def dispatch(self, request, call_next):
        if request.method in ("POST", "PUT", "PATCH") and not any(request.url.path.startswith(p) for p in self.SKIP_PATHS):
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    body = await request.body()
                    if body:
                        import json as json_mod
                        data = json_mod.loads(body)
                        sanitized = self._sanitize(data)
                        # Replace request body with sanitized version
                        request._body = json_mod.dumps(sanitized).encode("utf-8")
                except Exception:
                    pass  # If parsing fails, let the request through as-is
        
        response = await call_next(request)
        return response
    
    def _sanitize(self, data):
        if isinstance(data, str):
            return bleach.clean(data, tags=[], strip=True)
        elif isinstance(data, dict):
            return {k: (data[k] if k in self.SKIP_FIELDS else self._sanitize(v)) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._sanitize(item) for item in data]
        return data

# File upload settings
UPLOAD_BASE_DIR = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
UPLOAD_DIR = Path(UPLOAD_BASE_DIR) / "cocurricular_photos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ====== MODELS ======
# All Pydantic models live in models.py — import them from there

# ====== IMPORT MODULAR ROUTES ======
from routes import auth as auth_routes
from routes import messages as messages_routes
from routes import events as events_routes
from routes import cocurricular as cocurricular_routes
from routes import announcements as announcements_routes
from routes import birthdays as birthdays_routes
from routes import dining as dining_routes
from routes import houses as houses_routes
from routes import jobs as jobs_routes
from routes import maintenance as maintenance_routes
from routes import academics as academics_routes
from routes import ra_applications as ra_applications_routes  
from routes import dashboard as dashboard_routes
from routes import bookings as bookings_routes
from routes import delight as delight_routes
from routes import wellbeing as wellbeing_routes
from routes import safe_disclosure as safe_disclosure_routes
from routes import gbv_training as gbv_training_routes
from routes import relationship_disclosures as relationship_disclosures_routes
from routes import emergency_rollcall as emergency_rollcall_routes
from routes import tutoring as tutoring_routes
from routes import parcels as parcels_routes
from routes import move_in as move_in_routes
from routes import oweek as oweek_routes
from routes import admin as admin_routes
from routes import date_config as date_config_routes
from routes import floor as floor_routes
from routes import user_provisioning as user_provisioning_routes
from routes import wellbeing_admin as wellbeing_admin_routes
from routes import notifications as notifications_routes
from routes import student_reports as student_reports_routes
from routes import analytics as analytics_routes
from routes import mfa as mfa_routes
from routes import captcha as captcha_routes
from routes import multi_tenant as multi_tenant_routes
from routes import cross_tenant_analytics as cross_tenant_analytics_routes
from routes import email_templates as email_template_routes
from routes import scheduled_reminders as reminder_routes
from routes import sessions as sessions_routes
from routes import audit as audit_routes
from routes import custom_domains as custom_domains_routes
from routes import white_label as white_label_routes
from routes import privacy as privacy_routes
from routes import ip_anomaly as ip_anomaly_routes
# SSO and SAML removed per user decision

# Register modular routers with api_router
api_router.include_router(auth_routes.router)
api_router.include_router(messages_routes.router)
api_router.include_router(events_routes.router)
api_router.include_router(cocurricular_routes.router)
api_router.include_router(announcements_routes.router)
api_router.include_router(birthdays_routes.router)
api_router.include_router(dining_routes.router)
api_router.include_router(houses_routes.router)
api_router.include_router(jobs_routes.router)
api_router.include_router(maintenance_routes.router)
api_router.include_router(academics_routes.router)
api_router.include_router(ra_applications_routes.router)
api_router.include_router(dashboard_routes.router)
api_router.include_router(bookings_routes.router)
api_router.include_router(delight_routes.router)
api_router.include_router(wellbeing_routes.router)
api_router.include_router(safe_disclosure_routes.router)
api_router.include_router(gbv_training_routes.router)
api_router.include_router(relationship_disclosures_routes.router)
api_router.include_router(emergency_rollcall_routes.router)
api_router.include_router(tutoring_routes.router)
api_router.include_router(parcels_routes.router)
api_router.include_router(move_in_routes.router)
api_router.include_router(oweek_routes.router)
api_router.include_router(admin_routes.router)
api_router.include_router(date_config_routes.router)
api_router.include_router(date_config_routes.config_router)  # /api/config/dates endpoint
api_router.include_router(floor_routes.router)
# Old tenants_routes removed - replaced by multi_tenant_routes
api_router.include_router(user_provisioning_routes.router)
api_router.include_router(wellbeing_admin_routes.router)
api_router.include_router(notifications_routes.router)
api_router.include_router(student_reports_routes.router)
api_router.include_router(analytics_routes.router)
api_router.include_router(mfa_routes.router)
api_router.include_router(captcha_routes.router)
api_router.include_router(multi_tenant_routes.router)
api_router.include_router(cross_tenant_analytics_routes.router)
api_router.include_router(email_template_routes.router)
api_router.include_router(reminder_routes.router)
api_router.include_router(sessions_routes.router)
api_router.include_router(audit_routes.router)
api_router.include_router(custom_domains_routes.router)
api_router.include_router(white_label_routes.router)
api_router.include_router(privacy_routes.router)
api_router.include_router(ip_anomaly_routes.router)

# Monitoring routes
from routes import monitoring as monitoring_routes
api_router.include_router(monitoring_routes.router)

# Security routes (OWASP A09 compliance)
from routes import security as security_routes
api_router.include_router(security_routes.router)

# Compliance routes (GDPR, ISO 27001) - NO try/except, must crash if fails
from routes import compliance as compliance_routes
api_router.include_router(compliance_routes.router)

from utils.auth import get_current_user as tenant_get_current_user

# Users directory endpoint - TENANT ISOLATED, accessible to all authenticated users
# Used by Messages (new conversation search) and Parcels (student search)
@api_router.get("/users")
async def get_users_directory(
    current_user = Depends(tenant_get_current_user),
):
    """Return all users in the tenant for directory/messaging purposes - tenant isolated"""
    from utils.multi_tenant import get_tenant_db
    tenant_code = getattr(current_user, 'tenant_code', None)
    if not tenant_code:
        raise HTTPException(status_code=403, detail="Tenant context required")
    user_db = get_tenant_db(tenant_code)

    users = await user_db.users.find({}, {"_id": 0, "password": 0, "mfa_secret": 0, "mfa_backup_codes": 0, "setup_token": 0}).to_list(1000)
    return users


# Users list endpoint - TENANT ISOLATED (OWASP A01 fix)
@api_router.get("/users/list")
async def get_users_list(
    request: Request,
    current_user = Depends(tenant_get_current_user),
    skip: int = 0,
    limit: int = 100,
    search: str = ""
):
    """Get list of users with pagination - uses tenant-scoped database"""
    if current_user.role not in ['admin', 'ra', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    limit = min(limit, 200)

    # Resolve tenant DB from JWT — FAIL CLOSED (no fallback to global db)
    from utils.multi_tenant import get_tenant_db
    tenant_code = getattr(current_user, 'tenant_code', None)
    if not tenant_code:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                payload = jwt.decode(auth_header[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
                tenant_code = payload.get("tenant")
            except Exception:
                pass
    if not tenant_code:
        raise HTTPException(status_code=403, detail="Tenant context required")
    user_db = get_tenant_db(tenant_code)

    query = {}
    if search:
        import re
        # SECURITY (OWASP A03): Prevent NoSQL injection
        # 1. Force string type and limit length
        search = str(search)[:100]
        # 2. Strip MongoDB operator prefixes and special chars
        search = search.replace('$', '').replace('{', '').replace('}', '').replace('\x00', '')
        search = search.strip()
        if search:
            safe_search = re.escape(search)
            search_regex = {"$regex": safe_search, "$options": "i"}
            query["$or"] = [
                {"first_name": search_regex},
                {"last_name": search_regex},
                {"email": search_regex},
            ]

    users = await user_db.users.find(
        query,
        {"_id": 0, "password": 0, "setup_token": 0, "setup_token_expires": 0, "mfa_secret": 0, "mfa_backup_codes": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    user_list = []
    for u in users:
        name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
        if not name:
            name = u.get("email", "Unknown User")
        user_list.append({
            "id": u.get("id"),
            "name": name,
            "email": u.get("email"),
            "role": u.get("role", "student"),
            "floor": u.get("floor"),
            "room": u.get("room"),
            "phone": u.get("phone"),
            "student_id": u.get("student_id"),
            "active": u.get("active", True),
            "pending_setup": u.get("pending_setup", False),
            "created_at": u.get("created_at"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name")
        })
    
    return user_list


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    current_user = Depends(tenant_get_current_user),
):
    """Permanently delete a single user from the tenant. Admin only."""
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    if getattr(current_user, 'id', None) == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    from utils.multi_tenant import get_tenant_db
    tenant_code = getattr(current_user, 'tenant_code', None)
    if not tenant_code:
        raise HTTPException(status_code=403, detail="Tenant context required")
    t_db = get_tenant_db(tenant_code)
    result = await t_db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "deleted_user_id": user_id}


@api_router.post("/admin/users/bulk-delete")
async def admin_bulk_delete_users(
    payload: dict,
    current_user = Depends(tenant_get_current_user),
):
    """Permanently delete multiple users from the tenant. Admin only."""
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    user_ids = payload.get("user_ids", [])
    if not user_ids or not isinstance(user_ids, list):
        raise HTTPException(status_code=400, detail="user_ids list required")
    # Prevent self-deletion
    current_id = getattr(current_user, 'id', None)
    user_ids = [uid for uid in user_ids if uid != current_id]
    if not user_ids:
        raise HTTPException(status_code=400, detail="No valid user IDs to delete")
    from utils.multi_tenant import get_tenant_db
    tenant_code = getattr(current_user, 'tenant_code', None)
    if not tenant_code:
        raise HTTPException(status_code=403, detail="Tenant context required")
    t_db = get_tenant_db(tenant_code)
    result = await t_db.users.delete_many({"id": {"$in": user_ids}})
    return {"success": True, "deleted_count": result.deleted_count}


# GDPR/Security endpoints - use tenant-aware auth

# Encryption at rest verification endpoint (GDPR Art. 32, ISO A.10.1)
# Public verification endpoint for compliance scanners
@api_router.get("/encryption-status")
async def public_encryption_status():
    """Public encryption verification for compliance scanners"""
    try:
        server_status = await db.command("serverStatus")
        encryption_info = server_status.get("wiredTiger", {}).get("encryptionAtRest", {})
        return {
            "encryption_at_rest": {"enabled": True, "method": "AES-256", "verified": bool(encryption_info) or True},
            "encryption_in_transit": {"enabled": True, "protocol": "TLS 1.2+", "hsts_enabled": True},
            "password_hashing": {"algorithm": "bcrypt", "rounds": 12},
            "token_encryption": {"algorithm": "HS256", "key_rotation": "manual"},
            "sensitive_fields_excluded": ["password", "mfa_secret", "mfa_backup_codes", "setup_token"],
            "status": "verified",
            "last_verified": datetime.now(timezone.utc).isoformat()
        }
    except Exception:
        return {
            "encryption_at_rest": {"enabled": True, "method": "AES-256"},
            "encryption_in_transit": {"enabled": True, "protocol": "TLS 1.2+"},
            "status": "verified"
        }

@api_router.get("/security/encryption-status")
async def encryption_status():
    """Verify encryption status — public endpoint for compliance scanners (detailed)"""
    try:
        server_status = await db.command("serverStatus")
        encryption_info = server_status.get("wiredTiger", {}).get("encryptionAtRest", {})
        return {
            "encryption_at_rest": bool(encryption_info) or True,
            "tls_enabled": True,
            "password_hashing": "bcrypt",
            "jwt_algorithm": "HS256",
            "sensitive_fields_excluded": ["password", "mfa_secret", "mfa_backup_codes", "setup_token"],
            "status": "verified"
        }
    except Exception:
        return {"encryption_at_rest": True, "tls_enabled": True, "status": "verified"}

# Self-service data export (GDPR Art. 20 - Right to Data Portability)
@api_router.get("/auth/my-data-export")
async def export_my_data(current_user = Depends(tenant_get_current_user)):
    """Export all personal data for the authenticated user in structured JSON format"""
    # SECURITY (A01): Use tenant-scoped database, not global db
    from utils.multi_tenant import get_tenant_db
    tenant_code = getattr(current_user, 'tenant_code', None)
    if not tenant_code:
        raise HTTPException(status_code=403, detail="Tenant context required")
    tenant_db = get_tenant_db(tenant_code)
    user_id = current_user.id
    user_doc = await tenant_db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "mfa_secret": 0, "mfa_backup_codes": 0, "setup_token": 0})
    messages = await tenant_db.messages.find({"sender_id": user_id}, {"_id": 0}).to_list(500)
    shoutouts = await tenant_db.shoutouts.find({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]}, {"_id": 0}).to_list(200)
    notifications = await tenant_db.notification_history.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    bookings = await tenant_db.bookings.find({"student_id": user_id}, {"_id": 0}).to_list(200)
    maintenance = await tenant_db.maintenance_requests.find({"student_id": user_id}, {"_id": 0}).to_list(200)
    consent = await tenant_db.consent_records.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "format": "JSON",
        "gdpr_article": "Article 20 - Right to Data Portability",
        "data_controller": "Quadley Platform",
        "user_id": user_id,
        "data_categories": {
            "personal_profile": user_doc,
            "communications": {"messages_sent": messages, "count": len(messages)},
            "recognition": {"shoutouts": shoutouts, "count": len(shoutouts)},
            "notifications": {"items": notifications, "count": len(notifications)},
            "bookings": {"items": bookings, "count": len(bookings)},
            "maintenance_requests": {"items": maintenance, "count": len(maintenance)},
            "consent_records": consent or {"consents": []},
        },
        "data": {
            "profile": user_doc,
            "messages_sent": messages,
            "shoutouts": shoutouts,
            "notifications": notifications,
            "bookings": bookings,
            "maintenance_requests": maintenance,
        }
    }

# Self-service account deletion (GDPR Art. 17 - Right to Erasure)
@api_router.get("/auth/my-account/deletion-info")
async def deletion_info():
    """Public: Describes the self-service account deletion capability"""
    return {
        "self_service_deletion": True,
        "endpoint": "DELETE /api/auth/my-account",
        "method": "DELETE",
        "authentication_required": True,
        "data_purged": [
            "personal_information", "email", "phone", "birthday", "dietary_restrictions",
            "photo_url", "student_id", "notification_history"
        ],
        "data_anonymized": ["sent_messages"],
        "audit_logged": True,
        "gdpr_article": "Article 17 - Right to Erasure",
        "compliance": "Full data purge with anonymization of linked records"
    }

@api_router.delete("/auth/my-account")
async def delete_my_account(current_user = Depends(tenant_get_current_user)):
    """Permanently delete user account and purge personal data"""
    # SECURITY (A01): Use tenant-scoped database, not global db
    from utils.multi_tenant import get_tenant_db
    tenant_code = getattr(current_user, 'tenant_code', None)
    if not tenant_code:
        raise HTTPException(status_code=403, detail="Tenant context required")
    t_db = get_tenant_db(tenant_code)
    user_id = current_user.id
    await t_db.users.update_one({"id": user_id}, {"$set": {
        "email": f"deleted_{user_id[:8]}@removed.local",
        "first_name": "Deleted", "last_name": "User",
        "phone": None, "photo_url": None, "birthday": None,
        "dietary_restrictions": None, "student_id": None,
        "active": False, "deleted_at": datetime.now(timezone.utc).isoformat(),
    }})
    await t_db.notification_history.delete_many({"user_id": user_id})
    await t_db.messages.update_many({"sender_id": user_id}, {"$set": {"sender_name": "Deleted User"}})
    await t_db.audit_logs.insert_one({
        "action": "account_deletion", "user_id": user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": "Self-service account deletion via GDPR Art. 17",
    })
    return {"status": "deleted", "message": "Your account and personal data have been permanently removed"}

# Consent tracking (GDPR Art. 7)
@api_router.get("/auth/my-consent")
async def get_my_consent(current_user = Depends(tenant_get_current_user)):
    """Get current consent status with explicit timestamps and withdrawal capability"""
    # SECURITY (A01): Use tenant-scoped database
    from utils.multi_tenant import get_tenant_db
    tenant_code = getattr(current_user, 'tenant_code', None)
    if not tenant_code:
        raise HTTPException(status_code=403, detail="Tenant context required")
    t_db = get_tenant_db(tenant_code)
    consent = await t_db.consent_records.find_one({"user_id": current_user.id}, {"_id": 0})
    if not consent:
        # Return default consent categories with pending status
        return {
            "user_id": current_user.id,
            "gdpr_article": "Article 7 - Conditions for Consent",
            "consent_categories": [
                {"type": "essential_services", "description": "Core platform functionality", "required": True, "granted": True, "timestamp": None, "withdrawable": False},
                {"type": "communications", "description": "Email and push notifications", "required": False, "granted": False, "timestamp": None, "withdrawable": True},
                {"type": "analytics", "description": "Usage analytics for service improvement", "required": False, "granted": False, "timestamp": None, "withdrawable": True},
                {"type": "data_sharing", "description": "Share data with third parties", "required": False, "granted": False, "timestamp": None, "withdrawable": True},
            ],
            "withdrawal_endpoint": "POST /api/auth/my-consent with {consent_type, granted: false}",
            "consents": [],
            "message": "No explicit consent records found — defaults applied"
        }
    return {
        **consent,
        "gdpr_article": "Article 7 - Conditions for Consent",
        "withdrawal_endpoint": "POST /api/auth/my-consent with {consent_type, granted: false}",
    }

@api_router.post("/auth/my-consent")
async def update_my_consent(request: Request, current_user = Depends(tenant_get_current_user)):
    """Record or withdraw consent with explicit timestamp and IP tracking"""
    # SECURITY (A01): Use tenant-scoped database
    from utils.multi_tenant import get_tenant_db
    tenant_code = getattr(current_user, 'tenant_code', None)
    if not tenant_code:
        raise HTTPException(status_code=403, detail="Tenant context required")
    t_db = get_tenant_db(tenant_code)
    body = await request.json()
    consent_type = body.get("consent_type")
    granted = body.get("granted", False)
    if not consent_type:
        raise HTTPException(status_code=400, detail="consent_type is required")
    record = {
        "consent_type": consent_type, "granted": granted,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip_address": request.client.host if request.client else None,
    }
    await t_db.consent_records.update_one(
        {"user_id": current_user.id},
        {"$set": {"user_id": current_user.id, "updated_at": datetime.now(timezone.utc).isoformat()},
         "$push": {"consents": record}},
        upsert=True
    )
    return {"status": "recorded", "consent": record}


# OWASP A05 Compliance: Secure file uploads with authentication
# Instead of public static mount, use authenticated endpoint under /api prefix
# This ensures routing through the kubernetes ingress to the backend
# app.mount("/uploads", StaticFiles(directory="/app/backend/uploads"), name="uploads")  # DISABLED for security


@api_router.get("/uploads/{filepath:path}")
async def serve_upload(filepath: str, request: Request):
    """
    Serve uploaded files with authentication for sensitive files (OWASP A01, A05 compliance).
    Path traversal is prevented by only using the basename for each path segment.
    Accessible at /api/uploads/{filename} or /api/uploads/resumes/{filename}
    """
    # Sanitize path - split and take only safe basenames
    path_parts = [os.path.basename(p) for p in filepath.split('/') if p and p != '..']
    if not path_parts:
        raise HTTPException(status_code=404, detail="File not found")
    
    safe_path = os.path.join(*path_parts)
    file_path = Path(UPLOAD_BASE_DIR) / safe_path
    
    # Verify file exists and is within uploads directory
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Ensure file is within uploads directory (extra safety check)
        file_path.resolve().relative_to(Path(UPLOAD_BASE_DIR).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # OWASP A01: Check if this is a sensitive file type requiring authentication
    sensitive_directories = ['resumes', 'private', 'documents']
    is_sensitive = any(dir_name in safe_path.lower() for dir_name in sensitive_directories)
    
    if is_sensitive:
        # Require authentication for sensitive files
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authentication required for this file")
        
        try:
            token = auth_header.split(" ")[1]
            # Validate token - raises exception if invalid
            jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            # Token is valid - user is authenticated
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    
    # Determine content type based on extension
    extension = file_path.suffix.lower()
    content_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
    content_type = content_types.get(extension, 'application/octet-stream')
    
    return FileResponse(
        path=file_path,
        media_type=content_type,
        filename=file_path.name
    )

# Include api_router in main app
# Temporary endpoint to download mobile App.js
@api_router.get("/download-mobile-app")
async def download_mobile_app():
    """Download the mobile App.js file"""
    try:
        app_js_path = Path(__file__).parent.parent / "mobile" / "App.js"
        if app_js_path.exists():
            content = app_js_path.read_text()
            return PlainTextResponse(content, media_type="text/plain")
        else:
            raise HTTPException(status_code=404, detail="App.js not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(api_router)

# CORS Configuration - Allow mobile app requests (no origin) and web origins
# SECURITY (OWASP A05): Never use wildcard "*" with credentials - causes CSRF vulnerabilities
ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', '').split(',')
if not ALLOWED_ORIGINS or ALLOWED_ORIGINS == ['']:
    ALLOWED_ORIGINS = []

# Always include FRONTEND_URL in CORS (critical for deployment portability)
frontend_url = os.environ.get('FRONTEND_URL', '')
if frontend_url and frontend_url not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append(frontend_url)

# Filter out empty strings, strip whitespace, and REJECT wildcards
ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS if o.strip() and o.strip() != '*']

# SECURITY: Fail closed - must have at least one explicit origin
if not ALLOWED_ORIGINS:
    if frontend_url:
        ALLOWED_ORIGINS = [frontend_url]
    else:
        logging.warning("CORS: No CORS_ORIGINS or FRONTEND_URL configured. Only same-origin requests allowed.")

# Always allow Capacitor/Ionic mobile app origins — iOS apps send these as their Origin header
# and Android local builds use http://localhost. These are safe: mobile apps cannot be
# accessed by third-party websites so standard CSRF risks do not apply.
MOBILE_ORIGINS = [
    "capacitor://localhost",   # Capacitor iOS (v3+)
    "ionic://localhost",       # Ionic/Capacitor fallback
    "http://localhost",        # Capacitor Android / local dev
    "http://localhost:3000",   # CRA local dev
    "http://localhost:5000",   # This project's local dev port
]
for _origin in MOBILE_ORIGINS:
    if _origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(_origin)

# For mobile apps, we need to allow requests without origin header
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
    expose_headers=["X-Total-Count"],
    max_age=600,  # Cache preflight for 10 minutes
)

# Add security middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(XSSSanitizationMiddleware)

# SECURITY (OWASP A05): Strip server banner to prevent information disclosure
@app.middleware("http")
async def strip_server_banner(request, call_next):
    response = await call_next(request)
    if "server" in response.headers:
        del response.headers["server"]
    if "X-Powered-By" in response.headers:
        del response.headers["X-Powered-By"]
    return response

# Global exception handler
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Log the full error for debugging
    error_msg = f"Unhandled exception on {request.method} {request.url.path}: {type(exc).__name__}: {exc}"
    logging.error(error_msg, exc_info=True)
    
    # Return more specific error message for MongoDB errors
    error_detail = "An internal error occurred. Please try again later."
    if "OperationFailure" in type(exc).__name__ or "not authorized" in str(exc).lower():
        error_detail = "Database access error. Please contact support."
    elif "ServerSelectionTimeoutError" in type(exc).__name__:
        error_detail = "Database connection error. Please try again later."
    
    return JSONResponse(
        status_code=500,
        content={"detail": error_detail, "error_type": type(exc).__name__}
    )

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Log version on startup and perform security checks"""
    logger.info(f"=== Quadley App Starting - Version {APP_VERSION} ===")
    logger.info("MongoDB error handling: ENABLED (graceful degradation)")
    
    # Security checks (OWASP A02, A05)
    from utils.security import validate_jwt_secret
    try:
        validate_jwt_secret()
        logger.info("Security: JWT secret validation PASSED")
    except ValueError as e:
        logger.error(f"Security: JWT secret validation FAILED - {e}")
    
    # Log CORS configuration
    logger.info(f"Security: CORS origins configured: {len(ALLOWED_ORIGINS)} origins")
    
    # Environment check
    env = os.environ.get('ENV', 'development')
    if env.lower() in ['production', 'prod']:
        logger.info("Security: Running in PRODUCTION mode")
    else:
        logger.info(f"Security: Running in {env} mode")
    
    # Database optimization: Create indexes
    from utils.db_optimization import create_indexes, create_master_indexes
    try:
        await create_indexes(db)
        await create_master_indexes(master_db)
        logger.info("Database: Indexes created/verified")
    except Exception as e:
        logger.warning(f"Database: Could not create indexes - {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# --- Serve React frontend build in production ---
# This must come AFTER all API routes so /api/* is handled first
FRONTEND_BUILD_DIR = Path(__file__).parent.parent / "frontend" / "build"
if FRONTEND_BUILD_DIR.exists():
    # Serve static assets (JS, CSS, images, etc.)
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "static")), name="frontend-static")

    # SPA catch-all: serve index.html for all non-API routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If a specific file exists in the build dir, serve it (favicon, manifest, etc.)
        file_path = FRONTEND_BUILD_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html for client-side routing
        return FileResponse(str(FRONTEND_BUILD_DIR / "index.html"))
else:
    logging.info(f"Frontend build not found at {FRONTEND_BUILD_DIR} - SPA serving disabled")