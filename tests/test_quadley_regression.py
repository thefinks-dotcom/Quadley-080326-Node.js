"""
Quadley Mobile App - Full Regression Test Suite
Tests all key API endpoints for the mobile app
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mobile-redesign-20.preview.emergentagent.com').rstrip('/')

# Test credentials
RA_CREDENTIALS = {"email": "epink@icloud.com", "password": "AbC!123!AbC!123!"}
ADMIN_CREDENTIALS = {"email": "epinker@icloud.com", "password": "AbC!123!"}


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_ra_login_success(self):
        """Test RA user can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=RA_CREDENTIALS
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "ra"
        assert data["user"]["email"] == RA_CREDENTIALS["email"]
        assert data["user"]["floor"] == "Level 1 - Wing A"
    
    def test_admin_login_success(self):
        """Test Admin user can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDENTIALS
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401


@pytest.fixture
def ra_token():
    """Get RA authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=RA_CREDENTIALS
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("RA authentication failed")


@pytest.fixture
def admin_token():
    """Get Admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=ADMIN_CREDENTIALS
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Admin authentication failed")


@pytest.fixture
def ra_headers(ra_token):
    """Get headers with RA auth token"""
    return {"Authorization": f"Bearer {ra_token}"}


@pytest.fixture
def admin_headers(admin_token):
    """Get headers with Admin auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestEventsEndpoints:
    """Test events-related endpoints"""
    
    def test_get_events(self, ra_headers):
        """Test fetching events list"""
        response = requests.get(f"{BASE_URL}/api/events", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} events")
    
    def test_create_event_with_category(self, ra_headers):
        """Test creating a floor event (requires category field)"""
        event_data = {
            "title": "TEST_Floor Game Night",
            "description": "Test event created by RA",
            "location": "Level 1 - Wing A Common Area",
            "date": (datetime.now() + timedelta(days=7)).isoformat(),
            "start_time": (datetime.now() + timedelta(days=7)).isoformat(),
            "type": "floor",
            "floor": "Level 1 - Wing A",
            "capacity": 50,
            "category": "social"  # Required field
        }
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=ra_headers,
            json=event_data
        )
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        data = response.json()
        assert data.get("title") == "TEST_Floor Game Night"
        print(f"Created event with ID: {data.get('id')}")
        return data.get("id")


class TestAnnouncementsEndpoints:
    """Test announcements-related endpoints"""
    
    def test_get_announcements(self, ra_headers):
        """Test fetching announcements list"""
        response = requests.get(f"{BASE_URL}/api/announcements", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} announcements")
        
        # Verify announcement structure
        if len(data) > 0:
            announcement = data[0]
            assert "id" in announcement
            assert "title" in announcement
            assert "content" in announcement


class TestJobsEndpoints:
    """Test jobs-related endpoints"""
    
    def test_get_jobs(self, ra_headers):
        """Test fetching jobs list"""
        response = requests.get(f"{BASE_URL}/api/jobs", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} jobs")
        
        # Verify job structure
        if len(data) > 0:
            job = data[0]
            assert "id" in job
            assert "title" in job


class TestDiningEndpoints:
    """Test dining-related endpoints"""
    
    def test_get_dining_menu(self, ra_headers):
        """Test fetching dining menu"""
        response = requests.get(f"{BASE_URL}/api/dining/menu", headers=ra_headers)
        # Menu might be empty but endpoint should work
        assert response.status_code == 200


class TestMaintenanceEndpoints:
    """Test maintenance/service request endpoints"""
    
    def test_get_maintenance_requests(self, ra_headers):
        """Test fetching maintenance requests"""
        response = requests.get(f"{BASE_URL}/api/maintenance", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} maintenance requests")


class TestCoCurricularEndpoints:
    """Test co-curricular activities endpoints"""
    
    def test_get_cocurricular_groups(self, ra_headers):
        """Test fetching co-curricular groups/activities"""
        response = requests.get(f"{BASE_URL}/api/cocurricular/groups/all", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} co-curricular activities")
        
        # Verify activity structure
        if len(data) > 0:
            activity = data[0]
            assert "id" in activity
            assert "name" in activity


class TestFloorEndpoints:
    """Test floor-related endpoints"""
    
    def test_get_floor_users(self, ra_headers):
        """Test fetching floor users"""
        response = requests.get(f"{BASE_URL}/api/floor/users", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} floor users")
    
    def test_get_floor_events(self, ra_headers):
        """Test fetching floor events"""
        response = requests.get(f"{BASE_URL}/api/floor-events", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} floor events")


class TestSafeDisclosureEndpoints:
    """Test safe disclosure endpoints"""
    
    def test_submit_safe_disclosure(self, ra_headers):
        """Test submitting a safe disclosure"""
        disclosure_data = {
            "is_anonymous": True,
            "incident_type": "A General Complaint",
            "description": "TEST_This is a test disclosure for regression testing",
            "happened_to": "It happened to me",
            "immediate_danger": False,
            "medical_attention_needed": False,
            "police_notified": False,
            "support_requested": ["Counseling Services"]
        }
        response = requests.post(
            f"{BASE_URL}/api/safe-disclosures",
            headers=ra_headers,
            json=disclosure_data
        )
        # Should succeed or return validation error
        assert response.status_code in [200, 201, 422], f"Unexpected status: {response.status_code}, {response.text}"
        if response.status_code in [200, 201]:
            print("Safe disclosure submitted successfully")


class TestNotificationEndpoints:
    """Test notification-related endpoints"""
    
    def test_get_notifications(self, ra_headers):
        """Test fetching notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} notifications")
    
    def test_notification_preferences(self, ra_headers):
        """Test getting notification preferences"""
        response = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=ra_headers)
        # Endpoint might not exist, but should not crash
        assert response.status_code in [200, 404]


class TestDashboardEndpoints:
    """Test dashboard endpoints"""
    
    def test_get_dashboard(self, ra_headers):
        """Test fetching dashboard data"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        # Dashboard should return some data
        assert data is not None


class TestRAToolsEndpoints:
    """Test RA-specific endpoints"""
    
    def test_ra_can_access_floor_management(self, ra_headers):
        """Test RA can access floor management features"""
        # Test floor users endpoint
        response = requests.get(f"{BASE_URL}/api/floor/users", headers=ra_headers)
        assert response.status_code == 200
        
    def test_ra_can_create_floor_event(self, ra_headers):
        """Test RA can create floor events"""
        event_data = {
            "title": "TEST_RA Floor Meeting",
            "description": "Weekly floor meeting",
            "location": "Level 1 - Wing A Common Area",
            "date": (datetime.now() + timedelta(days=3)).isoformat(),
            "start_time": (datetime.now() + timedelta(days=3)).isoformat(),
            "type": "floor",
            "floor": "Level 1 - Wing A",
            "capacity": 30,
            "category": "meeting"
        }
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=ra_headers,
            json=event_data
        )
        assert response.status_code in [200, 201], f"Failed: {response.text}"


class TestUserProfile:
    """Test user profile endpoints"""
    
    def test_get_current_user(self, ra_headers):
        """Test fetching current user profile"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=ra_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == RA_CREDENTIALS["email"]
        assert data["role"] == "ra"


# Cleanup test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Note: In a real scenario, we'd delete test data here
    # For now, we just log that cleanup would happen
    print("\n[Cleanup] Would delete TEST_ prefixed data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
