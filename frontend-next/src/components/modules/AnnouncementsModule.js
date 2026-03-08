'use client';

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Megaphone, AlertCircle, CheckCircle2, Search, Archive, ChevronRight } from 'lucide-react';
import ModuleHeader from '../ModuleHeader';

const AnnouncementsModule = () => {
  const { user } = useContext(AuthContext);
  const [announcements, setAnnouncements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('unread');
  const [markingRead, setMarkingRead] = useState(new Set());

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await axios.get(`${API}/announcements`);
      setAnnouncements(Array.isArray(res.data) ? res.data : []);
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
      console.error('Failed to mark as read', error);
      toast.error('Failed to mark as read');
    } finally {
      setMarkingRead(prev => {
        const next = new Set(prev);
        next.delete(announcementId);
        return next;
      });
    }
  }, [markingRead]);

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

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Announcements"
        subtitle={`${unreadAnnouncements.length} unread`}
        showBack
        showSearch={false}
      />

      <div className="px-4 pt-4 pb-6 space-y-4">
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
            Unread {unreadAnnouncements.length > 0 && <span className="bg-primary text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{unreadAnnouncements.length}</span>}
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
                <p className="text-xs text-muted-foreground text-center">Swipe right or tap to mark as read</p>
                {unreadAnnouncements.map(ann => (
                  <SwipeableAnnouncementCard
                    key={ann.id}
                    announcement={ann}
                    onMarkRead={markAsRead}
                    isMarking={markingRead.has(ann.id)}
                  />
                ))}
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
              readAnnouncements.map(ann => (
                <ReadAnnouncementCard key={ann.id} announcement={ann} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function SwipeableAnnouncementCard({ announcement, onMarkRead, isMarking }) {
  const cardRef = useRef(null);
  const startXRef = useRef(null);
  const currentXRef = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = useCallback((e) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    currentXRef.current = e.touches[0].clientX;
    if (dx > 0) {
      setSwipeX(Math.min(dx, 120));
    }
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

  if (swiped) {
    return (
      <div className="rounded-xl overflow-hidden bg-green-500 flex items-center justify-center h-16 opacity-0 transition-opacity duration-300">
        <CheckCircle2 className="h-6 w-6 text-white" />
      </div>
    );
  }

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
        ref={cardRef}
        className={`relative bg-white rounded-xl shadow-sm transition-transform ${isMarking ? 'opacity-60' : ''} ${announcement.is_emergency ? 'border-2 border-red-200 bg-red-50' : ''}`}
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
