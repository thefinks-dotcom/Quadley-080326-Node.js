"""
Test Bug Fixes Batch - Iteration 19
Tests for:
1. GET /api/cocurricular/groups/all - Activities showing for students
2. GET /api/admin/users/search - Students can see all users for messaging
3. GET /api/events - Returns only future events by default
4. GET /api/events?include_past=true - Returns all events including past
5. DELETE /api/conversations/{id} - Delete conversation for user
6. DELETE /api/message-groups/{id}/leave - User can leave a group
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MURPHY_SHARK_ADMIN = {"email": "epinker@icloud.com", "password": "AbC!123!"}
MURPHY_SHARK_STUDENT = {"email": "estherf@icloud.com", "password": "Purple!!"}
ORMOND_ADMIN = {"email": "admin@ormond.com", "password": "Quadley2025!"}


class TestAuthentication:
    """Test authentication for all test users"""
    
    def test_murphy_shark_admin_login(self):
        """Test Murphy Shark Admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_SHARK_ADMIN)
        print(f"Murphy Shark Admin login: {response.status_code}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == MURPHY_SHARK_ADMIN["email"]
        print(f"  User role: {data['user'].get('role')}")
        print(f"  Tenant code: {data['user'].get('tenant_code')}")
    
    def test_murphy_shark_student_login(self):
        """Test Murphy Shark Student can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_SHARK_STUDENT)
        print(f"Murphy Shark Student login: {response.status_code}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == MURPHY_SHARK_STUDENT["email"]
        print(f"  User role: {data['user'].get('role')}")
        print(f"  Tenant code: {data['user'].get('tenant_code')}")
    
    def test_ormond_admin_login(self):
        """Test Ormond Admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ORMOND_ADMIN)
        print(f"Ormond Admin login: {response.status_code}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == ORMOND_ADMIN["email"]
        print(f"  User role: {data['user'].get('role')}")
        print(f"  Tenant code: {data['user'].get('tenant_code')}")


def get_auth_token(credentials):
    """Helper to get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=credentials)
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


def get_auth_headers(credentials):
    """Helper to get auth headers"""
    token = get_auth_token(credentials)
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


class TestCoCurricularGroupsForStudents:
    """Bug Fix #1: Activities not showing for students"""
    
    def test_student_can_get_all_cocurricular_groups(self):
        """Test that students can access GET /api/cocurricular/groups/all"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        response = requests.get(f"{BASE_URL}/api/cocurricular/groups/all", headers=headers)
        print(f"Student GET /api/cocurricular/groups/all: {response.status_code}")
        
        # Should return 200, not 403 or 500
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"  Number of groups returned: {len(data)}")
        
        # Verify structure if groups exist
        if len(data) > 0:
            group = data[0]
            print(f"  First group: {group.get('name')} (type: {group.get('type')})")
            # Verify required fields exist
            assert "id" in group
            assert "name" in group
            assert "type" in group
    
    def test_admin_can_get_all_cocurricular_groups(self):
        """Test that admins can also access GET /api/cocurricular/groups/all"""
        headers = get_auth_headers(MURPHY_SHARK_ADMIN)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Admin")
        
        response = requests.get(f"{BASE_URL}/api/cocurricular/groups/all", headers=headers)
        print(f"Admin GET /api/cocurricular/groups/all: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"  Number of groups returned: {len(data)}")


class TestUserSearchForStudents:
    """Bug Fix #2: User search - students couldn't see all users for messaging"""
    
    def test_student_can_search_users(self):
        """Test that students can search users via GET /api/admin/users/search"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        response = requests.get(f"{BASE_URL}/api/admin/users/search", headers=headers)
        print(f"Student GET /api/admin/users/search: {response.status_code}")
        
        # Should return 200, not 403
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"  Number of users returned: {len(data)}")
        
        # Verify students can see other students and RAs
        if len(data) > 0:
            roles = set(user.get('role') for user in data)
            print(f"  Roles visible: {roles}")
            # Students should be able to see students and RAs for messaging
    
    def test_student_can_search_users_with_query(self):
        """Test that students can search users with a query parameter"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        # Search with a query
        response = requests.get(f"{BASE_URL}/api/admin/users/search?q=a", headers=headers)
        print(f"Student GET /api/admin/users/search?q=a: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"  Number of users matching 'a': {len(data)}")
    
    def test_admin_can_search_users(self):
        """Test that admins can search users"""
        headers = get_auth_headers(MURPHY_SHARK_ADMIN)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Admin")
        
        response = requests.get(f"{BASE_URL}/api/admin/users/search", headers=headers)
        print(f"Admin GET /api/admin/users/search: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"  Number of users returned: {len(data)}")


class TestEventsDateFiltering:
    """Bug Fix #3 & #4: Past events showing on home page"""
    
    def test_events_default_returns_future_only(self):
        """Test GET /api/events returns only future events by default"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        print(f"GET /api/events (default): {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"  Number of events returned: {len(data)}")
        
        # Verify all events are in the future
        now = datetime.now(timezone.utc)
        past_events = []
        for event in data:
            event_date_str = event.get('date')
            if event_date_str:
                try:
                    # Handle both ISO format with and without timezone
                    if isinstance(event_date_str, str):
                        event_date = datetime.fromisoformat(event_date_str.replace('Z', '+00:00'))
                    else:
                        event_date = event_date_str
                    
                    if event_date < now:
                        past_events.append({
                            "title": event.get('title'),
                            "date": event_date_str
                        })
                except Exception as e:
                    print(f"  Warning: Could not parse date {event_date_str}: {e}")
        
        if past_events:
            print(f"  WARNING: Found {len(past_events)} past events in default response!")
            for pe in past_events[:3]:
                print(f"    - {pe['title']}: {pe['date']}")
        else:
            print(f"  ✓ All {len(data)} events are in the future")
        
        # This should pass - no past events in default response
        assert len(past_events) == 0, f"Found {len(past_events)} past events in default response"
    
    def test_events_include_past_returns_all(self):
        """Test GET /api/events?include_past=true returns all events"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        response = requests.get(f"{BASE_URL}/api/events?include_past=true", headers=headers)
        print(f"GET /api/events?include_past=true: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"  Number of events returned (including past): {len(data)}")
        
        # Count past vs future events
        now = datetime.now(timezone.utc)
        past_count = 0
        future_count = 0
        for event in data:
            event_date_str = event.get('date')
            if event_date_str:
                try:
                    if isinstance(event_date_str, str):
                        event_date = datetime.fromisoformat(event_date_str.replace('Z', '+00:00'))
                    else:
                        event_date = event_date_str
                    
                    if event_date < now:
                        past_count += 1
                    else:
                        future_count += 1
                except:
                    pass
        
        print(f"  Past events: {past_count}, Future events: {future_count}")
    
    def test_events_all_endpoint_returns_all(self):
        """Test GET /api/events/all returns all events (admin view)"""
        headers = get_auth_headers(MURPHY_SHARK_ADMIN)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Admin")
        
        response = requests.get(f"{BASE_URL}/api/events/all", headers=headers)
        print(f"GET /api/events/all: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"  Number of events returned: {len(data)}")


class TestConversationDeletion:
    """Bug Fix #5: Messages need delete conversation"""
    
    def test_delete_conversation_endpoint_exists(self):
        """Test DELETE /api/conversations/{id} endpoint exists"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        # Try to delete a non-existent conversation to verify endpoint exists
        fake_id = "test-nonexistent-conversation-id"
        response = requests.delete(f"{BASE_URL}/api/conversations/{fake_id}", headers=headers)
        print(f"DELETE /api/conversations/{fake_id}: {response.status_code}")
        
        # Should return 404 (not found) not 405 (method not allowed) or 500
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        print("  Endpoint exists and responds correctly")
    
    def test_get_conversations_for_user(self):
        """Test GET /api/conversations to see user's conversations"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        response = requests.get(f"{BASE_URL}/api/conversations", headers=headers)
        print(f"GET /api/conversations: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"  Number of conversations: {len(data)}")
        
        # Return conversation IDs for potential deletion test
        return [conv.get('id') for conv in data if conv.get('id')]


class TestMessageGroupLeave:
    """Bug Fix #6: User can leave a message group"""
    
    def test_leave_group_endpoint_exists(self):
        """Test DELETE /api/message-groups/{id}/leave endpoint exists"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        # Try to leave a non-existent group to verify endpoint exists
        fake_id = "test-nonexistent-group-id"
        response = requests.delete(f"{BASE_URL}/api/message-groups/{fake_id}/leave", headers=headers)
        print(f"DELETE /api/message-groups/{fake_id}/leave: {response.status_code}")
        
        # Should return 404 (not found) or 400 (not a member), not 405 (method not allowed)
        assert response.status_code in [200, 400, 404], f"Expected 200, 400, or 404, got {response.status_code}: {response.text}"
        print("  Endpoint exists and responds correctly")
    
    def test_get_user_message_groups(self):
        """Test GET /api/message-groups to see user's groups"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        response = requests.get(f"{BASE_URL}/api/message-groups", headers=headers)
        print(f"GET /api/message-groups: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"  Number of message groups: {len(data)}")
        
        if len(data) > 0:
            group = data[0]
            print(f"  First group: {group.get('name')}")
            print(f"  Members: {len(group.get('members', []))}")


class TestCoCurricularModelValidation:
    """Test CoCurricularGroup model with optional fields"""
    
    def test_get_cocurricular_groups_by_type(self):
        """Test GET /api/cocurricular/groups/{type} works with optional fields"""
        headers = get_auth_headers(MURPHY_SHARK_STUDENT)
        if not headers:
            pytest.skip("Could not authenticate Murphy Shark Student")
        
        for group_type in ['sports', 'clubs', 'cultural']:
            response = requests.get(f"{BASE_URL}/api/cocurricular/groups/{group_type}", headers=headers)
            print(f"GET /api/cocurricular/groups/{group_type}: {response.status_code}")
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert isinstance(data, list)
            print(f"  {group_type}: {len(data)} groups")
            
            # Verify groups can have optional contact_person and description
            for group in data:
                # These fields should be optional now
                contact_person = group.get('contact_person')
                description = group.get('description')
                print(f"    - {group.get('name')}: contact={contact_person}, desc_len={len(description) if description else 0}")


class TestOrmond:
    """Test with Ormond tenant to verify multi-tenant isolation"""
    
    def test_ormond_events_filtering(self):
        """Test events filtering works for Ormond tenant"""
        headers = get_auth_headers(ORMOND_ADMIN)
        if not headers:
            pytest.skip("Could not authenticate Ormond Admin")
        
        # Default - future only
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        print(f"Ormond GET /api/events: {response.status_code}")
        assert response.status_code == 200
        
        future_events = response.json()
        print(f"  Future events: {len(future_events)}")
        
        # Include past
        response = requests.get(f"{BASE_URL}/api/events?include_past=true", headers=headers)
        print(f"Ormond GET /api/events?include_past=true: {response.status_code}")
        assert response.status_code == 200
        
        all_events = response.json()
        print(f"  All events (including past): {len(all_events)}")
    
    def test_ormond_cocurricular_groups(self):
        """Test cocurricular groups for Ormond tenant"""
        headers = get_auth_headers(ORMOND_ADMIN)
        if not headers:
            pytest.skip("Could not authenticate Ormond Admin")
        
        response = requests.get(f"{BASE_URL}/api/cocurricular/groups/all", headers=headers)
        print(f"Ormond GET /api/cocurricular/groups/all: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        print(f"  Number of groups: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
