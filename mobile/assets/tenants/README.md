# Tenant Assets Guide

Each tenant needs the following assets in their folder:

## Required Files

```
assets/tenants/{tenant_code}/
├── icon.png              # 1024x1024 - App icon
├── adaptive-icon.png     # 1024x1024 - Android adaptive icon foreground
├── splash.png            # 1284x2778 - Splash screen image
└── logo.png              # Optional - In-app logo
```

## Asset Specifications

### icon.png (App Icon)
- Size: 1024x1024 pixels
- Format: PNG (no transparency for iOS)
- Used for: App Store, home screen

### adaptive-icon.png (Android Adaptive Icon)
- Size: 1024x1024 pixels
- Format: PNG with transparency
- Used for: Android home screen
- Note: Design with safe zone in mind (center 66%)

### splash.png (Splash Screen)
- Size: 1284x2778 pixels (or similar aspect ratio)
- Format: PNG
- Used for: App loading screen
- Tip: Keep logo/text centered, background color will extend

## Creating Assets for a New Tenant

1. Get the tenant's logo and brand colors
2. Create the assets using the specifications above
3. Place them in: `assets/tenants/{tenant_code}/`
4. Update `app.config.js` with the tenant configuration
5. Update `eas.json` with build and submit profiles

## Example: Adding "Trinity College"

1. Create folder: `assets/tenants/trinity/`
2. Add assets: icon.png, adaptive-icon.png, splash.png
3. Add to app.config.js:
   ```javascript
   trinity: {
     name: "Trinity College",
     slug: "trinity-college-app",
     ios: { bundleIdentifier: "com.trinity.college.app" },
     android: { package: "com.trinity.college.app" },
     icon: "./assets/tenants/trinity/icon.png",
     splash: { image: "./assets/tenants/trinity/splash.png", backgroundColor: "#123456" },
     adaptiveIcon: { foregroundImage: "./assets/tenants/trinity/adaptive-icon.png", backgroundColor: "#123456" },
     primaryColor: "#123456",
   },
   ```
4. Add to eas.json:
   ```json
   "production-trinity": {
     "extends": "production",
     "env": { "TENANT": "trinity" }
   }
   ```
