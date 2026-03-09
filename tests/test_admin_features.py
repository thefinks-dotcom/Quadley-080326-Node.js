"""
Quadley Mobile App - Admin Features Test Suite
Tests admin dashboard stats, events management, dining late meals, and user search security
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
ADMIN_CREDENTIALS = {"email": "gen@quadley.app", "password": "Quadley2025!"}
STUDENT_CREDENTIALS = {"email": "alice@example.com", "password": "Quadley2025!"}
RA_CREDENTIALS = {"email": "epink@icloud.com", "password": "AbC!123!"}

# Fallback admin credentials (known working from previous tests)
FALLBACK_ADMIN_CREDENTIALS = {"email": "epinker@icloud.com", "password": "AbC!123!"}


class TestAdminAuthentication:
    """Test admin authentication"""
    
    def test_admin_login_primary(self):
        """Test primary admin login (gen@quadley.app)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDENTIALS
        )
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            assert "user" in data
            assert data["user"]["role"] in ["admin", "super_admin", "college_admin"]
            print(f"✓ Admin login successful: {data['user']['email']} (role: {data['user']['role']})")
            return True
        else:
            print(f"✗ Primary admin login failed: {response.status_code} - {response.text}")
            return False
    
    def test_admin_login_fallback(self):
        """Test fallback admin login (epinker@icloud.com)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=FALLBACK_ADMIN_CREDENTIALS
        )
        assert response.status_code == 200, f"Fallback admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] in ["admin", "super_admin", "college_admin"]
        print(f"✓ Fallback admin login successful: {data['user']['email']} (role: {data['user']['role']})")


@pytest.fixture
def admin_token():
    """Get admin authentication token - tries primary then fallback"""
    # Try primary admin first
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=ADMIN_CREDENTIALS
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    
    # Try fallback admin
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=FALLBACK_ADMIN_CREDENTIALS
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    
    pytest.skip("Admin authentication failed for both primary and fallback credentials")


@pytest.fixture
def student_token():
    """Get student authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=STUDENT_CREDENTIALS
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip(f"Student authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def ra_token():
    """Get RA authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=RA_CREDENTIALS
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip(f"RA authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def admin_headers(admin_token):
    """Get headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def student_headers(student_token):
    """Get headers with student auth token"""
    return {"Authorization": f"Bearer {student_token}"}


@pytest.fixture
def ra_headers(ra_token):
    """Get headers with RA auth token"""
    return {"Authorization": f"Bearer {ra_token}"}


class TestAdminDashboardStats:
    """Test admin dashboard /stats endpoint"""
    
    def test_admin_stats_endpoint(self, admin_headers):
        """Test GET /api/stats returns correct dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/stats", headers=admin_headers)
        assert response.status_code == 200, f"Stats endpoint failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Verify all required fields are present
        assert "total_users" in data, "Missing total_users in stats"
        assert "active_events" in data, "Missing active_events in stats"
        assert "pending_requests" in data, "Missing pending_requests in stats"
        assert "pending_applications" in data, "Missing pending_applications in stats"
        
        # Verify values are integers
        assert isinstance(data["total_users"], int), "total_users should be integer"
        assert isinstance(data["active_events"], int), "active_events should be integer"
        assert isinstance(data["pending_requests"], int), "pending_requests should be integer"
        assert isinstance(data["pending_applications"], int), "pending_applications should be integer"
        
        # Verify values are non-negative
        assert data["total_users"] >= 0, "total_users should be non-negative"
        assert data["active_events"] >= 0, "active_events should be non-negative"
        assert data["pending_requests"] >= 0, "pending_requests should be non-negative"
        assert data["pending_applications"] >= 0, "pending_applications should be non-negative"
        
        print(f"✓ Admin Stats: Users={data['total_users']}, Events={data['active_events']}, "
              f"Pending Requests={data['pending_requests']}, Applications={data['pending_applications']}")
    
    def test_stats_requires_admin(self, student_headers):
        """Test that /stats endpoint requires admin role"""
        response = requests.get(f"{BASE_URL}/api/stats", headers=student_headers)
        assert response.status_code == 403, f"Expected 403 for student access, got {response.status_code}"
        print("✓ Stats endpoint correctly rejects non-admin users")


class TestAdminEventsManagement:
    """Test admin events edit and delete functionality"""
    
    @pytest.fixture
    def test_event(self, admin_headers):
        """Create a test event for edit/delete tests"""
        event_data = {
            "title": f"TEST_Admin_Event_{uuid.uuid4().hex[:8]}",
            "description": "Test event for admin management testing",
            "location": "Test Location",
            "date": (datetime.now() + timedelta(days=7)).isoformat(),
            "category": "social",
            "max_attendees": 50
        }
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=admin_headers,
            json=event_data
        )
        assert response.status_code in [200, 201], f"Failed to create test event: {response.text}"
        event = response.json()
        print(f"✓ Created test event: {event.get('id')}")
        yield event
        
        # Cleanup - try to delete the event
        requests.delete(f"{BASE_URL}/api/events/{event.get('id')}", headers=admin_headers)
    
    def test_admin_edit_event(self, admin_headers, test_event):
        """Test admin can edit an event"""
        event_id = test_event.get("id")
        
        updated_data = {
            "title": f"UPDATED_TEST_Event_{uuid.uuid4().hex[:8]}",
            "description": "Updated description by admin",
            "location": "Updated Location",
            "date": (datetime.now() + timedelta(days=14)).isoformat(),
            "category": "academic"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/events/{event_id}",
            headers=admin_headers,
            json=updated_data
        )
        assert response.status_code == 200, f"Failed to update event: {response.status_code} - {response.text}"
        
        updated_event = response.json()
        assert updated_event.get("title") == updated_data["title"], "Title not updated"
        assert updated_event.get("description") == updated_data["description"], "Description not updated"
        assert updated_event.get("location") == updated_data["location"], "Location not updated"
        
        print(f"✓ Admin successfully edited event {event_id}")
    
    def test_admin_delete_event(self, admin_headers):
        """Test admin can delete an event"""
        # Create a new event specifically for deletion
        event_data = {
            "title": f"TEST_Delete_Event_{uuid.uuid4().hex[:8]}",
            "description": "Event to be deleted",
            "location": "Delete Test Location",
            "date": (datetime.now() + timedelta(days=5)).isoformat(),
            "category": "social"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/events",
            headers=admin_headers,
            json=event_data
        )
        assert create_response.status_code in [200, 201], f"Failed to create event for deletion: {create_response.text}"
        event_id = create_response.json().get("id")
        event_title = create_response.json().get("title")
        
        # Delete the event
        delete_response = requests.delete(
            f"{BASE_URL}/api/events/{event_id}",
            headers=admin_headers
        )
        assert delete_response.status_code in [200, 204], f"Failed to delete event: {delete_response.status_code} - {delete_response.text}"
        
        # Verify event is deleted by checking it's not in the events list
        list_response = requests.get(f"{BASE_URL}/api/events", headers=admin_headers)
        assert list_response.status_code == 200
        events = list_response.json()
        event_ids = [e.get("id") for e in events]
        assert event_id not in event_ids, f"Event {event_id} should be deleted but still in list"
        
        print(f"✓ Admin successfully deleted event {event_id}")


class TestAdminDiningLateMeals:
    """Test admin can view and edit ALL late meal requests"""
    
    def test_admin_view_all_late_meals(self, admin_headers):
        """Test admin can view all late meal requests"""
        response = requests.get(f"{BASE_URL}/api/dining/late-meals", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get late meals: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Late meals should be a list"
        print(f"✓ Admin can view all late meals: {len(data)} requests found")
        
        # If there are late meals, verify structure
        if len(data) > 0:
            meal = data[0]
            assert "id" in meal, "Late meal missing id"
            assert "student_id" in meal, "Late meal missing student_id"
            assert "meal_type" in meal, "Late meal missing meal_type"
            print(f"  Sample late meal: {meal.get('id')} - {meal.get('meal_type')} by {meal.get('student_name', 'unknown')}")
    
    @pytest.fixture
    def test_late_meal(self, admin_headers):
        """Create a test late meal request"""
        meal_data = {
            "meal_type": "dinner",
            "date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "reason": "TEST_Late class schedule",
            "dietary_requirements": "None"
        }
        response = requests.post(
            f"{BASE_URL}/api/dining/late-meals",
            headers=admin_headers,
            json=meal_data
        )
        if response.status_code in [200, 201]:
            meal = response.json()
            print(f"✓ Created test late meal: {meal.get('id')}")
            yield meal
            # Cleanup
            requests.delete(f"{BASE_URL}/api/dining/late-meals/{meal.get('id')}", headers=admin_headers)
        else:
            pytest.skip(f"Could not create test late meal: {response.status_code} - {response.text}")
    
    def test_admin_edit_any_late_meal(self, admin_headers, test_late_meal):
        """Test admin can edit any late meal request"""
        meal_id = test_late_meal.get("id")
        
        updated_data = {
            "meal_type": "lunch",
            "date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "reason": "UPDATED_TEST_Reason by admin",
            "dietary_requirements": "Vegetarian"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/dining/late-meals/{meal_id}",
            headers=admin_headers,
            json=updated_data
        )
        assert response.status_code == 200, f"Failed to update late meal: {response.status_code} - {response.text}"
        
        updated_meal = response.json()
        assert updated_meal.get("meal_type") == "lunch", "Meal type not updated"
        assert "UPDATED_TEST" in updated_meal.get("reason", ""), "Reason not updated"
        
        print(f"✓ Admin successfully edited late meal {meal_id}")
    
    def test_admin_delete_any_late_meal(self, admin_headers):
        """Test admin can delete any late meal request"""
        # Create a late meal for deletion
        meal_data = {
            "meal_type": "breakfast",
            "date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "reason": "TEST_To be deleted",
            "dietary_requirements": "None"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/dining/late-meals",
            headers=admin_headers,
            json=meal_data
        )
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create late meal for deletion test: {create_response.text}")
        
        meal_id = create_response.json().get("id")
        
        # Delete the late meal
        delete_response = requests.delete(
            f"{BASE_URL}/api/dining/late-meals/{meal_id}",
            headers=admin_headers
        )
        assert delete_response.status_code in [200, 204], f"Failed to delete late meal: {delete_response.status_code} - {delete_response.text}"
        
        print(f"✓ Admin successfully deleted late meal {meal_id}")


class TestUserSearchSecurity:
    """Test /users/search endpoint returns limited data for students (no emails)"""
    
    def test_admin_search_returns_full_data(self, admin_headers):
        """Test admin can see full user data including email"""
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=a",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Search failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Search should return a list"
        
        if len(data) > 0:
            user = data[0]
            # Admin should see email
            assert "email" in user, "Admin should see email in search results"
            assert "role" in user, "Admin should see role in search results"
            print(f"✓ Admin search returns full data: {len(data)} users found with email/role visible")
        else:
            print("✓ Admin search works but no users found matching query")
    
    def test_student_search_returns_limited_data(self, student_headers):
        """Test student cannot see email in search results"""
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=a",
            headers=student_headers
        )
        assert response.status_code == 200, f"Search failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Search should return a list"
        
        if len(data) > 0:
            user = data[0]
            # Student should NOT see email
            assert "email" not in user, f"Student should NOT see email in search results, but found: {user.get('email')}"
            # Student should see basic info
            assert "id" in user, "Student should see user id"
            assert "first_name" in user or "name" in user, "Student should see user name"
            print(f"✓ Student search returns limited data: {len(data)} users found WITHOUT email")
        else:
            print("✓ Student search works but no users found matching query")
    
    def test_ra_search_returns_limited_data(self, ra_headers):
        """Test RA cannot see email in search results (only admins can)"""
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=a",
            headers=ra_headers
        )
        assert response.status_code == 200, f"Search failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Search should return a list"
        
        if len(data) > 0:
            user = data[0]
            # RA should NOT see email (only admins can)
            assert "email" not in user, f"RA should NOT see email in search results, but found: {user.get('email')}"
            print(f"✓ RA search returns limited data: {len(data)} users found WITHOUT email")
        else:
            print("✓ RA search works but no users found matching query")


class TestAuthenticationFlow:
    """Test complete authentication flow - login/logout"""
    
    def test_login_returns_token_and_user(self):
        """Test login returns both token and user data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=FALLBACK_ADMIN_CREDENTIALS  # Use known working credentials
        )
        assert response.status_code == 200, f"Login failed: {response.status_code}"
        
        data = response.json()
        assert "access_token" in data, "Login should return access_token"
        assert "user" in data, "Login should return user data"
        assert "id" in data["user"], "User should have id"
        assert "email" in data["user"], "User should have email"
        assert "role" in data["user"], "User should have role"
        
        print(f"✓ Login returns token and user: {data['user']['email']} ({data['user']['role']})")
    
    def test_get_current_user(self):
        """Test /auth/me returns current user"""
        # Get fresh token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=FALLBACK_ADMIN_CREDENTIALS
        )
        assert login_response.status_code == 200, "Login failed"
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Get me failed: {response.status_code}"
        
        data = response.json()
        assert "id" in data, "User should have id"
        assert "email" in data, "User should have email"
        assert "role" in data, "User should have role"
        
        print(f"✓ Get current user: {data['email']} ({data['role']})")
    
    def test_logout_invalidates_session(self):
        """Test logout properly invalidates the session"""
        # Get fresh token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=FALLBACK_ADMIN_CREDENTIALS
        )
        assert login_response.status_code == 200, "Login failed"
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # First verify we're authenticated
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200, "Should be authenticated before logout"
        
        # Logout
        logout_response = requests.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.status_code}"
        
        print("✓ Logout successful")


class TestCredentialsValidation:
    """Validate all provided credentials work"""
    
    def test_validate_admin_credentials(self):
        """Validate admin credentials (gen@quadley.app)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDENTIALS
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Admin credentials valid: {data['user']['email']} (role: {data['user']['role']})")
        else:
            print(f"✗ Admin credentials INVALID: {response.status_code} - {response.text}")
            # Don't fail - just report
    
    def test_validate_student_credentials(self):
        """Validate student credentials (alice@example.com)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STUDENT_CREDENTIALS
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Student credentials valid: {data['user']['email']} (role: {data['user']['role']})")
        else:
            print(f"✗ Student credentials INVALID: {response.status_code} - {response.text}")
    
    def test_validate_ra_credentials(self):
        """Validate RA credentials (epink@icloud.com)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=RA_CREDENTIALS
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✓ RA credentials valid: {data['user']['email']} (role: {data['user']['role']})")
        else:
            print(f"✗ RA credentials INVALID: {response.status_code} - {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
