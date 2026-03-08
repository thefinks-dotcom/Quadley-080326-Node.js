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
  Clock, ChevronRight, ArrowLeft, ExternalLink, Eye, AlertCircle,
  ChevronDown, ChevronUp, Users
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const BLANK_FORM = {
  is_anonymous: false,
  report_category: '',
  report_type: 'disclosure',
  incident_type: '',
  incident_date: '',
  incident_location: '',
  description: '',
  reporter_relationship: 'self',
  third_party_details: '',
  individuals_involved: '',
  witness_present: false,
  witness_details: '',
  reported_elsewhere: [],
  immediate_danger: false,
  medical_attention_needed: false,
  desired_outcome: '',
  support_requested: [],
  preferred_contact: '',
  additional_notes: '',
  demographics: {
    role_at_college: '',
    sex: '',
    gender_identity: '',
    indigeneity: '',
    sexual_orientation: '',
    year_of_birth: '',
    race_ethnicity: '',
    religion: '',
    country_of_birth: '',
    languages_at_home: '',
    disability: '',
    neurodiversity: '',
  }
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

const REPORT_CATEGORIES = [
  {
    key: 'sexual_harm_gbv',
    label: 'Sexual Harm or Gender-Based Violence',
    desc: 'Sexual assault, harassment, image-based abuse, stalking, or other gender-based violence',
    icon: Shield,
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    border: 'border-destructive/30 hover:border-destructive',
    hover: 'hover:bg-destructive/5',
  },
  {
    key: 'bullying_harassment',
    label: 'Bullying or Harassment',
    desc: 'Repeated behaviour that distresses, offends, intimidates, or threatens you',
    icon: AlertTriangle,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    border: 'border-orange-200 hover:border-orange-400',
    hover: 'hover:bg-orange-50',
  },
  {
    key: 'discrimination',
    label: 'Discrimination',
    desc: 'Unfair treatment based on race, gender, disability, religion, or other characteristics',
    icon: Users,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    border: 'border-blue-200 hover:border-blue-400',
    hover: 'hover:bg-blue-50',
  },
  {
    key: 'general_complaint',
    label: 'General Complaint',
    desc: 'Any other breach of college policy or community standards',
    icon: FileText,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    border: 'border-border hover:border-foreground/40',
    hover: 'hover:bg-muted',
  },
  {
    key: 'other_safety',
    label: 'Other Safety Concern',
    desc: "A safety issue or concern that doesn't fit the above categories",
    icon: AlertCircle,
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    border: 'border-yellow-200 hover:border-yellow-400',
    hover: 'hover:bg-yellow-50',
  },
];

const INCIDENT_SUBTYPES = {
  sexual_harm_gbv: ['Sexual Assault', 'Sexual Harassment', 'Image-based Abuse', 'Physical Abuse', 'Emotional/Psychological Abuse', 'Stalking', 'Technology-facilitated Abuse', 'Other'],
  bullying_harassment: ['Verbal Abuse or Bullying', 'Cyberbullying', 'Social Exclusion or Isolation', 'Intimidation or Threats', 'Workplace or Study Harassment', 'Other'],
  discrimination: ['Racial or Ethnic Discrimination', 'Gender or Sex Discrimination', 'Disability Discrimination', 'Religious Discrimination', 'Sexual Orientation Discrimination', 'Age Discrimination', 'Other'],
  general_complaint: ['Breach of College Policy', 'Staff or Tutor Conduct', 'Facility or Accommodation Issue', 'Academic Matter', 'Financial Concern', 'Other'],
  other_safety: ['Physical Safety Hazard', 'Substance Use Concern', 'Mental Health or Wellbeing Concern', 'Environmental Hazard', 'Other'],
};

const PRIOR_REPORTING_OPTIONS = ['Another College', 'The University', 'NSW Police', 'No', 'Prefer not to say'];

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

  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('sdw_seen')) return 'category';
    return 'warning';
  });
  const [reportCategory, setReportCategory] = useState(null);
  const [formData, setFormData] = useState({ ...BLANK_FORM });
  const [submittedCase, setSubmittedCase] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDemographics, setShowDemographics] = useState(false);

  const isAdmin = ['admin', 'super_admin', 'college_admin'].includes(user?.role);

  const resetAll = () => {
    setView('category');
    setReportCategory(null);
    setFormData({ ...BLANK_FORM });
    setSubmittedCase(null);
    setShowDemographics(false);
  };

  const acknowledgeWarning = () => {
    if (typeof window !== 'undefined') sessionStorage.setItem('sdw_seen', '1');
    setView('category');
  };

  const selectCategory = (cat) => {
    setReportCategory(cat);
    setFormData({ ...BLANK_FORM, report_category: cat.key });
    if (cat.key === 'sexual_harm_gbv') {
      setView('pathway');
    } else {
      setView('form');
    }
  };

  const startForm = (type) => {
    setFormData(prev => ({ ...prev, report_type: type }));
    setView('form');
  };

  const handleSupportToggle = (s) => {
    setFormData(prev => ({
      ...prev,
      support_requested: prev.support_requested.includes(s)
        ? prev.support_requested.filter(x => x !== s)
        : [...prev.support_requested, s]
    }));
  };

  const handlePriorReportToggle = (option) => {
    setFormData(prev => ({
      ...prev,
      reported_elsewhere: prev.reported_elsewhere.includes(option)
        ? prev.reported_elsewhere.filter(x => x !== option)
        : [...prev.reported_elsewhere, option]
    }));
  };

  const setDemo = (field, val) => {
    setFormData(prev => ({ ...prev, demographics: { ...prev.demographics, [field]: val } }));
  };

  const submitDisclosure = async (e) => {
    e.preventDefault();
    if (!formData.incident_type) { toast.error('Please select the type of incident'); return; }
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

  const currentCategory = reportCategory || REPORT_CATEGORIES.find(c => c.key === 'sexual_harm_gbv');
  const subtypes = INCIDENT_SUBTYPES[reportCategory?.key] || INCIDENT_SUBTYPES.sexual_harm_gbv;
  const isGBV = reportCategory?.key === 'sexual_harm_gbv';
  const showSafety = isGBV || reportCategory?.key === 'other_safety';

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

  const backHandler = view === 'category' ? () => setView('warning')
    : view === 'pathway' ? () => setView('category')
    : view === 'form' ? () => setView(isGBV ? 'pathway' : 'category')
    : view === 'confirmation' ? resetAll
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Safe Disclosure"
        showBack={view !== 'warning' && view !== 'category'}
        onBack={backHandler}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-10 space-y-4 max-w-2xl mx-auto">

        {/* ── WARNING SCREEN ── */}
        {view === 'warning' && (
          <div className="space-y-5">
            <div className="bg-destructive/5 border-l-4 border-destructive p-5 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-1 text-destructive">Content Warning</h2>
                  <p className="text-sm text-muted-foreground">This form asks about experiences of gender-based violence, harassment, discrimination, and other safety concerns. Please take care when completing it.</p>
                </div>
              </div>
            </div>

            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-base">Before you begin</h3>
              <p className="text-sm text-muted-foreground">You can use this form to report any incident or concern that breaches college policy — including sexual harm or GBV, bullying, discrimination, or other safety concerns. You may report anonymously or with your name, whatever feels right.</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" /> Reports are reviewed by the college's senior wellbeing team</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" /> If you provide contact details, we can follow up and offer support</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" /> If you remain anonymous, the information informs risk management and prevention strategies</p>
              </div>
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p className="font-semibold">If you need support before completing this form:</p>
                <p>Dean of Students — contact your college directly</p>
                <p className="font-semibold">1800RESPECT (24/7): <span className="text-destructive font-bold">1800 737 732</span></p>
                <p>Emergency: <span className="text-destructive font-bold">000</span></p>
              </div>
            </Card>

            <Button className="w-full" size="lg" onClick={acknowledgeWarning}>
              I understand — continue <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ── CATEGORY SELECTION ── */}
        {view === 'category' && (
          <>
            <div className="bg-muted border-l-4 border-border p-5 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">Make a Report</h2>
                  <p className="text-sm text-muted-foreground">This is a confidential space. Everything you share is treated with the highest level of care. Select what you would like to report.</p>
                </div>
              </div>
            </div>

            <Card className="p-4 border-l-4 border-destructive/30">
              <h3 className="font-semibold text-sm mb-2 text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Immediate Support</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted p-2.5 rounded-lg"><p className="font-semibold text-xs">Emergency</p><p className="text-lg font-bold text-destructive">000</p></div>
                <div className="bg-muted p-2.5 rounded-lg"><p className="font-semibold text-xs">1800 RESPECT</p><p className="text-lg font-bold">1800 737 732</p></div>
                <div className="bg-muted p-2.5 rounded-lg"><p className="font-semibold text-xs">Lifeline</p><p className="text-lg font-bold">13 11 14</p></div>
                <div className="bg-muted p-2.5 rounded-lg"><p className="font-semibold text-xs">Campus Security</p><p className="text-xs text-muted-foreground mt-1">24/7 on-campus</p></div>
              </div>
            </Card>

            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">What would you like to report?</p>
              <div className="grid gap-3">
                {REPORT_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => selectCategory(cat)}
                      className={`text-left p-4 rounded-xl border-2 bg-background transition-all group ${cat.border} ${cat.hover}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl ${cat.iconBg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-4 w-4 ${cat.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-sm">{cat.label}</h3>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{cat.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {user && (
              <Card className="p-5">
                <h3 className="font-semibold text-base mb-4 flex items-center gap-2"><Eye className="h-4 w-4" /> My Submissions</h3>
                <StudentCaseTracker userId={user.id} onNewCase={() => selectCategory(REPORT_CATEGORIES[0])} />
              </Card>
            )}
          </>
        )}

        {/* ── PATHWAY (GBV only) ── */}
        {view === 'pathway' && (
          <>
            <div className="p-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm text-destructive">Sexual Harm or Gender-Based Violence</p>
                <button type="button" onClick={() => setView('category')} className="text-xs underline text-muted-foreground mt-0.5 hover:text-foreground">Change category</button>
              </div>
            </div>

            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">How would you like to proceed?</p>
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
          </>
        )}

        {/* ── FORM ── */}
        {view === 'form' && (
          <form onSubmit={submitDisclosure} className="space-y-5">

            {/* Category + pathway banner */}
            <div className={`p-4 rounded-xl border-2 flex items-start gap-3 ${formData.report_type === 'formal_complaint' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.report_type === 'formal_complaint' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                {formData.report_type === 'formal_complaint' ? <FileText className="h-4 w-4 text-orange-600" /> : <Heart className="h-4 w-4 text-blue-600" />}
              </div>
              <div>
                <p className={`font-semibold text-sm ${formData.report_type === 'formal_complaint' ? 'text-orange-700' : 'text-blue-700'}`}>
                  {currentCategory?.label}
                  {isGBV && (
                    <span className="ml-2 font-normal opacity-80">
                      — {formData.report_type === 'formal_complaint' ? 'Formal Complaint (45-day investigation clock starts on submission)' : 'Disclosure (support only, no investigation)'}
                    </span>
                  )}
                </p>
                <button type="button" onClick={() => setView(isGBV ? 'pathway' : 'category')} className="text-xs underline text-muted-foreground mt-0.5 hover:text-foreground">Change selection</button>
              </div>
            </div>

            {/* Anonymity */}
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

            {/* Reporter relationship */}
            <div>
              <Label className="font-semibold">Did this incident happen to you or someone else? *</Label>
              <div className="grid gap-2 mt-2">
                {[
                  { value: 'self', label: 'It happened to me' },
                  { value: 'third_party', label: 'It happened to someone else' },
                  { value: 'unsure', label: "I'm not sure / prefer not to say" },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.reporter_relationship === opt.value ? 'bg-primary/10 border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                    <input type="radio" name="reporter_relationship" value={opt.value}
                      checked={formData.reporter_relationship === opt.value}
                      onChange={() => setFormData({ ...formData, reporter_relationship: opt.value })} />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
              {formData.reporter_relationship === 'third_party' && (
                <div className="mt-3">
                  <Label className="text-sm">Details about the affected person (optional)</Label>
                  <Input className="mt-1" placeholder="e.g. first name, year, floor — share only what you're comfortable with"
                    value={formData.third_party_details}
                    onChange={e => setFormData({ ...formData, third_party_details: e.target.value })} />
                </div>
              )}
            </div>

            {/* Incident type */}
            <div>
              <Label className="font-semibold">Type of Incident *</Label>
              <Select value={formData.incident_type} onValueChange={v => setFormData({ ...formData, incident_type: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select incident type..." /></SelectTrigger>
                <SelectContent>{subtypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* When + where */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>When did this occur?</Label>
                <p className="text-xs text-muted-foreground mb-1">Approximate dates are fine</p>
                <Input type="date" className="mt-1" value={formData.incident_date?.split('T')[0] || ''}
                  onChange={e => setFormData({ ...formData, incident_date: e.target.value })} />
              </div>
              <div>
                <Label>Where?</Label>
                <p className="text-xs text-muted-foreground mb-1">Describe as best you can</p>
                <Input className="mt-1" placeholder="e.g. Floor 3, Library..." value={formData.incident_location}
                  onChange={e => setFormData({ ...formData, incident_location: e.target.value })} />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="font-semibold">Describe the incident *</Label>
              <p className="text-xs text-muted-foreground mb-1">Share as much or as little as you are comfortable with.</p>
              <Textarea rows={5} required value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what happened in your own words..." />
            </div>

            {/* People involved */}
            <div>
              <Label>Other people involved (optional)</Label>
              <Textarea rows={2} className="mt-1" value={formData.individuals_involved}
                onChange={e => setFormData({ ...formData, individuals_involved: e.target.value })}
                placeholder="Names, descriptions, or other identifying information — e.g. witnesses, staff, students..." />
            </div>

            {/* Witnesses (GBV only) */}
            {isGBV && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="witness" checked={formData.witness_present}
                    onChange={e => setFormData({ ...formData, witness_present: e.target.checked })} />
                  <Label htmlFor="witness" className="cursor-pointer">Were there any witnesses?</Label>
                </div>
                {formData.witness_present && (
                  <Textarea rows={2} value={formData.witness_details}
                    onChange={e => setFormData({ ...formData, witness_details: e.target.value })}
                    placeholder="Witness names or descriptions..." />
                )}
              </div>
            )}

            {/* Prior reporting */}
            <div>
              <Label className="font-semibold">Have you reported this anywhere else?</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {PRIOR_REPORTING_OPTIONS.map(opt => (
                  <label key={opt} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.reported_elsewhere.includes(opt) ? 'bg-primary/10 border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                    <input type="checkbox" checked={formData.reported_elsewhere.includes(opt)}
                      onChange={() => handlePriorReportToggle(opt)} />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Safety assessment */}
            {showSafety && (
              <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/20 space-y-2">
                <p className="font-semibold text-destructive text-sm">Safety Check</p>
                {[
                  { id: 'immediate_danger', label: 'I am in immediate danger', field: 'immediate_danger' },
                  { id: 'medical', label: 'I need medical attention', field: 'medical_attention_needed' },
                ].map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input type="checkbox" id={item.id} checked={formData[item.field]}
                      onChange={e => setFormData({ ...formData, [item.field]: e.target.checked })} />
                    <Label htmlFor={item.id} className="cursor-pointer text-sm">{item.label}</Label>
                  </div>
                ))}
                {(formData.immediate_danger || formData.medical_attention_needed) && (
                  <p className="text-sm text-destructive font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> If you're in immediate danger, please call 000 now.
                  </p>
                )}
              </div>
            )}

            {/* Desired outcome */}
            <div>
              <Label className="font-semibold">What action would you like taken? *</Label>
              <p className="text-xs text-muted-foreground mb-1">e.g. I want someone to check in with me, I want the college to investigate, I want this recorded only, I'm not sure yet</p>
              <Textarea rows={3} required value={formData.desired_outcome}
                onChange={e => setFormData({ ...formData, desired_outcome: e.target.value })}
                placeholder="Describe the outcome you'd like..." />
            </div>

            {/* Support services */}
            <div>
              <Label className="font-semibold">What support would be helpful? (optional)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {supportOptions.map(o => (
                  <div key={o}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.support_requested.includes(o) ? 'bg-primary/10 border-primary' : 'bg-background border-border hover:bg-muted'}`}
                    onClick={() => handleSupportToggle(o)}>
                    <input type="checkbox" checked={formData.support_requested.includes(o)}
                      onChange={() => handleSupportToggle(o)} onClick={e => e.stopPropagation()} />
                    <span className="text-sm">{o}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact */}
            {!formData.is_anonymous && (
              <div>
                <Label>Preferred contact method</Label>
                <Input className="mt-1" placeholder="Email, phone, or other..."
                  value={formData.preferred_contact}
                  onChange={e => setFormData({ ...formData, preferred_contact: e.target.value })} />
              </div>
            )}

            {/* Additional notes */}
            <div>
              <Label>Additional information (optional)</Label>
              <Textarea rows={3} className="mt-1" value={formData.additional_notes}
                onChange={e => setFormData({ ...formData, additional_notes: e.target.value })}
                placeholder="Anything else you'd like us to know..." />
            </div>

            {/* Demographics section */}
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDemographics(v => !v)}
                className="w-full flex items-center justify-between p-4 bg-muted hover:bg-muted/80 transition-colors text-left"
              >
                <div>
                  <p className="font-semibold text-sm">Demographic Information (Optional)</p>
                  <p className="text-xs text-muted-foreground">Required under the National Code for de-identified reporting. All fields optional.</p>
                </div>
                {showDemographics ? <ChevronUp className="h-4 w-4 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" />}
              </button>

              {showDemographics && (
                <div className="p-4 space-y-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Your role at the college</Label>
                      <Select value={formData.demographics.role_at_college} onValueChange={v => setDemo('role_at_college', v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {['Current Resident', 'Current Affiliate', 'Staff Member', 'Alumna / Alumnus', 'Student at Another College', 'Member of the Public'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Sex</Label>
                      <Select value={formData.demographics.sex} onValueChange={v => setDemo('sex', v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {['Female', 'Male', 'Intersex', 'Prefer not to say'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Gender Identity</Label>
                      <Select value={formData.demographics.gender_identity} onValueChange={v => setDemo('gender_identity', v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {['Woman', 'Man', 'Non-binary', 'Gender Diverse', 'Prefer not to say'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Indigeneity</Label>
                      <Select value={formData.demographics.indigeneity} onValueChange={v => setDemo('indigeneity', v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {['Not Aboriginal or Torres Strait Islander', 'Aboriginal', 'Torres Strait Islander', 'Both Aboriginal and Torres Strait Islander', 'Australian South Sea Islander', 'Other First Nations', 'Prefer not to say'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Living with a disability?</Label>
                      <Select value={formData.demographics.disability} onValueChange={v => setDemo('disability', v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {['Yes', 'No', 'Prefer not to say'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Identify as neurodiverse?</Label>
                      <Select value={formData.demographics.neurodiversity} onValueChange={v => setDemo('neurodiversity', v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {['Yes', 'No', 'Unsure', 'Prefer not to say'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Year of birth</Label>
                      <Input className="mt-1" type="number" placeholder="e.g. 2001"
                        value={formData.demographics.year_of_birth}
                        onChange={e => setDemo('year_of_birth', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm">Country of birth</Label>
                      <Input className="mt-1" placeholder="e.g. Australia"
                        value={formData.demographics.country_of_birth}
                        onChange={e => setDemo('country_of_birth', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <Label className="text-sm">Sexual orientation</Label>
                      <Input className="mt-1" placeholder="Describe in your own words..."
                        value={formData.demographics.sexual_orientation}
                        onChange={e => setDemo('sexual_orientation', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm">Race / ethnicity (CALD)</Label>
                      <Input className="mt-1" placeholder="Describe in your own words..."
                        value={formData.demographics.race_ethnicity}
                        onChange={e => setDemo('race_ethnicity', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm">Religion</Label>
                      <Input className="mt-1" placeholder="Describe in your own words..."
                        value={formData.demographics.religion}
                        onChange={e => setDemo('religion', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm">Languages used at home</Label>
                      <Input className="mt-1" placeholder="e.g. English, Mandarin..."
                        value={formData.demographics.languages_at_home}
                        onChange={e => setDemo('languages_at_home', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t">
              <Button type="submit" disabled={submitting} className="flex-1">
                <Lock className="h-4 w-4 mr-2" />{submitting ? 'Submitting...' : 'Submit Confidentially'}
              </Button>
              <Button type="button" variant="outline" onClick={resetAll}>Cancel</Button>
            </div>
          </form>
        )}

        {/* ── CONFIRMATION ── */}
        {view === 'confirmation' && submittedCase && (
          <div className="space-y-5">
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Submission Received</h2>
              <p className="text-muted-foreground text-sm">Your {submittedCase.report_type === 'formal_complaint' ? 'formal complaint' : 'report'} has been received safely and confidentially.</p>
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
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-blue-600 font-bold text-xs">1</span></div><div><p className="font-medium">Review within 48 hours</p><p className="text-muted-foreground text-xs">The wellbeing team will review your submission and reach out if you've provided contact details.</p></div></div>
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-blue-600 font-bold text-xs">2</span></div><div><p className="font-medium">Support arranged</p><p className="text-muted-foreground text-xs">Access to counseling, medical, legal, or other services can be arranged based on your needs.</p></div></div>
                  <div className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-blue-600 font-bold text-xs">3</span></div><div><p className="font-medium">You stay in control</p><p className="text-muted-foreground text-xs">No investigation happens without your consent. You can escalate at any time.</p></div></div>
                </div>
              )}
            </Card>

            <div className="flex gap-3">
              <Button className="flex-1" onClick={resetAll}>Done</Button>
              <Button variant="outline" onClick={() => setView('category')}>View My Cases</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SafeDisclosureModule;
