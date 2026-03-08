"""
Test Suite for Session Issues and Performance
Tests: Login API performance, Jobs tenant isolation, Auth token validation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ORMOND_STUDENT = {"email": "student1@ormond.com", "password": "Quadley2025!"}
MURPHY_STUDENT = {"email": "emeliaf@icloud.com", "password": "Maroon!!"}
SUPER_ADMIN = {"email": "gen@quadley.app", "password": "Quadley2025!"}
ORMOND_ADMIN = {"email": "admin@ormond.com", "password": "Quadley2025!"}


class TestLoginPerformance:
    """Test login API performance - should respond in <500ms"""
    
    def test_ormond_student_login_performance(self):
        """Login should respond in <500ms"""
        start = time.time()
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ORMOND_STUDENT)
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        assert elapsed < 0.5, f"Login took {elapsed:.3f}s, expected <0.5s"
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == ORMOND_STUDENT["email"]
        print(f"✓ Ormond student login: {elapsed:.3f}s")
    
    def test_murphy_student_login_performance(self):
        """Murphy Shark student login should respond in <500ms"""
        start = time.time()
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_STUDENT)
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        assert elapsed < 0.5, f"Login took {elapsed:.3f}s, expected <0.5s"
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == MURPHY_STUDENT["email"]
        print(f"✓ Murphy student login: {elapsed:.3f}s")
    
    def test_super_admin_login_performance(self):
        """Super admin login should respond in <500ms"""
        start = time.time()
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        assert elapsed < 0.5, f"Login took {elapsed:.3f}s, expected <0.5s"
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "super_admin"
        print(f"✓ Super admin login: {elapsed:.3f}s")


class TestAuthMeEndpoint:
    """Test /api/auth/me endpoint returns user data correctly"""
    
    @pytest.fixture
    def ormond_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ORMOND_STUDENT)
        return response.json()["access_token"]
    
    @pytest.fixture
    def murphy_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_STUDENT)
        return response.json()["access_token"]
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json()["access_token"]
    
    def test_auth_me_ormond_student(self, ormond_token):
        """Auth/me should return correct user data for Ormond student"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {ormond_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ORMOND_STUDENT["email"]
        assert data["tenant_code"] == "ORMD0001"
        assert data["role"] == "student"
        print("✓ Auth/me returns correct Ormond student data")
    
    def test_auth_me_murphy_student(self, murphy_token):
        """Auth/me should return correct user data for Murphy student"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {murphy_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == MURPHY_STUDENT["email"]
        assert data["tenant_code"] == "MURP1021"
        assert data["role"] == "student"
        print("✓ Auth/me returns correct Murphy student data")
    
    def test_auth_me_super_admin(self, super_admin_token):
        """Auth/me should return correct user data for super admin"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == SUPER_ADMIN["email"]
        assert data["role"] == "super_admin"
        print("✓ Auth/me returns correct super admin data")
    
    def test_auth_me_invalid_token(self):
        """Auth/me should return 401 for invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code == 401
        print("✓ Auth/me correctly rejects invalid token")


class TestJobsTenantIsolation:
    """Test Jobs API returns tenant-isolated data - SECURITY CRITICAL"""
    
    @pytest.fixture
    def ormond_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ORMOND_STUDENT)
        return response.json()["access_token"]
    
    @pytest.fixture
    def murphy_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MURPHY_STUDENT)
        return response.json()["access_token"]
    
    def test_ormond_sees_ormond_jobs(self, ormond_token):
        """Ormond student should see Ormond College jobs only"""
        response = requests.get(
            f"{BASE_URL}/api/jobs",
            headers={"Authorization": f"Bearer {ormond_token}"}
        )
        
        assert response.status_code == 200
        jobs = response.json()
        
        # Ormond should have 1 job (Production Manager)
        assert len(jobs) == 1, f"Expected 1 job for Ormond, got {len(jobs)}"
        assert jobs[0]["title"] == "Production Manager"
        print(f"✓ Ormond student sees 1 job: {jobs[0]['title']}")
    
    def test_murphy_sees_murphy_jobs(self, murphy_token):
        """Murphy Shark student should see Murphy Shark jobs only (0 jobs)"""
        response = requests.get(
            f"{BASE_URL}/api/jobs",
            headers={"Authorization": f"Bearer {murphy_token}"}
        )
        
        assert response.status_code == 200
        jobs = response.json()
        
        # Murphy Shark should have 0 jobs
        assert len(jobs) == 0, f"Expected 0 jobs for Murphy Shark, got {len(jobs)}"
        print("✓ Murphy Shark student sees 0 jobs (correct isolation)")
    
    def test_cross_tenant_isolation(self, ormond_token, murphy_token):
        """SECURITY: Verify cross-tenant isolation - Murphy should NOT see Ormond jobs"""
        # Get Ormond jobs
        ormond_response = requests.get(
            f"{BASE_URL}/api/jobs",
            headers={"Authorization": f"Bearer {ormond_token}"}
        )
        ormond_jobs = ormond_response.json()
        
        # Get Murphy jobs
        murphy_response = requests.get(
            f"{BASE_URL}/api/jobs",
            headers={"Authorization": f"Bearer {murphy_token}"}
        )
        murphy_jobs = murphy_response.json()
        
        # Verify isolation
        ormond_job_ids = {j["id"] for j in ormond_jobs}
        murphy_job_ids = {j["id"] for j in murphy_jobs}
        
        # No overlap should exist
        overlap = ormond_job_ids & murphy_job_ids
        assert len(overlap) == 0, f"SECURITY VIOLATION: Jobs visible to both tenants: {overlap}"
        
        # Verify Ormond has jobs that Murphy doesn't see
        if len(ormond_jobs) > 0:
            assert len(murphy_jobs) == 0 or ormond_job_ids != murphy_job_ids, \
                "SECURITY VIOLATION: Murphy can see Ormond jobs"
        
        print(f"✓ Cross-tenant isolation verified: Ormond={len(ormond_jobs)} jobs, Murphy={len(murphy_jobs)} jobs")


class TestTokenExpiration:
    """Test token expiration is set to 7 days (10080 minutes)"""
    
    def test_token_contains_correct_expiration(self):
        """Token should have 7-day expiration"""
        import jwt
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ORMOND_STUDENT)
        assert response.status_code == 200
        
        token = response.json()["access_token"]
        
        # Decode without verification to check claims
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        # Check exp and iat claims
        assert "exp" in decoded, "Token missing exp claim"
        assert "iat" in decoded, "Token missing iat claim"
        
        # Calculate expiration duration
        exp_duration_seconds = decoded["exp"] - decoded["iat"]
        exp_duration_minutes = exp_duration_seconds / 60
        
        # Should be 10080 minutes (7 days)
        expected_minutes = 10080
        assert abs(exp_duration_minutes - expected_minutes) < 1, \
            f"Token expiration is {exp_duration_minutes} minutes, expected {expected_minutes}"
        
        print(f"✓ Token expiration: {exp_duration_minutes} minutes ({exp_duration_minutes/60/24:.1f} days)")


class TestJobsEndpointWithoutAuth:
    """Test Jobs endpoint requires authentication"""
    
    def test_jobs_requires_auth(self):
        """Jobs endpoint should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        
        # Should require authentication
        assert response.status_code in [401, 403], \
            f"Jobs endpoint should require auth, got {response.status_code}"
        print("✓ Jobs endpoint correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
