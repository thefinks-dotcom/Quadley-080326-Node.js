"""
SAML SSO Integration API Tests
==============================
Tests for SAML SSO endpoints including:
- SSO provider listing
- SAML SP metadata generation
- SAML SSO configuration (CRUD)
- SAML login initiation
- SAML ACS endpoint (graceful error handling)
- SAML SLO endpoint
- Authorization enforcement
- OAuth regression tests
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials (from agent context)
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_ADMIN_EMAIL = "admin@ormond.com"
TENANT_ADMIN_PASSWORD = "Quadley2025!"
STUDENT_EMAIL = "student2@ormond.com"
STUDENT_PASSWORD = "Quadley2025!"
TENANT_CODE = "ORMD0001"  # Uppercase tenant code
TENANT_CODE_2 = "TRIN0002"


# Test SAML config data for PUT /api/sso/tenant/{tenant_code}/config
TEST_SAML_CONFIG = {
    "enabled": True,
    "provider": "saml",
    "provider_name": "Test SAML IdP",
    "saml_entity_id": "https://idp.test.com/metadata",
    "saml_sso_url": "https://idp.test.com/sso/saml",
    "saml_slo_url": "https://idp.test.com/slo/saml",
    "saml_certificate": "MIIDpDCCAoygAwIBAgIGAZMeN9xBMA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsGA1UECgwET2t0YTEUMBIGA1UECwwLU1NPUHJvdmlkZXIxEzARBgNVBAMMCmRldi04NzgwMDcxHDAaBgkqhkiG9w0BCQEWDWluZm9Ab2t0YS5jb20wHhcNMjQwMTAxMDAwMDAwWhcNMzQwMTAxMDAwMDAwWjCBkjELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xDTALBgNVBAoMBE9rdGExFDASBgNVBAsMC1NTT1Byb3ZpZGVyMRMwEQYDVQQDDApkZXYtODc4MDA3MRwwGgYJKoZIhvcNAQkBFg1pbmZvQG9rdGEuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Q8vPdxWXfXV5oqfBQEvXt0aTpOMp5hnPqYgW4W0QzqtQ3LXU9rZ0PfXdXV0xzD7Tf8tKfR8p9qz3KvXB3gVE7PqLqJaR5r5WNXV5pD0qLVtU0R3v7PqLqJaR5r5WNXV5pD0qLVtU0R3v7PqLqJaR5r5WNXV5pD0qLVtU0R3v7PqLqJaR5r5WNXV5pD0qLVtU0R3v7TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQIDAQAB",
    "saml_name_id_format": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    "attribute_mapping": {
        "email": "email",
        "first_name": "firstName",
        "last_name": "lastName"
    },
    "auto_provision": True,
    "default_role": "student"
}


# Module-level fixture for authentication tokens
@pytest.fixture(scope="module")
def auth_tokens():
    """Get all auth tokens once for the entire module"""
    tokens = {}
    
    # Super admin login
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    if resp.status_code == 200:
        tokens["super_admin"] = resp.json().get("access_token")
    else:
        print(f"Warning: Super admin login failed: {resp.status_code}")
        tokens["super_admin"] = None
    
    time.sleep(0.5)  # Small delay to avoid rate limits
    
    # Tenant admin login
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TENANT_ADMIN_EMAIL, "password": TENANT_ADMIN_PASSWORD}
    )
    if resp.status_code == 200:
        tokens["tenant_admin"] = resp.json().get("access_token")
    else:
        print(f"Warning: Tenant admin login failed: {resp.status_code}")
        tokens["tenant_admin"] = None
    
    time.sleep(0.5)
    
    # Student login
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": STUDENT_EMAIL, "password": STUDENT_PASSWORD}
    )
    if resp.status_code == 200:
        tokens["student"] = resp.json().get("access_token")
    else:
        print(f"Warning: Student login failed: {resp.status_code}")
        tokens["student"] = None
    
    return tokens


class TestSSOProvidersEndpoint:
    """Test GET /api/sso/providers - lists available SSO providers including saml type"""
    
    def test_list_providers_returns_saml_type(self):
        """GET /api/sso/providers should list saml in supported_types"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "supported_types" in data, "Response should contain supported_types"
        assert "saml" in data["supported_types"], "SAML should be in supported_types"
        assert "providers" in data, "Response should contain providers"
        
        print("✓ GET /api/sso/providers - lists SAML in supported_types - PASS")
    
    def test_list_providers_structure(self):
        """GET /api/sso/providers should return proper provider template structure"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        
        assert response.status_code == 200
        
        data = response.json()
        providers = data.get("providers", {})
        
        # Should have azure_ad, okta, google templates
        assert "azure_ad" in providers, "Should have azure_ad provider"
        assert "okta" in providers, "Should have okta provider"
        assert "google" in providers, "Should have google provider"
        
        # Verify each provider has required structure
        for provider_id, provider_info in providers.items():
            assert "name" in provider_info, f"{provider_id} should have 'name'"
            assert "provider" in provider_info, f"{provider_id} should have 'provider'"
            assert "required_fields" in provider_info, f"{provider_id} should have 'required_fields'"
            assert "instructions" in provider_info, f"{provider_id} should have 'instructions'"
        
        print("✓ GET /api/sso/providers - provider structure correct - PASS")


class TestSAMLMetadataEndpoint:
    """Test GET /api/sso/saml/{tenant_code}/metadata - returns valid XML SP metadata"""
    
    def test_metadata_returns_xml_for_existing_tenant(self):
        """GET /api/sso/saml/{tenant_code}/metadata should return XML for valid tenant"""
        response = requests.get(f"{BASE_URL}/api/sso/saml/{TENANT_CODE}/metadata")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Should return XML content type
        content_type = response.headers.get("content-type", "")
        assert "xml" in content_type.lower(), f"Expected XML content-type, got {content_type}"
        
        # Verify XML structure
        xml_content = response.text
        assert '<?xml version="1.0"?>' in xml_content, "Should have XML declaration"
        assert "EntityDescriptor" in xml_content, "Should contain EntityDescriptor"
        assert "SPSSODescriptor" in xml_content, "Should contain SPSSODescriptor"
        assert "AssertionConsumerService" in xml_content, "Should contain ACS"
        assert TENANT_CODE in xml_content, "Should contain tenant code in entity ID"
        
        print("✓ GET /api/sso/saml/{tenant_code}/metadata - returns valid XML - PASS")
    
    def test_metadata_contains_correct_urls(self):
        """GET /api/sso/saml/{tenant_code}/metadata should have correct ACS and SLO URLs"""
        response = requests.get(f"{BASE_URL}/api/sso/saml/{TENANT_CODE}/metadata")
        
        assert response.status_code == 200
        
        xml_content = response.text
        
        # ACS URL should be in the XML
        expected_acs_path = f"/api/sso/saml/{TENANT_CODE}/acs"
        assert expected_acs_path in xml_content, f"ACS URL should contain {expected_acs_path}"
        
        # SLO URL should be in the XML
        expected_slo_path = f"/api/sso/saml/{TENANT_CODE}/slo"
        assert expected_slo_path in xml_content, f"SLO URL should contain {expected_slo_path}"
        
        print("✓ GET /api/sso/saml/{tenant_code}/metadata - URLs correct - PASS")
    
    def test_metadata_nonexistent_tenant_returns_404(self):
        """GET /api/sso/saml/{tenant_code}/metadata should return 404 for non-existent tenant"""
        response = requests.get(f"{BASE_URL}/api/sso/saml/NONEXISTENT_TENANT/metadata")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ GET /api/sso/saml/{tenant_code}/metadata - 404 for invalid tenant - PASS")


class TestSSOConfigEndpoints:
    """Test SSO configuration CRUD endpoints"""
    
    def test_put_saml_config_as_super_admin(self, auth_tokens):
        """PUT /api/sso/tenant/{tenant_code}/config - super admin can configure SAML"""
        if not auth_tokens.get("super_admin"):
            pytest.skip("Super admin login failed")
        
        headers = {"Authorization": f"Bearer {auth_tokens['super_admin']}"}
        
        response = requests.put(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            json=TEST_SAML_CONFIG,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success'"
        assert data["success"] == True, "Should be successful"
        assert "sso_config" in data, "Response should contain sso_config"
        
        sso_config = data["sso_config"]
        assert sso_config.get("provider") == "saml", "Provider should be saml"
        assert sso_config.get("enabled") == True, "SSO should be enabled"
        assert sso_config.get("saml_entity_id") == TEST_SAML_CONFIG["saml_entity_id"], "Entity ID should match"
        
        print("✓ PUT /api/sso/tenant/{tenant_code}/config - super admin configures SAML - PASS")
    
    def test_get_sso_test_status_ready(self, auth_tokens):
        """GET /api/sso/tenant/{tenant_code}/test - should return status=ready when configured"""
        if not auth_tokens.get("super_admin"):
            pytest.skip("Super admin login failed")
        
        headers = {"Authorization": f"Bearer {auth_tokens['super_admin']}"}
        
        # First configure SAML
        requests.put(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            json=TEST_SAML_CONFIG,
            headers=headers
        )
        
        # Then test
        response = requests.get(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/test",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status'"
        assert data["status"] == "ready", f"Status should be 'ready', got {data.get('status')}"
        assert "login_url" in data, "Response should contain 'login_url'"
        assert "saml_metadata_url" in data, "Response should contain 'saml_metadata_url'"
        
        # Verify login_url points to SAML endpoint
        login_url = data.get("login_url", "")
        assert "/api/sso/saml/" in login_url, f"Login URL should point to SAML endpoint: {login_url}"
        assert TENANT_CODE in login_url, f"Login URL should contain tenant code: {login_url}"
        
        print("✓ GET /api/sso/tenant/{tenant_code}/test - status=ready with SAML login_url - PASS")
    
    def test_delete_sso_config(self, auth_tokens):
        """DELETE /api/sso/tenant/{tenant_code}/config - should disable SSO"""
        if not auth_tokens.get("super_admin"):
            pytest.skip("Super admin login failed")
        
        headers = {"Authorization": f"Bearer {auth_tokens['super_admin']}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success'"
        assert data["success"] == True, "Should be successful"
        
        print("✓ DELETE /api/sso/tenant/{tenant_code}/config - disables SSO - PASS")


class TestSAMLLoginEndpoint:
    """Test GET /api/sso/saml/{tenant_code}/login - initiates SAML login"""
    
    def test_saml_login_returns_redirect(self, auth_tokens):
        """GET /api/sso/saml/{tenant_code}/login - should return 307 redirect to IdP"""
        if not auth_tokens.get("super_admin"):
            pytest.skip("Super admin login failed")
        
        headers = {"Authorization": f"Bearer {auth_tokens['super_admin']}"}
        
        # First configure SAML
        requests.put(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            json=TEST_SAML_CONFIG,
            headers=headers
        )
        
        # Then test login redirect
        response = requests.get(
            f"{BASE_URL}/api/sso/saml/{TENANT_CODE}/login",
            allow_redirects=False
        )
        
        assert response.status_code == 307, f"Expected 307 redirect, got {response.status_code}: {response.text}"
        
        # Check redirect location
        location = response.headers.get("Location", "")
        assert location, "Should have Location header"
        assert TEST_SAML_CONFIG["saml_sso_url"] in location, f"Should redirect to IdP SSO URL. Got: {location}"
        assert "SAMLRequest" in location, "Redirect should contain SAMLRequest parameter"
        
        print("✓ GET /api/sso/saml/{tenant_code}/login - returns 307 redirect to IdP - PASS")
    
    def test_saml_login_unconfigured_tenant_returns_400(self, auth_tokens):
        """GET /api/sso/saml/{tenant_code}/login - unconfigured tenant returns 400"""
        if not auth_tokens.get("super_admin"):
            pytest.skip("Super admin login failed")
        
        headers = {"Authorization": f"Bearer {auth_tokens['super_admin']}"}
        
        # Disable SSO first
        requests.delete(f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config", headers=headers)
        
        response = requests.get(
            f"{BASE_URL}/api/sso/saml/{TENANT_CODE}/login",
            allow_redirects=False
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        
        print("✓ GET /api/sso/saml/{tenant_code}/login - unconfigured tenant returns 400 - PASS")


class TestSAMLACSEndpoint:
    """Test POST /api/sso/saml/{tenant_code}/acs - SAML Assertion Consumer Service"""
    
    def test_acs_missing_saml_response_returns_redirect(self):
        """POST /api/sso/saml/{tenant_code}/acs - missing SAMLResponse returns redirect with error"""
        response = requests.post(
            f"{BASE_URL}/api/sso/saml/{TENANT_CODE}/acs",
            data={},  # No SAMLResponse
            allow_redirects=False
        )
        
        # Should redirect to login with error, NOT return 501
        assert response.status_code in [302, 307], f"Expected redirect, got {response.status_code}: {response.text}"
        
        location = response.headers.get("Location", "")
        assert "login" in location.lower(), f"Should redirect to login page: {location}"
        assert "sso_error" in location or "error" in location, f"Should have error param in redirect: {location}"
        
        print("✓ POST /api/sso/saml/{tenant_code}/acs - missing SAMLResponse returns redirect - PASS")
    
    def test_acs_not_501(self):
        """POST /api/sso/saml/{tenant_code}/acs - should NOT return 501 (placeholder removed)"""
        response = requests.post(
            f"{BASE_URL}/api/sso/saml/{TENANT_CODE}/acs",
            data={"SAMLResponse": "invalid_base64_data"},
            allow_redirects=False
        )
        
        # Should NOT return 501 (that was the placeholder)
        assert response.status_code != 501, f"ACS should no longer return 501, got {response.status_code}"
        
        # Should redirect with error for invalid response
        assert response.status_code in [302, 307], f"Expected redirect for invalid SAML, got {response.status_code}"
        
        print("✓ POST /api/sso/saml/{tenant_code}/acs - no longer returns 501 - PASS")
    
    def test_acs_nonexistent_tenant_returns_404(self):
        """POST /api/sso/saml/{tenant_code}/acs - non-existent tenant returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/sso/saml/NONEXISTENT/acs",
            data={"SAMLResponse": "test"},
            allow_redirects=False
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ POST /api/sso/saml/{tenant_code}/acs - non-existent tenant returns 404 - PASS")


class TestSAMLSLOEndpoint:
    """Test GET /api/sso/saml/{tenant_code}/slo - Single Logout"""
    
    def test_slo_clears_cookie_and_redirects(self):
        """GET /api/sso/saml/{tenant_code}/slo - clears access_token and redirects"""
        response = requests.get(
            f"{BASE_URL}/api/sso/saml/{TENANT_CODE}/slo",
            allow_redirects=False
        )
        
        assert response.status_code in [302, 307], f"Expected redirect, got {response.status_code}"
        
        # Check redirect location goes to login page
        location = response.headers.get("Location", "")
        assert "login" in location.lower(), f"Should redirect to login page: {location}"
        
        # Check Set-Cookie header clears the access_token
        set_cookie = response.headers.get("Set-Cookie", "")
        assert "access_token" in set_cookie.lower(), "Should set access_token cookie"
        
        print("✓ GET /api/sso/saml/{tenant_code}/slo - clears cookie and redirects - PASS")


class TestAuthorizationEnforcement:
    """Test authorization rules for SSO config endpoints"""
    
    def test_student_cannot_access_sso_config(self, auth_tokens):
        """Students (non-admin) should get 403 on config endpoints"""
        if not auth_tokens.get("student"):
            pytest.skip("Student login failed")
        
        headers = {"Authorization": f"Bearer {auth_tokens['student']}"}
        
        # GET config
        response = requests.get(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        # PUT config
        response = requests.put(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            json={"enabled": True},
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        # DELETE config
        response = requests.delete(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        print("✓ Students get 403 on SSO config endpoints - PASS")
    
    def test_tenant_admin_can_only_access_own_tenant(self, auth_tokens):
        """Tenant admins can only access their own tenant's SSO config"""
        if not auth_tokens.get("tenant_admin"):
            pytest.skip("Tenant admin login failed")
        
        headers = {"Authorization": f"Bearer {auth_tokens['tenant_admin']}"}
        
        # Can access own tenant (ORMD0001)
        response = requests.get(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            headers=headers
        )
        assert response.status_code == 200, f"Should access own tenant, got {response.status_code}"
        
        # Cannot access other tenant (TRIN0002)
        response = requests.get(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE_2}/config",
            headers=headers
        )
        assert response.status_code == 403, f"Should be 403 for other tenant, got {response.status_code}"
        
        print("✓ Tenant admins can only access own tenant config - PASS")
    
    def test_unauthenticated_cannot_access_config(self):
        """Unauthenticated requests should get 401 on config endpoints"""
        # No auth header
        response = requests.get(f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        response = requests.put(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config",
            json={"enabled": True}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print("✓ Unauthenticated requests get 401 - PASS")


class TestOAuthRegressionEndpoint:
    """Test OAuth endpoints still work (regression test)"""
    
    def test_oauth_login_unconfigured_returns_400(self):
        """GET /api/sso/oauth/{tenant_code}/login - returns 400 when not configured"""
        response = requests.get(
            f"{BASE_URL}/api/sso/oauth/{TENANT_CODE}/login",
            allow_redirects=False
        )
        
        # Should return 400 since OAuth SSO is not enabled by default
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        
        print("✓ GET /api/sso/oauth/{tenant_code}/login - returns 400 when not configured - PASS")


class TestSSOConfigTestEndpoint:
    """Test GET /api/sso/tenant/{tenant_code}/test endpoint"""
    
    def test_sso_test_disabled_tenant(self, auth_tokens):
        """GET /api/sso/tenant/{tenant_code}/test - returns disabled status when SSO not enabled"""
        if not auth_tokens.get("super_admin"):
            pytest.skip("Super admin login failed")
        
        headers = {"Authorization": f"Bearer {auth_tokens['super_admin']}"}
        
        # Disable SSO first
        requests.delete(f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config", headers=headers)
        
        response = requests.get(
            f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/test",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "status" in data, "Response should have status"
        assert data["status"] == "disabled", f"Status should be 'disabled', got {data.get('status')}"
        
        print("✓ GET /api/sso/tenant/{tenant_code}/test - disabled status when not enabled - PASS")


# Cleanup fixture to disable SSO after tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_sso_config(auth_tokens):
    """Cleanup: Disable SSO after all tests in module"""
    yield
    # Cleanup after all tests
    try:
        if auth_tokens and auth_tokens.get("super_admin"):
            headers = {"Authorization": f"Bearer {auth_tokens['super_admin']}"}
            requests.delete(f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config", headers=headers)
            print("Cleanup: SSO config disabled for test tenant")
    except Exception as e:
        print(f"Cleanup warning: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
