'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Award,
  Plus,
  Send,
  Clock,
  CheckCircle,
  Calendar,
  X,
  Megaphone,
  Search,
  User
} from 'lucide-react';
import { toast } from 'sonner';

const API = '/api';

const CATEGORIES = [
  { value: 'achievement', label: 'Achievement' },
  { value: 'helping', label: 'Helping Others' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'community', label: 'Community Spirit' },
  { value: 'academic', label: 'Academic Excellence' }
];

const ShoutoutsAdmin = () => {
  const router = useRouter();
  const [shoutouts, setShoutouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('current');
  const [showModal, setShowModal] = useState(false);
  const [posting, setPosting] = useState(false);

  const [form, setForm] = useState({
    to_user_name: '',
    to_user_id: '',
    to_user_email: '',
    message: '',
    category: 'achievement',
    broadcast: true,
    scheduled_date: ''
  });
  const [tempScheduleDate, setTempScheduleDate] = useState('');
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);

  const [nameSearch, setNameSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const nameInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => { fetchShoutouts(); }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          nameInputRef.current && !nameInputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchShoutouts = async () => {
    try {
      const res = await axios.get(`${API}/shoutouts`);
      setShoutouts(res.data);
    } catch (err) {
      console.error('Failed to fetch shoutouts', err);
    } finally {
      setLoading(false);
    }
  };

  const searchParticipants = useCallback(async (query) => {
    if (!query || query.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setLoadingSuggestions(true);
    try {
      const res = await axios.get(`${API}/recognition/participants`, { params: { search: query } });
      setSuggestions(res.data || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setNameSearch(val);
    setForm(f => ({ ...f, to_user_name: val, to_user_id: '' }));
    setSelectedUser(null);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => searchParticipants(val), 300);
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setNameSearch(user.name);
    setForm(f => ({ ...f, to_user_name: user.name, to_user_id: user.id, to_user_email: user.email || '' }));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const resetForm = () => {
    setForm({ to_user_name: '', to_user_id: '', to_user_email: '', message: '', category: 'achievement', broadcast: true, scheduled_date: '' });
    setNameSearch('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedUser(null);
    setTempScheduleDate('');
    setScheduleConfirmed(false);
  };

  const handlePost = async () => {
    if (!form.to_user_name || !form.message) { toast.error('Recipient name and message are required'); return; }
    setPosting(true);
    try {
      const isScheduled = scheduleConfirmed && !!form.scheduled_date;
      await axios.post(`${API}/shoutouts`, {
        to_user_name: form.to_user_name,
        to_user_id: form.to_user_id || '',
        message: form.message,
        category: form.category,
        broadcast: form.broadcast,
        status: isScheduled ? 'scheduled' : 'published',
        scheduled_date: isScheduled ? form.scheduled_date : null
      });
      if (isScheduled) {
        toast.success(`Shoutout scheduled for ${new Date(form.scheduled_date).toLocaleString()}`);
      } else {
        toast.success('Shoutout posted!');
      }
      setShowModal(false);
      resetForm();
      fetchShoutouts();
    } catch {
      toast.error('Failed to post shoutout');
    } finally {
      setPosting(false);
    }
  };

  const current = shoutouts.filter(s => s.status !== 'scheduled');
  const scheduled = shoutouts.filter(s => s.status === 'scheduled');

  const displayed = tab === 'current' ? current : tab === 'scheduled' ? scheduled : current;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Coloured Banner */}
      <div className="bg-gradient-to-r from-warning to-secondary rounded-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/college-admin')}
              className="flex items-center gap-1 text-white/70 hover:text-white mb-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="w-7 h-7 text-white" />
              Shoutouts
            </h1>
            <p className="text-white/80 mt-1">{current.length} shoutout{current.length !== 1 ? 's' : ''} posted</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-warning rounded-lg hover:bg-white/90 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Shoutout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'current', icon: CheckCircle, label: 'Current', count: current.length },
          { key: 'scheduled', icon: Clock, label: 'Scheduled', count: scheduled.length },
          { key: 'history', icon: Calendar, label: 'Historical', count: current.length }
        ].map(({ key, icon: Icon, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-white' : 'bg-white border border-border text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Shoutout List */}
      <div className="space-y-4">
        {displayed.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No shoutouts found</p>
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="mt-4 text-primary hover:underline text-sm"
            >
              Post the first shoutout
            </button>
          </div>
        ) : displayed.map(rec => (
          <div key={rec.id} className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${rec.status === 'scheduled' ? 'border-border bg-muted/30' : 'border-border'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Award className="h-5 w-5 text-warning" />
                  <span className="font-semibold text-foreground">{rec.to_user_name}</span>
                  {rec.status === 'scheduled' && (
                    <Badge className="bg-muted text-foreground text-xs">
                      <Clock className="h-3 w-3 mr-1 inline" /> Scheduled
                    </Badge>
                  )}
                  <Badge className="text-xs">{rec.category}</Badge>
                  {rec.broadcast && (
                    <Badge className="bg-muted text-foreground text-xs">
                      <Megaphone className="h-3 w-3 mr-1 inline" /> Broadcast
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mb-2">"{rec.message}"</p>
                <div className="text-sm text-muted-foreground">
                  <p>From: {rec.from_user_name}</p>
                  {rec.status === 'scheduled' && rec.scheduled_date ? (
                    <p className="text-primary font-medium mt-1">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Scheduled for: {new Date(rec.scheduled_date).toLocaleString()}
                    </p>
                  ) : (
                    <p>Posted: {new Date(rec.created_at).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Shoutout Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Award className="h-5 w-5 text-warning" />
                New Shoutout
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Recipient Name (first) — with search dropdown */}
              <div className="relative">
                <label className="block text-sm font-medium text-foreground mb-1">Recipient Name *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameSearch}
                    onChange={handleNameChange}
                    onFocus={() => nameSearch.length >= 2 && setShowSuggestions(true)}
                    placeholder="Type a name to search..."
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    autoComplete="off"
                  />
                  {selectedUser && (
                    <button
                      type="button"
                      onClick={() => { setSelectedUser(null); setNameSearch(''); setForm(f => ({ ...f, to_user_name: '', to_user_id: '', to_user_email: '' })); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 max-h-52 overflow-y-auto"
                  >
                    {loadingSuggestions ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">Searching...</div>
                    ) : suggestions.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">No users found</div>
                    ) : suggestions.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => selectUser(user)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left transition-colors border-b border-border last:border-0"
                      >
                        <div className="p-1.5 bg-primary/10 rounded-full">
                          <User className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{user.name}</p>
                          {user.email && (
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          )}
                        </div>
                        {user.floor && (
                          <span className="text-xs text-muted-foreground shrink-0">{user.floor}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedUser && (
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Selected: {selectedUser.name}{selectedUser.email ? ` (${selectedUser.email})` : ''}
                  </p>
                )}
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={form.to_user_email}
                  onChange={(e) => setForm(f => ({ ...f, to_user_email: e.target.value }))}
                  placeholder="Or type an email address directly"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Message *</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Write your shoutout message..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Broadcast toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="broadcast"
                  checked={form.broadcast}
                  onChange={(e) => setForm(f => ({ ...f, broadcast: e.target.checked }))}
                  className="w-4 h-4"
                />
                <label htmlFor="broadcast" className="text-sm font-medium text-foreground cursor-pointer">
                  Broadcast to all residents
                </label>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Schedule for later <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                {scheduleConfirmed && form.scheduled_date ? (
                  <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                    <div className="flex items-center gap-2 text-foreground text-sm">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">{new Date(form.scheduled_date).toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setScheduleConfirmed(false); setTempScheduleDate(form.scheduled_date); }}
                      className="text-sm text-primary hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={tempScheduleDate}
                      onChange={(e) => setTempScheduleDate(e.target.value)}
                      className={`w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary ${tempScheduleDate ? 'pr-24' : ''}`}
                    />
                    {tempScheduleDate && (
                      <button
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, scheduled_date: tempScheduleDate })); setScheduleConfirmed(true); }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-primary text-white text-xs px-2 py-1 rounded-md flex items-center gap-1"
                      >
                        <CheckCircle className="h-3 w-3" /> Confirm
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={posting || !form.to_user_name || !form.message}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scheduleConfirmed && form.scheduled_date ? (
                  <><Clock className="h-4 w-4" /> {posting ? 'Scheduling...' : 'Schedule'}</>
                ) : (
                  <><Send className="h-4 w-4" /> {posting ? 'Posting...' : 'Post Shoutout'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoutoutsAdmin;
