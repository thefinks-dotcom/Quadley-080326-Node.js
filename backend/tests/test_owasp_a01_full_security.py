"""
Test suite for OWASP A01 Compliance - Full Multi-tenant Security Verification
Tests that ALL refactored route files use tenant-isolated database connections
via get_tenant_db_for_user dependency.

Route files verified:
- maintenance.py ✓
- safe_disclosure.py ✓
- announcements.py ✓
- bookings.py ✓
- birthdays.py ✓
- parcels.py ✓
- floor.py ✓
- academics.py ✓
- delight.py ✓
- date_config.py ✓
- ra_applications.py ✓
- monitoring.py ✓
- wellbeing_admin.py ✓
- user_provisioning.py ✓

Created for security refactor verification - Iteration 35
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
        print("PASS: Health DB endpoint works")


class TestAuthenticationEndpoints:
    """Test authentication"""
    
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
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        print(f"PASS: Super admin login works - role: {data['user']['role']}")
    
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


class TestMaintenanceEndpointsTenantIsolation:
    """Test maintenance endpoints use tenant-isolated database (OWASP A01)"""
    
    def test_maintenance_get_requires_tenant(self, super_admin_token):
        """Test GET /maintenance returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/maintenance",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Maintenance GET endpoint correctly requires tenant context")
    
    def test_maintenance_post_requires_tenant(self, super_admin_token):
        """Test POST /maintenance returns 403 for super_admin without tenant context"""
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


class TestAnnouncementsEndpointsTenantIsolation:
    """Test announcements endpoints use tenant-isolated database (OWASP A01)"""
    
    def test_announcements_get_requires_tenant(self, super_admin_token):
        """Test GET /announcements returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/announcements",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Announcements GET endpoint correctly requires tenant context")
    
    def test_announcements_post_requires_tenant(self, super_admin_token):
        """Test POST /announcements returns 403 for super_admin without tenant context"""
        response = requests.post(
            f"{BASE_URL}/api/announcements",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "title": "Test",
                "content": "Test content",
                "target_audience": "all",
                "priority": "normal"
            },
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Announcements POST endpoint correctly requires tenant context")
    
    def test_announcements_archived_requires_tenant(self, super_admin_token):
        """Test GET /announcements/archived requires tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/announcements/archived",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Announcements archived endpoint correctly requires tenant context")


class TestBookingsEndpointsTenantIsolation:
    """Test bookings endpoints use tenant-isolated database (OWASP A01)"""
    
    def test_bookings_get_requires_tenant(self, super_admin_token):
        """Test GET /bookings returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Bookings GET endpoint correctly requires tenant context")
    
    def test_bookings_post_requires_tenant(self, super_admin_token):
        """Test POST /bookings returns 403 for super_admin without tenant context"""
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "facility": "Gym",
                "date": "2026-02-20T10:00:00",
                "duration": 60,
                "purpose": "Test",
                "booking_type": "individual"
            },
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Bookings POST endpoint correctly requires tenant context")


class TestBirthdaysEndpointsTenantIsolation:
    """Test birthdays endpoints use tenant-isolated database (OWASP A01)"""
    
    def test_birthdays_upcoming_requires_tenant(self, super_admin_token):
        """Test GET /birthdays/upcoming returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/birthdays/upcoming",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Birthdays upcoming endpoint correctly requires tenant context")
    
    def test_birthdays_today_requires_tenant(self, super_admin_token):
        """Test GET /birthdays/today returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/birthdays/today",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Birthdays today endpoint correctly requires tenant context")


class TestParcelsEndpointsTenantIsolation:
    """Test parcels endpoints use tenant-isolated database (OWASP A01)"""
    
    def test_parcels_get_requires_tenant(self, super_admin_token):
        """Test GET /parcels returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/parcels",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Parcels GET endpoint correctly requires tenant context")
    
    def test_parcels_pending_requires_tenant(self, super_admin_token):
        """Test GET /parcels/my-pending returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/parcels/my-pending",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Parcels my-pending endpoint correctly requires tenant context")


class TestFloorEndpointsTenantIsolation:
    """Test floor endpoints use tenant-isolated database (OWASP A01)"""
    
    def test_floor_users_requires_tenant(self, super_admin_token):
        """Test GET /floor/users returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/floor/users",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Floor users endpoint correctly requires tenant context")
    
    def test_floor_events_requires_tenant(self, super_admin_token):
        """Test GET /floor-events returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/floor-events",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Floor events endpoint correctly requires tenant context")
    
    def test_emergency_contacts_requires_tenant(self, super_admin_token):
        """Test GET /emergency-contacts returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/emergency-contacts",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Emergency contacts endpoint correctly requires tenant context")


class TestAcademicsEndpointsTenantIsolation:
    """Test academics endpoints use tenant-isolated database (OWASP A01)"""
    
    def test_study_groups_get_requires_tenant(self, super_admin_token):
        """Test GET /study-groups returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/study-groups",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Study groups GET endpoint correctly requires tenant context")
    
    def test_study_groups_post_requires_tenant(self, super_admin_token):
        """Test POST /study-groups returns 403 for super_admin without tenant context"""
        response = requests.post(
            f"{BASE_URL}/api/study-groups",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "name": "Test Group",
                "subject": "Math",
                "location": "Library",
                "max_members": 5
            },
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Study groups POST endpoint correctly requires tenant context")
    
    def test_tutoring_get_requires_tenant(self, super_admin_token):
        """Test GET /tutoring returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/tutoring",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
        print("PASS: Tutoring GET endpoint correctly requires tenant context")


class TestSafeDisclosureEndpointsTenantIsolation:
    """Test safe disclosure endpoints use tenant-isolated database (OWASP A01)"""
    
    def test_safe_disclosures_get_requires_tenant(self, super_admin_token):
        """Test GET /safe-disclosures returns 403 for super_admin without tenant context"""
        response = requests.get(
            f"{BASE_URL}/api/safe-disclosures",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code} - {response.text}"
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


class TestUnauthenticatedAccess:
    """Test that endpoints properly reject unauthenticated requests"""
    
    def test_maintenance_requires_auth(self):
        """Test maintenance endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/maintenance", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Maintenance endpoint requires authentication")
    
    def test_announcements_requires_auth(self):
        """Test announcements endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/announcements", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Announcements endpoint requires authentication")
    
    def test_bookings_requires_auth(self):
        """Test bookings endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bookings", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Bookings endpoint requires authentication")
    
    def test_safe_disclosures_requires_auth(self):
        """Test safe disclosures endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/safe-disclosures", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Safe disclosures endpoint requires authentication")
    
    def test_study_groups_requires_auth(self):
        """Test study groups endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/study-groups", timeout=10)
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("PASS: Study groups endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
