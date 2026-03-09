"""
Analytics Endpoints Test Suite
==============================
Tests for admin analytics and reporting endpoints:
- GET /api/analytics/student-usage - Student platform usage statistics
- GET /api/analytics/gender-violence-report - Anonymized GBV reporting
- GET /api/analytics/engagement-trends - Engagement trends over time

Tests verify:
1. Admin/super_admin can access analytics endpoints
2. Student role CANNOT access analytics endpoints (403 expected)
3. Analytics data aggregation is correct
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_CREDS = {
    "email": "gen@quadley.app",
    "password": "Quadley2025!"
}

STUDENT_CREDS = {
    "email": "alice@example.com",
    "password": "Quadley2025!"
}


class TestAnalyticsAuth:
    """Test authentication and authorization for analytics endpoints"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super_admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STUDENT_CREDS
        )
        assert response.status_code == 200, f"Student login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_student_usage_requires_auth(self):
        """Test that student-usage endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/student-usage")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_gender_violence_report_requires_auth(self):
        """Test that gender-violence-report endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/gender-violence-report")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_engagement_trends_requires_auth(self):
        """Test that engagement-trends endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/engagement-trends")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_student_cannot_access_student_usage(self, student_token):
        """Test that student role CANNOT access student-usage endpoint (403 expected)"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage",
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}: {response.text}"
    
    def test_student_cannot_access_gender_violence_report(self, student_token):
        """Test that student role CANNOT access gender-violence-report endpoint (403 expected)"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/gender-violence-report",
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}: {response.text}"
    
    def test_student_cannot_access_engagement_trends(self, student_token):
        """Test that student role CANNOT access engagement-trends endpoint (403 expected)"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/engagement-trends",
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}: {response.text}"


class TestStudentUsageAnalytics:
    """Test GET /api/analytics/student-usage endpoint"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super_admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_super_admin_can_access_student_usage(self, super_admin_token):
        """Test that super_admin can access student-usage endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "period" in data, "Response should contain 'period'"
        assert "generated_at" in data, "Response should contain 'generated_at'"
        assert "summary" in data, "Response should contain 'summary'"
        assert "users_by_role" in data, "Response should contain 'users_by_role'"
        assert "feature_usage" in data, "Response should contain 'feature_usage'"
        assert "engagement_by_category" in data, "Response should contain 'engagement_by_category'"
        assert "top_features" in data, "Response should contain 'top_features'"
    
    def test_student_usage_summary_structure(self, super_admin_token):
        """Test that summary contains expected fields"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage",
            headers=headers
        )
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        assert "total_users" in summary, "Summary should contain 'total_users'"
        assert "active_users" in summary, "Summary should contain 'active_users'"
        assert "engagement_rate" in summary, "Summary should contain 'engagement_rate'"
        assert "users_with_floor" in summary, "Summary should contain 'users_with_floor'"
        
        # Verify data types
        assert isinstance(summary["total_users"], int), "total_users should be int"
        assert isinstance(summary["active_users"], int), "active_users should be int"
        assert isinstance(summary["engagement_rate"], (int, float)), "engagement_rate should be numeric"
    
    def test_student_usage_with_period_7d(self, super_admin_token):
        """Test student-usage with 7d period parameter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage?period=7d",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "7d", f"Expected period '7d', got '{data['period']}'"
    
    def test_student_usage_with_period_90d(self, super_admin_token):
        """Test student-usage with 90d period parameter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage?period=90d",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "90d", f"Expected period '90d', got '{data['period']}'"
    
    def test_student_usage_with_period_all(self, super_admin_token):
        """Test student-usage with 'all' period parameter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage?period=all",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "all", f"Expected period 'all', got '{data['period']}'"


class TestGenderViolenceReport:
    """Test GET /api/analytics/gender-violence-report endpoint"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super_admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_super_admin_can_access_gbv_report(self, super_admin_token):
        """Test that super_admin can access gender-violence-report endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/gender-violence-report",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "report_type" in data, "Response should contain 'report_type'"
        assert "academic_year" in data, "Response should contain 'academic_year'"
        assert "period" in data, "Response should contain 'period'"
        assert "generated_at" in data, "Response should contain 'generated_at'"
        assert "summary" in data, "Response should contain 'summary'"
        assert "by_type" in data, "Response should contain 'by_type'"
        assert "by_severity" in data, "Response should contain 'by_severity'"
        assert "by_status" in data, "Response should contain 'by_status'"
        assert "monthly_trend" in data, "Response should contain 'monthly_trend'"
        assert "response_time" in data, "Response should contain 'response_time'"
        assert "compliance_note" in data, "Response should contain 'compliance_note'"
    
    def test_gbv_report_summary_structure(self, super_admin_token):
        """Test that GBV report summary contains expected fields"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/gender-violence-report",
            headers=headers
        )
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        assert "total_gbv_disclosures" in summary, "Summary should contain 'total_gbv_disclosures'"
        assert "total_all_disclosures" in summary, "Summary should contain 'total_all_disclosures'"
        assert "gbv_percentage" in summary, "Summary should contain 'gbv_percentage'"
        assert "resolution_rate" in summary, "Summary should contain 'resolution_rate'"
        assert "anonymous_reports" in summary, "Summary should contain 'anonymous_reports'"
        assert "identified_reports" in summary, "Summary should contain 'identified_reports'"
    
    def test_gbv_report_with_year_parameter(self, super_admin_token):
        """Test GBV report with specific year parameter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/gender-violence-report?year=2025",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "2025" in data["academic_year"], f"Expected academic year to contain '2025', got '{data['academic_year']}'"
    
    def test_gbv_report_response_time_structure(self, super_admin_token):
        """Test that response_time contains expected fields"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/gender-violence-report",
            headers=headers
        )
        assert response.status_code == 200
        
        response_time = response.json().get("response_time", {})
        assert "average_days" in response_time, "response_time should contain 'average_days'"
        assert "fastest_days" in response_time, "response_time should contain 'fastest_days'"
        assert "slowest_days" in response_time, "response_time should contain 'slowest_days'"


class TestEngagementTrends:
    """Test GET /api/analytics/engagement-trends endpoint"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super_admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_super_admin_can_access_engagement_trends(self, super_admin_token):
        """Test that super_admin can access engagement-trends endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/engagement-trends",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "period_days" in data, "Response should contain 'period_days'"
        assert "start_date" in data, "Response should contain 'start_date'"
        assert "end_date" in data, "Response should contain 'end_date'"
        assert "daily_breakdown" in data, "Response should contain 'daily_breakdown'"
        assert "total_by_type" in data, "Response should contain 'total_by_type'"
    
    def test_engagement_trends_default_30_days(self, super_admin_token):
        """Test that default period is 30 days"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/engagement-trends",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 30, f"Expected default period_days 30, got {data['period_days']}"
    
    def test_engagement_trends_with_custom_days(self, super_admin_token):
        """Test engagement-trends with custom days parameter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/engagement-trends?days=14",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 14, f"Expected period_days 14, got {data['period_days']}"
    
    def test_engagement_trends_min_days_validation(self, super_admin_token):
        """Test that days parameter has minimum validation (7 days)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/engagement-trends?days=3",
            headers=headers
        )
        # Should return 422 for validation error (days < 7)
        assert response.status_code == 422, f"Expected 422 for days < 7, got {response.status_code}"
    
    def test_engagement_trends_max_days_validation(self, super_admin_token):
        """Test that days parameter has maximum validation (365 days)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/engagement-trends?days=500",
            headers=headers
        )
        # Should return 422 for validation error (days > 365)
        assert response.status_code == 422, f"Expected 422 for days > 365, got {response.status_code}"
    
    def test_engagement_trends_total_by_type_structure(self, super_admin_token):
        """Test that total_by_type contains expected collections"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/engagement-trends",
            headers=headers
        )
        assert response.status_code == 200
        
        total_by_type = response.json().get("total_by_type", {})
        expected_collections = ['events', 'announcements', 'maintenance_requests', 'shoutouts', 'messages']
        for collection in expected_collections:
            assert collection in total_by_type, f"total_by_type should contain '{collection}'"


class TestAnalyticsDataAggregation:
    """Test that analytics data aggregation is correct"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super_admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPER_ADMIN_CREDS
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_student_usage_total_users_is_positive(self, super_admin_token):
        """Test that total_users count is positive (we have seeded users)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage",
            headers=headers
        )
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        assert summary["total_users"] > 0, "total_users should be positive (we have seeded users)"
    
    def test_student_usage_users_by_role_not_empty(self, super_admin_token):
        """Test that users_by_role is not empty"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage",
            headers=headers
        )
        assert response.status_code == 200
        
        users_by_role = response.json().get("users_by_role", {})
        assert len(users_by_role) > 0, "users_by_role should not be empty"
    
    def test_engagement_rate_is_valid_percentage(self, super_admin_token):
        """Test that engagement_rate is a valid percentage (0-100)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/student-usage",
            headers=headers
        )
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        engagement_rate = summary.get("engagement_rate", 0)
        assert 0 <= engagement_rate <= 100, f"engagement_rate should be 0-100, got {engagement_rate}"
    
    def test_gbv_percentage_is_valid(self, super_admin_token):
        """Test that gbv_percentage is a valid percentage (0-100)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/gender-violence-report",
            headers=headers
        )
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        gbv_percentage = summary.get("gbv_percentage", 0)
        assert 0 <= gbv_percentage <= 100, f"gbv_percentage should be 0-100, got {gbv_percentage}"
    
    def test_resolution_rate_is_valid(self, super_admin_token):
        """Test that resolution_rate is a valid percentage (0-100)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/gender-violence-report",
            headers=headers
        )
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        resolution_rate = summary.get("resolution_rate", 0)
        assert 0 <= resolution_rate <= 100, f"resolution_rate should be 0-100, got {resolution_rate}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
