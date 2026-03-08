# Security Configuration & Known Issues

## OWASP Top 10 Compliance Status

### A01 - Broken Access Control ✅
- Role-based access control implemented on all sensitive endpoints
- Ownership checks on user-scoped resources (messages, late meals, etc.)
- Admin-only endpoints verify role before processing

### A02 - Cryptographic Failures ✅
- bcrypt (passlib) for password hashing
- JWT with proper expiration and signing
- httpOnly cookies for token storage (primary mechanism)
- **FIXED**: Removed password reset link logging
- **Mobile**: Uses expo-secure-store for encrypted token storage ✅
- **Web**: localStorage fallback exists for cross-origin scenarios
  - Primary: httpOnly cookie (automatic, secure)
  - Fallback: localStorage (for direct API access from components)
  - Note: In strict environments, consider removing localStorage fallback

### A03 - Injection ✅
- MongoDB parameterized queries (no raw string concatenation)
- bleach sanitization for HTML content
- Safe filename generation for uploads
- Magic byte validation for file uploads

### A04 - Insecure Design ✅
- Rate limiting implemented (Redis-compatible with in-memory fallback)
- Account lockout implemented (database-backed)
- **IMPLEMENTED**: CAPTCHA system for public endpoints (`/api/captcha/*`)
  - Math CAPTCHA (built-in) - no external dependencies
  - hCaptcha support (optional) - set `HCAPTCHA_SECRET` and `HCAPTCHA_SITEKEY`
  - reCAPTCHA v3 support (optional) - set `RECAPTCHA_SECRET` and `RECAPTCHA_SITEKEY`
- **IMPLEMENTED**: Redis-compatible caching (`/app/backend/utils/redis_cache.py`)
  - Set `REDIS_URL` environment variable for distributed deployments
  - Automatic fallback to in-memory when Redis unavailable

### A05 - Security Misconfiguration ✅
- CSP headers configured
- **FIXED**: Moved upload paths to environment variables
- Debug mode controlled via environment

### A06 - Vulnerable Components ⚠️
- Known vulnerability: ecdsa 0.19.1 (CVE-2024-23342) - no fix available yet
- **TODO**: Monitor for updates and patch when available
- **TODO**: Add SCA to CI pipeline

### A07 - Authentication Failures ✅
- JWT + httpOnly cookies
- bcrypt password hashing
- **IMPLEMENTED**: MFA for admin roles (`/api/mfa/*`)
  - TOTP-based (Google Authenticator, Authy compatible)
  - QR code generation for easy setup
  - 10 backup codes generated per user
  - Endpoints: `/api/mfa/setup`, `/api/mfa/verify`, `/api/mfa/disable`
- **IMPLEMENTED**: Mandatory MFA for admin/super_admin roles
  - Login response includes `mfa_required`, `mfa_enabled`, `mfa_setup_required` flags
  - Admins without MFA are prompted to set up on login
  - MFA verification endpoint: `/api/auth/login/mfa`

### A08 - Software Integrity ✅
- No unsafe pickle/YAML loaders
- Pinned dependency versions

### A09 - Logging & Monitoring ✅
- Security event logging implemented
- Audit middleware for mutations
- **FIXED**: Removed sensitive data from logs
- **ADDED**: MFA event logging (setup, enable, disable, backup code usage)

### A10 - SSRF ✅
- URL validation blocks private IPs
- Metadata endpoint blocking (169.254.169.254)
- Allowlist option for strict mode

## Production Deployment Checklist

1. [x] Set `DEBUG=false` in environment
2. [x] Use Redis for rate limiting and token blacklist (optional, set `REDIS_URL`)
3. [x] Configure secure email service for password resets (set `RESEND_API_KEY`)
4. [x] Enable HTTPS only (handled by infrastructure)
5. [x] Set strong `JWT_SECRET` (min 32 chars)
6. [ ] Configure CSP without `unsafe-eval` (React dependency)
7. [ ] Set up log forwarding and alerting
8. [x] Run `pip-audit` and `npm audit` before deploy (script at `/app/scripts/security_audit.sh`)
9. [x] Enable MFA for admin accounts (MANDATORY - enforced at login)
10. [x] CAPTCHA available for public forms (math CAPTCHA built-in, set up hCaptcha for production)

## Environment Variables

```
# Security
JWT_SECRET=<min 32 character secret>
DEBUG=false

# File uploads
UPLOAD_DIR=/app/backend/uploads
MAX_UPLOAD_SIZE=5242880

# Rate limiting & Caching (optional - uses in-memory if not set)
REDIS_URL=redis://localhost:6379

# Email Service (Resend)
RESEND_API_KEY=re_your_api_key_here
SENDER_EMAIL=noreply@quadley.app
FRONTEND_URL=https://your-domain.com

# CAPTCHA (optional - uses math CAPTCHA if not set)
HCAPTCHA_SECRET=<your hcaptcha secret>
HCAPTCHA_SITEKEY=<your hcaptcha sitekey>
# OR
RECAPTCHA_SECRET=<your recaptcha secret>
RECAPTCHA_SITEKEY=<your recaptcha sitekey>
```

## New API Endpoints

### MFA (`/api/mfa/*`)
- `GET /api/mfa/status` - Get MFA status for current user
- `POST /api/mfa/setup` - Start MFA setup (returns QR code and backup codes)
- `POST /api/mfa/verify` - Verify TOTP code and enable MFA
- `POST /api/mfa/disable` - Disable MFA (requires valid TOTP code)
- `POST /api/mfa/regenerate-backup-codes` - Generate new backup codes
- `POST /api/mfa/verify-code` - Verify TOTP code for sensitive operations
- `POST /api/mfa/verify-backup-code` - Use a backup code

### CAPTCHA (`/api/captcha/*`)
- `GET /api/captcha/config` - Get CAPTCHA configuration for frontend
- `GET /api/captcha/challenge` - Get a new math CAPTCHA challenge
- `POST /api/captcha/verify` - Verify CAPTCHA response

### Notifications (`/api/notifications/*`)
- `GET /api/notifications` - Get paginated notification history
- `GET /api/notifications/unread-count` - Get unread notification count
- `POST /api/notifications/{id}/read` - Mark notification as read
- `POST /api/notifications/read-all` - Mark all notifications as read
- `DELETE /api/notifications/{id}` - Delete a notification
- `DELETE /api/notifications` - Clear all notifications (optional: older_than_days param)

### Auth MFA Extension (`/api/auth/*`)
- `POST /api/auth/login/mfa` - Complete login with MFA verification (for users with MFA enabled)

## Mobile App Security

- Token storage: Using `expo-secure-store` (iOS Keychain, Android Keystore) ✅
- AsyncStorage used only for non-sensitive data (read status, preferences)
- Tenant data in AsyncStorage is acceptable (non-sensitive metadata)

## Security Audit Response (January 2026)

### Issue Status Summary

| Issue | Status | Notes |
|-------|--------|-------|
| Password reset tokens logged | ✅ VERIFIED FIXED | Line 490-491 shows explicit "Never log" comment |
| localStorage token storage (Web) | ⚠️ DOCUMENTED | Fallback for cross-origin, httpOnly cookie is primary |
| AsyncStorage token storage (Mobile) | ✅ FIXED | Uses expo-secure-store for auth tokens |
| Rate limiting in-memory | ⚠️ DOCUMENTED | DB-backed lockout protects against brute force |
| Token blacklist in-memory | ✅ DB-BACKED | Uses MongoDB with in-memory cache |
| No MFA for privileged users | ✅ IMPLEMENTED | Mandatory for admin/super_admin roles |
| No dependency scanning | ⚠️ DOCUMENTED | Recommend Dependabot/Snyk in CI |
| CAPTCHA on auth endpoints | ✅ IMPLEMENTED | Math CAPTCHA built-in, hCaptcha optional |

### Rate Limiting Architecture

```
Request Flow:
1. slowapi rate limiter (in-memory, per-instance)
   - Configurable: 5/min for login, 3/min for registration
   
2. Database-backed account lockout (persistent, distributed-safe)
   - 5 failed attempts → 15 minute lockout
   - Survives restarts
   - Works across multiple instances
   
3. Redis upgrade path available (set REDIS_URL for both)
```

### Web Token Storage Rationale

The web frontend uses a dual approach:
1. **Primary**: httpOnly cookies (set by server, XSS-resistant)
2. **Fallback**: localStorage (for components needing direct API access)

To remove localStorage fallback (strict mode):
1. All API calls must go through axios with cookie credentials
2. Remove `localStorage.setItem("token", ...)` from App.js
3. Ensure all cross-origin scenarios use proper CORS

### Recommendations for Production

1. **Enable Redis** (`REDIS_URL`) for distributed rate limiting
2. **Enable hCaptcha** for production (more secure than math CAPTCHA)
3. **Add dependency scanning** to CI pipeline
4. **Monitor** ecdsa CVE-2024-23342 for patch
5. **Consider** removing localStorage fallback if not needed

---

## Security Enhancements (January 31, 2026)

The following security features were implemented:

### 1. Session Management (`/api/sessions`)
- **GET /api/sessions** - View all active sessions across devices
- **POST /api/sessions/revoke** - Logout a specific device
- **POST /api/sessions/revoke-all** - Logout all devices ("logout everywhere")
- **GET /api/sessions/security-check** - Detect login anomalies (new IP/device)

### 2. Admin Audit Dashboard (`/api/audit`)
- **GET /api/audit** - Query audit log with filters (admin, action type, date range)
- **GET /api/audit/summary** - Activity statistics and high-severity alerts
- **GET /api/audit/action-types** - List of auditable action types
- **GET /api/audit/my-activity** - Admin's own activity history
- **GET /api/audit/high-severity** - Recent high-risk actions

### 3. Sensitive Data Encryption
- Field-level encryption for PII (phone, emergency contacts)
- Uses Fernet (AES-256) with key derived from SECRET_KEY
- Utility: `/app/backend/utils/field_encryption.py`

### 4. API Request Signing
- HMAC-SHA256 request signing for mobile apps
- Prevents request tampering and replay attacks
- 5-minute request window, nonce-based replay protection
- Utility: `/app/backend/utils/request_signing.py`

### 5. IP-Based Anomaly Detection
- Detects logins from new IP addresses
- Detects logins from new device types
- Integrated into session management

### 6. Password Breach Check
- Integrates with HaveIBeenPwned API
- Uses k-anonymity (only first 5 chars of hash sent)
- Blocks passwords with >10,000 known breaches
- Utility: `/app/backend/utils/password_breach.py`

### 7. Webhook Signature Verification
- Stripe webhook signature verification
- SendGrid webhook signature verification
- Generic HMAC verification utility
- Utility: `/app/backend/utils/webhook_verification.py`

### 8. Enhanced Security Headers
- Expanded Permissions-Policy (25+ features disabled)
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-origin
- HSTS with preload directive
- Optional strict CSP mode (`STRICT_CSP=true`)

### 9. Encrypted Data Export
- Password-protected exports (AES-256)
- Supports CSV, JSON, and ZIP formats
- Auto-generates secure 16-char passwords
- Utility: `/app/backend/utils/encrypted_export.py`

### 10. Automatic Session Timeout
- Sessions track `last_active` timestamp
- 7-day absolute expiration
- Configurable idle timeout

### 11. Database Query Logging
- Audit logging for all admin actions
- Sensitive data automatically redacted
- Severity levels (normal, high)

### 12. Content Security Policy Tightening
- Production: strict CSP available
- Development: relaxed CSP for React
- Set `STRICT_CSP=true` for production hardening

---

## New Environment Variables

```env
# Security Features
STRICT_CSP=false                    # Enable strict Content-Security-Policy
API_SIGNING_SECRET=<secret>         # For mobile request signing
STRIPE_WEBHOOK_SECRET=<secret>      # Stripe webhook verification
SENDGRID_WEBHOOK_KEY=<key>          # SendGrid webhook verification
```
