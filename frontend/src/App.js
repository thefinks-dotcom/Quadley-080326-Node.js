import React from "react";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import "@/App.css";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import SetupPassword from "@/pages/SetupPassword";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import SuperAdminDashboard from "@/pages/admin/SuperAdminDashboard";
import UserManagement from "@/pages/admin/UserManagement";
import CSVUpload from "@/pages/admin/CSVUpload";
import TenantManagement from "@/pages/admin/TenantManagement";
import SSOConfiguration from "@/pages/admin/SSOConfiguration";
import DataPrivacyDashboard from "@/pages/admin/DataPrivacyDashboard";
import SecurityAlerts from "@/pages/admin/SecurityAlerts";
import SAMLSimulator from "@/pages/admin/SAMLSimulator";
import Jobs from "@/pages/Jobs";
import PrivacyTerms from "@/pages/PrivacyTerms";
// College Admin Portal
import CollegeAdminDashboard from "@/pages/college-admin/CollegeAdminDashboard";
import CollegeUserManagement from "@/pages/college-admin/CollegeUserManagement";
import ModuleSettings from "@/pages/college-admin/ModuleSettings";
import ServiceRequests from "@/pages/college-admin/ServiceRequests";
import RecognitionAdmin from "@/pages/college-admin/RecognitionAdmin";
import EventsAdmin from "@/pages/college-admin/EventsAdmin";
import AnnouncementsAdmin from "@/pages/college-admin/AnnouncementsAdmin";
import WellbeingAdmin from "@/pages/college-admin/WellbeingAdmin";
import SafetySupportAdmin from "@/pages/college-admin/SafetySupportAdmin";
import CoCurricularAdmin from "@/pages/college-admin/CoCurricularAdmin";
import MessageOverview from "@/pages/college-admin/MessageOverview";
import ReportsInsights from "@/pages/college-admin/ReportsInsights";
import CollegeJobsAdmin from "@/pages/college-admin/CollegeJobsAdmin";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import TenantLogo from "@/components/TenantLogo";
import { TenantThemeProvider } from "@/contexts/TenantThemeContext";
import { TENANT_THEMES } from "@/config/tenantThemes";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const AuthContext = React.createContext(null);

const _tenantCode = process.env.REACT_APP_TENANT_CODE?.toUpperCase();
const _tenantMeta = _tenantCode ? TENANT_THEMES[_tenantCode] : null;
const APP_NAME = _tenantMeta?.name || 'Quadley';

const HeroScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
    <div className="text-center space-y-6 animate-fade-in">
      <div className="flex justify-center">
        <div className="p-4 bg-white/10 rounded-2xl">
          <TenantLogo size={80} />
        </div>
      </div>
      <div>
        <h1 className="font-heading text-3xl font-bold text-white tracking-tight mb-2">
          {APP_NAME}
        </h1>
        <p className="text-slate-400 text-sm">Loading your campus community...</p>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  </div>
);

/**
 * AppRoutes lives inside BrowserRouter so it can use useSearchParams
 * via TenantThemeProvider.  AuthContext is already available here since
 * AuthContext.Provider wraps the whole tree.
 */
function AppRoutes({ user }) {
  return (
    <TenantThemeProvider>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/setup-password" element={<SetupPassword />} />
        <Route path="/dashboard/*" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user ? <AdminDashboard /> : <Navigate to="/login" />} />
        <Route path="/admin/super" element={user?.role === 'super_admin' ? <SuperAdminDashboard /> : <Navigate to="/login" />} />
        <Route path="/admin/tenants" element={user ? <TenantManagement /> : <Navigate to="/login" />} />
        <Route path="/admin/tenants/:tenantCode/sso" element={user ? <SSOConfiguration /> : <Navigate to="/login" />} />
        <Route path="/admin/privacy" element={user?.role === 'super_admin' ? <DataPrivacyDashboard /> : <Navigate to="/login" />} />
        <Route path="/admin/security" element={user?.role === 'super_admin' ? <SecurityAlerts /> : <Navigate to="/login" />} />
        <Route path="/admin/saml-simulator" element={user?.role === 'super_admin' ? <SAMLSimulator /> : <Navigate to="/login" />} />
        <Route path="/admin/users" element={user ? <UserManagement /> : <Navigate to="/login" />} />
        <Route path="/admin/users/csv-upload" element={user ? <CSVUpload /> : <Navigate to="/login" />} />
        {/* College Admin Portal — super_admin redirects to Quadley super admin dashboard */}
        <Route path="/college-admin" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <CollegeAdminDashboard />} />
        <Route path="/college-admin/users" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <CollegeUserManagement />} />
        <Route path="/college-admin/users/import" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <CSVUpload />} />
        <Route path="/college-admin/modules" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <ModuleSettings />} />
        <Route path="/college-admin/sso" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <SSOConfiguration />} />
        <Route path="/college-admin/privacy" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <DataPrivacyDashboard />} />
        <Route path="/college-admin/security" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <SecurityAlerts />} />
        <Route path="/college-admin/service-requests" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <ServiceRequests />} />
        <Route path="/college-admin/recognition" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <RecognitionAdmin />} />
        <Route path="/college-admin/events" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <EventsAdmin />} />
        <Route path="/college-admin/announcements" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <AnnouncementsAdmin />} />
        <Route path="/college-admin/wellbeing" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <WellbeingAdmin />} />
        <Route path="/college-admin/safety-support" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <SafetySupportAdmin />} />
        <Route path="/college-admin/co-curricular" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <CoCurricularAdmin />} />
        <Route path="/college-admin/messages" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <MessageOverview />} />
        <Route path="/college-admin/reports" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <ReportsInsights />} />
        <Route path="/college-admin/jobs" element={!user ? <Navigate to="/login" /> : user.role === 'super_admin' ? <Navigate to="/admin/super" /> : <CollegeJobsAdmin />} />
        <Route path="/jobs" element={user ? <Jobs /> : <Navigate to="/login" />} />
        <Route path="/privacy" element={<PrivacyTerms />} />
        <Route path="/terms" element={<PrivacyTerms />} />
      </Routes>
    </TenantThemeProvider>
  );
}

function App() {
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
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setEnabledModules(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          try { sessionStorage.removeItem('quadley_dashboard_cache'); } catch {}
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    return () => { axios.interceptors.response.eject(responseInterceptor); };
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
    } catch (error) {
      console.error("Logout error", error);
    }
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    try { sessionStorage.removeItem('quadley_dashboard_cache'); } catch {}
    setUser(null);
    setEnabledModules(null);
  };

  if (loading) {
    return <HeroScreen />;
  }

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, login, logout, enabledModules }}>
        <div className="App">
          <BrowserRouter>
            <AppRoutes user={user} />
          </BrowserRouter>
          <Toaster position="top-center" richColors />
        </div>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
