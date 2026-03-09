/**
 * Dynamic App Configuration for White-Label Multi-Tenant Apps
 * 
 * Each tenant gets their own branded app with:
 * - Custom app name, icon, splash screen
 * - Unique bundle ID / package name
 * - Separate App Store / Play Store listing
 * 
 * Usage:
 *   TENANT=ormond eas build --platform ios --profile production
 *   TENANT=murphy_shark eas build --platform android --profile production
 */

// Tenant configurations - Add your tenants here
const TENANT_CONFIGS = {
  // Default/Main Quadley app
  quadley: {
    name: "Quadley",
    slug: "quadley-app",
    projectId: "02c021f0-c983-449b-ac13-ec787c8ddbe0",
    ios: {
      bundleIdentifier: "com.quadley.app",
    },
    android: {
      package: "com.quadley.app",
    },
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      backgroundColor: "#3b82f6",
    },
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#3b82f6",
    },
    primaryColor: "#1e3a5f",
    secondaryColor: "#c9cdd5",
  },
  ormond: {
    name: "Ormond College",
    slug: "ormond-college-app",
    ios: {
      bundleIdentifier: "com.ormond.college.app",
    },
    android: {
      package: "com.ormond.college.app",
    },
    icon: "./assets/tenants/ormond/icon.png",
    splash: {
      image: "./assets/tenants/ormond/splash.png",
      backgroundColor: "#1e3a5f", // Ormond's brand color
    },
    adaptiveIcon: {
      foregroundImage: "./assets/tenants/ormond/adaptive-icon.png",
      backgroundColor: "#1e3a5f",
    },
    primaryColor: "#1e3a5f",
    secondaryColor: "#e8edf4",
  },
  murphy_shark: {
    name: "Murphy Shark",
    slug: "murphy-shark-app",
    ios: {
      bundleIdentifier: "com.murphyshark.app",
    },
    android: {
      package: "com.murphyshark.app",
    },
    icon: "./assets/tenants/murphy_shark/icon.png",
    splash: {
      image: "./assets/tenants/murphy_shark/splash.png",
      backgroundColor: "#7c3aed", // Murphy Shark's brand color
    },
    adaptiveIcon: {
      foregroundImage: "./assets/tenants/murphy_shark/adaptive-icon.png",
      backgroundColor: "#7c3aed",
    },
    primaryColor: "#7c3aed",
    secondaryColor: "#f3efff",
  },
  grace_college: {
    name: "Grace College",
    slug: "grace-college",
    projectId: "7c3a9ce2-7717-4878-95b9-b07e614ebaf0",
    ios: {
      bundleIdentifier: "com.gracecollege.app",
    },
    android: {
      package: "com.gracecollege.app",
    },
    icon: "./assets/tenants/grace_college/icon.png",
    splash: {
      image: "./assets/tenants/grace_college/splash.png",
      backgroundColor: "#3E1B5E",
    },
    adaptiveIcon: {
      foregroundImage: "./assets/tenants/grace_college/adaptive-icon.png",
      backgroundColor: "#3E1B5E",
    },
    primaryColor: "#E05A20",
    secondaryColor: "#3E1B5E",
  },

  // Add more tenants here following the same pattern:
  // tenant_code: {
  //   name: "Tenant Display Name",
  //   slug: "tenant-app-slug",
  //   ios: { bundleIdentifier: "com.tenant.app" },
  //   android: { package: "com.tenant.app" },
  //   icon: "./assets/tenants/tenant_code/icon.png",
  //   splash: { image: "./assets/tenants/tenant_code/splash.png", backgroundColor: "#hexcolor" },
  //   adaptiveIcon: { foregroundImage: "./assets/tenants/tenant_code/adaptive-icon.png", backgroundColor: "#hexcolor" },
  //   primaryColor: "#hexcolor",
  // },
};

// Get tenant from environment variable, default to 'quadley'
const TENANT = process.env.TENANT || 'quadley';
const tenantConfig = TENANT_CONFIGS[TENANT] || TENANT_CONFIGS.quadley;

console.log(`📱 Building app for tenant: ${TENANT} (${tenantConfig.name})`);

export default {
  expo: {
    owner: "genfink",
    name: tenantConfig.name,
    slug: tenantConfig.slug,
    version: "3.0.0",
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
      buildNumber: "5",
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
      versionCode: 61,
      permissions: ["INTERNET", "ACCESS_NETWORK_STATE"],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: ["expo-secure-store", "expo-font", "expo-notifications", "expo-document-picker", "@react-native-community/datetimepicker"],
    extra: {
      // Pass tenant info to the app at runtime
      tenant: TENANT,
      tenantName: tenantConfig.name,
      primaryColor: tenantConfig.primaryColor,
      secondaryColor: tenantConfig.secondaryColor,
      ...(tenantConfig.projectId ? { eas: { projectId: tenantConfig.projectId } } : {}),
    },
  },
};
