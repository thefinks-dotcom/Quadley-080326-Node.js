'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Megaphone, ArrowLeft, Plus, Send, Clock, CheckCircle, AlertTriangle,
  Calendar, Users, Trash2, Archive, BarChart2, X, Bell, RotateCcw,
  Eye, TrendingUp
} from 'lucide-react';

const ADMIN_ROLES = ['admin', 'super_admin', 'college_admin', 'ra'];

const TAB_OPTIONS = [
  { key: 'current', label: 'Current', icon: CheckCircle },
  { key: 'scheduled', label: 'Scheduled', icon: Clock },
  { key: 'archived', label: 'Archived', icon: Archive },
];

const emptyForm = {
  title: '',
  content: '',
  target_audience: 'all',
  priority: 'normal',
  is_emergency: false,
  scheduled_date: '',
  send_push: true,
};

function PriorityBadge({ priority, isEmergency }) {
  if (isEmergency) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
      <AlertTriangle className="h-3 w-3" /> Emergency
    </span>
  );
  if (priority === 'high') return (
    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">High</span>
  );
  return null;
}

function ReadBar({ count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{count}/{total} ({pct}%)</span>
    </div>
  );
}

export default function AnnouncementsAdmin() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const router = useRouter();

  const [announcements, setAnnouncements] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('current');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [posting, setPosting] = useState(false);
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [tempScheduleDate, setTempScheduleDate] = useState('');

  const [statsModal, setStatsModal] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (!ADMIN_ROLES.includes(user.role)) {
        router.replace('/admin');
        return;
      }
      loadAll();
    }
  }, [user, authLoading]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [annRes, usersRes] = await Promise.all([
        axios.get(`${API}/announcements?include_scheduled=true&include_archived=true`),
        axios.get(`${API}/users`),
      ]);
      setAnnouncements(Array.isArray(annRes.data) ? annRes.data : []);
      const students = Array.isArray(usersRes.data) ? usersRes.data.filter(u => u.role === 'student') : [];
      setTotalStudents(students.length);
    } catch (e) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setPosting(true);
    try {
      const isScheduled = scheduleConfirmed && !!form.scheduled_date;
      await axios.post(`${API}/announcements`, {
        title: form.title,
        content: form.content,
        target_audience: form.target_audience,
        priority: form.priority,
        is_emergency: form.is_emergency,
        status: isScheduled ? 'scheduled' : 'published',
        scheduled_date: isScheduled ? form.scheduled_date : null,
        send_push: form.send_push,
      });
      toast.success(isScheduled
        ? `Scheduled for ${new Date(form.scheduled_date).toLocaleString()}`
        : form.send_push ? 'Posted and push notification sent' : 'Posted'
      );
      setShowForm(false);
      setForm(emptyForm);
      setScheduleConfirmed(false);
      setTempScheduleDate('');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to post announcement');
    } finally {
      setPosting(false);
    }
  };

  const handleArchive = async (id) => {
    try {
      await axios.put(`${API}/announcements/${id}/archive`);
      toast.success('Announcement archived');
      loadAll();
    } catch (e) {
      toast.error('Failed to archive');
    }
  };

  const handleRestore = async (id) => {
    try {
      await axios.put(`${API}/announcements/${id}/restore`);
      toast.success('Announcement restored');
      loadAll();
    } catch (e) {
      toast.error('Failed to restore');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/announcements/${deleteTarget.id}`);
      toast.success('Announcement deleted');
      setDeleteTarget(null);
      loadAll();
    } catch (e) {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const openStats = async (ann) => {
    setStatsModal(ann);
    setStatsData(null);
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API}/announcements/${ann.id}/read-stats`);
      setStatsData(res.data);
    } catch (e) {
      toast.error('Failed to load read stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const filtered = announcements.filter(ann => {
    if (tab === 'scheduled') return ann.status === 'scheduled';
    if (tab === 'archived') return ann.status === 'archived';
    return ann.status === 'published' || !ann.status;
  });

  const totalUnread = announcements.filter(a => a.status === 'published' || !a.status).length;
  const avgReadPct = totalStudents > 0 && announcements.length > 0
    ? Math.round(announcements.reduce((sum, a) => sum + (a.read_count || 0), 0) / announcements.length / totalStudents * 100)
    : 0;

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" /></div>;
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
                <Megaphone className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Announcements</h1>
              </div>
              <p className="text-white/80 text-sm">{totalUnread} live · avg {avgReadPct}% read rate</p>
            </div>
            <Button onClick={() => setShowForm(true)} className="bg-white text-primary hover:bg-white/90 gap-1 text-sm">
              <Plus className="h-4 w-4" /> New Announcement
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-5 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Live Now', value: announcements.filter(a => a.status === 'published' || !a.status).length, color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { label: 'Scheduled', value: announcements.filter(a => a.status === 'scheduled').length, color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: 'Avg Read Rate', value: `${avgReadPct}%`, color: 'text-green-700 bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`p-3 rounded-xl border text-center ${s.color}`}>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {TAB_OPTIONS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${tab === t.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {tab} announcements</p>
            </div>
          ) : filtered.map(ann => (
            <div
              key={ann.id}
              className={`bg-white rounded-xl shadow-sm border ${ann.is_emergency ? 'border-red-200 bg-red-50' : 'border-transparent'}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${ann.is_emergency ? 'bg-red-100' : 'bg-primary/10'}`}>
                    {ann.is_emergency ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <Megaphone className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm">{ann.title}</h3>
                      <PriorityBadge priority={ann.priority} isEmergency={ann.is_emergency} />
                      {ann.status === 'scheduled' && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Scheduled
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">{ann.target_audience}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{ann.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ann.status === 'scheduled' && ann.scheduled_date
                        ? `Scheduled ${new Date(ann.scheduled_date).toLocaleString()}`
                        : new Date(ann.created_at).toLocaleDateString()
                      }
                      {ann.created_by_name && ` · ${ann.created_by_name}`}
                    </p>
                  </div>
                </div>

                {(ann.status === 'published' || !ann.status) && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Read receipts
                      </span>
                      <button
                        onClick={() => openStats(ann)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <BarChart2 className="h-3 w-3" /> View details
                      </button>
                    </div>
                    <ReadBar count={ann.read_count || 0} total={totalStudents} />
                  </div>
                )}
              </div>

              <div className="px-4 pb-3 flex items-center gap-2 justify-end flex-wrap">
                {(ann.status === 'published' || !ann.status) && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleArchive(ann.id)}>
                    <Archive className="h-3 w-3" /> Archive
                  </Button>
                )}
                {ann.status === 'archived' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleRestore(ann.id)}>
                    <RotateCcw className="h-3 w-3" /> Restore
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setDeleteTarget(ann)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" /> New Announcement
              </h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1">Title *</Label>
                <Input
                  placeholder="Announcement title..."
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-1">Content *</Label>
                <textarea
                  className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 min-h-[100px] resize-none"
                  placeholder="Write your announcement..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1">Audience</Label>
                  <select
                    value={form.target_audience}
                    onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                    className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="all">All Residents</option>
                    <option value="students">Students Only</option>
                    <option value="staff">Staff Only</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1">Priority</Label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <input
                    type="checkbox"
                    id="is_emergency"
                    checked={form.is_emergency}
                    onChange={e => setForm(f => ({ ...f, is_emergency: e.target.checked }))}
                    className="h-4 w-4 accent-red-500"
                  />
                  <label htmlFor="is_emergency" className="text-sm font-medium text-red-600 cursor-pointer flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Mark as Emergency
                  </label>
                </div>

                <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <input
                    type="checkbox"
                    id="send_push"
                    checked={form.send_push}
                    onChange={e => setForm(f => ({ ...f, send_push: e.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <label htmlFor="send_push" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-primary" /> Send push notification
                  </label>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1">Schedule for later (optional)</Label>
                {scheduleConfirmed && form.scheduled_date ? (
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg mt-1">
                    <span className="text-sm font-medium text-amber-700 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(form.scheduled_date).toLocaleString()}
                    </span>
                    <button className="text-xs text-amber-700 underline" onClick={() => { setScheduleConfirmed(false); setTempScheduleDate(form.scheduled_date); }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <Input
                      type="datetime-local"
                      value={tempScheduleDate}
                      onChange={e => setTempScheduleDate(e.target.value)}
                      className={tempScheduleDate ? 'pr-24' : ''}
                    />
                    {tempScheduleDate && (
                      <Button
                        size="sm"
                        onClick={() => { setForm(f => ({ ...f, scheduled_date: tempScheduleDate })); setScheduleConfirmed(true); }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                      >
                        Confirm
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handlePost}
                disabled={posting || !form.title.trim() || !form.content.trim()}
                className="w-full gap-2"
              >
                {scheduleConfirmed && form.scheduled_date ? (
                  <><Clock className="h-4 w-4" /> {posting ? 'Scheduling...' : 'Schedule Announcement'}</>
                ) : (
                  <><Send className="h-4 w-4" /> {posting ? 'Posting...' : form.send_push ? 'Post + Send Push' : 'Post Announcement'}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {statsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setStatsModal(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold">Read Receipts</h3>
                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{statsModal.title}</p>
              </div>
              <button onClick={() => setStatsModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {statsLoading ? (
                <div className="text-center py-10"><div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent mx-auto" /></div>
              ) : statsData ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-2xl font-bold text-green-700">{statsData.total_reads}</p>
                      <p className="text-xs text-green-600 mt-0.5">Have read</p>
                    </div>
                    <div className="p-3 bg-muted rounded-xl">
                      <p className="text-2xl font-bold">{statsData.total_target_audience - statsData.total_reads}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Not yet read</p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-2xl font-bold text-blue-700">{statsData.read_percentage}%</p>
                      <p className="text-xs text-blue-600 mt-0.5">Read rate</p>
                    </div>
                  </div>
                  <ReadBar count={statsData.total_reads} total={statsData.total_target_audience} />
                  {statsData.readers.length > 0 ? (
                    <div>
                      <p className="text-sm font-semibold mb-2">Who has read it</p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {statsData.readers.sort((a, b) => new Date(b.read_at) - new Date(a.read_at)).map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                            <div>
                              <p className="font-medium">{r.name || 'Unknown'}</p>
                              {r.floor && <p className="text-xs text-muted-foreground">{r.floor}</p>}
                            </div>
                            <p className="text-xs text-muted-foreground">{r.read_at ? new Date(r.read_at).toLocaleString() : '—'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No reads yet</p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">Delete Announcement?</h3>
            <p className="text-sm text-muted-foreground mb-1">
              <strong>"{deleteTarget.title}"</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-5">This will permanently delete the announcement and all read records. This cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
