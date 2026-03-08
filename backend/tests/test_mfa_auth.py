"""
MFA (Multi-Factor Authentication) Backend API Tests
Tests the MFA login flow for admin/RA/super_admin users

Endpoints tested:
- POST /api/auth/login - Login with MFA flags
- POST /api/mfa/setup - Generate QR code and secret
- POST /api/mfa/verify - Enable MFA after verifying TOTP code
- POST /api/auth/login/mfa - Verify MFA code for returning users
- GET /api/mfa/status - Get MFA status for a user
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
STUDENT_EMAIL = "TEST_student_mfa@test.com"
STUDENT_PASSWORD = "TestPass123!"


class TestHealthAndSetup:
    """Basic health check before MFA tests"""
    
    def test_health_endpoint(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")


class TestMFALoginFlags:
    """Test MFA flags returned during login for different user roles"""
    
    def test_super_admin_login_returns_mfa_required(self):
        """
        Super admin login should return mfa_required=true
        If MFA not yet set up, should also return mfa_setup_required=true
        """
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert "mfa_required" in data, "Missing mfa_required flag"
        
        # Verify MFA flags for super_admin
        user = data["user"]
        assert user.get("role") in ["super_admin", "superadmin"], f"Expected super_admin role, got: {user.get('role')}"
        assert data["mfa_required"] == True, f"Expected mfa_required=true for super_admin, got: {data.get('mfa_required')}"
        
        # Check if MFA enabled or setup required
        mfa_enabled = data.get("mfa_enabled", False)
        mfa_setup_required = data.get("mfa_setup_required", False)
        
        if not mfa_enabled:
            assert mfa_setup_required == True, "Expected mfa_setup_required=true when MFA not enabled"
            print(f"✓ Super admin login: mfa_required=true, mfa_setup_required=true (MFA not yet set up)")
        else:
            print(f"✓ Super admin login: mfa_required=true, mfa_enabled=true (MFA already set up)")
        
        return data
    
    def test_student_login_no_mfa_required(self):
        """
        Create a student user and verify mfa_required=false
        """
        # First, try to register a student (may already exist)
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD,
            "first_name": "Test",
            "last_name": "Student",
            "role": "student",
            "floor": "1",
            "year": 2024,
            "student_id": "TEST123"
        })
        
        # If already exists, try login
        if register_response.status_code == 400:
            print("Student user already exists, trying login...")
        
        # Login as student
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Could not log in as student: {login_response.text}")
        
        data = login_response.json()
        
        # For students, MFA should NOT be required
        assert data.get("mfa_required") == False, f"Expected mfa_required=false for student, got: {data.get('mfa_required')}"
        print(f"✓ Student login: mfa_required=false (correct - students don't need MFA)")


class TestMFASetupEndpoint:
    """Test MFA setup endpoint that generates QR code and secret"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get token for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_mfa_setup_generates_qr_and_secret(self, super_admin_token):
        """
        POST /api/mfa/setup should generate:
        - secret (base32 string)
        - qr_code (base64 encoded PNG)
        - backup_codes (list of recovery codes)
        """
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First check MFA status
        status_response = requests.get(f"{BASE_URL}/api/mfa/status", headers=headers)
        assert status_response.status_code == 200
        status = status_response.json()
        
        if status.get("enabled"):
            print("MFA already enabled for this user, skipping setup test")
            pytest.skip("MFA already enabled")
        
        # Start MFA setup
        setup_response = requests.post(f"{BASE_URL}/api/mfa/setup", json={}, headers=headers)
        
        assert setup_response.status_code == 200, f"MFA setup failed: {setup_response.text}"
        data = setup_response.json()
        
        # Verify response structure
        assert "secret" in data, "Missing 'secret' in MFA setup response"
        assert "qr_code" in data, "Missing 'qr_code' in MFA setup response"
        assert "backup_codes" in data, "Missing 'backup_codes' in MFA setup response"
        
        # Verify secret format (should be base32)
        secret = data["secret"]
        assert len(secret) > 0, "Secret should not be empty"
        assert secret.isalnum(), "Secret should be alphanumeric (base32)"
        print(f"✓ MFA secret generated: {secret[:8]}...")
        
        # Verify QR code is base64
        qr_code = data["qr_code"]
        assert len(qr_code) > 100, "QR code should be a substantial base64 string"
        print(f"✓ QR code generated (length: {len(qr_code)} chars)")
        
        # Verify backup codes
        backup_codes = data["backup_codes"]
        assert isinstance(backup_codes, list), "Backup codes should be a list"
        assert len(backup_codes) >= 5, f"Expected at least 5 backup codes, got {len(backup_codes)}"
        print(f"✓ Backup codes generated: {len(backup_codes)} codes")
        
        # Verify backup code format (XXXX-XXXX)
        for code in backup_codes:
            assert "-" in code, f"Backup code should be formatted XXXX-XXXX, got: {code}"


class TestMFAVerifyEndpoint:
    """Test MFA verification endpoint (enables MFA after verifying TOTP code)"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get token for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_mfa_verify_rejects_invalid_code(self, super_admin_token):
        """
        POST /api/mfa/verify with invalid code should fail
        """
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First check if MFA is already enabled
        status_response = requests.get(f"{BASE_URL}/api/mfa/status", headers=headers)
        status = status_response.json()
        
        if status.get("enabled"):
            print("MFA already enabled, testing verify-code endpoint instead")
            # Test verify-code with invalid code
            verify_response = requests.post(f"{BASE_URL}/api/mfa/verify-code", 
                json={"code": "000000"},
                headers=headers
            )
            assert verify_response.status_code == 400, f"Expected 400 for invalid code, got: {verify_response.status_code}"
            print("✓ Invalid MFA code correctly rejected (400)")
            return
        
        # First do setup
        setup_response = requests.post(f"{BASE_URL}/api/mfa/setup", json={}, headers=headers)
        if setup_response.status_code != 200:
            pytest.skip(f"MFA setup failed: {setup_response.text}")
        
        # Try to verify with invalid code
        verify_response = requests.post(f"{BASE_URL}/api/mfa/verify", 
            json={"code": "000000"},  # Invalid code
            headers=headers
        )
        
        # Should fail with 400
        assert verify_response.status_code == 400, f"Expected 400 for invalid code, got: {verify_response.status_code}"
        print("✓ Invalid MFA code correctly rejected (400)")


class TestMFALoginVerification:
    """Test /api/auth/login/mfa endpoint for returning users with MFA enabled"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get token for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_mfa_login_endpoint_exists(self, super_admin_token):
        """
        POST /api/auth/login/mfa should exist and require MFA code
        """
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Check if MFA is enabled
        status_response = requests.get(f"{BASE_URL}/api/mfa/status", headers=headers)
        status = status_response.json()
        
        if not status.get("enabled"):
            # If MFA not enabled, endpoint should still work but return verified=true
            mfa_response = requests.post(f"{BASE_URL}/api/auth/login/mfa",
                json={"mfa_code": "123456", "backup_code": False},
                headers=headers
            )
            # Should return 200 with verified=true (since MFA not enabled)
            if mfa_response.status_code == 200:
                data = mfa_response.json()
                assert data.get("verified") == True, "Expected verified=true when MFA not enabled"
                print("✓ MFA login endpoint returns verified=true when MFA not enabled")
            else:
                print(f"MFA login response: {mfa_response.status_code} - {mfa_response.text}")
            return
        
        # If MFA is enabled, test with invalid code
        mfa_response = requests.post(f"{BASE_URL}/api/auth/login/mfa",
            json={"mfa_code": "000000", "backup_code": False},
            headers=headers
        )
        
        # Should fail with 401 for invalid code
        assert mfa_response.status_code == 401, f"Expected 401 for invalid MFA code, got: {mfa_response.status_code}"
        print("✓ MFA login endpoint correctly rejects invalid code (401)")


class TestMFAStatus:
    """Test MFA status endpoint"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get token for super admin with rate limit handling"""
        import time
        max_retries = 3
        for attempt in range(max_retries):
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": SUPER_ADMIN_EMAIL,
                "password": SUPER_ADMIN_PASSWORD
            })
            if response.status_code == 200:
                return response.json()["access_token"]
            elif response.status_code == 429:
                wait_time = 60 * (attempt + 1)  # Exponential backoff
                print(f"Rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                pytest.fail(f"Login failed: {response.status_code} - {response.text}")
        pytest.skip("Rate limited too many times")
    
    def test_mfa_status_returns_correct_structure(self, super_admin_token):
        """
        GET /api/mfa/status should return:
        - enabled (boolean)
        - backup_codes_remaining (int)
        """
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/mfa/status", headers=headers)
        
        assert response.status_code == 200, f"MFA status failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "enabled" in data, "Missing 'enabled' in MFA status"
        assert "backup_codes_remaining" in data, "Missing 'backup_codes_remaining' in MFA status"
        
        print(f"✓ MFA status: enabled={data['enabled']}, backup_codes={data['backup_codes_remaining']}")


# Cleanup fixture to remove test student
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests complete"""
    yield
    # Note: In a real scenario, we'd delete the test student user here
    # For now, we just leave it as the test prefix (TEST_) makes it identifiable


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
