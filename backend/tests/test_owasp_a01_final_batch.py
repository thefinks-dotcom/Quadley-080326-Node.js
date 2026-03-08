"""
Test suite for OWASP A01 Compliance - Final Batch Security Verification
Tests that the final 4 refactored route files use tenant-isolated database connections
via get_tenant_db_for_user dependency.

Route files verified in this batch:
- analytics.py ✓
- dashboard.py ✓
- notifications.py ✓
- student_reports.py ✓

Created for final security refactor verification - Iteration 36
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
    """Basic backend health checks - always run first"""
    
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
        print(f"PASS: Health DB endpoint works - version: {data.get('version')}")


class TestAuthenticationEndpoints:
    """Test authentication endpoints work correctly"""
    
    def test_super_admin_login_success(self):
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
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["role"] == "super_admin", f"Expected super_admin role, got: {data['user']['role']}"
        print(f"PASS: Super admin login works - role: {data['user']['role']}")
    
    def test_invalid_login_rejected(self):
        """Test that invalid credentials are rejected"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "invalid@test.com",
                "password": "wrongpassword"
            },
            timeout=30
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got: {response.status_code}"
        print("PASS: Invalid credentials properly rejected")


@pytest.fixture(scope="class")
def super_admin_token():
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


# ============ ANALYTICS ENDPOINTS (NEWLY REFACTORED) ============

class TestAnalyticsEndpointsTenantIsolation:
    """Test analytics endpoints use tenant-isolated database (OWASP A01)
    
    File: backend/routes/analytics.py
    Refactored to use: get_tenant_db_for_user dependency
    """
    
    def test_analytics_student_usage_requires_tenant(self, super_admin_token):
        """Test GET /analytics/student-usage returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Analytics student-usage endpoint correctly requires tenant context")
    
    def test_analytics_gender_violence_report_requires_tenant(self, super_admin_token):
        """Test GET /analytics/gender-violence-report returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/gender-violence-report",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Analytics gender-violence-report endpoint correctly requires tenant context")
    
    def test_analytics_engagement_trends_requires_tenant(self, super_admin_token):
        """Test GET /analytics/engagement-trends returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/engagement-trends",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Analytics engagement-trends endpoint correctly requires tenant context")


# ============ DASHBOARD ENDPOINTS (NEWLY REFACTORED) ============

class TestDashboardEndpointsTenantIsolation:
    """Test dashboard endpoints use tenant-isolated database (OWASP A01)
    
    File: backend/routes/dashboard.py
    Refactored to use: get_tenant_db_for_user dependency
    """
    
    def test_dashboard_main_requires_tenant(self, super_admin_token):
        """Test GET /dashboard returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Dashboard main endpoint correctly requires tenant context")
    
    def test_dashboard_reports_requires_tenant(self, super_admin_token):
        """Test GET /dashboard/reports returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/reports",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Dashboard reports endpoint correctly requires tenant context")
    
    def test_dashboard_export_users_requires_tenant(self, super_admin_token):
        """Test GET /dashboard/export/users returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/export/users",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Dashboard export/users endpoint correctly requires tenant context")
    
    def test_dashboard_admin_requires_tenant(self, super_admin_token):
        """Test GET /dashboard/admin returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/admin",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Dashboard admin endpoint correctly requires tenant context")


# ============ NOTIFICATIONS ENDPOINTS (NEWLY REFACTORED) ============

class TestNotificationsEndpointsTenantIsolation:
    """Test notifications endpoints use tenant-isolated database (OWASP A01)
    
    File: backend/routes/notifications.py
    Refactored to use: get_tenant_db_for_user dependency
    """
    
    def test_notifications_list_requires_tenant(self, super_admin_token):
        """Test GET /notifications returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Notifications list endpoint correctly requires tenant context")
    
    def test_notifications_unread_count_requires_tenant(self, super_admin_token):
        """Test GET /notifications/unread-count returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Notifications unread-count endpoint correctly requires tenant context")
    
    def test_notifications_read_all_requires_tenant(self, super_admin_token):
        """Test POST /notifications/read-all returns 403 for super_admin without tenant context"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Notifications read-all endpoint correctly requires tenant context")
    
    def test_notifications_register_device_requires_tenant(self, super_admin_token):
        """Test POST /notifications/register-device returns 403 for super_admin without tenant context"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-device",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "device_token": "test_device_token_12345678901234567890123456789012345678901234",
                "platform": "ios"
            },
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Notifications register-device endpoint correctly requires tenant context")
    
    def test_notifications_preferences_requires_tenant(self, super_admin_token):
        """Test GET /notifications/preferences returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/preferences",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Notifications preferences endpoint correctly requires tenant context")
    
    def test_notifications_send_requires_tenant(self, super_admin_token):
        """Test POST /notifications/send returns 403 for super_admin without tenant context"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "title": "Test notification",
                "body": "Test body"
            },
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Notifications send endpoint correctly requires tenant context")


# ============ STUDENT REPORTS ENDPOINTS (NEWLY REFACTORED) ============

class TestStudentReportsEndpointsTenantIsolation:
    """Test student reports endpoints use tenant-isolated database (OWASP A01)
    
    File: backend/routes/student_reports.py
    Refactored to use: get_tenant_db_for_user dependency
    """
    
    def test_student_reports_search_requires_tenant(self, super_admin_token):
        """Test GET /student-reports/search returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/student-reports/search",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Student-reports search endpoint correctly requires tenant context")
    
    def test_student_reports_student_detail_requires_tenant(self, super_admin_token):
        """Test GET /student-reports/student/{id} returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/student-reports/student/test-student-id",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Student-reports student detail endpoint correctly requires tenant context")
    
    def test_student_reports_activity_types_requires_tenant(self, super_admin_token):
        """Test GET /student-reports/activity-types returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/student-reports/activity-types",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Student-reports activity-types endpoint correctly requires tenant context")
    
    def test_student_reports_years_requires_tenant(self, super_admin_token):
        """Test GET /student-reports/years returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/student-reports/years",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Student-reports years endpoint correctly requires tenant context")
    
    def test_student_reports_floors_requires_tenant(self, super_admin_token):
        """Test GET /student-reports/floors returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/student-reports/floors",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Student-reports floors endpoint correctly requires tenant context")
    
    def test_student_reports_csv_export_requires_tenant(self, super_admin_token):
        """Test GET /student-reports/export/csv returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/student-reports/export/csv",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        data = response.json()
        assert "tenant" in data.get("detail", "").lower(), f"Expected tenant context error, got: {data}"
        print("PASS: Student-reports export/csv endpoint correctly requires tenant context")


# ============ UNAUTHENTICATED ACCESS BLOCKED ============

class TestUnauthenticatedAccessBlocked:
    """Test that all tenant-isolated endpoints block unauthenticated access (401)"""
    
    def test_dashboard_unauthenticated(self):
        """Test that dashboard returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/dashboard", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Dashboard blocks unauthenticated access")
    
    def test_analytics_unauthenticated(self):
        """Test that analytics returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/analytics/student-usage", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Analytics blocks unauthenticated access")
    
    def test_notifications_unauthenticated(self):
        """Test that notifications returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/notifications", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Notifications blocks unauthenticated access")
    
    def test_student_reports_unauthenticated(self):
        """Test that student-reports returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/student-reports/search", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Student-reports blocks unauthenticated access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
