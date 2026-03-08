"""
GDPR & ISO Compliance + RBAC Testing
=====================================
Tests for:
- RBAC on /api/users/list, /api/compliance/* endpoints
- XSS sanitization in registration
- Compliance endpoints: encryption-status, privacy-notice, consent, export, deletion
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "gen@quadley.com"
ADMIN_PASSWORD = "Quadley2025!"

class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get headers with admin auth"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class") 
    def student_user(self):
        """Create a test student user and get their token"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_student_{unique_id}@test.com"
        password = "TestPass123!"
        
        # Register student
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "first_name": "Test",
                "last_name": "Student",
                "role": "student"
            }
        )
        assert response.status_code == 200, f"Student registration failed: {response.text}"
        
        data = response.json()
        return {
            "token": data.get("access_token"),
            "email": email,
            "user": data.get("user"),
            "headers": {"Authorization": f"Bearer {data.get('access_token')}", "Content-Type": "application/json"}
        }


class TestRBACUsersListEndpoint:
    """RBAC tests for /api/users/list endpoint"""
    
    def test_users_list_returns_403_for_student(self, student_user):
        """Non-admin users should get 403 on /api/users/list"""
        response = requests.get(
            f"{BASE_URL}/api/users/list",
            headers=student_user["headers"]
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        assert "admin" in response.json().get("detail", "").lower()
        print(f"✓ RBAC: /api/users/list returns 403 for student user")
    
    def test_users_list_returns_200_for_admin(self, admin_headers):
        """Admin users should have access to /api/users/list"""
        response = requests.get(
            f"{BASE_URL}/api/users/list",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ RBAC: /api/users/list returns 200 for admin user")


class TestRBACComplianceEndpoints:
    """RBAC tests for compliance endpoints"""
    
    def test_encryption_status_returns_403_for_student(self, student_user):
        """Non-admin users should get 403 on /api/compliance/encryption-status"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/encryption-status",
            headers=student_user["headers"]
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ RBAC: /api/compliance/encryption-status returns 403 for student")
    
    def test_deletion_requests_returns_403_for_student(self, student_user):
        """Non-admin users should get 403 on /api/compliance/deletion-requests"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/deletion-requests",
            headers=student_user["headers"]
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ RBAC: /api/compliance/deletion-requests returns 403 for student")
    
    def test_data_masking_policy_returns_403_for_student(self, student_user):
        """Non-admin users should get 403 on /api/compliance/data-masking-policy"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/data-masking-policy",
            headers=student_user["headers"]
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ RBAC: /api/compliance/data-masking-policy returns 403 for student")


class TestXSSSanitization:
    """XSS prevention tests"""
    
    def test_register_strips_html_from_first_name(self):
        """Registration should sanitize HTML tags in first_name"""
        unique_id = str(uuid.uuid4())[:8]
        xss_payload = "<script>alert(1)</script>"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"xss_test_{unique_id}@test.com",
                "password": "TestPass123!",
                "first_name": xss_payload,
                "last_name": "Normal",
                "role": "student"
            }
        )
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        user = data.get("user", {})
        
        # The script tags should be stripped
        first_name = user.get("first_name", "")
        assert "<script>" not in first_name, f"XSS payload not stripped: {first_name}"
        assert "alert(1)" not in first_name or "<" not in first_name, f"Script content should be sanitized"
        print(f"✓ XSS: HTML tags stripped from first_name. Result: '{first_name}'")


class TestEncryptionStatusEndpoint:
    """Tests for /api/compliance/encryption-status (admin only)"""
    
    def test_encryption_status_returns_details_for_admin(self, admin_headers):
        """Admin should get encryption details"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/encryption-status",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify expected fields
        assert "encryption_at_rest" in data
        assert "encryption_in_transit" in data
        assert data["encryption_at_rest"]["enabled"] == True
        assert data["encryption_at_rest"]["algorithm"] == "AES-256"
        assert data["encryption_in_transit"]["enabled"] == True
        assert data["encryption_in_transit"]["protocol"] == "TLS 1.2+"
        
        print(f"✓ Compliance: encryption-status returns full details for admin")


class TestPrivacyNoticeEndpoint:
    """Tests for /api/compliance/privacy-notice (PUBLIC endpoint)"""
    
    def test_privacy_notice_is_public_no_auth(self):
        """Privacy notice should be accessible without authentication"""
        response = requests.get(f"{BASE_URL}/api/compliance/privacy-notice")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "terms_of_service" in data
        assert "privacy_policy" in data
        assert "data_rights" in data
        
        # Check TOS content
        tos = data["terms_of_service"]
        assert "1_acceptance" in tos
        
        # Check privacy policy content
        pp = data["privacy_policy"]
        assert "1_information_collected" in pp
        assert "4_data_sovereignty" in pp
        
        print(f"✓ Compliance: /api/compliance/privacy-notice is public and returns TOS/Privacy Policy")


class TestConsentEndpoints:
    """Tests for consent tracking endpoints"""
    
    def test_record_consent_with_timestamp(self, student_user):
        """POST /api/compliance/consent should record consent with timestamp"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/consent",
            headers=student_user["headers"],
            json={
                "consent_type": "terms_of_service",
                "granted": True,
                "version": "1.0"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "consent_id" in data
        assert "timestamp" in data
        assert data.get("message") == "Consent recorded"
        
        print(f"✓ Compliance: POST /api/compliance/consent records consent with timestamp")
    
    def test_get_consents_returns_user_records(self, student_user):
        """GET /api/compliance/consent should return user's consent records"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/consent",
            headers=student_user["headers"]
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "consents" in data
        assert isinstance(data["consents"], list)
        
        print(f"✓ Compliance: GET /api/compliance/consent returns user's consent records")
    
    def test_withdraw_consent(self, student_user):
        """POST /api/compliance/consent/withdraw should record withdrawal"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/consent/withdraw",
            headers=student_user["headers"],
            json={
                "consent_type": "marketing",
                "granted": False,
                "version": "1.0"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "consent_id" in data
        assert "timestamp" in data
        assert data.get("message") == "Consent withdrawn"
        
        print(f"✓ Compliance: POST /api/compliance/consent/withdraw records withdrawal")


class TestDataExportEndpoint:
    """Tests for /api/compliance/export-my-data"""
    
    def test_export_returns_json_with_user_data(self, student_user):
        """GET /api/compliance/export-my-data should return user data in JSON"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/export-my-data",
            headers=student_user["headers"]
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "export_format" in data
        assert data["export_format"] == "JSON"
        assert "exported_at" in data
        assert "user_id" in data
        assert "data" in data
        
        # Check data sections
        export_data = data["data"]
        assert "profile" in export_data
        assert "consent_records" in export_data
        
        print(f"✓ Compliance: /api/compliance/export-my-data returns JSON with user data")


class TestDeletionEndpoint:
    """Tests for /api/compliance/delete-my-account"""
    
    def test_deletion_requires_confirm_true(self):
        """POST /api/compliance/delete-my-account with confirm=false should return 400"""
        # Create a new user for this test
        unique_id = str(uuid.uuid4())[:8]
        email = f"delete_test_{unique_id}@test.com"
        
        # Register
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "TestPass123!",
                "first_name": "Delete",
                "last_name": "Test",
                "role": "student"
            }
        )
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Try to delete without confirm
        response = requests.post(
            f"{BASE_URL}/api/compliance/delete-my-account",
            headers=headers,
            json={"confirm": False}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ Compliance: delete-my-account returns 400 when confirm=false")
    
    def test_deletion_creates_pending_request(self):
        """POST /api/compliance/delete-my-account with confirm=true should create pending request"""
        # Create a new user for this test
        unique_id = str(uuid.uuid4())[:8]
        email = f"delete_confirm_{unique_id}@test.com"
        
        # Register
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "TestPass123!",
                "first_name": "Confirm",
                "last_name": "Delete",
                "role": "student"
            }
        )
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Delete with confirm=true
        response = requests.post(
            f"{BASE_URL}/api/compliance/delete-my-account",
            headers=headers,
            json={"confirm": True, "reason": "Testing deletion flow"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "request_id" in data
        assert data["status"] == "pending"
        assert "30 days" in data.get("message", "")
        
        print(f"✓ Compliance: delete-my-account creates pending request when confirm=true")


# Configure pytest fixtures at class level
@pytest.fixture(scope="class")
def admin_token():
    """Get admin token for authenticated requests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json().get("access_token")

@pytest.fixture(scope="class")
def admin_headers(admin_token):
    """Get headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="class")
def student_user():
    """Create a test student user and get their token"""
    unique_id = str(uuid.uuid4())[:8]
    email = f"test_student_{unique_id}@test.com"
    password = "TestPass123!"
    
    # Register student
    response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": "Student",
            "role": "student"
        }
    )
    if response.status_code != 200:
        pytest.skip(f"Student registration failed: {response.text}")
    
    data = response.json()
    return {
        "token": data.get("access_token"),
        "email": email,
        "user": data.get("user"),
        "headers": {"Authorization": f"Bearer {data.get('access_token')}", "Content-Type": "application/json"}
    }


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
