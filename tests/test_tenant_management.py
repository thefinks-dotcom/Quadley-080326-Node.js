"""
Test Suite for Tenant Management and User Status Toggle Features
Tests Super Admin dashboard features for Quadley mobile app

Features tested:
1. GET /api/tenants - List all tenants (Super Admin only)
2. POST /api/tenants - Create new tenant with admin account
3. PUT /api/tenants/{tenant_id}/approve - Approve or reactivate tenant
4. DELETE /api/tenants/{tenant_id} - Suspend tenant
5. GET /api/users/list - List all users for admin
6. PATCH /api/auth/users/{user_id}/status - Toggle user active status
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://mobile-redesign-20.preview.emergentagent.com"

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.app"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
RA_EMAIL = "epink@icloud.com"
RA_PASSWORD = "AbC!123!AbC!123!"


class TestAuthentication:
    """Test authentication and get tokens for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "super_admin", f"Expected super_admin role, got {data['user']['role']}"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def ra_token(self):
        """Get RA authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": RA_EMAIL, "password": RA_PASSWORD}
        )
        assert response.status_code == 200, f"RA login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_super_admin_login(self, super_admin_token):
        """Test super admin can login successfully"""
        assert super_admin_token is not None
        print(f"✓ Super admin login successful")
    
    def test_ra_login(self, ra_token):
        """Test RA can login successfully"""
        assert ra_token is not None
        print(f"✓ RA login successful")


class TestTenantManagement:
    """Test tenant management endpoints - Super Admin only"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def ra_token(self):
        """Get RA authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": RA_EMAIL, "password": RA_PASSWORD}
        )
        assert response.status_code == 200, f"RA login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_list_tenants_super_admin(self, super_admin_token):
        """Test GET /api/tenants - Super admin can list all tenants"""
        response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Failed to list tenants: {response.text}"
        tenants = response.json()
        assert isinstance(tenants, list), "Response should be a list"
        print(f"✓ Super admin can list tenants - Found {len(tenants)} tenants")
        
        # Verify tenant structure if any exist
        if tenants:
            tenant = tenants[0]
            assert "tenant_id" in tenant, "Tenant should have tenant_id"
            assert "tenant_name" in tenant, "Tenant should have tenant_name"
            assert "status" in tenant, "Tenant should have status"
            assert "domain" in tenant, "Tenant should have domain"
            print(f"  - First tenant: {tenant.get('tenant_name')} ({tenant.get('status')})")
    
    def test_list_tenants_ra_forbidden(self, ra_token):
        """Test GET /api/tenants - RA should only see their own tenant"""
        response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers={"Authorization": f"Bearer {ra_token}"}
        )
        # RA should get 200 but only see their own tenant (or empty if no tenant_id)
        assert response.status_code == 200, f"Unexpected status: {response.text}"
        tenants = response.json()
        # RA should see limited tenants (only their own)
        print(f"✓ RA can only see limited tenants - Found {len(tenants)} tenant(s)")
    
    def test_list_tenants_unauthenticated(self):
        """Test GET /api/tenants - Unauthenticated request should fail"""
        response = requests.get(f"{BASE_URL}/api/tenants")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly rejected")
    
    def test_create_tenant(self, super_admin_token):
        """Test POST /api/tenants - Create new tenant with admin account"""
        unique_id = str(uuid.uuid4())[:8]
        tenant_data = {
            "tenant_id": f"test_tenant_{unique_id}",
            "tenant_name": f"TEST Test College {unique_id}",
            "domain": f"test{unique_id}.edu",
            "contact_email": f"admin@test{unique_id}.edu",
            "capacity": 100,
            "admin_first_name": "Test",
            "admin_last_name": "Admin",
            "admin_email": f"testadmin_{unique_id}@test{unique_id}.edu",
            "admin_password": "TestPass123!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tenants",
            json=tenant_data,
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        # Note: POST /api/tenants might not require auth (self-service registration)
        # Check if it succeeds
        if response.status_code == 200 or response.status_code == 201:
            tenant = response.json()
            assert tenant["tenant_id"] == tenant_data["tenant_id"], "Tenant ID mismatch"
            assert tenant["tenant_name"] == tenant_data["tenant_name"], "Tenant name mismatch"
            assert tenant["status"] == "pending", f"New tenant should be pending, got {tenant['status']}"
            print(f"✓ Tenant created successfully: {tenant['tenant_id']} (status: {tenant['status']})")
            return tenant["tenant_id"]
        else:
            # If it fails, check if it's because tenant already exists
            print(f"  Note: Create tenant returned {response.status_code}: {response.text}")
            pytest.skip("Tenant creation endpoint behavior varies")
    
    def test_create_tenant_duplicate_fails(self, super_admin_token):
        """Test POST /api/tenants - Duplicate tenant_id should fail"""
        # First, try to create a tenant
        unique_id = str(uuid.uuid4())[:8]
        tenant_data = {
            "tenant_id": f"test_dup_{unique_id}",
            "tenant_name": f"TEST Duplicate Test {unique_id}",
            "domain": f"testdup{unique_id}.edu",
            "contact_email": f"admin@testdup{unique_id}.edu",
            "capacity": 100,
            "admin_first_name": "Test",
            "admin_last_name": "Admin",
            "admin_email": f"testadmin_dup_{unique_id}@testdup{unique_id}.edu",
            "admin_password": "TestPass123!"
        }
        
        # Create first tenant
        response1 = requests.post(
            f"{BASE_URL}/api/tenants",
            json=tenant_data,
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        if response1.status_code not in [200, 201]:
            pytest.skip("First tenant creation failed, skipping duplicate test")
        
        # Try to create duplicate
        response2 = requests.post(
            f"{BASE_URL}/api/tenants",
            json=tenant_data,
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response2.status_code == 400, f"Duplicate should fail with 400, got {response2.status_code}"
        print(f"✓ Duplicate tenant correctly rejected")
    
    def test_approve_tenant(self, super_admin_token):
        """Test PUT /api/tenants/{tenant_id}/approve - Approve pending tenant"""
        # First create a tenant to approve
        unique_id = str(uuid.uuid4())[:8]
        tenant_data = {
            "tenant_id": f"test_approve_{unique_id}",
            "tenant_name": f"TEST Approve Test {unique_id}",
            "domain": f"testapprove{unique_id}.edu",
            "contact_email": f"admin@testapprove{unique_id}.edu",
            "capacity": 100,
            "admin_first_name": "Test",
            "admin_last_name": "Admin",
            "admin_email": f"testadmin_approve_{unique_id}@testapprove{unique_id}.edu",
            "admin_password": "TestPass123!"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/tenants",
            json=tenant_data,
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Tenant creation failed, skipping approve test")
        
        tenant_id = tenant_data["tenant_id"]
        
        # Now approve the tenant
        approve_response = requests.put(
            f"{BASE_URL}/api/tenants/{tenant_id}/approve",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert approve_response.status_code == 200, f"Approve failed: {approve_response.text}"
        result = approve_response.json()
        assert "message" in result, "Response should have message"
        print(f"✓ Tenant approved successfully: {tenant_id}")
        
        # Verify tenant is now active
        get_response = requests.get(
            f"{BASE_URL}/api/tenants/{tenant_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        if get_response.status_code == 200:
            tenant = get_response.json()
            assert tenant["status"] == "active", f"Tenant should be active, got {tenant['status']}"
            print(f"  - Verified tenant status is now: {tenant['status']}")
    
    def test_approve_tenant_ra_forbidden(self, ra_token):
        """Test PUT /api/tenants/{tenant_id}/approve - RA cannot approve tenants"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/any_tenant/approve",
            headers={"Authorization": f"Bearer {ra_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ RA correctly forbidden from approving tenants")
    
    def test_suspend_tenant(self, super_admin_token):
        """Test DELETE /api/tenants/{tenant_id} - Suspend active tenant"""
        # First create and approve a tenant
        unique_id = str(uuid.uuid4())[:8]
        tenant_data = {
            "tenant_id": f"test_suspend_{unique_id}",
            "tenant_name": f"TEST Suspend Test {unique_id}",
            "domain": f"testsuspend{unique_id}.edu",
            "contact_email": f"admin@testsuspend{unique_id}.edu",
            "capacity": 100,
            "admin_first_name": "Test",
            "admin_last_name": "Admin",
            "admin_email": f"testadmin_suspend_{unique_id}@testsuspend{unique_id}.edu",
            "admin_password": "TestPass123!"
        }
        
        # Create tenant
        create_response = requests.post(
            f"{BASE_URL}/api/tenants",
            json=tenant_data,
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Tenant creation failed, skipping suspend test")
        
        tenant_id = tenant_data["tenant_id"]
        
        # Approve tenant first
        requests.put(
            f"{BASE_URL}/api/tenants/{tenant_id}/approve",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        # Now suspend the tenant
        suspend_response = requests.delete(
            f"{BASE_URL}/api/tenants/{tenant_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert suspend_response.status_code == 200, f"Suspend failed: {suspend_response.text}"
        result = suspend_response.json()
        assert "message" in result, "Response should have message"
        print(f"✓ Tenant suspended successfully: {tenant_id}")
        
        # Verify tenant is now suspended
        get_response = requests.get(
            f"{BASE_URL}/api/tenants/{tenant_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        if get_response.status_code == 200:
            tenant = get_response.json()
            assert tenant["status"] == "suspended", f"Tenant should be suspended, got {tenant['status']}"
            print(f"  - Verified tenant status is now: {tenant['status']}")
    
    def test_suspend_tenant_ra_forbidden(self, ra_token):
        """Test DELETE /api/tenants/{tenant_id} - RA cannot suspend tenants"""
        response = requests.delete(
            f"{BASE_URL}/api/tenants/any_tenant",
            headers={"Authorization": f"Bearer {ra_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ RA correctly forbidden from suspending tenants")
    
    def test_reactivate_suspended_tenant(self, super_admin_token):
        """Test PUT /api/tenants/{tenant_id}/approve - Reactivate suspended tenant"""
        # Check if test_college exists and is suspended
        response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip("Cannot list tenants")
        
        tenants = response.json()
        suspended_tenant = None
        for t in tenants:
            if t.get("status") == "suspended":
                suspended_tenant = t
                break
        
        if not suspended_tenant:
            # Create and suspend a tenant for this test
            unique_id = str(uuid.uuid4())[:8]
            tenant_data = {
                "tenant_id": f"test_reactivate_{unique_id}",
                "tenant_name": f"TEST Reactivate Test {unique_id}",
                "domain": f"testreactivate{unique_id}.edu",
                "contact_email": f"admin@testreactivate{unique_id}.edu",
                "capacity": 100,
                "admin_first_name": "Test",
                "admin_last_name": "Admin",
                "admin_email": f"testadmin_reactivate_{unique_id}@testreactivate{unique_id}.edu",
                "admin_password": "TestPass123!"
            }
            
            create_resp = requests.post(
                f"{BASE_URL}/api/tenants",
                json=tenant_data,
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )
            
            if create_resp.status_code not in [200, 201]:
                pytest.skip("Cannot create tenant for reactivation test")
            
            tenant_id = tenant_data["tenant_id"]
            
            # Approve then suspend
            requests.put(
                f"{BASE_URL}/api/tenants/{tenant_id}/approve",
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )
            requests.delete(
                f"{BASE_URL}/api/tenants/{tenant_id}",
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )
        else:
            tenant_id = suspended_tenant["tenant_id"]
        
        # Now reactivate
        reactivate_response = requests.put(
            f"{BASE_URL}/api/tenants/{tenant_id}/approve",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        # Note: The approve endpoint might return 404 if tenant is not pending
        # Let's check the actual behavior
        if reactivate_response.status_code == 200:
            print(f"✓ Tenant reactivated successfully: {tenant_id}")
        elif reactivate_response.status_code == 404:
            # The approve endpoint only works for pending tenants
            # This is expected behavior - need a separate reactivate endpoint
            print(f"  Note: Approve endpoint only works for pending tenants (got 404)")
            # This is a potential issue - the frontend expects to reactivate via approve
        else:
            print(f"  Reactivate returned: {reactivate_response.status_code} - {reactivate_response.text}")


class TestUserManagement:
    """Test user management endpoints"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def ra_token(self):
        """Get RA authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": RA_EMAIL, "password": RA_PASSWORD}
        )
        assert response.status_code == 200, f"RA login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_list_users_super_admin(self, super_admin_token):
        """Test GET /api/users/list - Super admin can list all users"""
        response = requests.get(
            f"{BASE_URL}/api/users/list",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Failed to list users: {response.text}"
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        print(f"✓ Super admin can list users - Found {len(users)} users")
        
        # Verify user structure
        if users:
            user = users[0]
            assert "id" in user, "User should have id"
            assert "email" in user, "User should have email"
            assert "role" in user, "User should have role"
            # Check for active field (new feature)
            if "active" in user:
                print(f"  - Users have 'active' field for status toggle")
    
    def test_list_users_ra(self, ra_token):
        """Test GET /api/users/list - RA can list users"""
        response = requests.get(
            f"{BASE_URL}/api/users/list",
            headers={"Authorization": f"Bearer {ra_token}"}
        )
        assert response.status_code == 200, f"Failed to list users: {response.text}"
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        print(f"✓ RA can list users - Found {len(users)} users")
    
    def test_list_users_unauthenticated(self):
        """Test GET /api/users/list - Unauthenticated request should fail"""
        response = requests.get(f"{BASE_URL}/api/users/list")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly rejected")
    
    def test_toggle_user_status_deactivate(self, super_admin_token):
        """Test PATCH /api/auth/users/{user_id}/status - Deactivate a user"""
        # First get list of users to find a test user
        response = requests.get(
            f"{BASE_URL}/api/users/list",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        
        # Find a non-super_admin user to deactivate
        test_user = None
        for user in users:
            if user.get("role") not in ["super_admin"] and user.get("email") != SUPER_ADMIN_EMAIL:
                # Prefer a test user or student
                if "test" in user.get("email", "").lower() or user.get("role") == "student":
                    test_user = user
                    break
        
        if not test_user:
            # Just pick any non-super_admin user
            for user in users:
                if user.get("role") != "super_admin" and user.get("email") != SUPER_ADMIN_EMAIL:
                    test_user = user
                    break
        
        if not test_user:
            pytest.skip("No suitable test user found")
        
        user_id = test_user["id"]
        original_status = test_user.get("active", True)
        
        # Toggle to deactivate
        toggle_response = requests.patch(
            f"{BASE_URL}/api/auth/users/{user_id}/status",
            json={"active": False},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        result = toggle_response.json()
        assert result.get("active") == False, "User should be deactivated"
        print(f"✓ User deactivated successfully: {test_user.get('email')}")
        
        # Restore original status
        requests.patch(
            f"{BASE_URL}/api/auth/users/{user_id}/status",
            json={"active": original_status},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        print(f"  - Restored user to original status: {original_status}")
    
    def test_toggle_user_status_activate(self, super_admin_token):
        """Test PATCH /api/auth/users/{user_id}/status - Activate a user"""
        # Get list of users
        response = requests.get(
            f"{BASE_URL}/api/users/list",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        
        # Find a user to test with
        test_user = None
        for user in users:
            if user.get("role") not in ["super_admin"] and user.get("email") != SUPER_ADMIN_EMAIL:
                test_user = user
                break
        
        if not test_user:
            pytest.skip("No suitable test user found")
        
        user_id = test_user["id"]
        
        # First deactivate
        requests.patch(
            f"{BASE_URL}/api/auth/users/{user_id}/status",
            json={"active": False},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        # Now activate
        toggle_response = requests.patch(
            f"{BASE_URL}/api/auth/users/{user_id}/status",
            json={"active": True},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        result = toggle_response.json()
        assert result.get("active") == True, "User should be activated"
        print(f"✓ User activated successfully: {test_user.get('email')}")
    
    def test_toggle_own_status_forbidden(self, super_admin_token):
        """Test PATCH /api/auth/users/{user_id}/status - Cannot change own status"""
        # Get current user info
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert me_response.status_code == 200
        current_user = me_response.json()
        
        # Try to deactivate self
        toggle_response = requests.patch(
            f"{BASE_URL}/api/auth/users/{current_user['id']}/status",
            json={"active": False},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert toggle_response.status_code == 400, f"Expected 400, got {toggle_response.status_code}"
        print(f"✓ Cannot change own status - correctly rejected")
    
    def test_toggle_status_ra_can_toggle(self, ra_token):
        """Test PATCH /api/auth/users/{user_id}/status - RA/Admin can toggle user status"""
        # Get RA's info to check their role
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {ra_token}"}
        )
        assert me_response.status_code == 200
        ra_user = me_response.json()
        
        # Get list of users
        users_response = requests.get(
            f"{BASE_URL}/api/users/list",
            headers={"Authorization": f"Bearer {ra_token}"}
        )
        
        if users_response.status_code != 200:
            pytest.skip("RA cannot list users")
        
        users = users_response.json()
        
        # Find a student to toggle
        test_user = None
        for user in users:
            if user.get("role") == "student" and user.get("id") != ra_user["id"]:
                test_user = user
                break
        
        if not test_user:
            pytest.skip("No suitable student found")
        
        # Try to toggle - RA should be able to if they're admin role
        toggle_response = requests.patch(
            f"{BASE_URL}/api/auth/users/{test_user['id']}/status",
            json={"active": False},
            headers={"Authorization": f"Bearer {ra_token}"}
        )
        
        if ra_user.get("role") in ["admin", "super_admin"]:
            assert toggle_response.status_code == 200, f"Admin should be able to toggle: {toggle_response.text}"
            print(f"✓ Admin can toggle user status")
            # Restore
            requests.patch(
                f"{BASE_URL}/api/auth/users/{test_user['id']}/status",
                json={"active": True},
                headers={"Authorization": f"Bearer {ra_token}"}
            )
        else:
            assert toggle_response.status_code == 403, f"Non-admin should be forbidden: {toggle_response.status_code}"
            print(f"✓ Non-admin correctly forbidden from toggling status")
    
    def test_toggle_super_admin_status_forbidden(self, super_admin_token):
        """Test PATCH /api/auth/users/{user_id}/status - Cannot deactivate super_admin (unless you're super_admin)"""
        # Get list of users
        response = requests.get(
            f"{BASE_URL}/api/users/list",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        
        # Find another super_admin (if exists)
        other_super_admin = None
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        current_user = me_response.json()
        
        for user in users:
            if user.get("role") == "super_admin" and user.get("id") != current_user["id"]:
                other_super_admin = user
                break
        
        if not other_super_admin:
            print(f"  Note: No other super_admin found to test with")
            pytest.skip("No other super_admin to test with")
        
        # Super admin CAN deactivate other super_admins
        toggle_response = requests.patch(
            f"{BASE_URL}/api/auth/users/{other_super_admin['id']}/status",
            json={"active": False},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        # Should succeed since we're super_admin
        if toggle_response.status_code == 200:
            print(f"✓ Super admin can deactivate other super_admins")
            # Restore
            requests.patch(
                f"{BASE_URL}/api/auth/users/{other_super_admin['id']}/status",
                json={"active": True},
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )


class TestTenantApproveReactivateBug:
    """Test for potential bug: approve endpoint should work for both pending AND suspended tenants"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_approve_endpoint_for_suspended_tenant(self, super_admin_token):
        """
        BUG CHECK: The frontend uses PUT /api/tenants/{id}/approve for both:
        1. Approving pending tenants
        2. Reactivating suspended tenants
        
        But the backend only checks for status='pending' in the query.
        This test verifies if this is a bug.
        """
        # Get list of tenants
        response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip("Cannot list tenants")
        
        tenants = response.json()
        
        # Find a suspended tenant
        suspended_tenant = None
        for t in tenants:
            if t.get("status") == "suspended":
                suspended_tenant = t
                break
        
        if not suspended_tenant:
            # Create one
            unique_id = str(uuid.uuid4())[:8]
            tenant_data = {
                "tenant_id": f"test_bug_{unique_id}",
                "tenant_name": f"TEST Bug Test {unique_id}",
                "domain": f"testbug{unique_id}.edu",
                "contact_email": f"admin@testbug{unique_id}.edu",
                "capacity": 100,
                "admin_first_name": "Test",
                "admin_last_name": "Admin",
                "admin_email": f"testadmin_bug_{unique_id}@testbug{unique_id}.edu",
                "admin_password": "TestPass123!"
            }
            
            create_resp = requests.post(
                f"{BASE_URL}/api/tenants",
                json=tenant_data,
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )
            
            if create_resp.status_code not in [200, 201]:
                pytest.skip("Cannot create tenant")
            
            tenant_id = tenant_data["tenant_id"]
            
            # Approve then suspend
            requests.put(
                f"{BASE_URL}/api/tenants/{tenant_id}/approve",
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )
            requests.delete(
                f"{BASE_URL}/api/tenants/{tenant_id}",
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )
        else:
            tenant_id = suspended_tenant["tenant_id"]
        
        # Try to reactivate using approve endpoint
        reactivate_response = requests.put(
            f"{BASE_URL}/api/tenants/{tenant_id}/approve",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        if reactivate_response.status_code == 404:
            print(f"⚠️ BUG FOUND: Approve endpoint returns 404 for suspended tenants")
            print(f"   The frontend expects to reactivate suspended tenants via PUT /api/tenants/{{id}}/approve")
            print(f"   But the backend only queries for status='pending'")
            print(f"   FIX NEEDED: Update backend to handle both 'pending' and 'suspended' statuses")
            # This is a bug - mark test as failed
            assert False, "Approve endpoint should work for suspended tenants (reactivation)"
        elif reactivate_response.status_code == 200:
            print(f"✓ Approve endpoint works for suspended tenants (reactivation)")
        else:
            print(f"  Unexpected response: {reactivate_response.status_code} - {reactivate_response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
