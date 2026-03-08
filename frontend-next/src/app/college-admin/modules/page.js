'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  LayoutGrid,
  Home,
  MessageSquare,
  Calendar,
  Utensils,
  Wrench,
  BookOpen,
  Heart,
  Award,
  Building,
  Briefcase,
  Users,
  Shield,
  Save,
  Info,
  Bell,
  Cake,
  DollarSign,
  AlertTriangle,
  UserCog,
  Pencil
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

const ModuleSettings = () => {
  const router = useRouter();
  const [modules, setModules] = useState([
    { id: 'home', name: 'Home', icon: Home, enabled: true, required: true, description: 'Main dashboard and overview' },
    { id: 'messages', name: 'Messages', icon: MessageSquare, enabled: true, required: false, description: 'Direct and group messaging' },
    { id: 'events', name: 'Events', icon: Calendar, enabled: true, required: false, description: 'College events and RSVPs' },
    { id: 'announcements', name: 'Announcements', icon: Bell, enabled: true, required: false, description: 'College-wide announcements' },
    { id: 'dining', name: 'Dining', icon: Utensils, enabled: true, required: false, description: 'Menu and late meal requests' },
    { id: 'floor', name: 'Floor Community', icon: Building, enabled: true, required: false, description: 'Floor-specific content' },
    { id: 'co-curricular', name: 'Co-curricular', icon: Users, enabled: true, required: false, description: 'Clubs and activities' },
    { id: 'birthdays', name: 'Birthdays', icon: Cake, enabled: true, required: false, description: 'Resident birthday celebrations' },
    { id: 'academics', name: 'Academics', icon: BookOpen, enabled: true, required: false, description: 'Study groups and tutoring' },
    { id: 'recognition', name: 'Recognition', icon: Award, enabled: true, required: false, description: 'Shoutouts and kudos' },
    { id: 'opportunities', name: 'Job Opportunities', icon: Briefcase, enabled: true, required: false, description: 'Jobs and RA applications' },
    { id: 'maintenance', name: 'Services', icon: Wrench, enabled: true, required: false, description: 'Maintenance requests' },
    { id: 'wellbeing-safety', name: 'Wellbeing & Safety', icon: Heart, enabled: true, required: false, description: 'Wellbeing resources, incident reporting & safe disclosure' }
  ]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Contact Person State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [tenantCode, setTenantCode] = useState('');

  useEffect(() => {
    fetchTenantInfo();
  }, []);

  const fetchTenantInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/api/tenants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.length > 0) {
        const t = res.data[0];
        setContactName(t.contact_person_name || '');
        setContactEmail(t.contact_person_email || '');
        setTenantCode(t.code || '');
      }
    } catch (err) {
      console.error('Failed to fetch tenant info', err);
    }
  };

  const handleSaveContact = async () => {
    if (!contactName.trim() || !contactEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setContactSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/tenants/${tenantCode}/contact-person`,
        { contact_person_name: contactName, contact_person_email: contactEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Contact person updated!');
      setEditingContact(false);
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update contact person');
    } finally {
      setContactSaving(false);
    }
  };

  const toggleModule = (moduleId) => {
    setModules(prev => prev.map(m => 
      m.id === moduleId && !m.required ? { ...m, enabled: !m.enabled } : m
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Save to backend
      await new Promise(r => setTimeout(r, 500));
      toast.success('Module settings saved!');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = modules.filter(m => m.enabled).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/college-admin')} variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Module Settings</h1>
              <p className="text-muted-foreground text-sm">{enabledCount} of {modules.length} modules enabled</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 bg-muted border-border">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Configure Resident Experience</p>
                <p className="text-sm text-primary">Enable or disable modules that residents can see in their app. Required modules cannot be disabled.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module) => (
            <Card 
              key={module.id}
              className={`cursor-pointer transition-all ${
                module.enabled 
                  ? 'border-success bg-success/10/50' 
                  : 'border-border bg-muted/50 opacity-60'
              } ${module.required ? 'cursor-not-allowed' : 'hover:shadow-md'}`}
              onClick={() => !module.required && toggleModule(module.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${module.enabled ? 'bg-success/10' : 'bg-muted'}`}>
                      <module.icon className={`h-5 w-5 ${module.enabled ? 'text-success' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{module.name}</h3>
                        {module.required && (
                          <Badge className="bg-muted text-muted-foreground text-xs">Required</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{module.description}</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors ${
                    module.enabled ? 'bg-success' : 'bg-muted'
                  } ${module.required ? 'opacity-50' : ''}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform mt-0.5 ${
                      module.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact Person Section */}
        <Card className="mt-8" data-testid="contact-person-section">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserCog className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Contact Person</CardTitle>
                  <CardDescription>The primary admin contact for this college</CardDescription>
                </div>
              </div>
              {!editingContact && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingContact(true)}
                  data-testid="edit-contact-btn"
                  className="text-primary border-border hover:bg-muted"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingContact ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="admin-contact-name">Name</Label>
                  <Input
                    id="admin-contact-name"
                    data-testid="admin-contact-name-input"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contact person name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="admin-contact-email">Email</Label>
                  <Input
                    id="admin-contact-email"
                    type="email"
                    data-testid="admin-contact-email-input"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Contact person email"
                    className="mt-1"
                  />
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border text-sm text-foreground">
                  <strong>Note:</strong> Changing the email will update the admin login credentials for this college.
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setEditingContact(false); fetchTenantInfo(); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveContact} disabled={contactSaving} data-testid="save-admin-contact-btn">
                    {contactSaving ? 'Saving...' : 'Save Contact'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{contactName || 'Not set'}</span>
                </p>
                <p className="text-sm text-muted-foreground">{contactEmail || 'No email set'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ModuleSettings;
