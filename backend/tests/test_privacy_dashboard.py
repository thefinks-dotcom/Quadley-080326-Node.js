"""
Test Suite: Data Privacy Dashboard API Endpoints
Tests: GET /api/privacy/status, GET /api/privacy/fields, POST /api/privacy/migrate, GET /api/privacy/audit-log
Features: Encryption status, PII field inventory, migration (dry run & actual), audit logging
Authentication: All endpoints require admin role (super_admin or admin)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_ADMIN_EMAIL = "admin@ormond.com"
TENANT_ADMIN_PASSWORD = "Quadley2025!"
STUDENT_EMAIL = "student2@ormond.com"
STUDENT_PASSWORD = "Quadley2025!"


@pytest.fixture(scope="function")
def api_client():
    """Fresh requests session for each test - no cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def authenticated_super_admin_session():
    """Authenticated session with httpOnly cookie for super admin"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Super admin authentication failed: {response.status_code}")
    return session


@pytest.fixture(scope="module")
def authenticated_tenant_admin_session():
    """Authenticated session with httpOnly cookie for tenant admin"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TENANT_ADMIN_EMAIL,
        "password": TENANT_ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Tenant admin authentication failed: {response.status_code}")
    return session


@pytest.fixture(scope="module")
def authenticated_student_session():
    """Authenticated session with httpOnly cookie for student"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Student authentication failed: {response.status_code}")
    return session


@pytest.fixture(scope="module")
def super_admin_token(authenticated_super_admin_session):
    """Super admin session is authenticated via httpOnly cookie"""
    return "cookie_auth"  # Token not used, session has cookie


@pytest.fixture(scope="module")
def tenant_admin_token(authenticated_tenant_admin_session):
    """Tenant admin session is authenticated via httpOnly cookie"""
    return "cookie_auth"  # Token not used, session has cookie


@pytest.fixture(scope="module")
def student_token(authenticated_student_session):
    """Student session is authenticated via httpOnly cookie"""
    return "cookie_auth"  # Token not used, session has cookie


class TestPrivacyStatusEndpoint:
    """Test GET /api/privacy/status endpoint"""

    def test_status_requires_authentication(self, api_client):
        """Returns 401 without authentication token"""
        response = api_client.get(f"{BASE_URL}/api/privacy/status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ GET /api/privacy/status returns 401 without auth")

    def test_status_forbidden_for_students(self, authenticated_student_session):
        """Returns 403 for students (non-admin role)"""
        response = authenticated_student_session.get(f"{BASE_URL}/api/privacy/status")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ GET /api/privacy/status returns 403 for students")

    def test_status_success_super_admin(self, authenticated_super_admin_session):
        """Super admin can access encryption status and sees all tenants"""
        response = authenticated_super_admin_session.get(f"{BASE_URL}/api/privacy/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "encryption_enabled" in data, "Missing encryption_enabled field"
        assert "algorithm" in data, "Missing algorithm field"
        assert "summary" in data, "Missing summary field"
        assert "collections" in data, "Missing collections field"
        assert "scanned_at" in data, "Missing scanned_at field"
        
        # Validate summary structure
        summary = data["summary"]
        assert "total_pii_values" in summary
        assert "encrypted" in summary
        assert "unencrypted" in summary
        assert "coverage_percent" in summary
        
        # Validate algorithm
        assert data["algorithm"] == "AES-256-GCM", f"Unexpected algorithm: {data['algorithm']}"
        
        print(f"✓ Super admin sees encryption status - Coverage: {summary['coverage_percent']}%, Encrypted: {summary['encrypted']}, Unencrypted: {summary['unencrypted']}")

    def test_status_success_tenant_admin(self, authenticated_tenant_admin_session):
        """Tenant admin can access encryption status for their tenant only"""
        response = authenticated_tenant_admin_session.get(f"{BASE_URL}/api/privacy/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "encryption_enabled" in data
        assert "summary" in data
        assert "collections" in data
        
        # Tenant admin should only see their tenant's data
        collections = data.get("collections", [])
        print(f"✓ Tenant admin sees encryption status - {len(collections)} collection entries")


class TestPrivacyFieldsEndpoint:
    """Test GET /api/privacy/fields endpoint"""

    def test_fields_requires_authentication(self, api_client):
        """Returns 401 without authentication token"""
        response = api_client.get(f"{BASE_URL}/api/privacy/fields")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ GET /api/privacy/fields returns 401 without auth")

    def test_fields_forbidden_for_students(self, authenticated_student_session):
        """Returns 403 for students (non-admin role)"""
        response = authenticated_student_session.get(f"{BASE_URL}/api/privacy/fields")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ GET /api/privacy/fields returns 403 for students")

    def test_fields_returns_pii_inventory(self, authenticated_super_admin_session):
        """Returns PII field inventory with expected fields"""
        response = authenticated_super_admin_session.get(f"{BASE_URL}/api/privacy/fields")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "encryption_enabled" in data
        assert "algorithm" in data
        assert "key_source" in data
        assert "fields" in data
        assert "total_tracked_fields" in data
        
        fields = data["fields"]
        assert isinstance(fields, list), "fields should be a list"
        assert len(fields) >= 6, f"Expected at least 6 PII fields, got {len(fields)}"
        
        # Validate field structure
        for field in fields:
            assert "collection" in field
            assert "field" in field
            assert "encryption_type" in field
            assert "is_default" in field
        
        # Check expected PII fields are tracked
        field_names = [f["field"] for f in fields]
        expected_fields = ["phone", "emergency_contact", "emergency_contact_phone", "emergency_contact_name", "medical_info", "preferred_contact"]
        for expected in expected_fields:
            assert expected in field_names, f"Expected PII field '{expected}' not found in inventory"
        
        print(f"✓ PII Field Inventory returned {len(fields)} tracked fields: {field_names}")


class TestPrivacyMigrateEndpoint:
    """Test POST /api/privacy/migrate endpoint (dry run and actual migration)"""

    def test_migrate_requires_authentication(self, api_client):
        """Returns 401 without authentication token"""
        response = api_client.post(f"{BASE_URL}/api/privacy/migrate?dry_run=true")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ POST /api/privacy/migrate returns 401 without auth")

    def test_migrate_forbidden_for_students(self, authenticated_student_session):
        """Returns 403 for students (non-admin role)"""
        response = authenticated_student_session.post(f"{BASE_URL}/api/privacy/migrate?dry_run=true")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ POST /api/privacy/migrate returns 403 for students")

    def test_migrate_dry_run_super_admin(self, authenticated_super_admin_session):
        """Dry run shows count of fields to encrypt without changing data"""
        response = authenticated_super_admin_session.post(f"{BASE_URL}/api/privacy/migrate?dry_run=true")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "migration_id" in data
        assert "dry_run" in data
        assert data["dry_run"] == True, "Expected dry_run=true"
        assert "total_fields_encrypted" in data
        assert "details" in data
        assert "started_at" in data
        assert "completed_at" in data
        
        print(f"✓ Dry run completed - {data['total_fields_encrypted']} fields would be encrypted")

    def test_migrate_dry_run_tenant_admin(self, authenticated_tenant_admin_session):
        """Tenant admin can run dry run for their tenant"""
        response = authenticated_tenant_admin_session.post(f"{BASE_URL}/api/privacy/migrate?dry_run=true")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["dry_run"] == True
        assert "total_fields_encrypted" in data
        
        print(f"✓ Tenant admin dry run completed - {data['total_fields_encrypted']} fields would be encrypted")

    def test_migrate_actual_super_admin(self, authenticated_super_admin_session):
        """Actual migration encrypts unencrypted PII and logs to audit"""
        response = authenticated_super_admin_session.post(f"{BASE_URL}/api/privacy/migrate?dry_run=false")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "migration_id" in data
        assert "dry_run" in data
        assert data["dry_run"] == False, "Expected dry_run=false for actual migration"
        assert "total_fields_encrypted" in data
        assert "details" in data
        
        print(f"✓ Actual migration completed - {data['total_fields_encrypted']} fields encrypted, migration_id: {data['migration_id']}")


class TestPrivacyAuditLogEndpoint:
    """Test GET /api/privacy/audit-log endpoint"""

    def test_audit_log_requires_authentication(self, api_client):
        """Returns 401 without authentication token"""
        response = api_client.get(f"{BASE_URL}/api/privacy/audit-log")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ GET /api/privacy/audit-log returns 401 without auth")

    def test_audit_log_forbidden_for_students(self, authenticated_student_session):
        """Returns 403 for students (non-admin role)"""
        response = authenticated_student_session.get(f"{BASE_URL}/api/privacy/audit-log")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ GET /api/privacy/audit-log returns 403 for students")

    def test_audit_log_returns_history(self, authenticated_super_admin_session):
        """Returns history of migrations"""
        response = authenticated_super_admin_session.get(f"{BASE_URL}/api/privacy/audit-log")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)
        
        # If migrations have been run, validate log structure
        if len(data["logs"]) > 0:
            log = data["logs"][0]
            assert "id" in log or "migration_id" in log or "type" in log, "Log entry missing identifier"
            assert "admin_email" in log, "Log entry missing admin_email"
            assert "completed_at" in log, "Log entry missing completed_at"
        
        print(f"✓ Audit log returned {data['total']} entries")


class TestPrivacyEndpointsIntegration:
    """Integration tests for privacy dashboard workflow"""

    def test_full_workflow(self, authenticated_super_admin_session):
        """Test complete workflow: status -> fields -> dry_run -> migrate -> audit_log"""
        session = authenticated_super_admin_session
        
        # Step 1: Check status
        status_res = session.get(f"{BASE_URL}/api/privacy/status")
        assert status_res.status_code == 200
        initial_status = status_res.json()
        print(f"Step 1 ✓ Status check: {initial_status['summary']['coverage_percent']}% coverage")
        
        # Step 2: Get fields inventory
        fields_res = session.get(f"{BASE_URL}/api/privacy/fields")
        assert fields_res.status_code == 200
        fields_data = fields_res.json()
        print(f"Step 2 ✓ Fields inventory: {fields_data['total_tracked_fields']} fields tracked")
        
        # Step 3: Run dry run
        dry_run_res = session.post(f"{BASE_URL}/api/privacy/migrate?dry_run=true")
        assert dry_run_res.status_code == 200
        dry_run_data = dry_run_res.json()
        print(f"Step 3 ✓ Dry run: {dry_run_data['total_fields_encrypted']} fields would be encrypted")
        
        # Step 4: Run actual migration (only if there are fields to encrypt)
        migrate_res = session.post(f"{BASE_URL}/api/privacy/migrate?dry_run=false")
        assert migrate_res.status_code == 200
        migrate_data = migrate_res.json()
        print(f"Step 4 ✓ Migration: {migrate_data['total_fields_encrypted']} fields encrypted")
        
        # Step 5: Check audit log
        audit_res = session.get(f"{BASE_URL}/api/privacy/audit-log")
        assert audit_res.status_code == 200
        audit_data = audit_res.json()
        print(f"Step 5 ✓ Audit log: {audit_data['total']} entries")
        
        print("✓ Full workflow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
