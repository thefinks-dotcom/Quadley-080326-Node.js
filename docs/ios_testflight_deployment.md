# iOS Deployment Guide - TestFlight

Complete guide to deploying Quadley apps (and white-label tenant apps) to iOS TestFlight.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [One-Time Setup](#2-one-time-setup)
3. [Building for iOS](#3-building-for-ios)
4. [Submitting to TestFlight](#4-submitting-to-testflight)
5. [Managing TestFlight](#5-managing-testflight)
6. [White-Label Tenant Deployment](#6-white-label-tenant-deployment)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

### Required Accounts & Tools

| Item | Description | Link |
|------|-------------|------|
| **Apple Developer Account** | $99/year enrollment | [developer.apple.com](https://developer.apple.com) |
| **Expo Account** | Free account for EAS | [expo.dev](https://expo.dev) |
| **EAS CLI** | Expo Application Services CLI | `npm install -g eas-cli` |
| **Node.js** | v18+ recommended | [nodejs.org](https://nodejs.org) |

### Apple Developer Account Setup

1. **Enroll in Apple Developer Program**
   - Go to [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll)
   - Pay $99/year fee
   - Wait 24-48 hours for approval

2. **Enable App Store Connect Access**
   - Sign in to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Accept agreements under "Agreements, Tax, and Banking"

---

## 2. One-Time Setup

### 2.1 Install EAS CLI

```bash
# Install globally
npm install -g eas-cli

# Verify installation
eas --version
```

### 2.2 Login to Expo

```bash
# Login to your Expo account
eas login

# Verify login
eas whoami
```

### 2.3 Configure EAS for Your Project

Navigate to the mobile app directory:

```bash
cd /app/mobile
```

If not already initialized:
```bash
# Initialize EAS (only needed once per project)
eas build:configure
```

### 2.4 Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Your app name (e.g., "Quadley" or "Grace College")
   - **Primary Language**: English (or your choice)
   - **Bundle ID**: Must match `app.config.js` (e.g., `com.quadley.app`)
   - **SKU**: Unique identifier (e.g., `quadley-ios-001`)
   - **User Access**: Full Access
4. Click **"Create"**

5. **Get the App Store App ID**:
   - After creation, look at the URL or App Information
   - Find the numeric ID (e.g., `6746585498`)
   - Update `eas.json` with this ID:
   ```json
   "submit": {
     "production": {
       "ios": {
         "ascAppId": "6746585498"
       }
     }
   }
   ```

---

## 3. Building for iOS

### 3.1 Build the Main Quadley App

```bash
cd /app/mobile

# Build for production (App Store / TestFlight)
eas build --platform ios --profile production

# Or build for internal testing only
eas build --platform ios --profile preview
```

### 3.2 Build a White-Label Tenant App

```bash
# Grace College
eas build --platform ios --profile production-grace-college

# Ormond College
eas build --platform ios --profile production-ormond

# Murphy Shark
eas build --platform ios --profile production-murphy-shark
```

### 3.3 Build Process

During the build:
1. EAS will prompt for Apple credentials
2. It will auto-generate/manage certificates and provisioning profiles
3. Build takes 10-20 minutes
4. You'll receive a URL to download the `.ipa` file

**Example Output:**
```
✔ Build finished
🍎 iOS build: https://expo.dev/artifacts/eas/xxxxx.ipa

📱 Install and run the build:
  › https://expo.dev/accounts/genfink/projects/quadley-mobile/builds/xxxxx
```

---

## 4. Submitting to TestFlight

### 4.1 Automatic Submission (Recommended)

After the build completes, submit directly:

```bash
# Submit the latest build to TestFlight
eas submit --platform ios --latest

# Or submit a specific build
eas submit --platform ios --id BUILD_ID
```

### 4.2 Submit White-Label Apps

```bash
# Submit Grace College build
eas submit --platform ios --profile production-grace-college --latest

# Submit Ormond build
eas submit --platform ios --profile production-ormond --latest
```

### 4.3 One-Command Build & Submit

Build and submit in one step:

```bash
# Build and auto-submit to TestFlight
eas build --platform ios --profile production --auto-submit

# For tenant apps
eas build --platform ios --profile production-grace-college --auto-submit
```

### 4.4 First-Time Submission Requirements

On first submission, you may need to provide:

1. **App Store Connect API Key** (recommended for automation):
   ```bash
   # Generate at: https://appstoreconnect.apple.com/access/api
   # Then configure:
   eas credentials
   # Select: iOS → App Store Connect API Key
   ```

2. **Or Apple ID credentials**:
   - EAS will prompt for Apple ID email and app-specific password
   - Generate app-specific password at [appleid.apple.com](https://appleid.apple.com)

---

## 5. Managing TestFlight

### 5.1 App Store Connect - TestFlight Section

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Click **"TestFlight"** tab

### 5.2 Processing Time

After submission:
- **Processing**: 5-30 minutes (Apple processes the build)
- **Status**: "Processing" → "Ready to Submit" / "Ready for Testing"

### 5.3 Add Internal Testers

1. Go to **TestFlight** → **Internal Testing**
2. Click **"+"** to add a new group or add to existing
3. Add testers by Apple ID email
4. Internal testers (up to 100) can test immediately

### 5.4 Add External Testers (Requires Review)

1. Go to **TestFlight** → **External Testing**
2. Click **"+"** to create a group
3. Add testers by email (they don't need Apple Developer accounts)
4. Submit for **Beta App Review** (usually 24-48 hours)
5. Once approved, testers receive invitation email

### 5.5 Invite Testers

**For Internal Testers:**
- Automatic invitation after adding to group
- They receive email with TestFlight link

**For External Testers:**
- After Beta App Review approval
- Send public TestFlight link or email invitations

### 5.6 TestFlight Public Link

1. Go to **TestFlight** → **External Testing** → Your Group
2. Enable **"Public Link"**
3. Share the link (anyone with link can join, up to 10,000 testers)

---

## 6. White-Label Tenant Deployment

### 6.1 Adding a New Tenant

1. **Update `app.config.js`**:
```javascript
const TENANT_CONFIGS = {
  // ... existing tenants ...
  
  new_tenant: {
    name: "New Tenant College",
    slug: "new-tenant-app",
    projectId: "YOUR_EAS_PROJECT_ID", // Get from eas project:init
    ios: {
      bundleIdentifier: "com.newtenant.app",
    },
    android: {
      package: "com.newtenant.app",
    },
    icon: "./assets/tenants/new_tenant/icon.png",
    splash: {
      image: "./assets/tenants/new_tenant/splash.png",
      backgroundColor: "#BRAND_COLOR",
    },
    adaptiveIcon: {
      foregroundImage: "./assets/tenants/new_tenant/adaptive-icon.png",
      backgroundColor: "#BRAND_COLOR",
    },
    primaryColor: "#BRAND_COLOR",
    secondaryColor: "#SECONDARY_COLOR",
  },
};
```

2. **Update `eas.json`**:
```json
{
  "build": {
    "production-new-tenant": {
      "extends": "production",
      "env": {
        "TENANT": "new_tenant"
      }
    }
  },
  "submit": {
    "production-new-tenant": {
      "ios": {
        "ascAppId": "APP_STORE_CONNECT_APP_ID"
      },
      "android": {
        "track": "internal",
        "releaseStatus": "draft"
      }
    }
  }
}
```

3. **Create App in App Store Connect** (see Section 2.4)

4. **Add Assets**:
```bash
mkdir -p assets/tenants/new_tenant
# Add: icon.png (1024x1024), splash.png, adaptive-icon.png
```

5. **Build & Submit**:
```bash
eas build --platform ios --profile production-new-tenant --auto-submit
```

### 6.2 Complete Tenant Deployment Checklist

For each new tenant app:

- [ ] Create tenant entry in `app.config.js`
- [ ] Add build profile in `eas.json`
- [ ] Add submit profile in `eas.json`
- [ ] Create App in App Store Connect
- [ ] Get App Store Connect App ID
- [ ] Create branded assets (icon, splash)
- [ ] Build: `eas build --platform ios --profile production-{tenant}`
- [ ] Submit: `eas submit --platform ios --profile production-{tenant}`
- [ ] Configure TestFlight testers
- [ ] Submit for Beta App Review (external testers)

---

## 7. Troubleshooting

### Common Issues

#### "No matching provisioning profile"
```bash
# Clear credentials and regenerate
eas credentials --platform ios
# Select: Remove existing credentials
# Then rebuild
```

#### "Bundle ID already in use"
- Ensure bundle ID in `app.config.js` matches App Store Connect
- Each tenant needs a UNIQUE bundle ID

#### "App Store Connect API Key error"
```bash
# Reconfigure API key
eas credentials
# Select: iOS → App Store Connect API Key → Add new
```

#### Build fails with signing error
```bash
# Clear all iOS credentials
eas credentials --platform ios
# Select: Provisioning Profile → Remove
# Select: Distribution Certificate → Remove
# Rebuild - EAS will regenerate
```

#### "Missing compliance information"
- Go to App Store Connect → Your App → TestFlight
- Click on the build
- Answer export compliance questions (usually "No" for encryption)

### Version/Build Number Issues

**Increment build number:**
```bash
# In app.config.js, update:
ios: {
  buildNumber: "10", // Increment this
}
```

**Or use auto-increment:**
```json
// In eas.json
"production": {
  "autoIncrement": true
}
```

### Debug Build Issues

```bash
# View build logs
eas build:list

# View specific build
eas build:view BUILD_ID

# Cancel a build
eas build:cancel BUILD_ID
```

---

## Quick Reference Commands

```bash
# === BUILDING ===
# Main app
eas build --platform ios --profile production

# Tenant app
TENANT=grace_college eas build --platform ios --profile production
# OR
eas build --platform ios --profile production-grace-college

# === SUBMITTING ===
# Submit latest build
eas submit --platform ios --latest

# Submit specific build
eas submit --platform ios --id BUILD_ID

# Build AND submit
eas build --platform ios --profile production --auto-submit

# === CREDENTIALS ===
# Manage credentials
eas credentials --platform ios

# === STATUS ===
# List builds
eas build:list --platform ios

# View build details
eas build:view BUILD_ID
```

---

## Support Resources

- **Expo EAS Documentation**: [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction)
- **App Store Connect Help**: [developer.apple.com/help/app-store-connect](https://developer.apple.com/help/app-store-connect)
- **TestFlight Guide**: [developer.apple.com/testflight](https://developer.apple.com/testflight)

---

*Last Updated: February 2026*
