# Quadley Multi-Tenant Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Quadley App  │  │Grace College │  │   Web Admin Dashboard    │  │
│  │  (iOS/Andr)  │  │  (iOS/Andr)  │  │   (React + Tailwind)     │  │
│  │              │  │              │  │                          │  │
│  │ Bundle ID:   │  │ Bundle ID:   │  │  Hosted on Railway       │  │
│  │ com.quadley  │  │ com.grace    │  │                          │  │
│  │   .app       │  │ college.app  │  │                          │  │
│  │              │  │              │  │                          │  │
│  │ EAS Project: │  │ EAS Project: │  │                          │  │
│  │ 02c021f0...  │  │ 7c3a9ce2...  │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
│         │    All apps share the SAME codebase      │                │
│         │    TENANT env var selects branding        │                │
│         └────────────────┬┬────────────────────────┘                │
└──────────────────────────┼┼─────────────────────────────────────────┘
                           ││
                           ▼▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API LAYER (FastAPI)                              │
│                     Railway Production                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Authentication                            │    │
│  │                                                             │    │
│  │  1. Login request comes in with email + password            │    │
│  │  2. Check quadley_master.super_admins first                 │    │
│  │  3. If not super admin, scan ALL active tenant DBs          │    │
│  │     for matching email                                      │    │
│  │  4. Issue JWT with { sub: user_id, tenant: "GRAC0001" }    │    │
│  │  5. All subsequent requests use tenant from JWT             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 Request Routing                              │    │
│  │                                                             │    │
│  │  get_tenant_db_for_user(request) →                          │    │
│  │    1. Extract JWT from Authorization header                 │    │
│  │    2. Read tenant_code from JWT claims                      │    │
│  │    3. Return get_tenant_db(tenant_code) → isolated DB       │    │
│  │                                                             │    │
│  │  Super Admin requests → quadley_master (cross-tenant)       │    │
│  │  Tenant User requests → quadley_tenant_{code} (isolated)    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (MongoDB)                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              quadley_master (Shared)                         │    │
│  │                                                             │    │
│  │  Collections:                                               │    │
│  │  ├── tenants          → Tenant registry & config            │    │
│  │  │   {code, name, status, branding, enabled_modules,        │    │
│  │  │    primary_color, secondary_color, max_users, ...}       │    │
│  │  ├── super_admins     → Platform-wide admins (gen@quadley)  │    │
│  │  ├── invitations      → Pending invite codes                │    │
│  │  ├── audit_logs       → Cross-tenant admin actions          │    │
│  │  └── billing          → Subscription tracking               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────┐    ┌─────────────────────┐                │
│  │ quadley_tenant_     │    │ quadley_tenant_     │                │
│  │     test6991        │    │     grac0001        │                │
│  │                     │    │                     │                │
│  │ (Test College)      │    │ (Grace College)     │                │
│  │                     │    │                     │                │
│  │ Collections:        │    │ Collections:        │                │
│  │ ├── users           │    │ ├── users           │                │
│  │ ├── events          │    │ ├── events          │                │
│  │ ├── announcements   │    │ ├── announcements   │                │
│  │ ├── messages        │    │ ├── messages         │                │
│  │ ├── conversations   │    │ ├── conversations   │                │
│  │ ├── menu (dining)   │    │ ├── menu (dining)   │                │
│  │ ├── maintenance     │    │ ├── maintenance     │                │
│  │ ├── shoutouts       │    │ ├── shoutouts       │                │
│  │ ├── safe_disclosures│    │ ├── safe_disclosures│                │
│  │ ├── bookings        │    │ ├── bookings        │                │
│  │ ├── parcels         │    │ ├── parcels         │                │
│  │ ├── notifications   │    │ ├── notifications   │                │
│  │ ├── audit_logs      │    │ ├── audit_logs      │                │
│  │ ├── settings        │    │ ├── settings        │                │
│  │ └── ...             │    │ └── ...             │                │
│  └─────────────────────┘    └─────────────────────┘                │
│                                                                     │
│  Each tenant gets a COMPLETELY SEPARATE database.                   │
│  No data is shared between tenant databases.                        │
│  A user in Test College CANNOT see Grace College data.              │
└─────────────────────────────────────────────────────────────────────┘
```

## How Components Connect

### 1. Mobile App → Backend (Tenant Resolution)

```
Mobile App (app.config.js)
    │
    │  TENANT env var determines:
    │  ├── App name, slug, icons, splash screen
    │  ├── EAS project ID (for App Store separation)
    │  ├── Bundle ID (com.quadley.app vs com.gracecollege.app)
    │  └── Primary/secondary colors baked into the build
    │
    │  At RUNTIME, the app connects to the SAME backend:
    │  https://quadley-280126-production.up.railway.app/api
    │
    ▼
Backend (FastAPI)
    │
    │  Login: POST /api/auth/login { email, password }
    │  ├── Checks quadley_master.super_admins
    │  ├── If not found, scans ALL quadley_tenant_* databases
    │  ├── Returns JWT with tenant code embedded
    │  └── Mobile stores JWT in SecureStore
    │
    │  All subsequent requests:
    │  ├── JWT contains tenant: "GRAC0001"
    │  ├── Middleware extracts tenant from JWT
    │  └── Routes data to quadley_tenant_grac0001 database
    ▼
MongoDB
```

### 2. Tenant Record Structure

```
quadley_master.tenants document:
{
  "code": "GRAC0001",              ← Unique identifier
  "name": "Grace College",         ← Display name (used in emails)
  "status": "active",              ← active | suspended | inactive
  "branding": {
    "primary_color": "#E05A20",    ← Orange (used in emails, buttons)
    "secondary_color": "#3E1B5E",  ← Purple (accent color)
    "logo_url": null               ← Optional logo
  },
  "enabled_modules": [...],        ← Which features are active
  "max_users": 500,                ← Subscription limit
  "contact_email": "...",          ← Admin contact
  "subscription_tier": "professional"
}
```

### 3. Mobile Config ↔ Tenant Record

```
mobile/app.config.js                    quadley_master.tenants
─────────────────────                   ──────────────────────
grace_college: {                        { code: "GRAC0001",
  name: "Grace College",     ◄────────   name: "Grace College",
  slug: "grace-college",                 
  projectId: "7c3a9ce2...",             (EAS project - not in DB)
  ios: { bundleId: "com.               
    gracecollege.app" },                (Bundle ID - not in DB)
  primaryColor: "#E05A20",   ◄────────   primary_color: "#E05A20",
  secondaryColor: "#3E1B5E"  ◄────────   secondary_color: "#3E1B5E"
}                                       }

BUILD TIME (app.config.js)              RUNTIME (database)
- Determines app identity               - Determines data isolation
- App Store listing                      - Feature toggles
- Static branding in binary              - Dynamic branding in emails
- EAS build configuration               - User management
```

### 4. User Lifecycle

```
Admin invites user
    │
    ├── Single Invite: POST /api/admin/users/invite
    │   ├── Creates record in quadley_master.invitations
    │   ├── Creates record in quadley_tenant_grac0001.users (pending)
    │   └── Sends email with invite code (branded to Grace College)
    │
    └── CSV Bulk: POST /api/admin/users/bulk-invite
        ├── Creates records in quadley_tenant_grac0001.users (pending)
        └── Sends emails to each user

User opens app → Enters invite code
    │
    ├── POST /api/auth/invite-code/verify  (validates code)
    └── POST /api/auth/invite-code/register (sets password, activates)
        ├── Updates quadley_tenant_grac0001.users (active: true)
        ├── Marks invitation as accepted
        └── Returns JWT with tenant: "GRAC0001"
```

### 5. Super Admin vs Tenant Admin

```
Super Admin (gen@quadley.com)
    │
    │  Stored in: quadley_master.super_admins
    │  JWT: { sub: "...", mfa_pending: true }  (no tenant claim)
    │  Can: List all tenants, create tenants, cross-tenant analytics
    │  Cannot: See individual tenant user data directly
    │
Tenant Admin (e.g., admin@gracecollege.edu)
    │
    │  Stored in: quadley_tenant_grac0001.users
    │  JWT: { sub: "...", tenant: "GRAC0001" }
    │  Can: Manage users, events, settings FOR Grace College only
    │  Cannot: See Test College data or other tenants
```

### 6. Key Files

```
Backend:
├── utils/multi_tenant.py      → get_tenant_db(), master_db, tenant DB cache
├── utils/auth.py              → get_current_user(), get_tenant_db_for_user()
├── routes/auth.py             → Login (scans tenants), registration
├── routes/admin.py            → User invite, CSV import, tenant management
├── routes/multi_tenant.py     → Tenant CRUD (super admin only)
└── server.py                  → App setup, middleware, CORS

Mobile:
├── app.config.js              → Tenant configs (slug, projectId, colors)
├── eas.json                   → Build profiles per tenant
├── build.sh                   → Automated build/submit script
├── src/config/api.js          → API base URL, endpoints
├── src/services/authService.js → Login, MFA, registration
└── src/contexts/
    ├── AuthContext.js          → Auth state, token management
    └── TenantContext.js        → Runtime branding from backend
```

## Current Tenants

| Tenant Code | Name | Status | Primary Color | Database |
|-------------|------|--------|---------------|----------|
| TEST6991 | Test College | active | #1e3a5f (navy) | quadley_tenant_test6991 |
| GRAC0001 | Grace College | active | #E05A20 (orange) | quadley_tenant_grac0001 |
