"""
Penetration Test Security Fixes - Comprehensive Testing
=========================================================
Tests for GDPR/ISO 27001 compliance security fixes:
- Public compliance endpoints (no auth required)
- XSS prevention (sanitization middleware)
- Security headers (HSTS with preload, X-XSS-Protection, CSP, etc.)
- RBAC enforcement
- Data erasure and portability
- Consent recording
"""
import pytest
import requests
import os
import uuid
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - use sparingly due to rate limits
ADMIN_EMAIL = "gen@quadley.com"
ADMIN_PASSWORD = "Quadley2025!"

# Reuse existing test users if rate limited
EXISTING_XSS_USERS = [
    ("xsstest@test.com", "XssTest123!"),
    ("xss2test@test.com", "XssTest123!"),
    ("xss3test@test.com", "XssTest123!"),
]


class TestPublicComplianceEndpoints:
    """
    Test all PUBLIC compliance endpoints that require NO authentication.
    These endpoints are needed for automated security scanners to verify compliance.
    """
    
    def test_compliance_status_returns_200_no_auth(self):
        """GET /api/compliance/status should return 200 with encryption, auth, data rights info"""
        response = requests.get(f"{BASE_URL}/api/compliance/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "encryption" in data, "Missing encryption info"
        assert "authentication" in data, "Missing authentication info"
        assert "data_subject_rights" in data, "Missing data subject rights"
        
        # Verify encryption details
        assert data["encryption"]["at_rest"]["enabled"] == True
        assert data["encryption"]["in_transit"]["enabled"] == True
        
        print(f"✓ GET /api/compliance/status returns 200 with complete compliance info")
    
    def test_encryption_status_returns_200_no_auth(self):
        """GET /api/compliance/encryption-status should return 200 with encryption_at_rest.enabled=true"""
        response = requests.get(f"{BASE_URL}/api/compliance/encryption-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "encryption_at_rest" in data
        assert data["encryption_at_rest"]["enabled"] == True
        assert data["encryption_at_rest"]["algorithm"] == "AES-256"
        
        print(f"✓ GET /api/compliance/encryption-status returns 200 with encryption_at_rest.enabled=true")
    
    def test_token_security_returns_200_no_auth(self):
        """GET /api/compliance/token-security should return 200 with algorithm and secret_strength"""
        response = requests.get(f"{BASE_URL}/api/compliance/token-security")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("algorithm") == "HS256"
        assert data.get("secret_strength") == "strong"
        assert data.get("token_type") == "JWT"
        
        print(f"✓ GET /api/compliance/token-security returns 200 with algorithm=HS256, secret_strength=strong")
    
    def test_rbac_verify_returns_200_no_auth(self):
        """GET /api/compliance/rbac-verify should return 200 with rbac_enabled=true"""
        response = requests.get(f"{BASE_URL}/api/compliance/rbac-verify")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("rbac_enabled") == True
        assert "protected_endpoints" in data
        assert len(data["protected_endpoints"]) > 0
        
        print(f"✓ GET /api/compliance/rbac-verify returns 200 with rbac_enabled=true")
    
    def test_pii_inventory_returns_200_no_auth(self):
        """GET /api/compliance/pii-inventory should return 200 with ropa_compliant=true"""
        response = requests.get(f"{BASE_URL}/api/compliance/pii-inventory")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("ropa_compliant") == True
        assert "collections" in data
        assert "users" in data["collections"]
        
        print(f"✓ GET /api/compliance/pii-inventory returns 200 with ropa_compliant=true")
    
    def test_consent_mechanism_returns_200_no_auth(self):
        """GET /api/compliance/consent-mechanism should return 200 with consent_tracking=true"""
        response = requests.get(f"{BASE_URL}/api/compliance/consent-mechanism")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("consent_tracking") == True
        assert data.get("explicit_consent") == True
        assert data.get("gdpr_article_7_compliant") == True
        
        print(f"✓ GET /api/compliance/consent-mechanism returns 200 with consent_tracking=true")
    
    def test_data_masking_policy_returns_200_no_auth(self):
        """GET /api/compliance/data-masking-policy should return 200 with masking_enabled=true"""
        response = requests.get(f"{BASE_URL}/api/compliance/data-masking-policy")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("masking_enabled") == True
        assert "masked_fields" in data
        
        print(f"✓ GET /api/compliance/data-masking-policy returns 200 with masking_enabled=true")
    
    def test_session_policy_returns_200_no_auth(self):
        """GET /api/compliance/session-policy should return 200 with session_management=true"""
        response = requests.get(f"{BASE_URL}/api/compliance/session-policy")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("session_management") == True
        assert "token_expiration_minutes" in data
        
        print(f"✓ GET /api/compliance/session-policy returns 200 with session_management=true")
    
    def test_audit_policy_returns_200_no_auth(self):
        """GET /api/compliance/audit-policy should return 200"""
        response = requests.get(f"{BASE_URL}/api/compliance/audit-policy")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("audit_logging_enabled") == True
        assert "logged_events" in data
        assert len(data["logged_events"]) > 0
        
        print(f"✓ GET /api/compliance/audit-policy returns 200 with audit_logging_enabled=true")
    
    def test_privacy_notice_returns_200_no_auth(self):
        """GET /api/compliance/privacy-notice should return 200 with version='1.1'"""
        response = requests.get(f"{BASE_URL}/api/compliance/privacy-notice")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("version") == "1.1"
        assert "terms_of_service" in data
        assert "privacy_policy" in data
        assert "data_rights" in data
        
        print(f"✓ GET /api/compliance/privacy-notice returns 200 with version='1.1'")


class TestSecurityHeaders:
    """
    Test that all API responses include proper security headers.
    """
    
    def test_hsts_with_preload(self):
        """All API responses should include Strict-Transport-Security with preload"""
        response = requests.get(f"{BASE_URL}/api/compliance/status")
        
        hsts = response.headers.get("Strict-Transport-Security", "")
        assert "max-age=" in hsts, f"Missing HSTS max-age: {hsts}"
        assert "includeSubDomains" in hsts, f"Missing includeSubDomains: {hsts}"
        assert "preload" in hsts, f"Missing preload directive: {hsts}"
        
        # Verify max-age is at least 1 year (31536000)
        if "max-age=" in hsts:
            import re
            match = re.search(r'max-age=(\d+)', hsts)
            if match:
                max_age = int(match.group(1))
                assert max_age >= 31536000, f"HSTS max-age too low: {max_age}"
        
        print(f"✓ HSTS header includes preload: {hsts}")
    
    def test_xss_protection_header(self):
        """All API responses should include X-XSS-Protection header"""
        response = requests.get(f"{BASE_URL}/api/compliance/status")
        
        xss_protection = response.headers.get("X-XSS-Protection", "")
        assert xss_protection, "Missing X-XSS-Protection header"
        assert "1" in xss_protection, f"X-XSS-Protection not enabled: {xss_protection}"
        
        print(f"✓ X-XSS-Protection header present: {xss_protection}")
    
    def test_content_type_options_header(self):
        """All API responses should include X-Content-Type-Options: nosniff"""
        response = requests.get(f"{BASE_URL}/api/compliance/status")
        
        cto = response.headers.get("X-Content-Type-Options", "")
        assert cto == "nosniff", f"Missing or wrong X-Content-Type-Options: {cto}"
        
        print(f"✓ X-Content-Type-Options header: {cto}")
    
    def test_frame_options_header(self):
        """All API responses should include X-Frame-Options"""
        response = requests.get(f"{BASE_URL}/api/compliance/status")
        
        xfo = response.headers.get("X-Frame-Options", "")
        assert xfo in ["DENY", "SAMEORIGIN"], f"Missing or wrong X-Frame-Options: {xfo}"
        
        print(f"✓ X-Frame-Options header: {xfo}")
    
    def test_content_security_policy_header(self):
        """All API responses should include Content-Security-Policy"""
        response = requests.get(f"{BASE_URL}/api/compliance/status")
        
        csp = response.headers.get("Content-Security-Policy", "")
        assert csp, "Missing Content-Security-Policy header"
        assert "default-src" in csp, f"CSP missing default-src: {csp}"
        
        print(f"✓ Content-Security-Policy header present")
    
    def test_referrer_policy_header(self):
        """All API responses should include Referrer-Policy"""
        response = requests.get(f"{BASE_URL}/api/compliance/status")
        
        rp = response.headers.get("Referrer-Policy", "")
        assert rp, "Missing Referrer-Policy header"
        
        print(f"✓ Referrer-Policy header: {rp}")
    
    def test_permissions_policy_header(self):
        """All API responses should include Permissions-Policy"""
        response = requests.get(f"{BASE_URL}/api/compliance/status")
        
        pp = response.headers.get("Permissions-Policy", "")
        assert pp, "Missing Permissions-Policy header"
        
        print(f"✓ Permissions-Policy header: {pp}")


class TestXSSPrevention:
    """
    Test XSS prevention through input sanitization.
    Uses the global XSS sanitization middleware.
    """
    
    def test_register_sanitizes_script_tag(self):
        """POST /api/auth/register with script tag in first_name should store sanitized value"""
        unique_id = str(uuid.uuid4())[:8]
        xss_payload = "<script>alert(1)</script>"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"xss_script_test_{unique_id}@test.com",
                "password": "TestPass123!",
                "first_name": xss_payload,
                "last_name": "Normal",
                "role": "student"
            }
        )
        
        # May be rate limited
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping XSS test")
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        user = data.get("user", {})
        
        first_name = user.get("first_name", "")
        assert "<script>" not in first_name, f"Script tag not stripped: {first_name}"
        assert "</script>" not in first_name, f"Script closing tag not stripped: {first_name}"
        
        print(f"✓ XSS: <script>alert(1)</script> sanitized to: '{first_name}'")
    
    def test_register_sanitizes_img_onerror(self):
        """POST /api/auth/register with img onerror XSS should store sanitized value"""
        unique_id = str(uuid.uuid4())[:8]
        xss_payload = '<img src=x onerror=alert(1)>'
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"xss_img_test_{unique_id}@test.com",
                "password": "TestPass123!",
                "first_name": xss_payload,
                "last_name": "Normal",
                "role": "student"
            }
        )
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping XSS test")
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        user = data.get("user", {})
        
        first_name = user.get("first_name", "")
        assert "<img" not in first_name.lower(), f"IMG tag not stripped: {first_name}"
        assert "onerror" not in first_name.lower(), f"onerror not stripped: {first_name}"
        
        print(f"✓ XSS: <img src=x onerror=alert(1)> sanitized to: '{first_name}'")
    
    def test_update_me_sanitizes_xss(self):
        """PATCH /api/auth/me should sanitize XSS in first_name"""
        # Try to use existing test user or create new one
        token = None
        for email, password in EXISTING_XSS_USERS:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email, "password": password}
            )
            if response.status_code == 200:
                token = response.json().get("access_token")
                break
        
        if not token:
            # Create a new test user
            unique_id = str(uuid.uuid4())[:8]
            reg_response = requests.post(
                f"{BASE_URL}/api/auth/register",
                json={
                    "email": f"xss_update_test_{unique_id}@test.com",
                    "password": "TestPass123!",
                    "first_name": "Test",
                    "last_name": "User",
                    "role": "student"
                }
            )
            if reg_response.status_code == 429:
                pytest.skip("Rate limited - skipping update XSS test")
            assert reg_response.status_code == 200
            token = reg_response.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        xss_payload = '<img src=x onerror=alert(1)>'
        
        # Update profile with XSS payload
        update_response = requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=headers,
            json={"first_name": xss_payload}
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify by fetching the profile
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200
        
        user_data = me_response.json()
        first_name = user_data.get("first_name", "")
        assert "<img" not in first_name.lower(), f"IMG tag not sanitized in update: {first_name}"
        
        print(f"✓ XSS: PATCH /api/auth/me sanitizes XSS. Result: '{first_name}'")


class TestRBACEnforcement:
    """
    Test RBAC enforcement - students should not access admin endpoints.
    """
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get a student token, using existing test user if available"""
        # Try existing test users first
        for email, password in EXISTING_XSS_USERS:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email, "password": password}
            )
            if response.status_code == 200:
                return response.json().get("access_token")
        
        # Create a new test user
        unique_id = str(uuid.uuid4())[:8]
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"rbac_test_student_{unique_id}@test.com",
                "password": "TestPass123!",
                "first_name": "RBAC",
                "last_name": "Test",
                "role": "student"
            }
        )
        if reg_response.status_code == 200:
            return reg_response.json().get("access_token")
        pytest.skip("Could not get student token for RBAC tests")
    
    def test_admin_users_returns_403_for_student(self, student_token):
        """GET /api/admin/users with student token should return 403"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ RBAC: GET /api/admin/users returns 403 for student")
    
    def test_users_list_returns_403_for_student(self, student_token):
        """GET /api/users/list with student token should return 403"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/users/list", headers=headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ RBAC: GET /api/users/list returns 403 for student")


class TestAuthenticatedComplianceFeatures:
    """
    Test authenticated compliance features: consent, export, deletion.
    """
    
    @pytest.fixture(scope="class")
    def auth_user(self):
        """Get an authenticated user for testing"""
        # Try existing test users first
        for email, password in EXISTING_XSS_USERS:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email, "password": password}
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "token": data.get("access_token"),
                    "headers": {"Authorization": f"Bearer {data.get('access_token')}", "Content-Type": "application/json"},
                    "email": email
                }
        
        # Create new user if needed
        unique_id = str(uuid.uuid4())[:8]
        email = f"compliance_test_{unique_id}@test.com"
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "TestPass123!",
                "first_name": "Compliance",
                "last_name": "Test",
                "role": "student"
            }
        )
        if reg_response.status_code == 200:
            data = reg_response.json()
            return {
                "token": data.get("access_token"),
                "headers": {"Authorization": f"Bearer {data.get('access_token')}", "Content-Type": "application/json"},
                "email": email
            }
        pytest.skip("Could not create test user for compliance tests")
    
    def test_consent_recording(self, auth_user):
        """POST /api/compliance/consent should record consent with timestamp and IP"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/consent",
            headers=auth_user["headers"],
            json={
                "consent_type": "terms_of_service",
                "granted": True,
                "version": "1.0"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "consent_id" in data, "Missing consent_id"
        assert "timestamp" in data, "Missing timestamp"
        assert data.get("granted") == True
        
        print(f"✓ POST /api/compliance/consent records consent with ID and timestamp")
    
    def test_data_export(self, auth_user):
        """GET /api/compliance/export-my-data should return profile data and consent records"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/export-my-data",
            headers=auth_user["headers"]
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "export_format" in data
        assert "data" in data
        assert "profile" in data["data"]
        assert "consent_records" in data["data"]
        
        print(f"✓ GET /api/compliance/export-my-data returns profile and consent records")
    
    def test_account_deletion_requires_confirm(self, auth_user):
        """POST /api/compliance/delete-my-account without confirm=true should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/delete-my-account",
            headers=auth_user["headers"],
            json={"confirm": False}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/compliance/delete-my-account returns 400 without confirm=true")
    
    def test_account_deletion_with_confirm(self):
        """POST /api/compliance/delete-my-account with confirm=true should deactivate and anonymize"""
        # Create a fresh user specifically for deletion testing
        unique_id = str(uuid.uuid4())[:8]
        email = f"delete_test_{unique_id}@test.com"
        
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "TestPass123!",
                "first_name": "Delete",
                "last_name": "Test",
                "role": "student"
            }
        )
        
        if reg_response.status_code == 429:
            pytest.skip("Rate limited - skipping deletion test")
        
        if reg_response.status_code != 200:
            pytest.skip(f"Could not create user for deletion test: {reg_response.text}")
        
        token = reg_response.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Delete with confirm=true
        response = requests.post(
            f"{BASE_URL}/api/compliance/delete-my-account",
            headers=headers,
            json={"confirm": True, "reason": "Testing deletion flow"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "request_id" in data, "Missing request_id"
        assert data.get("data_anonymized") == True, "Data should be anonymized"
        assert data.get("account_deactivated") == True, "Account should be deactivated"
        
        print(f"✓ POST /api/compliance/delete-my-account with confirm=true anonymizes data")


# Run all tests when executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
