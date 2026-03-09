import api, { warmupConnection, resetWarmupState, recreateApiInstance } from './api';
import * as SecureStore from 'expo-secure-store';
import { ENDPOINTS, API_BASE_URL } from '../config/api';

export const authService = {
  async login(email, password) {
    try {
      // Ensure connection is ready - force warmup to validate connection
      await warmupConnection(true);
      
      // Double-check axios baseURL matches expected
      if (api.defaults.baseURL !== API_BASE_URL) {
        console.log('[AUTH] Fixing stale baseURL before login');
        api.defaults.baseURL = API_BASE_URL;
      }
      
      const response = await api.post(ENDPOINTS.LOGIN, { email, password });
      
      const { access_token, user, tenant, mfa_required, mfa_enabled, mfa_setup_required } = response.data;
      
      if (!access_token) {
        throw new Error('No access token received from server');
      }
      
      await SecureStore.setItemAsync('access_token', access_token);
      await SecureStore.setItemAsync('user', JSON.stringify(user));
      
      // Store tenant info securely
      if (tenant) {
        await SecureStore.setItemAsync('tenant', JSON.stringify(tenant));
      }
      
      return { 
        token: access_token, 
        user,
        tenant,
        mfa_required: mfa_required || false,
        mfa_enabled: mfa_enabled || false,
        mfa_setup_required: mfa_setup_required || false
      };
    } catch (error) {
      // Log minimal error info (no PII)
      console.log('[AUTH] Login failed:', error.response?.status || error.code || 'unknown');
      
      // Enhanced error handling for connection issues
      if (error.response?.status === 404 || 
          error.code === 'ERR_NETWORK' || 
          error.code === 'ECONNABORTED') {
        // Recreate API instance for next attempt
        await recreateApiInstance();
        error.message = 'Connection error. Please try again.';
      }
      
      throw error;
    }
  },

  async verifyMFA(mfaCode, isBackupCode = false) {
    const response = await api.post(ENDPOINTS.LOGIN_MFA, {
      mfa_code: mfaCode,
      backup_code: isBackupCode
    });
    return response.data;
  },

  async getMFAStatus() {
    const response = await api.get(ENDPOINTS.MFA_STATUS);
    return response.data;
  },

  async setupMFA() {
    const response = await api.post(ENDPOINTS.MFA_SETUP);
    return response.data;
  },

  async enableMFA(code) {
    const response = await api.post(ENDPOINTS.MFA_VERIFY, { code });
    // Save the fresh token (without mfa_pending) so subsequent requests work
    if (response.data.access_token) {
      await SecureStore.setItemAsync('access_token', response.data.access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
    }
    return response.data;
  },

  async disableMFA(code) {
    const response = await api.post(ENDPOINTS.MFA_DISABLE, { code });
    return response.data;
  },

  async register(userData) {
    const response = await api.post(ENDPOINTS.REGISTER, userData);
    const { access_token, user } = response.data;
    
    await SecureStore.setItemAsync('access_token', access_token);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    
    return { token: access_token, user };
  },

  async registerWithInviteCode(codeData) {
    const response = await api.post(ENDPOINTS.INVITE_CODE_REGISTER, codeData);
    const { access_token, user, tenant } = response.data;

    await SecureStore.setItemAsync('access_token', access_token);
    await SecureStore.setItemAsync('user', JSON.stringify(user));

    return { access_token, user, tenant };
  },

  async logout() {
    try {
      await api.post(ENDPOINTS.LOGOUT);
    } catch (error) {
      // Ignore logout API errors - token may already be invalid
      console.log('Logout API call failed (expected if token expired)');
    }
    // Always clear local storage and reset warmup state
    await this.clearStoredAuth();
    resetWarmupState();
  },

  async getCurrentUser() {
    const response = await api.get(ENDPOINTS.ME);
    return response.data;
  },

  async getStoredUser() {
    const userStr = await SecureStore.getItemAsync('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  async getStoredToken() {
    return await SecureStore.getItemAsync('access_token');
  },

  async setTokenForVerification(token) {
    // Temporarily set the token in axios headers for verification
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },

  async clearStoredAuth() {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('user');
    delete api.defaults.headers.common['Authorization'];
  },

  async changePassword(currentPassword, newPassword) {
    const response = await api.post(ENDPOINTS.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  async requestEmailChange(newEmail, currentPassword) {
    const response = await api.post(ENDPOINTS.REQUEST_EMAIL_CHANGE, {
      new_email: newEmail,
      current_password: currentPassword,
    });
    return response.data;
  },

  async verifyEmailChange(code) {
    const response = await api.post(ENDPOINTS.VERIFY_EMAIL_CHANGE, { code });
    return response.data;
  },

  async forgotPassword(email) {
    const response = await api.post(ENDPOINTS.FORGOT_PASSWORD, { email });
    return response.data;
  },
};
