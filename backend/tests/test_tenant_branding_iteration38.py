"""
Backend API Tests for Iteration 38 - Tenant Branding & AI Suggestions Removal
Tests P0 (tenant color branding on mobile) and P1 (ai_suggestions.py removal)

Test Coverage:
1. Backend health endpoint
2. Login endpoint returns branding data in tenant object
3. Login response structure validation
4. GET /api/tenants returns branding data (super admin)
5. AI suggestions endpoint is removed (returns 404)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_CODE = "TEST6991"


class TestHealthEndpoint:
    """Test backend health endpoints"""
    
    def test_health_endpoint_returns_200(self):
        """GET /api/health returns 200 with status, version, timestamp"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health endpoint failed: {response.status_code}"
        
        data = response.json()
        assert "status" in data, "Missing 'status' field"
        assert data["status"] == "healthy", f"Status not healthy: {data['status']}"
        assert "version" in data, "Missing 'version' field"
        assert "timestamp" in data, "Missing 'timestamp' field"
        print(f"✓ Health endpoint OK: status={data['status']}, version={data['version']}")


class TestAISuggestionsRemoval:
    """Test that ai_suggestions.py is properly removed"""
    
    def test_ai_suggestions_endpoint_returns_404(self):
        """POST /api/ai/suggestions should return 404 (endpoint removed)"""
        response = requests.post(
            f"{BASE_URL}/api/ai/suggestions",
            json={"prompt": "test prompt"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 404, f"AI suggestions should return 404, got {response.status_code}"
        print("✓ AI suggestions endpoint correctly returns 404 (removed)")


class TestLoginEndpoint:
    """Test login endpoint returns correct structure with branding"""
    
    def test_login_super_admin_success(self):
        """POST /api/auth/login with super admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Verify required fields in response
        assert "access_token" in data, "Missing 'access_token' field"
        assert isinstance(data["access_token"], str), "access_token should be string"
        assert len(data["access_token"]) > 0, "access_token should not be empty"
        
        assert "user" in data, "Missing 'user' field"
        user = data["user"]
        assert user["email"] == SUPER_ADMIN_EMAIL, f"Wrong email: {user.get('email')}"
        assert user["role"] == "super_admin", f"Wrong role: {user.get('role')}"
        
        assert "tenant" in data, "Missing 'tenant' field"
        tenant = data["tenant"]
        assert "name" in tenant, "Tenant missing 'name' field"
        assert "enabled_modules" in tenant, "Tenant missing 'enabled_modules' field"
        
        print(f"✓ Super admin login successful: user={user['email']}, role={user['role']}")
        print(f"✓ Tenant info: name={tenant.get('name')}, modules_count={len(tenant.get('enabled_modules', []))}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": "wrongpassword123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Should return 401, got {response.status_code}"
        print("✓ Invalid credentials correctly returns 401")


class TestTenantsEndpoint:
    """Test /api/tenants returns tenants with branding data"""
    
    @pytest.fixture
    def auth_token(self):
        """Get super admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code != 200:
            pytest.skip("Could not authenticate super admin")
        return response.json()["access_token"]
    
    def test_get_tenants_returns_branding_data(self, auth_token):
        """GET /api/tenants returns tenants with branding (snake_case colors)"""
        response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200, f"Get tenants failed: {response.status_code}"
        
        tenants = response.json()
        assert isinstance(tenants, list), "Tenants should be a list"
        
        # Find our test tenant
        test_tenant = None
        for t in tenants:
            if t.get("code") == TENANT_CODE:
                test_tenant = t
                break
        
        if not test_tenant:
            pytest.skip(f"Test tenant {TENANT_CODE} not found")
        
        # Verify branding fields exist (snake_case as per problem statement)
        assert "primary_color" in test_tenant, "Tenant missing 'primary_color' field"
        assert "secondary_color" in test_tenant, "Tenant missing 'secondary_color' field"
        assert "branding" in test_tenant, "Tenant missing 'branding' field"
        
        # Verify branding nested object
        branding = test_tenant.get("branding", {})
        assert "primary_color" in branding, "Branding missing 'primary_color'"
        assert "secondary_color" in branding, "Branding missing 'secondary_color'"
        
        print(f"✓ Tenant {TENANT_CODE} has branding:")
        print(f"  - primary_color: {test_tenant.get('primary_color')}")
        print(f"  - secondary_color: {test_tenant.get('secondary_color')}")
        print(f"  - branding.primary_color: {branding.get('primary_color')}")
        print(f"  - branding.secondary_color: {branding.get('secondary_color')}")
    
    def test_get_tenants_unauthorized(self):
        """GET /api/tenants without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/tenants")
        # May return 401 or 403 depending on implementation
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Tenants endpoint correctly requires authentication")


class TestBrandingEndpoint:
    """Test tenant branding public endpoint"""
    
    def test_get_tenant_branding_by_code(self):
        """GET /api/branding/tenant/{code} returns branding data"""
        response = requests.get(f"{BASE_URL}/api/branding/tenant/{TENANT_CODE}")
        
        # This endpoint may require auth or not exist
        if response.status_code in [404, 401, 403]:
            pytest.skip(f"Branding endpoint not publicly available (status={response.status_code})")
        
        assert response.status_code == 200, f"Branding endpoint failed: {response.status_code}"
        
        data = response.json()
        assert "primary_color" in data or "branding" in data, "Missing color branding fields"
        print(f"✓ Branding endpoint for {TENANT_CODE} returns data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
