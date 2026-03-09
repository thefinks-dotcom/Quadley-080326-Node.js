'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

export const BACKEND_URL = '';
export const API = '/api';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [enabledModules, setEnabledModules] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SECURITY (OWASP A03): Remove any stale token from localStorage.
    // Auth is now handled via httpOnly cookies set by the backend.
    try { localStorage.removeItem('token'); } catch {}
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      // Cookie is sent automatically — no token header needed.
      const response = await axios.get(`${API}/auth/me`);
      const { enabled_modules, ...userData } = response.data;
      setUser(userData);
      setEnabledModules(enabled_modules || null);
    } catch {
      setUser(null);
      setEnabledModules(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          try { sessionStorage.removeItem('quadley_dashboard_cache'); } catch {}
          setUser(null);
          setEnabledModules(null);
        }
        return Promise.reject(error);
      }
    );
    return () => { axios.interceptors.response.eject(interceptor); };
  }, []);

  // token param kept for call-site compatibility but is not stored.
  // The backend sets an httpOnly cookie on login / MFA completion.
  const login = (_token, userData, modules) => {
    try { sessionStorage.removeItem('quadley_dashboard_cache'); } catch {}
    setUser(userData);
    setEnabledModules(modules || null);
  };

  const logout = () => {
    try { sessionStorage.removeItem('quadley_dashboard_cache'); } catch {}
    setUser(null);
    setEnabledModules(null);
    // Backend clears the httpOnly cookie and blacklists the token.
    axios.post(`${API}/auth/logout`, {}).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, enabledModules, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
