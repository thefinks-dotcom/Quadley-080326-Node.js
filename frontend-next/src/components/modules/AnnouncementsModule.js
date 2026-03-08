'use client';

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import {
  Megaphone, AlertCircle, AlertTriangle, CheckCircle, CheckCircle2,
  Search, Archive, ShieldCheck, Home, Plus
} from 'lucide-react';
import ModuleHeader from '../ModuleHeader';

const AnnouncementsModule = () => {
  const { user } = useContext(AuthContext);
  const [announcements, setAnnouncements] = useState([]);
  const [activeRollcalls, setActiveRollcalls] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('unread');
  const [markingRead, setMarkingRead] = useState(new Set());
  const [respondingTo, setRespondingTo] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', priority: 'normal' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [annRes, rollcallRes] = await Promise.all([
        axios.get(`${API}/announcements`),
        axios.get(`${API}/emergency-rollcall/active`).catch(() => ({ data: [] })),
      ]);
      setAnnouncements(Array.isArray(annRes.data) ? annRes.data : []);
      setActiveRollcalls(Array.isArray(rollcallRes.data) ? rollcallRes.data : []);
    } catch (error) {
      console.error('Failed to fetch announcements', error);
    }
  };

  const markAsRead = useCallback(async (announcementId) => {
    if (markingRead.has(announcementId)) return;
    setMarkingRead(prev => new Set(prev).add(announcementId));
    try {
      await axios.post(`${API}/announcements/${announcementId}/mark-read`);
      setAnnouncements(prev =>
        prev.map(a => a.id === announcementId ? { ...a, is_read: true } : a)
      );
    } catch (error) {
      toast.error('Failed to mark as read');
    } finally {
      setMarkingRead(prev => {
        const next = new Set(prev);
        next.delete(announcementId);
        return next;
      });
    }
  }, [markingRead]);

  const respondToRollcall = async (rollcallId, status, announcementId) => {
    setRespondingTo(rollcallId + status);
    try {
      await axios.post(`${API}/emergency-rollcall/${rollcallId}/respond`, { status });
      await axios.post(`${API}/announcements/${announcementId}/mark-read`).catch(() => {});
      toast.success(status === 'evacuated' ? 'Confirmed — you are marked as evacuated' : 'Confirmed — you are marked as not at college');
      setActiveRollcalls(prev =>
        prev.map(r => r.id === rollcallId ? { ...r, my_response: status } : r)
      );
      setAnnouncements(prev =>
        prev.map(a => a.id === announcementId ? { ...a, is_read: true } : a)
      );
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit response');
    } finally {
      setRespondingTo(null);
    }
  };

  const rollcallByAnnouncement = Object.fromEntries(
    activeRollcalls.map(r => [r.announcement_id, r])
  );

  const unreadAnnouncements = announcements.filter(ann =>
    !ann.is_read &&
    (ann.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ann.content?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const readAnnouncements = announcements.filter(ann =>
    ann.is_read &&
    (ann.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ann.content?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const createAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/announcements`, newAnnouncement);
      toast.success('Announcement posted');
      setShowCreateForm(false);
      setNewAnnouncement({ title: '', content: '', priority: 'normal' });
      fetchAll();
    } catch {
      toast.error('Failed to post announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const ADMIN_RA_ROLES = ['admin', 'super_admin', 'college_admin', 'ra'];
  const pendingRollcalls = activeRollcalls.filter(r => !r.my_response);

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Announcements"
        subtitle={`${unreadAnnouncements.length} unread${pendingRollcalls.length > 0 ? ` · ${pendingRollcalls.length} roll call pending` : ''}`}
        showBack
        showSearch={false}
        rightContent={
          ADMIN_RA_ROLES.includes(user?.role) ? (
            <button
              onClick={() => setShowCreateForm(v => !v)}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          ) : null
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-4">

        {showCreateForm && ADMIN_RA_ROLES.includes(user?.role) && (
          <Card className="p-4">
            <form onSubmit={createAnnouncement} className="space-y-3">
              <h3 className="font-semibold">New Announcement</h3>
              <div>
                <Label>Title *</Label>
                <Input className="mt-1" placeholder="Announcement title"
                  value={newAnnouncement.title}
                  onChange={e => setNewAnnouncement(a => ({ ...a, title: e.target.value }))} />
              </div>
              <div>
                <Label>Content *</Label>
                <Textarea className="mt-1" rows={3} placeholder="Write your announcement..."
                  value={newAnnouncement.content}
                  onChange={e => setNewAnnouncement(a => ({ ...a, content: e.target.value }))} />
              </div>
              <div>
                <Label>Priority</Label>
                <select className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={newAnnouncement.priority}
                  onChange={e => setNewAnnouncement(a => ({ ...a, priority: e.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'Posting...' : 'Post Announcement'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        {pendingRollcalls.length > 0 && (
          <div className="rounded-2xl bg-red-600 text-white p-4 shadow-lg animate-pulse-once">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="font-bold text-base">Emergency Roll Call Active</p>
            </div>
            <p className="text-white/90 text-sm">
              {pendingRollcalls.length === 1
                ? 'You must respond to the emergency below before it can be dismissed.'
                : `You must respond to ${pendingRollcalls.length} emergencies below.`}
            </p>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => setActiveTab('unread')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'unread' ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Unread {(unreadAnnouncements.length > 0 || pendingRollcalls.length > 0) && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${pendingRollcalls.length > 0 ? 'bg-red-500 text-white' : 'bg-primary text-white'}`}>
                {unreadAnnouncements.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
          >
            <Archive className="h-3.5 w-3.5" />
            Read ({readAnnouncements.length})
          </button>
        </div>

        {activeTab === 'unread' && (
          <div className="space-y-3">
            {unreadAnnouncements.length === 0 ? (
              <div className="text-center py-14">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-60" />
                <p className="font-medium text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? 'No unread announcements match your search' : 'No unread announcements'}
                </p>
              </div>
            ) : (
              <>
                {!unreadAnnouncements.some(a => a.is_emergency) && (
                  <p className="text-xs text-muted-foreground text-center">Swipe right or tap to mark as read</p>
                )}
                {unreadAnnouncements.map(ann => {
                  const rollcall = rollcallByAnnouncement[ann.id];
                  if (ann.is_emergency && rollcall) {
                    return (
                      <EmergencyRollcallCard
                        key={ann.id}
                        announcement={ann}
                        rollcall={rollcall}
                        onRespond={respondToRollcall}
                        respondingTo={respondingTo}
                      />
                    );
                  }
                  return (
                    <SwipeableAnnouncementCard
                      key={ann.id}
                      announcement={ann}
                      onMarkRead={markAsRead}
                      isMarking={markingRead.has(ann.id)}
                    />
                  );
                })}
              </>
            )}
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="space-y-3">
            {readAnnouncements.length === 0 ? (
              <div className="text-center py-14">
                <Archive className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="font-medium text-foreground">No read announcements</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? 'No archived announcements match your search' : 'Announcements you read will appear here'}
                </p>
              </div>
            ) : (
              readAnnouncements.map(ann => {
                const rollcall = rollcallByAnnouncement[ann.id];
                if (rollcall?.my_response) {
                  return <RespondedEmergencyCard key={ann.id} announcement={ann} rollcall={rollcall} />;
                }
                return <ReadAnnouncementCard key={ann.id} announcement={ann} />;
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function EmergencyRollcallCard({ announcement, rollcall, onRespond, respondingTo }) {
  const responded = !!rollcall.my_response;

  if (responded) {
    return (
      <div className="rounded-2xl bg-green-50 border-2 border-green-300 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="font-bold text-green-800">Response Recorded</span>
        </div>
        <p className="text-sm font-semibold text-foreground mb-0.5">{announcement.title}</p>
        <p className="text-sm text-muted-foreground mb-2">{announcement.content}</p>
        <div className="flex items-center gap-2">
          {rollcall.my_response === 'evacuated' ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
              <Home className="h-4 w-4" /> You confirmed: Evacuated
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
              <ShieldCheck className="h-4 w-4" /> You confirmed: Not at College
            </span>
          )}
        </div>
      </div>
    );
  }

  const isRespondingEvac = respondingTo === rollcall.id + 'evacuated';
  const isRespondingNac = respondingTo === rollcall.id + 'not_at_college';

  return (
    <div className="rounded-2xl bg-red-600 text-white p-4 shadow-xl border-4 border-red-400">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-5 w-5 text-red-100 shrink-0" />
        <span className="font-bold text-base text-white">EMERGENCY — Response Required</span>
      </div>

      <h3 className="font-bold text-white text-base mb-1">{announcement.title}</h3>
      <p className="text-red-100 text-sm mb-4 leading-relaxed">{announcement.content}</p>

      <p className="text-white/90 text-xs font-medium mb-3 uppercase tracking-wide">
        Please confirm your status immediately:
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onRespond(rollcall.id, 'evacuated', announcement.id)}
          disabled={!!respondingTo}
          className="flex flex-col items-center gap-2 bg-white text-red-700 rounded-2xl py-4 px-3 font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-60 shadow-md active:scale-95"
        >
          <Home className="h-7 w-7 text-green-600" />
          <span className="leading-tight text-center">I have evacuated<br/><span className="font-normal text-xs text-muted-foreground">I am outside</span></span>
          {isRespondingEvac && <span className="text-xs text-muted-foreground">Confirming...</span>}
        </button>

        <button
          onClick={() => onRespond(rollcall.id, 'not_at_college', announcement.id)}
          disabled={!!respondingTo}
          className="flex flex-col items-center gap-2 bg-white text-red-700 rounded-2xl py-4 px-3 font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-60 shadow-md active:scale-95"
        >
          <ShieldCheck className="h-7 w-7 text-blue-600" />
          <span className="leading-tight text-center">Not at College<br/><span className="font-normal text-xs text-muted-foreground">I am off-campus</span></span>
          {isRespondingNac && <span className="text-xs text-muted-foreground">Confirming...</span>}
        </button>
      </div>

      <p className="text-red-200 text-xs text-center mt-3">
        Posted {new Date(announcement.created_at).toLocaleString()}
        {announcement.created_by_name && ` · ${announcement.created_by_name}`}
      </p>
    </div>
  );
}

function RespondedEmergencyCard({ announcement, rollcall }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-green-100 opacity-80">
      <div className="flex items-start gap-3">
        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Emergency
            </span>
          </div>
          <h3 className="text-sm font-medium">{announcement.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your response: <strong>{rollcall.my_response === 'evacuated' ? 'Evacuated' : 'Not at College'}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function SwipeableAnnouncementCard({ announcement, onMarkRead, isMarking }) {
  const startXRef = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = useCallback((e) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    if (dx > 0) setSwipeX(Math.min(dx, 120));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeX >= SWIPE_THRESHOLD) {
      setSwiped(true);
      setTimeout(() => onMarkRead(announcement.id), 300);
    } else {
      setSwipeX(0);
    }
    startXRef.current = null;
  }, [swipeX, announcement.id, onMarkRead]);

  const swipePct = Math.min(swipeX / SWIPE_THRESHOLD, 1);
  const isActivated = swipeX >= SWIPE_THRESHOLD;

  if (swiped) return <div className="h-4 rounded-xl" />;

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 flex items-center justify-start pl-4 rounded-xl transition-colors ${isActivated ? 'bg-green-500' : 'bg-green-400'}`}
        style={{ width: `${Math.max(swipeX + 16, 0)}px`, opacity: swipePct }}
        aria-hidden="true"
      >
        <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
        {swipeX > 50 && <span className="text-white text-xs font-medium ml-1.5 whitespace-nowrap">Mark as read</span>}
      </div>

      <div
        className={`relative bg-white rounded-xl shadow-sm ${isMarking ? 'opacity-60' : ''} ${announcement.is_emergency ? 'border-2 border-red-200 bg-red-50' : ''}`}
        style={{ transform: `translateX(${swipeX}px)`, touchAction: 'pan-y' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${announcement.is_emergency ? 'bg-red-500' : 'bg-primary'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {announcement.is_emergency && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    <AlertCircle className="h-3 w-3" /> Emergency
                  </span>
                )}
                {announcement.priority === 'high' && !announcement.is_emergency && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">High Priority</span>
                )}
              </div>
              <h3 className="text-sm font-semibold leading-snug">{announcement.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{announcement.content}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  {new Date(announcement.created_at).toLocaleString()}
                  {announcement.created_by_name && ` · ${announcement.created_by_name}`}
                </p>
                <button
                  onClick={() => onMarkRead(announcement.id)}
                  disabled={isMarking}
                  className="text-xs text-primary font-medium flex items-center gap-1 hover:underline disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isMarking ? 'Marking...' : 'Mark read'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadAnnouncementCard({ announcement }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 opacity-70 ${announcement.is_emergency ? 'border border-red-100' : ''}`}>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium leading-snug">{announcement.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{announcement.content}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {new Date(announcement.created_at).toLocaleString()}
            {announcement.created_by_name && ` · ${announcement.created_by_name}`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default AnnouncementsModule;
