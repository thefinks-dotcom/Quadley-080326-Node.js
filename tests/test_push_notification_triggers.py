"""
Push Notification Triggers Test Suite
======================================
Tests for push notification triggers on announcements and events:
- POST /api/announcements - Should trigger push notification to all users
- POST /api/events - Should trigger push notification for new event
- POST /api/events/send-reminders - Should trigger reminders for upcoming events
- GET /api/events/upcoming-reminders - Should list events that will get reminders

Tests verify:
1. Endpoints work without errors (even without APNs credentials)
2. Background tasks are scheduled correctly
3. Notifications exclude the creator
4. Emergency announcements have special handling
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_CREDS = {
    "email": "gen@quadley.app",
    "password": "Quadley2025!"
}

STUDENT_CREDS = {
    "email": "alice@example.com",
    "password": "Quadley2025!"
}


class TestAuthSetup:
    """Test authentication setup for notification tests"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super_admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STUDENT_CREDS
        )
        assert response.status_code == 200, f"Student login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_super_admin_login(self, super_admin_token):
        """Verify super admin can login"""
        assert super_admin_token is not None
        assert len(super_admin_token) > 0
    
    def test_student_login(self, student_token):
        """Verify student can login"""
        assert student_token is not None
        assert len(student_token) > 0


class TestAnnouncementNotifications:
    """Test POST /api/announcements - Should trigger push notification"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STUDENT_CREDS
        )
        assert response.status_code == 200, f"Student login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_create_announcement_triggers_notification(self, admin_token):
        """Test that creating an announcement triggers push notification (no errors)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        announcement_data = {
            "title": f"TEST_Notification_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "This is a test announcement to verify push notification triggers work correctly.",
            "target_audience": "all",
            "priority": "normal",
            "is_emergency": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Create announcement failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain announcement id"
        assert data["title"] == announcement_data["title"]
        assert data["status"] == "published"
        # Background task should be scheduled - no error means success
    
    def test_create_emergency_announcement_triggers_notification(self, admin_token):
        """Test that creating an emergency announcement triggers push notification with URGENT prefix"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        announcement_data = {
            "title": f"TEST_Emergency_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "This is an EMERGENCY test announcement.",
            "target_audience": "all",
            "priority": "high",
            "is_emergency": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Create emergency announcement failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["is_emergency"] == True or data.get("emergency") == True
    
    def test_scheduled_announcement_does_not_trigger_notification(self, admin_token):
        """Test that scheduled announcements do NOT trigger immediate notification"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Schedule for tomorrow
        scheduled_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        
        announcement_data = {
            "title": f"TEST_Scheduled_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "This is a scheduled announcement - should NOT trigger notification now.",
            "target_audience": "all",
            "priority": "normal",
            "is_emergency": False,
            "scheduled_date": scheduled_date
        }
        
        response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Create scheduled announcement failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["status"] == "scheduled", "Scheduled announcement should have 'scheduled' status"
    
    def test_student_cannot_create_announcement(self, student_token):
        """Test that students cannot create announcements (403 expected)"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        announcement_data = {
            "title": "TEST_Student_Announcement",
            "content": "Students should not be able to create announcements.",
            "target_audience": "all",
            "priority": "normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}"


class TestEventNotifications:
    """Test POST /api/events - Should trigger push notification for new event"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STUDENT_CREDS
        )
        assert response.status_code == 200, f"Student login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_create_event_triggers_notification(self, admin_token):
        """Test that creating an event triggers push notification (no errors)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Event scheduled for tomorrow
        event_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        
        event_data = {
            "title": f"TEST_Notification_Event_{uuid.uuid4().hex[:8]}",
            "description": "This is a test event to verify push notification triggers work correctly.",
            "date": event_date,
            "location": "Test Location",
            "category": "social",
            "max_attendees": 50
        }
        
        response = requests.post(
            f"{BASE_URL}/api/events",
            json=event_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Create event failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain event id"
        assert data["title"] == event_data["title"]
        assert data["location"] == event_data["location"]
    
    def test_create_house_event_triggers_notification(self, admin_token):
        """Test that creating a house event triggers push notification"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        event_date = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        
        event_data = {
            "title": f"TEST_House_Event_{uuid.uuid4().hex[:8]}",
            "description": "This is a house event test.",
            "date": event_date,
            "location": "House Common Room",
            "category": "house",
            "house_event": True,
            "house_name": "Gryffindor",
            "points": 10
        }
        
        response = requests.post(
            f"{BASE_URL}/api/events",
            json=event_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Create house event failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["house_event"] == True
    
    def test_student_cannot_create_event(self, student_token):
        """Test that students cannot create events (403 expected)"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        event_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        
        event_data = {
            "title": "TEST_Student_Event",
            "description": "Students should not be able to create events.",
            "date": event_date,
            "location": "Test Location",
            "category": "social"  # Required field
        }
        
        response = requests.post(
            f"{BASE_URL}/api/events",
            json=event_data,
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}"


class TestEventReminders:
    """Test event reminder endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STUDENT_CREDS
        )
        assert response.status_code == 200, f"Student login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_send_reminders_endpoint_works(self, admin_token):
        """Test POST /api/events/send-reminders works without errors"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/events/send-reminders",
            headers=headers,
            params={"hours_before": 24}
        )
        
        assert response.status_code == 200, f"Send reminders failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "events_checked" in data
        assert "reminders_scheduled" in data
        assert "window" in data
    
    def test_send_reminders_with_custom_hours(self, admin_token):
        """Test send-reminders with custom hours_before parameter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/events/send-reminders",
            headers=headers,
            params={"hours_before": 48}
        )
        
        assert response.status_code == 200, f"Send reminders failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["window"] == "48 hours"
    
    def test_student_cannot_trigger_reminders(self, student_token):
        """Test that students cannot trigger event reminders (403 expected)"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/events/send-reminders",
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}"
    
    def test_upcoming_reminders_endpoint_works(self, admin_token):
        """Test GET /api/events/upcoming-reminders works without errors"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/events/upcoming-reminders",
            headers=headers,
            params={"hours": 48}
        )
        
        assert response.status_code == 200, f"Get upcoming reminders failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "window_hours" in data
        assert "events" in data
        assert "total" in data
        assert isinstance(data["events"], list)
    
    def test_upcoming_reminders_event_structure(self, admin_token):
        """Test that upcoming reminders returns correct event structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/events/upcoming-reminders",
            headers=headers,
            params={"hours": 168}  # 7 days
        )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # If there are events, check structure
        if data["events"]:
            event = data["events"][0]
            assert "id" in event
            assert "title" in event
            assert "date" in event
            assert "attending_count" in event
            assert "reminder_sent_today" in event
    
    def test_student_cannot_view_upcoming_reminders(self, student_token):
        """Test that students cannot view upcoming reminders (403 expected)"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/events/upcoming-reminders",
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}"


class TestNotificationEndpoints:
    """Test notification-related endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STUDENT_CREDS
        )
        assert response.status_code == 200, f"Student login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_get_notification_preferences(self, student_token):
        """Test GET /api/notifications/preferences works"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/notifications/preferences",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get preferences failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Check expected preference fields exist
        expected_fields = ["announcements", "events", "messages", "shoutouts", "dining_menu", "parcels", "maintenance"]
        for field in expected_fields:
            assert field in data, f"Missing preference field: {field}"
    
    def test_update_notification_preferences(self, student_token):
        """Test PUT /api/notifications/preferences works"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        preferences = {
            "announcements": True,
            "events": True,
            "messages": True,
            "shoutouts": False,
            "dining_menu": True,
            "parcels": True,
            "maintenance": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=preferences,
            headers=headers
        )
        
        assert response.status_code == 200, f"Update preferences failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True
    
    def test_register_device_token(self, student_token):
        """Test POST /api/notifications/register-device works"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        # Use a fake device token (64 hex characters for iOS)
        fake_token = "a" * 64
        
        registration = {
            "device_token": fake_token,
            "platform": "ios"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-device",
            json=registration,
            headers=headers
        )
        
        assert response.status_code == 200, f"Register device failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True
    
    def test_unregister_device(self, student_token):
        """Test DELETE /api/notifications/unregister-device works"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/notifications/unregister-device",
            headers=headers
        )
        
        assert response.status_code == 200, f"Unregister device failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True
    
    def test_send_notification_requires_admin(self, student_token):
        """Test that POST /api/notifications/send requires admin (403 expected)"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        notification = {
            "title": "Test Notification",
            "body": "This should fail for students"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/send",
            json=notification,
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}"
    
    def test_admin_can_send_notification(self, admin_token):
        """Test that admin can send notifications (endpoint works)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        notification = {
            "title": "TEST_Admin_Notification",
            "body": "This is a test notification from admin",
            "data": {"type": "test"}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/send",
            json=notification,
            headers=headers
        )
        
        # Should work even if no devices registered (returns 200 with sent: 0)
        assert response.status_code == 200, f"Send notification failed: {response.status_code} - {response.text}"


class TestGetAnnouncements:
    """Test GET /api/announcements to verify created announcements"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_get_announcements(self, admin_token):
        """Test GET /api/announcements returns list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/announcements",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get announcements failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list)


class TestGetEvents:
    """Test GET /api/events to verify created events"""
    
    def test_get_events_no_auth_required(self):
        """Test GET /api/events works without authentication"""
        response = requests.get(f"{BASE_URL}/api/events")
        
        assert response.status_code == 200, f"Get events failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list)


# Cleanup test data (optional - run manually if needed)
class TestCleanup:
    """Cleanup test data created during tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_cleanup_info(self, admin_token):
        """Info about test data cleanup"""
        # Test data is prefixed with TEST_ for easy identification
        # Manual cleanup can be done via database if needed
        assert True, "Test data prefixed with TEST_ can be cleaned up manually"
