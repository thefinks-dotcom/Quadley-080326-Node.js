"""
SAML IdP Simulator API Tests
============================
Tests for Super Admin SAML configuration testing tool endpoints:
- GET /api/saml-simulator/tenants
- POST /api/saml-simulator/validate/{tenant_code}
- POST /api/saml-simulator/generate-response/{tenant_code}
- POST /api/saml-simulator/test-flow/{tenant_code}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def get_super_admin_session():
    """Create a session logged in as super admin"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "gen@quadley.com", "password": "Quadley2025!"}
    )
    if response.status_code == 200:
        data = response.json()
        if 'access_token' in data:
            session.cookies.set('access_token', data['access_token'])
    return session


def get_tenant_admin_session():
    """Create a session logged in as tenant admin"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@ormond.com", "password": "Quadley2025!"}
    )
    if response.status_code == 200:
        data = response.json()
        if 'access_token' in data:
            session.cookies.set('access_token', data['access_token'])
    return session


class TestSAMLSimulatorAuth:
    """Authentication and authorization tests for SAML simulator endpoints"""
    
    # Test 1: Unauthenticated access - tenants endpoint
    def test_tenants_unauthenticated(self):
        """GET /api/saml-simulator/tenants requires authentication"""
        response = requests.get(f"{BASE_URL}/api/saml-simulator/tenants")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Tenants endpoint requires auth (401)")
    
    # Test 2: Unauthenticated access - validate endpoint
    def test_validate_unauthenticated(self):
        """POST /api/saml-simulator/validate/{tenant_code} requires authentication"""
        response = requests.post(f"{BASE_URL}/api/saml-simulator/validate/ORMD0001")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Validate endpoint requires auth (401)")
    
    # Test 3: Unauthenticated access - generate-response endpoint
    def test_generate_response_unauthenticated(self):
        """POST /api/saml-simulator/generate-response/{tenant_code} requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/saml-simulator/generate-response/ORMD0001",
            json={"user": {"email": "test@example.com"}}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Generate-response endpoint requires auth (401)")
    
    # Test 4: Unauthenticated access - test-flow endpoint
    def test_test_flow_unauthenticated(self):
        """POST /api/saml-simulator/test-flow/{tenant_code} requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/saml-simulator/test-flow/ORMD0001",
            json={"user": {"email": "test@example.com"}}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Test-flow endpoint requires auth (401)")
    
    # Test 5: Tenant admin (non-super_admin) gets 403 on tenants endpoint
    def test_tenants_forbidden_for_tenant_admin(self):
        """Tenant admin should get 403 on SAML simulator endpoints"""
        session = get_tenant_admin_session()
        response = session.get(f"{BASE_URL}/api/saml-simulator/tenants")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Tenant admin gets 403 on tenants endpoint")
    
    # Test 6: Tenant admin (non-super_admin) gets 403 on validate endpoint
    def test_validate_forbidden_for_tenant_admin(self):
        """Tenant admin should get 403 on validate endpoint"""
        session = get_tenant_admin_session()
        response = session.post(f"{BASE_URL}/api/saml-simulator/validate/ORMD0001")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Tenant admin gets 403 on validate endpoint")
    
    # Test 7: Tenant admin (non-super_admin) gets 403 on generate-response endpoint
    def test_generate_response_forbidden_for_tenant_admin(self):
        """Tenant admin should get 403 on generate-response endpoint"""
        session = get_tenant_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/generate-response/ORMD0001",
            json={"user": {"email": "test@example.com"}}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Tenant admin gets 403 on generate-response endpoint")
    
    # Test 8: Tenant admin (non-super_admin) gets 403 on test-flow endpoint
    def test_test_flow_forbidden_for_tenant_admin(self):
        """Tenant admin should get 403 on test-flow endpoint"""
        session = get_tenant_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/test-flow/ORMD0001",
            json={"user": {"email": "test@example.com"}}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Tenant admin gets 403 on test-flow endpoint")


class TestSAMLSimulatorTenants:
    """Test GET /api/saml-simulator/tenants endpoint for super admin"""
    
    # Test 9: Super admin can list tenants
    def test_super_admin_can_list_tenants(self):
        """Super admin can access tenants list"""
        session = get_super_admin_session()
        response = session.get(f"{BASE_URL}/api/saml-simulator/tenants")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "tenants" in data, "Response should have 'tenants' key"
        assert isinstance(data["tenants"], list), "tenants should be a list"
        print(f"PASS: Super admin can list {len(data['tenants'])} tenants")
    
    # Test 10: Tenants list has expected fields
    def test_tenants_list_has_expected_fields(self):
        """Each tenant in list should have SSO status fields"""
        session = get_super_admin_session()
        response = session.get(f"{BASE_URL}/api/saml-simulator/tenants")
        assert response.status_code == 200
        data = response.json()
        
        if data["tenants"]:
            tenant = data["tenants"][0]
            expected_fields = ["code", "name", "sso_enabled", "sso_provider", "has_saml_config"]
            for field in expected_fields:
                assert field in tenant, f"Tenant should have '{field}' field"
            print(f"PASS: Tenant has expected fields: {list(tenant.keys())}")
    
    # Test 11: ORMD0001 tenant shows SAML config status
    def test_ormd0001_has_saml_config_info(self):
        """ORMD0001 (Ormond College) should show SAML config status"""
        session = get_super_admin_session()
        response = session.get(f"{BASE_URL}/api/saml-simulator/tenants")
        assert response.status_code == 200
        data = response.json()
        
        ormond = next((t for t in data["tenants"] if t["code"] == "ORMD0001"), None)
        assert ormond is not None, "ORMD0001 should be in tenants list"
        assert "has_saml_config" in ormond, "Should have has_saml_config field"
        print(f"PASS: ORMD0001 has_saml_config={ormond['has_saml_config']}, sso_enabled={ormond['sso_enabled']}, provider={ormond.get('sso_provider')}")


class TestSAMLSimulatorValidate:
    """Test POST /api/saml-simulator/validate/{tenant_code} endpoint"""
    
    # Test 12: Validate returns 404 for non-existent tenant
    def test_validate_nonexistent_tenant(self):
        """Validate endpoint returns 404 for non-existent tenant"""
        session = get_super_admin_session()
        response = session.post(f"{BASE_URL}/api/saml-simulator/validate/INVALID999")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Validate returns 404 for non-existent tenant")
    
    # Test 13: Validate returns checks for tenant with SAML config
    def test_validate_returns_checks(self):
        """Validate endpoint returns detailed checks for ORMD0001"""
        session = get_super_admin_session()
        response = session.post(f"{BASE_URL}/api/saml-simulator/validate/ORMD0001")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "tenant_code" in data, "Should have tenant_code"
        assert "tenant_name" in data, "Should have tenant_name"
        assert "overall_status" in data, "Should have overall_status"
        assert "checks" in data, "Should have checks array"
        assert isinstance(data["checks"], list), "checks should be a list"
        print(f"PASS: Validate returned {len(data['checks'])} checks, status={data['overall_status']}")
    
    # Test 14: Validate checks have correct structure
    def test_validate_checks_structure(self):
        """Each check should have id, name, passed, detail, severity"""
        session = get_super_admin_session()
        response = session.post(f"{BASE_URL}/api/saml-simulator/validate/ORMD0001")
        assert response.status_code == 200
        data = response.json()
        
        if data["checks"]:
            check = data["checks"][0]
            expected_fields = ["id", "name", "passed", "detail", "severity"]
            for field in expected_fields:
                assert field in check, f"Check should have '{field}' field"
        print(f"PASS: Check structure validated with fields: {expected_fields}")
    
    # Test 15: Validate returns SP metadata
    def test_validate_returns_sp_metadata(self):
        """Validate endpoint returns SP metadata for IdP configuration"""
        session = get_super_admin_session()
        response = session.post(f"{BASE_URL}/api/saml-simulator/validate/ORMD0001")
        assert response.status_code == 200
        data = response.json()
        
        assert "sp_metadata" in data, "Should have sp_metadata"
        sp_meta = data["sp_metadata"]
        assert "entity_id" in sp_meta, "SP metadata should have entity_id"
        assert "acs_url" in sp_meta, "SP metadata should have acs_url"
        print(f"PASS: SP metadata returned: entity_id={sp_meta.get('entity_id', 'N/A')[:50]}...")


class TestSAMLSimulatorGenerateResponse:
    """Test POST /api/saml-simulator/generate-response/{tenant_code} endpoint"""
    
    def get_test_user(self):
        return {
            "email": "testuser@ormond.edu",
            "first_name": "Test",
            "last_name": "User",
            "student_id": "STU-001",
            "department": "Computer Science"
        }
    
    # Test 16: Generate response returns 404 for non-existent tenant
    def test_generate_nonexistent_tenant(self):
        """Generate response returns 404 for non-existent tenant"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/generate-response/INVALID999",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Generate response returns 404 for non-existent tenant")
    
    # Test 17: Generate response returns SAML XML
    def test_generate_returns_saml_xml(self):
        """Generate response returns SAML response XML"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/generate-response/ORMD0001",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "saml_response_xml" in data, "Should have saml_response_xml"
        xml = data["saml_response_xml"]
        assert "samlp:Response" in xml, "XML should contain samlp:Response"
        assert "saml:Assertion" in xml, "XML should contain saml:Assertion"
        print(f"PASS: Generated SAML response XML ({len(xml)} chars)")
    
    # Test 18: Generate response returns base64 encoded response
    def test_generate_returns_base64(self):
        """Generate response returns base64 encoded SAML response"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/generate-response/ORMD0001",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "saml_response_base64" in data, "Should have saml_response_base64"
        import base64
        try:
            decoded = base64.b64decode(data["saml_response_base64"]).decode('utf-8')
            assert "samlp:Response" in decoded, "Decoded base64 should be SAML XML"
            print("PASS: Base64 encoding is valid and decodes to SAML XML")
        except Exception as e:
            pytest.fail(f"Failed to decode base64: {e}")
    
    # Test 19: Generate response includes metadata
    def test_generate_includes_metadata(self):
        """Generate response includes response_id, assertion_id, acs_url, etc"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/generate-response/ORMD0001",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = ["response_id", "assertion_id", "acs_url", "issue_instant", "name_id", "note"]
        for field in expected_fields:
            assert field in data, f"Response should have '{field}'"
        print(f"PASS: Response includes metadata: response_id={data['response_id'][:20]}...")
    
    # Test 20: NameID defaults to email
    def test_name_id_defaults_to_email(self):
        """NameID in response should default to user email"""
        session = get_super_admin_session()
        test_user = self.get_test_user()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/generate-response/ORMD0001",
            json={"user": test_user}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["name_id"] == test_user["email"], f"NameID should be {test_user['email']}, got {data['name_id']}"
        print(f"PASS: NameID defaults to email: {data['name_id']}")


class TestSAMLSimulatorTestFlow:
    """Test POST /api/saml-simulator/test-flow/{tenant_code} endpoint"""
    
    def get_test_user(self):
        return {
            "email": "testuser@ormond.edu",
            "first_name": "Test",
            "last_name": "User",
            "student_id": "STU-001",
            "department": "Computer Science"
        }
    
    # Test 21: Test flow returns 404 for non-existent tenant
    def test_flow_nonexistent_tenant(self):
        """Test flow returns 404 for non-existent tenant"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/test-flow/INVALID999",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Test flow returns 404 for non-existent tenant")
    
    # Test 22: Test flow returns flow steps
    def test_flow_returns_steps(self):
        """Test flow returns 6 flow steps"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/test-flow/ORMD0001",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "flow_steps" in data, "Should have flow_steps"
        assert len(data["flow_steps"]) == 6, f"Should have 6 flow steps, got {len(data['flow_steps'])}"
        print(f"PASS: Test flow returned {len(data['flow_steps'])} steps")
    
    # Test 23: Flow steps have correct structure
    def test_flow_steps_structure(self):
        """Each flow step should have step, name, status, detail"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/test-flow/ORMD0001",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 200
        data = response.json()
        
        for step in data["flow_steps"]:
            assert "step" in step, "Step should have 'step' number"
            assert "name" in step, "Step should have 'name'"
            assert "status" in step, "Step should have 'status'"
            assert "detail" in step, "Step should have 'detail'"
            assert step["status"] in ["pass", "fail", "warning", "skip"], f"Invalid status: {step['status']}"
        print("PASS: All flow steps have correct structure")
    
    # Test 24: Test flow returns SAML endpoints
    def test_flow_returns_saml_endpoints(self):
        """Test flow returns SAML endpoint URLs"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/test-flow/ORMD0001",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "saml_endpoints" in data, "Should have saml_endpoints"
        endpoints = data["saml_endpoints"]
        expected = ["login_url", "acs_url", "slo_url", "metadata_url"]
        for ep in expected:
            assert ep in endpoints, f"Should have '{ep}' endpoint"
        print(f"PASS: SAML endpoints returned: {list(endpoints.keys())}")
    
    # Test 25: Test flow returns config validity info
    def test_flow_returns_config_validity(self):
        """Test flow returns config_valid and config_issues"""
        session = get_super_admin_session()
        response = session.post(
            f"{BASE_URL}/api/saml-simulator/test-flow/ORMD0001",
            json={"user": self.get_test_user()}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "config_valid" in data, "Should have config_valid boolean"
        assert "config_issues" in data, "Should have config_issues list"
        assert isinstance(data["config_valid"], bool), "config_valid should be boolean"
        assert isinstance(data["config_issues"], list), "config_issues should be list"
        print(f"PASS: config_valid={data['config_valid']}, issues_count={len(data['config_issues'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
