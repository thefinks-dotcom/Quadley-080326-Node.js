# Quadley - Campus Community Platform

## Overview
Quadley is a multi-tenant campus community platform for residential colleges. It provides community features, events, messaging, co-curricular activities, wellbeing tracking, and administrative tools. Also packaged as native apps (Android: `com.quadley.grace.app`; iOS: `com.gracecollege.app`).

## Architecture

### Frontend (Next.js — active)
- **Framework**: Next.js 15 App Router + React 19
- **Port**: 5000 (development)
- **Location**: `frontend-next/`
- **Workflow**: "Start application" (`cd frontend-next && yarn dev`)
- **Key config**: `next.config.js` — rewrites `/api/**` to backend, security headers, static export mode for iOS
- **Previous stack**: CRA + Craco archived in `frontend/` (do not delete without testing iOS build)

### Backend
- **Framework**: FastAPI (Python)
- **Port**: 8000
- **Location**: `backend/`
- **Workflow**: "Backend API" (`cd backend && uvicorn server:app --host 0.0.0.0 --port 8000`)
- **Entry point**: `backend/server.py`

### Database
- **MongoDB** via Motor (async driver)
- Connection via `MONGO_URL` secret
- Database name via `DB_NAME` env var (default: `quadley_dev`)

## Environment Variables

### Secrets (set in Replit Secrets)
- `MONGO_URL` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `SENDGRID_API_KEY` - SendGrid API key for transactional emails (password reset, invites)

### Env Vars
- `NEXT_PUBLIC_BACKEND_URL` - Backend URL used ONLY by Next.js server-side rewrites (proxy destination). **All browser API calls use relative `/api` paths** — the rewrite in `next.config.js` proxies them to the backend. Do NOT use `NEXT_PUBLIC_BACKEND_URL` directly in client-side code.
- `NEXT_PUBLIC_TENANT_CODE` - Tenant code for dedicated deployments (e.g. `GRAC7421`)
- `DB_NAME` - MongoDB database name (`quadley_dev`)
- `UPLOAD_DIR` - File upload directory (`/home/runner/workspace/backend/uploads`)
- `CORS_ORIGINS` - Comma-separated allowed origins
- `FRONTEND_URL` - Frontend URL for CORS

## Next.js Migration Notes

### Key Changes (CRA → Next.js)
| Concern | CRA | Next.js |
|---|---|---|
| Routing | React Router DOM | `app/` directory (App Router) |
| Dev proxy | `setupProxy.js` | `next.config.js` rewrites |
| Security headers | craco dev server | `next.config.js` headers |
| `@/` alias | craco webpack | `jsconfig.json` paths |
| `useNavigate` | react-router-dom | `useRouter` from next/navigation |
| `useLocation` | react-router-dom | `usePathname` from next/navigation |
| Auth guard | inline `<Navigate>` | `DashboardLayout` redirects |
| Env vars | `REACT_APP_*` | `NEXT_PUBLIC_*` |
| iOS build | `yarn build` + static | `NEXT_EXPORT=true next build` → `out/` |

### iOS / Capacitor Build
```bash
# Static export for iOS
cd frontend-next
NEXT_EXPORT=true NEXT_PUBLIC_BACKEND_URL=https://quadley-280126-production.up.railway.app NEXT_PUBLIC_TENANT_CODE=GRAC7421 yarn build
npx cap sync ios
npx cap open ios
```
- `capacitor.config.json` sets `webDir: "out"` (the static export directory)

## Project Structure
```
backend/
  server.py          # Main FastAPI app
  models.py          # Pydantic models
  routes/            # Route handlers (40+ modules)
  utils/             # Utilities (auth, email, etc.)
  uploads/           # File uploads
frontend-next/
  src/app/           # Next.js App Router pages
  src/components/    # Shared components + shadcn/ui
  src/contexts/      # AuthContext, TenantThemeContext
  src/config/        # tenantThemes.js (static fallbacks)
  src/utils/         # colorUtils.js
  src/hooks/         # Custom hooks
  src/modules/       # MessagesModule (legacy)
  public/            # Static assets (logos, images)
  next.config.js     # Next.js config (rewrites, headers, export)
  capacitor.config.json
frontend/            # CRA backup (kept for reference)
```

## Routing (App Router)
- `/` → redirects to `/dashboard` or `/login`
- `/login` → Login page with tenant branding, MFA, join flow
- `/setup-password` → New user password setup
- `/privacy` → Terms & Privacy Policy
- `/dashboard` → HomeModule (requires auth)
- `/dashboard/[module]` → Dynamic module routing (events, messages, profile, etc.)
- `/admin` → AdminDashboard (admin role)
- `/admin/super` → SuperAdminDashboard (super_admin only)
- `/admin/tenants` → TenantManagement
- `/admin/tenants/[tenantCode]/sso` → SSOConfiguration
- `/admin/users` → UserManagement
- `/admin/csv-upload` → CSV bulk import
- `/admin/privacy` → DataPrivacyDashboard
- `/admin/security` → SecurityAlerts
- `/admin/saml-simulator` → SAMLSimulator
- `/college-admin` → CollegeAdminDashboard
- `/college-admin/users` → CollegeUserManagement
- `/college-admin/modules` → ModuleSettings
- `/college-admin/services` → ServiceRequests
- `/college-admin/recognition` → RecognitionAdmin
- `/college-admin/events` → EventsAdmin
- `/college-admin/announcements` → AnnouncementsAdmin
- `/college-admin/wellbeing` → WellbeingAdmin
- `/college-admin/safety` → SafetySupportAdmin
- `/college-admin/cocurricular` → CoCurricularAdmin
- `/college-admin/messages` → MessageOverview
- `/college-admin/reports` → ReportsInsights
- `/college-admin/jobs` → CollegeJobsAdmin
- `/jobs` → Jobs board

## Tenant Theming System
- **Context**: `src/contexts/TenantThemeContext.js` — `TenantThemeProvider` wraps the app in root layout. Tenant code source: URL param (`?tenant=CODE`) or `NEXT_PUBLIC_TENANT_CODE` env var. Fetches live branding from `GET /api/branding/public/{code}` then injects CSS custom properties onto `:root`.
- **CSS variables**: Tailwind tokens (`--primary`, `--secondary`, `--background`, etc.) set as `hsl(var(--primary))`. All utility classes update automatically when variables change.
- **Static fallbacks**: `src/config/tenantThemes.js` — `PLATFORM_THEME` (Quadley blue `#2563EB`) and `TENANT_THEMES` (per-tenant defaults). Applied instantly before the API call.
- **Color utilities**: `src/utils/colorUtils.js` — `hexToHsl(hex)` converts live API hex values to HSL strings.

## Auth System
- **Context**: `src/contexts/AuthContext.js` — `AuthProvider` + `useAuth()` hook
- **JWT**: stored in `localStorage.token`, set on `axios.defaults.headers.common['Authorization']`
- **Auto-logout**: 401 interceptor clears token and user state
- **Auth guard**: `DashboardLayout` redirects to `/login` if no user

## Key Features
- Multi-tenant architecture (college/tenant isolation)
- JWT authentication with MFA support
- SAML SSO integration
- File uploads (resumes, co-curricular photos, logos)
- Real-time messaging
- Events, announcements, bookings
- Wellbeing tracking
- Job board
- Admin dashboards (college admin, super admin)
- GDPR compliance features
- OWASP security hardening
- GBV compliance (F2025L01251) — see below

## GBV Compliance (F2025L01251)
Full implementation of the National Higher Education Code to Prevent and Respond to GBV.

### Student Flow (`/dashboard/safe-disclosure` → `SafeDisclosureModule.js`)
- **Step 1**: Choice between Disclosure (support only) and Formal Complaint (investigation)
- Disclosure: support coordinator within 48h, no investigation without consent
- Formal Complaint: 45 business-day (63 calendar day) investigation clock starts immediately at submission
- Confirmation page with case reference number and plain-language "what happens next"
- **Student case tracker**: view own submissions with plain-language status and appeal option
- Appeals: students can appeal within 20 business days of resolution via `POST /api/safe-disclosures/{id}/appeal`

### Admin Case Management (`/admin/gbv` → `frontend-next/src/app/admin/gbv/page.js`)
- Full case list with filter tabs: All | Formal | Disclosure | Active | Overdue | Resolved
- **Overdue alert banner** when cases exceed 45-day deadline
- 45-day countdown badges (red if overdue, amber if <7 days)
- Case detail modal with 5 tabs: Case Details | Risk Assessment | Support Plan | Notes | Actions
- Action buttons driven by status: Complete Risk Assessment → Create Support Plan → Escalate to Formal → Resolve
- Internal case notes (admin audit trail)
- **Annual report / board submission**: generate CSV or PDF for governing board (Standard 6)
- Super admin sees per-college statistics overview (no individual case detail per user requirement)

### Backend Routes (`backend/routes/safe_disclosure.py`)
- `POST /` — create disclosure/formal complaint (report_type field, investigation_deadline set at submission for formal)
- `PUT /{id}/risk-assessment` — complete risk assessment (Standard 4.4)
- `PUT /{id}/support-plan` — create support plan (Standard 4.6)
- `PUT /{id}/formal-report` — admin escalation from disclosure to formal complaint
- `POST /{id}/escalate` — same, with reason field
- `POST /{id}/assign` — assign to named case worker
- `POST /{id}/notes` — add internal case note
- `POST /{id}/appeal` — student initiates appeal (20 business-day deadline)
- `PUT /{id}/resolve` — mark resolved
- `GET /overdue` — cases past or approaching 45-day deadline
- `GET /super-admin/stats` — cross-tenant statistics for super admin only
- `GET /annual-report/{year}/export/csv` and `/pdf` — board submission export

## User Role System
- **Super Admin** (`super_admin`) — MFA required, platform-wide access
- **Admin** (`admin`) — MFA required, college admin dashboard
- **RA** (`ra`) — MFA required, student modules + RA tools
- **Student** — No MFA, standard student modules

## Grace College Tenant
- Tenant code: `GRAC7421`
- DB: `quadley_tenant_grac7421`
- Branding: primary `#EF4444` (red), secondary `#6D28D9` (purple)
- iOS app: `com.gracecollege.app`, Apple ID 6759232709
- Test accounts: `admin@gracecollege.edu` / `Quadley2025!`; RA: `cgennifer@hotmail.com` / `GraceRA2025!`

## Deployment (Railway)
- **Backend**: `https://quadley-280126-production.up.railway.app`
- **Build**: `yarn install --frozen-lockfile && yarn build`
- **Start**: `yarn start` (Next.js server on PORT)
- Config: `frontend-next/railway.json`
