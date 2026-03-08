'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Building2,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Settings,
  ArrowRight,
  Shield,
  TrendingUp,
  Activity,
  ChevronRight,
  LogOut,
  Heart,
  FileText,
  GraduationCap,
  Megaphone
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AuthContext, API } from '@/contexts/AuthContext';

const AdminDashboard = () => {
  const router = useRouter();
  const { user, logout, loading: authLoading } = useContext(AuthContext);
  const [tenant, setTenant] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingTenants: 0,
    activeTenants: 0,
    activeUsers: 0,
    inactiveUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    fetchDashboardData(user);
  }, [user, authLoading]);

  const fetchDashboardData = async (currentUser) => {
    try {
      const isSuperAdmin = currentUser.role === 'super_admin';

      if (isSuperAdmin) {
        try {
          const tenantsRes = await axios.get(`${API}/tenants`);
          setTenants(tenantsRes.data);
          const pending = tenantsRes.data.filter(t => t.status === 'pending').length;
          const active = tenantsRes.data.filter(t => t.status === 'active').length;
          setStats(prev => ({ ...prev, pendingTenants: pending, activeTenants: active }));
        } catch (e) {
          console.error('Failed to fetch tenants', e);
        }
      } else {
        try {
          const tenantRes = await axios.get(`${API}/tenants/${currentUser.tenant_code}`);
          setTenant(tenantRes.data);
        } catch (e) {
          console.error('Failed to fetch tenant', e);
        }
      }

      if (!isSuperAdmin) {
        try {
          const usersRes = await axios.get(`${API}/users/list`);
          setStats(prev => ({
            ...prev,
            totalUsers: usersRes.data.length,
            activeUsers: usersRes.data.filter(u => u.active !== false).length,
            inactiveUsers: usersRes.data.filter(u => u.active === false).length
          }));
        } catch (e) {
          console.error('Failed to fetch users', e);
        }
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'super_admin';
  const pendingTenants = tenants.filter(t => t.status === 'pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {isSuperAdmin ? 'Super Admin Portal' : 'Admin Portal'}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {isSuperAdmin ? 'Manage all tenants and system settings' : tenant?.tenant_name || 'Manage your college'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            {!isSuperAdmin && (
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
                Back to App
              </Button>
            )}
            <Button
              onClick={async () => { await logout(); router.replace('/login'); }}
              variant="outline"
              className="flex items-center gap-2 text-destructive border-destructive/20 hover:bg-destructive/5"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>

        {/* Stats Overview — super admin only */}
        {isSuperAdmin && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {isSuperAdmin && (
            <Card 
              className="bg-gradient-to-br from-warning/10 to-warning/10 border-border cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
              onClick={() => router.push('/admin/tenants?status=pending')}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Pending Approval</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats.pendingTenants}</p>
                  </div>
                  <div className="p-2 bg-warning/40/50 rounded-lg">
                    <Clock className="h-5 w-5 text-foreground" />
                  </div>
                </div>
                <p className="text-xs text-primary mt-3">Click to review →</p>
              </CardContent>
            </Card>
          )}

          {isSuperAdmin && (
            <Card 
              className="bg-gradient-to-br from-success/10 to-success/10 border-success cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
              onClick={() => router.push('/admin/tenants?status=active')}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-success">Active Tenants</p>
                    <p className="text-3xl font-bold text-success mt-1">{stats.activeTenants}</p>
                  </div>
                  <div className="p-2 bg-success/40/50 rounded-lg">
                    <Building2 className="h-5 w-5 text-success" />
                  </div>
                </div>
                <p className="text-xs text-success mt-3">Click to manage →</p>
              </CardContent>
            </Card>
          )}

        </div>}

        {/* Quick Actions — top 4 tiles */}
        {!isSuperAdmin && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {/* Tile 1 — Announcements */}
              <button
                onClick={() => router.push('/admin/announcements')}
                className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-white border-2 border-blue-200 hover:border-blue-400 hover:shadow-md transition-all group text-center shadow-sm"
              >
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl group-hover:scale-105 transition-transform shadow">
                  <Megaphone className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Announcements</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Post · receipts · push</p>
                </div>
              </button>

              {/* Tile 2 — placeholder */}
              <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-center opacity-40">
                <div className="w-12 h-12 rounded-xl bg-muted" />
                <div className="w-16 h-2 rounded bg-muted" />
              </div>

              {/* Tile 3 — placeholder */}
              <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-center opacity-40">
                <div className="w-12 h-12 rounded-xl bg-muted" />
                <div className="w-16 h-2 rounded bg-muted" />
              </div>

              {/* Tile 4 — placeholder */}
              <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-center opacity-40">
                <div className="w-12 h-12 rounded-xl bg-muted" />
                <div className="w-16 h-2 rounded bg-muted" />
              </div>
            </div>
          </div>
        )}

        {/* Management */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Management</CardTitle>
            <CardDescription>Administrative tools and compliance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {isSuperAdmin && (
                <button
                  onClick={() => router.push('/admin/super')}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-muted to-muted hover:border-border hover:from-muted hover:to-muted transition-all group text-left"
                >
                  <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-lg group-hover:scale-105 transition-transform">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Super Admin Dashboard</h3>
                    <p className="text-sm text-primary">Full tenant management & analytics</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              )}

              {isSuperAdmin && (
                <button
                  onClick={() => router.push('/admin/tenants')}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-border hover:bg-muted transition-all group text-left"
                >
                  <div className="p-3 bg-gradient-to-br from-success to-success rounded-lg group-hover:scale-105 transition-transform">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Manage Tenants</h3>
                    <p className="text-sm text-muted-foreground">Approve & configure colleges</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                </button>
              )}

              {/* User Management — includes bulk import */}
              <button
                onClick={() => router.push('/admin/users')}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-border hover:bg-muted transition-all group text-left"
              >
                <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-lg group-hover:scale-105 transition-transform">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">User Management</h3>
                  <p className="text-sm text-muted-foreground">View, manage & bulk import via CSV</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
              </button>

              <button
                onClick={() => router.push('/admin/gbv')}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-orange-300 hover:bg-orange-50 transition-all group text-left"
              >
                <div className="p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg group-hover:scale-105 transition-transform">
                  {isSuperAdmin ? <FileText className="h-5 w-5 text-white" /> : <Heart className="h-5 w-5 text-white" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">GBV {isSuperAdmin ? 'Statistics' : 'Case Management'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isSuperAdmin ? 'National GBV compliance overview' : 'Cases, 45-day tracking & board reports'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-orange-500 transition-colors" />
              </button>

              {!isSuperAdmin && (
                <button
                  onClick={() => router.push('/admin/training')}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-purple-300 hover:bg-purple-50 transition-all group text-left"
                >
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg group-hover:scale-105 transition-transform">
                    <GraduationCap className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">GBV Training</h3>
                    <p className="text-sm text-muted-foreground">Staff training compliance — Standard 3</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                </button>
              )}

              {!isSuperAdmin && (
                <button
                  onClick={() => router.push('/admin/relationships')}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-rose-300 hover:bg-rose-50 transition-all group text-left"
                >
                  <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg group-hover:scale-105 transition-transform">
                    <Heart className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Relationship Disclosures</h3>
                    <p className="text-sm text-muted-foreground">Staff/student governance tracking</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-rose-500 transition-colors" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Tenants (Super Admin Only) */}
        {isSuperAdmin && pendingTenants.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader className="bg-muted rounded-t-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg text-foreground">Pending Approvals</CardTitle>
              </div>
              <CardDescription className="text-foreground">
                These tenants are waiting for approval
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {pendingTenants.slice(0, 5).map((t) => (
                  <div
                    key={t.tenant_id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                        {t.tenant_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t.tenant_name}</p>
                        <p className="text-sm text-muted-foreground">{t.domain} • {t.contact_email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push('/admin/tenants')}
                    >
                      Review
                    </Button>
                  </div>
                ))}
              </div>
              {pendingTenants.length > 5 && (
                <Button
                  variant="link"
                  className="mt-4 w-full"
                  onClick={() => router.push('/admin/tenants')}
                >
                  View all {pendingTenants.length} pending tenants
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tenant Info (Admin Only) */}
        {!isSuperAdmin && tenant && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tenant Information</CardTitle>
              <CardDescription>Your college configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Tenant ID</p>
                  <p className="font-semibold text-foreground">{tenant.tenant_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Domain</p>
                  <p className="font-semibold text-foreground">{tenant.domain}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={`mt-1 ${
                    tenant.status === 'active' ? 'bg-success/10 text-success hover:bg-success/10' :
                    tenant.status === 'pending' ? 'bg-muted text-foreground hover:bg-muted' :
                    'bg-destructive/10 text-destructive hover:bg-destructive/10'
                  }`}>
                    {tenant.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Capacity</p>
                  <p className="font-semibold text-foreground">{tenant.capacity} users</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact Email</p>
                  <p className="font-semibold text-foreground">{tenant.contact_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-semibold text-foreground">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
