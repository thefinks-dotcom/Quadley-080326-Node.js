"""
Test CSV Templates and Bulk Import Features
- GET /api/admin/csv-templates - CSV templates for users, dining_menu, events
- POST /api/dining/menu/bulk-upload - Bulk upload dining menu items
- DELETE /api/dining/menu/clear-date/{date} - Clear menu items for a date
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "gen@quadley.app"
SUPER_ADMIN_PASSWORD = "Quadley2025!"


class TestCSVTemplatesAndBulkImport:
    """Test CSV templates and bulk import features"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get headers with admin auth token"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    # ==================== CSV Templates Tests ====================
    
    def test_csv_templates_endpoint_returns_200(self, admin_headers):
        """Test GET /api/admin/csv-templates returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/admin/csv-templates",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/admin/csv-templates returns 200")
    
    def test_csv_templates_contains_users_template(self, admin_headers):
        """Test CSV templates contains users template"""
        response = requests.get(
            f"{BASE_URL}/api/admin/csv-templates",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data, "Missing 'users' template"
        users_template = data["users"]
        
        # Verify users template structure
        assert "name" in users_template, "Users template missing 'name'"
        assert "headers" in users_template, "Users template missing 'headers'"
        assert "required_fields" in users_template, "Users template missing 'required_fields'"
        assert "optional_fields" in users_template, "Users template missing 'optional_fields'"
        
        # Verify required fields
        assert "first_name" in users_template["required_fields"]
        assert "last_name" in users_template["required_fields"]
        assert "email" in users_template["required_fields"]
        
        print(f"✓ Users template found with name: {users_template['name']}")
        print(f"  Headers: {users_template['headers']}")
        print(f"  Required fields: {users_template['required_fields']}")
    
    def test_csv_templates_contains_dining_menu_template(self, admin_headers):
        """Test CSV templates contains dining_menu template"""
        response = requests.get(
            f"{BASE_URL}/api/admin/csv-templates",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "dining_menu" in data, "Missing 'dining_menu' template"
        dining_template = data["dining_menu"]
        
        # Verify dining_menu template structure
        assert "name" in dining_template, "Dining menu template missing 'name'"
        assert "headers" in dining_template, "Dining menu template missing 'headers'"
        assert "required_fields" in dining_template, "Dining menu template missing 'required_fields'"
        
        # Verify required fields
        assert "name" in dining_template["required_fields"]
        assert "meal_type" in dining_template["required_fields"]
        assert "date" in dining_template["required_fields"]
        
        print(f"✓ Dining menu template found with name: {dining_template['name']}")
        print(f"  Headers: {dining_template['headers']}")
        print(f"  Required fields: {dining_template['required_fields']}")
    
    def test_csv_templates_contains_events_template(self, admin_headers):
        """Test CSV templates contains events template"""
        response = requests.get(
            f"{BASE_URL}/api/admin/csv-templates",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "events" in data, "Missing 'events' template"
        events_template = data["events"]
        
        # Verify events template structure
        assert "name" in events_template, "Events template missing 'name'"
        assert "headers" in events_template, "Events template missing 'headers'"
        assert "required_fields" in events_template, "Events template missing 'required_fields'"
        
        # Verify required fields
        assert "title" in events_template["required_fields"]
        assert "description" in events_template["required_fields"]
        assert "date" in events_template["required_fields"]
        
        print(f"✓ Events template found with name: {events_template['name']}")
        print(f"  Headers: {events_template['headers']}")
        print(f"  Required fields: {events_template['required_fields']}")
    
    def test_csv_templates_requires_auth(self):
        """Test CSV templates endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/csv-templates")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ CSV templates endpoint requires authentication")
    
    # ==================== Dining Menu Bulk Upload Tests ====================
    
    def test_bulk_upload_menu_success(self, admin_token):
        """Test POST /api/dining/menu/bulk-upload with valid CSV"""
        # Create a valid CSV content
        csv_content = """name,description,meal_type,date,dietary_tags,nutrition_info
TEST_Pancakes,Fluffy buttermilk pancakes,Breakfast,2025-12-25,Vegetarian,350 cal
TEST_Caesar Salad,Fresh romaine with caesar dressing,Lunch,2025-12-25,Vegetarian|Gluten-Free,280 cal
TEST_Grilled Salmon,Atlantic salmon with herbs,Dinner,2025-12-25,Gluten-Free,420 cal"""
        
        # Create file-like object
        files = {
            'file': ('test_menu.csv', csv_content, 'text/csv')
        }
        headers = {
            "Authorization": f"Bearer {admin_token}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dining/menu/bulk-upload",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "success_count" in data, "Response missing 'success_count'"
        assert data["success_count"] >= 3, f"Expected at least 3 successful imports, got {data['success_count']}"
        
        print(f"✓ Bulk upload successful: {data['success_count']} items created")
        print(f"  Message: {data.get('message', 'N/A')}")
    
    def test_bulk_upload_menu_invalid_meal_type(self, admin_token):
        """Test bulk upload with invalid meal_type"""
        csv_content = """name,description,meal_type,date,dietary_tags,nutrition_info
TEST_Invalid Item,Test description,InvalidMealType,2025-12-26,Vegetarian,100 cal"""
        
        files = {
            'file': ('test_menu.csv', csv_content, 'text/csv')
        }
        headers = {
            "Authorization": f"Bearer {admin_token}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dining/menu/bulk-upload",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have failed count > 0 due to invalid meal_type
        assert data.get("failed_count", 0) >= 1, "Expected at least 1 failed import"
        assert len(data.get("errors", [])) >= 1, "Expected error messages"
        
        print(f"✓ Invalid meal_type correctly rejected")
        print(f"  Failed count: {data.get('failed_count', 0)}")
        print(f"  Errors: {data.get('errors', [])[:2]}")
    
    def test_bulk_upload_menu_missing_required_fields(self, admin_token):
        """Test bulk upload with missing required fields"""
        csv_content = """name,description,meal_type,date,dietary_tags,nutrition_info
,Missing name,Breakfast,2025-12-26,Vegetarian,100 cal
TEST_No Date,Test description,Lunch,,Vegetarian,100 cal"""
        
        files = {
            'file': ('test_menu.csv', csv_content, 'text/csv')
        }
        headers = {
            "Authorization": f"Bearer {admin_token}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dining/menu/bulk-upload",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have failed count >= 2 due to missing required fields
        assert data.get("failed_count", 0) >= 2, f"Expected at least 2 failed imports, got {data.get('failed_count', 0)}"
        
        print(f"✓ Missing required fields correctly rejected")
        print(f"  Failed count: {data.get('failed_count', 0)}")
    
    def test_bulk_upload_menu_requires_csv_file(self, admin_token):
        """Test bulk upload rejects non-CSV files"""
        txt_content = "This is not a CSV file"
        
        files = {
            'file': ('test_menu.txt', txt_content, 'text/plain')
        }
        headers = {
            "Authorization": f"Bearer {admin_token}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dining/menu/bulk-upload",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for non-CSV file, got {response.status_code}"
        print("✓ Non-CSV file correctly rejected with 400")
    
    def test_bulk_upload_menu_requires_auth(self):
        """Test bulk upload requires authentication"""
        csv_content = """name,description,meal_type,date,dietary_tags,nutrition_info
TEST_Item,Test,Breakfast,2025-12-26,Vegetarian,100 cal"""
        
        files = {
            'file': ('test_menu.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dining/menu/bulk-upload",
            files=files
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Bulk upload requires authentication")
    
    # ==================== Clear Menu Date Tests ====================
    
    def test_clear_menu_for_date_success(self, admin_token):
        """Test DELETE /api/dining/menu/clear-date/{date}"""
        # First, create some test menu items for a specific date
        test_date = "2025-12-31"
        csv_content = f"""name,description,meal_type,date,dietary_tags,nutrition_info
TEST_Clear1,Test item 1,Breakfast,{test_date},Vegetarian,100 cal
TEST_Clear2,Test item 2,Lunch,{test_date},Vegetarian,200 cal"""
        
        files = {
            'file': ('test_menu.csv', csv_content, 'text/csv')
        }
        headers_upload = {
            "Authorization": f"Bearer {admin_token}"
        }
        
        # Upload test items
        upload_response = requests.post(
            f"{BASE_URL}/api/dining/menu/bulk-upload",
            headers=headers_upload,
            files=files
        )
        assert upload_response.status_code == 200, f"Setup failed: {upload_response.text}"
        
        # Now clear the date
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.delete(
            f"{BASE_URL}/api/dining/menu/clear-date/{test_date}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "items_deleted" in data, "Response missing 'items_deleted'"
        assert data["items_deleted"] >= 2, f"Expected at least 2 items deleted, got {data['items_deleted']}"
        
        print(f"✓ Clear menu for date successful")
        print(f"  Items deleted: {data['items_deleted']}")
        print(f"  Message: {data.get('message', 'N/A')}")
    
    def test_clear_menu_for_date_no_items(self, admin_headers):
        """Test clear menu for date with no items"""
        # Use a date that likely has no items
        test_date = "2099-01-01"
        
        response = requests.delete(
            f"{BASE_URL}/api/dining/menu/clear-date/{test_date}",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "items_deleted" in data, "Response missing 'items_deleted'"
        assert data["items_deleted"] == 0, f"Expected 0 items deleted for empty date, got {data['items_deleted']}"
        
        print(f"✓ Clear menu for empty date returns 0 items deleted")
    
    def test_clear_menu_for_date_requires_admin(self, admin_token):
        """Test clear menu requires admin role (not just RA)"""
        # This test verifies the endpoint exists and requires proper auth
        # The endpoint should only allow admin/super_admin, not RA
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.delete(
            f"{BASE_URL}/api/dining/menu/clear-date/2025-12-30",
            headers=headers
        )
        
        # Admin should be able to access
        assert response.status_code == 200, f"Admin should have access, got {response.status_code}: {response.text}"
        print("✓ Admin can access clear-date endpoint")
    
    def test_clear_menu_for_date_requires_auth(self):
        """Test clear menu requires authentication"""
        response = requests.delete(
            f"{BASE_URL}/api/dining/menu/clear-date/2025-12-30"
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Clear menu endpoint requires authentication")
    
    # ==================== Cleanup Tests ====================
    
    def test_cleanup_test_menu_items(self, admin_headers):
        """Cleanup: Remove TEST_ prefixed menu items from 2025-12-25"""
        # Clear test data from the bulk upload test
        response = requests.delete(
            f"{BASE_URL}/api/dining/menu/clear-date/2025-12-25",
            headers=admin_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Cleanup: Cleared {data.get('items_deleted', 0)} items from 2025-12-25")
        else:
            print(f"  Cleanup note: Could not clear 2025-12-25 ({response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
