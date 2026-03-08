'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
export const API = `${BACKEND_URL}/api`;

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [enabledModules, setEnabledModules] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.get(`${API}/auth/me`);
      const { enabled_modules, ...userData } = response.data;
      setUser(userData);
      setEnabledModules(enabled_modules || null);
    } catch {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
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
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          try { sessionStorage.removeItem('quadley_dashboard_cache'); } catch {}
          setUser(null);
          setEnabledModules(null);
        }
        return Promise.reject(error);
      }
    );
    return () => { axios.interceptors.response.eject(interceptor); };
  }, []);

  const login = (token, userData, modules) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try { sessionStorage.removeItem('quadley_dashboard_cache'); } catch {}
    setUser(userData);
    setEnabledModules(modules || null);
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (err) {
      console.error('Logout error', err);
    }
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    try { sessionStorage.removeItem('quadley_dashboard_cache'); } catch {}
    setUser(null);
    setEnabledModules(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, enabledModules, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
