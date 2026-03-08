"""
Test Recognition (Shoutout) Feature Enhancement and Floor Events Fix
=====================================================================
Tests the following features:
1. GET /api/recognition/participants - Searchable list of all college participants
2. POST /api/shoutouts - Create shoutout with recipient_id and notification
3. GET /api/shoutouts - Returns shoutouts with sender_name and recipient_name
4. GET /api/notifications - Recognition notification in user's notification list
5. POST /api/floor-events - RA creates floor events
6. GET /api/floor-events - Students see RA-created events on same floor
"""

import pytest
import requests
import os
import time
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test users in TEST6991 tenant
TEST_USERS = {
    "admin": {"email": "changed@example.com", "password": "TestAdmin1!"},
    "student_alice": {"email": "alice@test.com", "password": "TestPass1!"},
    "student_bob": {"email": "bob@test.com", "password": "TestPass1!"},
    "ra_carol": {"email": "carol@test.com", "password": "TestPass1!"},
}

# Session-level cache for tokens to avoid rate limiting
_TOKEN_CACHE = {}


def get_token(user_key: str) -> dict:
    """Get token from cache or login, with rate limit awareness"""
    global _TOKEN_CACHE
    
    if user_key in _TOKEN_CACHE:
        return _TOKEN_CACHE[user_key]
    
    creds = TEST_USERS[user_key]
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": creds["email"], "password": creds["password"]}
    )
    
    if response.status_code == 200:
        data = response.json()
        result = {
            "token": data.get("access_token"),
            "user": data.get("user", {}),
            "success": True
        }
        _TOKEN_CACHE[user_key] = result
        return result
    elif response.status_code == 429:
        return {"success": False, "status_code": 429, "detail": "Rate limited"}
    
    return {"success": False, "status_code": response.status_code, "detail": response.text}


@pytest.fixture(scope="session", autouse=True)
def setup_tokens():
    """Setup all tokens at start to minimize login calls"""
    global _TOKEN_CACHE
    
    # Login all users at once with delays
    for user_key in ["admin", "student_alice", "student_bob", "ra_carol"]:
        result = get_token(user_key)
        if not result["success"]:
            print(f"Warning: {user_key} login issue: {result}")
        time.sleep(0.5)  # Small delay between logins
    
    yield
    _TOKEN_CACHE.clear()


class TestLogin:
    """Verify login works for test users"""
    
    def test_login_admin(self):
        """Test admin login works"""
        result = get_token("admin")
        assert result["success"], f"Admin login failed: {result}"
        print(f"Admin login successful, user: {result['user'].get('email', 'N/A')}")
    
    def test_login_student_alice(self):
        """Test student alice login works"""
        result = get_token("student_alice")
        assert result["success"], f"Alice login failed: {result}"
        print(f"Alice login successful, user: {result['user'].get('email', 'N/A')}")
    
    def test_login_student_bob(self):
        """Test student bob login works"""
        result = get_token("student_bob")
        assert result["success"], f"Bob login failed: {result}"
        print(f"Bob login successful, user: {result['user'].get('email', 'N/A')}")
    
    def test_login_ra_carol(self):
        """Test RA carol login works"""
        result = get_token("ra_carol")
        assert result["success"], f"Carol (RA) login failed: {result}"
        print(f"Carol (RA) login successful, role: {result['user'].get('role', 'N/A')}")


class TestRecognitionParticipants:
    """Test GET /api/recognition/participants endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for alice"""
        result = get_token("student_alice")
        if not result["success"]:
            pytest.skip(f"Alice login failed: {result}")
        self.token = result["token"]
        self.user = result["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_all_participants(self):
        """GET /api/recognition/participants returns all active users"""
        response = requests.get(
            f"{BASE_URL}/api/recognition/participants",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        participants = response.json()
        assert isinstance(participants, list), "Response should be a list"
        assert len(participants) > 0, "Should return at least one participant"
        
        # Validate participant structure
        first = participants[0]
        assert "id" in first, "Participant should have 'id'"
        assert "name" in first, "Participant should have 'name'"
        assert "email" in first, "Participant should have 'email'"
        assert "role" in first, "Participant should have 'role'"
        
        print(f"Found {len(participants)} participants")
        
        # Check that admin is included
        admin_found = any(p.get("email") == TEST_USERS["admin"]["email"] for p in participants)
        print(f"Admin in participants list: {admin_found}")
    
    def test_search_participants_by_name(self):
        """GET /api/recognition/participants?search= filters by name"""
        response = requests.get(
            f"{BASE_URL}/api/recognition/participants",
            headers=self.headers,
            params={"search": "alice"}
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        
        participants = response.json()
        alice_found = any(
            "alice" in p.get("name", "").lower() or "alice" in p.get("email", "").lower()
            for p in participants
        )
        print(f"Search 'alice' returned {len(participants)} results, alice found: {alice_found}")
    
    def test_search_participants_by_email(self):
        """GET /api/recognition/participants?search= filters by email"""
        response = requests.get(
            f"{BASE_URL}/api/recognition/participants",
            headers=self.headers,
            params={"search": "carol"}
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        participants = response.json()
        print(f"Search 'carol' returned {len(participants)} results")
    
    def test_search_participants_no_results(self):
        """GET /api/recognition/participants?search= with no match returns empty"""
        response = requests.get(
            f"{BASE_URL}/api/recognition/participants",
            headers=self.headers,
            params={"search": "xyznonexistent123"}
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        participants = response.json()
        assert len(participants) == 0, f"Expected 0 results, got {len(participants)}"
        print(f"Search 'xyznonexistent123' returned {len(participants)} results (expected 0)")


class TestShoutoutsWithRecipientId:
    """Test POST/GET /api/shoutouts with recipient_id for notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens for alice (sender) and bob (recipient)"""
        alice_result = get_token("student_alice")
        bob_result = get_token("student_bob")
        
        if not alice_result["success"]:
            pytest.skip(f"Alice login failed: {alice_result}")
        if not bob_result["success"]:
            pytest.skip(f"Bob login failed: {bob_result}")
        
        self.alice_token = alice_result["token"]
        self.alice_user = alice_result["user"]
        self.alice_headers = {"Authorization": f"Bearer {self.alice_token}"}
        
        self.bob_token = bob_result["token"]
        self.bob_user = bob_result["user"]
        self.bob_headers = {"Authorization": f"Bearer {self.bob_token}"}
        
        print(f"Alice ID: {self.alice_user.get('id', 'N/A')}, Bob ID: {self.bob_user.get('id', 'N/A')}")
    
    def test_create_shoutout_with_recipient_id(self):
        """POST /api/shoutouts with recipient_id creates shoutout and sends notification"""
        bob_id = self.bob_user.get("id")
        bob_name = f"{self.bob_user.get('first_name', '')} {self.bob_user.get('last_name', '')}".strip() or "Bob"
        
        shoutout_data = {
            "to_user_id": bob_id,
            "to_user_name": bob_name,
            "message": f"TEST_SHOUTOUT_{uuid.uuid4().hex[:8]} Great job helping with the project!",
            "category": "teamwork",
            "broadcast": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/shoutouts",
            headers=self.alice_headers,
            json=shoutout_data
        )
        
        assert response.status_code == 200, f"Create shoutout failed: {response.status_code} - {response.text}"
        
        shoutout = response.json()
        assert "id" in shoutout, "Shoutout should have 'id'"
        assert shoutout.get("to_user_id") == bob_id, f"to_user_id should be {bob_id}"
        
        # Verify sender_name is populated
        sender_name = shoutout.get("sender_name") or shoutout.get("from_user_name")
        assert sender_name, "Shoutout should have sender_name or from_user_name"
        
        # Verify recipient_name is populated
        recipient_name = shoutout.get("recipient_name") or shoutout.get("to_user_name")
        assert recipient_name, "Shoutout should have recipient_name or to_user_name"
        
        print(f"Shoutout created: {shoutout.get('id')}")
        print(f"Sender: {sender_name}, Recipient: {recipient_name}")
    
    def test_get_shoutouts_has_sender_and_recipient_names(self):
        """GET /api/shoutouts returns shoutouts with sender_name and recipient_name"""
        response = requests.get(
            f"{BASE_URL}/api/shoutouts",
            headers=self.alice_headers
        )
        
        assert response.status_code == 200, f"Get shoutouts failed: {response.text}"
        
        shoutouts = response.json()
        assert isinstance(shoutouts, list), "Response should be a list"
        
        if len(shoutouts) > 0:
            first = shoutouts[0]
            has_sender = "sender_name" in first or "from_user_name" in first
            has_recipient = "recipient_name" in first or "to_user_name" in first
            
            print(f"Found {len(shoutouts)} shoutouts")
            print(f"Has sender_name field: {has_sender}")
            print(f"Has recipient_name field: {has_recipient}")
            
            assert has_sender, "Shoutouts should have sender_name or from_user_name"
            assert has_recipient, "Shoutouts should have recipient_name or to_user_name"


class TestShoutoutNotification:
    """Test that recognized user receives notification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens for alice (sender) and bob (recipient)"""
        alice_result = get_token("student_alice")
        bob_result = get_token("student_bob")
        
        if not alice_result["success"]:
            pytest.skip(f"Alice login failed: {alice_result}")
        if not bob_result["success"]:
            pytest.skip(f"Bob login failed: {bob_result}")
        
        self.alice_token = alice_result["token"]
        self.alice_user = alice_result["user"]
        self.alice_headers = {"Authorization": f"Bearer {self.alice_token}"}
        
        self.bob_token = bob_result["token"]
        self.bob_user = bob_result["user"]
        self.bob_headers = {"Authorization": f"Bearer {self.bob_token}"}
    
    def test_recipient_receives_shoutout_notification(self):
        """When alice shouts out bob, bob should get a notification"""
        bob_id = self.bob_user.get("id")
        bob_name = f"{self.bob_user.get('first_name', '')} {self.bob_user.get('last_name', '')}".strip() or "Bob"
        
        # Get Bob's initial unread count
        notif_before = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=self.bob_headers
        )
        initial_unread = 0
        if notif_before.status_code == 200:
            initial_unread = notif_before.json().get("unread_count", 0)
        print(f"Bob's initial unread count: {initial_unread}")
        
        # Alice creates a shoutout for Bob
        unique_msg = f"TEST_NOTIF_SHOUTOUT_{uuid.uuid4().hex[:8]} Amazing work on the research!"
        shoutout_data = {
            "to_user_id": bob_id,
            "to_user_name": bob_name,
            "message": unique_msg,
            "category": "excellence",
            "broadcast": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/shoutouts",
            headers=self.alice_headers,
            json=shoutout_data
        )
        
        assert create_response.status_code == 200, f"Create shoutout failed: {create_response.text}"
        print(f"Shoutout created with message: {unique_msg[:50]}...")
        
        # Wait for notification to be processed
        time.sleep(1)
        
        # Check Bob's notifications
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.bob_headers
        )
        
        assert notif_response.status_code == 200, f"Get notifications failed: {notif_response.text}"
        
        notif_data = notif_response.json()
        notifications = notif_data.get("notifications", [])
        
        print(f"Bob has {len(notifications)} total notifications")
        
        # Look for the shoutout notification
        shoutout_notifs = [
            n for n in notifications 
            if n.get("type") == "shoutout" or "recognized" in n.get("title", "").lower() or "shoutout" in n.get("title", "").lower()
        ]
        
        print(f"Found {len(shoutout_notifs)} shoutout notifications")
        
        assert len(shoutout_notifs) > 0, "Bob should have received a shoutout notification"
        
        latest = shoutout_notifs[0]
        print(f"Latest shoutout notification title: {latest.get('title')}")
        print(f"Body: {latest.get('body')}")
        
        # Verify notification title mentions recognition
        title = latest.get("title", "")
        assert "recognized" in title.lower() or "shoutout" in title.lower(), \
            f"Notification title should mention recognition: {title}"


class TestFloorEvents:
    """Test Floor Events - RA creation and student visibility"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens for RA carol and student alice"""
        carol_result = get_token("ra_carol")
        alice_result = get_token("student_alice")
        
        if not carol_result["success"]:
            pytest.skip(f"Carol (RA) login failed: {carol_result}")
        if not alice_result["success"]:
            pytest.skip(f"Alice login failed: {alice_result}")
        
        self.carol_token = carol_result["token"]
        self.carol_user = carol_result["user"]
        self.carol_headers = {"Authorization": f"Bearer {self.carol_token}"}
        self.carol_floor = self.carol_user.get("floor", "Floor 1")
        
        self.alice_token = alice_result["token"]
        self.alice_user = alice_result["user"]
        self.alice_headers = {"Authorization": f"Bearer {self.alice_token}"}
        self.alice_floor = self.alice_user.get("floor", "Floor 1")
        
        print(f"Carol (RA) floor: {self.carol_floor}")
        print(f"Alice (student) floor: {self.alice_floor}")
    
    def test_ra_can_create_floor_event(self):
        """POST /api/floor-events - RA can create a floor event"""
        # Include floor in request as model requires it
        event_data = {
            "floor": self.carol_floor or "Floor 1",
            "title": f"TEST_FLOOR_EVENT_{uuid.uuid4().hex[:8]} Study Session",
            "description": "Weekly study group meeting",
            "date": (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z",
            "location": "Common Room 101",
            "max_attendees": 20
        }
        
        response = requests.post(
            f"{BASE_URL}/api/floor-events",
            headers=self.carol_headers,
            json=event_data
        )
        
        assert response.status_code == 200, f"RA create floor event failed: {response.status_code} - {response.text}"
        
        event = response.json()
        assert "id" in event, "Event should have 'id'"
        assert event.get("title") == event_data["title"], "Title mismatch"
        assert event.get("created_by") == self.carol_user.get("id"), "Creator should be Carol"
        
        print(f"Floor event created: {event.get('id')}")
        print(f"Title: {event.get('title')}")
        print(f"Floor: {event.get('floor')}")
        print(f"Created by: {event.get('created_by_name')}")
    
    def test_student_cannot_create_floor_event(self):
        """POST /api/floor-events - Student should get 403 forbidden"""
        event_data = {
            "floor": self.alice_floor or "Floor 1",
            "title": "Unauthorized Event",
            "description": "Should not be created",
            "date": (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z",
            "location": "Somewhere"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/floor-events",
            headers=self.alice_headers,
            json=event_data
        )
        
        assert response.status_code == 403, f"Student should get 403, got {response.status_code}: {response.text}"
        print("Student correctly denied from creating floor event (403)")
    
    def test_student_sees_ra_created_events(self):
        """GET /api/floor-events - Student can see RA-created events on same floor"""
        # First, RA creates an event
        unique_title = f"TEST_VISIBILITY_{uuid.uuid4().hex[:8]} Game Night"
        event_data = {
            "floor": self.carol_floor or "Floor 1",
            "title": unique_title,
            "description": "Board games and snacks",
            "date": (datetime.utcnow() + timedelta(days=3)).isoformat() + "Z",
            "location": "Lounge Area"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/floor-events",
            headers=self.carol_headers,
            json=event_data
        )
        
        if create_response.status_code == 200:
            created_event = create_response.json()
            print(f"RA created event on floor: {created_event.get('floor')}")
        
        # Student fetches floor events
        response = requests.get(
            f"{BASE_URL}/api/floor-events",
            headers=self.alice_headers
        )
        
        assert response.status_code == 200, f"Get floor events failed: {response.text}"
        
        events = response.json()
        assert isinstance(events, list), "Response should be a list"
        
        print(f"Student (Alice) sees {len(events)} floor events")
        
        if len(events) > 0:
            for event in events[:3]:
                print(f"  - {event.get('title')} on floor {event.get('floor')} by {event.get('created_by_name')}")
            
            # If same floor, should see the event
            if self.carol_floor == self.alice_floor:
                visible = any(e.get("title") == unique_title for e in events)
                print(f"RA event visible to student on same floor: {visible}")
                assert visible, "Student should see RA's event on the same floor"


class TestFloorEventsRetrieval:
    """Test floor events retrieval functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for student"""
        alice_result = get_token("student_alice")
        if not alice_result["success"]:
            pytest.skip(f"Alice login failed: {alice_result}")
        
        self.token = alice_result["token"]
        self.user = alice_result["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_floor_events(self):
        """GET /api/floor-events returns events for user's floor"""
        response = requests.get(
            f"{BASE_URL}/api/floor-events",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Get floor events failed: {response.text}"
        
        events = response.json()
        assert isinstance(events, list), "Response should be a list"
        
        print(f"Found {len(events)} floor events")
        
        if len(events) > 0:
            first = events[0]
            assert "id" in first, "Event should have 'id'"
            assert "title" in first, "Event should have 'title'"
            assert "date" in first, "Event should have 'date'"
            print(f"First event: {first.get('title')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
