# New Tenant Onboarding Sequence

Use this guide when adding a new white-label college tenant to Quadley. Copy the prompt at the bottom to start the sequence with the AI agent.

---

## Pre-requisites
- Super Admin access to Quadley app
- Apple Developer account access
- Google Play Console access  
- Expo (EAS) account access
- Brand assets from the new college

---

## Sequence Overview

| Step | Action | Who |
|------|--------|-----|
| 1 | Create tenant in Super Admin | You |
| 2 | Collect brand assets | You |
| 3 | Provide brand assets to agent | You + Agent |
| 4 | Set primary & secondary colors | You + Agent |
| 5 | Create Apple App ID & Provisioning | You |
| 6 | Create Google Play app listing | You |
| 7 | Create EAS project on expo.dev | You |
| 8 | Agent configures codebase | Agent |
| 9 | Build iOS & Android apps | You + Agent |
| 10 | Submit to App Store & Play Store | You + Agent |
| 11 | Set download links on tenant | Agent |
| 12 | Send admin invitation | You |
| 13 | Verify end-to-end flow | You |

---

## Detailed Steps

### Step 1: Create Tenant in Super Admin
1. Open Quadley Super Admin app
2. Go to **Tenant Management** > **Add Tenant**
3. Fill in:
   - College name
   - Contact person name
   - Contact person email
4. Note the generated **Tenant Code** (e.g., `GRAC7421`)

### Step 2: Collect Brand Assets from College
Request the following from the college:
- **App Icon** (1024x1024 PNG, no transparency)
- **Splash Screen** image or logo (high-res PNG)
- **Adaptive Icon** for Android (1024x1024 PNG)
- **Primary brand color** (hex code, e.g., `#E8531E`)
- **Secondary brand color** (hex code, e.g., `#4A1E6D`)
- **College display name** (as it should appear in the app)

### Step 3: Provide Brand Assets to Agent
Upload/provide the brand assets files. The agent will:
- Create the tenant asset folder: `mobile/assets/tenants/{tenant_key}/`
- Place `icon.png`, `splash.png`, and `adaptive-icon.png`
- Add the tenant logo to `tenantLogos.js`

### Step 4: Set Colors
Confirm primary and secondary colors. The agent will:
- Add colors to `app.config.js`
- Colors automatically apply to: login screen, student home, admin dashboard, email templates

### Step 5: Create Apple App ID
In [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers):
1. Go to **Identifiers** > **+** > **App IDs**
2. Set Bundle ID: `com.{college-slug}.quadley` (e.g., `com.gracecollege.quadley`)
3. Enable capabilities: Push Notifications, Associated Domains
4. Note the **Bundle Identifier**

### Step 6: Create Google Play App Listing
In [Google Play Console](https://play.google.com/console):
1. **Create app** > fill in app name, default language
2. Set package name: `com.{college-slug}.quadley`
3. Complete store listing (can be draft)
4. Note the **Package Name**

### Step 7: Create EAS Project
1. Go to [expo.dev](https://expo.dev) > **Create New Project**
2. Set the project **slug** (e.g., `grace-college`)
3. Note the **EAS Project ID** (UUID format)

### Step 8: Agent Configures Codebase
Provide the agent with:
- Tenant code (from Step 1)
- Tenant key (lowercase, e.g., `grace_college`)
- College display name
- Bundle ID / Package name (from Steps 5 & 6)
- EAS Project ID (from Step 7)
- Primary & secondary colors (from Step 4)

The agent will update:
- `mobile/app.config.js` — tenant config, colors, bundle IDs, EAS project ID
- `mobile/eas.json` — build & submit profiles
- `mobile/deploy-tenants.sh` — deployment script
- `mobile/src/utils/tenantLogos.js` — logo mapping

### Step 9: Build Apps
After saving to GitHub and pulling locally:

**iOS:**
```bash
cd ~/Downloads/Quadley-28.01.26/mobile
git pull origin main
TENANT={tenant_key} eas build --platform ios --profile production-{tenant_key}
```

**Android:**
```bash
TENANT={tenant_key} eas build --platform android --profile production-{tenant_key}
```

### Step 10: Submit to Stores

**iOS (TestFlight / App Store):**
```bash
eas submit --platform ios --profile production-{tenant_key}
```

**Android (Play Store):**
```bash
eas submit --platform android --profile production-{tenant_key}
```

### Step 11: Set Download Links
Once apps are live, provide the download URLs to the agent. The agent will:
- Update the tenant record with `ios_app_link` and `android_app_link`
- These links automatically appear in all invitation emails

### Step 12: Send Admin Invitation
1. In Super Admin, go to the new tenant
2. Verify contact person email is correct
3. Click **Resend Invitation**
4. The admin receives an email with:
   - App download links (iOS + Android)
   - Personal invite code
   - Step-by-step setup instructions

### Step 13: Verify End-to-End
- [ ] Admin receives invitation email
- [ ] Email shows correct college name
- [ ] Email shows correct download links
- [ ] App displays college logo on login screen
- [ ] App uses college brand colors
- [ ] Invite code works for registration
- [ ] Admin can log in and access dashboard
- [ ] Admin can invite students
- [ ] Student invitation email is correct

---

## Agent Prompt Template

Copy and paste this prompt to start the onboarding sequence:

```
I'm onboarding a new tenant. Here are the details:

- College Name: [NAME]
- Tenant Code: [CODE from Super Admin]
- Tenant Key: [lowercase_underscore, e.g., grace_college]
- Primary Color: [HEX]
- Secondary Color: [HEX]
- iOS Bundle ID: [com.xxx.quadley]
- Android Package: [com.xxx.quadley]
- EAS Project ID: [UUID]
- EAS Project Slug: [slug]
- iOS App Link: [URL or "pending"]
- Android App Link: [URL or "pending"]

Brand assets are uploaded: icon.png, splash.png, adaptive-icon.png

Please run the full tenant onboarding:
1. Add tenant assets to mobile/assets/tenants/{tenant_key}/
2. Add tenant logo mapping to tenantLogos.js
3. Add tenant config to app.config.js (name, slug, colors, bundle IDs, EAS project ID)
4. Add build/submit profiles to eas.json
5. Update deploy-tenants.sh
6. Set download links on the tenant via API
7. Confirm all files are ready and provide build commands
```

---

## Quick Reference: Existing Tenants

| Tenant | Key | Code | Primary | Secondary | Bundle ID |
|--------|-----|------|---------|-----------|-----------|
| Quadley | quadley | — | #3b82f6 | #f0f4ff | com.quadley.mobile |
| Ormond College | ormond | — | #1e3a5f | #e8edf4 | com.ormondcollege.quadley |
| Murphy Shark | murphy_shark | — | #7c3aed | #f3efff | com.murphyshark.quadley |
| Grace College | grace_college | GRAC7421 | #E8531E | #4A1E6D | com.gracecollege.quadley |
