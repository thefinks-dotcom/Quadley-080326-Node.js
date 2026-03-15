const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Tenant-aware module resolver ───────────────────────────────────────────────
//
// Every import of `tenantBuild.generated` (the generated file that
// push_to_github.py always resets to Quadley) is intercepted here and
// redirected to the correct STATIC tenant file instead.
//
// STATIC files are committed to the repo and never reset:
//   src/config/tenantBuild.quadley.js        ← Quadley values
//   src/config/tenantBuild.grace_college.js  ← Grace College values
//   src/config/tenantBuild.ormond.js         ← Ormond values
//   src/config/tenantBuild.murphy_shark.js   ← Murphy Shark values
//
// TENANT comes from the environment.  During Xcode builds it is injected via
// ios/.xcode.env.local (written by the withXcodeEnvLocal config plugin in
// app.config.js during `expo prebuild`).  During direct Metro sessions
// (e.g. `TENANT=grace_college npx expo start`) it comes from the shell.
//
// This completely bypasses the generated file and any Metro transform cache
// that may hold stale Quadley values.
//
const VALID_TENANTS = ['quadley', 'grace_college', 'ormond', 'murphy_shark'];
const TENANT = VALID_TENANTS.includes(process.env.TENANT)
  ? process.env.TENANT
  : 'quadley';

const TENANT_FILE = path.resolve(
  __dirname,
  `src/config/tenantBuild.${TENANT}.js`
);
// Fall back to the generated file if the static tenant file doesn't exist
// (e.g. ormond/murphy_shark don't have static files yet).
const GENERATED_FILE = path.resolve(
  __dirname,
  'src/config/tenantBuild.generated.js'
);
const fs = require('fs');
const RESOLVED_TENANT_FILE = fs.existsSync(TENANT_FILE)
  ? TENANT_FILE
  : GENERATED_FILE;

console.log(
  `[Metro] TENANT="${TENANT}" → tenantBuild.generated → ${path.basename(RESOLVED_TENANT_FILE)}`
);

const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (/tenantBuild\.generated/.test(moduleName)) {
      return { filePath: RESOLVED_TENANT_FILE, type: 'sourceFile' };
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
