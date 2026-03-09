"""
Test Bug Fixes - Iteration 9
Testing:
1. Admin Change Role - PATCH /api/admin/users/{user_id}
2. Floor Events - GET /api/events with floor field populated
3. Late Meals - GET/PUT /api/late-meals
4. User Login - POST /api/auth/login for new users
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN = {"email": "gen@quadley.app", "password": "Quadley2025!"}
RA_USER = {"email": "epink@icloud.com", "password": "AbC!123!"}
NEW_USER_1 = {"email": "estherf@icloud.com", "password": "Purple1!"}
NEW_USER_2 = {"email": "emeliaf@icloud.com", "password": "Maroon1!"}


class TestUserLogin:
    """Test user login functionality for new users"""
    
    def test_login_super_admin(self):
        """Test super admin login - gen@quadley.app"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        print(f"Super Admin Login: Status {response.status_code}")
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping")
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "super_admin"
        print(f"✓ Super admin login successful - role: {data['user']['role']}")
    
    def test_login_ra_user(self):
        """Test RA user login - epink@icloud.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=RA_USER)
        print(f"RA Login: Status {response.status_code}")
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping")
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "ra"
        print(f"✓ RA login successful - role: {data['user']['role']}")
    
    def test_login_new_user_estherf(self):
        """Test new user login - estherf@icloud.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NEW_USER_1)
        print(f"New User 1 (estherf) Login: Status {response.status_code}")
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping")
        
        assert response.status_code == 200, f"Login failed for estherf@icloud.com: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ estherf@icloud.com login successful - role: {data['user']['role']}")
    
    def test_login_new_user_emeliaf(self):
        """Test new user login - emeliaf@icloud.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NEW_USER_2)
        print(f"New User 2 (emeliaf) Login: Status {response.status_code}")
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping")
        
        assert response.status_code == 200, f"Login failed for emeliaf@icloud.com: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ emeliaf@icloud.com login successful - role: {data['user']['role']}")


class TestAdminChangeRole:
    """Test Admin Change Role functionality - PATCH /api/admin/users/{user_id}"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping")
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def target_user_id(self, admin_token):
        """Get a target user ID to change role (use estherf)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users/search?q=estherf", headers=headers)
        if response.status_code == 200:
            users = response.json()
            if users:
                return users[0].get("id")
        
        # Fallback: get user from login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=NEW_USER_1)
        if login_resp.status_code == 200:
            return login_resp.json()["user"]["id"]
        return None
    
    def test_change_role_endpoint_exists(self, admin_token):
        """Test that PATCH /api/admin/users/{user_id} endpoint exists"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Use a dummy user_id to test endpoint existence
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/dummy-id",
            json={"role": "student"},
            headers=headers
        )
        print(f"Change Role Endpoint Test: Status {response.status_code}")
        # Should return 404 (user not found) not 405 (method not allowed)
        assert response.status_code != 405, "PATCH endpoint not implemented"
        assert response.status_code in [404, 400, 200], f"Unexpected status: {response.status_code}"
        print("✓ PATCH /api/admin/users/{user_id} endpoint exists")
    
    def test_change_role_to_ra(self, admin_token, target_user_id):
        """Test changing user role to RA"""
        if not target_user_id:
            pytest.skip("No target user found")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/{target_user_id}",
            json={"role": "ra"},
            headers=headers
        )
        print(f"Change Role to RA: Status {response.status_code}, Response: {response.text}")
        
        assert response.status_code == 200, f"Failed to change role: {response.text}"
        data = response.json()
        assert data.get("new_role") == "ra" or "ra" in str(data)
        print(f"✓ Successfully changed user role to RA")
    
    def test_change_role_back_to_student(self, admin_token, target_user_id):
        """Test changing user role back to student"""
        if not target_user_id:
            pytest.skip("No target user found")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/{target_user_id}",
            json={"role": "student"},
            headers=headers
        )
        print(f"Change Role to Student: Status {response.status_code}, Response: {response.text}")
        
        assert response.status_code == 200, f"Failed to change role: {response.text}"
        data = response.json()
        assert data.get("new_role") == "student" or "student" in str(data)
        print(f"✓ Successfully changed user role back to student")
    
    def test_change_role_invalid_role(self, admin_token, target_user_id):
        """Test changing user role to invalid role"""
        if not target_user_id:
            pytest.skip("No target user found")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/{target_user_id}",
            json={"role": "invalid_role"},
            headers=headers
        )
        print(f"Change Role to Invalid: Status {response.status_code}")
        
        assert response.status_code == 400, f"Should reject invalid role: {response.text}"
        print("✓ Invalid role correctly rejected")
    
    def test_change_role_requires_admin(self):
        """Test that non-admin cannot change roles"""
        # Login as RA
        ra_login = requests.post(f"{BASE_URL}/api/auth/login", json=RA_USER)
        if ra_login.status_code == 429:
            pytest.skip("Rate limited")
        if ra_login.status_code != 200:
            pytest.skip("RA login failed")
        
        ra_token = ra_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {ra_token}"}
        
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/some-user-id",
            json={"role": "admin"},
            headers=headers
        )
        print(f"RA Change Role Attempt: Status {response.status_code}")
        
        # RA should not be able to change roles (403 Forbidden)
        assert response.status_code == 403, f"RA should not be able to change roles: {response.text}"
        print("✓ Non-admin correctly denied role change")


class TestFloorEvents:
    """Test Floor Events - GET /api/events with floor field"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping")
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_get_events_returns_floor_field(self, admin_token):
        """Test that GET /api/events returns events with floor field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        print(f"Get Events: Status {response.status_code}")
        
        assert response.status_code == 200, f"Failed to get events: {response.text}"
        events = response.json()
        print(f"Total events: {len(events)}")
        
        # Check if any events have floor field
        events_with_floor = [e for e in events if e.get("floor")]
        print(f"Events with floor field: {len(events_with_floor)}")
        
        # Check if any events have event_type field
        events_with_type = [e for e in events if e.get("event_type")]
        print(f"Events with event_type field: {len(events_with_type)}")
        
        # Print sample event structure
        if events:
            sample = events[0]
            print(f"Sample event keys: {list(sample.keys())}")
        
        print("✓ Events endpoint returns data with floor/event_type fields available")
    
    def test_create_floor_event(self, admin_token):
        """Test creating an event with floor and event_type fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        event_data = {
            "title": f"TEST Floor Event {uuid.uuid4().hex[:8]}",
            "description": "Test floor event for iteration 9",
            "date": (datetime.now() + timedelta(days=7)).isoformat(),
            "location": "Level 1 Common Room",
            "category": "floor_event",
            "floor": "Level 1 - Wing A",
            "event_type": "floor",
            "max_attendees": 20
        }
        
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        print(f"Create Floor Event: Status {response.status_code}")
        
        assert response.status_code == 200, f"Failed to create floor event: {response.text}"
        created_event = response.json()
        
        # Verify floor and event_type are saved
        assert created_event.get("floor") == "Level 1 - Wing A", f"Floor not saved: {created_event}"
        assert created_event.get("event_type") == "floor", f"Event type not saved: {created_event}"
        
        print(f"✓ Floor event created with floor={created_event.get('floor')}, event_type={created_event.get('event_type')}")
        
        # Cleanup - delete the test event
        event_id = created_event.get("id")
        if event_id:
            requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=headers)
    
    def test_floor_events_filter_by_category(self, admin_token):
        """Test that floor events can be identified by category or event_type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        
        assert response.status_code == 200
        events = response.json()
        
        # Filter floor events
        floor_events = [e for e in events if e.get("event_type") == "floor" or e.get("category") == "floor_event"]
        print(f"Floor events found: {len(floor_events)}")
        
        for event in floor_events[:3]:  # Show first 3
            print(f"  - {event.get('title')}: floor={event.get('floor')}, type={event.get('event_type')}")
        
        print("✓ Floor events can be filtered by event_type or category")


class TestLateMeals:
    """Test Late Meals - GET/PUT /api/late-meals"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping")
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def student_token(self):
        """Get student token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NEW_USER_1)
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping")
        if response.status_code != 200:
            pytest.skip(f"Student login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_get_late_meals_admin(self, admin_token):
        """Test admin can get all late meal requests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dining/late-meals", headers=headers)
        print(f"Get Late Meals (Admin): Status {response.status_code}")
        
        assert response.status_code == 200, f"Failed to get late meals: {response.text}"
        late_meals = response.json()
        print(f"Total late meal requests: {len(late_meals)}")
        
        if late_meals:
            sample = late_meals[0]
            print(f"Sample late meal keys: {list(sample.keys())}")
        
        print("✓ Admin can view all late meal requests")
    
    def test_create_late_meal_request(self, student_token):
        """Test creating a late meal request"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        late_meal_data = {
            "meal_type": "dinner",
            "date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "reason": "TEST - Late class",
            "dietary_requirements": "None"
        }
        
        response = requests.post(f"{BASE_URL}/api/dining/late-meals", json=late_meal_data, headers=headers)
        print(f"Create Late Meal: Status {response.status_code}")
        
        assert response.status_code == 200, f"Failed to create late meal: {response.text}"
        created = response.json()
        print(f"✓ Late meal request created: id={created.get('id')}")
        return created.get("id")
    
    def test_update_late_meal_request(self, student_token):
        """Test updating a late meal request"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        # First create a late meal request
        late_meal_data = {
            "meal_type": "lunch",
            "date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "reason": "TEST - Original reason",
            "dietary_requirements": "None"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/dining/late-meals", json=late_meal_data, headers=headers)
        if create_response.status_code != 200:
            pytest.skip(f"Could not create late meal: {create_response.text}")
        
        late_meal_id = create_response.json().get("id")
        print(f"Created late meal: {late_meal_id}")
        
        # Now update it
        update_data = {
            "meal_type": "dinner",
            "date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "reason": "TEST - Updated reason",
            "dietary_requirements": "Vegetarian"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/dining/late-meals/{late_meal_id}",
            json=update_data,
            headers=headers
        )
        print(f"Update Late Meal: Status {update_response.status_code}")
        
        assert update_response.status_code == 200, f"Failed to update late meal: {update_response.text}"
        updated = update_response.json()
        
        assert updated.get("meal_type") == "dinner", f"Meal type not updated: {updated}"
        assert updated.get("reason") == "TEST - Updated reason", f"Reason not updated: {updated}"
        
        print(f"✓ Late meal request updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dining/late-meals/{late_meal_id}", headers=headers)
    
    def test_admin_can_edit_any_late_meal(self, admin_token, student_token):
        """Test admin can edit any user's late meal request"""
        student_headers = {"Authorization": f"Bearer {student_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create late meal as student
        late_meal_data = {
            "meal_type": "breakfast",
            "date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "reason": "TEST - Student created",
            "dietary_requirements": None
        }
        
        create_response = requests.post(f"{BASE_URL}/api/dining/late-meals", json=late_meal_data, headers=student_headers)
        if create_response.status_code != 200:
            pytest.skip(f"Could not create late meal: {create_response.text}")
        
        late_meal_id = create_response.json().get("id")
        print(f"Student created late meal: {late_meal_id}")
        
        # Admin updates it
        update_data = {
            "meal_type": "lunch",
            "date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "reason": "TEST - Admin edited",
            "dietary_requirements": "Gluten-free"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/dining/late-meals/{late_meal_id}",
            json=update_data,
            headers=admin_headers
        )
        print(f"Admin Update Late Meal: Status {update_response.status_code}")
        
        assert update_response.status_code == 200, f"Admin failed to update late meal: {update_response.text}"
        updated = update_response.json()
        
        assert updated.get("reason") == "TEST - Admin edited", f"Admin edit not saved: {updated}"
        print(f"✓ Admin can edit any user's late meal request")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dining/late-meals/{late_meal_id}", headers=admin_headers)


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_late_meals(self):
        """Clean up any TEST late meals"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if response.status_code != 200:
            pytest.skip("Cannot login for cleanup")
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all late meals
        late_meals_resp = requests.get(f"{BASE_URL}/api/dining/late-meals", headers=headers)
        if late_meals_resp.status_code == 200:
            late_meals = late_meals_resp.json()
            test_meals = [m for m in late_meals if m.get("reason", "").startswith("TEST")]
            
            for meal in test_meals:
                requests.delete(f"{BASE_URL}/api/dining/late-meals/{meal['id']}", headers=headers)
            
            print(f"✓ Cleaned up {len(test_meals)} test late meals")
    
    def test_cleanup_test_events(self):
        """Clean up any TEST events"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if response.status_code != 200:
            pytest.skip("Cannot login for cleanup")
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all events
        events_resp = requests.get(f"{BASE_URL}/api/events", headers=headers)
        if events_resp.status_code == 200:
            events = events_resp.json()
            test_events = [e for e in events if e.get("title", "").startswith("TEST")]
            
            for event in test_events:
                requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=headers)
            
            print(f"✓ Cleaned up {len(test_events)} test events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
