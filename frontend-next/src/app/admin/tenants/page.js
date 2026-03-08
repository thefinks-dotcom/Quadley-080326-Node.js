'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import {
  Search,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Users,
  Globe,
  Mail,
  AlertTriangle,
  Trash2,
  Settings,
  MoreVertical,
  Eye,
  Plus,
  Shield,
  UserCog,
  Palette
} from 'lucide-react';

const ALL_MODULES = [
  { id: 'events',          label: 'Events' },
  { id: 'announcements',   label: 'Announcements' },
  { id: 'messages',        label: 'Messages' },
  { id: 'jobs',            label: 'Jobs' },
  { id: 'dining',          label: 'Dining' },
  { id: 'maintenance',     label: 'Maintenance' },
  { id: 'recognition',     label: 'Recognition' },
  { id: 'wellbeing',       label: 'Wellbeing' },
  { id: 'academics',       label: 'Academics' },
  { id: 'cocurricular',    label: 'Co-curricular' },
  { id: 'floor',           label: 'Floor' },
  { id: 'birthdays',       label: 'Birthdays' },
  { id: 'finance',         label: 'Finance' },
  { id: 'safe_disclosure', label: 'Safe Disclosure' },
  { id: 'parcels',         label: 'Parcels' },
  { id: 'bookings',        label: 'Bookings' },
];

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

const TenantManagement = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '' });
  const [newTenant, setNewTenant] = useState({
    tenant_id: '',
    tenant_name: '',
    domain: '',
    contact_email: '',
    capacity: 500,
    admin_first_name: '',
    admin_last_name: '',
    admin_email: '',
    admin_password: '',
    logo_url: '',
    primary_color: '#3b82f6',
    secondary_color: '#1f2937',
    enabled_modules: ALL_MODULES.map(m => m.id),
  });

  const toggleModule = (moduleId) => {
    setNewTenant(prev => {
      const current = prev.enabled_modules;
      const updated = current.includes(moduleId)
        ? current.filter(m => m !== moduleId)
        : [...current, moduleId];
      return { ...prev, enabled_modules: updated };
    });
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    filterTenants();
  }, [searchTerm, statusFilter, tenants]);

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/tenants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTenants(response.data);
    } catch (error) {
      toast.error('Failed to fetch tenants');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterTenants = () => {
    let filtered = [...tenants];

    if (searchTerm) {
      filtered = filtered.filter(tenant =>
        tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.tenant_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(tenant => tenant.status === statusFilter);
    }

    setFilteredTenants(filtered);
  };

  const handleApproveTenant = async () => {
    if (!selectedTenant) return;
    setActionLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/tenants/${selectedTenant.tenant_id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedTenant.name} has been approved!`);
      setShowApproveDialog(false);
      setSelectedTenant(null);
      fetchTenants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendTenant = async () => {
    if (!selectedTenant) return;
    setActionLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/api/tenants/${selectedTenant.tenant_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedTenant.name} has been suspended`);
      setShowSuspendDialog(false);
      setSelectedTenant(null);
      fetchTenants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to suspend tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTenant = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/tenants`,
        newTenant,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Tenant "${newTenant.tenant_name}" created successfully!`);
      setShowAddDialog(false);
      setNewTenant({
        tenant_id: '',
        tenant_name: '',
        domain: '',
        contact_email: '',
        capacity: 500,
        admin_first_name: '',
        admin_last_name: '',
        admin_email: '',
        admin_password: '',
        logo_url: '',
        primary_color: '#3b82f6',
        secondary_color: '#1f2937',
        enabled_modules: ALL_MODULES.map(m => m.id),
      });
      fetchTenants();
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to create tenant');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setContactLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/tenants/${selectedTenant.code}/contact-person`,
        {
          contact_person_name: contactForm.name,
          contact_person_email: contactForm.email,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Contact person updated successfully!');
      setShowContactDialog(false);
      setSelectedTenant(null);
      fetchTenants();
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update contact person');
    } finally {
      setContactLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-success/10 text-success hover:bg-success/10 gap-1">
            <CheckCircle className="h-3 w-3" /> Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-muted text-foreground hover:bg-muted gap-1">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        );
      case 'suspended':
        return (
          <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 gap-1">
            <XCircle className="h-3 w-3" /> Suspended
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingCount = tenants.filter(t => t.status === 'pending').length;
  const activeCount = tenants.filter(t => t.status === 'active').length;
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push('/admin')}
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Tenant Management</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {filteredTenants.length} of {tenants.length} tenants
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
            className={`p-4 rounded-xl border transition-all ${
              statusFilter === 'pending' 
                ? 'bg-muted border-primary/30 ring-2 ring-warning' 
                : 'bg-white border-border hover:border-border'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{pendingCount}</p>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
            className={`p-4 rounded-xl border transition-all ${
              statusFilter === 'active' 
                ? 'bg-success/10 border-success ring-2 ring-success' 
                : 'bg-white border-border hover:border-success'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{activeCount}</p>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended')}
            className={`p-4 rounded-xl border transition-all ${
              statusFilter === 'suspended' 
                ? 'bg-destructive/5 border-destructive ring-2 ring-destructive' 
                : 'bg-white border-border hover:border-destructive/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-muted-foreground">Suspended</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{suspendedCount}</p>
          </button>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, domain, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tenant List */}
        <div className="space-y-4">
          {filteredTenants.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">No tenants found</h3>
                <p className="text-muted-foreground mt-1">Try adjusting your search or filter</p>
              </div>
            </Card>
          ) : (
            filteredTenants.map((tenant) => (
              <Card key={tenant.tenant_id || tenant.code} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {tenant.name?.charAt(0) || 'T'}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-semibold text-foreground">{tenant.name}</h3>
                          {getStatusBadge(tenant.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Globe className="h-4 w-4" /> {tenant.domain}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" /> {tenant.capacity} capacity
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-4 w-4" /> {tenant.contact_person_name || 'N/A'} ({tenant.contact_person_email || tenant.contact_email})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          ID: {tenant.tenant_id} • Created: {new Date(tenant.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Edit Contact Person Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setContactForm({
                            name: tenant.contact_person_name || '',
                            email: tenant.contact_person_email || tenant.contact_email || '',
                          });
                          setShowContactDialog(true);
                        }}
                        className="text-primary border-border hover:bg-muted"
                        data-testid={`edit-contact-${tenant.code}`}
                      >
                        <UserCog className="h-4 w-4 mr-1" />
                        Contact
                      </Button>
                      {/* SSO Configuration Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/admin/tenants/${tenant.code}/sso`)}
                        className="text-primary border-border hover:bg-muted"
                        data-testid={`sso-config-${tenant.code}`}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        SSO
                      </Button>
                      {tenant.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setShowApproveDialog(true);
                          }}
                          className="bg-success hover:bg-success"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      {tenant.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setShowSuspendDialog(true);
                          }}
                          className="text-destructive border-destructive/20 hover:bg-destructive/5"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Suspend
                        </Button>
                      )}
                      {tenant.status === 'suspended' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setShowApproveDialog(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Approve Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                {selectedTenant?.status === 'suspended' ? 'Reactivate' : 'Approve'} Tenant
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to {selectedTenant?.status === 'suspended' ? 'reactivate' : 'approve'} <strong>{selectedTenant?.name}</strong>?
                {selectedTenant?.status !== 'suspended' && " This will activate their account and allow their admin to log in."}
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-muted rounded-lg my-4">
              <p className="text-sm"><strong>Domain:</strong> {selectedTenant?.domain}</p>
              <p className="text-sm"><strong>Contact:</strong> {selectedTenant?.contact_email}</p>
              <p className="text-sm"><strong>Capacity:</strong> {selectedTenant?.capacity} users</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button 
                onClick={handleApproveTenant} 
                disabled={actionLoading}
                className="bg-success hover:bg-success"
              >
                {actionLoading ? 'Processing...' : (selectedTenant?.status === 'suspended' ? 'Reactivate' : 'Approve')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suspend Dialog */}
        <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Suspend Tenant
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to suspend <strong>{selectedTenant?.name}</strong>?
                All users from this tenant will be unable to log in.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-destructive/5 rounded-lg my-4 border border-destructive/20">
              <p className="text-sm text-destructive">
                <strong>Warning:</strong> This action will immediately prevent all users from accessing the platform. 
                You can reactivate the tenant later.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSuspendDialog(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button 
                onClick={handleSuspendTenant} 
                disabled={actionLoading}
                variant="destructive"
              >
                {actionLoading ? 'Processing...' : 'Suspend Tenant'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Tenant Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Add New Tenant
              </DialogTitle>
              <DialogDescription>
                Create a new college/institution tenant. An admin account will be created automatically.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleAddTenant} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tenant Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-foreground border-b pb-2">Tenant Information</h3>
                  
                  <div>
                    <Label htmlFor="tenant_id">Tenant ID *</Label>
                    <Input
                      id="tenant_id"
                      value={newTenant.tenant_id}
                      onChange={(e) => setNewTenant({...newTenant, tenant_id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
                      placeholder="e.g., stanford_college"
                      required
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, underscores only</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="tenant_name">College Name *</Label>
                    <Input
                      id="tenant_name"
                      value={newTenant.tenant_name}
                      onChange={(e) => setNewTenant({...newTenant, tenant_name: e.target.value})}
                      placeholder="e.g., Stanford Residential College"
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="domain">Email Domain *</Label>
                    <Input
                      id="domain"
                      value={newTenant.domain}
                      onChange={(e) => setNewTenant({...newTenant, domain: e.target.value.toLowerCase()})}
                      placeholder="e.g., stanford.edu"
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contact_email">Contact Email *</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={newTenant.contact_email}
                      onChange={(e) => setNewTenant({...newTenant, contact_email: e.target.value})}
                      placeholder="admin@stanford.edu"
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="capacity">User Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="50"
                      max="2000"
                      value={newTenant.capacity}
                      onChange={(e) => setNewTenant({...newTenant, capacity: parseInt(e.target.value) || 500})}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                {/* Admin Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-foreground border-b pb-2">Admin Account</h3>
                  
                  <div>
                    <Label htmlFor="admin_first_name">First Name *</Label>
                    <Input
                      id="admin_first_name"
                      value={newTenant.admin_first_name}
                      onChange={(e) => setNewTenant({...newTenant, admin_first_name: e.target.value})}
                      placeholder="John"
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="admin_last_name">Last Name *</Label>
                    <Input
                      id="admin_last_name"
                      value={newTenant.admin_last_name}
                      onChange={(e) => setNewTenant({...newTenant, admin_last_name: e.target.value})}
                      placeholder="Smith"
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="admin_email">Admin Email *</Label>
                    <Input
                      id="admin_email"
                      type="email"
                      value={newTenant.admin_email}
                      onChange={(e) => setNewTenant({...newTenant, admin_email: e.target.value})}
                      placeholder="john.smith@stanford.edu"
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="admin_password">Admin Password *</Label>
                    <Input
                      id="admin_password"
                      type="password"
                      value={newTenant.admin_password}
                      onChange={(e) => setNewTenant({...newTenant, admin_password: e.target.value})}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
              
              {/* Branding */}
              <div className="space-y-4 pt-2">
                <h3 className="font-semibold text-sm text-foreground border-b pb-2 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Branding
                </h3>
                <div>
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={newTenant.logo_url}
                    onChange={(e) => setNewTenant({...newTenant, logo_url: e.target.value})}
                    placeholder="https://yourcollegewebsite.edu/logo.png"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Direct link to the college logo image (PNG or SVG recommended)</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primary_color">Primary Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        id="primary_color"
                        type="color"
                        value={newTenant.primary_color}
                        onChange={(e) => setNewTenant({...newTenant, primary_color: e.target.value})}
                        className="h-9 w-12 rounded border border-border cursor-pointer p-0.5 bg-white"
                      />
                      <Input
                        value={newTenant.primary_color}
                        onChange={(e) => setNewTenant({...newTenant, primary_color: e.target.value})}
                        placeholder="#3b82f6"
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="secondary_color">Secondary Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        id="secondary_color"
                        type="color"
                        value={newTenant.secondary_color}
                        onChange={(e) => setNewTenant({...newTenant, secondary_color: e.target.value})}
                        className="h-9 w-12 rounded border border-border cursor-pointer p-0.5 bg-white"
                      />
                      <Input
                        value={newTenant.secondary_color}
                        onChange={(e) => setNewTenant({...newTenant, secondary_color: e.target.value})}
                        placeholder="#1f2937"
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
                {newTenant.logo_url && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                    <img
                      src={newTenant.logo_url}
                      alt="Logo preview"
                      className="h-10 w-10 object-contain rounded"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-16 rounded"
                        style={{ background: newTenant.primary_color }}
                        title="Primary"
                      />
                      <div
                        className="h-6 w-16 rounded"
                        style={{ background: newTenant.secondary_color }}
                        title="Secondary"
                      />
                    </div>
                  </div>
                )}
                {!newTenant.logo_url && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                    <div
                      className="h-6 w-16 rounded"
                      style={{ background: newTenant.primary_color }}
                      title="Primary"
                    />
                    <div
                      className="h-6 w-16 rounded"
                      style={{ background: newTenant.secondary_color }}
                      title="Secondary"
                    />
                    <span className="text-xs text-muted-foreground">Color preview</span>
                  </div>
                )}
              </div>

              {/* Enabled Modules */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-semibold text-sm text-foreground">
                    Enabled Modules ({newTenant.enabled_modules.length}/{ALL_MODULES.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewTenant(p => ({...p, enabled_modules: ALL_MODULES.map(m => m.id)}))}
                      className="text-xs text-primary hover:underline"
                    >All</button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setNewTenant(p => ({...p, enabled_modules: []}))}
                      className="text-xs text-muted-foreground hover:underline"
                    >None</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_MODULES.map(mod => {
                    const active = newTenant.enabled_modules.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggleModule(mod.id)}
                        className={`text-xs px-2 py-1.5 rounded-md border text-left transition-colors ${
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        {mod.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg border border-border text-sm text-foreground">
                <strong>Note:</strong> The tenant will be created with "Pending" status. You'll need to approve it to activate the admin account.
              </div>
              
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)} disabled={addLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addLoading}>
                  {addLoading ? 'Creating...' : 'Create Tenant'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Contact Person Dialog */}
        <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Change Contact Person
              </DialogTitle>
              <DialogDescription>
                Update the contact (admin) person for <strong>{selectedTenant?.name}</strong>. 
                This will also update the admin user account for this college.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdateContact} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="contact_name">Contact Person Name *</Label>
                <Input
                  id="contact_name"
                  data-testid="contact-person-name-input"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="e.g., Jane Smith"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="contact_email">Contact Person Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  data-testid="contact-person-email-input"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="e.g., jane@college.edu"
                  required
                  className="mt-1"
                />
              </div>

              <div className="p-3 bg-muted rounded-lg border border-border text-sm text-foreground">
                <strong>Note:</strong> If the email changes, the admin login credentials for this college will be updated to use the new email.
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowContactDialog(false)} disabled={contactLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={contactLoading} data-testid="save-contact-person-btn">
                  {contactLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TenantManagement;
