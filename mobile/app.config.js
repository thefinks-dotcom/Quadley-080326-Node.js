/**
 * Dynamic App Configuration for White-Label Multi-Tenant Apps
 *
 * Each tenant gets their own branded app with:
 * - Custom app name, icon, splash screen
 * - Unique bundle ID / package name
 * - Separate App Store / Play Store listing
 *
 * Usage:
 *   TENANT=grace_college npx expo prebuild --platform ios --clean
 *   TENANT=ormond npx expo prebuild --platform ios --clean
 */

const fs = require('fs');
const path = require('path');
// iOS build number — auto-incremented by push_to_github.py on every push.
// To manually set: change the string below and push.
const iosBuildNumber = '50';

// Google OAuth client IDs per tenant/platform
// iOS client ID → reversed = iosUrlScheme (com.googleusercontent.apps.<reversed-client-id>)
const GOOGLE_IOS_CLIENT_IDS = {
  quadley:       "802541348205-c3di5hkpie589gvnd35icn4ea7eu8ohu.apps.googleusercontent.com",
  ormond:        "802541348205-c3di5hkpie589gvnd35icn4ea7eu8ohu.apps.googleusercontent.com", // uses Quadley key
  murphy_shark:  "802541348205-c3di5hkpie589gvnd35icn4ea7eu8ohu.apps.googleusercontent.com", // uses Quadley key
  grace_college: "802541348205-cikk1ar830flufe0d76oare4tucv75nb.apps.googleusercontent.com",
};

function getIosUrlScheme(iosClientId) {
  // Reversed client ID: strip ".apps.googleusercontent.com" suffix, reverse the numeric part
  // Format: com.googleusercontent.apps.<NUMERIC_ID>
  const match = iosClientId.match(/^(\d+)-(.+)\.apps\.googleusercontent\.com$/);
  if (!match) return "";
  return `com.googleusercontent.apps.${match[1]}-${match[2]}`;
}

const TENANT_CONFIGS = {
  quadley: {
    name: "Quadley",
    slug: "quadley-app",
    projectId: "02c021f0-c983-449b-ac13-ec787c8ddbe0",
    ios: { bundleIdentifier: "com.quadley.app" },
    android: { package: "com.quadley.app" },
    icon: "./assets/icon.png",
    splash: { image: "./assets/splash.png", backgroundColor: "#3b82f6" },
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#3b82f6" },
    primaryColor: "#1e3a5f",
    secondaryColor: "#c9cdd5",
  },
  ormond: {
    name: "Ormond College",
    slug: "ormond-college-app",
    ios: { bundleIdentifier: "com.ormond.college.app" },
    android: { package: "com.ormond.college.app" },
    icon: "./assets/tenants/ormond/icon.png",
    splash: { image: "./assets/tenants/ormond/splash.png", backgroundColor: "#1e3a5f" },
    adaptiveIcon: { foregroundImage: "./assets/tenants/ormond/adaptive-icon.png", backgroundColor: "#1e3a5f" },
    primaryColor: "#1e3a5f",
    secondaryColor: "#e8edf4",
  },
  murphy_shark: {
    name: "Murphy Shark",
    slug: "murphy-shark-app",
    ios: { bundleIdentifier: "com.murphyshark.app" },
    android: { package: "com.murphyshark.app" },
    icon: "./assets/tenants/murphy_shark/icon.png",
    splash: { image: "./assets/tenants/murphy_shark/splash.png", backgroundColor: "#7c3aed" },
    adaptiveIcon: { foregroundImage: "./assets/tenants/murphy_shark/adaptive-icon.png", backgroundColor: "#7c3aed" },
    primaryColor: "#7c3aed",
    secondaryColor: "#f3efff",
  },
  grace_college: {
    name: "Grace College",
    slug: "grace-college",
    projectId: "7c3a9ce2-7717-4878-95b9-b07e614ebaf0",
    ios: { bundleIdentifier: "com.gracecollege.app" },
    android: { package: "com.gracecollege.app" },
    icon: "./assets/tenants/grace_college/icon.png",
    splash: { image: "./assets/tenants/grace_college/splash.png", backgroundColor: "#3E1B5E" },
    adaptiveIcon: { foregroundImage: "./assets/tenants/grace_college/adaptive-icon.png", backgroundColor: "#3E1B5E" },
    primaryColor: "#E05A20",
    secondaryColor: "#3E1B5E",
  },
};

const TENANT = process.env.TENANT || 'quadley';
const tenantConfig = TENANT_CONFIGS[TENANT] || TENANT_CONFIGS.quadley;

console.log(`📱 Building app for tenant: ${TENANT} (${tenantConfig.name})`);

// ─── Write hardcoded tenant config into JS source ────────────────────────────
//
// ISOLATION GUARANTEE: tenantBuild.generated.js is the single source of
// build-time identity consumed by TenantContext.js and auth screens.
// Each tenant has its own permanent static file committed to the repo:
//   src/config/tenantBuild.quadley.js       ← Quadley canonical values
//   src/config/tenantBuild.grace_college.js ← Grace College canonical values
//
// Rules:
//  1. TENANT explicitly set → copy that tenant's static config into generated.js
//  2. TENANT not set (Metro/Xcode bundling) → leave generated.js untouched;
//     it already holds the correct values from the most recent prebuild.
//
// push_to_github.py always resets generated.js to Quadley values before
// committing so white-label builds never contaminate the repo.
//
if (process.env.TENANT) {
  const staticFilePath = path.join(
    __dirname, 'src', 'config', `tenantBuild.${TENANT}.js`
  );
  let staticContent = null;
  if (fs.existsSync(staticFilePath)) {
    // Use the committed static file as the canonical source — never trust
    // the dynamically computed values alone.
    staticContent = fs.readFileSync(staticFilePath, 'utf8');
    // Strip the leading comment block from the static file and prepend a
    // generated header so it's clear this is an auto-generated artifact.
    staticContent = staticContent.replace(/^\/\/[^\n]*\n/gm, '').trim();
    staticContent = `// AUTO-GENERATED by app.config.js — DO NOT EDIT MANUALLY\n// Source: tenantBuild.${TENANT}.js  |  Re-generate: TENANT=${TENANT} npx expo prebuild\n${staticContent}\n`;
  } else {
    // Fallback: generate inline (no static file for this tenant yet)
    staticContent = `// AUTO-GENERATED by app.config.js — DO NOT EDIT MANUALLY\n// Re-generate: TENANT=${TENANT} npx expo prebuild --platform ios --clean\nconst BUILD_CONFIG = {\n  tenant: ${JSON.stringify(TENANT)},\n  tenantName: ${JSON.stringify(tenantConfig.name)},\n  primaryColor: ${JSON.stringify(tenantConfig.primaryColor)},\n  secondaryColor: ${JSON.stringify(tenantConfig.secondaryColor)},\n};\nmodule.exports = BUILD_CONFIG;\n`;
    console.warn(`⚠️  No static file found at tenantBuild.${TENANT}.js — using inline fallback`);
  }
  try {
    const outPath = path.join(__dirname, 'src', 'config', 'tenantBuild.generated.js');
    fs.writeFileSync(outPath, staticContent, 'utf8');
    console.log(`✅ Wrote tenantBuild.generated.js for ${TENANT} (from tenantBuild.${TENANT}.js)`);
  } catch (e) {
    console.warn('⚠️  Could not write tenantBuild.generated.js:', e.message);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  expo: {
    owner: "genfink",
    name: tenantConfig.name,
    slug: tenantConfig.slug,
    version: "3.1.0",
    orientation: "portrait",
    icon: tenantConfig.icon,
    userInterfaceStyle: "light",
    splash: {
      image: tenantConfig.splash.image,
      resizeMode: "contain",
      backgroundColor: tenantConfig.splash.backgroundColor,
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: tenantConfig.ios.bundleIdentifier,
      buildNumber: iosBuildNumber,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: tenantConfig.adaptiveIcon.foregroundImage,
        backgroundColor: tenantConfig.adaptiveIcon.backgroundColor,
      },
      package: tenantConfig.android.package,
      versionCode: 64,
      permissions: ["INTERNET", "ACCESS_NETWORK_STATE"],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-secure-store",
      "expo-font",
      "expo-notifications",
      "expo-document-picker",
      "@react-native-community/datetimepicker",
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          // Reversed iOS Client ID — derived automatically from the per-tenant client ID.
          // Override with GOOGLE_IOS_URL_SCHEME env var if needed.
          iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME ||
            getIosUrlScheme(GOOGLE_IOS_CLIENT_IDS[TENANT] || GOOGLE_IOS_CLIENT_IDS.quadley),
        },
      ],
    ],
    extra: {
      tenant: TENANT,
      tenantName: tenantConfig.name,
      primaryColor: tenantConfig.primaryColor,
      secondaryColor: tenantConfig.secondaryColor,
      // Google OAuth client IDs — baked in at prebuild time per tenant
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || "802541348205-v9rraf8f0m7k6t22pe6gj0llbdctrlru.apps.googleusercontent.com",
      googleIosClientId: GOOGLE_IOS_CLIENT_IDS[TENANT] || GOOGLE_IOS_CLIENT_IDS.quadley,
      ...(tenantConfig.projectId ? { eas: { projectId: tenantConfig.projectId } } : {}),
    },
  },
};
