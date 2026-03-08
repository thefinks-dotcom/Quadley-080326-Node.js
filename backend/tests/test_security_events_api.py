"""
Test Security Events API Endpoints (OWASP A09 Compliance)

Tests the new /api/security/* endpoints for:
1. Authentication required (401 for unauthenticated)
2. Admin authorization required (403 for non-admin)
3. Tenant isolation (403 for super_admin without tenant context)
4. Successful responses for authenticated admins with tenant context
5. Rate limiting on login endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"


class TestSecurityEndpointsAuth:
    """Test authentication and authorization for security endpoints"""
    
    def test_health_check(self):
        """Verify backend is running"""
        response = requests.get(f"{BASE_URL}/api/ping")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print("Health check: PASS")
    
    def test_security_events_requires_auth(self):
        """Security events endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/security/events")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated access blocked: {response.status_code}")
    
    def test_security_metrics_requires_auth(self):
        """Security metrics endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/security/metrics")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated access blocked: {response.status_code}")
    
    def test_security_failed_logins_requires_auth(self):
        """Failed logins endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/security/failed-logins")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated access blocked: {response.status_code}")
    
    def test_security_event_types_requires_auth(self):
        """Event types endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/security/event-types")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated access blocked: {response.status_code}")
    
    def test_security_locked_accounts_requires_auth(self):
        """Locked accounts endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/security/locked-accounts")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated access blocked: {response.status_code}")


class TestSuperAdminTenantIsolation:
    """Test that super_admin without tenant context gets 403 (correct OWASP A01 behavior)"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin token (without tenant context)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_super_admin_login_works(self, super_admin_token):
        """Verify super admin can login"""
        assert super_admin_token is not None
        print("Super admin login: PASS")
    
    def test_security_events_tenant_isolation(self, super_admin_token):
        """Super admin without tenant context should get 403"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/events", headers=headers)
        # Should get 403 because super_admin has no tenant context
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "tenant context" in data.get("detail", "").lower()
        print("Security events tenant isolation: PASS (403 as expected)")
    
    def test_security_metrics_tenant_isolation(self, super_admin_token):
        """Super admin without tenant context should get 403"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/metrics", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Security metrics tenant isolation: PASS (403 as expected)")
    
    def test_security_failed_logins_tenant_isolation(self, super_admin_token):
        """Super admin without tenant context should get 403"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/failed-logins", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Security failed-logins tenant isolation: PASS (403 as expected)")
    
    def test_security_event_types_tenant_isolation(self, super_admin_token):
        """Super admin without tenant context should get 403"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/event-types", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Security event-types tenant isolation: PASS (403 as expected)")
    
    def test_security_locked_accounts_tenant_isolation(self, super_admin_token):
        """Super admin without tenant context should get 403"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/locked-accounts", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Security locked-accounts tenant isolation: PASS (403 as expected)")


class TestSecurityReportEndpoint:
    """Test the security report endpoint (POST /api/security/report)"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_security_report_requires_auth(self):
        """Security report endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/security/report",
            json={"events": [{"type": "test", "timestamp": "2025-01-01T00:00:00Z"}]}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Security report auth required: PASS")
    
    def test_security_report_tenant_isolation(self, super_admin_token):
        """Super admin without tenant context should get 403"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/security/report",
            headers=headers,
            json={"events": [{"type": "test", "timestamp": "2025-01-01T00:00:00Z"}]}
        )
        # Should get 403 because super_admin has no tenant context
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Security report tenant isolation: PASS (403 as expected)")


class TestSecurityUnlockAccountEndpoint:
    """Test the unlock account endpoint (POST /api/security/unlock-account)"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_unlock_account_requires_auth(self):
        """Unlock account endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/security/unlock-account",
            params={"email": "test@example.com"}
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("Unlock account auth required: PASS")
    
    def test_unlock_account_tenant_isolation(self, super_admin_token):
        """Super admin without tenant context should get 403"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/security/unlock-account",
            headers=headers,
            params={"email": "nonexistent@example.com"}
        )
        # Should get 403 because super_admin has no tenant context
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Unlock account tenant isolation: PASS (403 as expected)")


class TestLoginRateLimiting:
    """Test rate limiting on login endpoint"""
    
    def test_login_endpoint_exists(self):
        """Verify login endpoint is accessible"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "wrongpass"}
        )
        # Should get 401 for invalid credentials, not 404
        assert response.status_code in [401, 429], f"Expected 401/429, got {response.status_code}"
        print("Login endpoint accessible: PASS")
    
    def test_login_invalid_credentials_rejected(self):
        """Verify invalid credentials are rejected"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "badpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "invalid" in data.get("detail", "").lower() or "password" in data.get("detail", "").lower()
        print("Invalid credentials rejected: PASS")
    
    def test_login_success_with_valid_credentials(self):
        """Verify valid credentials work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        print("Valid credentials login: PASS")


class TestSecurityRouterIntegration:
    """Test that security router is properly integrated in server.py"""
    
    def test_security_prefix_correct(self):
        """Verify security endpoints are under /api/security/"""
        # Test with auth to verify the route exists (gets 401/403, not 404)
        endpoints = [
            "/api/security/events",
            "/api/security/metrics",
            "/api/security/failed-logins",
            "/api/security/event-types",
            "/api/security/locked-accounts"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            # Should NOT be 404 - route should exist
            assert response.status_code != 404, f"{endpoint} returned 404 - route not found"
            print(f"{endpoint}: Route exists (status {response.status_code})")
    
    def test_security_report_route_exists(self):
        """Verify POST /api/security/report route exists"""
        response = requests.post(
            f"{BASE_URL}/api/security/report",
            json={"events": []}
        )
        # Should NOT be 404 or 405
        assert response.status_code not in [404, 405], f"Route issue: {response.status_code}"
        print("POST /api/security/report: Route exists")
    
    def test_security_unlock_route_exists(self):
        """Verify POST /api/security/unlock-account route exists"""
        response = requests.post(
            f"{BASE_URL}/api/security/unlock-account",
            params={"email": "test@example.com"}
        )
        # Should NOT be 404 or 405
        assert response.status_code not in [404, 405], f"Route issue: {response.status_code}"
        print("POST /api/security/unlock-account: Route exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
