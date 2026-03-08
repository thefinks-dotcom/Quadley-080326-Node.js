"""
Test tenant-isolated routes and field encryption functionality
- Houses leaderboard/award routes
- O-Week data/activities routes
- Finance bills routes
- AI suggestions route
- Safe disclosure PII encryption integration
- Authentication requirements and role-based access control

Uses token caching to avoid rate limits on login endpoint.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_CREDS = {"email": "gen@quadley.com", "password": "Quadley2025!"}
TENANT_ADMIN_CREDS = {"email": "admin@ormond.com", "password": "Quadley2025!"}
STUDENT_CREDS = {"email": "student1@ormond.com", "password": "AbC!123!"}

# Token cache to avoid rate limits
_token_cache = {}


def get_token_cached(credentials: dict) -> str:
    """Get token from cache or login. Handles rate limiting."""
    cache_key = credentials["email"]
    if cache_key in _token_cache:
        return _token_cache[cache_key]
    
    # Try to login with retry for rate limits
    for attempt in range(3):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            token = response.json().get("access_token", "")
            _token_cache[cache_key] = token
            return token
        elif response.status_code == 429:
            # Rate limited - wait and retry
            print(f"Rate limited on login for {cache_key}, waiting 60s...")
            time.sleep(60)
        else:
            print(f"Login failed for {cache_key}: {response.status_code} - {response.text}")
            return ""
    return ""


def auth_headers(token: str) -> dict:
    """Return authorization headers"""
    return {"Authorization": f"Bearer {token}"}


# Pre-cache all tokens at module load (with delay between calls)
print("Caching authentication tokens...")
_super_admin_token = get_token_cached(SUPER_ADMIN_CREDS)
time.sleep(2)  # Small delay to avoid triggering rate limit
_tenant_admin_token = get_token_cached(TENANT_ADMIN_CREDS)
time.sleep(2)
_student_token = get_token_cached(STUDENT_CREDS)
print(f"Tokens cached: super_admin={bool(_super_admin_token)}, tenant_admin={bool(_tenant_admin_token)}, student={bool(_student_token)}")


class TestAuthenticationRequired:
    """Test that all routes require authentication (return 401 without token)"""
    
    def test_houses_leaderboard_requires_auth(self):
        """GET /api/houses/leaderboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/houses/leaderboard")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/houses/leaderboard returns 401 without auth")
    
    def test_houses_award_requires_auth(self):
        """POST /api/houses/award requires authentication"""
        response = requests.post(f"{BASE_URL}/api/houses/award", json={
            "house_name": "Test House",
            "points": 10
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/houses/award returns 401 without auth")
    
    def test_oweek_data_requires_auth(self):
        """GET /api/o-week/data requires authentication"""
        response = requests.get(f"{BASE_URL}/api/o-week/data")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/o-week/data returns 401 without auth")
    
    def test_oweek_activities_post_requires_auth(self):
        """POST /api/o-week/activities requires authentication"""
        response = requests.post(f"{BASE_URL}/api/o-week/activities", json={
            "name": "Test Activity",
            "description": "Test",
            "activity_type": "social",
            "points": 10
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/o-week/activities POST returns 401 without auth")
    
    def test_oweek_activities_delete_requires_auth(self):
        """DELETE /api/o-week/activities/{id} requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/o-week/activities/test-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/o-week/activities DELETE returns 401 without auth")
    
    def test_bills_requires_auth(self):
        """GET /api/bills requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bills")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/bills returns 401 without auth")
    
    def test_bills_summary_requires_auth(self):
        """GET /api/bills/summary requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bills/summary")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/bills/summary returns 401 without auth")
    
    def test_ai_suggestions_requires_auth(self):
        """POST /api/ai/suggestions requires authentication"""
        response = requests.post(f"{BASE_URL}/api/ai/suggestions", json={"query": "test"})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/ai/suggestions returns 401 without auth")
    
    def test_safe_disclosures_post_requires_auth(self):
        """POST /api/safe-disclosures requires authentication"""
        response = requests.post(f"{BASE_URL}/api/safe-disclosures", json={
            "is_anonymous": False,
            "incident_type": "test",
            "description": "test"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/safe-disclosures POST returns 401 without auth")
    
    def test_safe_disclosures_get_requires_auth(self):
        """GET /api/safe-disclosures requires authentication"""
        response = requests.get(f"{BASE_URL}/api/safe-disclosures")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: /api/safe-disclosures GET returns 401 without auth")


class TestHousesRoutes:
    """Test houses routes with proper authentication"""
    
    def test_houses_leaderboard_authenticated_admin(self):
        """GET /api/houses/leaderboard returns 200 with valid admin auth"""
        if not _tenant_admin_token:
            pytest.skip("No admin token available")
        response = requests.get(
            f"{BASE_URL}/api/houses/leaderboard",
            headers=auth_headers(_tenant_admin_token)
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: /api/houses/leaderboard returns 200 with {len(data)} houses")
    
    def test_houses_leaderboard_student_can_access(self):
        """Students can view house leaderboard"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.get(
            f"{BASE_URL}/api/houses/leaderboard",
            headers=auth_headers(_student_token)
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Student can access /api/houses/leaderboard")
    
    def test_houses_award_admin_success(self):
        """POST /api/houses/award succeeds for admin"""
        if not _tenant_admin_token:
            pytest.skip("No admin token available")
        response = requests.post(
            f"{BASE_URL}/api/houses/award",
            headers=auth_headers(_tenant_admin_token),
            json={
                "house_name": "TEST_Integration_House",
                "points": 5,
                "reason": "Test award"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("points_awarded") == 5
        print("PASS: Admin can award house points")
    
    def test_houses_award_student_forbidden(self):
        """POST /api/houses/award returns 403 for student"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.post(
            f"{BASE_URL}/api/houses/award",
            headers=auth_headers(_student_token),
            json={
                "house_name": "Test House",
                "points": 10,
                "reason": "Should fail"
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("PASS: Student gets 403 on /api/houses/award")


class TestOWeekRoutes:
    """Test O-Week routes with proper authentication"""
    
    def test_oweek_data_authenticated(self):
        """GET /api/o-week/data returns 200 with valid auth"""
        if not _tenant_admin_token:
            pytest.skip("No admin token available")
        response = requests.get(
            f"{BASE_URL}/api/o-week/data",
            headers=auth_headers(_tenant_admin_token)
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "welcome_message" in data
        assert "activities" in data
        assert "total_activities" in data
        print(f"PASS: /api/o-week/data returns welcome message and {data.get('total_activities')} activities")
    
    def test_oweek_data_student_can_access(self):
        """Students can view O-Week data"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.get(
            f"{BASE_URL}/api/o-week/data",
            headers=auth_headers(_student_token)
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Student can access /api/o-week/data")
    
    def test_oweek_activities_create_admin_success(self):
        """POST /api/o-week/activities succeeds for admin"""
        if not _tenant_admin_token:
            pytest.skip("No admin token available")
        response = requests.post(
            f"{BASE_URL}/api/o-week/activities",
            headers=auth_headers(_tenant_admin_token),
            json={
                "name": "TEST_Integration_Activity",
                "description": "Test activity for integration testing",
                "activity_type": "social",
                "points": 15,
                "date": "2026-02-15"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("name") == "TEST_Integration_Activity"
        assert "id" in data
        print(f"PASS: Admin created O-Week activity with id {data.get('id')}")
    
    def test_oweek_activities_create_student_forbidden(self):
        """POST /api/o-week/activities returns 403 for student"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.post(
            f"{BASE_URL}/api/o-week/activities",
            headers=auth_headers(_student_token),
            json={
                "name": "Unauthorized Activity",
                "description": "Should fail",
                "activity_type": "social",
                "points": 10
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("PASS: Student gets 403 on /api/o-week/activities POST")
    
    def test_oweek_activities_delete_student_forbidden(self):
        """DELETE /api/o-week/activities/{id} returns 403 for student"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.delete(
            f"{BASE_URL}/api/o-week/activities/some-activity-id",
            headers=auth_headers(_student_token)
        )
        # Could be 403 or 404 depending on if activity exists, but student should not succeed
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}: {response.text}"
        print("PASS: Student gets 403/404 on /api/o-week/activities DELETE")


class TestFinanceRoutes:
    """Test finance/bills routes with proper authentication"""
    
    def test_bills_authenticated(self):
        """GET /api/bills returns 200 with valid auth"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.get(
            f"{BASE_URL}/api/bills",
            headers=auth_headers(_student_token)
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: /api/bills returns 200 with {len(data)} bills")
    
    def test_bills_summary_authenticated(self):
        """GET /api/bills/summary returns 200 with valid auth"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.get(
            f"{BASE_URL}/api/bills/summary",
            headers=auth_headers(_student_token)
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total_owed" in data
        assert "total_paid" in data
        assert "overdue_count" in data
        assert "total_bills" in data
        print(f"PASS: /api/bills/summary returns summary with total_owed={data.get('total_owed')}")


class TestAISuggestionsRoute:
    """Test AI suggestions route with proper authentication"""
    
    def test_ai_suggestions_authenticated(self):
        """POST /api/ai/suggestions returns 200 with valid auth"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.post(
            f"{BASE_URL}/api/ai/suggestions",
            headers=auth_headers(_student_token),
            json={"query": "What events are happening this week?"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "suggestion" in data
        assert "query" in data
        assert data.get("status") == "placeholder"  # Currently placeholder implementation
        print("PASS: /api/ai/suggestions returns placeholder response")


class TestSafeDisclosureWithEncryption:
    """Test safe disclosure routes with PII field encryption"""
    
    def test_safe_disclosure_create_with_preferred_contact(self):
        """POST /api/safe-disclosures encrypts preferred_contact and returns decrypted"""
        if not _student_token:
            pytest.skip("No student token available")
        test_contact = "+61 400 123 456"
        response = requests.post(
            f"{BASE_URL}/api/safe-disclosures",
            headers=auth_headers(_student_token),
            json={
                "is_anonymous": False,
                "incident_type": "harassment",
                "incident_date": "2026-01-15",
                "incident_location": "Campus Library",
                "description": "TEST_Integration - Testing PII encryption",
                "individuals_involved": "Test individuals",
                "witness_present": False,
                "immediate_danger": False,
                "medical_attention_needed": False,
                "police_notified": False,
                "support_requested": ["counseling"],
                "preferred_contact": test_contact,
                "additional_notes": "Integration test disclosure"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data.get("incident_type") == "harassment"
        
        # CRITICAL: preferred_contact should be returned DECRYPTED
        returned_contact = data.get("preferred_contact")
        assert returned_contact == test_contact, f"Expected decrypted contact '{test_contact}', got '{returned_contact}'"
        # It should NOT start with 'enc:' (encryption prefix)
        assert not str(returned_contact).startswith("enc:"), "preferred_contact should be decrypted in response"
        
        print(f"PASS: Created disclosure with ID {data.get('id')}, preferred_contact decrypted correctly")
    
    def test_safe_disclosure_get_list_decrypts_preferred_contact(self):
        """GET /api/safe-disclosures decrypts preferred_contact field"""
        if not _student_token or not _tenant_admin_token:
            pytest.skip("Missing tokens")
        
        # First create a disclosure
        test_contact = "+61 400 987 654"
        create_response = requests.post(
            f"{BASE_URL}/api/safe-disclosures",
            headers=auth_headers(_student_token),
            json={
                "is_anonymous": False,
                "incident_type": "bullying",
                "description": "TEST_Get_List - Testing decryption on GET",
                "preferred_contact": test_contact,
                "immediate_danger": False,
                "medical_attention_needed": False,
                "police_notified": False,
                "witness_present": False
            }
        )
        assert create_response.status_code == 200
        created_id = create_response.json().get("id")
        
        # Now get the list (as admin to see all)
        response = requests.get(
            f"{BASE_URL}/api/safe-disclosures",
            headers=auth_headers(_tenant_admin_token)
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        disclosures = response.json()
        
        # Find our created disclosure
        found_disclosure = None
        for d in disclosures:
            if d.get("id") == created_id:
                found_disclosure = d
                break
        
        assert found_disclosure is not None, f"Could not find disclosure {created_id} in list"
        
        # Verify preferred_contact is decrypted
        contact = found_disclosure.get("preferred_contact")
        assert contact == test_contact, f"Expected decrypted contact '{test_contact}', got '{contact}'"
        assert not str(contact).startswith("enc:"), "preferred_contact should be decrypted in GET list"
        
        print("PASS: GET /api/safe-disclosures returns decrypted preferred_contact")
    
    def test_safe_disclosure_get_by_id_decrypts_preferred_contact(self):
        """GET /api/safe-disclosures/{id} decrypts preferred_contact field"""
        if not _student_token or not _tenant_admin_token:
            pytest.skip("Missing tokens")
        
        # First create a disclosure
        test_contact = "+61 400 111 222"
        create_response = requests.post(
            f"{BASE_URL}/api/safe-disclosures",
            headers=auth_headers(_student_token),
            json={
                "is_anonymous": False,
                "incident_type": "other",
                "description": "TEST_Get_By_ID - Testing decryption on GET by ID",
                "preferred_contact": test_contact,
                "immediate_danger": False,
                "medical_attention_needed": False,
                "police_notified": False,
                "witness_present": False
            }
        )
        assert create_response.status_code == 200
        created_id = create_response.json().get("id")
        
        # Now get by ID (as admin to be sure we have access)
        response = requests.get(
            f"{BASE_URL}/api/safe-disclosures/{created_id}",
            headers=auth_headers(_tenant_admin_token)
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        disclosure = response.json()
        
        # Verify preferred_contact is decrypted
        contact = disclosure.get("preferred_contact")
        assert contact == test_contact, f"Expected decrypted contact '{test_contact}', got '{contact}'"
        assert not str(contact).startswith("enc:"), "preferred_contact should be decrypted in GET by ID"
        
        print("PASS: GET /api/safe-disclosures/{id} returns decrypted preferred_contact")
    
    def test_safe_disclosure_anonymous_without_contact(self):
        """Anonymous disclosure without preferred_contact works"""
        if not _student_token:
            pytest.skip("No student token available")
        response = requests.post(
            f"{BASE_URL}/api/safe-disclosures",
            headers=auth_headers(_student_token),
            json={
                "is_anonymous": True,
                "incident_type": "safety_concern",
                "description": "TEST_Anonymous - No contact info",
                "immediate_danger": False,
                "medical_attention_needed": False,
                "police_notified": False,
                "witness_present": False
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("is_anonymous") == True
        # Reporter info should be null for anonymous
        assert data.get("reporter_name") is None
        assert data.get("reporter_email") is None
        print("PASS: Anonymous disclosure created successfully")


class TestFieldEncryptionUtility:
    """Test field encryption utility directly via API behavior"""
    
    def test_encryption_handles_special_characters(self):
        """Encryption handles special characters in preferred_contact"""
        if not _tenant_admin_token:
            pytest.skip("No admin token available")
        
        special_contacts = [
            "email@test.com",
            "+1 (555) 123-4567",
            "Contact: John Doe, ext. 123",
            "test@domain.com | 555-CALL"
        ]
        
        for contact in special_contacts:
            response = requests.post(
                f"{BASE_URL}/api/safe-disclosures",
                headers=auth_headers(_tenant_admin_token),
                json={
                    "is_anonymous": False,
                    "incident_type": "test",
                    "description": f"TEST_Special_Chars - Testing: {contact[:20]}",
                    "preferred_contact": contact,
                    "immediate_danger": False,
                    "medical_attention_needed": False,
                    "police_notified": False,
                    "witness_present": False
                }
            )
            assert response.status_code == 200, f"Failed for contact '{contact}': {response.text}"
            data = response.json()
            returned = data.get("preferred_contact")
            assert returned == contact, f"Expected '{contact}', got '{returned}'"
        
        print(f"PASS: Encryption/decryption handles {len(special_contacts)} special character patterns")


class TestCredentialsVerification:
    """Verify all provided test credentials work"""
    
    def test_super_admin_token_available(self):
        """Super admin token was retrieved successfully"""
        assert _super_admin_token, "Super admin token not available - check credentials"
        print("PASS: Super admin token available")
    
    def test_tenant_admin_token_available(self):
        """Tenant admin token was retrieved successfully"""
        assert _tenant_admin_token, "Tenant admin token not available - check credentials"
        print("PASS: Tenant admin token available")
    
    def test_student_token_available(self):
        """Student token was retrieved successfully"""
        assert _student_token, "Student token not available - check credentials"
        print("PASS: Student token available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
