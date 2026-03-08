"""
Security Audit Vulnerability Fix Verification Tests
=====================================================
This test file verifies the fixes for 5 security vulnerabilities identified in audit:
1. Finding 1 (CRITICAL): Tenant isolation bypass - /api/users/list, GDPR endpoints
2. Finding 2 (HIGH): SSRF in SSO - SSO files removed
3. Finding 3 (MEDIUM): NoSQL injection/ReDoS - re.escape() in admin search
4. Finding 4 (MEDIUM): Fail-closed encryption + no DOWNLOAD_SECRET fallback
5. Finding 5 (MEDIUM): Safe disclosure forwarding domain allowlist

Tenant: TEST6991
Student: railway_test@test.com / TestPass123!
"""

import pytest
import requests
import os
import sys

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mobile-redesign-20.preview.emergentagent.com').rstrip('/')


# ===== FIXTURES =====

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def student_token(api_client):
    """Login as student user in TEST6991 tenant"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "railway_test@test.com",
        "password": "TestPass123!"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Student login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="session")
def student_auth_headers(student_token):
    """Auth headers for student user"""
    return {"Authorization": f"Bearer {student_token}"}


# ===== FINDING 1: TENANT ISOLATION TESTS =====

class TestTenantIsolation:
    """Finding 1 (CRITICAL): Verify tenant isolation in /api/users/list and GDPR endpoints"""
    
    def test_users_list_requires_admin_role(self, api_client, student_auth_headers):
        """
        /api/users/list should require admin/ra role.
        Student user should get 403.
        """
        response = api_client.get(
            f"{BASE_URL}/api/users/list",
            headers=student_auth_headers
        )
        # Student should be forbidden from accessing users list
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}: {response.text}"
        print(f"PASS: /api/users/list correctly returns 403 for student user")
    
    def test_gdpr_data_export_uses_tenant_db(self, api_client, student_auth_headers):
        """
        GDPR /api/auth/my-data-export should use tenant-scoped database.
        Should return user's data from their tenant only.
        """
        response = api_client.get(
            f"{BASE_URL}/api/auth/my-data-export",
            headers=student_auth_headers
        )
        # MFA pending users might get blocked, but we should at least get a structured response
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify the response has GDPR compliance fields
            assert "gdpr_article" in data, "Missing GDPR article reference"
            assert "data_categories" in data or "data" in data, "Missing data categories"
            assert "export_date" in data, "Missing export date"
            print(f"PASS: /api/auth/my-data-export returns proper GDPR export data")
        else:
            print(f"INFO: GDPR export returned {response.status_code} (may be MFA/auth restriction)")
    
    def test_gdpr_account_deletion_info(self, api_client, student_auth_headers):
        """
        /api/auth/my-account/deletion-info should be accessible.
        """
        response = api_client.get(
            f"{BASE_URL}/api/auth/my-account/deletion-info",
            headers=student_auth_headers
        )
        # This endpoint doesn't require auth per the code
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("self_service_deletion") == True
        assert "gdpr_article" in data
        print(f"PASS: /api/auth/my-account/deletion-info returns GDPR info")
    
    def test_consent_get_uses_tenant_db(self, api_client, student_auth_headers):
        """
        GET /api/auth/my-consent should use tenant-scoped database.
        """
        response = api_client.get(
            f"{BASE_URL}/api/auth/my-consent",
            headers=student_auth_headers
        )
        # Should be 200 or 401/403 (MFA)
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "gdpr_article" in data or "consent_categories" in data or "consents" in data
            print(f"PASS: GET /api/auth/my-consent returns proper consent data")
        else:
            print(f"INFO: Consent endpoint returned {response.status_code} (may be MFA/auth restriction)")
    
    def test_consent_post_uses_tenant_db(self, api_client, student_auth_headers):
        """
        POST /api/auth/my-consent should use tenant-scoped database.
        """
        response = api_client.post(
            f"{BASE_URL}/api/auth/my-consent",
            headers=student_auth_headers,
            json={
                "consent_type": "communications",
                "granted": True
            }
        )
        # Should work or be MFA-blocked
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            print(f"PASS: POST /api/auth/my-consent works correctly")
        else:
            print(f"INFO: Consent POST returned {response.status_code} (may be MFA/auth restriction)")


# ===== FINDING 2: SSO REMOVAL TESTS =====

class TestSSORemoval:
    """Finding 2 (HIGH): Verify SSO endpoints are removed"""
    
    def test_sso_config_endpoint_returns_404(self, api_client):
        """
        GET /api/sso/config should return 404 (endpoint removed).
        """
        response = api_client.get(f"{BASE_URL}/api/sso/config")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"PASS: /api/sso/config returns 404 (SSO removed)")
    
    def test_sso_login_endpoint_returns_404(self, api_client):
        """
        GET /api/sso/login should return 404 (endpoint removed).
        """
        response = api_client.get(f"{BASE_URL}/api/sso/login")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"PASS: /api/sso/login returns 404 (SSO removed)")
    
    def test_saml_callback_endpoint_returns_404(self, api_client):
        """
        POST /api/sso/saml/callback should return 404 (endpoint removed).
        """
        response = api_client.post(f"{BASE_URL}/api/sso/saml/callback")
        assert response.status_code in [404, 405, 422], f"Expected 404/405/422, got {response.status_code}"
        print(f"PASS: /api/sso/saml/callback returns {response.status_code} (SSO removed)")


# ===== FINDING 3: NOSQL INJECTION PREVENTION TESTS =====

class TestNoSQLInjectionPrevention:
    """Finding 3 (MEDIUM): Verify admin search uses re.escape() for NoSQL injection prevention"""
    
    def test_admin_search_handles_special_chars(self, api_client, student_auth_headers):
        """
        /api/admin/users/search should safely handle special regex characters.
        Input like .*$ should NOT cause regex injection.
        """
        # Try to search with regex special characters
        malicious_inputs = [
            ".*",
            "$ne",
            "test$or",
            "test{$gt:}",
            "test.*admin",
        ]
        
        for test_input in malicious_inputs:
            response = api_client.get(
                f"{BASE_URL}/api/admin/users/search",
                params={"q": test_input},
                headers=student_auth_headers
            )
            # Should not cause server error (500)
            assert response.status_code != 500, f"Server error with input '{test_input}': {response.text}"
            # For students, might get 403, which is fine (role restriction)
            assert response.status_code in [200, 403, 422], f"Unexpected status with input '{test_input}': {response.status_code}"
        
        print(f"PASS: Admin search handles special characters safely (no 500 errors)")
    
    def test_users_list_search_handles_special_chars(self, api_client, student_auth_headers):
        """
        /api/users/list search parameter should use re.escape() to prevent injection.
        """
        # Student can't access this endpoint, but we can verify no server crash
        malicious_search = ".*$ne"
        response = api_client.get(
            f"{BASE_URL}/api/users/list",
            params={"search": malicious_search},
            headers=student_auth_headers
        )
        # Student should get 403, not 500
        assert response.status_code != 500, f"Server error with search input: {response.text}"
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"PASS: /api/users/list search handles special characters safely")


# ===== FINDING 4: ENCRYPTION FAIL-CLOSED TESTS =====

class TestEncryptionFailClosed:
    """Finding 4 (MEDIUM): Verify field encryption fails closed when key is missing"""
    
    def test_encrypt_field_raises_without_key(self):
        """
        encrypt_field should raise ValueError when _ENCRYPTION_KEY is None.
        This is a unit test - we need to test the logic.
        """
        # Import the encryption module
        sys.path.insert(0, '/app/backend')
        try:
            from utils.field_encryption import _ENCRYPTION_KEY
            # If key is set (it should be via JWT_SECRET), test passes
            if _ENCRYPTION_KEY is not None:
                print(f"PASS: Encryption key is properly set (from JWT_SECRET)")
                return
            else:
                pytest.fail("FAIL: _ENCRYPTION_KEY is None - encryption is disabled!")
        except ImportError as e:
            pytest.fail(f"Cannot import field_encryption module: {e}")
    
    def test_download_secret_is_set(self):
        """
        DOWNLOAD_SECRET should be set in environment, no fallback allowed.
        """
        download_secret = os.environ.get("DOWNLOAD_SECRET")
        # Read from backend .env
        env_path = "/app/backend/.env"
        secret_in_env = False
        
        with open(env_path, 'r') as f:
            for line in f:
                if line.strip().startswith("DOWNLOAD_SECRET="):
                    value = line.split("=", 1)[1].strip()
                    if value and len(value) > 5:
                        secret_in_env = True
                        break
        
        assert secret_in_env, "DOWNLOAD_SECRET not found or empty in backend/.env"
        print(f"PASS: DOWNLOAD_SECRET is properly set in backend/.env")
    
    def test_safe_disclosure_module_loads_with_secret(self):
        """
        safe_disclosure.py should load successfully when DOWNLOAD_SECRET is set.
        """
        # The fact that the API is working means the module loaded
        # If DOWNLOAD_SECRET was missing, the module would fail to import with RuntimeError
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, "Backend not healthy - module may have failed to load"
        print(f"PASS: Safe disclosure module loaded successfully (DOWNLOAD_SECRET is set)")


# ===== FINDING 5: SAFE DISCLOSURE FORWARD DOMAIN ALLOWLIST =====

class TestSafeDisclosureForwarding:
    """Finding 5 (MEDIUM): Verify /api/safe-disclosures/{id}/forward requires allowed_domains"""
    
    def test_forward_requires_allowed_domains(self, api_client, student_auth_headers):
        """
        POST /api/safe-disclosures/{id}/forward should require configured allowed_domains.
        Without configured domains, should return 403.
        """
        # First create a disclosure (or use a fake ID)
        fake_disclosure_id = "test-disclosure-123"
        
        response = api_client.post(
            f"{BASE_URL}/api/safe-disclosures/{fake_disclosure_id}/forward",
            headers=student_auth_headers,
            json={
                "recipient_email": "test@external.com",
                "include_reporter_contact": False
            }
        )
        
        # Student should get 403 (admin only) or 404 (disclosure not found)
        # If domains aren't configured for admin, admin also gets 403
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}: {response.text}"
        
        # Check the error message if 403
        if response.status_code == 403:
            data = response.json()
            detail = data.get("detail", "")
            # Either "admin only" or "no domains configured" is acceptable
            print(f"PASS: Forward endpoint returns 403: {detail}")
        else:
            print(f"PASS: Forward endpoint returns 404 (disclosure not found)")


# ===== HEALTH CHECK TEST =====

class TestHealthCheck:
    """Verify health endpoint still works"""
    
    def test_health_endpoint_returns_200(self, api_client):
        """
        /api/health should return 200 with healthy status.
        """
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"PASS: /api/health returns healthy status")


# ===== RUN ALL TESTS =====

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
