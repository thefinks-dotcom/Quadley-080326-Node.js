"""
Test suite for OWASP A01 Compliance - Multi-tenant Security Fix
Tests that route files (maintenance.py and safe_disclosure.py) use 
tenant-isolated database connections via get_tenant_db_for_user

Created for security refactor verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_CODE = "TEST6991"


class TestBackendHealth:
    """Basic backend health checks"""
    
    def test_ping_endpoint(self):
        """Test ultra-lightweight ping endpoint"""
        response = requests.get(f"{BASE_URL}/api/ping", timeout=10)
        assert response.status_code == 200, f"Ping failed: {response.text}"
        data = response.json()
        assert data.get("status") == "ok"
        print("PASS: Ping endpoint works")
    
    def test_health_db_endpoint(self):
        """Test database health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health/db", timeout=10)
        assert response.status_code == 200, f"Health DB failed: {response.text}"
        data = response.json()
        assert data.get("status") == "connected"
        print(f"PASS: Health DB endpoint works - version {data.get('version')}")


class TestAuthenticationEndpoints:
    """Test authentication with tenant isolation"""
    
    def test_super_admin_login(self):
        """Test super admin can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": SUPER_ADMIN_EMAIL,
                "password": SUPER_ADMIN_PASSWORD
            },
            timeout=30
        )
        
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL, "Email mismatch"
        assert data["user"]["role"] in ["super_admin", "superadmin"], f"Unexpected role: {data['user']['role']}"
        
        print(f"PASS: Super admin login works - role: {data['user']['role']}")
        return data["access_token"]
    
    def test_invalid_login(self):
        """Test that invalid credentials are rejected"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "invalid@test.com",
                "password": "wrongpassword"
            },
            timeout=30
        )
        
        # Should return 401 for invalid credentials
        assert response.status_code in [401, 404], f"Expected 401/404, got: {response.status_code}"
        print("PASS: Invalid credentials properly rejected")


class TestMaintenanceEndpointsTenantIsolation:
    """Test maintenance endpoints use tenant-isolated database (OWASP A01 fix verification)"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin token for testing"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": SUPER_ADMIN_EMAIL,
                "password": SUPER_ADMIN_PASSWORD
            },
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get super admin token")
    
    def test_maintenance_get_requires_tenant(self, super_admin_token):
        """
        Test GET /maintenance returns 403 for super_admin without tenant context.
        This verifies the refactor is working - super_admin has no tenant in JWT,
        so they cannot access tenant-isolated routes directly.
        """
        response = requests.get(
            f"{BASE_URL}/api/maintenance",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        
        # Super admin should get 403 because they don't have tenant context
        # This proves the route is using get_tenant_db_for_user correctly
        assert response.status_code == 403, f"Expected 403 for super_admin without tenant, got: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Error should mention tenant context: {data}"
        print("PASS: Maintenance GET endpoint correctly requires tenant context")
    
    def test_maintenance_post_requires_tenant(self, super_admin_token):
        """
        Test POST /maintenance returns 403 for super_admin without tenant context.
        """
        response = requests.post(
            f"{BASE_URL}/api/maintenance",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "room_number": "101",
                "issue_type": "test",
                "description": "Test issue",
                "priority": "normal"
            },
            timeout=30
        )
        
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Maintenance POST endpoint correctly requires tenant context")
    
    def test_maintenance_facilitators_requires_tenant(self, super_admin_token):
        """Test GET /maintenance/facilitators/list requires tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/maintenance/facilitators/list",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Maintenance facilitators endpoint correctly requires tenant context")


class TestSafeDisclosureEndpointsTenantIsolation:
    """Test safe disclosure endpoints use tenant-isolated database (OWASP A01 fix verification)"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin token for testing"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": SUPER_ADMIN_EMAIL,
                "password": SUPER_ADMIN_PASSWORD
            },
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get super admin token")
    
    def test_safe_disclosures_get_requires_tenant(self, super_admin_token):
        """
        Test GET /safe-disclosures returns 403 for super_admin without tenant context.
        """
        response = requests.get(
            f"{BASE_URL}/api/safe-disclosures",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Error should mention tenant context: {data}"
        print("PASS: Safe disclosures GET endpoint correctly requires tenant context")
    
    def test_safe_disclosures_post_requires_tenant(self, super_admin_token):
        """Test POST /safe-disclosures requires tenant context"""
        response = requests.post(
            f"{BASE_URL}/api/safe-disclosures",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "is_anonymous": True,
                "incident_type": "test",
                "description": "Test disclosure"
            },
            timeout=30
        )
        
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Safe disclosures POST endpoint correctly requires tenant context")
    
    def test_safe_disclosures_stats_requires_tenant(self, super_admin_token):
        """Test GET /safe-disclosures/stats requires tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/safe-disclosures/stats",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Safe disclosures stats endpoint correctly requires tenant context")
    
    def test_safe_disclosures_annual_report_requires_tenant(self, super_admin_token):
        """Test GET /safe-disclosures/annual-report requires tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/safe-disclosures/annual-report",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Safe disclosures annual-report endpoint correctly requires tenant context")


class TestUnauthenticatedAccess:
    """Test that endpoints properly reject unauthenticated requests"""
    
    def test_maintenance_requires_auth(self):
        """Test maintenance endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/maintenance", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Maintenance endpoint requires authentication")
    
    def test_safe_disclosures_requires_auth(self):
        """Test safe disclosures endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/safe-disclosures", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Safe disclosures endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
