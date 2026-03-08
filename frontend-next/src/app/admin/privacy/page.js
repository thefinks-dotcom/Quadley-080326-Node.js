'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Shield,
  Lock,
  Unlock,
  Database,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  Play,
  Eye,
  Mail,
  Send,
  Calendar,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_BACKEND_URL;
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const HOURS = Array.from({length: 24}, (_, i) => i);

const DataPrivacyDashboard = () => {
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [fields, setFields] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);

  // Compliance reports state
  const [reports, setReports] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [sending, setSending] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, fieldsRes, auditRes, reportsRes, scheduleRes] = await Promise.all([
        axios.get(`${API}/api/privacy/status`),
        axios.get(`${API}/api/privacy/fields`),
        axios.get(`${API}/api/privacy/audit-log?limit=20`),
        axios.get(`${API}/api/privacy/compliance-reports?limit=10`).catch(() => ({ data: { reports: [] } })),
        axios.get(`${API}/api/privacy/compliance-reports/schedule`).catch(() => ({ data: null })),
      ]);
      setStatus(statusRes.data);
      setFields(fieldsRes.data);
      setAuditLog(auditRes.data.logs || []);
      setReports(reportsRes.data.reports || []);
      setSchedule(scheduleRes.data);
    } catch (err) {
      toast.error('Failed to load privacy data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDryRun = async () => {
    try {
      const res = await axios.post(`${API}/api/privacy/migrate?dry_run=true`);
      setDryRunResult(res.data);
      setShowMigrateDialog(true);
    } catch (err) {
      toast.error('Dry run failed');
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await axios.post(`${API}/api/privacy/migrate?dry_run=false`);
      toast.success(`Migration complete — ${res.data.total_fields_encrypted} fields encrypted`);
      setShowMigrateDialog(false);
      setDryRunResult(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const handleSendReport = async () => {
    setSending(true);
    try {
      const res = await axios.post(`${API}/api/privacy/compliance-reports/send`);
      const d = res.data;
      toast.success(`Report sent to ${d.emails_sent} of ${d.recipients_count} recipients (${d.coverage_percent}% coverage)`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send report');
    } finally {
      setSending(false);
    }
  };

  const handleScheduleUpdate = async (field, value) => {
    setSavingSchedule(true);
    try {
      const res = await axios.post(`${API}/api/privacy/compliance-reports/schedule`, { [field]: value });
      setSchedule(res.data);
      toast.success('Schedule updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const summary = status?.summary;
  const coveragePct = summary?.coverage_percent ?? 0;
  const coverageColor = coveragePct === 100 ? 'text-success' : coveragePct >= 80 ? 'text-primary' : 'text-destructive';
  const coverageBg = coveragePct === 100 ? 'bg-success/10 border-success' : coveragePct >= 80 ? 'bg-muted border-border' : 'bg-destructive/5 border-destructive/20';

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted" data-testid="data-privacy-dashboard">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button data-testid="back-button" onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <h1 className="heading-font text-xl font-bold text-foreground">Data Privacy Dashboard</h1>
              <p className="text-sm text-muted-foreground">PII encryption status & compliance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button data-testid="refresh-btn" variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button data-testid="encrypt-all-btn" size="sm" onClick={handleDryRun} className="gap-2 bg-primary text-white hover:bg-primary">
              <Lock className="w-4 h-4" /> Encrypt All PII
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Card className={`border ${coverageBg}`} data-testid="coverage-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Encryption Coverage</span>
                <Shield className={`w-5 h-5 ${coverageColor}`} />
              </div>
              <p className={`text-3xl font-bold heading-font ${coverageColor}`}>{coveragePct}%</p>
              <p className="text-xs text-muted-foreground mt-1">{summary?.encrypted ?? 0} of {summary?.total_pii_values ?? 0} PII values</p>
            </CardContent>
          </Card>
          <Card data-testid="encrypted-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Encrypted</span>
                <Lock className="w-5 h-5 text-success" />
              </div>
              <p className="text-3xl font-bold heading-font text-success">{summary?.encrypted ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Protected values</p>
            </CardContent>
          </Card>
          <Card data-testid="unencrypted-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Unencrypted</span>
                <Unlock className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-3xl font-bold heading-font text-destructive">{summary?.unencrypted ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Needs encryption</p>
            </CardContent>
          </Card>
          <Card data-testid="algorithm-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Algorithm</span>
                <Database className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold heading-font text-foreground">{status?.algorithm || 'N/A'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {status?.encryption_enabled
                  ? <span className="text-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Enabled</span>
                  : <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Disabled</span>}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* PII Field Inventory */}
        <Card data-testid="pii-inventory-card">
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-muted-foreground" />PII Field Inventory</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="pii-fields-table">
                <thead><tr className="border-b border-border text-left">
                  <th className="pb-3 font-medium text-muted-foreground">Collection</th>
                  <th className="pb-3 font-medium text-muted-foreground">Field</th>
                  <th className="pb-3 font-medium text-muted-foreground">Encryption</th>
                  <th className="pb-3 font-medium text-muted-foreground">Status</th>
                </tr></thead>
                <tbody>
                  {fields?.fields?.map((f, i) => (
                    <tr key={i} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="py-3 font-mono text-xs text-foreground">{f.collection}</td>
                      <td className="py-3 font-mono text-xs text-foreground">{f.field}</td>
                      <td className="py-3"><Badge variant="outline" className="text-xs font-mono">{f.encryption_type}</Badge></td>
                      <td className="py-3">
                        {f.is_default
                          ? <Badge className="bg-success/10 text-success border-success text-xs">Tracked</Badge>
                          : <Badge className="bg-muted text-muted-foreground border-border text-xs">Custom</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Collection Breakdown */}
        <Card data-testid="collection-breakdown-card">
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><Database className="w-5 h-5 text-muted-foreground" />Collection Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status?.collections?.filter(c => Object.values(c.fields).some(f => f.encrypted > 0 || f.unencrypted > 0) || c.total_documents > 0).map((c, i) => {
                const totalEnc = Object.values(c.fields).reduce((a, f) => a + f.encrypted, 0);
                const totalUnenc = Object.values(c.fields).reduce((a, f) => a + f.unencrypted, 0);
                const total = totalEnc + totalUnenc;
                const pct = total > 0 ? Math.round((totalEnc / total) * 100) : 100;
                const barColor = pct === 100 ? 'bg-success' : pct >= 50 ? 'bg-muted0' : 'bg-destructive/50';
                return (
                  <div key={i} className="p-4 rounded-lg bg-muted border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-sm font-medium text-foreground">{c.collection}</span>
                        {c.tenant_name && <span className="ml-2 text-xs text-muted-foreground">({c.tenant_name})</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">{c.total_documents} docs</span>
                        {total > 0 && <Badge className={pct === 100 ? 'bg-success/10 text-success border-success' : pct >= 50 ? 'bg-muted text-foreground border-border' : 'bg-destructive/10 text-destructive border-destructive/20'}>{pct}%</Badge>}
                      </div>
                    </div>
                    {total > 0 && <div className="w-full h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>}
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      {Object.entries(c.fields).map(([field, stats]) => (
                        (stats.encrypted > 0 || stats.unencrypted > 0) && (
                          <span key={field}><span className="font-mono">{field}</span>: <span className="text-success">{stats.encrypted}</span>{stats.unencrypted > 0 && <span className="text-destructive"> / {stats.unencrypted} raw</span>}</span>
                        )
                      ))}
                    </div>
                  </div>
                );
              })}
              {status?.collections?.every(c => !Object.values(c.fields).some(f => f.encrypted > 0 || f.unencrypted > 0) && c.total_documents === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No PII data found across collections</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ────── Compliance Reports Section ────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedule Configuration */}
          <Card data-testid="schedule-card" className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-muted-foreground" />
                Report Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Weekly Reports</p>
                  <p className="text-xs text-muted-foreground">Auto-email compliance stats</p>
                </div>
                <Switch
                  data-testid="schedule-enabled-toggle"
                  checked={schedule?.enabled ?? true}
                  disabled={savingSchedule}
                  onCheckedChange={(v) => handleScheduleUpdate('enabled', v)}
                />
              </div>

              {/* Day of Week */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Day</label>
                <Select
                  value={schedule?.day_of_week || 'monday'}
                  onValueChange={(v) => handleScheduleUpdate('day_of_week', v)}
                  disabled={savingSchedule}
                >
                  <SelectTrigger className="mt-1" data-testid="schedule-day-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Hour */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time (UTC)</label>
                <Select
                  value={String(schedule?.hour_utc ?? 8)}
                  onValueChange={(v) => handleScheduleUpdate('hour_utc', parseInt(v))}
                  disabled={savingSchedule}
                >
                  <SelectTrigger className="mt-1" data-testid="schedule-hour-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => <SelectItem key={h} value={String(h)}>{String(h).padStart(2,'0')}:00</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Recipients */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recipients</label>
                <Select
                  value={schedule?.recipients || 'super_admins'}
                  onValueChange={(v) => handleScheduleUpdate('recipients', v)}
                  disabled={savingSchedule}
                >
                  <SelectTrigger className="mt-1" data-testid="schedule-recipients-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admins">Super Admins only</SelectItem>
                    <SelectItem value="all_admins">All Admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {schedule?.last_sent_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Last sent: {new Date(schedule.last_sent_at).toLocaleString()}
                </p>
              )}

              {/* Send Now */}
              <Button
                data-testid="send-report-now-btn"
                onClick={handleSendReport}
                disabled={sending}
                className="w-full gap-2"
                variant="outline"
              >
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Send Report Now'}
              </Button>
            </CardContent>
          </Card>

          {/* Compliance Report History */}
          <Card data-testid="compliance-reports-card" className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5 text-muted-foreground" />
                Compliance Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No compliance reports sent yet</p>
                  <p className="text-xs mt-1">Click "Send Report Now" to generate your first report</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((r, i) => {
                    const cov = r.report_data?.coverage_percent ?? 0;
                    const covColor = cov === 100 ? 'text-success' : cov >= 80 ? 'text-primary' : 'text-destructive';
                    const covBadgeCls = cov === 100 ? 'bg-success/10 text-success border-success' : cov >= 80 ? 'bg-muted text-foreground border-border' : 'bg-destructive/10 text-destructive border-destructive/20';
                    const flagged = r.report_data?.flagged_items?.length ?? 0;
                    return (
                      <div key={i} data-testid={`report-item-${i}`} className="p-4 rounded-lg bg-muted border border-border hover:bg-white transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cov === 100 ? 'bg-success/10' : 'bg-muted'}`}>
                              {cov === 100 ? <CheckCircle className="w-5 h-5 text-success" /> : <AlertTriangle className="w-5 h-5 text-primary" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">Privacy Compliance Report</p>
                                <Badge className={`text-xs ${covBadgeCls}`}>{cov}%</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {r.triggered_by === 'scheduler' ? (
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Scheduled</span>
                                ) : (
                                  <span>Sent by {r.triggered_by}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString()}</p>
                            <div className="flex items-center gap-3 mt-1 justify-end text-xs">
                              <span className="text-muted-foreground">{r.emails_sent}/{r.recipients_count} sent</span>
                              {flagged > 0 && (
                                <span className="text-destructive font-medium">{flagged} flagged</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {flagged > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs font-medium text-destructive mb-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Unencrypted PII detected:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {r.report_data.flagged_items.map((f, j) => (
                                <span key={j} className="text-xs bg-destructive/5 text-destructive border border-destructive/20 rounded px-2 py-0.5 font-mono">
                                  {f.collection}.{f.field} ({f.unencrypted_count})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Migration History */}
        <Card data-testid="audit-log-card">
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><Clock className="w-5 h-5 text-muted-foreground" />Migration History</CardTitle></CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No migrations have been run yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLog.map((log, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Encryption Migration
                          {log.dry_run && <Badge className="ml-2 bg-muted text-foreground text-xs">Dry Run</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{log.total_fields_encrypted} fields encrypted by {log.admin_email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(log.completed_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Migration Confirmation Dialog */}
      <Dialog open={showMigrateDialog} onOpenChange={setShowMigrateDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="migrate-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5" /> Encrypt Unencrypted PII</DialogTitle>
            <DialogDescription>This will encrypt all unencrypted PII fields across all databases using AES-256-GCM.</DialogDescription>
          </DialogHeader>
          {dryRunResult && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-muted border border-border">
                <p className="text-sm font-medium text-foreground mb-2"><Eye className="w-4 h-4 inline mr-1" /> Dry Run Results</p>
                <p className="text-2xl font-bold heading-font text-foreground">{dryRunResult.total_fields_encrypted}</p>
                <p className="text-xs text-muted-foreground">fields will be encrypted</p>
              </div>
              {dryRunResult.total_fields_encrypted === 0 && (
                <div className="flex items-center gap-2 text-success bg-success/10 border border-success p-3 rounded-lg text-sm">
                  <CheckCircle className="w-4 h-4" /> All PII data is already encrypted. No action needed.
                </div>
              )}
              {dryRunResult.total_fields_encrypted > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {dryRunResult.details?.filter(d => d.fields_encrypted > 0).map((d, i) => (
                    <div key={i} className="flex justify-between"><span className="font-mono">{d.database} / {d.collection}</span><span className="font-medium">{d.fields_encrypted} fields</span></div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMigrateDialog(false)}>Cancel</Button>
            {dryRunResult?.total_fields_encrypted > 0 && (
              <Button data-testid="confirm-migrate-btn" onClick={handleMigrate} disabled={migrating} className="gap-2 bg-primary text-white hover:bg-primary">
                {migrating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {migrating ? 'Encrypting...' : 'Run Migration'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataPrivacyDashboard;
