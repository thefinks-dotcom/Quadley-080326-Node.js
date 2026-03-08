"""
IP Anomaly Detection API Tests
===============================
Tests for:
- GET /api/security/alerts/stats - Alert statistics
- GET /api/security/alerts - List alerts with filters  
- POST /api/security/alerts/{alert_id}/resolve - Resolve single alert
- POST /api/security/alerts/resolve-all - Resolve all alerts
- GET /api/security/alerts/settings - Get detection settings
- POST /api/security/alerts/settings - Update settings (super admin only)
- GET /api/security/login-history - View login history (super admin only)
- Login triggers anomaly detection
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_ADMIN_EMAIL = "admin@ormond.com"
TENANT_ADMIN_PASSWORD = "Quadley2025!"
STUDENT_EMAIL = "student2@ormond.com"
STUDENT_PASSWORD = "Quadley2025!"


# Module level login to avoid rate limiting
def get_super_admin_token():
    """Get super admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


def get_tenant_admin_token():
    """Get tenant admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TENANT_ADMIN_EMAIL,
        "password": TENANT_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


def get_student_token():
    """Get student token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


# =============================================
# AUTHENTICATION TESTS (No auth required)
# =============================================

class TestIPAnomalyAuthentication:
    """Test authentication requirements for all security endpoints"""

    def test_stats_requires_auth(self):
        """GET /api/security/alerts/stats returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/security/alerts/stats")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_alerts_list_requires_auth(self):
        """GET /api/security/alerts returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/security/alerts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_resolve_alert_requires_auth(self):
        """POST /api/security/alerts/{id}/resolve returns 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/security/alerts/test_id/resolve")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_resolve_all_requires_auth(self):
        """POST /api/security/alerts/resolve-all returns 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/security/alerts/resolve-all")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_settings_get_requires_auth(self):
        """GET /api/security/alerts/settings returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/security/alerts/settings")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_settings_post_requires_auth(self):
        """POST /api/security/alerts/settings returns 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/security/alerts/settings", json={})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_login_history_requires_auth(self):
        """GET /api/security/login-history returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/security/login-history")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


# =============================================
# SUPER ADMIN TESTS
# =============================================

class TestIPAnomalySuperAdmin:
    """Test super admin access to all security endpoints"""

    @pytest.fixture(scope="class")
    def super_admin_headers(self):
        """Get super admin auth headers - shared across class"""
        token = get_super_admin_token()
        if not token:
            pytest.skip("Super admin login failed")
        return {"Authorization": f"Bearer {token}"}

    def test_super_admin_can_get_stats(self, super_admin_headers):
        """Super admin can access /api/security/alerts/stats"""
        response = requests.get(f"{BASE_URL}/api/security/alerts/stats", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate stats structure
        assert "total" in data, "Stats missing 'total'"
        assert "unresolved" in data, "Stats missing 'unresolved'"
        assert "last_24h" in data, "Stats missing 'last_24h'"
        assert "last_7d" in data, "Stats missing 'last_7d'"
        assert "by_severity" in data, "Stats missing 'by_severity'"
        assert "by_type" in data, "Stats missing 'by_type'"
        
        # Validate by_severity has expected keys
        by_severity = data["by_severity"]
        for sev in ["low", "medium", "high", "critical"]:
            assert sev in by_severity, f"by_severity missing '{sev}'"
            
        # Validate by_type has expected keys
        by_type = data["by_type"]
        for atype in ["new_ip", "rapid_ip_change", "brute_force"]:
            assert atype in by_type, f"by_type missing '{atype}'"

    def test_super_admin_can_list_alerts(self, super_admin_headers):
        """Super admin can list alerts with pagination"""
        response = requests.get(f"{BASE_URL}/api/security/alerts", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "alerts" in data, "Response missing 'alerts'"
        assert "total" in data, "Response missing 'total'"
        assert "limit" in data, "Response missing 'limit'"
        assert "offset" in data, "Response missing 'offset'"
        assert isinstance(data["alerts"], list), "alerts should be a list"

    def test_super_admin_can_filter_by_severity(self, super_admin_headers):
        """Super admin can filter alerts by severity"""
        response = requests.get(f"{BASE_URL}/api/security/alerts?severity=medium", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_super_admin_can_filter_by_type(self, super_admin_headers):
        """Super admin can filter alerts by alert_type"""
        response = requests.get(f"{BASE_URL}/api/security/alerts?alert_type=new_ip", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_super_admin_can_filter_by_resolved(self, super_admin_headers):
        """Super admin can filter alerts by resolved status"""
        response = requests.get(f"{BASE_URL}/api/security/alerts?resolved=false", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_super_admin_can_get_settings(self, super_admin_headers):
        """Super admin can get anomaly detection settings"""
        response = requests.get(f"{BASE_URL}/api/security/alerts/settings", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Validate settings structure
        assert "new_ip_alerts_enabled" in data, "Settings missing 'new_ip_alerts_enabled'"
        assert "rapid_ip_window_minutes" in data, "Settings missing 'rapid_ip_window_minutes'"
        assert "rapid_ip_threshold" in data, "Settings missing 'rapid_ip_threshold'"
        assert "brute_force_window_minutes" in data, "Settings missing 'brute_force_window_minutes'"
        assert "brute_force_threshold" in data, "Settings missing 'brute_force_threshold'"
        assert "alert_email_enabled" in data, "Settings missing 'alert_email_enabled'"

    def test_super_admin_can_update_settings(self, super_admin_headers):
        """Super admin can update anomaly detection settings"""
        response = requests.post(
            f"{BASE_URL}/api/security/alerts/settings",
            json={"new_ip_alerts_enabled": True, "rapid_ip_threshold": 4},
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "message" in data, "Response missing 'message'"
        assert "settings" in data, "Response missing 'settings'"

    def test_super_admin_can_access_login_history(self, super_admin_headers):
        """Super admin can view login history"""
        response = requests.get(f"{BASE_URL}/api/security/login-history", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "records" in data, "Response missing 'records'"
        assert "count" in data, "Response missing 'count'"
        assert isinstance(data["records"], list), "records should be a list"

    def test_super_admin_can_filter_login_history_by_email(self, super_admin_headers):
        """Super admin can filter login history by email"""
        response = requests.get(
            f"{BASE_URL}/api/security/login-history?email={SUPER_ADMIN_EMAIL}",
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_super_admin_can_resolve_all(self, super_admin_headers):
        """Super admin can resolve all alerts"""
        response = requests.post(f"{BASE_URL}/api/security/alerts/resolve-all", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "message" in data, "Response missing 'message'"

    def test_resolve_nonexistent_alert_returns_404(self, super_admin_headers):
        """Resolving a non-existent alert returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/security/alerts/nonexistent_alert_id/resolve",
            headers=super_admin_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    def test_invalid_settings_key_returns_400(self, super_admin_headers):
        """Invalid settings keys should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/security/alerts/settings",
            json={"invalid_key": "value"},
            headers=super_admin_headers
        )
        # Should return 400 because no valid settings provided
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


# =============================================
# TENANT ADMIN TESTS
# =============================================

class TestIPAnomalyTenantAdmin:
    """Test tenant admin access to security endpoints"""

    @pytest.fixture(scope="class")
    def tenant_admin_headers(self):
        """Get tenant admin auth headers - shared across class"""
        token = get_tenant_admin_token()
        if not token:
            pytest.skip("Tenant admin login failed")
        return {"Authorization": f"Bearer {token}"}

    def test_tenant_admin_can_get_stats(self, tenant_admin_headers):
        """Tenant admin can access alert stats"""
        response = requests.get(f"{BASE_URL}/api/security/alerts/stats", headers=tenant_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_tenant_admin_can_list_alerts(self, tenant_admin_headers):
        """Tenant admin can list alerts"""
        response = requests.get(f"{BASE_URL}/api/security/alerts", headers=tenant_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_tenant_admin_can_get_settings(self, tenant_admin_headers):
        """Tenant admin can view settings"""
        response = requests.get(f"{BASE_URL}/api/security/alerts/settings", headers=tenant_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_tenant_admin_cannot_update_settings(self, tenant_admin_headers):
        """Tenant admin cannot update settings (super admin only)"""
        response = requests.post(
            f"{BASE_URL}/api/security/alerts/settings",
            json={"new_ip_alerts_enabled": False},
            headers=tenant_admin_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_tenant_admin_cannot_access_login_history(self, tenant_admin_headers):
        """Tenant admin cannot access login history (super admin only)"""
        response = requests.get(f"{BASE_URL}/api/security/login-history", headers=tenant_admin_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


# =============================================
# STUDENT ACCESS TESTS  
# =============================================

class TestIPAnomalyStudentAccess:
    """Test that students get 403 on all security endpoints"""

    @pytest.fixture(scope="class")
    def student_headers(self):
        """Get student auth headers - shared across class"""
        token = get_student_token()
        if not token:
            pytest.skip("Student login failed")
        return {"Authorization": f"Bearer {token}"}

    def test_student_cannot_access_stats(self, student_headers):
        """Students get 403 on /api/security/alerts/stats"""
        response = requests.get(f"{BASE_URL}/api/security/alerts/stats", headers=student_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_student_cannot_access_alerts(self, student_headers):
        """Students get 403 on /api/security/alerts"""
        response = requests.get(f"{BASE_URL}/api/security/alerts", headers=student_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_student_cannot_resolve_alert(self, student_headers):
        """Students get 403 on resolve alert"""
        response = requests.post(f"{BASE_URL}/api/security/alerts/test_id/resolve", headers=student_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_student_cannot_resolve_all(self, student_headers):
        """Students get 403 on resolve all"""
        response = requests.post(f"{BASE_URL}/api/security/alerts/resolve-all", headers=student_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_student_cannot_access_settings(self, student_headers):
        """Students get 403 on settings"""
        response = requests.get(f"{BASE_URL}/api/security/alerts/settings", headers=student_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_student_cannot_update_settings(self, student_headers):
        """Students get 403 on update settings"""
        response = requests.post(f"{BASE_URL}/api/security/alerts/settings", json={}, headers=student_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_student_cannot_access_login_history(self, student_headers):
        """Students get 403 on login history"""
        response = requests.get(f"{BASE_URL}/api/security/login-history", headers=student_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


# =============================================
# LOGIN HISTORY RECORDING TESTS
# =============================================

class TestLoginTriggersAnomalyDetection:
    """Test that login triggers anomaly detection"""

    @pytest.fixture(scope="class")
    def super_admin_headers(self):
        """Get super admin auth headers"""
        token = get_super_admin_token()
        if not token:
            pytest.skip("Super admin login failed")
        return {"Authorization": f"Bearer {token}"}

    def test_login_history_has_records(self, super_admin_headers):
        """Login history should contain records"""
        time.sleep(0.5)
        
        # Check login history
        response = requests.get(
            f"{BASE_URL}/api/security/login-history?email={SUPER_ADMIN_EMAIL}&limit=5",
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Should have at least one record from our login
        assert len(data["records"]) > 0, "Login should be recorded in history"
        
        # Validate record structure
        if data["records"]:
            record = data["records"][0]
            assert "email" in record, "Record missing email"
            assert "ip_address" in record, "Record missing ip_address"
            assert "timestamp" in record, "Record missing timestamp"
            assert "success" in record, "Record missing success field"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
