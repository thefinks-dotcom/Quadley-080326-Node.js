'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Users,
  Mail,
  Plus,
  Settings,
  BarChart3,
  UserPlus,
  Upload,
  Eye,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  BarChart2,
  FileText,
  Bell,
  TrendingUp,
  Activity,
  Calendar,
  DollarSign,
  Palette,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import BrandingPreviewPanel from '@/components/BrandingPreviewPanel';

const API = '';

// All available modules
const ALL_MODULES = [
  { key: 'events', name: 'Events', description: 'Calendar events and activities' },
  { key: 'announcements', name: 'Announcements', description: 'News and updates' },
  { key: 'messages', name: 'Messages', description: 'Direct messaging' },
  { key: 'jobs', name: 'Jobs', description: 'Job listings' },
  { key: 'dining', name: 'Dining', description: 'Meal menus and requests' },
  { key: 'maintenance', name: 'Maintenance', description: 'Fix requests' },
  { key: 'recognition', name: 'Recognition', description: 'Shoutouts and awards' },
  { key: 'wellbeing', name: 'Wellbeing', description: 'Mental health resources' },
  { key: 'academics', name: 'Academics', description: 'Study groups and tutoring' },
  { key: 'cocurricular', name: 'Co-Curricular', description: 'Clubs and activities' },
  { key: 'floor', name: 'Floor', description: 'Floor community features' },
  { key: 'birthdays', name: 'Birthdays', description: 'Birthday notifications' },
  { key: 'safe_disclosure', name: 'Safe Disclosure', description: 'Confidential reporting' },
  { key: 'parcels', name: 'Parcels', description: 'Package tracking' },
  { key: 'bookings', name: 'Bookings', description: 'Facility reservations' },
];

const SuperAdminDashboard = () => {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showModulesDialog, setShowModulesDialog] = useState(false);
  const [showUsersDialog, setShowUsersDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [showBrandingDialog, setShowBrandingDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [tenantStats, setTenantStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [crossTenantAnalytics, setCrossTenantAnalytics] = useState(null);
  const [activityMetrics, setActivityMetrics] = useState(null);
  const [moduleUsage, setModuleUsage] = useState(null);
  const [activeTab, setActiveTab] = useState('tenants');
  
  const [newTenant, setNewTenant] = useState({
    name: '',
    contact_person_name: '',
    contact_person_email: '',
    logo_url: '',
    logo_file: null
  });
  
  const [newInvitation, setNewInvitation] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'student'
  });

  useEffect(() => {
    fetchTenants();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    filterTenants();
  }, [searchTerm, statusFilter, tenants]);

  const fetchTenants = async () => {
    try {
      const response = await axios.get(`${API}/api/tenants`, {
      });
      setTenants(response.data);
    } catch (error) {
      toast.error('Failed to fetch tenants');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      
      // Use the new cross-tenant analytics endpoint
      const response = await axios.get(`${API}/api/analytics/cross-tenant/overview`, {
      });
      
      setCrossTenantAnalytics(response.data);
      
      // Set legacy analytics format for backward compatibility
      setAnalytics({
        total_tenants: response.data.tenants?.total || 0,
        active_tenants: response.data.tenants?.active || 0,
        total_users: response.data.users?.total || 0,
        total_students: response.data.users?.by_role?.student || 0,
        total_admins: response.data.users?.by_role?.admin || 0,
        total_ras: response.data.users?.by_role?.ra || 0
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Fallback to old method if new endpoint fails
      try {
        const tenantsRes = await axios.get(`${API}/api/tenants`, {
        });
        
        setAnalytics({
          total_tenants: tenantsRes.data.length,
          active_tenants: tenantsRes.data.filter(t => t.status === 'active').length,
          total_users: 0,
          total_students: 0
        });
      } catch (e) {
        console.error('Fallback analytics also failed:', e);
      }
    }
  };

  const fetchActivityMetrics = async (days = 30) => {
    try {
      const response = await axios.get(`${API}/api/analytics/cross-tenant/activity?days=${days}`, {
      });
      setActivityMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch activity metrics:', error);
    }
  };

  const fetchModuleUsage = async () => {
    try {
      const response = await axios.get(`${API}/api/analytics/cross-tenant/module-usage`, {
      });
      setModuleUsage(response.data);
    } catch (error) {
      console.error('Failed to fetch module usage:', error);
    }
  };

  const filterTenants = () => {
    let filtered = [...tenants];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.name?.toLowerCase().includes(term) ||
        t.code?.toLowerCase().includes(term) ||
        t.contact_person_email?.toLowerCase().includes(term)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    
    setFilteredTenants(filtered);
  };

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.contact_person_name || !newTenant.contact_person_email) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setActionLoading(true);
    try {
      
      // Create tenant first (without logo)
      const tenantPayload = {
        name: newTenant.name,
        contact_person_name: newTenant.contact_person_name,
        contact_person_email: newTenant.contact_person_email,
        logo_url: newTenant.logo_url || ''
      };
      
      const response = await axios.post(`${API}/api/tenants`, tenantPayload, {
      });
      
      const createdTenant = response.data;
      
      // Upload logo file if provided
      if (newTenant.logo_file) {
        const formData = new FormData();
        formData.append('file', newTenant.logo_file);
        
        try {
          await axios.post(`${API}/api/tenants/${createdTenant.code}/logo`, formData, {
            headers: { 
              'Content-Type': 'multipart/form-data'
            }
          });
        } catch (logoError) {
          console.error('Logo upload failed:', logoError);
          toast.warning('Tenant created but logo upload failed');
        }
      }
      
      toast.success('Tenant created successfully! Invitation sent to admin.');
      setShowAddDialog(false);
      setNewTenant({ name: '', contact_person_name: '', contact_person_email: '', logo_url: '', logo_file: null });
      fetchTenants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendTenant = async (tenantCode) => {
    setActionLoading(true);
    try {
      await axios.delete(`${API}/api/tenants/${tenantCode}`, {
      });
      toast.success('Tenant suspended');
      fetchTenants();
    } catch (error) {
      toast.error('Failed to suspend tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateTenant = async (tenantCode) => {
    setActionLoading(true);
    try {
      await axios.put(`${API}/api/tenants/${tenantCode}/reactivate`, {}, {
      });
      toast.success('Tenant reactivated');
      fetchTenants();
    } catch (error) {
      toast.error('Failed to reactivate tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleModule = async (module) => {
    if (!selectedTenant) return;
    
    const currentModules = selectedTenant.enabled_modules || [];
    const newModules = currentModules.includes(module)
      ? currentModules.filter(m => m !== module)
      : [...currentModules, module];
    
    try {
      await axios.put(`${API}/api/tenants/${selectedTenant.code}/modules`, { enabled_modules: newModules }, {
      });
      
      // Update local state
      setSelectedTenant({ ...selectedTenant, enabled_modules: newModules });
      setTenants(tenants.map(t => 
        t.code === selectedTenant.code ? { ...t, enabled_modules: newModules } : t
      ));
      
      toast.success(`Module ${currentModules.includes(module) ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast.error('Failed to update modules');
    }
  };

  const fetchTenantUsers = async (tenantCode) => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/tenants/${tenantCode}/users`, {
        }),
        axios.get(`${API}/api/tenants/${tenantCode}/stats`, {
        })
      ]);
      setTenantUsers(usersRes.data);
      setTenantStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to fetch tenant users');
    }
  };

  const handleResetMFA = async (user) => {
    if (!window.confirm(`Reset MFA for ${user.first_name} ${user.last_name} (${user.email})? They will need to set up MFA again on next login.`)) return;
    try {
      await axios.post(`${API}/api/tenants/${selectedTenant.code}/users/${user.id}/reset-mfa`, {}, {
      });
      toast.success(`MFA reset for ${user.first_name} ${user.last_name}`);
      fetchTenantUsers(selectedTenant.code);
    } catch (error) {
      toast.error('Failed to reset MFA');
    }
  };

  const handleInviteUser = async () => {
    if (!newInvitation.email) {
      toast.error('Email is required');
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/tenants/${selectedTenant.code}/invitations`, newInvitation, {
      });
      toast.success('Invitation sent successfully');
      setShowInviteDialog(false);
      setNewInvitation({ email: '', first_name: '', last_name: '', role: 'student' });
      fetchTenantUsers(selectedTenant.code);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'suspended':
        return <Badge className="bg-destructive/10 text-destructive"><XCircle className="w-3 h-3 mr-1" />Suspended</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage tenants, users, and system settings</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push('/admin/privacy')} className="gap-2">
            <Shield className="w-4 h-4" />
            Data Privacy
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/security')} className="gap-2" data-testid="security-alerts-nav-btn">
            <Activity className="w-4 h-4" />
            Security Alerts
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/saml-simulator')} className="gap-2" data-testid="saml-simulator-nav-btn">
            <Shield className="w-4 h-4" />
            SAML Simulator
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Tenant
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="tenants" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2" onClick={() => {
            fetchActivityMetrics();
            fetchModuleUsage();
          }}>
            <BarChart2 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Revenue
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Analytics Cards - Show on all tabs */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                  <p className="text-2xl font-bold">{analytics.total_tenants}</p>
                </div>
                <Building2 className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Tenants</p>
                  <p className="text-2xl font-bold">{analytics.active_tenants}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{analytics.total_users}</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                  <p className="text-2xl font-bold">${crossTenantAnalytics?.revenue?.monthly_recurring || 0}</p>
                  <p className="text-xs text-muted-foreground">{analytics.total_students} students</p>
                </div>
                <DollarSign className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tenants Tab Content */}
      {activeTab === 'tenants' && (
        <>
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search tenants..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {['all', 'active', 'suspended', 'pending'].map((status) => (
                    <Button
                      key={status}
                      variant={statusFilter === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tenants List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTenants.map((tenant) => (
              <Card key={tenant.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {tenant.logo_url ? (
                        <img src={tenant.logo_url} alt={tenant.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{tenant.name}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{tenant.code}</p>
                      </div>
                    </div>
                    {getStatusBadge(tenant.status)}
                  </div>
                </CardHeader>
                <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{tenant.contact_person_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{tenant.user_count} users</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>{tenant.enabled_modules?.length || 0} modules enabled</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTenant(tenant);
                    fetchTenantUsers(tenant.code);
                    setShowUsersDialog(true);
                  }}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Users
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTenant(tenant);
                    setShowModulesDialog(true);
                  }}
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Modules
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTenant(tenant);
                    setShowBrandingDialog(true);
                  }}
                >
                  <Palette className="w-3 h-3 mr-1" />
                  Branding
                </Button>
                {tenant.status === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/5"
                    onClick={() => handleSuspendTenant(tenant.code)}
                    disabled={actionLoading}
                  >
                    <Pause className="w-3 h-3 mr-1" />
                    Suspend
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-success hover:bg-success/10"
                    onClick={() => handleReactivateTenant(tenant.code)}
                    disabled={actionLoading}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Activate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTenants.length === 0 && (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No tenants found</p>
          <Button onClick={() => setShowAddDialog(true)} className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Add First Tenant
          </Button>
        </Card>
      )}
        </>
      )}

      {/* Analytics Tab Content */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Activity Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Activity Metrics (Last 30 Days)
              </CardTitle>
              <CardDescription>Platform-wide activity across all tenants</CardDescription>
            </CardHeader>
            <CardContent>
              {activityMetrics ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{activityMetrics.totals?.events_created || 0}</p>
                    <p className="text-sm text-muted-foreground">Events</p>
                  </div>
                  <div className="text-center p-4 bg-success/10 rounded-lg">
                    <p className="text-2xl font-bold text-success">{activityMetrics.totals?.announcements_created || 0}</p>
                    <p className="text-sm text-muted-foreground">Announcements</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{activityMetrics.totals?.messages_sent || 0}</p>
                    <p className="text-sm text-muted-foreground">Messages</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{activityMetrics.totals?.maintenance_requests || 0}</p>
                    <p className="text-sm text-muted-foreground">Maintenance</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{activityMetrics.totals?.bookings_made || 0}</p>
                    <p className="text-sm text-muted-foreground">Bookings</p>
                  </div>
                  <div className="text-center p-4 bg-warning/10 rounded-lg">
                    <p className="text-2xl font-bold text-warning">{activityMetrics.totals?.shoutouts_given || 0}</p>
                    <p className="text-sm text-muted-foreground">Shoutouts</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{activityMetrics.totals?.new_users_registered || 0}</p>
                    <p className="text-sm text-muted-foreground">New Users</p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Module Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Module Usage
              </CardTitle>
              <CardDescription>How modules are being used across tenants</CardDescription>
            </CardHeader>
            <CardContent>
              {moduleUsage ? (
                <div className="space-y-3">
                  {Object.entries(moduleUsage.module_usage || {}).slice(0, 10).map(([module, data]) => (
                    <div key={module} className="flex items-center gap-4">
                      <span className="w-32 text-sm capitalize">{module.replace('_', ' ')}</span>
                      <div className="flex-1 bg-muted rounded-full h-4">
                        <div 
                          className="bg-muted0 h-4 rounded-full transition-all"
                          style={{ width: `${data.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-20">
                        {data.enabled_count} ({data.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Active Tenants */}
          {activityMetrics?.by_tenant && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Most Active Tenants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activityMetrics.by_tenant.slice(0, 5).map((tenant, index) => (
                    <div key={tenant.tenant_code} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-sm font-bold text-primary">
                          {index + 1}
                        </span>
                        <span className="font-medium">{tenant.tenant_name}</span>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{tenant.events} events</span>
                        <span>{tenant.announcements} announcements</span>
                        <span>{tenant.messages} messages</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Revenue Tab Content */}
      {activeTab === 'revenue' && crossTenantAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-success/10 rounded-lg">
                    <DollarSign className="w-8 h-8 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Recurring Revenue</p>
                    <p className="text-3xl font-bold">${crossTenantAnalytics.revenue?.monthly_recurring || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Revenue Per Tenant</p>
                    <p className="text-3xl font-bold">
                      ${analytics?.total_tenants > 0 ? Math.round(crossTenantAnalytics.revenue?.monthly_recurring / analytics.total_tenants) : 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue Per User</p>
                    <p className="text-3xl font-bold">
                      ${analytics?.total_users > 0 ? (crossTenantAnalytics.revenue?.monthly_recurring / analytics.total_users).toFixed(2) : 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Add Tenant Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Tenant</DialogTitle>
            <DialogDescription>
              Create a new residential college. An invitation will be sent to the contact person.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>College Name *</Label>
              <Input
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                placeholder="e.g., Ormond College"
              />
            </div>
            <div>
              <Label>Contact Person Name *</Label>
              <Input
                value={newTenant.contact_person_name}
                onChange={(e) => setNewTenant({ ...newTenant, contact_person_name: e.target.value })}
                placeholder="e.g., John Smith"
              />
            </div>
            <div>
              <Label>Contact Person Email *</Label>
              <Input
                type="email"
                value={newTenant.contact_person_email}
                onChange={(e) => setNewTenant({ ...newTenant, contact_person_email: e.target.value })}
                placeholder="e.g., admin@college.edu"
              />
            </div>
            <div>
              <Label>Logo</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewTenant({ ...newTenant, logo_file: file, logo_url: '' });
                      }
                    }}
                    className="flex-1"
                    data-testid="logo-file-input"
                  />
                </div>
                {newTenant.logo_file && (
                  <p className="text-sm text-success">Selected: {newTenant.logo_file.name}</p>
                )}
                <div className="text-xs text-muted-foreground">Or enter a URL:</div>
                <Input
                  value={newTenant.logo_url}
                  onChange={(e) => setNewTenant({ ...newTenant, logo_url: e.target.value, logo_file: null })}
                  placeholder="https://..."
                  disabled={!!newTenant.logo_file}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTenant} disabled={actionLoading}>
              {actionLoading ? 'Creating...' : 'Create Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modules Dialog */}
      <Dialog open={showModulesDialog} onOpenChange={setShowModulesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Modules - {selectedTenant?.name}</DialogTitle>
            <DialogDescription>
              Enable or disable features for this tenant
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {ALL_MODULES.map((module) => (
              <div
                key={module.key}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{module.name}</p>
                  <p className="text-xs text-muted-foreground">{module.description}</p>
                </div>
                <Switch
                  checked={selectedTenant?.enabled_modules?.includes(module.key)}
                  onCheckedChange={() => handleToggleModule(module.key)}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowModulesDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Dialog */}
      <Dialog open={showUsersDialog} onOpenChange={setShowUsersDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Users - {selectedTenant?.name}</DialogTitle>
            <DialogDescription>
              {tenantStats && (
                <span>
                  Total: {tenantStats.total_users} users • 
                  {tenantStats.users_by_role?.admin || 0} admins • 
                  {tenantStats.users_by_role?.ra || 0} RAs • 
                  {tenantStats.users_by_role?.student || 0} students •
                  {tenantStats.pending_invitations || 0} pending invitations
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2 text-sm font-medium">Name</th>
                  <th className="text-left p-2 text-sm font-medium">Email</th>
                  <th className="text-left p-2 text-sm font-medium">Role</th>
                  <th className="text-left p-2 text-sm font-medium">MFA</th>
                  <th className="text-left p-2 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenantUsers.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-2 text-sm">{user.first_name} {user.last_name}</td>
                    <td className="p-2 text-sm">{user.email}</td>
                    <td className="p-2">
                      <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant={user.mfa_enabled ? 'default' : 'outline'} className={user.mfa_enabled ? 'bg-green-100 text-green-800 border-green-200' : 'text-muted-foreground'}>
                        {user.mfa_enabled ? '✓ On' : 'Off'}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {user.mfa_enabled && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={() => handleResetMFA(user)}
                        >
                          Reset MFA
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenantUsers.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No users yet</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowUsersDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join {selectedTenant?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newInvitation.email}
                onChange={(e) => setNewInvitation({ ...newInvitation, email: e.target.value })}
                placeholder="user@email.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name</Label>
                <Input
                  value={newInvitation.first_name}
                  onChange={(e) => setNewInvitation({ ...newInvitation, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={newInvitation.last_name}
                  onChange={(e) => setNewInvitation({ ...newInvitation, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="w-full p-2 border rounded-md"
                value={newInvitation.role}
                onChange={(e) => setNewInvitation({ ...newInvitation, role: e.target.value })}
              >
                <option value="student">Student</option>
                <option value="ra">RA</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteUser} disabled={actionLoading}>
              {actionLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Branding Preview Panel */}
      {showBrandingDialog && selectedTenant && (
        <BrandingPreviewPanel
          tenant={selectedTenant}
          onClose={() => setShowBrandingDialog(false)}
          onSave={(branding) => {
            toast.success('Branding updated successfully');
            setShowBrandingDialog(false);
          }}
        />
      )}
    </div>
  );
};

export default SuperAdminDashboard;
