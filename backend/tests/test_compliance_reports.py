"""
Test Suite: Privacy Compliance Reports Feature
===============================================
Tests the weekly compliance report scheduling, manual sending, and report history.
Endpoints tested:
- GET /api/privacy/compliance-reports/schedule
- POST /api/privacy/compliance-reports/schedule  
- POST /api/privacy/compliance-reports/send
- GET /api/privacy/compliance-reports
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.com"
SUPER_ADMIN_PASSWORD = "Quadley2025!"
TENANT_ADMIN_EMAIL = "admin@ormond.com"
TENANT_ADMIN_PASSWORD = "Quadley2025!"
STUDENT_EMAIL = "student2@ormond.com"
STUDENT_PASSWORD = "Quadley2025!"


@pytest.fixture(scope="module")
def super_admin_token():
    """Login as super admin and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Super admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def tenant_admin_token():
    """Login as tenant admin and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TENANT_ADMIN_EMAIL,
        "password": TENANT_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Tenant admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def student_token():
    """Login as student and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    assert response.status_code == 200, f"Student login failed: {response.text}"
    return response.json()["access_token"]


class TestGetSchedule:
    """GET /api/privacy/compliance-reports/schedule"""
    
    def test_get_schedule_without_auth_returns_401(self):
        """Schedule endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/privacy/compliance-reports/schedule")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_get_schedule_as_student_returns_403(self, student_token):
        """Students cannot access schedule - admin only"""
        response = requests.get(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 403
        assert "Admin access required" in response.json().get("detail", "")
    
    def test_get_schedule_as_super_admin_returns_200(self, super_admin_token):
        """Super admin can get schedule"""
        response = requests.get(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate schedule structure
        assert "id" in data
        assert data["id"] == "privacy_compliance_schedule"
        assert "enabled" in data
        assert "day_of_week" in data
        assert "hour_utc" in data
        assert "recipients" in data
        
        # Validate day_of_week is valid
        valid_days = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
        assert data["day_of_week"] in valid_days
        
        # Validate hour_utc is 0-23
        assert 0 <= data["hour_utc"] <= 23
        
        # Validate recipients is valid
        valid_recipients = {"super_admins", "all_admins"}
        assert data["recipients"] in valid_recipients
    
    def test_get_schedule_as_tenant_admin_returns_200(self, tenant_admin_token):
        """Tenant admin can also get schedule"""
        response = requests.get(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "day_of_week" in data


class TestUpdateSchedule:
    """POST /api/privacy/compliance-reports/schedule"""
    
    def test_update_schedule_without_auth_returns_401(self):
        """Schedule update requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            json={"day_of_week": "friday"}
        )
        assert response.status_code == 401 or response.status_code == 403
    
    def test_update_schedule_as_student_returns_403(self, student_token):
        """Students cannot update schedule - admin only"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"day_of_week": "friday"}
        )
        assert response.status_code == 403
    
    def test_update_schedule_as_tenant_admin_returns_403(self, tenant_admin_token):
        """Only super admins can update schedule, not tenant admins"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {tenant_admin_token}"},
            json={"day_of_week": "friday"}
        )
        assert response.status_code == 403
        assert "super admin" in response.json().get("detail", "").lower()
    
    def test_update_schedule_invalid_day_returns_400(self, super_admin_token):
        """Invalid day_of_week should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"day_of_week": "invalid_day"}
        )
        assert response.status_code == 400
        assert "day_of_week" in response.json().get("detail", "").lower()
    
    def test_update_schedule_invalid_hour_returns_400(self, super_admin_token):
        """Invalid hour_utc (out of range) should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"hour_utc": 25}  # Invalid - must be 0-23
        )
        assert response.status_code == 400
        assert "hour_utc" in response.json().get("detail", "").lower()
    
    def test_update_schedule_invalid_recipients_returns_400(self, super_admin_token):
        """Invalid recipients value should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"recipients": "invalid_recipients"}
        )
        assert response.status_code == 400
        assert "recipients" in response.json().get("detail", "").lower()
    
    def test_update_schedule_day_success(self, super_admin_token):
        """Super admin can update day_of_week"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"day_of_week": "thursday"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["day_of_week"] == "thursday"
    
    def test_update_schedule_hour_success(self, super_admin_token):
        """Super admin can update hour_utc"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"hour_utc": 14}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["hour_utc"] == 14
    
    def test_update_schedule_recipients_success(self, super_admin_token):
        """Super admin can update recipients"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"recipients": "all_admins"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["recipients"] == "all_admins"
        
        # Reset to super_admins
        requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"recipients": "super_admins"}
        )
    
    def test_update_schedule_enabled_toggle(self, super_admin_token):
        """Super admin can enable/disable schedule"""
        # Disable
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"enabled": False}
        )
        assert response.status_code == 200
        assert response.json()["enabled"] == False
        
        # Re-enable
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"enabled": True}
        )
        assert response.status_code == 200
        assert response.json()["enabled"] == True


class TestSendReportNow:
    """POST /api/privacy/compliance-reports/send"""
    
    def test_send_report_without_auth_returns_401(self):
        """Send report requires authentication"""
        response = requests.post(f"{BASE_URL}/api/privacy/compliance-reports/send")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_send_report_as_student_returns_403(self, student_token):
        """Students cannot send reports - admin only"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/send",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 403
    
    def test_send_report_as_tenant_admin_returns_403(self, tenant_admin_token):
        """Only super admins can send compliance reports"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/send",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        assert response.status_code == 403
        assert "super admin" in response.json().get("detail", "").lower()
    
    def test_send_report_as_super_admin_success(self, super_admin_token):
        """Super admin can manually send compliance report"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/send",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "report_id" in data
        assert "coverage_percent" in data
        assert "flagged_count" in data
        assert "recipients_count" in data
        assert "emails_sent" in data
        assert "email_results" in data
        assert "generated_at" in data
        
        # Validate data types
        assert isinstance(data["report_id"], str)
        assert isinstance(data["coverage_percent"], (int, float))
        assert isinstance(data["flagged_count"], int)
        assert isinstance(data["recipients_count"], int)
        assert isinstance(data["emails_sent"], int)
        
        # Coverage should be 0-100
        assert 0 <= data["coverage_percent"] <= 100


class TestListComplianceReports:
    """GET /api/privacy/compliance-reports"""
    
    def test_list_reports_without_auth_returns_401(self):
        """List reports requires authentication"""
        response = requests.get(f"{BASE_URL}/api/privacy/compliance-reports")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_list_reports_as_student_returns_403(self, student_token):
        """Students cannot list reports - admin only"""
        response = requests.get(
            f"{BASE_URL}/api/privacy/compliance-reports",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 403
    
    def test_list_reports_as_super_admin_success(self, super_admin_token):
        """Super admin can list compliance reports"""
        response = requests.get(
            f"{BASE_URL}/api/privacy/compliance-reports",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "reports" in data
        assert "total" in data
        assert isinstance(data["reports"], list)
        assert isinstance(data["total"], int)
        
        # Should have at least one report (from send test and previous manual test)
        assert len(data["reports"]) >= 1
        
        # Validate report structure
        report = data["reports"][0]
        assert "id" in report
        assert "type" in report
        assert report["type"] == "compliance_report"
        assert "triggered_by" in report
        assert "report_data" in report
        assert "recipients_count" in report
        assert "emails_sent" in report
        assert "generated_at" in report
        
        # Validate report_data structure
        report_data = report["report_data"]
        assert "coverage_percent" in report_data
        assert "flagged_items" in report_data
        assert isinstance(report_data["flagged_items"], list)
    
    def test_list_reports_as_tenant_admin_success(self, tenant_admin_token):
        """Tenant admin can also list compliance reports (read-only)"""
        response = requests.get(
            f"{BASE_URL}/api/privacy/compliance-reports",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data


class TestScheduleValidation:
    """Additional validation tests for schedule endpoint"""
    
    def test_hour_utc_boundary_0(self, super_admin_token):
        """Hour 0 (midnight) should be valid"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"hour_utc": 0}
        )
        assert response.status_code == 200
        assert response.json()["hour_utc"] == 0
    
    def test_hour_utc_boundary_23(self, super_admin_token):
        """Hour 23 (11pm) should be valid"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"hour_utc": 23}
        )
        assert response.status_code == 200
        assert response.json()["hour_utc"] == 23
    
    def test_hour_utc_negative_invalid(self, super_admin_token):
        """Negative hour should be invalid"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"hour_utc": -1}
        )
        assert response.status_code == 400
    
    def test_day_case_insensitive(self, super_admin_token):
        """Day of week should accept different cases"""
        response = requests.post(
            f"{BASE_URL}/api/privacy/compliance-reports/schedule",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"day_of_week": "MONDAY"}
        )
        assert response.status_code == 200
        # Should be normalized to lowercase
        assert response.json()["day_of_week"] == "monday"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
