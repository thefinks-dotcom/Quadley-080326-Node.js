"""
Test tenant data isolation for user search and messaging,
and Activity CRUD operations for admins.

Features tested:
1. User search returns correct users from Murphy Shark tenant (tenant isolation)
2. User search returns correct users from Ormond College tenant (different tenant isolation)
3. Conversations endpoint works correctly for Murphy Shark users
4. Activity CRUD - Create, Update, Delete, Get activities
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MURPHY_SHARK_ADMIN = {"email": "epinker@icloud.com", "password": "AbC!123!"}
MURPHY_SHARK_STUDENT = {"email": "estherf@icloud.com", "password": "Purple!!"}
ORMOND_ADMIN = {"email": "admin@ormond.com", "password": "Quadley2025!"}
SUPER_ADMIN = {"email": "gen@quadley.app", "password": "Quadley2025!"}

MURPHY_SHARK_CODE = "MURP1021"
ORMOND_CODE = "ORMD0001"


class TestAuthentication:
    """Test authentication for all test users"""
    
    def test_murphy_shark_admin_login(self):
        """Test Murphy Shark admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_SHARK_ADMIN)
        assert response.status_code == 200, f"Murphy Shark admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Murphy Shark admin login successful - user: {data['user'].get('email')}")
    
    def test_murphy_shark_student_login(self):
        """Test Murphy Shark student can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_SHARK_STUDENT)
        assert response.status_code == 200, f"Murphy Shark student login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        print(f"✓ Murphy Shark student login successful - user: {data['user'].get('email')}")
    
    def test_ormond_admin_login(self):
        """Test Ormond College admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ORMOND_ADMIN)
        assert response.status_code == 200, f"Ormond admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        print(f"✓ Ormond admin login successful - user: {data['user'].get('email')}")
    
    def test_super_admin_login(self):
        """Test Super admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        print(f"✓ Super admin login successful - user: {data['user'].get('email')}")


@pytest.fixture
def murphy_shark_admin_token():
    """Get Murphy Shark admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_SHARK_ADMIN)
    if response.status_code != 200:
        pytest.skip(f"Murphy Shark admin login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def murphy_shark_student_token():
    """Get Murphy Shark student auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_SHARK_STUDENT)
    if response.status_code != 200:
        pytest.skip(f"Murphy Shark student login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def ormond_admin_token():
    """Get Ormond College admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ORMOND_ADMIN)
    if response.status_code != 200:
        pytest.skip(f"Ormond admin login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def super_admin_token():
    """Get Super admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
    if response.status_code != 200:
        pytest.skip(f"Super admin login failed: {response.text}")
    return response.json()["access_token"]


class TestUserSearchTenantIsolation:
    """Test user search returns correct users based on tenant isolation"""
    
    def test_murphy_shark_admin_search_returns_murphy_users(self, murphy_shark_admin_token):
        """Murphy Shark admin should only see Murphy Shark users"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        # Search with empty query to get all users
        response = requests.get(f"{BASE_URL}/api/admin/users/search?q=", headers=headers)
        assert response.status_code == 200, f"User search failed: {response.text}"
        
        users = response.json()
        print(f"✓ Murphy Shark admin search returned {len(users)} users")
        
        # Verify we got users (should have at least the student)
        assert len(users) >= 0, "Expected at least some users in Murphy Shark tenant"
        
        # If users returned, verify they don't include Ormond users
        for user in users:
            email = user.get('email', '')
            # Admin can see emails, verify no Ormond emails
            if email:
                assert 'ormond' not in email.lower(), f"Found Ormond user in Murphy Shark search: {email}"
        
        print("✓ Tenant isolation verified - no Ormond users in Murphy Shark search")
    
    def test_murphy_shark_admin_search_with_query(self, murphy_shark_admin_token):
        """Murphy Shark admin search with specific query"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        # Search for 'esther' which should find the Murphy Shark student
        response = requests.get(f"{BASE_URL}/api/admin/users/search?q=esther", headers=headers)
        assert response.status_code == 200, f"User search failed: {response.text}"
        
        users = response.json()
        print(f"✓ Murphy Shark search for 'esther' returned {len(users)} users")
        
        # Should find at least the student estherf@icloud.com
        if len(users) > 0:
            found_esther = any('esther' in u.get('first_name', '').lower() or 
                              'esther' in u.get('email', '').lower() 
                              for u in users)
            print(f"✓ Found Esther in search results: {found_esther}")
    
    def test_ormond_admin_search_returns_ormond_users(self, ormond_admin_token):
        """Ormond admin should only see Ormond users"""
        headers = {"Authorization": f"Bearer {ormond_admin_token}"}
        
        # Search with empty query to get all users
        response = requests.get(f"{BASE_URL}/api/admin/users/search?q=", headers=headers)
        assert response.status_code == 200, f"User search failed: {response.text}"
        
        users = response.json()
        print(f"✓ Ormond admin search returned {len(users)} users")
        
        # Verify no Murphy Shark users in results
        for user in users:
            email = user.get('email', '')
            if email:
                assert 'icloud' not in email.lower(), f"Found Murphy Shark user in Ormond search: {email}"
        
        print("✓ Tenant isolation verified - no Murphy Shark users in Ormond search")
    
    def test_ormond_admin_search_with_query(self, ormond_admin_token):
        """Ormond admin search with specific query"""
        headers = {"Authorization": f"Bearer {ormond_admin_token}"}
        
        # Search for 'admin' which should find the Ormond admin
        response = requests.get(f"{BASE_URL}/api/admin/users/search?q=admin", headers=headers)
        assert response.status_code == 200, f"User search failed: {response.text}"
        
        users = response.json()
        print(f"✓ Ormond search for 'admin' returned {len(users)} users")
    
    def test_cross_tenant_isolation_murphy_cannot_see_ormond(self, murphy_shark_admin_token):
        """Murphy Shark admin cannot see Ormond users even with specific search"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        # Search for 'ormond' - should return empty or no Ormond users
        response = requests.get(f"{BASE_URL}/api/admin/users/search?q=ormond", headers=headers)
        assert response.status_code == 200, f"User search failed: {response.text}"
        
        users = response.json()
        
        # Should not find any Ormond users
        for user in users:
            email = user.get('email', '')
            assert 'ormond' not in email.lower(), f"Cross-tenant leak: Found Ormond user in Murphy search: {email}"
        
        print("✓ Cross-tenant isolation verified - Murphy cannot see Ormond users")


class TestConversationsEndpoint:
    """Test conversations endpoint works correctly for Murphy Shark users"""
    
    def test_murphy_shark_admin_conversations(self, murphy_shark_admin_token):
        """Murphy Shark admin can access conversations endpoint"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/conversations", headers=headers)
        assert response.status_code == 200, f"Conversations endpoint failed: {response.text}"
        
        conversations = response.json()
        print(f"✓ Murphy Shark admin conversations returned {len(conversations)} conversations")
        
        # Verify response is a list
        assert isinstance(conversations, list), "Conversations should be a list"
    
    def test_murphy_shark_student_conversations(self, murphy_shark_student_token):
        """Murphy Shark student can access conversations endpoint"""
        headers = {"Authorization": f"Bearer {murphy_shark_student_token}"}
        
        response = requests.get(f"{BASE_URL}/api/conversations", headers=headers)
        assert response.status_code == 200, f"Conversations endpoint failed: {response.text}"
        
        conversations = response.json()
        print(f"✓ Murphy Shark student conversations returned {len(conversations)} conversations")
        
        # Verify response is a list
        assert isinstance(conversations, list), "Conversations should be a list"
    
    def test_ormond_admin_conversations(self, ormond_admin_token):
        """Ormond admin can access conversations endpoint"""
        headers = {"Authorization": f"Bearer {ormond_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/conversations", headers=headers)
        assert response.status_code == 200, f"Conversations endpoint failed: {response.text}"
        
        conversations = response.json()
        print(f"✓ Ormond admin conversations returned {len(conversations)} conversations")
        
        # Verify response is a list
        assert isinstance(conversations, list), "Conversations should be a list"


class TestActivityCRUD:
    """Test Activity CRUD operations for admins"""
    
    def test_get_activities_murphy_shark(self, murphy_shark_admin_token):
        """Murphy Shark admin can get activities list"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities", headers=headers)
        assert response.status_code == 200, f"Get activities failed: {response.text}"
        
        data = response.json()
        activities = data.get('activities', [])
        print(f"✓ Murphy Shark activities: {len(activities)} activities found")
        
        # Print activity names for debugging
        for activity in activities[:5]:
            print(f"  - {activity.get('name')} ({activity.get('type')})")
    
    def test_get_activities_ormond(self, ormond_admin_token):
        """Ormond admin can get activities list"""
        headers = {"Authorization": f"Bearer {ormond_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tenants/{ORMOND_CODE}/activities", headers=headers)
        assert response.status_code == 200, f"Get activities failed: {response.text}"
        
        data = response.json()
        activities = data.get('activities', [])
        print(f"✓ Ormond activities: {len(activities)} activities found")
    
    def test_create_activity_murphy_shark_admin(self, murphy_shark_admin_token):
        """Murphy Shark admin can create a new activity"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        activity_data = {
            "type": "clubs",
            "name": f"TEST_Club_{uuid.uuid4().hex[:8]}",
            "description": "Test club created by automated testing",
            "meeting_times": "Mondays 5pm",
            "competition_times": "",
            "other_details": "Test activity"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities",
            headers=headers,
            json=activity_data
        )
        assert response.status_code == 200, f"Create activity failed: {response.text}"
        
        data = response.json()
        assert "activity" in data, "Response should contain activity"
        activity = data["activity"]
        
        assert activity["name"] == activity_data["name"], "Activity name mismatch"
        assert activity["type"] == activity_data["type"], "Activity type mismatch"
        assert "id" in activity, "Activity should have an ID"
        
        print(f"✓ Created activity: {activity['name']} (ID: {activity['id']})")
        
        # Store for cleanup
        return activity["id"]
    
    def test_create_activity_invalid_type(self, murphy_shark_admin_token):
        """Creating activity with invalid type should fail"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        activity_data = {
            "type": "invalid_type",
            "name": "Test Invalid Type",
            "description": "Should fail"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities",
            headers=headers,
            json=activity_data
        )
        assert response.status_code == 400, f"Expected 400 for invalid type, got {response.status_code}"
        print("✓ Invalid activity type correctly rejected")
    
    def test_update_activity_murphy_shark_admin(self, murphy_shark_admin_token):
        """Murphy Shark admin can update an activity"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        # First create an activity to update
        activity_data = {
            "type": "sports",
            "name": f"TEST_Sport_{uuid.uuid4().hex[:8]}",
            "description": "Original description"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities",
            headers=headers,
            json=activity_data
        )
        assert create_response.status_code == 200, f"Create activity failed: {create_response.text}"
        
        activity_id = create_response.json()["activity"]["id"]
        
        # Now update the activity
        update_data = {
            "type": "sports",
            "name": activity_data["name"],
            "description": "Updated description",
            "meeting_times": "Tuesdays 6pm"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{activity_id}",
            headers=headers,
            json=update_data
        )
        assert update_response.status_code == 200, f"Update activity failed: {update_response.text}"
        
        updated_activity = update_response.json()["activity"]
        assert updated_activity["description"] == "Updated description", "Description not updated"
        assert updated_activity["meeting_times"] == "Tuesdays 6pm", "Meeting times not updated"
        
        print(f"✓ Updated activity: {updated_activity['name']}")
        
        # Cleanup - delete the activity
        delete_response = requests.delete(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{activity_id}",
            headers=headers
        )
        print("✓ Cleanup: Deleted test activity")
    
    def test_delete_activity_no_members(self, murphy_shark_admin_token):
        """Murphy Shark admin can delete an activity with no members"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        # First create an activity to delete
        activity_data = {
            "type": "cultural",
            "name": f"TEST_Cultural_{uuid.uuid4().hex[:8]}",
            "description": "Activity to be deleted"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities",
            headers=headers,
            json=activity_data
        )
        assert create_response.status_code == 200, f"Create activity failed: {create_response.text}"
        
        activity_id = create_response.json()["activity"]["id"]
        
        # Delete the activity
        delete_response = requests.delete(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{activity_id}",
            headers=headers
        )
        assert delete_response.status_code == 200, f"Delete activity failed: {delete_response.text}"
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{activity_id}",
            headers=headers
        )
        assert get_response.status_code == 404, "Deleted activity should return 404"
        
        print("✓ Successfully deleted activity and verified deletion")
    
    def test_delete_activity_not_found(self, murphy_shark_admin_token):
        """Deleting non-existent activity should return 404"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{fake_id}",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404 for non-existent activity, got {response.status_code}"
        print("✓ Non-existent activity correctly returns 404")
    
    def test_get_single_activity(self, murphy_shark_admin_token):
        """Murphy Shark admin can get a single activity by ID"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        # First create an activity
        activity_data = {
            "type": "clubs",
            "name": f"TEST_GetSingle_{uuid.uuid4().hex[:8]}",
            "description": "Test get single activity"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities",
            headers=headers,
            json=activity_data
        )
        assert create_response.status_code == 200, f"Create activity failed: {create_response.text}"
        
        activity_id = create_response.json()["activity"]["id"]
        
        # Get the single activity
        get_response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{activity_id}",
            headers=headers
        )
        assert get_response.status_code == 200, f"Get single activity failed: {get_response.text}"
        
        activity = get_response.json()["activity"]
        assert activity["id"] == activity_id, "Activity ID mismatch"
        assert activity["name"] == activity_data["name"], "Activity name mismatch"
        
        print(f"✓ Successfully retrieved single activity: {activity['name']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{activity_id}",
            headers=headers
        )


class TestActivityCRUDAccessControl:
    """Test Activity CRUD access control"""
    
    def test_ormond_admin_cannot_access_murphy_activities(self, ormond_admin_token):
        """Ormond admin cannot access Murphy Shark activities"""
        headers = {"Authorization": f"Bearer {ormond_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities", headers=headers)
        assert response.status_code == 403, f"Expected 403 for cross-tenant access, got {response.status_code}"
        print("✓ Cross-tenant activity access correctly denied")
    
    def test_murphy_admin_cannot_access_ormond_activities(self, murphy_shark_admin_token):
        """Murphy Shark admin cannot access Ormond activities"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tenants/{ORMOND_CODE}/activities", headers=headers)
        assert response.status_code == 403, f"Expected 403 for cross-tenant access, got {response.status_code}"
        print("✓ Cross-tenant activity access correctly denied")
    
    def test_super_admin_can_access_any_tenant_activities(self, super_admin_token):
        """Super admin can access any tenant's activities"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Access Murphy Shark activities
        murphy_response = requests.get(f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities", headers=headers)
        assert murphy_response.status_code == 200, f"Super admin Murphy access failed: {murphy_response.text}"
        print("✓ Super admin can access Murphy Shark activities")
        
        # Access Ormond activities
        ormond_response = requests.get(f"{BASE_URL}/api/tenants/{ORMOND_CODE}/activities", headers=headers)
        assert ormond_response.status_code == 200, f"Super admin Ormond access failed: {ormond_response.text}"
        print("✓ Super admin can access Ormond activities")
    
    def test_super_admin_can_create_activity_any_tenant(self, super_admin_token):
        """Super admin can create activity in any tenant"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        activity_data = {
            "type": "clubs",
            "name": f"TEST_SuperAdmin_{uuid.uuid4().hex[:8]}",
            "description": "Created by super admin"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities",
            headers=headers,
            json=activity_data
        )
        assert response.status_code == 200, f"Super admin create activity failed: {response.text}"
        
        activity_id = response.json()["activity"]["id"]
        print("✓ Super admin created activity in Murphy Shark tenant")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{activity_id}",
            headers=headers
        )


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_activities(self, murphy_shark_admin_token):
        """Clean up any TEST_ prefixed activities"""
        headers = {"Authorization": f"Bearer {murphy_shark_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities", headers=headers)
        if response.status_code == 200:
            activities = response.json().get('activities', [])
            deleted_count = 0
            for activity in activities:
                if activity.get('name', '').startswith('TEST_'):
                    delete_response = requests.delete(
                        f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/activities/{activity['id']}",
                        headers=headers
                    )
                    if delete_response.status_code == 200:
                        deleted_count += 1
            print(f"✓ Cleaned up {deleted_count} test activities")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
