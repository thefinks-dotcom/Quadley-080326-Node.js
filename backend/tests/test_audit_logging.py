"""
Test Audit Logging Feature
===========================
Tests for admin audit logging including:
- User invite creates audit log
- Super admin can see all audit logs
- Tenant admin only sees their tenant's logs
- Filter by action_type works
- Summary endpoint works
- Role change is logged
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


class TestAuditLogging:
    """Test audit logging feature for admin actions"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Super admin login failed: {response.status_code} - {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def tenant_admin_token(self):
        """Get tenant admin (Ormond) authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TENANT_ADMIN_EMAIL, "password": TENANT_ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Tenant admin login failed: {response.status_code} - {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def super_admin_headers(self, super_admin_token):
        """Headers with super admin auth"""
        return {
            "Authorization": f"Bearer {super_admin_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def tenant_admin_headers(self, tenant_admin_token):
        """Headers with tenant admin auth"""
        return {
            "Authorization": f"Bearer {tenant_admin_token}",
            "Content-Type": "application/json"
        }
    
    # ========== Test 1: User Invite Creates Audit Log ==========
    def test_user_invite_creates_audit_log(self, tenant_admin_headers):
        """POST /api/admin/users/invite should create user and log audit entry"""
        # Generate unique test email
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"TEST_audit_{unique_id}@example.com"
        
        # Invite a new user
        invite_payload = {
            "email": test_email,
            "first_name": "TEST_Audit",
            "last_name": f"User_{unique_id}",
            "floor": "Test Floor",
            "room": "101"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers=tenant_admin_headers,
            json=invite_payload
        )
        
        # Verify invite was successful
        assert response.status_code == 200, f"Invite failed: {response.status_code} - {response.text}"
        invite_data = response.json()
        assert "user" in invite_data
        created_user_id = invite_data["user"]["id"]
        print(f"✓ User invited successfully: {test_email}, ID: {created_user_id}")
        
        # Now check audit log for this action
        audit_response = requests.get(
            f"{BASE_URL}/api/audit",
            headers=tenant_admin_headers,
            params={"action_type": "user_create", "limit": 10}
        )
        
        assert audit_response.status_code == 200, f"Audit query failed: {audit_response.status_code}"
        audit_data = audit_response.json()
        
        # Verify audit entry exists
        assert "entries" in audit_data, "Audit response should have 'entries' field"
        entries = audit_data["entries"]
        
        # Find the audit entry for our created user
        matching_entry = None
        for entry in entries:
            if entry.get("target_id") == created_user_id:
                matching_entry = entry
                break
        
        assert matching_entry is not None, f"Audit entry not found for user {created_user_id}"
        assert matching_entry["action_type"] == "user_create"
        assert matching_entry["target_type"] == "user"
        assert matching_entry["admin_email"] == TENANT_ADMIN_EMAIL
        print(f"✓ Audit log entry found for user creation: {matching_entry['id']}")
        
        # Verify details contain expected info
        details = matching_entry.get("details", {})
        # Email may be stored with original case or lowercased
        assert details.get("email", "").lower() == test_email.lower()
        assert details.get("method") == "invite"
        print(f"✓ Audit entry details verified: email={details.get('email')}, method={details.get('method')}")
    
    # ========== Test 2: Super Admin Can See All Audit Logs ==========
    def test_super_admin_sees_all_audit_logs(self, super_admin_headers):
        """GET /api/audit - Super admin should see all audit logs across tenants"""
        response = requests.get(
            f"{BASE_URL}/api/audit",
            headers=super_admin_headers,
            params={"limit": 50}
        )
        
        assert response.status_code == 200, f"Audit query failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "entries" in data
        assert "total" in data
        assert isinstance(data["entries"], list)
        
        print(f"✓ Super admin retrieved {len(data['entries'])} audit entries (total: {data['total']})")
        
        # Check if we have entries from multiple tenants (if available)
        tenant_codes = set()
        for entry in data["entries"]:
            if entry.get("tenant_code"):
                tenant_codes.add(entry["tenant_code"])
        
        print(f"✓ Audit logs span {len(tenant_codes)} tenant(s): {tenant_codes}")
        
        # Verify entry structure
        if data["entries"]:
            entry = data["entries"][0]
            required_fields = ["id", "timestamp", "admin_id", "admin_email", "action_type", "target_type"]
            for field in required_fields:
                assert field in entry, f"Missing field '{field}' in audit entry"
            print("✓ Audit entry structure verified with required fields")
    
    # ========== Test 3: Tenant Admin Only Sees Their Tenant's Logs ==========
    def test_tenant_admin_sees_only_own_tenant_logs(self, tenant_admin_headers):
        """GET /api/audit - Tenant admin should only see their tenant's logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit",
            headers=tenant_admin_headers,
            params={"limit": 50}
        )
        
        assert response.status_code == 200, f"Audit query failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "entries" in data
        entries = data["entries"]
        
        # All entries should be from the same tenant (ORMOND - tenant code ORMD0001)
        tenant_codes_seen = set()
        for entry in entries:
            tenant_code = entry.get("tenant_code")
            if tenant_code:
                tenant_codes_seen.add(tenant_code)
        
        # Tenant admin should only see entries from ONE tenant (their own)
        assert len(tenant_codes_seen) <= 1, f"Tenant admin seeing logs from multiple tenants: {tenant_codes_seen}"
        
        print(f"✓ Tenant admin sees {len(entries)} entries, all from tenant(s): {tenant_codes_seen}")
    
    # ========== Test 4: Filter by Action Type Works ==========
    def test_filter_by_action_type(self, super_admin_headers):
        """GET /api/audit?action_type=user_create - Should filter by action type"""
        # Test filtering by user_create
        response = requests.get(
            f"{BASE_URL}/api/audit",
            headers=super_admin_headers,
            params={"action_type": "user_create", "limit": 20}
        )
        
        assert response.status_code == 200, f"Audit query failed: {response.status_code}"
        data = response.json()
        
        entries = data.get("entries", [])
        
        # All entries should have action_type = user_create
        for entry in entries:
            assert entry["action_type"] == "user_create", f"Expected user_create, got {entry['action_type']}"
        
        print(f"✓ Filter by action_type=user_create returned {len(entries)} entries, all correct type")
        
        # Test filtering by user_role_change
        response2 = requests.get(
            f"{BASE_URL}/api/audit",
            headers=super_admin_headers,
            params={"action_type": "user_role_change", "limit": 20}
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        entries2 = data2.get("entries", [])
        
        for entry in entries2:
            assert entry["action_type"] == "user_role_change"
        
        print(f"✓ Filter by action_type=user_role_change returned {len(entries2)} entries")
        
        # Test filtering by bulk_operation
        response3 = requests.get(
            f"{BASE_URL}/api/audit",
            headers=super_admin_headers,
            params={"action_type": "bulk_operation", "limit": 20}
        )
        
        assert response3.status_code == 200
        data3 = response3.json()
        entries3 = data3.get("entries", [])
        
        for entry in entries3:
            assert entry["action_type"] == "bulk_operation"
        
        print(f"✓ Filter by action_type=bulk_operation returned {len(entries3)} entries")
    
    # ========== Test 5: Audit Summary Endpoint Works ==========
    def test_audit_summary_endpoint(self, super_admin_headers):
        """GET /api/audit/summary - Should return audit activity summary"""
        response = requests.get(
            f"{BASE_URL}/api/audit/summary",
            headers=super_admin_headers,
            params={"days": 30}
        )
        
        assert response.status_code == 200, f"Summary failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify summary structure
        assert "period_days" in data
        assert "total_actions" in data
        assert "actions_by_type" in data
        assert "most_active_admins" in data
        
        print("✓ Audit summary retrieved:")
        print(f"  - Period: {data['period_days']} days")
        print(f"  - Total actions: {data['total_actions']}")
        print(f"  - Actions by type: {data['actions_by_type']}")
        print(f"  - Most active admins: {len(data['most_active_admins'])} admins")
        
        # Verify actions_by_type is a dict
        assert isinstance(data["actions_by_type"], dict)
        
        # Verify most_active_admins structure
        if data["most_active_admins"]:
            admin = data["most_active_admins"][0]
            assert "admin_id" in admin
            assert "email" in admin
            assert "actions" in admin
            print(f"  - Top admin: {admin['email']} with {admin['actions']} actions")
    
    # ========== Test 6: Tenant Admin Summary Only Shows Their Tenant ==========
    def test_tenant_admin_summary_filtered(self, tenant_admin_headers):
        """GET /api/audit/summary - Tenant admin summary should be filtered"""
        response = requests.get(
            f"{BASE_URL}/api/audit/summary",
            headers=tenant_admin_headers,
            params={"days": 30}
        )
        
        assert response.status_code == 200, f"Summary failed: {response.status_code}"
        data = response.json()
        
        assert "total_actions" in data
        assert "actions_by_type" in data
        
        print(f"✓ Tenant admin summary: {data['total_actions']} actions in last {data['period_days']} days")
    
    # ========== Test 7: Role Change Creates Audit Log ==========
    def test_role_change_creates_audit_log(self, tenant_admin_headers):
        """PATCH /api/admin/users/{user_id} - Role change should be logged"""
        # First, get list of users to find a student to change role
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers=tenant_admin_headers
        )
        
        assert users_response.status_code == 200, f"Get users failed: {users_response.status_code}"
        users = users_response.json()
        
        # Find a student user (not admin) to change role
        target_user = None
        for user in users:
            if user.get("role") == "student" and user.get("email", "").startswith("TEST_"):
                target_user = user
                break
        
        if not target_user:
            # Create a test user first
            unique_id = uuid.uuid4().hex[:8]
            test_email = f"TEST_role_{unique_id}@example.com"
            
            invite_response = requests.post(
                f"{BASE_URL}/api/admin/users/invite",
                headers=tenant_admin_headers,
                json={
                    "email": test_email,
                    "first_name": "TEST_Role",
                    "last_name": f"Change_{unique_id}"
                }
            )
            
            if invite_response.status_code == 200:
                target_user = invite_response.json()["user"]
                print(f"✓ Created test user for role change: {test_email}")
            else:
                pytest.skip("Could not find or create a test user for role change")
        
        user_id = target_user["id"]
        original_role = target_user.get("role", "student")
        new_role = "ra" if original_role == "student" else "student"
        
        # Change the role
        role_response = requests.patch(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=tenant_admin_headers,
            json={"role": new_role}
        )
        
        assert role_response.status_code == 200, f"Role change failed: {role_response.status_code} - {role_response.text}"
        print(f"✓ Role changed from {original_role} to {new_role}")
        
        # Check audit log for role change
        audit_response = requests.get(
            f"{BASE_URL}/api/audit",
            headers=tenant_admin_headers,
            params={"action_type": "user_role_change", "limit": 10}
        )
        
        assert audit_response.status_code == 200
        audit_data = audit_response.json()
        entries = audit_data.get("entries", [])
        
        # Find the audit entry for our role change
        matching_entry = None
        for entry in entries:
            if entry.get("target_id") == user_id:
                matching_entry = entry
                break
        
        assert matching_entry is not None, f"Audit entry not found for role change on user {user_id}"
        assert matching_entry["action_type"] == "user_role_change"
        assert matching_entry["target_type"] == "user"
        
        # Verify details contain old and new role
        details = matching_entry.get("details", {})
        assert details.get("old_role") == original_role
        assert details.get("new_role") == new_role
        print(f"✓ Audit log entry found for role change: old_role={details.get('old_role')}, new_role={details.get('new_role')}")
        
        # Revert the role change
        revert_response = requests.patch(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=tenant_admin_headers,
            json={"role": original_role}
        )
        if revert_response.status_code == 200:
            print(f"✓ Role reverted back to {original_role}")
    
    # ========== Test 8: Action Types Endpoint ==========
    def test_action_types_endpoint(self, super_admin_headers):
        """GET /api/audit/action-types - Should return available action types"""
        response = requests.get(
            f"{BASE_URL}/api/audit/action-types",
            headers=super_admin_headers
        )
        
        assert response.status_code == 200, f"Action types failed: {response.status_code}"
        data = response.json()
        
        # Verify categories exist
        expected_categories = ["User Management", "Tenant Management", "Content Management", "Data & Reports", "Security", "System"]
        for category in expected_categories:
            assert category in data, f"Missing category: {category}"
        
        # Verify user_create is in User Management
        user_mgmt = data.get("User Management", [])
        action_values = [a["value"] for a in user_mgmt]
        assert "user_create" in action_values
        assert "user_role_change" in action_values
        
        print(f"✓ Action types endpoint returned {len(data)} categories")
        for cat, actions in data.items():
            print(f"  - {cat}: {len(actions)} action types")
    
    # ========== Test 9: My Activity Endpoint ==========
    def test_my_activity_endpoint(self, tenant_admin_headers):
        """GET /api/audit/my-activity - Should return current admin's activity"""
        response = requests.get(
            f"{BASE_URL}/api/audit/my-activity",
            headers=tenant_admin_headers,
            params={"days": 30, "limit": 20}
        )
        
        assert response.status_code == 200, f"My activity failed: {response.status_code}"
        data = response.json()
        
        assert "entries" in data
        entries = data["entries"]
        
        # All entries should be from the current admin
        for entry in entries:
            assert entry["admin_email"] == TENANT_ADMIN_EMAIL, f"Entry from different admin: {entry['admin_email']}"
        
        print(f"✓ My activity returned {len(entries)} entries for {TENANT_ADMIN_EMAIL}")
    
    # ========== Test 10: High Severity Endpoint (Super Admin Only) ==========
    def test_high_severity_endpoint(self, super_admin_headers, tenant_admin_headers):
        """GET /api/audit/high-severity - Should return high severity actions (super admin only)"""
        # Super admin should have access
        response = requests.get(
            f"{BASE_URL}/api/audit/high-severity",
            headers=super_admin_headers,
            params={"days": 7}
        )
        
        assert response.status_code == 200, f"High severity failed: {response.status_code}"
        data = response.json()
        
        assert "entries" in data
        entries = data["entries"]
        
        # All entries should be high severity
        for entry in entries:
            assert entry.get("severity") == "high", f"Non-high severity entry found: {entry.get('severity')}"
        
        print(f"✓ High severity endpoint returned {len(entries)} high-severity entries")
        
        # Tenant admin should NOT have access
        response2 = requests.get(
            f"{BASE_URL}/api/audit/high-severity",
            headers=tenant_admin_headers,
            params={"days": 7}
        )
        
        assert response2.status_code == 403, f"Tenant admin should not access high-severity: {response2.status_code}"
        print("✓ Tenant admin correctly denied access to high-severity endpoint")
    
    # ========== Test 11: Pagination Works ==========
    def test_audit_pagination(self, super_admin_headers):
        """GET /api/audit - Pagination should work correctly"""
        # Get first page
        response1 = requests.get(
            f"{BASE_URL}/api/audit",
            headers=super_admin_headers,
            params={"skip": 0, "limit": 5}
        )
        
        assert response1.status_code == 200
        data1 = response1.json()
        
        assert data1["skip"] == 0
        assert data1["limit"] == 5
        assert "has_more" in data1
        
        first_page_ids = [e["id"] for e in data1["entries"]]
        
        # Get second page
        response2 = requests.get(
            f"{BASE_URL}/api/audit",
            headers=super_admin_headers,
            params={"skip": 5, "limit": 5}
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        assert data2["skip"] == 5
        second_page_ids = [e["id"] for e in data2["entries"]]
        
        # Ensure no overlap between pages
        overlap = set(first_page_ids) & set(second_page_ids)
        assert len(overlap) == 0, f"Pagination overlap found: {overlap}"
        
        print(f"✓ Pagination working: page 1 has {len(first_page_ids)} entries, page 2 has {len(second_page_ids)} entries, no overlap")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
