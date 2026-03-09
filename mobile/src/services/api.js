import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';

// Connection state
let isWarmedUp = false;
let warmupPromise = null;
let lastSuccessfulConnection = 0;

// Longer timeouts to handle cold starts and slow connections
const TIMEOUT = Platform.OS === 'android' ? 30000 : 30000;
const WARMUP_TIMEOUT = 15000; // 15 seconds for warmup/ping

// Create a fresh axios instance with security hardening
const createFreshAxiosInstance = () => {
  console.log('[API] Creating fresh axios instance');
  console.log('[API] Base URL:', API_BASE_URL);
  
  // Enforce HTTPS in production
  if (API_BASE_URL && !API_BASE_URL.startsWith('https://') && !__DEV__) {
    console.error('[API] SECURITY: API_BASE_URL must use HTTPS in production');
  }
  
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    }
  });
  return instance;
};

// Main API instance
let api = createFreshAxiosInstance();

// Force recreate the axios instance
export const recreateApiInstance = async () => {
  console.log('[API] === RECREATING API INSTANCE ===');
  
  // Get token before recreating
  let token = null;
  try {
    token = await SecureStore.getItemAsync('access_token');
  } catch (e) {
    console.log('[API] Could not retrieve token');
  }
  
  // Create completely fresh instance
  api = createFreshAxiosInstance();
  
  // Restore token if exists
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  
  // Re-attach interceptors
  attachInterceptors();
  
  // Reset state
  isWarmedUp = false;
  warmupPromise = null;
  
  console.log('[API] === INSTANCE RECREATED ===');
  return api;
};

// Test if backend is actually reachable - returns true/false
const testConnection = async (retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[API] Testing connection (attempt ${attempt}/${retries})...`);
      
      // Use fresh axios instance for test (not the cached one)
      const response = await axios.get(`${API_BASE_URL}/ping`, {
        timeout: WARMUP_TIMEOUT,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        }
      });
      
      if (response.status === 200) {
        console.log('[API] Connection test PASSED');
        lastSuccessfulConnection = Date.now();
        return true;
      }
    } catch (error) {
      console.log(`[API] Connection test failed (attempt ${attempt}):`, error.code || error.message);
      
      if (attempt < retries) {
        // Wait before retry (exponential backoff)
        const delay = attempt * 2000;
        console.log(`[API] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.log('[API] Connection test FAILED after all retries');
  return false;
};

// Warmup connection - actually verify backend is reachable
export const warmupConnection = async (force = false) => {
  const now = Date.now();
  const cacheTime = 2 * 60 * 1000; // 2 minutes cache (reduced from 5)
  
  // Return cached result only if recent AND we had a successful connection
  if (!force && isWarmedUp && lastSuccessfulConnection > 0 && (now - lastSuccessfulConnection) < cacheTime) {
    console.log('[WARMUP] Using cached warmup (last success:', Math.floor((now - lastSuccessfulConnection) / 1000), 'seconds ago)');
    return true;
  }
  
  // Avoid concurrent warmups
  if (warmupPromise) {
    console.log('[WARMUP] Waiting for existing warmup...');
    return warmupPromise;
  }
  
  warmupPromise = (async () => {
    try {
      console.log('[WARMUP] Starting connection test...');
      console.log('[WARMUP] Platform:', Platform.OS);
      console.log('[WARMUP] API URL:', API_BASE_URL);
      
      const isConnected = await testConnection(3);
      
      if (isConnected) {
        isWarmedUp = true;
        console.log('[WARMUP] Backend is ready');
        return true;
      } else {
        // Connection failed - recreate instance and try once more
        console.log('[WARMUP] Initial connection failed, recreating instance...');
        await recreateApiInstance();
        
        const retryConnected = await testConnection(2);
        isWarmedUp = retryConnected;
        
        if (!retryConnected) {
          console.log('[WARMUP] Backend unreachable after instance recreation');
        }
        return retryConnected;
      }
    } catch (error) {
      console.log('[WARMUP] Unexpected error:', error.message);
      isWarmedUp = false;
      return false;
    } finally {
      warmupPromise = null;
    }
  })();
  
  return warmupPromise;
};

// Session expiry callback — set by AuthContext so 401s trigger proper logout
let sessionExpiredCallback = null;
let sessionExpiredFiring = false;
export const setSessionExpiredCallback = (callback) => {
  sessionExpiredCallback = callback;
};

export const resetWarmupState = () => {
  console.log('[API] Resetting warmup state');
  isWarmedUp = false;
  warmupPromise = null;
  lastSuccessfulConnection = 0;
  sessionExpiredFiring = false;
};

export const isBackendReady = () => isWarmedUp;

// Get time since last successful connection
export const getTimeSinceLastConnection = () => {
  if (lastSuccessfulConnection === 0) return -1;
  return Date.now() - lastSuccessfulConnection;
};

// Attach interceptors
const attachInterceptors = () => {
  // Clear existing interceptors
  api.interceptors.request.handlers = [];
  api.interceptors.response.handlers = [];
  
  // Request interceptor
  api.interceptors.request.use(
    async (config) => {
      // Always ensure baseURL is set
      config.baseURL = API_BASE_URL;
      
      // Add timestamp to prevent caching
      config.params = {
        ...config.params,
        _t: Date.now()
      };
      
      // Log request (redact auth endpoints)
      const logUrl = config.url?.includes('/auth/') ? '/auth/***' : config.url;
      console.log(`[API] REQUEST: ${config.method?.toUpperCase()} ${logUrl}`);
      
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.log('[API] Token retrieval error');
      }
      return config;
    },
    (error) => {
      console.log('[API] Request interceptor error:', error.message);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  api.interceptors.response.use(
    (response) => {
      console.log(`[API] RESPONSE: ${response.status} OK`);
      lastSuccessfulConnection = Date.now();
      return response;
    },
    async (error) => {
      const status = error.response?.status || 'NO_RESPONSE';
      const code = error.code || 'UNKNOWN';
      console.log(`[API] ERROR: status=${status}, code=${code}`);
      
      // Handle 401 - token expired, force logout
      // Skip auth endpoints (login/logout) and prevent recursive loops
      const requestUrl = error.config?.url || '';
      const isAuthEndpoint = requestUrl.includes('/auth/');
      if (error.response?.status === 401 && !isAuthEndpoint && !sessionExpiredFiring) {
        sessionExpiredFiring = true;
        console.log('[API] Session expired - forcing logout');
        try {
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('user');
          await SecureStore.deleteItemAsync('tenant');
        } catch (e) {
          // Silent fail
        }
        if (sessionExpiredCallback) {
          sessionExpiredCallback();
        }
        // Reset flag after a short delay to allow future session expiry handling
        setTimeout(() => { sessionExpiredFiring = false; }, 3000);
      }
      
      return Promise.reject(error);
    }
  );
};

// Initialize interceptors
attachInterceptors();

export default api;
