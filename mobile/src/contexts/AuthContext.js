import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { authService } from '../services/authService';
import { warmupConnection, resetWarmupState, recreateApiInstance, setSessionExpiredCallback } from '../services/api';
import { useTenant } from './TenantContext';
import { apiErrorMessage } from '../utils/apiError';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef(null);
  const loginAttempts = useRef(0);
  
  const { saveTenant, clearTenant, updateEnabledModules, refreshBranding } = useTenant();

  useEffect(() => {
    initializeApp();
    
    // Listen for app state changes (background/foreground)
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);
  
  const handleAppStateChange = async (nextAppState) => {
    // Track when app goes to background
    if (nextAppState.match(/inactive|background/)) {
      lastBackgroundTime.current = Date.now();
      console.log('[AUTH] App going to background');
    }
    
    // App came back to foreground
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[AUTH] App returned to foreground');
      
      // Calculate time in background
      const timeInBackground = lastBackgroundTime.current 
        ? Date.now() - lastBackgroundTime.current 
        : 0;
      const minutesInBackground = Math.floor(timeInBackground / 60000);
      
      console.log(`[AUTH] Was in background for ${minutesInBackground} minutes`);
      
      // If in background for more than 1 hour, do a full connection reset
      if (minutesInBackground > 60) {
        console.log('[AUTH] Long background time (>1hr) - recreating API instance');
        await recreateApiInstance();
      } else if (minutesInBackground > 30) {
        console.log('[AUTH] Medium background time (30-60min) - resetting warmup');
        resetWarmupState();
      }
      
      // Always force warmup connection to ensure API is fresh
      try {
        await warmupConnection(true);
      } catch (e) {
        console.log('[AUTH] Warmup failed on resume:', e.message);
        // If warmup fails, recreate instance
        await recreateApiInstance();
      }
      
      const storedToken = await authService.getStoredToken();
      if (storedToken) {
        try {
          // Validate session is still active
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
          if (Array.isArray(currentUser?.enabled_modules)) {
            updateEnabledModules(currentUser.enabled_modules);
          }
          // Refresh branding colours from /auth/me so any admin colour changes
          // are picked up without requiring a full logout/login cycle.
          if (currentUser?.tenant_branding) {
            refreshBranding(currentUser.tenant_branding);
          }
          console.log('[AUTH] Session still valid');
        } catch (err) {
          console.log('[AUTH] Session invalid after returning to foreground:', err.message);
          console.log('[AUTH] Error status:', err.response?.status);
          
          // Session expired or invalid - clear auth (will show login screen)
          if (err.response?.status === 401 || err.response?.status === 404) {
            console.log('[AUTH] Clearing expired session...');
            await authService.clearStoredAuth();
            resetWarmupState();
            setToken(null);
            setUser(null);
          }
        }
      }
    }
    appState.current = nextAppState;
  };

  const initializeApp = async () => {
    try {
      // Load stored auth first (priority) - don't wait for warmup
      setIsConnecting(false); // Don't block UI for warmup
      await loadStoredAuth();
      
      // Warmup in background after auth check - non-blocking
      warmupConnection().catch(() => {});
    } catch (err) {
      console.log('Error initializing app:', err);
      setIsConnecting(false);
    }
  };

  const loadStoredAuth = async () => {
    try {
      const storedToken = await authService.getStoredToken();
      const storedUser = await authService.getStoredUser();
      
      if (storedToken && storedUser) {
        // Set user immediately for faster UI - token will be validated on first API call
        // The API interceptor handles 401 responses and clears auth
        setToken(storedToken);
        setUser(storedUser);
        
        // Validate token in background (non-blocking)
        authService.setTokenForVerification(storedToken);
        authService.getCurrentUser()
          .then(currentUser => {
            setUser(currentUser);
            if (Array.isArray(currentUser?.enabled_modules)) {
              updateEnabledModules(currentUser.enabled_modules);
            }
            // Refresh branding colours returned by /auth/me so stale SecureStore
            // data never overrides the live tenant configuration.
            if (currentUser?.tenant_branding) {
              refreshBranding(currentUser.tenant_branding);
            }
          })
          .catch(() => {
            // Token invalid - clear auth silently
            console.log('Stored token invalid, clearing...');
            authService.logout();
            setToken(null);
            setUser(null);
          });
      }
    } catch (err) {
      console.log('Error loading auth:', err);
      await authService.logout();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    setMfaRequired(false);
    setMfaSetupRequired(false);
    loginAttempts.current += 1;
    const currentAttempt = loginAttempts.current;
    
    try {
      // CRITICAL: Test connection BEFORE attempting login
      console.log('[AuthContext] Testing backend connection before login...');
      const isConnected = await warmupConnection(true); // Force fresh connection test
      
      if (!isConnected) {
        console.log('[AuthContext] Backend not reachable - aborting login');
        loginAttempts.current = 0;
        setError('Cannot connect to server. Please check your internet connection and try again.');
        return { success: false, error: 'Cannot connect to server. Please check your internet connection and try again.' };
      }
      
      console.log('[AuthContext] Backend reachable, proceeding with login...');
      const result = await authService.login(email, password);
      const { token: newToken, user: newUser, tenant, mfa_required, mfa_enabled, mfa_setup_required } = result;
      
      // Reset login attempts on success
      loginAttempts.current = 0;
      
      setToken(newToken);
      setUser(newUser);
      
      // Save tenant info
      if (tenant) {
        await saveTenant(tenant);
      }
      
      // Check MFA requirements — only for privileged roles, never for students
      const isPrivileged = ['admin', 'ra', 'super_admin'].includes(newUser?.role);
      if (mfa_required && mfa_enabled && isPrivileged) {
        // User needs to verify MFA
        setMfaRequired(true);
        return { success: true, mfaRequired: true };
      } else if (mfa_setup_required && isPrivileged) {
        // Admin/RA needs to set up MFA for the first time
        setMfaSetupRequired(true);
        return { success: true, mfaSetupRequired: true };
      }
      
      return { success: true };
    } catch (err) {
      console.log('[AuthContext] Login error:', {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        attempt: currentAttempt
      });
      
      // Determine error message
      let message = 'Login failed';
      
      // Connection/network errors
      const isConnectionError = 
        err.code === 'ERR_NETWORK' || 
        err.code === 'ECONNABORTED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND' ||
        err.response?.status === 404 ||
        (!err.response && err.message?.includes('Network'));
      
      if (isConnectionError) {
        // Recreate API instance for next attempt
        console.log('[AuthContext] Connection error detected, recreating API instance');
        await recreateApiInstance();
        
        // Auto-retry once
        if (currentAttempt < 2) {
          console.log('[AuthContext] Auto-retrying login...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return login(email, password);
        }
        
        message = 'Cannot connect to server. Please check your internet and try again.';
      } else if (err.response?.data?.detail) {
        message = apiErrorMessage(err.response.data.detail);
      } else if (err.message) {
        message = err.message;
      }
      
      // Reset attempts after giving up
      loginAttempts.current = 0;
      setError(message);
      return { success: false, error: message };
    }
  };

  const completeMfaVerification = () => {
    setMfaRequired(false);
  };

  const completeMfaSetup = () => {
    setMfaSetupRequired(false);
  };

  const register = async (userData) => {
    setError(null);
    try {
      const { token: newToken, user: newUser } = await authService.register(userData);
      setToken(newToken);
      setUser(newUser);
      return { success: true };
    } catch (err) {
      const message = apiErrorMessage(err.response?.data?.detail, 'Registration failed');
      setError(message);
      return { success: false, error: message };
    }
  };

  const registerWithCode = async (codeData) => {
    setError(null);
    try {
      const result = await authService.registerWithInviteCode(codeData);
      const { access_token, user: newUser, tenant } = result;
      setToken(access_token);
      setUser(newUser);
      if (tenant) {
        await saveTenant(tenant);
      }
      return { success: true };
    } catch (err) {
      const message = apiErrorMessage(err.response?.data?.detail, 'Registration failed');
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.log('Logout error (non-fatal):', e);
    }
    // Reset connection state to ensure fresh connection on next login
    resetWarmupState();
    setToken(null);
    setUser(null);
    setMfaRequired(false);
    setMfaSetupRequired(false);
    await clearTenant();
  };

  // Register session expiry callback so 401 responses trigger proper logout
  useEffect(() => {
    setSessionExpiredCallback(() => {
      logout();
    });
  }, []);

  const refreshUser = async (logoutOnFail = true) => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      if (Array.isArray(currentUser?.enabled_modules)) {
        updateEnabledModules(currentUser.enabled_modules);
      }
      if (currentUser?.tenant_branding) {
        refreshBranding(currentUser.tenant_branding);
      }
      return currentUser;
    } catch (err) {
      console.log('Error refreshing user:', err);
      // If we get 401 or 404, session is invalid - logout (unless caller opts out)
      if (logoutOnFail && (err.response?.status === 401 || err.response?.status === 404)) {
        console.log('Session expired, logging out...');
        await logout();
      }
      throw err;
    }
  };

  // Role-based helpers
  const isStudent = user?.role === 'student';
  const isRA = user?.role === 'ra';
  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = isRA || isAdmin || isSuperAdmin;

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token && !!user,
    isStudent,
    isRA,
    isAdmin,
    isSuperAdmin,
    isStaff,
    mfaRequired,
    mfaSetupRequired,
    isConnecting,
    login,
    register,
    registerWithCode,
    logout,
    refreshUser,
    completeMfaVerification,
    completeMfaSetup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
