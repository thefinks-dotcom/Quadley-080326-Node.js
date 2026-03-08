'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Palette,
  Type,
  Image,
  Layout,
  Mail,
  Eye,
  Save,
  RotateCcw,
  CheckCircle,
  Sparkles,
  Building2,
  RefreshCw,
  X,
  ChevronRight,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Available fonts
const FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins',
  'Montserrat', 'Source Sans Pro', 'Nunito', 'Raleway',
  'Playfair Display', 'system-ui'
];

const BrandingPreviewPanel = ({ tenant, onClose, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState(null);
  const [originalBranding, setOriginalBranding] = useState(null);
  const [presets, setPresets] = useState({});
  const [activePreviewTab, setActivePreviewTab] = useState('login');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch branding data
  useEffect(() => {
    if (tenant?.code) {
      fetchBranding();
      fetchPresets();
    }
  }, [tenant?.code]);

  // Track changes
  useEffect(() => {
    if (branding && originalBranding) {
      const changed = JSON.stringify(branding) !== JSON.stringify(originalBranding);
      setHasChanges(changed);
    }
  }, [branding, originalBranding]);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/branding/tenant/${tenant.code}`, {
        withCredentials: true
      });
      setBranding(response.data.branding);
      setOriginalBranding(response.data.branding);
    } catch (error) {
      console.error('Failed to fetch branding:', error);
      toast.error('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await axios.get(`${API}/api/branding/presets`);
      // Convert array to object for easier access
      const presetsArray = response.data.presets || [];
      const presetsObj = {};
      presetsArray.forEach(preset => {
        presetsObj[preset.id] = {
          name: preset.name,
          description: preset.description,
          preview_color: preset.preview?.primary_color || '#3B82F6'
        };
      });
      setPresets(presetsObj);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  };

  const updateBranding = useCallback((field, value) => {
    setBranding(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const saveBranding = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/api/branding/tenant/${tenant.code}`, branding, {
        withCredentials: true
      });
      setOriginalBranding(branding);
      toast.success('Branding saved successfully!');
      if (onSave) onSave(branding);
    } catch (error) {
      console.error('Failed to save branding:', error);
      toast.error('Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = async (presetId) => {
    try {
      setSaving(true);
      const response = await axios.post(
        `${API}/api/branding/tenant/${tenant.code}/apply-preset`,
        { preset_id: presetId },
        { withCredentials: true }
      );
      setBranding(response.data.branding);
      setOriginalBranding(response.data.branding);
      toast.success(`Applied "${presets[presetId]?.name}" preset!`);
    } catch (error) {
      console.error('Failed to apply preset:', error);
      toast.error('Failed to apply preset');
    } finally {
      setSaving(false);
    }
  };

  const resetBranding = async () => {
    try {
      setSaving(true);
      const response = await axios.post(
        `${API}/api/branding/tenant/${tenant.code}/reset`,
        {},
        { withCredentials: true }
      );
      setBranding(response.data.branding);
      setOriginalBranding(response.data.branding);
      toast.success('Branding reset to defaults');
    } catch (error) {
      console.error('Failed to reset branding:', error);
      toast.error('Failed to reset branding');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setBranding(originalBranding);
    toast.info('Changes discarded');
  };

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/80">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Palette className="w-5 h-5 text-primary" />
                Brand Customization - {tenant?.name}
              </DialogTitle>
              <DialogDescription>
                Customize the look and feel of your portal
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                  Unsaved Changes
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex h-[calc(90vh-140px)]">
          {/* Left Panel - Settings */}
          <div className="w-[400px] border-r bg-white overflow-hidden flex flex-col">
            <Tabs defaultValue="colors" className="flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-4 h-12 rounded-none border-b bg-muted">
                <TabsTrigger value="colors" className="data-[state=active]:bg-white rounded-none">
                  <Palette className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="typography" className="data-[state=active]:bg-white rounded-none">
                  <Type className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="identity" className="data-[state=active]:bg-white rounded-none">
                  <Image className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="login" className="data-[state=active]:bg-white rounded-none">
                  <Layout className="w-4 h-4" />
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  {/* Colors Tab */}
                  <TabsContent value="colors" className="mt-0 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Wand2 className="w-4 h-4" />
                        Quick Presets
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(presets).map(([id, preset]) => (
                          <button
                            key={id}
                            onClick={() => applyPreset(id)}
                            className="p-3 rounded-lg border hover:border-primary hover:bg-info/10 transition-all text-left"
                            disabled={saving}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: preset.preview_color }}
                              />
                              <span className="text-sm font-medium">{preset.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{preset.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Primary Colors</h3>
                      <div className="space-y-3">
                        <ColorPicker
                          label="Primary Color"
                          value={branding?.primary_color || '#3B82F6'}
                          onChange={(v) => updateBranding('primary_color', v)}
                        />
                        <ColorPicker
                          label="Secondary Color"
                          value={branding?.secondary_color || '#6366F1'}
                          onChange={(v) => updateBranding('secondary_color', v)}
                        />
                        <ColorPicker
                          label="Background"
                          value={branding?.background_color || '#FFFFFF'}
                          onChange={(v) => updateBranding('background_color', v)}
                        />
                        <ColorPicker
                          label="Text Color"
                          value={branding?.text_color || '#1F2937'}
                          onChange={(v) => updateBranding('text_color', v)}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">UI Elements</h3>
                      <div className="space-y-3">
                        <ColorPicker
                          label="Header Background"
                          value={branding?.header_bg_color || '#1F2937'}
                          onChange={(v) => updateBranding('header_bg_color', v)}
                        />
                        <ColorPicker
                          label="Header Text"
                          value={branding?.header_text_color || '#FFFFFF'}
                          onChange={(v) => updateBranding('header_text_color', v)}
                        />
                        <ColorPicker
                          label="Button Color"
                          value={branding?.button_color || '#3B82F6'}
                          onChange={(v) => updateBranding('button_color', v)}
                        />
                        <ColorPicker
                          label="Link Color"
                          value={branding?.link_color || '#3B82F6'}
                          onChange={(v) => updateBranding('link_color', v)}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Status Colors</h3>
                      <div className="space-y-3">
                        <ColorPicker
                          label="Success"
                          value={branding?.success_color || '#10B981'}
                          onChange={(v) => updateBranding('success_color', v)}
                        />
                        <ColorPicker
                          label="Warning"
                          value={branding?.warning_color || '#F59E0B'}
                          onChange={(v) => updateBranding('warning_color', v)}
                        />
                        <ColorPicker
                          label="Error"
                          value={branding?.error_color || '#EF4444'}
                          onChange={(v) => updateBranding('error_color', v)}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Typography Tab */}
                  <TabsContent value="typography" className="mt-0 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Fonts</h3>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Heading Font</Label>
                          <Select
                            value={branding?.heading_font || 'Inter'}
                            onValueChange={(v) => updateBranding('heading_font', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FONTS.map((font) => (
                                <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                                  {font}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Body Font</Label>
                          <Select
                            value={branding?.body_font || 'Inter'}
                            onValueChange={(v) => updateBranding('body_font', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FONTS.map((font) => (
                                <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                                  {font}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Theme</h3>
                      <p className="text-xs text-muted-foreground">Light mode only</p>
                    </div>
                  </TabsContent>

                  {/* Identity Tab */}
                  <TabsContent value="identity" className="mt-0 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Brand Identity</h3>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">App Name</Label>
                          <Input
                            value={branding?.app_name || ''}
                            onChange={(e) => updateBranding('app_name', e.target.value)}
                            placeholder={tenant?.name || 'Your App Name'}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Tagline</Label>
                          <Input
                            value={branding?.tagline || ''}
                            onChange={(e) => updateBranding('tagline', e.target.value)}
                            placeholder="Your campus, your community"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Logos</h3>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Logo</Label>
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file && tenant?.code) {
                                  try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    const response = await axios.post(
                                      `${API}/api/tenants/${tenant.code}/logo`,
                                      formData,
                                      { 
                                        headers: { 'Content-Type': 'multipart/form-data' },
                                        withCredentials: true 
                                      }
                                    );
                                    updateBranding('logo_url', response.data.logo_url);
                                    toast.success('Logo uploaded successfully');
                                  } catch (error) {
                                    toast.error('Failed to upload logo');
                                  }
                                }
                              }}
                              className="text-sm"
                              data-testid="logo-upload-input"
                            />
                            <span className="text-xs text-muted-foreground">Or enter URL:</span>
                            <Input
                              value={branding?.logo_url || ''}
                              onChange={(e) => updateBranding('logo_url', e.target.value)}
                              placeholder="https://..."
                            />
                          </div>
                          {branding?.logo_url && (
                            <div className="mt-2 p-2 bg-muted rounded-lg">
                              <img
                                src={branding.logo_url.startsWith('/api') ? `${API}${branding.logo_url.replace('/api', '')}` : branding.logo_url}
                                alt="Logo preview"
                                className="h-8 object-contain"
                                onError={(e) => e.target.style.display = 'none'}
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Favicon URL</Label>
                          <Input
                            value={branding?.favicon_url || ''}
                            onChange={(e) => updateBranding('favicon_url', e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Login Page Tab */}
                  <TabsContent value="login" className="mt-0 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Login Page</h3>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Welcome Text</Label>
                          <Input
                            value={branding?.login_welcome_text || ''}
                            onChange={(e) => updateBranding('login_welcome_text', e.target.value)}
                            placeholder="Welcome back!"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Footer Text</Label>
                          <Input
                            value={branding?.login_footer_text || ''}
                            onChange={(e) => updateBranding('login_footer_text', e.target.value)}
                            placeholder="© 2025 Your College"
                          />
                        </div>
                        <ColorPicker
                          label="Background Color"
                          value={branding?.login_bg_color || '#F3F4F6'}
                          onChange={(v) => updateBranding('login_bg_color', v)}
                        />
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Background Image URL</Label>
                          <Input
                            value={branding?.login_bg_image || ''}
                            onChange={(e) => updateBranding('login_bg_image', e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Show &quot;Powered by Quadley&quot;</Label>
                          <Switch
                            checked={branding?.show_powered_by !== false}
                            onCheckedChange={(v) => updateBranding('show_powered_by', v)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Email Branding</h3>
                      <div className="space-y-3">
                        <ColorPicker
                          label="Email Header Background"
                          value={branding?.email_header_bg || '#3B82F6'}
                          onChange={(v) => updateBranding('email_header_bg', v)}
                        />
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Email Logo URL</Label>
                          <Input
                            value={branding?.email_logo_url || ''}
                            onChange={(e) => updateBranding('email_logo_url', e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Email Footer Text</Label>
                          <Input
                            value={branding?.email_footer_text || ''}
                            onChange={(e) => updateBranding('email_footer_text', e.target.value)}
                            placeholder="© 2025 Your College. All rights reserved."
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 bg-muted overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Live Preview</span>
              </div>
              <div className="flex gap-1">
                {['login', 'dashboard', 'email'].map((tab) => (
                  <Button
                    key={tab}
                    variant={activePreviewTab === tab ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActivePreviewTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              {activePreviewTab === 'login' && (
                <LoginPreview branding={branding} tenantName={tenant?.name} />
              )}
              {activePreviewTab === 'dashboard' && (
                <DashboardPreview branding={branding} tenantName={tenant?.name} />
              )}
              {activePreviewTab === 'email' && (
                <EmailPreview branding={branding} tenantName={tenant?.name} />
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/80">
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={resetBranding} disabled={saving}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              {hasChanges && (
                <Button variant="ghost" onClick={discardChanges} disabled={saving}>
                  Discard
                </Button>
              )}
              <Button onClick={saveBranding} disabled={saving || !hasChanges}>
                {saving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Color Picker Component
const ColorPicker = ({ label, value, onChange }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground mb-1">{label}</Label>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-10 h-10"
            />
            <div
              className="w-10 h-10 rounded-lg border-2 border-border cursor-pointer"
              style={{ backgroundColor: value }}
            />
          </div>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 font-mono text-sm uppercase"
            maxLength={7}
          />
        </div>
      </div>
    </div>
  );
};

// Login Page Preview
const LoginPreview = ({ branding, tenantName }) => {
  const styles = {
    container: {
      backgroundColor: branding?.login_bg_color || '#F3F4F6',
      backgroundImage: branding?.login_bg_image ? `url(${branding.login_bg_image})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      fontFamily: branding?.body_font || 'Inter',
    },
    card: {
      backgroundColor: branding?.background_color || '#FFFFFF',
      color: branding?.text_color || '#1F2937',
    },
    button: {
      backgroundColor: branding?.button_color || branding?.primary_color || '#3B82F6',
      color: branding?.button_text_color || '#FFFFFF',
    },
    link: {
      color: branding?.link_color || branding?.primary_color || '#3B82F6',
    },
    heading: {
      fontFamily: branding?.heading_font || 'Inter',
    }
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border" style={{ minHeight: 500 }}>
      <div className="h-full flex items-center justify-center p-8" style={styles.container}>
        <div className="w-full max-w-md p-8 rounded-2xl shadow-xl" style={styles.card}>
          {/* Logo */}
          <div className="text-center mb-8">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt="Logo"
                className="h-12 mx-auto mb-4 object-contain"
                onError={(e) => e.target.style.display = 'none'}
              />
            ) : (
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center"
                   style={{ backgroundColor: branding?.primary_color || '#3B82F6' }}>
                <Building2 className="w-8 h-8 text-white" />
              </div>
            )}
            <h1 className="text-2xl font-bold" style={styles.heading}>
              {branding?.app_name || tenantName || 'Welcome'}
            </h1>
            {branding?.tagline && (
              <p className="text-sm text-muted-foreground mt-1">{branding.tagline}</p>
            )}
            {branding?.login_welcome_text && (
              <p className="mt-4 text-muted-foreground">{branding.login_welcome_text}</p>
            )}
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                placeholder="you@example.com"
                style={{ borderColor: '#D1D5DB', '--tw-ring-color': branding?.primary_color || '#3B82F6' }}
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                placeholder="••••••••"
                style={{ borderColor: '#D1D5DB' }}
                disabled
              />
            </div>
            <button
              className="w-full py-3 rounded-lg font-medium transition-transform hover:scale-[1.02]"
              style={styles.button}
            >
              Sign In
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm">
            <a href="#" style={styles.link} className="hover:underline">
              Forgot password?
            </a>
          </div>

          {branding?.show_powered_by !== false && (
            <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
              Powered by Quadley
            </div>
          )}

          {branding?.login_footer_text && (
            <div className="mt-4 text-center text-xs text-muted-foreground">
              {branding.login_footer_text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Dashboard Preview
const DashboardPreview = ({ branding, tenantName }) => {
  const styles = {
    header: {
      backgroundColor: branding?.header_bg_color || '#1F2937',
      color: branding?.header_text_color || '#FFFFFF',
    },
    sidebar: {
      backgroundColor: branding?.sidebar_bg_color || '#111827',
      color: branding?.sidebar_text_color || '#FFFFFF',
    },
    body: {
      backgroundColor: branding?.background_color || '#F9FAFB',
      color: branding?.text_color || '#1F2937',
      fontFamily: branding?.body_font || 'Inter',
    },
    card: {
      backgroundColor: '#FFFFFF',
    },
    primary: {
      backgroundColor: branding?.primary_color || '#3B82F6',
    },
    heading: {
      fontFamily: branding?.heading_font || 'Inter',
    }
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border" style={{ minHeight: 500 }}>
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between" style={styles.header}>
        <div className="flex items-center gap-3">
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt="Logo"
              className="h-8 object-contain"
              onError={(e) => e.target.style.display = 'none'}
            />
          ) : (
            <div className="w-8 h-8 rounded flex items-center justify-center" style={styles.primary}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="font-semibold" style={styles.heading}>
            {branding?.app_name || tenantName || 'Dashboard'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
            JD
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex" style={{ minHeight: 436 }}>
        {/* Sidebar */}
        <div className="w-48 p-3" style={styles.sidebar}>
          <nav className="space-y-1">
            {['Dashboard', 'Events', 'Messages', 'Jobs', 'Settings'].map((item, i) => (
              <div
                key={item}
                className={`px-3 py-2 rounded-lg text-sm ${i === 0 ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                {item}
              </div>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6" style={styles.body}>
          <h1 className="text-2xl font-bold mb-6" style={styles.heading}>
            Welcome back!
          </h1>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Events', value: '12', color: branding?.primary_color || '#3B82F6' },
              { label: 'Messages', value: '24', color: branding?.secondary_color || '#6366F1' },
              { label: 'Jobs', value: '8', color: branding?.primary_color || '#3B82F6' }
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl" style={styles.card}>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl" style={styles.card}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded" style={{ backgroundColor: branding?.secondary_color || '#6366F1' }} />
              <h2 className="font-semibold" style={styles.heading}>Recent Activity</h2>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted">
                  <div className="w-2 h-2 rounded-full" style={styles.primary} />
                  <span className="text-sm text-muted-foreground">New event created</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Email Preview
const EmailPreview = ({ branding, tenantName }) => {
  const styles = {
    header: {
      backgroundColor: branding?.email_header_bg || branding?.primary_color || '#3B82F6',
    },
    body: {
      fontFamily: branding?.body_font || 'Inter',
    }
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border bg-muted p-8" style={{ minHeight: 500 }}>
      <div className="max-w-lg mx-auto bg-white rounded-lg overflow-hidden shadow-lg" style={styles.body}>
        {/* Email Header */}
        <div className="p-6 text-center text-white" style={styles.header}>
          {branding?.email_logo_url ? (
            <img
              src={branding.email_logo_url}
              alt="Logo"
              className="h-10 mx-auto object-contain"
              onError={(e) => e.target.style.display = 'none'}
            />
          ) : branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt="Logo"
              className="h-10 mx-auto object-contain"
              onError={(e) => e.target.style.display = 'none'}
            />
          ) : (
            <div className="w-12 h-12 mx-auto bg-white/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
          )}
          <h1 className="text-xl font-bold mt-3">
            {branding?.app_name || tenantName || 'Notification'}
          </h1>
        </div>

        {/* Email Body */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-3">Welcome to the community!</h2>
          <p className="text-muted-foreground mb-4">
            Thanks for joining {branding?.app_name || tenantName || 'our platform'}. 
            We&apos;re excited to have you on board.
          </p>
          <p className="text-muted-foreground mb-6">
            Click the button below to get started with your account.
          </p>
          <button
            className="w-full py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: branding?.button_color || branding?.primary_color || '#3B82F6' }}
          >
            Get Started
          </button>
        </div>

        {/* Email Footer */}
        <div className="p-4 bg-muted text-center text-xs text-muted-foreground border-t">
          {branding?.email_footer_text || `© 2025 ${tenantName || 'Quadley'}. All rights reserved.`}
        </div>
      </div>
    </div>
  );
};

export default BrandingPreviewPanel;
