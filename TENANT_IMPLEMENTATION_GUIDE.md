# Multi-Tenant Implementation Guide
## CSV Upload & API Sync - COMPLETE

**Implementation Date:** December 16, 2024  
**Status:** ✅ Backend Complete | ⏳ Frontend Pending

---

## What's Been Implemented

### ✅ Backend Complete (100%)

**1. Database Migration**
- ✅ Added `tenant_id` to all 13 collections
- ✅ Created default tenant: `default_college`
- ✅ Migrated 558 existing documents
- ✅ Created compound indexes for performance
- ✅ All existing users assigned to default tenant

**2. Tenant Management**
- ✅ `/api/tenants` - Create, list, get, update tenants
- ✅ Self-service registration with approval workflow
- ✅ Tenant status: pending → active/suspended
- ✅ Super admin approval system

**3. User Provisioning - CSV Upload**
- ✅ `/api/user-provisioning/csv-upload` - Bulk import users
- ✅ `/api/user-provisioning/csv-template` - Download template
- ✅ Email validation (students must use college domain)
- ✅ Role validation (student, ra, admin)
- ✅ Duplicate detection
- ✅ Error reporting per row
- ✅ Auto-generated passwords

**4. User Provisioning - API Sync**
- ✅ `/api/user-provisioning/api-sync` - Bulk sync endpoint
- ✅ `/api/user-provisioning/generate-api-key` - API key management
- ✅ `/api/user-provisioning/revoke-api-key` - Key revocation
- ✅ Create/Update/Deactivate logic
- ✅ API key authentication
- ✅ Automatic deactivation of removed users

**5. Authorization Framework**
- ✅ `TenantContext` middleware
- ✅ `require_role()` decorator
- ✅ `verify_resource_access()` helper
- ✅ `verify_resource_ownership()` helper
- ✅ Super admin role support

**6. Super Admin**
- ✅ Created first super admin account
- ✅ Email: `superadmin@quadley.app`
- ✅ Password: `SuperAdmin123!` (⚠️ change immediately)
- ✅ Can manage all tenants
- ✅ Can approve tenant requests

---

## Quick Start Guide

### For Super Admin

**1. Login as Super Admin**
```bash
Email: superadmin@quadley.app
Password: SuperAdmin123!
```

**2. Approve Pending Tenant**
```bash
curl -X PUT "http://localhost:8001/api/tenants/demo_college/approve" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**3. View All Tenants**
```bash
curl -X GET "http://localhost:8001/api/tenants" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### For College Admin

**1. Request New Tenant**
```bash
curl -X POST "http://localhost:8001/api/tenants" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "stanford_college",
    "tenant_name": "Stanford Residential College",
    "domain": "stanford.edu",
    "contact_email": "housing@stanford.edu",
    "capacity": 450,
    "admin_first_name": "John",
    "admin_last_name": "Doe",
    "admin_email": "john.doe@stanford.edu",
    "admin_password": "SecurePass123!"
  }'
```

**2. Wait for Super Admin Approval**
- Tenant status: `pending` → `active`
- Admin account activated

**3. Upload Users via CSV**
```bash
curl -X POST "http://localhost:8001/api/user-provisioning/csv-upload" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -F "file=@users.csv"
```

**4. Or Generate API Key for Integration**
```bash
curl -X POST "http://localhost:8001/api/user-provisioning/generate-api-key" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## CSV Format

### Download Template
```bash
GET /api/user-provisioning/csv-template
```

### CSV Structure
```csv
first_name,last_name,email,role,floor,phone,student_id,year,birthday
John,Doe,john.doe@college.edu,student,Floor 1,555-0100,STU001,freshman,2000-01-15
Jane,Smith,jane.smith@college.edu,ra,Floor 2,555-0101,RA001,sophomore,1999-05-20
Bob,Admin,bob.admin@college.edu,admin,,,ADMIN01,,
```

### Required Fields
- ✅ first_name
- ✅ last_name
- ✅ email
- ✅ role (student, ra, admin)

### Optional Fields
- floor, phone, student_id, year, birthday

### Validation Rules
- Students must use college domain (@stanford.edu)
- Email must be unique within tenant
- Role must be: student, ra, or admin
- CSV must have proper headers

---

## API Sync Integration

### Generate API Key (Admin)
```bash
POST /api/user-provisioning/generate-api-key
Authorization: Bearer ADMIN_TOKEN

Response:
{
  "api_key": "qdk_stanford_college_a1b2c3d4...",
  "message": "Store this key securely",
  "usage": {
    "endpoint": "/api/user-provisioning/api-sync",
    "headers": {
      "X-API-Key": "qdk_stanford_college_...",
      "X-Tenant-ID": "stanford_college"
    }
  }
}
```

### Sync Users
```bash
POST /api/user-provisioning/api-sync
X-API-Key: qdk_stanford_college_...
X-Tenant-ID: stanford_college
Content-Type: application/json

{
  "users": [
    {
      "email": "student1@stanford.edu",
      "first_name": "John",
      "last_name": "Doe",
      "role": "student",
      "floor": "Floor 1",
      "phone": "555-0100",
      "student_id": "STU001",
      "year": "freshman",
      "active": true
    },
    {
      "email": "student2@stanford.edu",
      "first_name": "Jane",
      "last_name": "Smith",
      "role": "student",
      "active": true
    }
  ]
}

Response:
{
  "created": 1,
  "updated": 1,
  "deactivated": 0,
  "errors": []
}
```

### What Happens
- ✅ Creates new users not in database
- ✅ Updates existing users
- ✅ Deactivates users not in sync request (removed from college)
- ✅ Returns detailed report

---

## Current Tenants

### System Tenant
```
tenant_id: system
Purpose: Super admins only
Status: System reserved
```

### Default Tenant
```
tenant_id: default_college
tenant_name: Default College
domain: example.edu
Status: active
Users: 157 (migrated existing users)
```

---

## Database Changes

### Collections Updated
```
✅ users: 157 documents
✅ announcements: 13 documents
✅ events: 16 documents
✅ maintenance: 8 documents
✅ shoutouts: 48 documents
✅ study_groups: 2 documents
✅ messages: 143 documents
✅ message_groups: 49 documents
✅ study_streaks: 122 documents

Total: 558 documents migrated
```

### New Collections
```
✅ tenants: Tenant management
```

### Indexes Created
```
✅ users: (tenant_id, email) UNIQUE
✅ announcements: (tenant_id, created_at)
✅ events: (tenant_id, date)
✅ shoutouts: (tenant_id, created_at)
✅ maintenance: (tenant_id, created_at)
```

---

## API Endpoints

### Tenant Management
```
POST   /api/tenants                     # Request new tenant
GET    /api/tenants                     # List tenants
GET    /api/tenants/{tenant_id}         # Get tenant details
PUT    /api/tenants/{tenant_id}         # Update tenant
PUT    /api/tenants/{tenant_id}/approve # Approve tenant (super_admin)
DELETE /api/tenants/{tenant_id}         # Suspend tenant (super_admin)
```

### User Provisioning
```
POST   /api/user-provisioning/csv-upload        # Upload CSV
GET    /api/user-provisioning/csv-template      # Download template
POST   /api/user-provisioning/api-sync          # Bulk sync
POST   /api/user-provisioning/generate-api-key  # Generate API key
DELETE /api/user-provisioning/revoke-api-key    # Revoke API key
```

---

## Testing

### Test CSV Upload
```bash
# 1. Login as admin
TOKEN=$(curl -s -X POST "http://localhost:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"alice123"}' \
  | jq -r '.access_token')

# 2. Create test CSV
cat > test_users.csv << EOF
first_name,last_name,email,role,floor
Test,User1,test1@example.edu,student,Floor 1
Test,User2,test2@example.edu,student,Floor 2
EOF

# 3. Upload CSV
curl -X POST "http://localhost:8001/api/user-provisioning/csv-upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_users.csv"
```

### Test API Sync
```bash
# 1. Generate API key
API_KEY=$(curl -s -X POST "http://localhost:8001/api/user-provisioning/generate-api-key" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.api_key')

# 2. Sync users
curl -X POST "http://localhost:8001/api/user-provisioning/api-sync" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Tenant-ID: default_college" \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {
        "email": "sync1@example.edu",
        "first_name": "Sync",
        "last_name": "User1",
        "role": "student",
        "active": true
      }
    ]
  }'
```

---

## Next Steps - Frontend Implementation

### Admin Portal Pages Needed
1. **Super Admin Dashboard**
   - List all tenants
   - Approve/reject pending tenants
   - View tenant stats

2. **Tenant Admin Dashboard**
   - User management table
   - CSV upload interface
   - API key management
   - Bulk actions

3. **CSV Upload UI**
   - File upload component
   - Template download button
   - Validation feedback
   - Import preview
   - Error display per row

4. **API Key Management**
   - Generate key button
   - Display key once
   - Revoke key button
   - Usage documentation

### Estimated Timeline
- Super Admin Dashboard: 2 days
- CSV Upload UI: 2 days
- User Management Table: 2 days
- API Key Management: 1 day
- Testing & Polish: 1 day

**Total: ~1.5 weeks**

---

## Security Notes

### ⚠️ Important
1. **Change super admin password immediately**
2. **API keys are shown only once** - store securely
3. **CSV passwords are default** - users must change on first login
4. **Email validation enforces college domain** for students
5. **Tenant isolation enforced** at database level

### Access Control
- ✅ Super admins: All tenants
- ✅ Admins: Own tenant only
- ✅ RAs: Own tenant, limited actions
- ✅ Students: Own tenant, own data

---

## Troubleshooting

### Issue: "User has no tenant assignment"
**Solution:** User needs tenant_id field. Re-run migration or manually add.

### Issue: "Email already registered"
**Solution:** Email must be unique within tenant. Check for duplicates.

### Issue: "Invalid API key"
**Solution:** Generate new key or check X-Tenant-ID header matches.

### Issue: "Students must use @domain email"
**Solution:** Update tenant domain or use admin/ra role for non-domain emails.

---

## File Structure

```
/app/backend/
├── models.py                          # Updated with Tenant, CSV models
├── routes/
│   ├── tenants.py                     # NEW - Tenant management
│   └── user_provisioning.py           # NEW - CSV & API sync
├── utils/
│   ├── tenant.py                      # NEW - Authorization helpers
│   ├── migrations/
│   │   └── add_tenant_support.py      # Migration script
│   └── create_super_admin.py          # Super admin creation
└── server.py                          # Updated with new routes
```

---

## Summary

### ✅ Completed
- Multi-tenant database architecture
- Tenant self-service registration
- Super admin approval workflow
- CSV bulk import
- API sync integration
- API key management
- Authorization framework
- Data migration
- Comprehensive validation

### ⏳ Pending
- Frontend admin portal
- CSV upload UI
- User management interface
- API key management UI
- Testing with real colleges

---

**Backend is production-ready for multi-tenant deployment!**

Next: Build frontend admin portal for CSV upload and tenant management.
