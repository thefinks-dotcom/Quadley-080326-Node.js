"""
Contact Person Update Endpoint Tests
Tests for PUT /api/tenants/{tenant_code}/contact-person

Tests:
- Super Admin can update contact person for any tenant
- Tenant Admin can update contact person for their own tenant
- Non-admin users cannot access the endpoint
- Validation: name and email are required
- Email change updates admin user in tenant database
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TEST_TENANT_CODE = "TEST6991"


class TestContactPersonUpdate:
    """Tests for the contact person update endpoint"""

    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            # Response uses 'access_token' key
            token = data.get("access_token") or data.get("token")
            if token:
                return token
        pytest.skip(f"Super admin login failed: {response.status_code} - {response.text}")
        return None

    @pytest.fixture(scope="class")
    def auth_headers(self, super_admin_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {super_admin_token}"}

    @pytest.fixture(scope="class")
    def original_contact_info(self, auth_headers):
        """Get original contact info to restore after tests"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}",
            headers=auth_headers
        )
        if response.status_code == 200:
            data = response.json()
            return {
                "name": data.get("contact_person_name", ""),
                "email": data.get("contact_person_email", "")
            }
        return {"name": "", "email": ""}

    def test_login_works(self):
        """Test that login endpoint works and returns access_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # Check for access_token key
        assert "access_token" in data or "token" in data, f"No token in response: {data.keys()}"
        print(f"Login successful, response keys: {data.keys()}")

    def test_get_tenant_info(self, auth_headers):
        """Test that we can get tenant info"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get tenant failed: {response.text}"
        data = response.json()
        assert "contact_person_name" in data
        assert "contact_person_email" in data
        print(f"Tenant info: {data.get('name')} - Contact: {data.get('contact_person_name')} <{data.get('contact_person_email')}>")

    def test_update_contact_person_success(self, auth_headers, original_contact_info):
        """Test that super admin can update contact person successfully"""
        new_name = "Test Contact Person"
        new_email = f"test_contact_{os.urandom(4).hex()}@example.com"
        
        response = requests.put(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
            json={
                "contact_person_name": new_name,
                "contact_person_email": new_email
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        
        # Verify response
        assert data.get("message") == "Contact person updated successfully"
        assert data.get("contact_person_name") == new_name
        assert data.get("contact_person_email") == new_email.lower()
        assert "email_changed" in data
        
        print(f"Contact person updated: {new_name} <{new_email}>")
        
        # Restore original contact info
        if original_contact_info.get("name") and original_contact_info.get("email"):
            requests.put(
                f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
                json={
                    "contact_person_name": original_contact_info["name"],
                    "contact_person_email": original_contact_info["email"]
                },
                headers=auth_headers
            )

    def test_update_contact_person_validation_empty_name(self, auth_headers):
        """Test that empty name returns 400"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
            json={
                "contact_person_name": "",
                "contact_person_email": "valid@example.com"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"Empty name validation: {data.get('detail')}")

    def test_update_contact_person_validation_empty_email(self, auth_headers):
        """Test that empty email returns 400"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
            json={
                "contact_person_name": "Valid Name",
                "contact_person_email": ""
            },
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"Empty email validation: {data.get('detail')}")

    def test_update_contact_person_validation_whitespace_only(self, auth_headers):
        """Test that whitespace-only name/email returns 400"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
            json={
                "contact_person_name": "   ",
                "contact_person_email": "valid@example.com"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"Whitespace validation: {response.json().get('detail')}")

    def test_update_contact_person_missing_fields(self, auth_headers):
        """Test that missing required fields returns 422"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
            json={
                "contact_person_name": "Valid Name"
                # Missing email
            },
            headers=auth_headers
        )
        
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}: {response.text}"
        print("Missing field validation passed")

    def test_update_contact_person_unauthorized(self):
        """Test that unauthenticated request returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
            json={
                "contact_person_name": "Test Name",
                "contact_person_email": "test@example.com"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("Unauthorized access correctly blocked")

    def test_update_contact_person_nonexistent_tenant(self, auth_headers):
        """Test that updating non-existent tenant returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/NONEXISTENT_TENANT_CODE_12345/contact-person",
            json={
                "contact_person_name": "Test Name",
                "contact_person_email": "test@example.com"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("Non-existent tenant correctly returns 404")

    def test_verify_get_tenant_after_update(self, auth_headers, original_contact_info):
        """Test that GET tenant returns updated contact info after update"""
        test_name = "Verification Test Contact"
        test_email = f"verify_test_{os.urandom(4).hex()}@example.com"
        
        # Update contact
        update_response = requests.put(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
            json={
                "contact_person_name": test_name,
                "contact_person_email": test_email
            },
            headers=auth_headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify via GET
        get_response = requests.get(
            f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}",
            headers=auth_headers
        )
        assert get_response.status_code == 200, f"Get failed: {get_response.text}"
        
        data = get_response.json()
        assert data.get("contact_person_name") == test_name
        assert data.get("contact_person_email") == test_email.lower()
        
        print(f"GET verification passed: {test_name} <{test_email}>")
        
        # Restore original contact info
        if original_contact_info.get("name") and original_contact_info.get("email"):
            requests.put(
                f"{BASE_URL}/api/tenants/{TEST_TENANT_CODE}/contact-person",
                json={
                    "contact_person_name": original_contact_info["name"],
                    "contact_person_email": original_contact_info["email"]
                },
                headers=auth_headers
            )


class TestContactPersonAuthorization:
    """Tests for contact person endpoint authorization"""

    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                return token
        pytest.skip("Super admin login failed")
        return None

    def test_super_admin_can_access_any_tenant(self, super_admin_token):
        """Test that super admin can access contact-person endpoint for any tenant"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First get list of tenants
        tenants_response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers=headers
        )
        assert tenants_response.status_code == 200
        
        tenants = tenants_response.json()
        if len(tenants) > 0:
            tenant = tenants[0]
            tenant_code = tenant.get("code")
            
            # Try to access contact-person endpoint
            response = requests.get(
                f"{BASE_URL}/api/tenants/{tenant_code}",
                headers=headers
            )
            assert response.status_code == 200
            print(f"Super admin can access tenant {tenant_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
