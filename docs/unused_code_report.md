# Unused Code Report - Quadley Application

**Generated:** February 17, 2026  
**Analyzed:** Backend (Python/FastAPI) + Mobile (React Native/Expo)

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Unused Imports | 142 | Low |
| Stub/Placeholder Files | 2 | Medium |
| Duplicate Function Names | 8 | Low |
| Potentially Unused Utility Functions | 27 | Medium |
| Unused Model Imports in Routes | 23 files | Low |

---

## 1. Unused Imports (142 total)

These imports are defined but never used in the code. Can be auto-fixed with `ruff check --fix`.

### High-Priority Files (multiple unused imports):

| File | Unused Imports |
|------|----------------|
| `models.py` | `validator` from pydantic |
| `routes/auth.py` | `EmailStr`, `Token`, `LOGIN_ATTEMPTS_CACHE` |
| `routes/analytics.py` | `List` from typing |
| `utils/sso_integration.py` | `hmac`, `json`, `parse_qs`, `OneLogin_Saml2_Utils` |
| `utils/tenant.py` | `Optional`, `List` from typing |
| `utils/white_label.py` | `os` |
| `utils/security.py` | `User` model (line 110) |

### Routes with Unused `User` Import (23 files):
The following route files import `User` from models but don't directly use it (the model type comes via `get_tenant_db_for_user` tuple):

```
academics.py, ai_suggestions.py, announcements.py, birthdays.py, bookings.py,
cocurricular.py, date_config.py, delight.py, dining.py, events.py, finance.py,
houses.py, maintenance.py, messages.py, oweek.py, parcels.py, ra_applications.py,
safe_disclosure.py, security.py, student_reports.py, tutoring.py, wellbeing.py,
wellbeing_admin.py
```

**Recommendation:** Run `cd /app/backend && ruff check --fix .` to auto-remove unused imports.

---

## 2. Stub/Placeholder Files

### Backend Routes:

| File | Lines | Endpoints | Status |
|------|-------|-----------|--------|
| `routes/ai_suggestions.py` | 27 | 1 | **STUB** - Placeholder for AI suggestions feature |
| `routes/finance.py` | ~50 | 2 | **PARTIAL** - Bill model imported but unused |

**Recommendation:** Either implement these features or document as "Future Feature" and keep as placeholders.

---

## 3. Duplicate Function Names

Functions with the same name defined in multiple files (potential confusion/maintenance issue):

| Function Name | Occurrences | Files |
|---------------|-------------|-------|
| `sanitize_csv_value` | 3 | Multiple CSV-related utilities |
| `update_tenant` | 2 | multi_tenant.py, admin.py |
| `suspend_tenant` | 2 | multi_tenant.py, admin.py |
| `list_tenants` | 2 | multi_tenant.py, admin.py |
| `get_tenant` | 2 | multi_tenant.py, admin.py |
| `award_house_points` | 2 | houses.py locations |
| `_require_admin` | 2 | Different route files |

**Recommendation:** Consider consolidating these into shared utility functions.

---

## 4. Potentially Unused Utility Functions

These functions are defined but appear to have minimal usage (0-1 references outside their definition):

### utils/auth.py:
- `create_refresh_token()` - Only defined, not called

### utils/db_maintenance.py:
- `get_index_stats()`
- `cleanup_expired_data()`
- `optimize_collection()`

### utils/monitoring.py:
- `record_error()`
- `reset_metrics()`

### utils/profiling.py:
- `track_performance()`
- `profile_endpoint()`
- `memory_snapshot_task()`

### utils/admin_audit.py:
- `store_security_audit()`

### utils/tenant.py:
- `require_staff()`
- `get_tenant_filter()`
- `validate_resource_tenant()`

### utils/input_sanitization.py:
- `safe_search_query()`
- `validate_external_url()`
- `sanitize_filename()`
- `get_client_ip()`
- `sanitize_rich_html()`
- `sanitize_search_query()`

### utils/security.py:
- `get_password_requirements()`

### utils/session_manager.py:
- `create_session()`
- `update_session_activity()`
- `check_session_valid()`
- `cleanup_expired_sessions()`
- `verify_resource_ownership()`
- `cleanup_expired_tokens()`
- `cleanup_expired_reset_tokens()`

**Recommendation:** 
1. Review if these are called from scheduled tasks or background jobs
2. If truly unused, consider removing or marking as "reserved for future use"
3. Many appear to be utility functions for future features

---

## 5. Mobile App Unused Files

### Services:
| File | Status |
|------|--------|
| `services/integrityService.js` | **ACTUALLY USED** - Imported in App.js via `runIntegrityChecks` |

**Note:** The grep search may have missed dynamic imports. Manual verification shows this file IS used.

---

## 6. Test Files Analysis

**20 test files found** in `/app/backend/tests/`

These are valid test files and should be retained:
- `test_security_events_api.py`
- `test_privacy_dashboard.py`
- `test_ip_anomaly.py`
- `test_job_notifications.py`
- `test_saml_simulator.py`
- `test_tenant_isolation_security.py`
- `test_owasp_security.py`
- ... (and 13 more)

**Recommendation:** Keep all test files. Consider running them periodically for regression testing.

---

## 7. Cleanup Commands

### Auto-fix unused imports:
```bash
cd /app/backend
ruff check --fix .
```

### View all issues without fixing:
```bash
cd /app/backend
ruff check --select F401,F841 .
```

### Remove unused imports in specific file:
```bash
ruff check --fix --select F401 routes/auth.py
```

---

## 8. Estimated Impact

| Action | Effort | Lines Removed | Risk |
|--------|--------|---------------|------|
| Auto-fix unused imports | 1 min | ~200 lines | Very Low |
| Remove stub files | 5 min | ~80 lines | Low (feature removal) |
| Consolidate duplicate functions | 30 min | ~100 lines | Medium |
| Remove unused utility functions | 1 hour | ~500 lines | Medium (verify no scheduled jobs use them) |

---

## 9. Recommendations Summary

### Immediate (Low Risk):
1. ✅ Run `ruff check --fix .` to remove unused imports
2. ✅ Remove `User` import from routes that don't need it directly

### Short-term (Medium Risk):
1. Decide on `ai_suggestions.py` - implement or document as future
2. Complete `finance.py` implementation or remove
3. Review utility functions for scheduled job usage

### Long-term:
1. Set up pre-commit hooks to catch unused imports
2. Add lint checks to CI/CD pipeline
3. Regular code review for dead code

---

*Report generated by code analysis tools: ruff, grep, find*
