'use client';

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Shield, ArrowLeft, AlertTriangle, Clock, CheckCircle, FileText,
  Users, TrendingUp, Search, ChevronRight, X, AlertCircle,
  UserCheck, MessageSquare, Gavel, Download, Calendar, RefreshCw,
  Eye, EyeOff, ExternalLink, UserX, Lock, Plus, Trash2
} from 'lucide-react';

const STATUS_CONFIG = {
  pending_risk_assessment: { label: 'Pending Risk Assessment', color: 'bg-warning/10 text-warning border-warning/20' },
  risk_assessment_complete: { label: 'Risk Assessment Done', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  support_plan_active: { label: 'Support Plan Active', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  investigation: { label: 'Under Investigation', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  resolved: { label: 'Resolved', color: 'bg-success/10 text-success border-success/20' },
  appeal_under_review: { label: 'Appeal Under Review', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  appeal_resolved: { label: 'Appeal Resolved', color: 'bg-muted text-muted-foreground border-border' },
};

const URGENCY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-destructive text-white' },
  high: { label: 'High', color: 'bg-orange-500 text-white' },
  normal: { label: 'Normal', color: 'bg-muted text-muted-foreground border border-border' },
};

function CountdownBadge({ deadline, status }) {
  if (!deadline || ['resolved', 'appeal_resolved'].includes(status)) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
        <AlertTriangle className="h-3 w-3" /> {Math.abs(diffDays)}d overdue
      </span>
    );
  }
  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
        <Clock className="h-3 w-3" /> {diffDays}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      <Clock className="h-3 w-3" /> {diffDays}d left
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-foreground' };
  return <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>;
}

function UrgencyBadge({ urgency }) {
  const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.normal;
  return <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>;
}

function RiskAssessmentForm({ caseId, onComplete }) {
  const [form, setForm] = useState({ risk_level: 'low', assessment_notes: '', safety_measures: [], support_notes: '', follow_up_date: '' });
  const [saving, setSaving] = useState(false);
  const measures = ['Emergency housing', 'Police escort', 'No-contact order', 'Academic accommodation', 'Mental health referral', 'Medical referral'];

  const toggle = (m) => setForm(p => ({ ...p, safety_measures: p.safety_measures.includes(m) ? p.safety_measures.filter(x => x !== m) : [...p.safety_measures, m] }));

  const submit = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/safe-disclosures/${caseId}/risk-assessment`, form);
      toast.success('Risk assessment saved');
      onComplete();
    } catch { toast.error('Failed to save risk assessment'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Risk Level</Label>
        <div className="flex gap-2 mt-2">
          {['none', 'low', 'medium', 'high'].map(level => (
            <button key={level} onClick={() => setForm(p => ({ ...p, risk_level: level }))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.risk_level === level
                ? level === 'high' ? 'bg-destructive text-white border-destructive'
                  : level === 'medium' ? 'bg-orange-500 text-white border-orange-500'
                  : level === 'low' ? 'bg-warning text-foreground border-warning'
                  : 'bg-success text-white border-success'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted'}`}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium">Assessment Notes</Label>
        <Textarea className="mt-1" rows={3} placeholder="Document your risk assessment findings..." value={form.assessment_notes} onChange={e => setForm(p => ({ ...p, assessment_notes: e.target.value }))} />
      </div>
      <div>
        <Label className="text-sm font-medium">Safety Measures</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {measures.map(m => (
            <button key={m} onClick={() => toggle(m)}
              className={`px-2 py-1 rounded text-xs border transition-all ${form.safety_measures.includes(m) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-muted'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium">Initial Support Notes (optional)</Label>
        <Textarea className="mt-1" rows={2} placeholder="Any immediate support arranged..." value={form.support_notes} onChange={e => setForm(p => ({ ...p, support_notes: e.target.value }))} />
      </div>
      <div>
        <Label className="text-sm font-medium">Follow-up Date (optional)</Label>
        <Input type="date" className="mt-1" value={form.follow_up_date} onChange={e => setForm(p => ({ ...p, follow_up_date: e.target.value }))} />
      </div>
      <Button onClick={submit} disabled={saving} className="w-full">{saving ? 'Saving...' : 'Save Risk Assessment'}</Button>
    </div>
  );
}

function SupportPlanForm({ caseId, onComplete }) {
  const [form, setForm] = useState({ plan_notes: '', follow_up_date: '', support_services: [] });
  const [saving, setSaving] = useState(false);
  const services = ['Counseling Services', 'Medical Support', 'Academic Adjustments', 'Safety Planning', 'Legal Information', 'Accommodation Support', 'Peer Support'];

  const toggle = (s) => setForm(p => ({ ...p, support_services: p.support_services.includes(s) ? p.support_services.filter(x => x !== s) : [...p.support_services, s] }));

  const submit = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/safe-disclosures/${caseId}/support-plan`, form);
      toast.success('Support plan saved');
      onComplete();
    } catch { toast.error('Failed to save support plan'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Support Services</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {services.map(s => (
            <button key={s} onClick={() => toggle(s)}
              className={`px-2 py-1 rounded text-xs border transition-all ${form.support_services.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-muted'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium">Plan Notes</Label>
        <Textarea className="mt-1" rows={4} placeholder="Document the support plan..." value={form.plan_notes} onChange={e => setForm(p => ({ ...p, plan_notes: e.target.value }))} />
      </div>
      <div>
        <Label className="text-sm font-medium">Follow-up Date</Label>
        <Input type="date" className="mt-1" value={form.follow_up_date} onChange={e => setForm(p => ({ ...p, follow_up_date: e.target.value }))} />
      </div>
      <Button onClick={submit} disabled={saving} className="w-full">{saving ? 'Saving...' : 'Save Support Plan'}</Button>
    </div>
  );
}

const INTERIM_MEASURE_TYPES = [
  'Alternative Accommodation',
  'Supervision Arrangement',
  'Contact Restriction',
  'Teaching Arrangement',
  'No-Contact Order',
  'Other',
];

function CaseDetailPanel({ selected, onClose, onRefresh }) {
  const [activeTab, setActiveTab] = useState('details');
  const [noteText, setNoteText] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [showEscalate, setShowEscalate] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showNSOModal, setShowNSOModal] = useState(false);
  const [nsoReference, setNsoReference] = useState('');
  const [nsoNotes, setNsoNotes] = useState('');

  const [respondentName, setRespondentName] = useState(selected?.respondent_name || '');
  const [respondentId, setRespondentId] = useState(selected?.respondent_id || '');
  const [savingRespondent, setSavingRespondent] = useState(false);

  const [showAddMeasure, setShowAddMeasure] = useState(false);
  const [measureType, setMeasureType] = useState(INTERIM_MEASURE_TYPES[0]);
  const [measureDesc, setMeasureDesc] = useState('');
  const [measureDate, setMeasureDate] = useState('');
  const [savingMeasure, setSavingMeasure] = useState(false);

  const c = selected;
  if (!c) return null;

  const statusCfg = STATUS_CONFIG[c.status] || { label: c.status, color: 'bg-muted text-foreground' };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/safe-disclosures/${c.id}/notes`, { note: noteText, is_internal: true });
      toast.success('Note added');
      setNoteText('');
      onRefresh(c.id);
    } catch { toast.error('Failed to add note'); }
    finally { setSaving(false); }
  };

  const escalate = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/safe-disclosures/${c.id}/escalate`, { reason: escalateReason });
      toast.success('Escalated to formal complaint — 45-day clock started');
      setShowEscalate(false);
      onRefresh(c.id);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to escalate'); }
    finally { setSaving(false); }
  };

  const resolve = async () => {
    if (!resolveNotes.trim()) { toast.error('Please provide resolution notes'); return; }
    setSaving(true);
    try {
      await axios.put(`${API}/safe-disclosures/${c.id}/resolve`, { resolution_notes: resolveNotes });
      toast.success('Case marked as resolved');
      setShowResolve(false);
      onRefresh(c.id);
    } catch { toast.error('Failed to resolve case'); }
    finally { setSaving(false); }
  };

  const escalateToNSO = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/safe-disclosures/${c.id}/escalate-nso`, { reference: nsoReference, notes: nsoNotes });
      toast.success('Case escalated to National Student Ombudsman');
      setShowNSOModal(false);
      onRefresh(c.id);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to escalate to NSO'); }
    finally { setSaving(false); }
  };

  const updateRespondent = async () => {
    if (!respondentName.trim()) { toast.error('Please enter respondent name'); return; }
    setSavingRespondent(true);
    try {
      await axios.put(`${API}/safe-disclosures/${c.id}/respondent`, { respondent_name: respondentName, respondent_id: respondentId || null });
      toast.success('Respondent information saved');
      onRefresh(c.id);
    } catch { toast.error('Failed to save respondent'); }
    finally { setSavingRespondent(false); }
  };

  const addInterimMeasure = async () => {
    if (!measureDesc.trim()) { toast.error('Please describe the measure'); return; }
    setSavingMeasure(true);
    try {
      await axios.post(`${API}/safe-disclosures/${c.id}/interim-measures`, {
        measure_type: measureType,
        description: measureDesc,
        date_imposed: measureDate || null,
      });
      toast.success('Interim measure recorded');
      setShowAddMeasure(false);
      setMeasureDesc('');
      setMeasureDate('');
      onRefresh(c.id);
    } catch { toast.error('Failed to add interim measure'); }
    finally { setSavingMeasure(false); }
  };

  const removeInterimMeasure = async (measureId) => {
    try {
      await axios.delete(`${API}/safe-disclosures/${c.id}/interim-measures/${measureId}`);
      toast.success('Interim measure removed');
      onRefresh(c.id);
    } catch { toast.error('Failed to remove measure'); }
  };

  const canCompleteRiskAssessment = c.status === 'pending_risk_assessment';
  const canCreateSupportPlan = c.status === 'risk_assessment_complete';
  const canEscalate = ['support_plan_active', 'risk_assessment_complete'].includes(c.status) && !c.formal_report;
  const canResolve = ['support_plan_active', 'investigation', 'risk_assessment_complete'].includes(c.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className={`text-xs ${c.report_type === 'formal_complaint' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {c.report_type === 'formal_complaint' ? '⚖️ Formal Complaint' : '💙 Disclosure'}
              </Badge>
              <UrgencyBadge urgency={c.urgency} />
              <StatusBadge status={c.status} />
              {c.investigation_deadline && <CountdownBadge deadline={c.investigation_deadline} status={c.status} />}
            </div>
            <h2 className="text-lg font-bold text-foreground truncate">{c.incident_type}</h2>
            <p className="text-sm text-muted-foreground">
              {c.is_anonymous ? 'Anonymous submission' : c.reporter_name || 'Identified reporter'} · Submitted {new Date(c.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full rounded-none border-b border-border bg-transparent px-6 pt-2 justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="details" className="text-xs">Case Details</TabsTrigger>
              <TabsTrigger value="risk" className="text-xs">Risk Assessment</TabsTrigger>
              <TabsTrigger value="support" className="text-xs">Support Plan</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs">Notes {c.case_notes?.length > 0 && `(${c.case_notes.length})`}</TabsTrigger>
              <TabsTrigger value="respondent" className="text-xs">
                Respondent {(c.interim_measures?.length > 0) && <span className="ml-1 bg-orange-100 text-orange-700 text-xs px-1 rounded">{c.interim_measures.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Incident Type</p><p className="font-medium">{c.incident_type}</p></div>
                <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Date of Incident</p><p className="font-medium">{c.incident_date ? new Date(c.incident_date).toLocaleDateString() : 'Not provided'}</p></div>
                <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Location</p><p className="font-medium">{c.incident_location || 'Not provided'}</p></div>
                <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Assigned To</p><p className="font-medium">{c.assigned_to_name || 'Unassigned'}</p></div>
                {c.investigation_deadline && (
                  <div className="col-span-2"><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Investigation Deadline (45 days)</p><p className="font-semibold text-orange-700">{new Date(c.investigation_deadline).toLocaleDateString()}</p></div>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm bg-muted rounded-lg p-3 leading-relaxed">{c.description}</p>
              </div>
              {c.individuals_involved && (
                <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Individuals Involved</p><p className="text-sm bg-muted rounded-lg p-3">{c.individuals_involved}</p></div>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                {c.immediate_danger && <span className="text-destructive font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Immediate Danger</span>}
                {c.medical_attention_needed && <span className="text-orange-600 flex items-center gap-1">🏥 Medical Attention Needed</span>}
                {c.police_notified && <span className="text-blue-700 flex items-center gap-1">🚔 Police Notified</span>}
                {c.witness_present && <span className="text-muted-foreground flex items-center gap-1">👥 Witness Present</span>}
              </div>
              {c.support_requested?.length > 0 && (
                <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Support Requested</p><div className="flex flex-wrap gap-1">{c.support_requested.map(s => <span key={s} className="bg-muted text-xs px-2 py-0.5 rounded-full">{s}</span>)}</div></div>
              )}
              {c.resolution_notes && (
                <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Resolution Notes</p><p className="text-sm bg-success/10 rounded-lg p-3">{c.resolution_notes}</p></div>
              )}
            </TabsContent>

            <TabsContent value="risk" className="p-6">
              {c.risk_assessment ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Risk Level:</span>
                    <span className={`font-bold ${c.risk_assessment.risk_level === 'high' ? 'text-destructive' : c.risk_assessment.risk_level === 'medium' ? 'text-orange-600' : 'text-success'}`}>
                      {c.risk_assessment.risk_level?.toUpperCase()}
                    </span>
                  </div>
                  <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Assessment Notes</p><p className="bg-muted rounded-lg p-3">{c.risk_assessment.assessment_notes || '—'}</p></div>
                  <div><p className="text-muted-foreground text-xs mb-1">Completed by {c.risk_assessment.completed_by_name} on {new Date(c.risk_assessment.completed_at).toLocaleDateString()}</p></div>
                  {c.safety_measures?.length > 0 && (
                    <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Safety Measures</p><div className="flex flex-wrap gap-1">{c.safety_measures.map(m => <span key={m} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{m}</span>)}</div></div>
                  )}
                </div>
              ) : canCompleteRiskAssessment ? (
                <RiskAssessmentForm caseId={c.id} onComplete={() => onRefresh(c.id)} />
              ) : (
                <p className="text-muted-foreground text-center py-8">No risk assessment recorded yet.</p>
              )}
            </TabsContent>

            <TabsContent value="support" className="p-6">
              {c.support_plan ? (
                <div className="space-y-3 text-sm">
                  <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Plan Notes</p><p className="bg-muted rounded-lg p-3">{c.support_plan.plan_notes || '—'}</p></div>
                  {c.support_plan.follow_up_date && <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Follow-up Date</p><p className="font-medium">{new Date(c.support_plan.follow_up_date).toLocaleDateString()}</p></div>}
                  {c.support_plan.support_services?.length > 0 && (
                    <div><p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Services</p><div className="flex flex-wrap gap-1">{c.support_plan.support_services.map(s => <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{s}</span>)}</div></div>
                  )}
                  <p className="text-xs text-muted-foreground">Created by {c.support_plan.created_by_name}</p>
                </div>
              ) : canCreateSupportPlan ? (
                <SupportPlanForm caseId={c.id} onComplete={() => onRefresh(c.id)} />
              ) : (
                <p className="text-muted-foreground text-center py-8">No support plan recorded yet.</p>
              )}
            </TabsContent>

            <TabsContent value="notes" className="p-6 space-y-4">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {c.case_notes?.length > 0 ? c.case_notes.map(n => (
                  <div key={n.id} className="p-3 bg-muted rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">{n.created_by_name}</span>
                      <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-foreground">{n.note}</p>
                  </div>
                )) : <p className="text-muted-foreground text-sm text-center py-4">No notes yet.</p>}
              </div>
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">Add Internal Note</Label>
                <Textarea rows={3} placeholder="Add a confidential case note..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                <Button size="sm" onClick={addNote} disabled={saving || !noteText.trim()}>{saving ? 'Adding...' : 'Add Note'}</Button>
              </div>
            </TabsContent>

            <TabsContent value="respondent" className="p-6 space-y-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><UserX className="h-4 w-4 text-orange-600" /> Respondent Information (Standard 1)</h4>
                <p className="text-xs text-muted-foreground">Record the identity of the respondent and document any interim protective measures imposed.</p>
                {c.respondent_name ? (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm space-y-1">
                    <p className="font-semibold">{c.respondent_name}</p>
                    {c.respondent_recorded_at && <p className="text-xs text-muted-foreground">Recorded by {c.respondent_recorded_by} on {new Date(c.respondent_recorded_at).toLocaleDateString()}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No respondent recorded yet.</p>
                )}
                <div className="space-y-2">
                  <Input
                    placeholder="Respondent full name..."
                    value={respondentName}
                    onChange={e => setRespondentName(e.target.value)}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={updateRespondent} disabled={savingRespondent || !respondentName.trim()}>
                    {savingRespondent ? 'Saving...' : c.respondent_name ? 'Update Respondent' : 'Record Respondent'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-orange-600" /> Interim Measures (Standard 1.4)</h4>
                  <Button size="sm" variant="outline" onClick={() => setShowAddMeasure(true)} className="text-xs gap-1">
                    <Plus className="h-3 w-3" /> Add Measure
                  </Button>
                </div>
                {c.interim_measures?.length > 0 ? (
                  <div className="space-y-2">
                    {c.interim_measures.map(m => (
                      <div key={m.id} className="p-3 bg-muted rounded-xl text-sm flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <span className="font-semibold text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded mr-2">{m.measure_type}</span>
                          <p className="mt-1 text-foreground">{m.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Imposed {m.date_imposed ? new Date(m.date_imposed).toLocaleDateString() : 'today'} by {m.imposed_by_name}
                          </p>
                        </div>
                        <button onClick={() => removeInterimMeasure(m.id)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No interim measures recorded.</p>
                )}

                {showAddMeasure && (
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-xl space-y-3">
                    <h5 className="font-semibold text-xs uppercase tracking-wide text-orange-700">New Interim Measure</h5>
                    <div>
                      <Label className="text-xs mb-1">Measure Type</Label>
                      <select
                        value={measureType}
                        onChange={e => setMeasureType(e.target.value)}
                        className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 mt-1"
                      >
                        {INTERIM_MEASURE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1">Description</Label>
                      <Textarea
                        rows={2}
                        placeholder="Describe the specific measure and any conditions..."
                        value={measureDesc}
                        onChange={e => setMeasureDesc(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1">Date Imposed (optional)</Label>
                      <Input type="date" value={measureDate} onChange={e => setMeasureDate(e.target.value)} className="text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addInterimMeasure} disabled={savingMeasure || !measureDesc.trim()}>
                        {savingMeasure ? 'Saving...' : 'Record Measure'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowAddMeasure(false); setMeasureDesc(''); }}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="actions" className="p-6 space-y-4">
              {canCompleteRiskAssessment && (
                <div className="p-4 border border-warning/40 bg-warning/5 rounded-xl">
                  <h4 className="font-semibold text-sm mb-1">Complete Risk Assessment</h4>
                  <p className="text-xs text-muted-foreground mb-3">Required within 48 hours of submission (Standard 4.4)</p>
                  <Button size="sm" onClick={() => setActiveTab('risk')}>Go to Risk Assessment →</Button>
                </div>
              )}
              {canCreateSupportPlan && (
                <div className="p-4 border border-blue-200 bg-blue-50 rounded-xl">
                  <h4 className="font-semibold text-sm mb-1">Create Support Plan</h4>
                  <p className="text-xs text-muted-foreground mb-3">Document the support services being provided (Standard 4.6)</p>
                  <Button size="sm" onClick={() => setActiveTab('support')}>Go to Support Plan →</Button>
                </div>
              )}
              {canEscalate && (
                <div className="p-4 border border-orange-200 bg-orange-50 rounded-xl">
                  <h4 className="font-semibold text-sm mb-1">Escalate to Formal Complaint</h4>
                  <p className="text-xs text-muted-foreground mb-3">Starts the 45 business-day investigation deadline (Standard 5)</p>
                  {showEscalate ? (
                    <div className="space-y-2">
                      <Textarea rows={2} placeholder="Reason for escalation..." value={escalateReason} onChange={e => setEscalateReason(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={escalate} disabled={saving}>Confirm Escalation</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowEscalate(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => setShowEscalate(true)}>Escalate to Formal Complaint</Button>
                  )}
                </div>
              )}
              {canResolve && (
                <div className="p-4 border border-success/30 bg-success/5 rounded-xl">
                  <h4 className="font-semibold text-sm mb-1">Mark as Resolved</h4>
                  <p className="text-xs text-muted-foreground mb-3">Close this case with a resolution summary</p>
                  {showResolve ? (
                    <div className="space-y-2">
                      <Textarea rows={3} placeholder="Resolution summary (required)..." value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-success hover:bg-success/90 text-white" onClick={resolve} disabled={saving}>Confirm Resolution</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowResolve(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10" onClick={() => setShowResolve(true)}>Mark Resolved</Button>
                  )}
                </div>
              )}
              {!canCompleteRiskAssessment && !canCreateSupportPlan && !canEscalate && !canResolve && (
                <div className="text-center py-8">
                  <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No pending actions for this case.</p>
                </div>
              )}

              <div className="p-4 border border-border bg-muted/30 rounded-xl">
                <h4 className="font-semibold text-sm mb-1 flex items-center gap-2"><ExternalLink className="h-4 w-4 text-muted-foreground" /> National Student Ombudsman (Standard 5)</h4>
                <p className="text-xs text-muted-foreground mb-3">If the student is dissatisfied with the college's response, this case can be referred externally to the NSO. Record the referral here for audit purposes.</p>
                {c.nso_escalated ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                      <CheckCircle className="h-4 w-4" /> Referred to NSO
                    </div>
                    <p className="text-xs text-muted-foreground">Referred {new Date(c.nso_escalation_date).toLocaleDateString()} by {c.nso_escalated_by_name}</p>
                    {c.nso_reference && <p className="text-xs">Reference: <span className="font-mono font-medium">{c.nso_reference}</span></p>}
                    {c.nso_notes && <p className="text-xs text-muted-foreground mt-1">{c.nso_notes}</p>}
                  </div>
                ) : showNSOModal ? (
                  <div className="space-y-2 mt-2">
                    <div>
                      <Label className="text-xs mb-1">NSO Reference Number (optional)</Label>
                      <Input placeholder="e.g. NSO-2026-00123" value={nsoReference} onChange={e => setNsoReference(e.target.value)} className="text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs mb-1">Notes (optional)</Label>
                      <Textarea rows={2} placeholder="Context for the NSO referral..." value={nsoNotes} onChange={e => setNsoNotes(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={escalateToNSO} disabled={saving}>
                        {saving ? 'Recording...' : 'Confirm NSO Referral'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowNSOModal(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => setShowNSOModal(true)}>
                    Record NSO Referral
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function SuperAdminView() {
  const [stats, setStats] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/safe-disclosures/super-admin/stats?year=${year}`);
      setStats(res.data);
    } catch { toast.error('Failed to load national stats'); }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const colleges = stats?.colleges || [];
  const totalCases = colleges.reduce((s, c) => s + (c.total_cases || 0), 0);
  const totalFormal = colleges.reduce((s, c) => s + (c.formal_complaints || 0), 0);
  const totalOverdue = colleges.reduce((s, c) => s + (c.overdue || 0), 0);
  const avgCompliance = colleges.filter(c => c.compliance_rate !== null && c.compliance_rate !== undefined).reduce((s, c, _, a) => s + c.compliance_rate / a.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold">National GBV Statistics</h2>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground">
          {years.map(y => <option key={y} value={y}>{y}–{y + 1}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Cases', value: totalCases, icon: FileText, color: 'text-primary' },
          { label: 'Formal Complaints', value: totalFormal, icon: Gavel, color: 'text-orange-600' },
          { label: 'Overdue Cases', value: totalOverdue, icon: AlertTriangle, color: 'text-destructive' },
          { label: 'Avg Compliance', value: totalFormal > 0 ? `${avgCompliance.toFixed(0)}%` : 'N/A', icon: TrendingUp, color: 'text-success' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Per-College Breakdown — {year}–{year + 1}</CardTitle>
          <CardDescription className="text-xs">Aggregated statistics only. Individual case details are managed by each college.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left pb-3 pr-4">College</th>
                  <th className="text-center pb-3 pr-4">Total</th>
                  <th className="text-center pb-3 pr-4">Formal</th>
                  <th className="text-center pb-3 pr-4">Active</th>
                  <th className="text-center pb-3 pr-4">Resolved</th>
                  <th className="text-center pb-3 pr-4">Overdue</th>
                  <th className="text-center pb-3">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {colleges.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No data for this period</td></tr>
                ) : colleges.map(col => (
                  <tr key={col.college_code} className="hover:bg-muted/50">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{col.college_name}</p>
                      <p className="text-xs text-muted-foreground">{col.college_code}</p>
                    </td>
                    <td className="text-center py-3 pr-4 font-semibold">{col.error ? '—' : col.total_cases}</td>
                    <td className="text-center py-3 pr-4">{col.error ? '—' : col.formal_complaints}</td>
                    <td className="text-center py-3 pr-4">{col.error ? '—' : col.active}</td>
                    <td className="text-center py-3 pr-4">{col.error ? '—' : col.resolved}</td>
                    <td className="text-center py-3 pr-4">
                      {col.error ? '—' : col.overdue > 0 ? (
                        <span className="text-destructive font-semibold">{col.overdue}</span>
                      ) : <span className="text-success">0</span>}
                    </td>
                    <td className="text-center py-3">
                      {col.error ? <span className="text-xs text-destructive">Error</span>
                        : col.compliance_rate === null || col.compliance_rate === undefined ? <span className="text-xs text-muted-foreground">N/A</span>
                        : <span className={`font-semibold ${col.compliance_rate >= 80 ? 'text-success' : col.compliance_rate >= 50 ? 'text-orange-600' : 'text-destructive'}`}>{col.compliance_rate}%</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GBVAdminPage() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [overdue, setOverdue] = useState({ overdue: [], approaching_deadline: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [generatingReport, setGeneratingReport] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = ['admin', 'college_admin', 'ra', 'super_admin'].includes(user?.role);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [casesRes, statsRes, overdueRes] = await Promise.allSettled([
        axios.get(`${API}/safe-disclosures`),
        axios.get(`${API}/safe-disclosures/stats`),
        !isSuperAdmin ? axios.get(`${API}/safe-disclosures/overdue`) : Promise.resolve({ data: { overdue: [], approaching_deadline: [] } }),
      ]);
      if (casesRes.status === 'fulfilled') setCases(casesRes.value.data);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (overdueRes.status === 'fulfilled') setOverdue(overdueRes.value.data);
    } catch { toast.error('Failed to load cases'); }
    finally { setLoading(false); }
  }, [isAdmin, isSuperAdmin]);

  const refreshCase = async (caseId) => {
    try {
      const res = await axios.get(`${API}/safe-disclosures/${caseId}`);
      setCases(prev => prev.map(c => c.id === caseId ? res.data : c));
      setSelected(res.data);
    } catch {}
  };

  useEffect(() => { load(); }, [load]);

  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Access restricted to administrators.</p>
      </div>
    );
  }

  const filteredCases = cases.filter(c => {
    const matchSearch = !search || c.incident_type?.toLowerCase().includes(search.toLowerCase()) || c.reporter_name?.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'formal') return c.formal_report || c.report_type === 'formal_complaint';
    if (filter === 'disclosure') return !c.formal_report && c.report_type !== 'formal_complaint';
    if (filter === 'overdue') {
      if (!c.investigation_deadline) return false;
      const dl = new Date(c.investigation_deadline);
      return dl < new Date() && !['resolved', 'appeal_resolved'].includes(c.status);
    }
    if (filter === 'resolved') return ['resolved', 'appeal_resolved'].includes(c.status);
    if (filter === 'active') return !['resolved', 'appeal_resolved'].includes(c.status);
    return true;
  });

  const overdueCount = overdue.overdue?.length || 0;
  const approachingCount = overdue.approaching_deadline?.length || 0;

  const downloadReport = async (format) => {
    setGeneratingReport(true);
    try {
      const signRes = await axios.post(`${API}/safe-disclosures/annual-report/${reportYear}/export-url`, { format });
      const { expires, signature } = signRes.data;
      const url = `${API}/safe-disclosures/annual-report/${reportYear}/export/${format}?expires=${expires}&signature=${signature}`;
      window.open(url, '_blank');
    } catch { toast.error('Failed to generate report'); }
    finally { setGeneratingReport(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin')}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">GBV Case Management</h1>
              <p className="text-sm text-muted-foreground">F2025L01251 Compliance — National Higher Education GBV Code</p>
            </div>
          </div>
        </div>

        {isSuperAdmin ? (
          <SuperAdminView />
        ) : (
          <>
            {(overdueCount > 0 || approachingCount > 0) && (
              <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${overdueCount > 0 ? 'bg-destructive/10 border-destructive/30' : 'bg-orange-50 border-orange-200'}`}>
                <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${overdueCount > 0 ? 'text-destructive' : 'text-orange-600'}`} />
                <div>
                  <p className={`font-semibold text-sm ${overdueCount > 0 ? 'text-destructive' : 'text-orange-700'}`}>
                    {overdueCount > 0 ? `${overdueCount} case${overdueCount > 1 ? 's' : ''} past the 45-day investigation deadline` : `${approachingCount} case${approachingCount > 1 ? 's' : ''} approaching deadline (within 7 days)`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Immediate action required to maintain compliance with F2025L01251 Standard 5.</p>
                  <button className="text-xs underline mt-1 text-muted-foreground hover:text-foreground" onClick={() => setFilter('overdue')}>View overdue cases →</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Cases', value: stats?.total || cases.length, color: 'text-foreground', bg: '' },
                { label: 'Formal Complaints', value: cases.filter(c => c.formal_report || c.report_type === 'formal_complaint').length, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-destructive' : 'text-success', bg: overdueCount > 0 ? 'bg-destructive/10' : '' },
                { label: 'Resolved', value: cases.filter(c => c.status === 'resolved').length, color: 'text-success', bg: 'bg-success/10' },
              ].map(s => (
                <Card key={s.label} className={`p-4 ${s.bg}`}>
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </Card>
              ))}
            </div>

            <Card className="mb-6">
              <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search by incident type or reporter..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'formal', label: 'Formal' },
                    { key: 'disclosure', label: 'Disclosure' },
                    { key: 'active', label: 'Active' },
                    { key: 'overdue', label: `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}` },
                    { key: 'resolved', label: 'Resolved' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.key
                        ? f.key === 'overdue' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-border">
                {loading ? (
                  <div className="flex items-center justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filteredCases.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No cases match this filter.</p>
                  </div>
                ) : filteredCases.map(c => {
                  const statusCfg = STATUS_CONFIG[c.status] || { label: c.status, color: 'bg-muted text-foreground' };
                  return (
                    <button key={c.id} onClick={() => setSelected(c)} className="w-full text-left p-4 hover:bg-muted/50 transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${c.report_type === 'formal_complaint' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                              {c.report_type === 'formal_complaint' ? '⚖️ Formal' : '💙 Disclosure'}
                            </span>
                            <UrgencyBadge urgency={c.urgency} />
                            <StatusBadge status={c.status} />
                            {c.investigation_deadline && <CountdownBadge deadline={c.investigation_deadline} status={c.status} />}
                          </div>
                          <p className="font-semibold text-sm text-foreground">{c.incident_type}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {c.is_anonymous ? 'Anonymous' : c.reporter_name} · {new Date(c.created_at).toLocaleDateString()}
                            {c.assigned_to_name && ` · Assigned to ${c.assigned_to_name}`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors mt-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Annual Report — Board Submission</CardTitle>
                <CardDescription className="text-xs">Generate the annual GBV report for submission to your governing board (Standard 6)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Academic Year:</Label>
                    <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))}
                      className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground">
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}–{y + 1}</option>
                      ))}
                    </select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadReport('csv')} disabled={generatingReport} className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadReport('pdf')} disabled={generatingReport} className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Export PDF
                  </Button>
                  {generatingReport && <span className="text-xs text-muted-foreground">Generating report...</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-3">Reports contain aggregated data only. All individual cases are anonymised in compliance with F2025L01251.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {selected && !isSuperAdmin && (
        <CaseDetailPanel
          selected={selected}
          onClose={() => setSelected(null)}
          onRefresh={refreshCase}
        />
      )}
    </div>
  );
}
