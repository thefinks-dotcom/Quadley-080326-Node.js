'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Heart, ArrowLeft, Users, AlertTriangle, CheckCircle, Clock,
  Plus, Search, X, ChevronDown, FileText, Shield
} from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';

const RELATIONSHIP_TYPES = [
  'Romantic / Personal Intimate',
  'Close Personal Friendship',
  'Family Relationship',
  'Financial Dependency',
  'Prior Supervisory Relationship',
  'Other',
];

const PARTY_ROLES = ['student', 'ra', 'admin', 'college_admin', 'staff', 'tutor', 'other'];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'under_review', label: 'Under Review', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'management_plan_issued', label: 'Plan Issued', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'resolved', label: 'Resolved', cls: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'closed', label: 'Closed', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
];

const ADMIN_ROLES = ['admin', 'super_admin', 'college_admin'];

function StatusBadge({ status }) {
  const cfg = STATUS_OPTIONS.find(o => o.value === status) || { label: status, cls: 'bg-muted text-foreground border-border' };
  return <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>;
}

function RelationshipTypeBadge({ type }) {
  const colors = {
    'Romantic / Personal Intimate': 'bg-rose-50 text-rose-700 border-rose-200',
    'Close Personal Friendship': 'bg-orange-50 text-orange-700 border-orange-200',
    'Family Relationship': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Financial Dependency': 'bg-teal-50 text-teal-700 border-teal-200',
    'Prior Supervisory Relationship': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Other': 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${colors[type] || 'bg-muted text-foreground border-border'}`}>{type}</span>;
}

const emptyForm = {
  disclosed_by_name: '',
  disclosed_by_role: 'student',
  disclosed_by_id: '',
  other_party_name: '',
  other_party_role: 'student',
  other_party_id: '',
  relationship_type: RELATIONSHIP_TYPES[0],
  disclosure_date: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function RelationshipDisclosuresPage() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const router = useRouter();

  const [disclosures, setDisclosures] = useState([]);
  const [stats, setStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [userSearch, setUserSearch] = useState('');
  const [otherUserSearch, setOtherUserSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedDisclosure, setSelectedDisclosure] = useState(null);
  const [updateForm, setUpdateForm] = useState({ status: '', resolution_notes: '', management_plan: '' });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (!ADMIN_ROLES.includes(user.role)) {
        router.replace('/admin');
        return;
      }
      loadData();
    }
  }, [user, authLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [discRes, statsRes, usersRes] = await Promise.all([
        axios.get(`${API}/relationship-disclosures`),
        axios.get(`${API}/relationship-disclosures/stats`),
        axios.get(`${API}/users`),
      ]);
      setDisclosures(Array.isArray(discRes.data) ? discRes.data : []);
      setStats(statsRes.data);
      setAllUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (e) {
      toast.error('Failed to load disclosures');
    } finally {
      setLoading(false);
    }
  };

  const submitDisclosure = async () => {
    if (!form.disclosed_by_name || !form.other_party_name) {
      toast.error('Both party names are required');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/relationship-disclosures`, form);
      toast.success('Disclosure logged successfully');
      setShowAddModal(false);
      setForm(emptyForm);
      setUserSearch('');
      setOtherUserSearch('');
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to log disclosure');
    } finally {
      setSaving(false);
    }
  };

  const updateDisclosure = async () => {
    setUpdating(true);
    try {
      const updated = await axios.patch(`${API}/relationship-disclosures/${selectedDisclosure.id}`, updateForm);
      toast.success('Disclosure updated');
      setSelectedDisclosure(updated.data);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update disclosure');
    } finally {
      setUpdating(false);
    }
  };

  const openDisclosure = (d) => {
    setSelectedDisclosure(d);
    setUpdateForm({ status: d.status, resolution_notes: d.resolution_notes || '', management_plan: d.management_plan || '' });
  };

  const filteredDisclosures = disclosures.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (typeFilter && d.relationship_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.disclosed_by_name?.toLowerCase().includes(q) ||
        d.other_party_name?.toLowerCase().includes(q) ||
        d.relationship_type?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredUsers = (query, excludeId) => {
    if (!query) return [];
    const q = query.toLowerCase();
    return allUsers.filter(u =>
      u.id !== excludeId &&
      (`${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    ).slice(0, 8);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="bg-primary text-white px-4 pt-10 pb-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-white/80 hover:text-white text-sm mb-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Heart className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Relationship Disclosures</h1>
              </div>
              <p className="text-white/80 text-sm">Governance tracking for staff/student and student/student relationships</p>
            </div>
            <Button onClick={() => setShowAddModal(true)} className="bg-white text-primary hover:bg-white/90 gap-1 text-sm">
              <Plus className="h-4 w-4" /> Log Disclosure
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-5">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Disclosures', value: stats.total, sub: 'All time', color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { label: 'Active / Pending', value: stats.active + stats.under_review, sub: `${stats.under_review} under review`, color: 'text-amber-700 bg-amber-50 border-amber-200' },
              { label: 'Plans Issued', value: stats.management_plan_issued, sub: 'Management plans', color: 'text-purple-700 bg-purple-50 border-purple-200' },
              { label: 'Resolved', value: stats.resolved, sub: 'Closed / resolved', color: 'text-green-700 bg-green-50 border-green-200' },
            ].map(s => (
              <div key={s.label} className={`p-3 rounded-xl border ${s.color}`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs font-medium mt-0.5">{s.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {stats && (stats.active + stats.under_review) > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span className="text-amber-700 font-medium">
              {stats.active + stats.under_review} active disclosure{stats.active + stats.under_review !== 1 ? 's' : ''} require governance attention. Ensure management plans are in place where required.
            </span>
          </div>
        )}

        {stats && (stats.staff_student > 0 || stats.student_student > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-xl text-center">
              <p className="text-xl font-bold">{stats.staff_student}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Staff involved</p>
            </div>
            <div className="p-3 bg-muted rounded-xl text-center">
              <p className="text-xl font-bold">{stats.student_student}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Student–student</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or type..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm bg-white border border-border rounded-lg px-3 py-2 min-w-[130px]"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-sm bg-white border border-border rounded-lg px-3 py-2 min-w-[160px]"
          >
            <option value="">All Types</option>
            {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {filteredDisclosures.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No disclosures found</p>
              <p className="text-sm mt-1">Logged disclosures will appear here</p>
            </div>
          ) : filteredDisclosures.map(d => (
            <button
              key={d.id}
              onClick={() => openDisclosure(d)}
              className="w-full bg-white rounded-xl p-4 text-left shadow-sm hover:shadow-md transition-shadow border border-transparent hover:border-border"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm">{d.disclosed_by_name}</p>
                    <span className="text-muted-foreground text-xs">↔</span>
                    <p className="font-semibold text-sm">{d.other_party_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <RelationshipTypeBadge type={d.relationship_type} />
                    <span className="text-xs text-muted-foreground">
                      {d.disclosed_by_role} ↔ {d.other_party_role}
                    </span>
                  </div>
                  {d.notes && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{d.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <StatusBadge status={d.status} />
                  <p className="text-xs text-muted-foreground">{new Date(d.disclosure_date).toLocaleDateString()}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground py-2">
          All records are tenant-isolated and subject to your college's privacy policy.
        </p>
      </div>

      <BottomSheet
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Log Relationship Disclosure"
        footer={
          <Button onClick={submitDisclosure} disabled={saving || !form.disclosed_by_name || !form.other_party_name} className="w-full">
            {saving ? 'Saving...' : 'Log Disclosure'}
          </Button>
        }
      >
        <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                <Shield className="h-4 w-4 inline mr-1" />
                Relationship disclosures are confidential governance records. Only college administrators can view them.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1">Party 1 — Disclosing Person</Label>
                  {form.disclosed_by_id ? (
                    <div className="flex items-center justify-between p-2 bg-primary/5 border border-primary/20 rounded-lg text-sm mt-1">
                      <div>
                        <p className="font-medium text-xs">{form.disclosed_by_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{form.disclosed_by_role}</p>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, disclosed_by_id: '', disclosed_by_name: '', disclosed_by_role: 'student' }))}><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <Input
                        placeholder="Search user or type name..."
                        value={userSearch}
                        onChange={e => { setUserSearch(e.target.value); setForm(f => ({ ...f, disclosed_by_name: e.target.value })); }}
                        className="text-sm"
                      />
                      {userSearch && filteredUsers(userSearch, form.other_party_id).length > 0 && (
                        <div className="border border-border rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                          {filteredUsers(userSearch, form.other_party_id).map(u => (
                            <button
                              key={u.id}
                              className="w-full px-3 py-1.5 text-left hover:bg-muted text-xs"
                              onClick={() => { setForm(f => ({ ...f, disclosed_by_id: u.id, disclosed_by_name: `${u.first_name} ${u.last_name}`, disclosed_by_role: u.role })); setUserSearch(''); }}
                            >
                              {u.first_name} {u.last_name} <span className="text-muted-foreground capitalize">({u.role})</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <select
                        value={form.disclosed_by_role}
                        onChange={e => setForm(f => ({ ...f, disclosed_by_role: e.target.value }))}
                        className="w-full text-xs bg-white border border-border rounded px-2 py-1.5"
                      >
                        {PARTY_ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1">Party 2 — Other Person</Label>
                  {form.other_party_id ? (
                    <div className="flex items-center justify-between p-2 bg-primary/5 border border-primary/20 rounded-lg text-sm mt-1">
                      <div>
                        <p className="font-medium text-xs">{form.other_party_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{form.other_party_role}</p>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, other_party_id: '', other_party_name: '', other_party_role: 'student' }))}><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <Input
                        placeholder="Search user or type name..."
                        value={otherUserSearch}
                        onChange={e => { setOtherUserSearch(e.target.value); setForm(f => ({ ...f, other_party_name: e.target.value })); }}
                        className="text-sm"
                      />
                      {otherUserSearch && filteredUsers(otherUserSearch, form.disclosed_by_id).length > 0 && (
                        <div className="border border-border rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                          {filteredUsers(otherUserSearch, form.disclosed_by_id).map(u => (
                            <button
                              key={u.id}
                              className="w-full px-3 py-1.5 text-left hover:bg-muted text-xs"
                              onClick={() => { setForm(f => ({ ...f, other_party_id: u.id, other_party_name: `${u.first_name} ${u.last_name}`, other_party_role: u.role })); setOtherUserSearch(''); }}
                            >
                              {u.first_name} {u.last_name} <span className="text-muted-foreground capitalize">({u.role})</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <select
                        value={form.other_party_role}
                        onChange={e => setForm(f => ({ ...f, other_party_role: e.target.value }))}
                        className="w-full text-xs bg-white border border-border rounded px-2 py-1.5"
                      >
                        {PARTY_ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1">Relationship Type</Label>
                <select
                  value={form.relationship_type}
                  onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))}
                  className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 mt-1"
                >
                  {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1">Date of Disclosure</Label>
                <Input
                  type="date"
                  value={form.disclosure_date}
                  onChange={e => setForm(f => ({ ...f, disclosure_date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-1">Notes (optional)</Label>
                <textarea
                  className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 min-h-[70px] resize-none"
                  placeholder="Context, circumstances, or any relevant details..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

        </div>
      </BottomSheet>

      {selectedDisclosure && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setSelectedDisclosure(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl flex flex-col" style={{ maxHeight: '90dvh' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-bold text-lg">Disclosure Details</h3>
              <button onClick={() => setSelectedDisclosure(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-xs text-muted-foreground mb-0.5">Party 1</p>
                  <p className="font-semibold text-sm">{selectedDisclosure.disclosed_by_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedDisclosure.disclosed_by_role}</p>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-xs text-muted-foreground mb-0.5">Party 2</p>
                  <p className="font-semibold text-sm">{selectedDisclosure.other_party_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedDisclosure.other_party_role}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <RelationshipTypeBadge type={selectedDisclosure.relationship_type} />
                <StatusBadge status={selectedDisclosure.status} />
                <span className="text-xs text-muted-foreground">{new Date(selectedDisclosure.disclosure_date).toLocaleDateString()}</span>
              </div>

              {selectedDisclosure.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm bg-muted rounded-lg p-3">{selectedDisclosure.notes}</p>
                </div>
              )}

              {selectedDisclosure.management_plan && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Management Plan</p>
                  <p className="text-sm bg-purple-50 border border-purple-100 rounded-lg p-3">{selectedDisclosure.management_plan}</p>
                </div>
              )}

              {selectedDisclosure.resolution_notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Resolution Notes</p>
                  <p className="text-sm bg-green-50 border border-green-100 rounded-lg p-3">{selectedDisclosure.resolution_notes}</p>
                </div>
              )}

              {selectedDisclosure.activity_log && selectedDisclosure.activity_log.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Activity Log</p>
                  <div className="space-y-1.5">
                    {[...selectedDisclosure.activity_log].reverse().map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <span className="font-medium">{entry.action}</span>
                          <span className="text-muted-foreground"> — {entry.by} · {new Date(entry.at).toLocaleDateString()}</span>
                          {entry.note && <p className="text-muted-foreground mt-0.5">{entry.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-sm font-semibold">Update Disclosure</p>

                <div>
                  <Label className="text-xs font-medium mb-1">Status</Label>
                  <select
                    value={updateForm.status}
                    onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 mt-1"
                  >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1">Management Plan</Label>
                  <textarea
                    className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 min-h-[60px] resize-none mt-1"
                    placeholder="Describe any arrangements, supervision changes, or conflict-of-interest mitigations..."
                    value={updateForm.management_plan}
                    onChange={e => setUpdateForm(f => ({ ...f, management_plan: e.target.value }))}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1">Resolution Notes</Label>
                  <textarea
                    className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 min-h-[60px] resize-none mt-1"
                    placeholder="Outcome or resolution details..."
                    value={updateForm.resolution_notes}
                    onChange={e => setUpdateForm(f => ({ ...f, resolution_notes: e.target.value }))}
                  />
                </div>

              </div>
            </div>
            <div className="p-5 pt-3 shrink-0 border-t border-border">
              <Button onClick={updateDisclosure} disabled={updating} className="w-full">
                {updating ? 'Saving...' : 'Save Update'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
