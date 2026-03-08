'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Shield,
  Key,
  Globe,
  CheckCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  Settings,
  Users,
  Lock
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = '';

const PROVIDER_ICONS = {
  azure_ad: '🔷',
  okta: '🟣',
  google: '🔴',
  custom: '⚙️'
};

const PROVIDER_COLORS = {
  azure_ad: 'bg-muted text-foreground',
  okta: 'bg-muted text-foreground',
  google: 'bg-destructive/10 text-destructive',
  custom: 'bg-muted text-foreground'
};

const SSOConfiguration = () => {
  const router = useRouter();
  const { tenantCode: urlTenantCode } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [providers, setProviders] = useState({});
  const [tenantName, setTenantName] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [spMetadata, setSpMetadata] = useState({});
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [tenantCode, setTenantCode] = useState(urlTenantCode || '');
  
  const [config, setConfig] = useState({
    enabled: false,
    provider: 'google',
    provider_name: '',
    oauth_client_id: '',
    oauth_client_secret: '',
    oauth_authorize_url: '',
    oauth_token_url: '',
    oauth_userinfo_url: '',
    oauth_scopes: ['openid', 'email', 'profile'],
    auto_provision: true,
    default_role: 'student',
    allowed_domains: [],
    require_sso: false,
    allow_password_fallback: true
  });

  const [domainInput, setDomainInput] = useState('');

  // Get tenant code from user context if not in URL (for college admins)
  useEffect(() => {
    const fetchUserTenant = async () => {
      if (!urlTenantCode) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.tenant_code) {
            setTenantCode(response.data.tenant_code);
          }
        } catch (error) {
          console.error('Failed to fetch user tenant:', error);
        }
      }
    };
    fetchUserTenant();
  }, [urlTenantCode]);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/sso/providers`);
      setProviders(response.data.providers || {});
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  }, []);

  const fetchSSOConfig = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/sso/tenant/${tenantCode}/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTenantName(response.data.tenant_name || tenantCode);
      setCallbackUrl(response.data.callback_url || '');
      setSpMetadata(response.data.sp_metadata || {});
      
      if (response.data.sso_config) {
        setConfig(prev => ({
          ...prev,
          ...response.data.sso_config,
          oauth_client_secret: '' // Don't show masked value
        }));
      }
    } catch (error) {
      toast.error('Failed to fetch SSO configuration');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [tenantCode]);

  useEffect(() => {
    fetchProviders();
    if (tenantCode) {
      fetchSSOConfig();
    }
  }, [fetchProviders, fetchSSOConfig, tenantCode]);

  const handleProviderSelect = (providerId) => {
    const template = providers[providerId];
    if (template) {
      setSelectedProvider(providerId);
      setShowSetupDialog(true);
    }
  };

  const handleQuickSetup = (clientId, clientSecret, tenantId, domain) => {
    const template = providers[selectedProvider];
    if (!template) return;

    let authorizeUrl = template.oauth_authorize_url || '';
    let tokenUrl = template.oauth_token_url || '';
    let userinfoUrl = template.oauth_userinfo_url || '';

    // Replace placeholders
    if (selectedProvider === 'azure_ad' && tenantId) {
      authorizeUrl = authorizeUrl.replace('{tenant_id}', tenantId);
      tokenUrl = tokenUrl.replace('{tenant_id}', tenantId);
    } else if (selectedProvider === 'okta' && domain) {
      authorizeUrl = authorizeUrl.replace('{domain}', domain);
      tokenUrl = tokenUrl.replace('{domain}', domain);
      userinfoUrl = userinfoUrl.replace('{domain}', domain);
    }

    setConfig(prev => ({
      ...prev,
      provider: selectedProvider,
      provider_name: template.provider_name || selectedProvider,
      oauth_client_id: clientId,
      oauth_client_secret: clientSecret,
      oauth_authorize_url: authorizeUrl,
      oauth_token_url: tokenUrl,
      oauth_userinfo_url: userinfoUrl,
      oauth_scopes: template.oauth_scopes || ['openid', 'email', 'profile']
    }));

    setShowSetupDialog(false);
    toast.success(`${template.provider_name} configuration applied`);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      // Only send non-empty values
      const updates = {};
      Object.entries(config).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          updates[key] = value;
        }
      });

      await axios.put(`${API}/api/sso/tenant/${tenantCode}/config`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('SSO configuration saved');
      fetchSSOConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.enabled) {
      toast.error('Enable SSO first to test the connection');
      return;
    }

    try {
      setTesting(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/sso/tenant/${tenantCode}/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('SSO configuration is valid');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'SSO test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleAddDomain = () => {
    if (domainInput && !config.allowed_domains.includes(domainInput)) {
      setConfig(prev => ({
        ...prev,
        allowed_domains: [...prev.allowed_domains, domainInput.toLowerCase()]
      }));
      setDomainInput('');
    }
  };

  const handleRemoveDomain = (domain) => {
    setConfig(prev => ({
      ...prev,
      allowed_domains: prev.allowed_domains.filter(d => d !== domain)
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            data-testid="back-button"
            className="hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">SSO Configuration</h1>
            <p className="text-muted-foreground">{tenantName} ({tenantCode})</p>
          </div>
        </div>

        {/* Quick Setup */}
        <Card data-testid="quick-setup-card" className="bg-white border border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Quick Setup
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Choose a provider to automatically configure OAuth/OIDC settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(providers).map(([id, provider]) => (
                <Button
                  key={id}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-2 border-border hover:border-border hover:bg-muted transition-all"
                  onClick={() => handleProviderSelect(id)}
                  data-testid={`provider-${id}`}
                >
                  <span className="text-2xl">{PROVIDER_ICONS[id] || '🔐'}</span>
                  <span className="font-medium text-foreground">{provider.name}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Callback URL */}
        <Card data-testid="callback-url-card" className="bg-white border border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Globe className="h-5 w-5 text-muted-foreground" />
              Callback URL
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Use this URL when configuring your identity provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg border border-border">
              <code className="flex-1 text-sm break-all text-foreground font-mono">{callbackUrl}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(callbackUrl)}
                data-testid="copy-callback-url"
                className="hover:bg-muted"
              >
                <Copy className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Configuration */}
        <Card data-testid="main-config-card" className="bg-white border border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Shield className="h-5 w-5 text-muted-foreground" />
              OAuth/OIDC Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable SSO */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable SSO</Label>
                <p className="text-sm text-muted-foreground">Allow users to sign in with SSO</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                data-testid="enable-sso-switch"
              />
            </div>

            {/* Provider Name */}
            <div className="space-y-2">
              <Label htmlFor="provider_name">Provider Display Name</Label>
              <Input
                id="provider_name"
                value={config.provider_name}
                onChange={(e) => setConfig(prev => ({ ...prev, provider_name: e.target.value }))}
                placeholder="e.g., University SSO"
                data-testid="provider-name-input"
              />
            </div>

            {/* Client ID */}
            <div className="space-y-2">
              <Label htmlFor="client_id">Client ID</Label>
              <Input
                id="client_id"
                value={config.oauth_client_id}
                onChange={(e) => setConfig(prev => ({ ...prev, oauth_client_id: e.target.value }))}
                placeholder="OAuth Client ID"
                data-testid="client-id-input"
              />
            </div>

            {/* Client Secret */}
            <div className="space-y-2">
              <Label htmlFor="client_secret">Client Secret</Label>
              <Input
                id="client_secret"
                type="password"
                value={config.oauth_client_secret}
                onChange={(e) => setConfig(prev => ({ ...prev, oauth_client_secret: e.target.value }))}
                placeholder="OAuth Client Secret (leave empty to keep existing)"
                data-testid="client-secret-input"
              />
            </div>

            {/* Authorization URL */}
            <div className="space-y-2">
              <Label htmlFor="authorize_url">Authorization URL</Label>
              <Input
                id="authorize_url"
                value={config.oauth_authorize_url}
                onChange={(e) => setConfig(prev => ({ ...prev, oauth_authorize_url: e.target.value }))}
                placeholder="https://provider.com/oauth2/authorize"
                data-testid="authorize-url-input"
              />
            </div>

            {/* Token URL */}
            <div className="space-y-2">
              <Label htmlFor="token_url">Token URL</Label>
              <Input
                id="token_url"
                value={config.oauth_token_url}
                onChange={(e) => setConfig(prev => ({ ...prev, oauth_token_url: e.target.value }))}
                placeholder="https://provider.com/oauth2/token"
                data-testid="token-url-input"
              />
            </div>

            {/* UserInfo URL */}
            <div className="space-y-2">
              <Label htmlFor="userinfo_url">UserInfo URL</Label>
              <Input
                id="userinfo_url"
                value={config.oauth_userinfo_url}
                onChange={(e) => setConfig(prev => ({ ...prev, oauth_userinfo_url: e.target.value }))}
                placeholder="https://provider.com/oauth2/userinfo"
                data-testid="userinfo-url-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* User Provisioning */}
        <Card data-testid="provisioning-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Provisioning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto Provision */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground font-medium">Auto-provision Users</Label>
                <p className="text-sm text-muted-foreground">Automatically create accounts on first SSO login</p>
              </div>
              <Switch
                checked={config.auto_provision}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, auto_provision: checked }))}
                data-testid="auto-provision-switch"
              />
            </div>

            {/* Default Role */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Default Role for New Users</Label>
              <Select
                value={config.default_role}
                onValueChange={(value) => setConfig(prev => ({ ...prev, default_role: value }))}
              >
                <SelectTrigger data-testid="default-role-select" className="h-11 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="ra">RA</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Allowed Domains */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Allowed Email Domains</Label>
              <p className="text-sm text-muted-foreground">Leave empty to allow all domains</p>
              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="e.g., university.edu"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  data-testid="domain-input"
                  className="h-11 border-border focus:border-border focus:ring-ring"
                />
                <Button onClick={handleAddDomain} variant="outline" data-testid="add-domain-btn" className="h-11 border-border hover:bg-muted">
                  Add
                </Button>
              </div>
              {config.allowed_domains.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {config.allowed_domains.map(domain => (
                    <Badge
                      key={domain}
                      variant="secondary"
                      className="cursor-pointer bg-muted text-foreground hover:bg-muted px-3 py-1"
                      onClick={() => handleRemoveDomain(domain)}
                    >
                      {domain} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card data-testid="security-card" className="bg-white border border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Require SSO */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground font-medium">Require SSO</Label>
                <p className="text-sm text-muted-foreground">Disable password login when SSO is active</p>
              </div>
              <Switch
                checked={config.require_sso}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, require_sso: checked }))}
                data-testid="require-sso-switch"
              />
            </div>

            {/* Password Fallback */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground font-medium">Allow Password Fallback</Label>
                <p className="text-sm text-muted-foreground">Allow password login as backup when SSO fails</p>
              </div>
              <Switch
                checked={config.allow_password_fallback}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, allow_password_fallback: checked }))}
                data-testid="password-fallback-switch"
              />
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        {config.enabled && (
          <Card data-testid="status-card" className="bg-white border border-border shadow-sm rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {config.status === 'active' ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-primary" />
                  )}
                  <span className="font-medium text-foreground">
                    Status: {config.status?.toUpperCase() || 'CONFIGURED'}
                  </span>
                </div>
                {config.last_login && (
                  <span className="text-sm text-muted-foreground">
                    Last SSO login: {new Date(config.last_login).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !config.enabled}
            data-testid="test-connection-btn"
            className="h-11 border-border text-foreground hover:bg-muted"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="save-config-btn"
            className="h-11 bg-primary hover:bg-primary text-white shadow-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Quick Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent data-testid="setup-dialog" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              {PROVIDER_ICONS[selectedProvider]} Setup {providers[selectedProvider]?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter your OAuth credentials from {providers[selectedProvider]?.name}
            </DialogDescription>
          </DialogHeader>
          
          <QuickSetupForm
            provider={selectedProvider}
            instructions={providers[selectedProvider]?.instructions || []}
            callbackUrl={callbackUrl}
            onSubmit={handleQuickSetup}
            onCancel={() => setShowSetupDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Quick Setup Form Component
const QuickSetupForm = ({ provider, instructions, callbackUrl, onSubmit, onCancel }) => {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [domain, setDomain] = useState('');

  const handleSubmit = () => {
    if (!clientId || !clientSecret) {
      toast.error('Client ID and Secret are required');
      return;
    }
    onSubmit(clientId, clientSecret, tenantId, domain);
  };

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="bg-muted p-4 rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-2">Setup Instructions:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          {instructions.map((instruction, i) => (
            <li key={i}>{instruction.replace('{callback_url}', callbackUrl)}</li>
          ))}
        </ol>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-foreground font-medium">Client ID *</Label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter Client ID"
            data-testid="setup-client-id"
            className="h-11 border-border focus:border-border focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground font-medium">Client Secret *</Label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Enter Client Secret"
            data-testid="setup-client-secret"
            className="h-11 border-border focus:border-border focus:ring-ring"
          />
        </div>

        {provider === 'azure_ad' && (
          <div className="space-y-2">
            <Label className="text-foreground font-medium">Azure Tenant ID *</Label>
            <Input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Enter Azure Directory (Tenant) ID"
              data-testid="setup-tenant-id"
              className="h-11 border-border focus:border-border focus:ring-ring"
            />
          </div>
        )}

        {provider === 'okta' && (
          <div className="space-y-2">
            <Label className="text-foreground font-medium">Okta Domain *</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g., your-org.okta.com"
              data-testid="setup-okta-domain"
              className="h-11 border-border focus:border-border focus:ring-ring"
            />
          </div>
        )}
      </div>

      <DialogFooter className="gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="h-11 border-border text-foreground hover:bg-muted">Cancel</Button>
        <Button onClick={handleSubmit} data-testid="setup-submit-btn" className="h-11 bg-primary hover:bg-primary text-white">
          Apply Configuration
        </Button>
      </DialogFooter>
    </div>
  );
};

export default SSOConfiguration;
