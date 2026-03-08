'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Shield, Lock, AlertTriangle, Heart, FileText, CheckCircle,
  Clock, ChevronRight, ArrowLeft, ExternalLink, Eye, AlertCircle
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const BLANK_FORM = {
  is_anonymous: false,
  report_type: 'disclosure',
  incident_type: '',
  incident_date: '',
  incident_location: '',
  description: '',
  individuals_involved: '',
  witness_present: false,
  witness_details: '',
  immediate_danger: false,
  medical_attention_needed: false,
  police_notified: false,
  support_requested: [],
  preferred_contact: '',
  additional_notes: ''
};

const STATUS_LABELS = {
  pending_risk_assessment: { label: 'Being Assessed', desc: 'A support coordinator is reviewing your submission and will be in touch soon.', color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  risk_assessment_complete: { label: 'Assessment Complete', desc: 'Your risk assessment is done. A support plan is being put together for you.', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  support_plan_active: { label: 'Support Plan Active', desc: 'A personalised support plan is in place. Your coordinator will be in contact.', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  investigation: { label: 'Under Investigation', desc: 'A formal investigation is underway. You will be kept informed of progress.', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  resolved: { label: 'Resolved', desc: 'This case has been resolved. Contact your college if you have any concerns.', color: 'text-success', bg: 'bg-success/10 border-success/20' },
  appeal_under_review: { label: 'Appeal Under Review', desc: 'Your appeal is being reviewed by the college.', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
  appeal_resolved: { label: 'Appeal Resolved', desc: 'The appeal process has concluded.', color: 'text-muted-foreground', bg: 'bg-muted border-border' },
};

const incidentTypes = [
  'Sexual Assault', 'Sexual Harassment', 'Image-based Abuse', 'Physical Abuse',
  'Emotional/Psychological Abuse', 'Stalking', 'Technology-facilitated Abuse', 'Other'
];

const supportOptions = [
  'Counseling Services', 'Medical Support', 'Academic Adjustments', 'Safety Planning',
  'Legal Information', 'Accommodation Support', 'Peer Support'
];

function AppealForm({ caseId, onSuccess }) {
  const [grounds, setGrounds] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!grounds.trim()) { toast.error('Please describe the grounds for your appeal'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/safe-disclosures/${caseId}/appeal`, { grounds });
      toast.success('Appeal submitted successfully');
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit appeal');
    } finally { setSaving(false); }
  };

  return (
    <div className="mt-3 p-4 bg-muted rounded-lg space-y-3 border border-border">
      <p className="text-sm font-medium">Grounds for Appeal</p>
      <Textarea rows={3} placeholder="Please describe why you are appealing this decision..." value={grounds} onChange={e => setGrounds(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>{saving ? 'Submitting...' : 'Submit Appeal'}</Button>
      </div>
    </div>
  );
}

function StudentCaseTracker({ userId, onNewCase }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appealingId, setAppealingId] = useState(null);

  useEffect(() => {
    axios.get(`${API}/safe-disclosures`)
      .then(r => setCases(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading your submissions...</div>;

  const myCases = cases.filter(c => c.reporter_id === userId || !c.is_anonymous);

  if (myCases.length === 0) {
    return (
      <div className="text-center py-10">
        <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">You haven't submitted any disclosures yet.</p>
        <Button size="sm" className="mt-4" onClick={onNewCase}>Make a Submission</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {myCases.map(c => {
        const st = STATUS_LABELS[c.status] || { label: c.status, desc: '', color: 'text-foreground', bg: 'bg-muted border-border' };
        const canAppeal = c.status === 'resolved' && !c.appeal;
        const isAppealing = appealingId === c.id;
        return (
          <div key={c.id} className={`p-4 rounded-xl border ${st.bg} space-y-2`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wide ${st.color}`}>{st.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${c.report_type === 'formal_complaint' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {c.report_type === 'formal_complaint' ? '⚖️ Formal Complaint' : '💙 Disclosure'}
                  </span>
                </div>
                <p className="font-semibold text-sm">{c.incident_type}</p>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
            </div>
            <p className="text-sm text-muted-foreground">{st.desc}</p>
            {c.investigation_deadline && !['resolved', 'appeal_resolved'].includes(c.status) && (
              <p className="text-xs text-orange-700 font-medium">
                Investigation deadline: {new Date(c.investigation_deadline).toLocaleDateString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground font-mono">Ref: {c.id.slice(0, 8).toUpperCase()}</p>
            {canAppeal && (
              <div className="pt-1">
                <button onClick={() => setAppealingId(isAppealing ? null : c.id)}
                  className="text-xs text-primary underline hover:no-underline">
                  {isAppealing ? 'Cancel appeal' : 'Submit an appeal →'}
                </button>
                {isAppealing && <AppealForm caseId={c.id} onSuccess={() => { setAppealingId(null); }} />}
              </div>
            )}
            {c.status === 'appeal_under_review' && c.appeal && (
              <p className="text-xs text-muted-foreground">Appeal deadline: {new Date(c.appeal.appeal_deadline).toLocaleDateString()}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const SafeDisclosureModule = () => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [view, setView] = useState('home');
  const [reportType, setReportType] = useState(null);
  const [formData, setFormData] = useState({ ...BLANK_FORM });
  const [submittedCase, setSubmittedCase] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role && user.role !== 'student';

  const resetAll = () => {
    setView('home');
    setReportType(null);
    setFormData({ ...BLANK_FORM });
    setSubmittedCase(null);
  };

  const handleSupportToggle = (s) => {
    setFormData(prev => ({
      ...prev,
      support_requested: prev.support_requested.includes(s)
        ? prev.support_requested.filter(x => x !== s)
        : [...prev.support_requested, s]
    }));
  };

  const startForm = (type) => {
    setReportType(type);
    setFormData({ ...BLANK_FORM, report_type: type });
    setView('form');
  };

  const submitDisclosure = async (e) => {
    e.preventDefault();
    if (!formData.incident_type) { toast.error('Please select an incident type'); return; }
    if (!formData.description.trim()) { toast.error('Please describe what happened'); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/safe-disclosures`, formData);
      setSubmittedCase(res.data);
      setView('confirmation');
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <ModuleHeader title="Safe Disclosure" showBack={true} showSearch={false} />
        <div className="px-4 pt-6 pb-4 space-y-4">
          <div className="bg-muted border-l-4 border-primary p-5 rounded-lg">
            <h2 className="text-xl font-bold mb-1">GBV Case Management</h2>
            <p className="text-sm text-muted-foreground">Full case management, 45-day tracking, and board reporting is available in the admin portal.</p>
          </div>
          <Card className="p-5">
            <Button className="w-full flex items-center gap-2" onClick={() => router.push('/admin/gbv')}>
              <Shield className="h-4 w-4" /> Open GBV Admin Panel <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader title="Safe Disclosure" showBack={view !== 'home'} onBack={view !== 'home' ? resetAll : undefined} showSearch={false} />
      <div className="px-4 pt-4 pb-8 space-y-4 max-w-2xl mx-auto">

        {view === 'home' && (
          <>
            <div className="bg-muted border-l-4 border-border p-5 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">Support & Safety</h2>
                  <p className="text-sm text-muted-foreground">This is a confidential space. You are in control of what happens next. Everything you share is treated with the highest level of care.</p>
                </div>
              </div>
            </div>

            <Card className="p-5 border-l-4 border-destructive/30">
              <h3 className="font-semibold text-base mb-3 text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Immediate Support</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted p-3 rounded-lg"><p className="font-semibold">Emergency</p><p className="text-xl font-bold text-destructive">000</p></div>
                <div className="bg-muted p-3 rounded-lg"><p className="font-semibold">1800 RESPECT</p><p className="text-xl font-bold">1800 737 732</p></div>
                <div className="bg-muted p-3 rounded-lg"><p className="font-semibold">Lifeline</p><p className="text-xl font-bold">13 11 14</p></div>
                <div className="bg-muted p-3 rounded-lg"><p className="font-semibold">Campus Security</p><p className="text-sm text-muted-foreground mt-1">24/7 on-campus</p></div>
              </div>
            </Card>

            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">How would you like to proceed?</p>
              <div className="grid gap-4">
                <button onClick={() => startForm('disclosure')}
                  className="text-left p-5 rounded-xl border-2 border-border hover:border-primary bg-background hover:bg-muted transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Heart className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-base">I want support</h3>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">Share what happened and access support services. No formal investigation is started.</p>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-success" /> A support coordinator will reach out within 48 hours</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-success" /> Access to counseling, medical, and other services</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-success" /> No investigation unless you request one later</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-success" /> Can be anonymous</p>
                      </div>
                    </div>
                  </div>
                </button>

                <button onClick={() => startForm('formal_complaint')}
                  className="text-left p-5 rounded-xl border-2 border-border hover:border-orange-400 bg-background hover:bg-orange-50 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-base">I want a formal investigation</h3>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-600 transition-colors" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">Lodge a formal complaint. The college is required to investigate within 45 business days.</p>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-orange-500" /> Formal investigation begins immediately</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-orange-500" /> College must respond within 45 business days</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-orange-500" /> Right of appeal within 20 business days of outcome</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-orange-500" /> Support services provided throughout</p>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {user && (
              <Card className="p-5">
                <h3 className="font-semibold text-base mb-4 flex items-center gap-2"><Eye className="h-4 w-4" /> My Submissions</h3>
                <StudentCaseTracker userId={user.id} onNewCase={() => startForm('disclosure')} />
              </Card>
            )}
          </>
        )}

        {view === 'form' && (
          <form onSubmit={submitDisclosure} className="space-y-5">
            <div className={`p-4 rounded-xl border-2 flex items-start gap-3 ${reportType === 'formal_complaint' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${reportType === 'formal_complaint' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                {reportType === 'formal_complaint' ? <FileText className={`h-4 w-4 text-orange-600`} /> : <Heart className={`h-4 w-4 text-blue-600`} />}
              </div>
              <div>
                <p className={`font-semibold text-sm ${reportType === 'formal_complaint' ? 'text-orange-700' : 'text-blue-700'}`}>
                  {reportType === 'formal_complaint' ? 'Formal Complaint — 45-day investigation clock will start on submission' : 'Disclosure — support services will be arranged, no investigation started'}
                </p>
                <button type="button" onClick={() => setView('home')} className="text-xs underline text-muted-foreground mt-0.5 hover:text-foreground">Change selection</button>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <input type="checkbox" id="anonymous" checked={formData.is_anonymous}
                  onChange={e => setFormData({ ...formData, is_anonymous: e.target.checked })} className="mt-1" />
                <div>
                  <Label htmlFor="anonymous" className="font-semibold cursor-pointer">Submit Anonymously</Label>
                  <p className="text-xs text-muted-foreground">Your identity won't be recorded. This may limit our ability to follow up directly.</p>
                </div>
              </div>
            </div>

            <div>
              <Label className="font-semibold">Type of Incident *</Label>
              <Select value={formData.incident_type} onValueChange={v => setFormData({ ...formData, incident_type: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select incident type..." /></SelectTrigger>
                <SelectContent>{incidentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>When did this occur?</Label>
                <Input type="datetime-local" className="mt-1" value={formData.incident_date} onChange={e => setFormData({ ...formData, incident_date: e.target.value })} />
              </div>
              <div>
                <Label>Where?</Label>
                <Input className="mt-1" placeholder="e.g., Floor 3, Library..." value={formData.incident_location} onChange={e => setFormData({ ...formData, incident_location: e.target.value })} />
              </div>
            </div>

            <div>
              <Label className="font-semibold">What happened? *</Label>
              <p className="text-xs text-muted-foreground mb-1">Share as much or as little as you're comfortable with.</p>
              <Textarea rows={5} required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe what happened in your own words..." />
            </div>

            <div>
              <Label>Individuals Involved (Optional)</Label>
              <Textarea rows={2} className="mt-1" value={formData.individuals_involved} onChange={e => setFormData({ ...formData, individuals_involved: e.target.value })} placeholder="Names, descriptions, or other identifying information..." />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="witness" checked={formData.witness_present} onChange={e => setFormData({ ...formData, witness_present: e.target.checked })} />
                <Label htmlFor="witness" className="cursor-pointer">Were there any witnesses?</Label>
              </div>
              {formData.witness_present && (
                <Textarea rows={2} value={formData.witness_details} onChange={e => setFormData({ ...formData, witness_details: e.target.value })} placeholder="Witness names or descriptions..." />
              )}
            </div>

            <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/20 space-y-2">
              <p className="font-semibold text-destructive text-sm">Safety Assessment</p>
              {[
                { id: 'immediate_danger', label: 'I am in immediate danger', field: 'immediate_danger' },
                { id: 'medical', label: 'I need medical attention', field: 'medical_attention_needed' },
                { id: 'police', label: 'I have contacted police', field: 'police_notified' },
              ].map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <input type="checkbox" id={item.id} checked={formData[item.field]} onChange={e => setFormData({ ...formData, [item.field]: e.target.checked })} />
                  <Label htmlFor={item.id} className="cursor-pointer text-sm">{item.label}</Label>
                </div>
              ))}
              {(formData.immediate_danger || formData.medical_attention_needed) && (
                <p className="text-sm text-destructive font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> If you're in immediate danger, please call 000 now.</p>
              )}
            </div>

            <div>
              <Label className="font-semibold">What support would be helpful?</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {supportOptions.map(o => (
                  <div key={o} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.support_requested.includes(o) ? 'bg-primary/10 border-primary' : 'bg-background border-border hover:bg-muted'}`}
                    onClick={() => handleSupportToggle(o)}>
                    <input type="checkbox" checked={formData.support_requested.includes(o)} onChange={() => handleSupportToggle(o)} onClick={e => e.stopPropagation()} />
                    <span className="text-sm">{o}</span>
                  </div>
                ))}
              </div>
            </div>

            {!formData.is_anonymous && (
              <div>
                <Label>Preferred Contact Method</Label>
                <Input className="mt-1" placeholder="Email, phone, or other..." value={formData.preferred_contact} onChange={e => setFormData({ ...formData, preferred_contact: e.target.value })} />
              </div>
            )}

            <div>
              <Label>Additional Information</Label>
              <Textarea rows={3} className="mt-1" value={formData.additional_notes} onChange={e => setFormData({ ...formData, additional_notes: e.target.value })} placeholder="Anything else you'd like us to know..." />
            </div>

            <div className="flex gap-3 pt-2 border-t">
              <Button type="submit" disabled={submitting} className="flex-1">
                <Lock className="h-4 w-4 mr-2" />{submitting ? 'Submitting...' : 'Submit Confidentially'}
              </Button>
              <Button type="button" variant="outline" onClick={resetAll}>Cancel</Button>
            </div>
          </form>
        )}

        {view === 'confirmation' && submittedCase && (
          <div className="space-y-5">
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Submission Received</h2>
              <p className="text-muted-foreground text-sm">Your {submittedCase.report_type === 'formal_complaint' ? 'formal complaint' : 'disclosure'} has been received safely and confidentially.</p>
            </div>

            <Card className="p-5 border-success/30 bg-success/5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your Case Reference</p>
              <p className="text-2xl font-mono font-bold text-foreground">{submittedCase.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground mt-1">Keep this reference if you need to follow up.</p>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">What happens next</h3>
              {submittedCase.report_type === 'formal_complaint' ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-orange-600 font-bold text-xs">1</span></div><div><p className="font-medium">Formal investigation started</p><p className="text-muted-foreground text-xs">The 45 business-day investigation clock has started from today.</p></div></div>
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-orange-600 font-bold text-xs">2</span></div><div><p className="font-medium">Risk assessment within 48 hours</p><p className="text-muted-foreground text-xs">A support coordinator will conduct a safety assessment and reach out to you.</p></div></div>
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-orange-600 font-bold text-xs">3</span></div><div><p className="font-medium">You'll receive a written outcome</p><p className="text-muted-foreground text-xs">The college must provide a written outcome within 45 business days. You have the right to appeal.</p></div></div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-blue-600 font-bold text-xs">1</span></div><div><p className="font-medium">Risk assessment within 48 hours</p><p className="text-muted-foreground text-xs">A support coordinator will review your submission and reach out.</p></div></div>
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-blue-600 font-bold text-xs">2</span></div><div><p className="font-medium">Personalised support plan</p><p className="text-muted-foreground text-xs">A support plan tailored to your needs will be put together with you.</p></div></div>
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-blue-600 font-bold text-xs">3</span></div><div><p className="font-medium">You stay in control</p><p className="text-muted-foreground text-xs">No investigation happens without your consent. You can escalate to a formal complaint at any time.</p></div></div>
                </div>
              )}
            </Card>

            <div className="flex gap-3">
              <Button className="flex-1" onClick={resetAll}>Done</Button>
              <Button variant="outline" onClick={() => setView('home')}>View My Cases</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SafeDisclosureModule;
