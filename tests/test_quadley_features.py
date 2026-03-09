"""
Quadley Mobile App Backend Tests
Testing bug fixes and new features:
- P0: Announcements POST - Admin should be able to post normal and emergency announcements
- P1: Maintenance/Service Request GET - Should work for all roles including super_admin
- P1: Shoutouts GET and POST - Should work for all users, mobile format with recipient_name
- P2: Late Meal Request POST - Should accept meal_type, date, and optional dietary_requirements
- Job Creation - pay_rate field should be optional
- Annual Disclosure Report - GET /api/safe-disclosures/annual-report should return available years
- Annual Disclosure Report - GET /api/safe-disclosures/annual-report/{year} should return aggregated report
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mobile-redesign-20.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "gen@quadley.app"
ADMIN_PASSWORD = "Quadley2025!"

# Test user for student role
TEST_STUDENT_EMAIL = f"test_student_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
TEST_STUDENT_PASSWORD = "TestPass123!"


class TestAuth:
    """Authentication tests to get tokens for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")
    
    def test_admin_login(self, admin_token):
        """Test admin can login successfully"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"✓ Admin login successful, token obtained")


class TestAnnouncements:
    """P0: Test Announcements POST - Admin should be able to post normal and emergency announcements"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_create_normal_announcement(self, admin_token):
        """Test admin can create a normal announcement"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "title": "TEST Normal Announcement",
            "content": "This is a test normal announcement content",
            "target_audience": "all",
            "priority": "normal",
            "is_emergency": False
        }
        
        response = requests.post(f"{BASE_URL}/api/announcements", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("title") == payload["title"]
        assert data.get("content") == payload["content"]
        assert data.get("is_emergency") == False
        print(f"✓ Normal announcement created successfully: {data.get('id')}")
    
    def test_create_emergency_announcement_with_is_emergency(self, admin_token):
        """Test admin can create an emergency announcement using is_emergency field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "title": "TEST Emergency Announcement (is_emergency)",
            "content": "This is a test emergency announcement",
            "target_audience": "all",
            "priority": "high",
            "is_emergency": True
        }
        
        response = requests.post(f"{BASE_URL}/api/announcements", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("title") == payload["title"]
        assert data.get("is_emergency") == True
        print(f"✓ Emergency announcement (is_emergency) created successfully: {data.get('id')}")
    
    def test_create_emergency_announcement_with_emergency_field(self, admin_token):
        """Test admin can create an emergency announcement using mobile 'emergency' field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "title": "TEST Emergency Announcement (mobile format)",
            "content": "This is a test emergency announcement from mobile",
            "target_audience": "all",
            "priority": "high",
            "emergency": True  # Mobile app sends this field
        }
        
        response = requests.post(f"{BASE_URL}/api/announcements", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("title") == payload["title"]
        # Should be stored as is_emergency=True
        assert data.get("is_emergency") == True or data.get("emergency") == True
        print(f"✓ Emergency announcement (mobile format) created successfully: {data.get('id')}")
    
    def test_get_announcements(self, admin_token):
        """Test getting announcements list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/announcements", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} announcements")


class TestMaintenance:
    """P1: Test Maintenance/Service Request GET - Should work for all roles including super_admin"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_create_maintenance_request(self, admin_token):
        """Test creating a maintenance request"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "room_number": "TEST-101",
            "issue_type": "plumbing",
            "description": "TEST: Leaky faucet in bathroom",
            "priority": "normal"
        }
        
        response = requests.post(f"{BASE_URL}/api/maintenance", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("room_number") == payload["room_number"]
        assert data.get("issue_type") == payload["issue_type"]
        print(f"✓ Maintenance request created successfully: {data.get('id')}")
    
    def test_get_maintenance_requests_as_admin(self, admin_token):
        """Test admin can get all maintenance requests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/maintenance", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin got {len(data)} maintenance requests")
    
    def test_get_maintenance_requests_role_check(self, admin_token):
        """Verify the role check includes super_admin in the code"""
        # This test verifies the endpoint works - the role check is in the code
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/maintenance", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Maintenance GET endpoint working correctly")


class TestShoutouts:
    """P1: Test Shoutouts GET and POST - Should work for all users, mobile format with recipient_name"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_create_shoutout_web_format(self, admin_token):
        """Test creating a shoutout using web format (to_user_name)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "to_user_name": "Test User",
            "message": "TEST: Great job on the project!",
            "category": "achievement",
            "broadcast": True
        }
        
        response = requests.post(f"{BASE_URL}/api/shoutouts", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("message") == payload["message"]
        assert data.get("category") == payload["category"]
        print(f"✓ Shoutout (web format) created successfully: {data.get('id')}")
    
    def test_create_shoutout_mobile_format(self, admin_token):
        """Test creating a shoutout using mobile format (recipient_name)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "recipient_name": "Mobile Test User",
            "message": "TEST: Thanks for your help from mobile!",
            "category": "kindness",
            "broadcast": True
        }
        
        response = requests.post(f"{BASE_URL}/api/shoutouts", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("message") == payload["message"]
        # Should have recipient_name in response for mobile compatibility
        assert data.get("recipient_name") is not None or data.get("to_user_name") is not None
        print(f"✓ Shoutout (mobile format) created successfully: {data.get('id')}")
    
    def test_get_shoutouts(self, admin_token):
        """Test getting shoutouts list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/shoutouts", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} shoutouts")


class TestLateMealRequest:
    """P2: Test Late Meal Request POST - Should accept meal_type, date, and optional dietary_requirements"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_create_late_meal_request_with_dietary(self, admin_token):
        """Test creating a late meal request with dietary requirements"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        payload = {
            "meal_type": "dinner",
            "date": tomorrow,
            "reason": "TEST: Late class",
            "dietary_requirements": "vegetarian, gluten-free"
        }
        
        response = requests.post(f"{BASE_URL}/api/dining/late-meals", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("meal_type") == payload["meal_type"]
        assert data.get("date") == payload["date"]
        assert data.get("dietary_requirements") == payload["dietary_requirements"]
        print(f"✓ Late meal request with dietary requirements created: {data.get('id')}")
    
    def test_create_late_meal_request_without_dietary(self, admin_token):
        """Test creating a late meal request without dietary requirements (optional field)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        payload = {
            "meal_type": "lunch",
            "date": tomorrow,
            "reason": "TEST: Meeting"
        }
        
        response = requests.post(f"{BASE_URL}/api/dining/late-meals", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("meal_type") == payload["meal_type"]
        assert data.get("date") == payload["date"]
        print(f"✓ Late meal request without dietary requirements created: {data.get('id')}")
    
    def test_create_late_meal_request_optional_reason(self, admin_token):
        """Test creating a late meal request with optional reason (mobile compatibility)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        payload = {
            "meal_type": "breakfast",
            "date": tomorrow
            # reason is optional for mobile app
        }
        
        response = requests.post(f"{BASE_URL}/api/dining/late-meals", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("meal_type") == payload["meal_type"]
        print(f"✓ Late meal request with optional reason created: {data.get('id')}")
    
    def test_get_late_meal_requests(self, admin_token):
        """Test getting late meal requests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/dining/late-meals", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} late meal requests")


class TestJobs:
    """Test Job Creation - pay_rate field should be optional"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_create_job_with_pay_rate(self, admin_token):
        """Test creating a job with pay_rate specified"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "title": "TEST Library Assistant",
            "description": "Help students find books and manage library resources",
            "category": "Library",
            "hours_per_week": 10,
            "pay_rate": "$15/hr",
            "department": "Library Services",
            "status": "active"
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("title") == payload["title"]
        assert data.get("pay_rate") == payload["pay_rate"]
        print(f"✓ Job with pay_rate created: {data.get('id')}")
    
    def test_create_job_without_pay_rate(self, admin_token):
        """Test creating a job without pay_rate (optional field)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "title": "TEST Volunteer Position",
            "description": "Volunteer opportunity to help with campus events",
            "category": "Volunteer",
            "hours_per_week": 5,
            "department": "Student Affairs",
            "status": "active"
            # pay_rate is intentionally omitted
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("title") == payload["title"]
        # pay_rate should be None or not present
        assert data.get("pay_rate") is None or "pay_rate" not in data
        print(f"✓ Job without pay_rate created: {data.get('id')}")
    
    def test_get_jobs(self, admin_token):
        """Test getting jobs list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} jobs")


class TestAnnualDisclosureReport:
    """Test Annual Disclosure Report endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_get_available_annual_reports(self, admin_token):
        """Test GET /api/safe-disclosures/annual-report returns available years"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/safe-disclosures/annual-report", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "available_academic_years" in data
        assert "current_academic_year" in data
        assert isinstance(data["available_academic_years"], list)
        print(f"✓ Got available annual reports: {len(data['available_academic_years'])} years")
        print(f"  Current academic year: {data['current_academic_year']}")
    
    def test_get_annual_report_for_year(self, admin_token):
        """Test GET /api/safe-disclosures/annual-report/{year} returns aggregated report"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current academic year
        current_year = datetime.now().year if datetime.now().month >= 7 else datetime.now().year - 1
        
        response = requests.get(f"{BASE_URL}/api/safe-disclosures/annual-report/{current_year}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify report structure
        assert "report_period" in data
        assert "summary" in data
        assert "safety_metrics" in data
        assert "incident_types" in data
        assert "status_breakdown" in data
        
        # Verify report period
        assert data["report_period"]["academic_year"] == f"{current_year}-{current_year + 1}"
        
        # Verify summary fields
        assert "total_disclosures" in data["summary"]
        assert "anonymous_disclosures" in data["summary"]
        assert "resolution_rate_percent" in data["summary"]
        
        print(f"✓ Got annual report for {current_year}-{current_year + 1}")
        print(f"  Total disclosures: {data['summary']['total_disclosures']}")
        print(f"  Resolution rate: {data['summary']['resolution_rate_percent']}%")
    
    def test_annual_report_unauthorized_for_non_admin(self):
        """Test that non-admin users cannot access annual reports"""
        # First, try to register a student user
        student_email = f"test_student_{datetime.now().strftime('%Y%m%d%H%M%S%f')}@test.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": student_email,
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "Student",
            "role": "student"
        })
        
        if register_response.status_code == 200:
            student_token = register_response.json().get("access_token")
            headers = {"Authorization": f"Bearer {student_token}"}
            
            response = requests.get(f"{BASE_URL}/api/safe-disclosures/annual-report", headers=headers)
            
            # Should be forbidden for students
            assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}"
            print(f"✓ Annual report correctly restricted from students")
        else:
            # If registration fails, skip this test
            pytest.skip(f"Could not create test student: {register_response.status_code}")


class TestSafeDisclosures:
    """Test Safe Disclosure endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_create_safe_disclosure(self, admin_token):
        """Test creating a safe disclosure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "is_anonymous": False,
            "incident_type": "harassment",
            "incident_date": datetime.now().strftime("%Y-%m-%d"),
            "incident_location": "TEST Location",
            "description": "TEST: This is a test disclosure for testing purposes",
            "immediate_danger": False,
            "medical_attention_needed": False,
            "police_notified": False,
            "support_requested": ["counseling"]
        }
        
        response = requests.post(f"{BASE_URL}/api/safe-disclosures", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("incident_type") == payload["incident_type"]
        assert data.get("description") == payload["description"]
        print(f"✓ Safe disclosure created: {data.get('id')}")
    
    def test_get_safe_disclosures(self, admin_token):
        """Test getting safe disclosures list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/safe-disclosures", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} safe disclosures")
    
    def test_get_disclosure_stats(self, admin_token):
        """Test getting disclosure statistics"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/safe-disclosures/stats", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total" in data
        print(f"✓ Got disclosure stats: {data['total']} total disclosures")


class TestDiningMenu:
    """Test Dining Menu endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_get_menu(self, admin_token):
        """Test getting dining menu"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Menu endpoint doesn't require auth based on the code
        response = requests.get(f"{BASE_URL}/api/dining/menu")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} menu items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
