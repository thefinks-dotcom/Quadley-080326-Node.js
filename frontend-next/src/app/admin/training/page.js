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
  GraduationCap, ArrowLeft, AlertTriangle, CheckCircle, Clock,
  Plus, Users, Search, RefreshCw, X
} from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';

const TRAINING_TYPES = [
  'GBV Disclosure Training',
  'Trauma-Informed Response',
  'Bystander Intervention',
  'Survivor Support Coordination',
  'Mandatory Reporting Obligations',
];

const ADMIN_ROLES = ['admin', 'super_admin', 'college_admin'];

function StatusBadge({ status }) {
  const cfg = {
    current: { label: 'Current', cls: 'bg-green-100 text-green-700 border-green-200' },
    expiring_soon: { label: 'Expiring Soon', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 border-red-200' },
    never_trained: { label: 'Never Trained', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  }[status] || { label: status, cls: 'bg-muted text-foreground border-border' };
  return <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>;
}

export default function TrainingCompliancePage() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    user_id: '',
    user_name: '',
    user_role: '',
    training_type: TRAINING_TYPES[0],
    training_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [userSearch, setUserSearch] = useState('');
  const [saving, setSaving] = useState(false);

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
      const [statsRes, recordsRes, usersRes] = await Promise.all([
        axios.get(`${API}/gbv-training/stats`),
        axios.get(`${API}/gbv-training`),
        axios.get(`${API}/users`),
      ]);
      setStats(statsRes.data);
      setRecords(Array.isArray(recordsRes.data) ? recordsRes.data : []);
      setAllUsers(Array.isArray(usersRes.data) ? usersRes.data.filter(u => ['admin', 'ra', 'college_admin'].includes(u.role)) : []);
    } catch (e) {
      toast.error('Failed to load training data');
    } finally {
      setLoading(false);
    }
  };

  const submitRecord = async () => {
    if (!form.user_id || !form.training_date) { toast.error('Please select a user and date'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/gbv-training/record`, form);
      toast.success('Training record saved');
      setShowAddModal(false);
      setForm({ user_id: '', user_name: '', user_role: '', training_type: TRAINING_TYPES[0], training_date: new Date().toISOString().split('T')[0], notes: '' });
      setUserSearch('');
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const q = userSearch.toLowerCase();
    return !q || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const filteredRecords = records.filter(r => {
    const q = search.toLowerCase();
    return !q || r.user_name?.toLowerCase().includes(q) || r.training_type?.toLowerCase().includes(q);
  });

  const filteredStaff = (stats?.staff_status || []).filter(s => {
    const q = search.toLowerCase();
    return !q || s.user_name?.toLowerCase().includes(q);
  });

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
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/80 hover:text-white hover:bg-white/10 mb-4 -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="h-6 w-6" />
                <h1 className="text-2xl font-bold">GBV Training Compliance</h1>
              </div>
              <p className="text-white/80 text-sm">Standard 3 — National Higher Education Code</p>
            </div>
            <Button onClick={() => setShowAddModal(true)} className="bg-white text-primary hover:bg-white/90 gap-1 text-sm">
              <Plus className="h-4 w-4" /> Record Training
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Compliance Rate', value: `${stats.compliance_rate}%`, sub: 'Current training', color: 'text-green-700 bg-green-50 border-green-200' },
              { label: 'Training Overdue', value: stats.overdue + stats.never_trained, sub: `${stats.never_trained} never trained`, color: 'text-red-700 bg-red-50 border-red-200' },
              { label: 'Expiring Soon', value: stats.expiring_soon, sub: 'Within 60 days', color: 'text-amber-700 bg-amber-50 border-amber-200' },
              { label: 'Total Staff', value: stats.total_staff, sub: 'Admin & RA roles', color: 'text-blue-700 bg-blue-50 border-blue-200' },
            ].map(s => (
              <div key={s.label} className={`p-3 rounded-xl border ${s.color}`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs font-medium mt-0.5">{s.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {stats && (stats.overdue + stats.never_trained) > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span className="text-red-700 font-medium">
              {stats.overdue + stats.never_trained} staff member{stats.overdue + stats.never_trained !== 1 ? 's' : ''} require training action. Standard 3 requires annual completion.
            </span>
          </div>
        )}

        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {[
            { key: 'overview', label: 'Staff Status' },
            { key: 'records', label: 'Training History' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === 'overview' ? 'Search staff...' : 'Search records...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-2">
            {filteredStaff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No staff found.</p>
              </div>
            ) : filteredStaff.map(s => (
              <div key={s.user_id} className="bg-white rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm">{s.user_name}</p>
                    <span className="text-xs capitalize text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{s.user_role}</span>
                  </div>
                  {s.last_training_date ? (
                    <p className="text-xs text-muted-foreground">
                      Last: {s.last_training_type} · {new Date(s.last_training_date).toLocaleDateString()}
                      {s.expiry_date && ` · Expires ${new Date(s.expiry_date).toLocaleDateString()}`}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No training recorded</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={s.status} />
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                    setForm(f => ({ ...f, user_id: s.user_id, user_name: s.user_name, user_role: s.user_role }));
                    setShowAddModal(true);
                  }}>
                    Record
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'records' && (
          <div className="space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No training records yet.</p>
              </div>
            ) : filteredRecords.map(r => (
              <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{r.user_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.user_role}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <p>{new Date(r.training_date).toLocaleDateString()}</p>
                    <p className="text-xs">Expires {new Date(r.expiry_date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{r.training_type}</span>
                  {r.notes && <span className="text-xs text-muted-foreground">{r.notes}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recorded by {r.recorded_by_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomSheet
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Record Training Completion"
        footer={
          <Button onClick={submitRecord} disabled={saving || !form.user_id} className="w-full">
            {saving ? 'Saving...' : 'Save Training Record'}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2">Staff Member</Label>
            {form.user_id ? (
              <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm">
                <div>
                  <p className="font-semibold">{form.user_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{form.user_role}</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, user_id: '', user_name: '', user_role: '' }))} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  autoFocus
                />
                {userSearch && (
                  <div className="border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">No staff found</p>
                    ) : filteredUsers.map(u => (
                      <button
                        key={u.id}
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex items-center gap-2"
                        onClick={() => {
                          setForm(f => ({ ...f, user_id: u.id, user_name: `${u.first_name} ${u.last_name}`, user_role: u.role }));
                          setUserSearch('');
                        }}
                      >
                        <div>
                          <p className="font-medium">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{u.role} · {u.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium mb-1">Training Type</Label>
            <select
              value={form.training_type}
              onChange={e => setForm(f => ({ ...f, training_type: e.target.value }))}
              className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 mt-1"
            >
              {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1">Date Completed</Label>
            <Input
              type="date"
              value={form.training_date}
              onChange={e => setForm(f => ({ ...f, training_date: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-1">Notes (optional)</Label>
            <Input
              placeholder="e.g. Attended college workshop, online module..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
            Training records expire annually (365 days from completion date). Standard 3 of the National Higher Education Code requires annual renewal.
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}
