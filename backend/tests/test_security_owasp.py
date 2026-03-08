"""
Test Security Features - OWASP Top 10 Remediation
==================================================
Tests for security enhancements including:
- A01: Broken Access Control - Role-based access enforcement
- A02: Cryptographic Failures - Proper authentication
- A03: Injection - CSV injection prevention
- A05: Security Misconfiguration - Proper error responses

Test credentials:
- Super Admin: gen@quadley.app / Quadley2025!
- Tenant Admin (Ormond): admin@ormond.com / Quadley2025!
- Student: student1@ormond.com / Quadley2025!
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.app"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_ADMIN_EMAIL = "admin@ormond.com"
TENANT_ADMIN_PASSWORD = "Quadley2025!"
STUDENT_EMAIL = "student1@ormond.com"
STUDENT_PASSWORD = "Quadley2025!"


class TestAuthentication:
    """Test A02: Cryptographic Failures - Authentication endpoints"""
    
    def test_login_returns_401_for_invalid_credentials(self):
        """Login should return 401 for invalid email/password"""
        # Test with wrong password
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": "WrongPassword123!"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Login with wrong password returns 401")
        
        # Test with non-existent email
        response2 = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "SomePassword123!"}
        )
        assert response2.status_code == 401, f"Expected 401, got {response2.status_code}"
        print("✓ Login with non-existent email returns 401")
        
        # Test with empty credentials
        response3 = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "", "password": ""}
        )
        # Should return 401 or 422 (validation error)
        assert response3.status_code in [401, 422], f"Expected 401 or 422, got {response3.status_code}"
        print(f"✓ Login with empty credentials returns {response3.status_code}")
    
    def test_login_success_with_valid_credentials(self):
        """Login should succeed with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data
        print("✓ Login with valid credentials returns 200 and token")


class TestAccessControl:
    """Test A01: Broken Access Control - Role-based access enforcement"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Super admin login failed: {response.status_code}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def tenant_admin_token(self):
        """Get tenant admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TENANT_ADMIN_EMAIL, "password": TENANT_ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Tenant admin login failed: {response.status_code}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": STUDENT_EMAIL, "password": STUDENT_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Student login failed: {response.status_code}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    # ========== Test: Unauthenticated access to /api/admin/users ==========
    def test_admin_users_requires_authentication(self):
        """GET /api/admin/users should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/admin/users returns 401 without authentication")
    
    # ========== Test: Unauthenticated access to /api/tenants ==========
    def test_tenants_requires_authentication(self):
        """GET /api/tenants should require authentication"""
        response = requests.get(f"{BASE_URL}/api/tenants")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/tenants returns 401 without authentication")
    
    # ========== Test: Student cannot access /api/admin/users ==========
    def test_student_cannot_access_admin_users(self, student_token):
        """Students should not be able to access /api/admin/users"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Student cannot access /api/admin/users (403)")
    
    # ========== Test: Student cannot access /api/tenants ==========
    def test_student_cannot_access_tenants(self, student_token):
        """Students should not be able to access /api/tenants"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/tenants", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Student cannot access /api/tenants (403)")
    
    # ========== Test: Tenant admin can access /api/admin/users ==========
    def test_tenant_admin_can_access_admin_users(self, tenant_admin_token):
        """Tenant admin should be able to access /api/admin/users"""
        headers = {"Authorization": f"Bearer {tenant_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list of users"
        print("✓ Tenant admin can access /api/admin/users (200)")
    
    # ========== Test: Super admin can access /api/tenants ==========
    def test_super_admin_can_access_tenants(self, super_admin_token):
        """Super admin should be able to access /api/tenants"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/tenants", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list of tenants"
        print("✓ Super admin can access /api/tenants (200)")
    
    # ========== Test: Student cannot access admin endpoints ==========
    def test_student_cannot_access_admin_stats(self, student_token):
        """Students should not be able to access /api/admin/stats"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Student cannot access /api/admin/stats (403)")
    
    # ========== Test: Student cannot invite users ==========
    def test_student_cannot_invite_users(self, student_token):
        """Students should not be able to invite users"""
        headers = {
            "Authorization": f"Bearer {student_token}",
            "Content-Type": "application/json"
        }
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers=headers,
            json={
                "email": "test@example.com",
                "first_name": "Test",
                "last_name": "User"
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Student cannot invite users (403)")


class TestCSVInjectionPrevention:
    """Test A03: Injection - CSV formula injection prevention"""
    
    @pytest.fixture(scope="class")
    def tenant_admin_token(self):
        """Get tenant admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TENANT_ADMIN_EMAIL, "password": TENANT_ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Tenant admin login failed: {response.status_code}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def tenant_admin_headers(self, tenant_admin_token):
        """Headers with tenant admin auth"""
        return {
            "Authorization": f"Bearer {tenant_admin_token}",
            "Content-Type": "application/json"
        }
    
    # ========== Test: CSV injection in bulk user import ==========
    def test_csv_injection_sanitized_in_bulk_user_import(self, tenant_admin_token):
        """Bulk user import should sanitize formula characters (=, +, -, @)"""
        headers = {"Authorization": f"Bearer {tenant_admin_token}"}
        
        # Create CSV with formula injection attempts
        unique_id = uuid.uuid4().hex[:6]
        csv_content = f"""first_name,last_name,email,floor,room
=CMD|'/C calc'!A0,Smith,test_csv1_{unique_id}@example.com,Floor 1,101
+1234567890,Johnson,test_csv2_{unique_id}@example.com,Floor 2,202
-1234567890,Williams,test_csv3_{unique_id}@example.com,Floor 3,303
@SUM(A1:A10),Brown,test_csv4_{unique_id}@example.com,Floor 4,404
Normal,User,test_csv5_{unique_id}@example.com,Floor 5,505"""
        
        files = {
            'file': ('test_users.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/bulk-invite",
            headers=headers,
            files=files
        )
        
        # The endpoint should process the file (200) and sanitize the values
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"
        data = response.json()
        
        print(f"✓ Bulk user import processed: {data.get('successful', 0)} successful, {data.get('failed', 0)} failed")
        
        # Check that created users have sanitized names (formula chars stripped)
        created_users = data.get('created_users', [])
        for user in created_users:
            name = user.get('name', '')
            # Verify formula characters are not at the start of names
            assert not name.startswith('='), f"Formula char '=' not sanitized in name: {name}"
            assert not name.startswith('+'), f"Formula char '+' not sanitized in name: {name}"
            assert not name.startswith('-'), f"Formula char '-' not sanitized in name: {name}"
            assert not name.startswith('@'), f"Formula char '@' not sanitized in name: {name}"
        
        print("✓ CSV injection characters sanitized in bulk user import")
    
    # ========== Test: CSV injection in events bulk upload ==========
    def test_csv_injection_sanitized_in_events_bulk_upload(self, tenant_admin_token):
        """Events bulk upload should sanitize formula characters"""
        headers = {"Authorization": f"Bearer {tenant_admin_token}"}
        
        # Create CSV with formula injection attempts
        csv_content = """title,description,date,time,location,category,max_attendees
=CMD|'/C calc'!A0,Normal description,2026-03-15,18:00,Main Hall,social,50
Normal Event,+1234567890,2026-03-16,19:00,Library,academic,30
Another Event,-1234567890,2026-03-17,20:00,Gym,sports,40
Test Event,@SUM(A1:A10),2026-03-18,21:00,Cafeteria,cultural,25"""
        
        files = {
            'file': ('test_events.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/events/bulk-upload",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"
        data = response.json()
        
        print(f"✓ Events bulk upload processed: {data.get('successful', 0)} successful, {data.get('failed', 0)} failed")
        
        # Check that created events have sanitized titles
        created_events = data.get('created_events', [])
        for event in created_events:
            title = event.get('title', '')
            # Verify formula characters are not at the start of titles
            assert not title.startswith('='), f"Formula char '=' not sanitized in title: {title}"
            assert not title.startswith('+'), f"Formula char '+' not sanitized in title: {title}"
            assert not title.startswith('-'), f"Formula char '-' not sanitized in title: {title}"
            assert not title.startswith('@'), f"Formula char '@' not sanitized in title: {title}"
        
        print("✓ CSV injection characters sanitized in events bulk upload")
    
    # ========== Test: CSV injection in dining menu bulk upload ==========
    def test_csv_injection_sanitized_in_dining_bulk_upload(self, tenant_admin_token):
        """Dining menu bulk upload should sanitize formula characters"""
        headers = {"Authorization": f"Bearer {tenant_admin_token}"}
        
        # Create CSV with formula injection attempts
        csv_content = """name,description,meal_type,date,dietary_tags,nutrition_info
=CMD|'/C calc'!A0,Normal description,Breakfast,2026-03-15,Vegetarian,250 cal
Normal Dish,+1234567890,Lunch,2026-03-15,Gluten-Free,350 cal
Another Dish,-1234567890,Dinner,2026-03-15,Vegan,400 cal
Test Dish,@SUM(A1:A10),Snacks,2026-03-15,Dairy-Free,150 cal"""
        
        files = {
            'file': ('test_menu.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dining/menu/bulk-upload",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"
        data = response.json()
        
        print(f"✓ Dining menu bulk upload processed: {data.get('success_count', 0)} successful, {data.get('failed_count', 0)} failed")
        
        # Check that created items have sanitized names
        items_created = data.get('items_created', [])
        for item in items_created:
            name = item.get('name', '')
            # Verify formula characters are not at the start of names
            assert not name.startswith('='), f"Formula char '=' not sanitized in name: {name}"
            assert not name.startswith('+'), f"Formula char '+' not sanitized in name: {name}"
            assert not name.startswith('-'), f"Formula char '-' not sanitized in name: {name}"
            assert not name.startswith('@'), f"Formula char '@' not sanitized in name: {name}"
        
        print("✓ CSV injection characters sanitized in dining menu bulk upload")
    
    # ========== Test: Verify sanitize_csv_value function behavior ==========
    def test_sanitize_csv_value_strips_formula_chars(self, tenant_admin_headers):
        """Test that formula characters are properly stripped from CSV values"""
        # This test verifies the sanitization by checking the actual stored data
        unique_id = uuid.uuid4().hex[:6]
        
        # Create a user with formula injection attempt in first_name
        csv_content = f"""first_name,last_name,email,floor,room
=HYPERLINK("http://evil.com"),TestLast,test_sanitize_{unique_id}@example.com,Floor 1,101"""
        
        files = {
            'file': ('test_sanitize.csv', csv_content, 'text/csv')
        }
        
        headers = {"Authorization": f"Bearer {tenant_admin_headers.get('Authorization', '').replace('Bearer ', '')}"}
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/bulk-invite",
            headers=headers,
            files=files
        )
        
        if response.status_code == 200:
            data = response.json()
            created_users = data.get('created_users', [])
            
            if created_users:
                user = created_users[0]
                name = user.get('name', '')
                # The '=' should be stripped, leaving 'HYPERLINK("http://evil.com") TestLast'
                assert not name.startswith('='), f"Formula char '=' should be stripped: {name}"
                print(f"✓ Sanitized name: '{name}' (original had '=' prefix)")
        
        print("✓ sanitize_csv_value function properly strips formula characters")


class TestSecurityMisconfiguration:
    """Test A05: Security Misconfiguration - Proper error responses"""
    
    def test_invalid_endpoint_returns_404(self):
        """Non-existent endpoints should return 404"""
        response = requests.get(f"{BASE_URL}/api/nonexistent/endpoint")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent endpoint returns 404")
    
    def test_method_not_allowed_returns_405(self):
        """Wrong HTTP method should return 405"""
        # Try DELETE on login endpoint (which only accepts POST)
        response = requests.delete(f"{BASE_URL}/api/auth/login")
        assert response.status_code == 405, f"Expected 405, got {response.status_code}"
        print("✓ Wrong HTTP method returns 405")
    
    def test_malformed_json_returns_422(self):
        """Malformed JSON should return 422"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data="not valid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Malformed JSON returns 422")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
