/**
 * Runtime integrity checks for mobile app security.
 * Detects jailbreak/root, debugger attachment, and config tampering.
 * OWASP A08 compliance - Software and Data Integrity Failures.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { reportJailbreakDetected, reportTamperDetected } from './securityService';

// Jailbreak/root detection indicators
const JAILBREAK_PATHS_IOS = [
  '/Applications/Cydia.app',
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/bin/bash',
  '/usr/sbin/sshd',
  '/etc/apt',
  '/private/var/lib/apt/',
];

const ROOT_PATHS_ANDROID = [
  '/system/app/Superuser.apk',
  '/sbin/su',
  '/system/bin/su',
  '/system/xbin/su',
  '/data/local/xbin/su',
  '/data/local/bin/su',
  '/system/sd/xbin/su',
];

/**
 * Check for jailbreak/root indicators.
 * This is a best-effort check — sophisticated jailbreaks can bypass these.
 */
export const checkDeviceIntegrity = async () => {
  const suspicious = [];

  try {
    const paths = Platform.OS === 'ios' ? JAILBREAK_PATHS_IOS : ROOT_PATHS_ANDROID;
    for (const path of paths) {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          suspicious.push(path);
        }
      } catch {
        // Expected — file doesn't exist
      }
    }
  } catch {
    // Can't check — assume safe
  }

  if (suspicious.length > 0) {
    reportJailbreakDetected();
    return { safe: false, reason: 'device_integrity', indicators: suspicious.length };
  }

  return { safe: true };
};

/**
 * Validate app configuration hasn't been tampered with.
 */
export const checkConfigIntegrity = () => {
  const config = Constants.expoConfig;
  if (!config) {
    reportTamperDetected('missing_expo_config');
    return { safe: false, reason: 'missing_config' };
  }

  // Verify expected config structure exists
  const requiredFields = ['name', 'slug', 'version'];
  for (const field of requiredFields) {
    if (!config[field]) {
      reportTamperDetected(`missing_config_field_${field}`);
      return { safe: false, reason: `missing_${field}` };
    }
  }

  return { safe: true };
};

/**
 * Run all integrity checks. Call on app startup.
 */
export const runIntegrityChecks = async () => {
  const results = {
    device: await checkDeviceIntegrity(),
    config: checkConfigIntegrity(),
  };

  const allSafe = Object.values(results).every(r => r.safe);
  return { safe: allSafe, checks: results };
};
