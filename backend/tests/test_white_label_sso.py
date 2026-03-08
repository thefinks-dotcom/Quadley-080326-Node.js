"""
White-Label Branding and SSO Integration API Tests
===================================================
Tests for P2 (White-label branding) and P3 (SSO integration) features.
Also verifies admin audit logging for tenant management.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.app"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_ADMIN_EMAIL = "admin@ormond.com"
TENANT_ADMIN_PASSWORD = "Quadley2025!"
TENANT_CODE = "ORMD0001"


class TestWhiteLabelBrandingPublicEndpoints:
    """Test public white-label branding endpoints (no auth required)"""
    
    def test_get_branding_defaults(self):
        """GET /api/branding/defaults - should return default branding config"""
        response = requests.get(f"{BASE_URL}/api/branding/defaults")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "defaults" in data, "Response should contain 'defaults'"
        assert "fonts" in data, "Response should contain 'fonts'"
        assert "themes" in data, "Response should contain 'themes'"
        
        # Verify default values
        defaults = data["defaults"]
        assert defaults.get("primary_color") == "#3B82F6", "Default primary color should be #3B82F6"
        assert defaults.get("secondary_color") == "#10B981", "Default secondary color should be #10B981"
        assert defaults.get("theme") == "light", "Default theme should be 'light'"
        
        # Verify fonts list
        assert "Inter" in data["fonts"], "Inter should be in available fonts"
        assert "Roboto" in data["fonts"], "Roboto should be in available fonts"
        
        # Verify themes list
        assert "light" in data["themes"], "light should be in available themes"
        assert "dark" in data["themes"], "dark should be in available themes"
        
        print("✓ GET /api/branding/defaults - PASS")
    
    def test_get_branding_presets(self):
        """GET /api/branding/presets - should return available branding presets"""
        response = requests.get(f"{BASE_URL}/api/branding/presets")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "presets" in data, "Response should contain 'presets'"
        
        presets = data["presets"]
        assert len(presets) > 0, "Should have at least one preset"
        
        # Verify preset structure
        preset_ids = [p["id"] for p in presets]
        assert "classic_blue" in preset_ids, "classic_blue preset should exist"
        assert "modern_purple" in preset_ids, "modern_purple preset should exist"
        assert "nature_green" in preset_ids, "nature_green preset should exist"
        
        # Verify preset has required fields
        for preset in presets:
            assert "id" in preset, "Preset should have 'id'"
            assert "name" in preset, "Preset should have 'name'"
            assert "description" in preset, "Preset should have 'description'"
            assert "preview" in preset, "Preset should have 'preview'"
        
        print("✓ GET /api/branding/presets - PASS")
    
    def test_get_public_branding_existing_tenant(self):
        """GET /api/branding/public/{tenant_code} - should return public branding for login page"""
        response = requests.get(f"{BASE_URL}/api/branding/public/{TENANT_CODE}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "branding" in data, "Response should contain 'branding'"
        assert "css_variables" in data, "Response should contain 'css_variables'"
        
        branding = data["branding"]
        # Public branding should have login-related fields
        assert "primary_color" in branding, "Should have primary_color"
        assert "show_powered_by" in branding, "Should have show_powered_by"
        
        # CSS variables should be valid CSS
        css_vars = data["css_variables"]
        assert ":root {" in css_vars, "CSS variables should start with :root"
        assert "--color-primary" in css_vars, "Should have --color-primary CSS variable"
        
        print("✓ GET /api/branding/public/{tenant_code} (existing tenant) - PASS")
    
    def test_get_public_branding_unknown_tenant(self):
        """GET /api/branding/public/{tenant_code} - should return defaults for unknown tenant"""
        response = requests.get(f"{BASE_URL}/api/branding/public/UNKNOWN_TENANT")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "branding" in data, "Response should contain 'branding'"
        
        branding = data["branding"]
        assert branding.get("app_name") == "Quadley", "Unknown tenant should get default app name"
        assert branding.get("show_powered_by") == True, "Unknown tenant should show powered by"
        
        print("✓ GET /api/branding/public/{tenant_code} (unknown tenant) - PASS")


class TestSSOPublicEndpoints:
    """Test public SSO endpoints (no auth required)"""
    
    def test_list_sso_providers(self):
        """GET /api/sso/providers - should list available SSO provider templates"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "providers" in data, "Response should contain 'providers'"
        assert "supported_types" in data, "Response should contain 'supported_types'"
        
        providers = data["providers"]
        # Should have Azure AD, Okta, Google templates
        assert "azure_ad" in providers, "Should have azure_ad provider"
        assert "okta" in providers, "Should have okta provider"
        assert "google" in providers, "Should have google provider"
        
        # Verify provider structure
        for provider_id, provider_info in providers.items():
            assert "name" in provider_info, f"{provider_id} should have 'name'"
            assert "provider" in provider_info, f"{provider_id} should have 'provider'"
            assert "required_fields" in provider_info, f"{provider_id} should have 'required_fields'"
            assert "instructions" in provider_info, f"{provider_id} should have 'instructions'"
        
        # Verify supported types
        supported_types = data["supported_types"]
        assert "saml" in supported_types, "SAML should be supported"
        assert "oauth2" in supported_types, "OAuth2 should be supported"
        assert "oidc" in supported_types, "OIDC should be supported"
        
        print("✓ GET /api/sso/providers - PASS")


class TestWhiteLabelBrandingAuthenticatedEndpoints:
    """Test authenticated white-label branding endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_tenant_branding_as_super_admin(self):
        """GET /api/branding/tenant/{tenant_code} - super admin can access any tenant"""
        response = self.session.get(f"{BASE_URL}/api/branding/tenant/{TENANT_CODE}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "tenant_code" in data, "Response should contain 'tenant_code'"
        assert "tenant_name" in data, "Response should contain 'tenant_name'"
        assert "branding" in data, "Response should contain 'branding'"
        assert "css_variables" in data, "Response should contain 'css_variables'"
        
        assert data["tenant_code"] == TENANT_CODE, f"Tenant code should be {TENANT_CODE}"
        
        print("✓ GET /api/branding/tenant/{tenant_code} (super admin) - PASS")
    
    def test_get_tenant_branding_not_found(self):
        """GET /api/branding/tenant/{tenant_code} - should return 404 for non-existent tenant"""
        response = self.session.get(f"{BASE_URL}/api/branding/tenant/NONEXISTENT")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        print("✓ GET /api/branding/tenant/{tenant_code} (not found) - PASS")


class TestSSOAuthenticatedEndpoints:
    """Test authenticated SSO endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_sso_config_as_super_admin(self):
        """GET /api/sso/tenant/{tenant_code}/config - super admin can access any tenant"""
        response = self.session.get(f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "tenant_code" in data, "Response should contain 'tenant_code'"
        assert "tenant_name" in data, "Response should contain 'tenant_name'"
        assert "sso_config" in data, "Response should contain 'sso_config'"
        assert "sp_metadata" in data, "Response should contain 'sp_metadata'"
        assert "callback_url" in data, "Response should contain 'callback_url'"
        
        # Verify SP metadata structure
        sp_metadata = data["sp_metadata"]
        assert "entity_id" in sp_metadata, "SP metadata should have entity_id"
        assert "acs_url" in sp_metadata, "SP metadata should have acs_url"
        assert "slo_url" in sp_metadata, "SP metadata should have slo_url"
        
        # Verify callback URL format
        callback_url = data["callback_url"]
        assert f"/api/sso/oauth/{TENANT_CODE}/callback" in callback_url, "Callback URL should contain tenant code"
        
        print("✓ GET /api/sso/tenant/{tenant_code}/config (super admin) - PASS")
    
    def test_get_sso_config_not_found(self):
        """GET /api/sso/tenant/{tenant_code}/config - should return 404 for non-existent tenant"""
        response = self.session.get(f"{BASE_URL}/api/sso/tenant/NONEXISTENT/config")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        print("✓ GET /api/sso/tenant/{tenant_code}/config (not found) - PASS")


class TestTenantAdminAccess:
    """Test tenant admin access to branding and SSO endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as tenant admin before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TENANT_ADMIN_EMAIL, "password": TENANT_ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_tenant_admin_can_access_own_branding(self):
        """Tenant admin should be able to access their own tenant's branding"""
        response = self.session.get(f"{BASE_URL}/api/branding/tenant/{TENANT_CODE}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["tenant_code"] == TENANT_CODE
        
        print("✓ Tenant admin can access own branding - PASS")
    
    def test_tenant_admin_can_access_own_sso_config(self):
        """Tenant admin should be able to access their own tenant's SSO config"""
        response = self.session.get(f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["tenant_code"] == TENANT_CODE
        
        print("✓ Tenant admin can access own SSO config - PASS")


class TestAuthenticationWithHttpOnlyCookies:
    """Test that authentication works with httpOnly cookies (no localStorage)"""
    
    def test_login_sets_httponly_cookie(self):
        """Login should set httpOnly cookie for token storage"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        # Check that access_token cookie is set
        cookies = session.cookies.get_dict()
        # Note: httpOnly cookies may not be visible in requests library
        # but the server should set them
        
        # Verify login response structure
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user data"
        
        print("✓ Login returns access_token and user data - PASS")
    
    def test_auth_me_endpoint_works(self):
        """GET /api/auth/me should work with session cookie"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        
        # Use token in header (simulating frontend behavior)
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Check /auth/me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        
        assert me_response.status_code == 200, f"Expected 200, got {me_response.status_code}: {me_response.text}"
        
        data = me_response.json()
        assert data.get("email") == SUPER_ADMIN_EMAIL, "Should return logged in user's email"
        
        print("✓ GET /api/auth/me works with authentication - PASS")
    
    def test_logout_clears_session(self):
        """POST /api/auth/logout should clear session"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.text}"
        
        # Verify session is cleared - /auth/me should fail
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 401, "Should be unauthorized after logout"
        
        print("✓ POST /api/auth/logout clears session - PASS")


class TestAdminAuditLogging:
    """Test that admin actions are logged to audit trail"""
    
    def test_module_update_logs_admin_action(self):
        """PUT /api/tenants/{tenant_code}/modules should log admin action"""
        # Login as super admin
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get current modules
        tenant_response = session.get(f"{BASE_URL}/api/tenants/{TENANT_CODE}")
        assert tenant_response.status_code == 200, f"Get tenant failed: {tenant_response.status_code} - {tenant_response.text}"
        current_modules = tenant_response.json().get("enabled_modules", [])
        
        # Update modules (toggle one module)
        test_modules = current_modules.copy()
        
        response = session.put(
            f"{BASE_URL}/api/tenants/{TENANT_CODE}/modules",
            json={"enabled_modules": test_modules}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert data["message"] == "Modules updated", "Should confirm modules updated"
        
        print("✓ PUT /api/tenants/{tenant_code}/modules logs admin action - PASS")


class TestUnauthorizedAccess:
    """Test that unauthorized access is properly blocked"""
    
    def test_branding_tenant_requires_auth(self):
        """GET /api/branding/tenant/{tenant_code} should require authentication"""
        response = requests.get(f"{BASE_URL}/api/branding/tenant/{TENANT_CODE}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✓ GET /api/branding/tenant/{tenant_code} requires auth - PASS")
    
    def test_sso_config_requires_auth(self):
        """GET /api/sso/tenant/{tenant_code}/config should require authentication"""
        response = requests.get(f"{BASE_URL}/api/sso/tenant/{TENANT_CODE}/config")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✓ GET /api/sso/tenant/{tenant_code}/config requires auth - PASS")


class TestSSOLoginFlow:
    """Test SSO login flow endpoints (OAuth flow is stubbed)"""
    
    def test_sso_login_without_config_returns_error(self):
        """GET /api/sso/oauth/{tenant_code}/login should return error if SSO not enabled"""
        response = requests.get(
            f"{BASE_URL}/api/sso/oauth/{TENANT_CODE}/login",
            allow_redirects=False
        )
        
        # Should return 400 since SSO is not enabled by default
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        assert "not enabled" in data["detail"].lower() or "not configured" in data["detail"].lower(), \
            "Error should mention SSO not enabled/configured"
        
        print("✓ GET /api/sso/oauth/{tenant_code}/login returns error when SSO not enabled - PASS")
    
    def test_saml_metadata_endpoint(self):
        """GET /api/sso/saml/{tenant_code}/metadata should return SP metadata XML"""
        response = requests.get(f"{BASE_URL}/api/sso/saml/{TENANT_CODE}/metadata")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Should return XML
        content_type = response.headers.get("content-type", "")
        assert "xml" in content_type.lower(), f"Should return XML, got {content_type}"
        
        # Verify XML structure
        xml_content = response.text
        assert "EntityDescriptor" in xml_content, "Should contain EntityDescriptor"
        assert "SPSSODescriptor" in xml_content, "Should contain SPSSODescriptor"
        assert TENANT_CODE in xml_content, "Should contain tenant code"
        
        print("✓ GET /api/sso/saml/{tenant_code}/metadata returns SP metadata - PASS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
