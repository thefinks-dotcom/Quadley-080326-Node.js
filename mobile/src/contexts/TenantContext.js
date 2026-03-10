import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme';
import BUILD_CONFIG from '../config/tenantBuild.generated';

// Build-time tenant identity — hardcoded by app.config.js at `expo prebuild` time.
// These values are ALWAYS correct for this binary regardless of Metro env vars.
const BUILD_TENANT = BUILD_CONFIG.tenant;
const BUILD_TENANT_NAME = BUILD_CONFIG.tenantName;
const BUILD_PRIMARY = BUILD_CONFIG.primaryColor || colors.primary;
const BUILD_SECONDARY = BUILD_CONFIG.secondaryColor || colors.textPrimary;

// All available modules
export const ALL_MODULES = [
  'events',
  'announcements',
  'messages',
  'jobs',
  'dining',
  'maintenance',
  'recognition',
  'wellbeing',
  'academics',
  'cocurricular',
  'floor',
  'birthdays',
  'safe_disclosure',
  'parcels',
  'bookings',
  'relationship_disclosures',
  'gbv_training',
];

// Module display names and icons
export const MODULE_CONFIG = {
  events: { name: 'Events', icon: 'calendar' },
  announcements: { name: 'Announcements', icon: 'bullhorn' },
  messages: { name: 'Messages', icon: 'comments' },
  jobs: { name: 'Jobs', icon: 'briefcase' },
  dining: { name: 'Dining', icon: 'utensils' },
  maintenance: { name: 'Maintenance', icon: 'tools' },
  recognition: { name: 'Recognition', icon: 'award' },
  wellbeing: { name: 'Wellbeing', icon: 'heart' },
  academics: { name: 'Academics', icon: 'graduation-cap' },
  cocurricular: { name: 'Co-Curricular', icon: 'users' },
  floor: { name: 'Floor', icon: 'building' },
  birthdays: { name: 'Birthdays', icon: 'birthday-cake' },
  safe_disclosure: { name: 'Safe Disclosure', icon: 'shield-alt' },
  parcels: { name: 'Parcels', icon: 'box' },
  bookings: { name: 'Bookings', icon: 'calendar-check' },
  relationship_disclosures: { name: 'Relationship Disclosures', icon: 'heart' },
  gbv_training: { name: 'GBV Training', icon: 'shield-checkmark' },
};

const TenantContext = createContext(null);

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(null);
  const [enabledModules, setEnabledModules] = useState(BUILD_TENANT === 'quadley' ? ALL_MODULES : []);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState({
    primaryColor: BUILD_PRIMARY,
    secondaryColor: BUILD_SECONDARY,
    logoUrl: null
  });

  // Load tenant from storage on mount
  useEffect(() => {
    loadTenantFromStorage();
  }, []);

  // Normalize branding from snake_case (backend) to camelCase (frontend).
  // Accepts either the nested `branding` sub-object or the full tenant document so
  // that the top-level `logo_url` field returned by the backend is never lost.
  const normalizeBranding = (raw, topLevel = null) => {
    if (!raw && !topLevel) return null;
    const src = raw || {};
    const pc = src.primary_color || src.primaryColor || null;
    const sc = src.secondary_color || src.secondaryColor || null;
    // Prefer logo_url from the branding sub-object; fall back to top-level logo_url
    const lu = src.logo_url || src.logoUrl || topLevel?.logo_url || topLevel?.logoUrl || null;
    if (!pc && !sc && !lu) return null;
    return { primaryColor: pc, secondaryColor: sc, logoUrl: lu };
  };

  const loadTenantFromStorage = async () => {
    try {
      const storedTenant = await SecureStore.getItemAsync('tenant');
      if (storedTenant) {
        const tenantData = JSON.parse(storedTenant);

        // MISMATCH GUARD: If this is a white-label build (e.g. grace_college) and the
        // stored tenant is from a different app (e.g. quadley), discard it.
        // Prevents branding and module contamination across builds on the same device.
        if (
          BUILD_TENANT !== 'quadley' &&
          tenantData.code &&
          tenantData.code !== BUILD_TENANT
        ) {
          console.log(`[Tenant] Stored tenant '${tenantData.code}' != build tenant '${BUILD_TENANT}', clearing.`);
          await SecureStore.deleteItemAsync('tenant');
          return;
        }

        setTenant(tenantData);

        // Use stored enabled_modules if present (even an empty array is valid).
        // Only fall back to ALL_MODULES for the generic Quadley build; white-label
        // builds should wait for the background /auth/me refresh to set the real list
        // rather than briefly showing every module.
        if (Array.isArray(tenantData.enabled_modules)) {
          setEnabledModules(tenantData.enabled_modules);
        } else if (BUILD_TENANT === 'quadley') {
          setEnabledModules(ALL_MODULES);
        }
        // else: white-label build with missing enabled_modules — leave as []
        // and let background getCurrentUser() populate it.

        const normalized = normalizeBranding(tenantData.branding, tenantData);
        if (normalized) {
          setBranding(prev => ({
            ...prev,
            ...(normalized.primaryColor && { primaryColor: normalized.primaryColor }),
            ...(normalized.secondaryColor && { secondaryColor: normalized.secondaryColor }),
            ...(normalized.logoUrl && { logoUrl: normalized.logoUrl }),
          }));
        }
      }
    } catch (error) {
      console.log('Error loading tenant from storage:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTenant = async (tenantData) => {
    try {
      setTenant(tenantData);
      if (Array.isArray(tenantData?.enabled_modules)) {
        setEnabledModules(tenantData.enabled_modules);
      } else if (BUILD_TENANT === 'quadley') {
        setEnabledModules(ALL_MODULES);
      }
      
      const normalized = normalizeBranding(tenantData?.branding, tenantData);
      if (normalized) {
        setBranding(prev => ({
          ...prev,
          ...(normalized.primaryColor && { primaryColor: normalized.primaryColor }),
          ...(normalized.secondaryColor && { secondaryColor: normalized.secondaryColor }),
          ...(normalized.logoUrl && { logoUrl: normalized.logoUrl }),
        }));
      }
      
      if (tenantData) {
        await SecureStore.setItemAsync('tenant', JSON.stringify(tenantData));
      } else {
        await SecureStore.deleteItemAsync('tenant');
      }
    } catch (error) {
      console.log('Error saving tenant to storage:', error);
    }
  };

  const updateEnabledModules = async (modules) => {
    if (!Array.isArray(modules)) return;
    setEnabledModules(modules);
    try {
      const storedTenant = await SecureStore.getItemAsync('tenant');
      if (storedTenant) {
        const tenantData = JSON.parse(storedTenant);
        tenantData.enabled_modules = modules;
        await SecureStore.setItemAsync('tenant', JSON.stringify(tenantData));
      }
    } catch (error) {
      console.log('Error updating enabled modules:', error);
    }
  };

  const clearTenant = async () => {
    try {
      setTenant(null);
      setEnabledModules(BUILD_TENANT === 'quadley' ? ALL_MODULES : []);
      setBranding({
        primaryColor: BUILD_PRIMARY,
        secondaryColor: BUILD_SECONDARY,
        logoUrl: null
      });
      await SecureStore.deleteItemAsync('tenant');
    } catch (error) {
      console.log('Error clearing tenant from storage:', error);
    }
  };

  // Check if a specific module is enabled
  const isModuleEnabled = (moduleName) => {
    // Super admin (code === null) sees all modules
    if (tenant?.code === null) {
      return true;
    }
    // White-label build with no active session: respect enabledModules list.
    // Generic Quadley build with no session: show all (admin/demo context).
    if (!tenant) {
      return BUILD_TENANT === 'quadley' ? true : enabledModules.includes(moduleName);
    }
    return enabledModules.includes(moduleName);
  };

  // Get list of enabled modules
  const getEnabledModules = () => {
    if (tenant?.code === null) {
      return ALL_MODULES;
    }
    if (!tenant) {
      return BUILD_TENANT === 'quadley' ? ALL_MODULES : enabledModules;
    }
    return enabledModules;
  };

  const value = {
    tenant,
    enabledModules,
    branding,
    loading,
    saveTenant,
    clearTenant,
    updateEnabledModules,
    isModuleEnabled,
    getEnabledModules,
    isSuperAdmin: !tenant || tenant.code === null
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export default TenantContext;
