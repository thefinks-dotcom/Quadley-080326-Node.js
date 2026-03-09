import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { colors } from '../theme';

// Build-time branding from app.config.js (set per-tenant at build)
const BUILD_PRIMARY = Constants.expoConfig?.extra?.primaryColor || colors.primary;
const BUILD_SECONDARY = Constants.expoConfig?.extra?.secondaryColor || colors.textPrimary;

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
  'bookings'
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
  bookings: { name: 'Bookings', icon: 'calendar-check' }
};

const TenantContext = createContext(null);

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(null);
  const [enabledModules, setEnabledModules] = useState(ALL_MODULES);
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

  // Normalize branding from snake_case (backend) to camelCase (frontend)
  // Only returns values actually set by the DB — null fields won't overwrite build-time defaults
  const normalizeBranding = (raw) => {
    if (!raw) return null;
    const pc = raw.primary_color || raw.primaryColor || null;
    const sc = raw.secondary_color || raw.secondaryColor || null;
    const lu = raw.logo_url || raw.logoUrl || null;
    // If nothing is set, treat as no branding
    if (!pc && !sc && !lu) return null;
    return { primaryColor: pc, secondaryColor: sc, logoUrl: lu };
  };

  const loadTenantFromStorage = async () => {
    try {
      const storedTenant = await SecureStore.getItemAsync('tenant');
      if (storedTenant) {
        const tenantData = JSON.parse(storedTenant);
        setTenant(tenantData);
        setEnabledModules(tenantData.enabled_modules || ALL_MODULES);
        const normalized = normalizeBranding(tenantData.branding);
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
      setEnabledModules(tenantData?.enabled_modules || ALL_MODULES);
      
      const normalized = normalizeBranding(tenantData?.branding);
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

  const clearTenant = async () => {
    try {
      setTenant(null);
      setEnabledModules(ALL_MODULES);
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
    // Super admin sees all modules
    if (!tenant || tenant.code === null) {
      return true;
    }
    return enabledModules.includes(moduleName);
  };

  // Get list of enabled modules
  const getEnabledModules = () => {
    if (!tenant || tenant.code === null) {
      return ALL_MODULES;
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
