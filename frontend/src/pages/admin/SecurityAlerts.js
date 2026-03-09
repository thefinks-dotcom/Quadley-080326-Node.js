import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle,
  Globe,
  Zap,
  Settings,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const SEVERITY_STYLES = {
  critical: { bg: 'bg-destructive/5 border-destructive/20', text: 'text-destructive', badge: 'bg-destructive/10 text-destructive border-destructive/20' },
  high: { bg: 'bg-muted border-border', text: 'text-foreground', badge: 'bg-muted text-foreground border-border' },
  medium: { bg: 'bg-muted border-border', text: 'text-foreground', badge: 'bg-muted text-foreground border-border' },
  low: { bg: 'bg-muted border-border', text: 'text-primary', badge: 'bg-muted text-foreground border-border' },
};

const TYPE_LABELS = {
  new_ip: 'New IP Address',
  rapid_ip_change: 'Rapid IP Change',
  brute_force: 'Brute-Force Attempt',
};

const TYPE_ICONS = {
  new_ip: Globe,
  rapid_ip_change: Zap,
  brute_force: AlertTriangle,
};

function SecurityAlerts() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ severity: 'all', type: 'all', resolved: 'false' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const query = new URLSearchParams({ limit: '50', offset: '0' });
      if (filter.severity !== 'all') query.set('severity', filter.severity);
      if (filter.type !== 'all') query.set('alert_type', filter.type);
      if (filter.resolved !== 'all') query.set('resolved', filter.resolved);

      const [statsRes, alertsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/security/alerts/stats`, { headers }),
        axios.get(`${API}/api/security/alerts?${query}`, { headers }),
        axios.get(`${API}/api/security/alerts/settings`, { headers }),
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data.alerts);
      setTotal(alertsRes.data.total);
      setSettings(settingsRes.data);
    } catch (err) {
      toast.error('Failed to load security data');
    } finally {
      setLoading(false);
    }
  }, [filter, headers]);

  useEffect(() => { fetchData(); }, [filter]);

  const resolveAlert = async (alertId) => {
    try {
      await axios.post(`${API}/api/security/alerts/${alertId}/resolve`, {}, { headers });
      toast.success('Alert resolved');
      fetchData();
    } catch (err) {
      toast.error('Failed to resolve alert');
    }
  };

  const resolveAll = async () => {
    try {
      const res = await axios.post(`${API}/api/security/alerts/resolve-all`, {}, { headers });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error('Failed to resolve alerts');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await axios.post(`${API}/api/security/alerts/settings`, settings, { headers });
      setSettings(res.data.settings);
      toast.success('Settings saved');
      setSettingsOpen(false);
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center" data-testid="security-alerts-loading">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted" data-testid="security-alerts-page">
      {/* Header */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="security-alerts-back-btn">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-foreground" /> Security Alerts
            </h1>
            <p className="text-sm text-muted-foreground">IP-based anomaly detection and monitoring</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(!settingsOpen)} data-testid="security-settings-toggle-btn">
            <Settings className="h-4 w-4 mr-1" /> Settings
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} data-testid="security-refresh-btn">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="security-stats-grid">
            <StatsCard label="Unresolved" value={stats.unresolved} accent="text-destructive" testId="stat-unresolved" />
            <StatsCard label="Last 24h" value={stats.last_24h} accent="text-primary" testId="stat-last-24h" />
            <StatsCard label="Last 7 days" value={stats.last_7d} accent="text-muted-foreground" testId="stat-last-7d" />
            <StatsCard label="Total" value={stats.total} accent="text-muted-foreground" testId="stat-total" />
          </div>
        )}

        {/* Severity breakdown */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="severity-breakdown">
            {['critical', 'high', 'medium', 'low'].map((sev) => {
              const style = SEVERITY_STYLES[sev];
              return (
                <div key={sev} className={`rounded-lg border px-4 py-3 ${style.bg}`} data-testid={`severity-${sev}`}>
                  <p className={`text-xs font-medium uppercase tracking-wide ${style.text}`}>{sev}</p>
                  <p className={`text-2xl font-bold ${style.text}`}>{stats.by_severity?.[sev] ?? 0}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Settings Panel */}
        {settingsOpen && settings && (
          <Card data-testid="security-settings-panel">
            <CardHeader>
              <CardTitle className="text-base">Detection Settings</CardTitle>
              <CardDescription>Configure anomaly detection thresholds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <Label>New IP alerts</Label>
                <Switch
                  checked={settings.new_ip_alerts_enabled}
                  onCheckedChange={(v) => setSettings({ ...settings, new_ip_alerts_enabled: v })}
                  data-testid="setting-new-ip-toggle"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Rapid IP window (min)</Label>
                  <Input
                    type="number"
                    value={settings.rapid_ip_window_minutes}
                    onChange={(e) => setSettings({ ...settings, rapid_ip_window_minutes: parseInt(e.target.value) || 60 })}
                    data-testid="setting-rapid-window"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Rapid IP threshold</Label>
                  <Input
                    type="number"
                    value={settings.rapid_ip_threshold}
                    onChange={(e) => setSettings({ ...settings, rapid_ip_threshold: parseInt(e.target.value) || 3 })}
                    data-testid="setting-rapid-threshold"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Brute-force window (min)</Label>
                  <Input
                    type="number"
                    value={settings.brute_force_window_minutes}
                    onChange={(e) => setSettings({ ...settings, brute_force_window_minutes: parseInt(e.target.value) || 15 })}
                    data-testid="setting-bf-window"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Brute-force threshold</Label>
                  <Input
                    type="number"
                    value={settings.brute_force_threshold}
                    onChange={(e) => setSettings({ ...settings, brute_force_threshold: parseInt(e.target.value) || 5 })}
                    data-testid="setting-bf-threshold"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Email alerts to admins</Label>
                <Switch
                  checked={settings.alert_email_enabled}
                  onCheckedChange={(v) => setSettings({ ...settings, alert_email_enabled: v })}
                  data-testid="setting-email-toggle"
                />
              </div>
              <Button onClick={saveSettings} disabled={saving} className="w-full" data-testid="save-settings-btn">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filters + Resolve All */}
        <div className="flex flex-wrap items-center gap-3" data-testid="security-filters">
          <Select value={filter.severity} onValueChange={(v) => setFilter({ ...filter, severity: v })}>
            <SelectTrigger className="w-[140px]" data-testid="filter-severity">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filter.type} onValueChange={(v) => setFilter({ ...filter, type: v })}>
            <SelectTrigger className="w-[170px]" data-testid="filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="new_ip">New IP</SelectItem>
              <SelectItem value="rapid_ip_change">Rapid IP Change</SelectItem>
              <SelectItem value="brute_force">Brute-Force</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filter.resolved} onValueChange={(v) => setFilter({ ...filter, resolved: v })}>
            <SelectTrigger className="w-[140px]" data-testid="filter-resolved">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="false">Unresolved</SelectItem>
              <SelectItem value="true">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />
          <span className="text-sm text-muted-foreground" data-testid="alert-count">{total} alert{total !== 1 ? 's' : ''}</span>
          {stats?.unresolved > 0 && (
            <Button variant="outline" size="sm" onClick={resolveAll} data-testid="resolve-all-btn">
              <CheckCircle className="h-4 w-4 mr-1" /> Resolve All
            </Button>
          )}
        </div>

        {/* Alert List */}
        <div className="space-y-3" data-testid="alerts-list">
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No alerts match your filters</p>
              </CardContent>
            </Card>
          ) : (
            alerts.map((alert) => <AlertRow key={alert.id} alert={alert} onResolve={resolveAlert} formatTime={formatTime} />)
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ label, value, accent, testId }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="py-4 px-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${accent}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert, onResolve, formatTime }) {
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low;
  const TypeIcon = TYPE_ICONS[alert.alert_type] || Shield;

  return (
    <Card className={`border ${alert.resolved ? 'opacity-60' : ''}`} data-testid={`alert-row-${alert.id}`}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-4">
          <div className={`rounded-lg p-2 ${style.bg}`}>
            <TypeIcon className={`h-5 w-5 ${style.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground text-sm">{TYPE_LABELS[alert.alert_type] || alert.alert_type}</span>
              <Badge variant="outline" className={`text-[11px] ${style.badge}`} data-testid={`alert-severity-${alert.id}`}>
                {alert.severity}
              </Badge>
              {alert.resolved && (
                <Badge variant="outline" className="text-[11px] bg-success/10 text-success border-success" data-testid={`alert-resolved-badge-${alert.id}`}>
                  Resolved
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{alert.details?.message}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>{alert.email}</span>
              <span className="font-mono">{alert.ip_address}</span>
              <span>{formatTime(alert.created_at)}</span>
            </div>
          </div>
          {!alert.resolved && (
            <Button variant="outline" size="sm" onClick={() => onResolve(alert.id)} data-testid={`resolve-btn-${alert.id}`}>
              <CheckCircle className="h-4 w-4 mr-1" /> Resolve
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SecurityAlerts;
