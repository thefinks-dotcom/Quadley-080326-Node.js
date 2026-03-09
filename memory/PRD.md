# Quadley - Multi-Tenant College Community Platform

## Original Problem Statement
Build a secure, multi-tenant mobile + web platform for residential colleges. Key goals:
- Fix all penetration test findings
- Build and deploy iOS/Android apps via EAS
- Complete UI/UX redesign to "Swiss Technical / Academic Brutalism" aesthetic

## Architecture
- **Backend:** FastAPI + MongoDB (multi-tenant)
- **Frontend (Web):** React + Tailwind CSS
- **Mobile:** React Native (Expo) with EAS builds
- **Database:** MongoDB Atlas with per-tenant databases (quadley_tenant_{code})

## What's Been Implemented

### Completed (Feb 26, 2026)

- [x] **Dark Mode Removed (Feb 26, 2026)**:
  - Mobile: Simplified `ThemeContext.js` to always return light colors. Removed Appearance/theme toggle section from `SettingsScreen.js`.
  - Web: Removed dark mode theme picker, "Enable Dark Mode" toggle, and "Dark Mode Logo URL" field from `BrandingPreviewPanel.jsx`.
  - `darkColors` export in `theme.js` retained but unused — no imports reference it.

- [x] **Security Audit Remediation — 5 Findings Fixed (Feb 26, 2026)**:
  - **A01 CRITICAL: Tenant Isolation Bypass** — Refactored `server.py` to remove ALL global `db` usage for tenant-specific data. Endpoints `/api/users/list`, `/api/auth/my-data-export`, `/api/auth/my-account`, `/api/auth/my-consent` now use `get_tenant_db(tenant_code)` from JWT. `get_current_user` in server.py also made tenant-aware. Fails closed (403) when no tenant context.
  - **A10 HIGH: SSRF in SSO** — Removed SSO feature entirely: deleted `routes/sso.py`, `utils/sso_integration.py`, `routes/saml_simulator.py`, and all imports/registrations from `server.py`.
  - **A03 MEDIUM: NoSQL Injection/ReDoS** — Already mitigated with `re.escape()` in both `admin.py` and `server.py` search endpoints. Verified.
  - **A02 MEDIUM: Cryptographic Failures** — `field_encryption.py` now fails closed (raises `ValueError` when encryption key is missing instead of silently returning plaintext). `safe_disclosure.py` raises `RuntimeError` on startup if `DOWNLOAD_SECRET` env var is missing (no hardcoded fallback).
  - **A04 MEDIUM: Insecure Design (Email Forwarding)** — Safe disclosure forwarding now requires explicit `allowed_domains` configuration. Returns 403 if no domains configured, preventing arbitrary email forwarding.
  - All 15 tests PASSED (iteration_48.json)

- [x] **iPad 2FA Button Fix (P0)**:
  - Fixed unresponsive "Set Up 2FA" button on iPad Air (M3) / iPadOS 26.3

- [x] **Secondary Branding Color Theming (P2)**

- [x] **PEN Test Remediation Round 1 (Feb 26, 2026)**:
  - NoSQL injection, JWT TTL, endpoint protection, server banner stripping

- [x] **PEN Test Remediation Round 2 — GDPR & ISO Compliance (Feb 26, 2026)**:
  - Auth bypass fixes (3 vectors), encryption at rest, password complexity, GDPR endpoints

### Completed (Feb 25, 2026)
- [x] Recognition Feature Enhancement (P0)
- [x] Floor Events Bug Fix Verified (P1)

### Completed (Feb 24, 2026)
- [x] Mobile app Swiss Technical redesign
- [x] Web app Swiss Technical redesign
- [x] Android/iOS deployment via EAS

### Key API Endpoints
- `GET /api/recognition/participants` — List/search all tenant users for recognition picker
- `POST /api/shoutouts` — Create shoutout with optional recipient_id for notifications
- `GET /api/shoutouts` — List shoutouts
- `POST /api/floor-events` — Create floor event (RA/admin only)
- `GET /api/floor-events` — List floor events for user's floor

### Test Credentials (TEST6991 Tenant)
- Admin: changed@example.com / TestAdmin1!
- Student: railway_test@test.com / TestPass123!
- RA: cgennifer@hotmail.com

## Remaining / Backlog
- [ ] (P1) Verify PEN test score with new scan
- [ ] (P2) Revert temporary rate limit increases to secure defaults
- [ ] (P2) Super Admin email template UI
- [ ] (P2) Scheduled daily auto-reminders
- [ ] (P2) Tenant-level configuration for module names
- [ ] (P3) Refactor server.py into smaller modules
