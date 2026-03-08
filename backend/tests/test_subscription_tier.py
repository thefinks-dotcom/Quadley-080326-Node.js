"""
Test subscription_tier bug fix - iteration 17
Tests:
1. GET /api/tenants returns subscription_tier for all tenants
2. GET /api/tenants/{code} returns subscription_tier correctly
3. PUT /api/tenants/{code}/subscription allows super admin to change tier directly
4. Subscription tier persists after update (no reset to basic)
5. Access control - non-super-admin cannot update subscription
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.app"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_ADMIN_EMAIL = "epinker@icloud.com"
TENANT_ADMIN_PASSWORD = "AbC!123!"
MURPHY_SHARK_CODE = "MURP1021"


class TestSubscriptionTierFix:
    """Test subscription_tier field is properly returned in tenant responses"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def tenant_admin_token(self):
        """Get tenant admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TENANT_ADMIN_EMAIL, "password": TENANT_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Tenant admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_list_tenants_returns_subscription_tier(self, super_admin_token):
        """Test GET /api/tenants returns subscription_tier for all tenants"""
        response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"List tenants failed: {response.text}"
        tenants = response.json()
        
        assert len(tenants) > 0, "No tenants returned"
        
        # Check each tenant has subscription_tier field
        for tenant in tenants:
            assert "subscription_tier" in tenant, f"Tenant {tenant.get('code')} missing subscription_tier"
            assert tenant["subscription_tier"] in ["basic", "pro", "enterprise"], \
                f"Invalid subscription_tier: {tenant.get('subscription_tier')}"
            
            # Also verify max_users is present
            assert "max_users" in tenant, f"Tenant {tenant.get('code')} missing max_users"
            
            # Verify primary_color and secondary_color are present
            assert "primary_color" in tenant, f"Tenant {tenant.get('code')} missing primary_color"
            assert "secondary_color" in tenant, f"Tenant {tenant.get('code')} missing secondary_color"
            
            print(f"Tenant {tenant['code']}: subscription_tier={tenant['subscription_tier']}, max_users={tenant['max_users']}")
    
    def test_get_tenant_returns_subscription_tier(self, super_admin_token):
        """Test GET /api/tenants/{code} returns subscription_tier correctly"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get tenant failed: {response.text}"
        tenant = response.json()
        
        # Verify subscription_tier is present and valid
        assert "subscription_tier" in tenant, "subscription_tier field missing"
        assert tenant["subscription_tier"] in ["basic", "pro", "enterprise"], \
            f"Invalid subscription_tier: {tenant.get('subscription_tier')}"
        
        # Verify max_users is present
        assert "max_users" in tenant, "max_users field missing"
        
        # Verify primary_color and secondary_color are present
        assert "primary_color" in tenant, "primary_color field missing"
        assert "secondary_color" in tenant, "secondary_color field missing"
        
        print(f"Murphy Shark tenant: subscription_tier={tenant['subscription_tier']}, max_users={tenant['max_users']}")
    
    def test_murphy_shark_has_pro_tier(self, super_admin_token):
        """Test Murphy Shark tenant has 'pro' subscription tier (as set by main agent)"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get tenant failed: {response.text}"
        tenant = response.json()
        
        # Murphy Shark should be 'pro' tier
        assert tenant["subscription_tier"] == "pro", \
            f"Expected Murphy Shark to have 'pro' tier, got '{tenant.get('subscription_tier')}'"
        
        # Pro tier should have max_users = 500
        assert tenant["max_users"] == 500, \
            f"Expected max_users=500 for pro tier, got {tenant.get('max_users')}"
        
        print("✓ Murphy Shark correctly has 'pro' tier with max_users=500")
    
    def test_super_admin_can_update_subscription(self, super_admin_token):
        """Test PUT /api/tenants/{code}/subscription allows super admin to change tier"""
        # First, get current tier
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        original_tier = response.json()["subscription_tier"]
        
        # Update to enterprise tier
        response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"subscription_tier": "enterprise"}
        )
        
        assert response.status_code == 200, f"Update subscription failed: {response.text}"
        result = response.json()
        
        assert result["subscription_tier"] == "enterprise", \
            f"Expected enterprise tier in response, got {result.get('subscription_tier')}"
        assert result["max_users"] == -1, \
            f"Expected max_users=-1 (unlimited) for enterprise, got {result.get('max_users')}"
        
        print(f"✓ Updated subscription to enterprise, max_users={result['max_users']}")
        
        # Restore original tier
        response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"subscription_tier": original_tier}
        )
        assert response.status_code == 200, f"Restore subscription failed: {response.text}"
        print(f"✓ Restored subscription to {original_tier}")
    
    def test_subscription_tier_persists_after_update(self, super_admin_token):
        """Test subscription tier persists after update (no reset to basic)"""
        # Get current tier
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        original_tier = response.json()["subscription_tier"]
        
        # Update to basic tier
        response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"subscription_tier": "basic"}
        )
        assert response.status_code == 200
        
        # Verify it persisted by fetching again
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        tenant = response.json()
        
        assert tenant["subscription_tier"] == "basic", \
            f"Subscription tier did not persist. Expected 'basic', got '{tenant.get('subscription_tier')}'"
        assert tenant["max_users"] == 100, \
            f"max_users did not persist. Expected 100, got {tenant.get('max_users')}"
        
        print(f"✓ Subscription tier persisted correctly: {tenant['subscription_tier']}")
        
        # Update to pro tier
        response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"subscription_tier": "pro"}
        )
        assert response.status_code == 200
        
        # Verify pro tier persisted
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        tenant = response.json()
        
        assert tenant["subscription_tier"] == "pro", \
            f"Pro tier did not persist. Expected 'pro', got '{tenant.get('subscription_tier')}'"
        assert tenant["max_users"] == 500, \
            f"max_users did not persist. Expected 500, got {tenant.get('max_users')}"
        
        print(f"✓ Pro tier persisted correctly: {tenant['subscription_tier']}, max_users={tenant['max_users']}")
        
        # Restore original tier
        if original_tier != "pro":
            response = requests.put(
                f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
                headers={"Authorization": f"Bearer {super_admin_token}"},
                json={"subscription_tier": original_tier}
            )
            assert response.status_code == 200
    
    def test_tenant_admin_cannot_update_subscription(self, tenant_admin_token):
        """Test non-super-admin cannot update subscription"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
            headers={"Authorization": f"Bearer {tenant_admin_token}"},
            json={"subscription_tier": "enterprise"}
        )
        
        assert response.status_code == 403, \
            f"Expected 403 Forbidden for tenant admin, got {response.status_code}: {response.text}"
        
        print("✓ Tenant admin correctly denied subscription update (403)")
    
    def test_invalid_tier_rejected(self, super_admin_token):
        """Test invalid subscription tier is rejected"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"subscription_tier": "invalid_tier"}
        )
        
        assert response.status_code == 400, \
            f"Expected 400 Bad Request for invalid tier, got {response.status_code}: {response.text}"
        
        print("✓ Invalid tier correctly rejected (400)")
    
    def test_custom_max_users_with_subscription(self, super_admin_token):
        """Test custom max_users can be set with subscription update"""
        # Get current tier
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        original_tier = response.json()["subscription_tier"]
        original_max_users = response.json()["max_users"]
        
        # Update with custom max_users
        response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"subscription_tier": "pro", "max_users": 750}
        )
        
        assert response.status_code == 200, f"Update with custom max_users failed: {response.text}"
        result = response.json()
        
        assert result["max_users"] == 750, \
            f"Expected custom max_users=750, got {result.get('max_users')}"
        
        print(f"✓ Custom max_users set correctly: {result['max_users']}")
        
        # Verify it persisted
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        tenant = response.json()
        
        assert tenant["max_users"] == 750, \
            f"Custom max_users did not persist. Expected 750, got {tenant.get('max_users')}"
        
        # Restore original values
        response = requests.put(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"subscription_tier": original_tier, "max_users": original_max_users}
        )
        assert response.status_code == 200
        print(f"✓ Restored to original: tier={original_tier}, max_users={original_max_users}")
    
    def test_list_tenants_shows_correct_tier_for_murphy_shark(self, super_admin_token):
        """Test list tenants shows correct tier for Murphy Shark (not reset to basic)"""
        response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"List tenants failed: {response.text}"
        tenants = response.json()
        
        # Find Murphy Shark
        murphy_shark = None
        for tenant in tenants:
            if tenant["code"] == MURPHY_SHARK_CODE:
                murphy_shark = tenant
                break
        
        assert murphy_shark is not None, f"Murphy Shark tenant ({MURPHY_SHARK_CODE}) not found in list"
        
        # Verify subscription_tier is 'pro' (not reset to 'basic')
        assert murphy_shark["subscription_tier"] == "pro", \
            f"Murphy Shark subscription_tier in list is '{murphy_shark.get('subscription_tier')}', expected 'pro'"
        
        print(f"✓ Murphy Shark in list has correct tier: {murphy_shark['subscription_tier']}")


class TestTenantResponseFields:
    """Test all TenantResponse fields are properly populated"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_tenant_response_has_all_fields(self, super_admin_token):
        """Test TenantResponse model has all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/{MURPHY_SHARK_CODE}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get tenant failed: {response.text}"
        tenant = response.json()
        
        # Required fields from TenantResponse model
        required_fields = [
            "id", "code", "name", "logo_url", "primary_color", "secondary_color",
            "contact_person_name", "contact_person_email", "enabled_modules",
            "subscription_tier", "max_users", "status", "user_count", "created_at"
        ]
        
        for field in required_fields:
            assert field in tenant, f"Missing required field: {field}"
            print(f"✓ {field}: {tenant[field]}")
        
        print(f"\n✓ All {len(required_fields)} required fields present in TenantResponse")
    
    def test_list_tenants_response_has_all_fields(self, super_admin_token):
        """Test list tenants response has all required fields for each tenant"""
        response = requests.get(
            f"{BASE_URL}/api/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"List tenants failed: {response.text}"
        tenants = response.json()
        
        required_fields = [
            "id", "code", "name", "primary_color", "secondary_color",
            "contact_person_name", "contact_person_email", "enabled_modules",
            "subscription_tier", "max_users", "status", "user_count", "created_at"
        ]
        
        for tenant in tenants:
            for field in required_fields:
                assert field in tenant, f"Tenant {tenant.get('code')} missing field: {field}"
        
        print(f"✓ All {len(tenants)} tenants have all {len(required_fields)} required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
