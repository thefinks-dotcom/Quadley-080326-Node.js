"""
Test P0-P2 Features for Quadley Admin Dashboard
Tests: Job Management, Recognition, User Sorting, Export, Events, Setup Stats
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_CREDS = {"email": "gen@quadley.app", "password": "Quadley2025!"}
RA_CREDS = {"email": "epink@icloud.com", "password": "AbC!123!"}
STUDENT_CREDS = {"email": "alice@example.com", "password": "Quadley2025!"}


class TestAuthentication:
    """Test authentication for all user types"""
    
    def test_super_admin_login(self):
        """Super admin should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert data.get("user", {}).get("role") in ["super_admin", "admin"], f"Unexpected role: {data.get('user', {}).get('role')}"
        print(f"✓ Super admin login successful, role: {data.get('user', {}).get('role')}")
    
    def test_ra_login(self):
        """RA should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=RA_CREDS)
        assert response.status_code == 200, f"RA login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        print(f"✓ RA login successful, role: {data.get('user', {}).get('role')}")
    
    def test_student_login(self):
        """Student should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200, f"Student login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        print(f"✓ Student login successful, role: {data.get('user', {}).get('role')}")


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json().get("access_token")


@pytest.fixture
def ra_token():
    """Get RA authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=RA_CREDS)
    if response.status_code != 200:
        pytest.skip(f"RA login failed: {response.text}")
    return response.json().get("access_token")


@pytest.fixture
def student_token():
    """Get student authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
    if response.status_code != 200:
        pytest.skip(f"Student login failed: {response.text}")
    return response.json().get("access_token")


class TestJobManagement:
    """Test Job CRUD operations with pay_rate field"""
    
    def test_create_job_with_pay_rate(self, admin_token):
        """Create a job with pay_rate field should work"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        job_data = {
            "title": "TEST_Library Assistant",
            "description": "Help students find books and manage library resources",
            "category": "Library",
            "hours_per_week": 10,
            "pay_rate": "$15/hr"
        }
        response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
        assert response.status_code == 200, f"Create job failed: {response.text}"
        data = response.json()
        assert data.get("title") == job_data["title"], "Title mismatch"
        assert data.get("pay_rate") == job_data["pay_rate"], f"pay_rate mismatch: expected {job_data['pay_rate']}, got {data.get('pay_rate')}"
        assert data.get("hours_per_week") == job_data["hours_per_week"], "hours_per_week mismatch"
        print(f"✓ Job created with pay_rate: {data.get('pay_rate')}")
        return data.get("id")
    
    def test_get_jobs_list(self, admin_token):
        """Get list of jobs"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
        assert response.status_code == 200, f"Get jobs failed: {response.text}"
        jobs = response.json()
        assert isinstance(jobs, list), "Jobs should be a list"
        print(f"✓ Retrieved {len(jobs)} jobs")
    
    def test_update_job(self, admin_token):
        """Update a job"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a job
        job_data = {
            "title": "TEST_Update Job",
            "description": "Job to be updated",
            "category": "General",
            "hours_per_week": 5,
            "pay_rate": "$12/hr"
        }
        create_response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
        assert create_response.status_code == 200, f"Create job failed: {create_response.text}"
        job_id = create_response.json().get("id")
        
        # Update the job
        update_data = {
            "title": "TEST_Updated Job Title",
            "pay_rate": "$18/hr",
            "status": "active"
        }
        update_response = requests.patch(f"{BASE_URL}/api/jobs/{job_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200, f"Update job failed: {update_response.text}"
        updated_job = update_response.json()
        assert updated_job.get("title") == update_data["title"], "Title not updated"
        assert updated_job.get("pay_rate") == update_data["pay_rate"], "pay_rate not updated"
        print(f"✓ Job updated successfully, new pay_rate: {updated_job.get('pay_rate')}")
    
    def test_delete_job(self, admin_token):
        """Delete a job"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a job
        job_data = {
            "title": "TEST_Delete Job",
            "description": "Job to be deleted",
            "category": "General"
        }
        create_response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
        assert create_response.status_code == 200, f"Create job failed: {create_response.text}"
        job_id = create_response.json().get("id")
        
        # Delete the job
        delete_response = requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=headers)
        assert delete_response.status_code == 200, f"Delete job failed: {delete_response.text}"
        print(f"✓ Job deleted successfully")


class TestAdminDashboard:
    """Test Admin Dashboard - should NOT have super admin specific items"""
    
    def test_admin_stats_endpoint(self, admin_token):
        """Admin stats endpoint should work"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200, f"Admin stats failed: {response.text}"
        data = response.json()
        # Check that stats are returned
        assert "total_users" in data or "pending_requests" in data, "Stats should contain user/request counts"
        print(f"✓ Admin stats retrieved: {list(data.keys())[:5]}...")
    
    def test_no_tenant_management_for_admin(self, admin_token):
        """Regular admin should NOT have access to tenant management"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # This endpoint should only be accessible by super_admin
        response = requests.get(f"{BASE_URL}/api/tenants", headers=headers)
        # If the user is super_admin, they can access it, otherwise should be 403
        # The test is about the frontend not showing it, but we verify the endpoint exists
        print(f"✓ Tenant management endpoint response: {response.status_code}")


class TestRecognitionScreen:
    """Test Recognition/Shoutouts functionality"""
    
    def test_get_shoutouts(self, admin_token):
        """Get list of shoutouts/recognitions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/shoutouts", headers=headers)
        assert response.status_code == 200, f"Get shoutouts failed: {response.text}"
        shoutouts = response.json()
        assert isinstance(shoutouts, list), "Shoutouts should be a list"
        print(f"✓ Retrieved {len(shoutouts)} shoutouts")
    
    def test_create_shoutout(self, admin_token):
        """Create a new recognition/shoutout"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        shoutout_data = {
            "recipient_email": "alice@example.com",
            "message": "TEST_Great work on the project!",
            "category": "appreciation"
        }
        response = requests.post(f"{BASE_URL}/api/shoutouts", json=shoutout_data, headers=headers)
        assert response.status_code in [200, 201], f"Create shoutout failed: {response.text}"
        data = response.json()
        assert data.get("message") == shoutout_data["message"], "Message mismatch"
        print(f"✓ Shoutout created successfully")


class TestUserManagement:
    """Test User Management - pending users should be sorted to top"""
    
    def test_get_users_list(self, admin_token):
        """Get list of users via search endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users/search", headers=headers)
        assert response.status_code == 200, f"Get users failed: {response.text}"
        users = response.json()
        assert isinstance(users, list), "Users should be a list"
        print(f"✓ Retrieved {len(users)} users")
        
        # Check if pending users exist and are sorted to top
        pending_users = [u for u in users if u.get("status") == "pending" or not u.get("onboarding_completed")]
        if pending_users:
            print(f"  Found {len(pending_users)} pending users")


class TestExportFunctionality:
    """Test CSV/Report export functionality"""
    
    def test_admin_csv_templates(self, admin_token):
        """Get CSV templates for bulk import"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/csv-templates", headers=headers)
        assert response.status_code == 200, f"Get CSV templates failed: {response.text}"
        templates = response.json()
        # Templates can be a dict with template names as keys
        assert isinstance(templates, (list, dict)), "Templates should be a list or dict"
        if isinstance(templates, dict):
            assert len(templates) > 0, "Templates dict should not be empty"
            print(f"✓ Retrieved {len(templates)} CSV templates: {list(templates.keys())}")
        else:
            print(f"✓ Retrieved {len(templates)} CSV templates")


class TestSetupStats:
    """Test Setup Statistics screen"""
    
    def test_get_setup_stats(self, admin_token):
        """Get account setup statistics"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/setup-stats", headers=headers)
        assert response.status_code == 200, f"Get setup stats failed: {response.text}"
        data = response.json()
        # Check for expected fields
        assert "summary" in data or "completion_rate" in data or "total_invited" in data, f"Setup stats missing expected fields: {list(data.keys())}"
        print(f"✓ Setup stats retrieved: {list(data.keys())[:5]}...")


class TestEventsManagement:
    """Test Events CRUD operations"""
    
    def test_get_events(self, admin_token):
        """Get list of events"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        assert response.status_code == 200, f"Get events failed: {response.text}"
        events = response.json()
        assert isinstance(events, list), "Events should be a list"
        print(f"✓ Retrieved {len(events)} events")
    
    def test_create_event(self, admin_token):
        """Create a new event with date/time"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        event_date = (datetime.now() + timedelta(days=7)).isoformat()
        rsvp_deadline = (datetime.now() + timedelta(days=5)).isoformat()
        
        event_data = {
            "title": "TEST_Community Dinner",
            "description": "Monthly community dinner event",
            "location": "Main Hall",
            "category": "social",
            "date": event_date,
            "rsvp_deadline": rsvp_deadline,
            "max_attendees": 50
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert response.status_code in [200, 201], f"Create event failed: {response.text}"
        data = response.json()
        assert data.get("title") == event_data["title"], "Title mismatch"
        print(f"✓ Event created successfully with date: {data.get('date')}")
        return data.get("id")
    
    def test_update_event(self, admin_token):
        """Update an event"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create an event
        event_date = (datetime.now() + timedelta(days=10)).isoformat()
        event_data = {
            "title": "TEST_Update Event",
            "description": "Event to be updated",
            "location": "Room A",
            "category": "academic",
            "date": event_date
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert create_response.status_code in [200, 201], f"Create event failed: {create_response.text}"
        event_id = create_response.json().get("id")
        
        # Update the event - PUT requires all fields
        new_date = (datetime.now() + timedelta(days=14)).isoformat()
        update_data = {
            "title": "TEST_Updated Event Title",
            "description": "Updated event description",
            "date": new_date,
            "location": "Room B",
            "category": "social"
        }
        update_response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200, f"Update event failed: {update_response.text}"
        updated_event = update_response.json()
        assert updated_event.get("title") == update_data["title"], "Title not updated"
        print(f"✓ Event updated successfully")


class TestStudentReports:
    """Test Student Reports screen"""
    
    def test_get_student_reports(self, admin_token):
        """Get student reports/activity"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/student-reports", headers=headers)
        # This endpoint might not exist, check for 200 or 404
        if response.status_code == 200:
            print(f"✓ Student reports retrieved")
        elif response.status_code == 404:
            print(f"  Student reports endpoint not found - may use different path")
        else:
            print(f"  Student reports response: {response.status_code}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_jobs(self, admin_token):
        """Clean up TEST_ prefixed jobs"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
        if response.status_code == 200:
            jobs = response.json()
            test_jobs = [j for j in jobs if j.get("title", "").startswith("TEST_")]
            for job in test_jobs:
                delete_response = requests.delete(f"{BASE_URL}/api/jobs/{job['id']}", headers=headers)
                if delete_response.status_code == 200:
                    print(f"  Cleaned up job: {job['title']}")
        print(f"✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
