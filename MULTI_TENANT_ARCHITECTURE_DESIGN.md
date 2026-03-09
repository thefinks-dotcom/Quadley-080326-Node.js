# Multi-Tenant White-Label Architecture Design
## Quadley Residential College Platform

**Date:** December 16, 2024  
**Purpose:** Design scalable authorization and user provisioning for 300-500 user colleges  
**Architecture:** White-label SaaS with tenant isolation

---

## Executive Summary

Quadley will serve multiple residential colleges (tenants), each with 300-500 users. This document outlines:
1. **Multi-tenant authorization architecture** to fix missing authorization checks
2. **User provisioning strategies** to onboard college users
3. **Data isolation** to ensure colleges can't access each other's data
4. **Scalable design** for growth to hundreds of colleges

---

## Part 1: Authorization Architecture

### Current Issues (From OWASP Review)
1. Missing authorization checks in maintenance, file uploads
2. Inconsistent role verification across endpoints
3. No tenant isolation (all data in one database)
4. Horizontal privilege escalation risk

### Proposed Solution: Tenant-Based RBAC

---

## 1.1 Multi-Tenancy Model

### Option A: Shared Database with Tenant Column (RECOMMENDED)
```
✅ Pros: Simple, cost-effective, easier to manage
✅ Best for: 300-500 users per tenant, <100 tenants initially
❌ Cons: Risk of data leakage if queries miss tenant filter

Implementation:
- Add `tenant_id` to ALL collections
- Every query MUST filter by tenant_id
- Use database-level constraints where possible
```

### Option B: Database Per Tenant
```
✅ Pros: Strong isolation, easier data export, regulatory compliance
❌ Cons: More complex, higher cost, connection pool limits
✅ Best for: Regulated industries, large tenants (1000+ users)
```

### Option C: Schema Per Tenant (PostgreSQL only)
```
Not applicable - using MongoDB
```

**RECOMMENDATION:** Start with **Option A** (shared database), migrate to **Option B** if needed.

---

## 1.2 Database Schema Changes

### Add Tenant Context to All Collections

```javascript
// Every collection gets tenant_id
{
  "id": "uuid",
  "tenant_id": "college_abc",  // NEW FIELD
  "tenant_name": "Stanford College",  // NEW FIELD (for display)
  // ... existing fields
}

// Collections to update:
- users
- announcements
- events
- maintenance_requests
- shoutouts
- study_groups
- messages
- cocurricular_groups
- tutoring_applications
- parcels
// ... ALL collections
```

### Compound Indexes for Performance
```javascript
// Example indexes
db.users.createIndex({ "tenant_id": 1, "email": 1 }, { unique: true })
db.announcements.createIndex({ "tenant_id": 1, "created_at": -1 })
db.events.createIndex({ "tenant_id": 1, "date": 1 })
```

---

## 1.3 Authorization Middleware (NEW)

### File: `/app/backend/utils/tenant.py`

```python
"""
Tenant-aware authorization utilities
"""
from fastapi import HTTPException, Depends
from typing import Optional
from models import User
from utils.auth import get_current_user, db

class TenantContext:
    """Thread-local tenant context"""
    def __init__(self, tenant_id: str, user: User):
        self.tenant_id = tenant_id
        self.user = user
        self.is_admin = user.role == "admin"
        self.is_ra = user.role in ["ra", "admin"]
        self.is_student = user.role == "student"

async def get_tenant_context(
    current_user: User = Depends(get_current_user)
) -> TenantContext:
    """
    Extract tenant context from current user.
    MUST be used in ALL route handlers.
    """
    if not current_user.tenant_id:
        raise HTTPException(status_code=500, detail="User has no tenant")
    
    return TenantContext(
        tenant_id=current_user.tenant_id,
        user=current_user
    )

def require_role(*allowed_roles: str):
    """
    Decorator to require specific roles.
    Usage: @require_role("ra", "admin")
    """
    async def role_checker(ctx: TenantContext = Depends(get_tenant_context)):
        if ctx.user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {', '.join(allowed_roles)}"
            )
        return ctx
    return role_checker

async def verify_resource_access(
    resource_id: str,
    collection_name: str,
    ctx: TenantContext
) -> dict:
    """
    Verify user has access to a specific resource.
    Automatically filters by tenant_id.
    """
    resource = await db[collection_name].find_one({
        "id": resource_id,
        "tenant_id": ctx.tenant_id
    }, {"_id": 0})
    
    if not resource:
        raise HTTPException(
            status_code=404,
            detail=f"{collection_name} not found or access denied"
        )
    
    return resource

async def verify_resource_ownership(
    resource_id: str,
    collection_name: str,
    ctx: TenantContext,
    owner_field: str = "owner_id"
) -> dict:
    """
    Verify user owns a specific resource.
    Use for DELETE/UPDATE operations.
    """
    resource = await verify_resource_access(resource_id, collection_name, ctx)
    
    # Admins/RAs can access any resource in their tenant
    if ctx.is_ra:
        return resource
    
    # Students can only access their own resources
    if resource.get(owner_field) != ctx.user.id:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to modify this resource"
        )
    
    return resource
```

---

## 1.4 Updated Route Examples

### Before (VULNERABLE):
```python
@router.put("/{request_id}/resolve")
async def resolve_maintenance_request(
    request_id: str, 
    current_user: User = Depends(get_current_user)
):
    # ❌ No tenant isolation
    # ❌ No role check
    # ❌ Can resolve ANY maintenance request across ALL colleges
    await db.maintenance.update_one(
        {"id": request_id},
        {"$set": {"status": "resolved"}}
    )
```

### After (SECURE):
```python
from utils.tenant import get_tenant_context, require_role, verify_resource_access

@router.put("/{request_id}/resolve")
async def resolve_maintenance_request(
    request_id: str,
    ctx: TenantContext = Depends(require_role("ra", "admin"))
):
    # ✅ Role checked by require_role decorator
    # ✅ Tenant isolation enforced
    # ✅ Can only resolve requests in their college
    
    request = await verify_resource_access(
        request_id, 
        "maintenance",
        ctx
    )
    
    await db.maintenance.update_one(
        {
            "id": request_id,
            "tenant_id": ctx.tenant_id  # ✅ Tenant filter
        },
        {"$set": {"status": "resolved"}}
    )
```

### File Upload (SECURE):
```python
@router.post("/groups/{group_id}/upload")
async def upload_photo(
    group_id: str,
    file: UploadFile,
    ctx: TenantContext = Depends(get_tenant_context)
):
    # ✅ Verify group exists and user has access
    group = await verify_resource_access(group_id, "cocurricular_groups", ctx)
    
    # ✅ Verify user is member of group
    if ctx.user.id not in group.get("members", []):
        raise HTTPException(403, detail="Must be a group member to upload")
    
    # ✅ Sanitize filename
    safe_filename = secure_filename(file.filename)
    file_path = f"{ctx.tenant_id}/{group_id}/{safe_filename}"
    
    # ... upload logic
```

---

## 1.5 Database Query Helper

### File: `/app/backend/utils/db_helpers.py`

```python
"""
Tenant-aware database helpers
"""

class TenantDB:
    """
    Wrapper for MongoDB operations that enforces tenant isolation
    """
    def __init__(self, db, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
    
    async def find_one(self, collection: str, query: dict, **kwargs):
        """Find one document with tenant filter"""
        query["tenant_id"] = self.tenant_id
        return await self.db[collection].find_one(query, **kwargs)
    
    async def find(self, collection: str, query: dict, **kwargs):
        """Find documents with tenant filter"""
        query["tenant_id"] = self.tenant_id
        return self.db[collection].find(query, **kwargs)
    
    async def insert_one(self, collection: str, document: dict):
        """Insert document with tenant_id"""
        document["tenant_id"] = self.tenant_id
        return await self.db[collection].insert_one(document)
    
    async def update_one(self, collection: str, query: dict, update: dict):
        """Update document with tenant filter"""
        query["tenant_id"] = self.tenant_id
        return await self.db[collection].update_one(query, update)
    
    async def delete_one(self, collection: str, query: dict):
        """Delete document with tenant filter"""
        query["tenant_id"] = self.tenant_id
        return await self.db[collection].delete_one(query)

# Usage in routes:
async def get_announcements(ctx: TenantContext = Depends(get_tenant_context)):
    tenant_db = TenantDB(db, ctx.tenant_id)
    announcements = await tenant_db.find(
        "announcements",
        {"target_audience": "all"}
    ).to_list(100)
    return announcements
```

---

## Part 2: User Provisioning Strategy

### Goal: Get user data from colleges (name, email, role, floor, phone)

---

## 2.1 Provisioning Methods (Recommended Order)

### Method 1: CSV/Excel Upload (IMMEDIATE)
**Best for:** Initial launch, small colleges, non-technical staff

```
Implementation:
1. Admin portal for college staff
2. Download CSV template
3. Fill in user data
4. Upload CSV
5. System validates and imports

CSV Format:
first_name,last_name,email,role,floor,phone,student_id
John,Doe,john@college.edu,student,Floor 1,555-0100,STU001
Jane,Smith,jane@college.edu,ra,Floor 2,555-0101,RA002

✅ Pros: Simple, no technical integration, works immediately
❌ Cons: Manual process, error-prone, not real-time
🎯 Use case: Onboarding, semester start, small updates
```

### Method 2: REST API Integration (RECOMMENDED)
**Best for:** Colleges with existing student information systems (SIS)

```
Implementation:
1. Provide REST API documentation to college IT
2. College pushes user data to Quadley API
3. Automated daily/weekly sync
4. Handles creates, updates, deactivations

API Endpoint:
POST /api/admin/tenants/{tenant_id}/users/bulk-sync
{
  "users": [
    {
      "email": "student@college.edu",
      "first_name": "John",
      "last_name": "Doe",
      "role": "student",
      "floor": "Floor 1",
      "phone": "555-0100",
      "student_id": "STU001",
      "active": true
    }
  ]
}

✅ Pros: Automated, real-time, accurate, scalable
❌ Cons: Requires technical integration, college IT involvement
🎯 Use case: Mid-size to large colleges, ongoing operations
```

### Method 3: SCIM (System for Cross-domain Identity Management)
**Best for:** Enterprise colleges with identity providers

```
Implementation:
1. Implement SCIM 2.0 protocol
2. College's IdP (Okta, Azure AD) provisions users
3. Automatic sync with identity system
4. Single source of truth

SCIM Endpoints:
GET    /scim/v2/Users
POST   /scim/v2/Users
PUT    /scim/v2/Users/{id}
DELETE /scim/v2/Users/{id}

✅ Pros: Industry standard, automatic sync, enterprise-ready
❌ Cons: Complex implementation, requires IdP support
🎯 Use case: Large universities, enterprise deployments
```

### Method 4: SSO with JIT (Just-In-Time) Provisioning
**Best for:** Colleges with existing SSO (SAML, OAuth)

```
Implementation:
1. Integrate with college's SSO (Google, Microsoft, Okta)
2. User logs in with college credentials
3. Profile auto-created from SSO claims
4. No manual provisioning needed

Flow:
User → SSO Login → SAML Response → Quadley → Create/Update User

✅ Pros: Zero-touch provisioning, always up-to-date, secure
❌ Cons: Limited user attributes, requires SSO setup
🎯 Use case: Google Workspace, Microsoft 365 colleges
```

### Method 5: Self-Registration with Approval
**Best for:** Small colleges, pilot programs

```
Implementation:
1. Students register with .edu email
2. RA/Admin reviews and approves
3. Assigns role and floor
4. Account activated

✅ Pros: No data import needed, simple
❌ Cons: Manual approval, potential for spam
🎯 Use case: Small pilots, limited rollouts
```

---

## 2.2 RECOMMENDED IMPLEMENTATION STRATEGY

### Phase 1: Launch (Week 1-2)
**Primary:** CSV Upload  
**Backup:** Self-registration with approval

```python
# Admin route for CSV upload
@router.post("/admin/tenants/{tenant_id}/users/csv-upload")
async def upload_users_csv(
    tenant_id: str,
    file: UploadFile,
    ctx: TenantContext = Depends(require_role("admin"))
):
    # Parse CSV
    # Validate emails, roles, etc.
    # Bulk insert with tenant_id
    # Send welcome emails
    pass
```

### Phase 2: Growth (Month 2-3)
**Primary:** REST API  
**Secondary:** CSV Upload (for smaller colleges)

```python
# Bulk sync endpoint
@router.post("/api/admin/tenants/{tenant_id}/users/bulk-sync")
async def bulk_sync_users(
    tenant_id: str,
    users: List[UserSync],
    api_key: str = Header(...),
    ctx: TenantContext = Depends(require_role("admin"))
):
    # Validate API key
    # Upsert users (create/update)
    # Deactivate removed users
    # Return sync report
    pass
```

### Phase 3: Enterprise (Month 6+)
**Primary:** SCIM or SSO with JIT  
**Secondary:** REST API, CSV

---

## 2.3 User Data Collection Requirements

### Minimum Required Fields
```
✅ First Name
✅ Last Name  
✅ Email (unique identifier)
✅ Role (student, ra, admin)
```

### Recommended Fields
```
✅ Floor/Room (for notifications, events)
✅ Phone (for emergency, SMS)
✅ Student ID (for integration)
✅ Year (freshman, sophomore, etc.)
✅ Birthday (for celebrations)
```

### Optional Fields
```
⭕ Photo URL
⭕ Major/Program
⭕ Dietary Restrictions
⭕ Emergency Contact
⭕ Preferred Name
```

### Privacy Considerations
```
⚠️ Collect only necessary data
⚠️ Get consent for optional fields
⚠️ Allow users to update their own data
⚠️ Implement data retention policy
⚠️ Support data export/deletion (GDPR)
```

---

## 2.4 Onboarding Flow (College Perspective)

### Step 1: College Signs Up
```
1. Sales/marketing provides college code
2. College admin creates account
3. Tenant created: tenant_id = "stanford_college"
4. Admin account created with tenant_id
```

### Step 2: College Customization
```
1. Upload college logo
2. Set colors/branding
3. Configure modules (enable/disable features)
4. Set academic calendar
```

### Step 3: User Import
```
Option A (CSV):
1. Download template
2. Export users from SIS
3. Format data
4. Upload CSV
5. Review import report
6. Send welcome emails

Option B (API):
1. Get API key from admin panel
2. Share API docs with IT
3. IT team implements integration
4. Test with small batch
5. Enable automated daily sync
```

### Step 4: Training & Launch
```
1. Train RAs on admin features
2. Send welcome email to students
3. Monitor first week usage
4. Provide support
```

---

## 2.5 Data Validation Rules

### Email Validation
```python
# Must be .edu domain for students
# Can be any domain for admins/RAs
# Must be unique within tenant
# Format: name@college.edu

def validate_email(email: str, role: str, tenant_domain: str) -> bool:
    if role == "student":
        # Students must use college domain
        if not email.endswith(f"@{tenant_domain}"):
            raise ValueError(f"Students must use @{tenant_domain} email")
    
    # Check uniqueness within tenant
    existing = await db.users.find_one({
        "email": email,
        "tenant_id": ctx.tenant_id
    })
    if existing:
        raise ValueError("Email already registered")
    
    return True
```

### Role Validation
```python
ALLOWED_ROLES = ["student", "ra", "admin"]

def validate_role(role: str) -> bool:
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Role must be one of: {ALLOWED_ROLES}")
    return True
```

### Floor Validation
```python
# Floor format: "Floor 1", "Floor 2", etc.
# Or building-floor: "North-1", "South-2"
# Allow college to define valid floors

def validate_floor(floor: str, tenant_config: dict) -> bool:
    valid_floors = tenant_config.get("floors", [])
    if valid_floors and floor not in valid_floors:
        raise ValueError(f"Invalid floor. Must be one of: {valid_floors}")
    return True
```

---

## 2.6 Admin Portal Features

### User Management Dashboard
```
Features:
- View all users in tenant
- Filter by role, floor, year
- Search by name, email
- Bulk actions (activate, deactivate, change role)
- Export user list
- Import users (CSV)
- Send bulk emails
- View activity logs
```

### Import/Export Tools
```
Features:
- CSV template download
- CSV validation before import
- Import preview (show what will be created/updated)
- Dry-run mode (test without committing)
- Error reporting (which rows failed, why)
- Import history (who imported when)
- Rollback capability (undo last import)
```

### API Key Management
```
Features:
- Generate API keys for integrations
- Revoke keys
- Key usage logs
- Rate limiting per key
- Scope restrictions (read-only, write)
```

---

## Part 3: Implementation Checklist

### Database Migration
```
- [ ] Add tenant_id to all collections
- [ ] Add tenant_name to all collections
- [ ] Create compound indexes
- [ ] Migrate existing data (if any)
- [ ] Add tenant_id NOT NULL constraint
- [ ] Test queries with tenant filter
```

### Backend Changes
```
- [ ] Create utils/tenant.py (TenantContext, helpers)
- [ ] Create utils/db_helpers.py (TenantDB wrapper)
- [ ] Add tenant_id to User model
- [ ] Update ALL route handlers to use TenantContext
- [ ] Add require_role decorators
- [ ] Add verify_resource_access calls
- [ ] Create CSV upload endpoint
- [ ] Create bulk sync API endpoint
- [ ] Add API key authentication
- [ ] Update tests with tenant context
```

### Frontend Changes
```
- [ ] Add tenant branding (logo, colors)
- [ ] Create admin portal pages
- [ ] Build user management UI
- [ ] Build CSV upload UI
- [ ] Build import preview UI
- [ ] Add tenant switcher (for super admins)
- [ ] Update all API calls to include tenant context
```

### Security
```
- [ ] Audit all endpoints for tenant isolation
- [ ] Add integration tests for tenant separation
- [ ] Test cross-tenant access attempts
- [ ] Add security logging for tenant access
- [ ] Implement rate limiting per tenant
- [ ] Add tenant-level settings/config
```

### Documentation
```
- [ ] API documentation for bulk sync
- [ ] CSV format specification
- [ ] Integration guide for college IT
- [ ] Admin user guide
- [ ] Security best practices
- [ ] Troubleshooting guide
```

---

## Part 4: Scalability Considerations

### Performance
```
- Compound indexes on (tenant_id, ...) for all queries
- Connection pooling per tenant (if needed)
- Query result caching per tenant
- CDN for tenant assets (logos, images)
```

### Storage
```
- File uploads: S3 with tenant prefix
  /tenants/{tenant_id}/uploads/...
- Database: Monitor size per tenant
- Consider archiving old data per tenant
```

### Monitoring
```
- Usage metrics per tenant
- Error rates per tenant
- API usage per tenant
- Storage usage per tenant
- Active users per tenant
```

### Billing/Limits
```
- Users per tenant (300-500 limit)
- Storage per tenant (10GB limit)
- API calls per tenant (rate limiting)
- Feature flags per tenant (enterprise features)
```

---

## Part 5: Example College Onboarding

### Stanford College (Example)

**1. Initial Setup**
```json
{
  "tenant_id": "stanford_college",
  "tenant_name": "Stanford Residential College",
  "domain": "stanford.edu",
  "logo_url": "https://cdn.quadley.app/tenants/stanford_college/logo.png",
  "primary_color": "#8C1515",
  "secondary_color": "#2E2D29",
  "capacity": 450,
  "floors": ["Floor 1", "Floor 2", "Floor 3", "Floor 4"],
  "features_enabled": ["events", "dining", "maintenance", "academics"],
  "contact_email": "housing@stanford.edu",
  "created_at": "2024-01-15T00:00:00Z"
}
```

**2. User Import (CSV)**
```csv
first_name,last_name,email,role,floor,phone,student_id
John,Doe,john.doe@stanford.edu,student,Floor 1,650-555-0100,STU001
Jane,Smith,jane.smith@stanford.edu,ra,Floor 2,650-555-0101,RA001
Bob,Admin,bob@stanford.edu,admin,,,ADMIN01
```

**3. Result**
```
✅ Imported 450 students
✅ Imported 8 RAs
✅ Imported 2 admins
✅ Welcome emails sent
✅ Tenant active
```

---

## Conclusion

### Summary

1. **Authorization:** Implement tenant-based RBAC with TenantContext
2. **Provisioning:** Start with CSV, scale to API/SCIM
3. **Data Isolation:** Tenant_id on all collections, strict filtering
4. **Scalability:** Designed for 100+ colleges, 50,000+ users

### Timeline

- **Week 1-2:** Database migration, TenantContext implementation
- **Week 3-4:** CSV upload, admin portal
- **Month 2:** REST API, bulk sync
- **Month 3+:** SSO/SCIM for enterprise

### Success Metrics

- ✅ Zero cross-tenant data leaks
- ✅ <24hr onboarding time per college
- ✅ >95% user import success rate
- ✅ <500ms query response time with tenant filter

---

**End of Design Document**
