# Quadley - New Tenant Onboarding Playbook

## Overview
This document provides a step-by-step guide for onboarding new tenants (colleges/universities) to the Quadley platform.

---

## Prerequisites

Before starting the onboarding process, ensure you have:
- [ ] Super Admin access to Quadley
- [ ] College/university contact details:
  - Primary contact name
  - Primary contact email
  - College domain (e.g., `college.edu`)
- [ ] College branding assets:
  - Logo (PNG, recommended 200x200px)
  - Primary brand color (hex code)
  - Secondary brand color (hex code)

---

## Step 1: Create the Tenant

### 1.1 Access Super Admin Dashboard
1. Log in to Quadley as a Super Admin
2. Navigate to **Tenant Management** section

### 1.2 Create New Tenant
1. Click **"Create New Tenant"**
2. Fill in the required fields:
   - **Tenant Name**: Full college name (e.g., "Grace College")
   - **Tenant Code**: Short, unique code (e.g., "GRACE") - used for database isolation
   - **Domain**: College email domain (e.g., "grace.edu")
   - **Contact Person**: Primary admin name
   - **Contact Email**: Primary admin email

3. Configure branding:
   - Upload college logo
   - Set primary color (buttons, headers)
   - Set secondary color (accents)

4. Click **"Create Tenant"**

### 1.3 Verify Tenant Creation
- The system will automatically:
  - Create isolated database for the tenant
  - Generate an invite code for the primary admin
  - Send invitation email to the contact email

---

## Step 2: Admin Setup

### 2.1 Admin Receives Invitation
The primary contact will receive an email with:
- Invitation link
- Unique invite code
- Instructions to complete registration

### 2.2 Admin Registration
The admin should:
1. Click the invitation link
2. Enter the invite code
3. Complete registration form:
   - Set password
   - Confirm email
   - Accept terms

### 2.3 Admin First Login
Upon first login, the admin can:
1. Access the Admin Dashboard
2. Configure tenant-specific settings
3. Start inviting users

---

## Step 3: User Provisioning

### 3.1 Option A: CSV Upload (Bulk Import)
1. Navigate to **Admin > User Management > Import Users**
2. Download the CSV template
3. Fill in user data:
   ```csv
   first_name,last_name,email,role,floor,phone,student_id,birthday
   John,Doe,john@college.edu,student,Floor 1,555-1234,STU001,15-Jan
   ```
4. Upload the completed CSV
5. Review import results
6. Optionally send welcome emails

### 3.2 Option B: API Sync (SIS Integration)
1. Navigate to **Admin > API Integration**
2. Generate API key
3. Configure SIS webhook to sync users:
   ```
   POST /api/user-provisioning/api-sync
   Headers:
     X-API-Key: your_api_key
     X-Tenant-ID: TENANT_CODE
   ```

### 3.3 Option C: Manual Invitations
1. Navigate to **Admin > Users > Invite User**
2. Enter user details
3. Send individual invitations

---

## Step 4: Configuration

### 4.1 Academic Calendar
1. Navigate to **Admin > Settings > Academic Calendar**
2. Set key dates:
   - Move-in date
   - O-Week start/end
   - Semester dates
   - Breaks and holidays

### 4.2 Houses/Floors
1. Navigate to **Admin > Settings > Houses**
2. Add houses/floors as per the college structure
3. Assign RAs to each house

### 4.3 Emergency Contacts
1. Navigate to **Admin > Settings > Emergency Contacts**
2. Add college emergency contacts:
   - Security
   - Medical services
   - Mental health support
   - After-hours contacts

---

## Step 5: Mobile App Deployment (Optional)

### 5.1 White-Label App Setup
For colleges wanting a branded mobile app:

1. **Configure App Settings**:
   - Navigate to **Admin > App Settings**
   - Enter Apple App Store account details
   - Enter Google Play Console account details

2. **Build and Deploy**:
   ```bash
   # From the mobile directory
   TENANT_CODE=GRACE eas build --platform all --profile production
   ```

3. **Submit to App Stores**:
   - Submit iOS build to App Store Connect
   - Submit Android build to Google Play Console

### 5.2 App Store Links
After approval, update tenant settings:
- iOS App Link
- Android App Link

These links will be included in invitation emails.

---

## Step 6: Go-Live Checklist

### Pre-Launch
- [ ] All student data imported
- [ ] RAs assigned to floors
- [ ] Emergency contacts configured
- [ ] Academic calendar set
- [ ] Branding verified
- [ ] Test login with sample users
- [ ] Welcome emails drafted

### Launch Day
- [ ] Send welcome emails to all users
- [ ] Monitor first logins
- [ ] Address any immediate issues
- [ ] Collect feedback

### Post-Launch (Week 1)
- [ ] Review analytics
- [ ] Address user feedback
- [ ] Schedule admin training if needed
- [ ] Set up regular check-ins

---

## Troubleshooting

### Common Issues

**Issue**: Admin invitation email not received
- **Solution**: Check spam folder, resend invitation from tenant management

**Issue**: Users can't register
- **Solution**: Verify email domain matches tenant domain setting

**Issue**: Mobile app not showing tenant branding
- **Solution**: Force close app and reopen, verify tenant settings

**Issue**: CSV import errors
- **Solution**: Check CSV format, ensure emails match domain

---

## Support Contacts

For onboarding support:
- **Email**: support@quadley.com
- **Documentation**: docs.quadley.com
- **Status Page**: status.quadley.com

---

*Last updated: February 2026*
