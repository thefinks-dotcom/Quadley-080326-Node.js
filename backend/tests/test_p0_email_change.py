"""
P0 Feature Tests: Email Change Verification (2-step flow), Email Sender Fallback, and Invitation
Tests for:
1. POST /api/auth/request-email-change - Step 1: Request email change (validates password, sends code)
2. POST /api/auth/verify-email-change - Step 2: Verify code and complete email change
3. Email sender fallback to support@quadley.com
4. Invitation for thefinks@icloud.com exists for ORMD0001
"""
import pytest
import requests
import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mobile-redesign-20.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for super admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture(scope="module")
def authenticated_session(auth_token):
    """Requests session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestRequestEmailChange:
    """Test POST /api/auth/request-email-change endpoint"""
    
    def test_request_email_change_success(self, authenticated_session):
        """Should accept new_email and current_password, return success with email_sent_to"""
        response = authenticated_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "new_email": "test_new_email@example.com",
            "current_password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "email_sent_to" in data
        assert data["email_sent_to"] == "test_new_email@example.com"
        print(f"SUCCESS: Request email change returned: {data}")
        
    def test_request_email_change_wrong_password(self, authenticated_session):
        """Should reject wrong password"""
        response = authenticated_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "new_email": "another_email@example.com",
            "current_password": "WrongPassword123!"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "incorrect" in data["detail"].lower() or "password" in data["detail"].lower()
        print(f"SUCCESS: Wrong password rejected with: {data['detail']}")
        
    def test_request_email_change_same_email(self, authenticated_session):
        """Should reject same email as current"""
        response = authenticated_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "new_email": SUPER_ADMIN_EMAIL,
            "current_password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "same" in data["detail"].lower()
        print(f"SUCCESS: Same email rejected with: {data['detail']}")
        
    def test_request_email_change_email_already_in_use(self, authenticated_session):
        """Should reject email already in use"""
        # admin@ormond.com is a tenant admin, so should be in use
        response = authenticated_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "new_email": "admin@ormond.com",
            "current_password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "already in use" in data["detail"].lower() or "in use" in data["detail"].lower()
        print(f"SUCCESS: Email in use rejected with: {data['detail']}")
        
    def test_request_email_change_missing_fields(self, authenticated_session):
        """Should reject missing required fields"""
        # Missing new_email
        response = authenticated_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "current_password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 400
        
        # Missing current_password
        response = authenticated_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "new_email": "new@example.com"
        })
        assert response.status_code == 400
        print("SUCCESS: Missing fields correctly rejected")
        
    def test_request_email_change_invalid_email_format(self, authenticated_session):
        """Should reject invalid email format"""
        response = authenticated_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "new_email": "not-an-email",
            "current_password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"SUCCESS: Invalid email format rejected with: {data['detail']}")


class TestVerifyEmailChange:
    """Test POST /api/auth/verify-email-change endpoint"""
    
    def test_verify_email_change_wrong_code(self, authenticated_session):
        """Should reject wrong code"""
        response = authenticated_session.post(f"{BASE_URL}/api/auth/verify-email-change", json={
            "code": "000000"
        })
        # Could be 400 (wrong code) or 400 (no pending request)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"SUCCESS: Wrong/no code rejected with: {data['detail']}")
        
    def test_verify_email_change_no_pending_request(self, authenticated_session):
        """Should reject when no pending request exists"""
        # First, clear any pending requests by trying to verify with no prior request
        response = authenticated_session.post(f"{BASE_URL}/api/auth/verify-email-change", json={
            "code": "123456"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        # Should say no pending request or invalid code
        print(f"SUCCESS: No pending request error: {data['detail']}")
        
    def test_verify_email_change_missing_code(self, authenticated_session):
        """Should reject missing code"""
        response = authenticated_session.post(f"{BASE_URL}/api/auth/verify-email-change", json={})
        assert response.status_code == 400
        print("SUCCESS: Missing code correctly rejected")


class TestEmailChangeFullFlow:
    """Test complete 2-step email change flow"""
    
    def test_full_email_change_flow(self, authenticated_session):
        """Test full flow: request -> get code from DB -> verify -> revert"""
        # Step 1: Request email change
        test_email = "test_flow_change@example.com"
        response = authenticated_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "new_email": test_email,
            "current_password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email_sent_to"] == test_email
        print(f"Step 1 PASS: Request sent, email_sent_to={data['email_sent_to']}")
        
        # Step 2: Get code from database
        async def get_verification_code():
            client = AsyncIOMotorClient(MONGO_URL)
            db = client['residential_college_db']
            request_doc = await db.email_change_requests.find_one(
                {"new_email": test_email},
                {"_id": 0}
            )
            return request_doc
        
        request_doc = asyncio.get_event_loop().run_until_complete(get_verification_code())
        assert request_doc is not None, "No pending email change request found in DB"
        verification_code = request_doc.get("code")
        assert verification_code is not None, "No verification code in request"
        print(f"Step 2 PASS: Retrieved code from DB: {verification_code}")
        
        # Step 3: Verify with correct code
        response = authenticated_session.post(f"{BASE_URL}/api/auth/verify-email-change", json={
            "code": verification_code
        })
        assert response.status_code == 200
        data = response.json()
        assert "new_email" in data
        assert data["new_email"] == test_email
        print(f"Step 3 PASS: Email changed successfully to: {data['new_email']}")
        
        # Step 4: Revert email back to original
        # Need to re-login with new email
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": SUPER_ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            new_token = login_response.json().get("access_token")
            new_session = requests.Session()
            new_session.headers.update({
                "Authorization": f"Bearer {new_token}",
                "Content-Type": "application/json"
            })
            
            # Request revert to original email
            revert_response = new_session.post(f"{BASE_URL}/api/auth/request-email-change", json={
                "new_email": SUPER_ADMIN_EMAIL,
                "current_password": SUPER_ADMIN_PASSWORD
            })
            assert revert_response.status_code == 200
            
            # Get revert code
            async def get_revert_code():
                client = AsyncIOMotorClient(MONGO_URL)
                db = client['residential_college_db']
                request_doc = await db.email_change_requests.find_one(
                    {"new_email": SUPER_ADMIN_EMAIL},
                    {"_id": 0}
                )
                return request_doc
            
            revert_doc = asyncio.get_event_loop().run_until_complete(get_revert_code())
            if revert_doc:
                revert_code = revert_doc.get("code")
                if revert_code:
                    verify_revert = new_session.post(f"{BASE_URL}/api/auth/verify-email-change", json={
                        "code": revert_code
                    })
                    if verify_revert.status_code == 200:
                        print(f"Step 4 PASS: Email reverted back to: {SUPER_ADMIN_EMAIL}")
                    else:
                        print(f"Step 4 WARNING: Could not verify revert: {verify_revert.text}")
        else:
            print("Step 4 WARNING: Could not login with new email to revert")


class TestEmailSenderFallback:
    """Test that email sender falls back to support@quadley.com"""
    
    def test_sender_email_fallback(self):
        """Verify SENDER_EMAIL is support@quadley.com"""
        import sys
        sys.path.insert(0, '/app/backend')
        from utils.email_service import SENDER_EMAIL
        
        assert SENDER_EMAIL == "support@quadley.com", f"Expected support@quadley.com, got {SENDER_EMAIL}"
        print(f"SUCCESS: SENDER_EMAIL fallback is correctly set to: {SENDER_EMAIL}")


class TestInvitationExists:
    """Test that invitation for thefinks@icloud.com exists"""
    
    def test_invitation_for_thefinks(self):
        """Verify invitation exists in quadley_master.invitations for ORMD0001"""
        async def check_invitation():
            client = AsyncIOMotorClient(MONGO_URL)
            master_db = client['quadley_master']
            invitation = await master_db.invitations.find_one(
                {"email": "thefinks@icloud.com"},
                {"_id": 0}
            )
            return invitation
        
        invitation = asyncio.get_event_loop().run_until_complete(check_invitation())
        
        assert invitation is not None, "Invitation for thefinks@icloud.com not found"
        assert invitation.get("tenant_code") == "ORMD0001", f"Wrong tenant code: {invitation.get('tenant_code')}"
        assert invitation.get("role") == "ra", f"Wrong role: {invitation.get('role')}"
        assert invitation.get("status") == "pending", f"Wrong status: {invitation.get('status')}"
        
        print("SUCCESS: Invitation found for thefinks@icloud.com:")
        print(f"  - Tenant: {invitation.get('tenant_code')}")
        print(f"  - Role: {invitation.get('role')}")
        print(f"  - Status: {invitation.get('status')}")
        print(f"  - Invite Code: {invitation.get('invite_code')}")


class TestUnauthorizedAccess:
    """Test that endpoints require authentication"""
    
    def test_request_email_change_unauthorized(self):
        """Should return 401 without auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/request-email-change", json={
            "new_email": "test@example.com",
            "current_password": "password"
        })
        assert response.status_code == 401
        print("SUCCESS: request-email-change requires authentication")
        
    def test_verify_email_change_unauthorized(self):
        """Should return 401 without auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/verify-email-change", json={
            "code": "123456"
        })
        assert response.status_code == 401
        print("SUCCESS: verify-email-change requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
