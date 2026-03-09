'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation'
import Link from 'next/link';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Home, MessageSquare, Calendar, Users, Wrench, DollarSign, BookOpen,
  Heart, UtensilsCrossed, Building, Plus, Send, Bell, Sparkles, Award,
  Trophy, Camera, Zap, Shield, Lock, Briefcase, Upload, UserCheck, Settings,
  User, ChevronDown, AlertTriangle, Cake, X, Package
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const DASHBOARD_CACHE_KEY = 'quadley_dashboard_cache';

const HomeModule = () => {
  const { user, enabledModules } = useContext(AuthContext);
  const router = useRouter();
  const moduleEnabled = (key) => !enabledModules || enabledModules.includes(key);
  const [dashboard, setDashboard] = useState(() => {
    try {
      const cached = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeBanner, setActiveBanner] = useState(null); // 'move-in' or 'o-week' or null
  const [pendingParcels, setPendingParcels] = useState([]);
  const [hasNonAnonymousDisclosure, setHasNonAnonymousDisclosure] = useState(false);

  useEffect(() => {
    fetchDashboard();
    checkActiveBanner();
    fetchPendingParcels();
    checkDisclosures();
  }, []);

  const checkActiveBanner = async () => {
    try {
      const response = await axios.get(`${API}/config/dates`);
      const { move_in_date, o_week_start, o_week_end } = response.data;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const moveInDate = new Date(move_in_date);
      const dayAfterMoveIn = new Date(moveInDate);
      dayAfterMoveIn.setDate(dayAfterMoveIn.getDate() + 1);
      
      const oWeekStart = new Date(o_week_start);
      const oWeekEnd = new Date(o_week_end);
      const dayAfterOWeek = new Date(oWeekEnd);
      dayAfterOWeek.setDate(dayAfterOWeek.getDate() + 1);
      
      // Show Move-In Magic until day after move-in (students only)
      if (today <= dayAfterMoveIn) {
        setActiveBanner('move-in');
      }
      // Show O-Week during first week of school (for everyone)
      else if (today >= oWeekStart && today <= oWeekEnd) {
        setActiveBanner('o-week');
      }
      // Don't show any banner after o-week ends
      else {
        setActiveBanner(null);
      }
    } catch (error) {
      console.error('Failed to fetch date config', error);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/dashboard`);
      setDashboard(response.data);
      try { sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(response.data)); } catch {}
    } catch (error) {
      console.error('Failed to fetch dashboard', error);
    }
  };

  const fetchPendingParcels = async () => {
    try {
      const response = await axios.get(`${API}/parcels/my-pending`);
      setPendingParcels(response.data);
    } catch (error) {
      console.error('Failed to fetch parcels', error);
    }
  };

  const checkDisclosures = async () => {
    try {
      const response = await axios.get(`${API}/safe-disclosures`);
      // Check if user has any non-anonymous disclosures
      const hasNonAnon = response.data.some(d => d.reporter_id === user?.id && !d.is_anonymous);
      setHasNonAnonymousDisclosure(hasNonAnon);
    } catch (error) {
      console.error('Failed to check disclosures', error);
    }
  };

  const markParcelCollected = async (parcelId) => {
    try {
      await axios.put(`${API}/parcels/${parcelId}/collect`);
      toast.success('Parcel marked as collected!');
      fetchPendingParcels();
    } catch (error) {
      toast.error('Failed to mark parcel as collected');
    }
  };

  const rsvpEvent = async (eventId, response) => {
    try {
      await axios.post(`${API}/events/${eventId}/rsvp`, { response });
      toast.success('RSVP updated!');
      setSelectedEvent(null);
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'RSVP failed');
    }
  };

  if (!dashboard) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="home-module">
      <ModuleHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.first_name}!`}
        showSearch={false}
      />

      <div className="px-4 pt-4 space-y-4">

      {/* Smart Banner - Move-In Magic (students only) or O-Week (everyone) */}
      {activeBanner === 'move-in' && <MoveInMagicBanner />}
      {activeBanner === 'o-week' && <OWeekBanner />}

      {/* Parcel Notifications Alert */}
      {pendingParcels.length > 0 && (
        <Card className="p-4 glass border-2 border-warning bg-gradient-to-r from-warning/10 to-muted">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl flex-shrink-0">
              📦
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2 text-foreground">
                {pendingParcels.length} Parcel{pendingParcels.length > 1 ? 's' : ''} Waiting at Reception!
              </h3>
              <div className="space-y-2">
                {pendingParcels.map((parcel) => (
                  <div key={parcel.id} className="p-3 bg-white/70 rounded-lg border border-border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {parcel.sender_name && (
                          <div className="text-sm font-semibold text-foreground">From: {parcel.sender_name}</div>
                        )}
                        {parcel.tracking_number && (
                          <div className="text-xs text-muted-foreground mt-1">Tracking: {parcel.tracking_number}</div>
                        )}
                        {parcel.description && (
                          <div className="text-xs text-muted-foreground mt-1">{parcel.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Arrived: {new Date(parcel.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => markParcelCollected(parcel.id)}
                        className="ml-3 bg-primary hover:bg-accent"
                      >
                        ✓ Collected
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {(moduleEnabled('announcements') || moduleEnabled('messages')) && (
        <div className="grid grid-cols-2 gap-3">
          {moduleEnabled('announcements') && (
            <Link href="/dashboard/announcements" className="block no-underline" data-testid="stat-news">
              <Card className="p-4 glass card-hover cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <Bell className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">News</div>
                    <div className="text-2xl font-bold gradient-text leading-tight">{dashboard.recent_announcements?.length || 0}</div>
                  </div>
                </div>
              </Card>
            </Link>
          )}
          {moduleEnabled('messages') && (
            <Link href="/dashboard/messages" className="block no-underline" data-testid="stat-unread-messages">
              <Card className="p-4 glass card-hover cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Messages</div>
                    <div className="text-2xl font-bold gradient-text leading-tight">{dashboard.unread_messages_count || 0}</div>
                  </div>
                </div>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Quick Access Navigation */}
      <Card className="p-3 sm:p-6 glass overflow-hidden">
        <h3 className="font-bold text-lg sm:text-xl mb-3 sm:mb-4">Quick Access</h3>
        <div className="quick-access-grid">
          {/* 1. Events */}
          {moduleEnabled('events') && (
            <Link href="/dashboard/events" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-events">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Events</span>
            </Link>
          )}

          {/* 2. Dining */}
          {moduleEnabled('dining') && (
            <Link href="/dashboard/dining" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-dining">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <UtensilsCrossed className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Dining</span>
            </Link>
          )}

          {/* 3. Service */}
          {moduleEnabled('maintenance') && (
            <Link href="/dashboard/maintenance" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-services">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-muted-foreground to-secondary flex items-center justify-center">
                <Wrench className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Service</span>
            </Link>
          )}

          {/* 4. Parcels */}
          {moduleEnabled('parcels') && (
            <Link href="/dashboard/parcels" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-parcels">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Package className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Parcels</span>
            </Link>
          )}

          {/* 5. Floor */}
          {moduleEnabled('floor') && (
            <Link href="/dashboard/houses" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-floor">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-warning to-secondary flex items-center justify-center">
                <Building className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Floor</span>
            </Link>
          )}

          {/* 6. Academics */}
          {moduleEnabled('academics') && (
            <Link href="/dashboard/academics" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-academics">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Academics</span>
            </Link>
          )}

          {/* 7. Clubs */}
          {moduleEnabled('cocurricular') && (
            <Link href="/dashboard/cocurricular" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-cocurricular">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Trophy className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Clubs</span>
            </Link>
          )}

          {/* 8. Make a Report */}
          {moduleEnabled('safe_disclosure') && (
            <Link href="/dashboard/safe-disclosure" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-make-report">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-destructive to-orange-500 flex items-center justify-center">
                <Shield className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Make a Report</span>
            </Link>
          )}

          {/* 9. Jobs */}
          {moduleEnabled('jobs') && (
            <Link href="/dashboard/jobs" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-jobs">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-success to-success flex items-center justify-center">
                <Briefcase className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Jobs</span>
            </Link>
          )}

          {/* 10. Birthdays */}
          {moduleEnabled('birthdays') && (
            <Link href="/dashboard/birthdays" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-birthdays">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Cake className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Birthdays</span>
            </Link>
          )}

          {/* 11. Shoutouts */}
          {moduleEnabled('recognition') && (
            <Link href="/dashboard/recognition" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-recognition">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-warning/40 to-secondary flex items-center justify-center">
                <Award className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Shoutouts</span>
            </Link>
          )}

          {/* 12. Wellbeing */}
          {moduleEnabled('wellbeing') && (
            <Link href="/dashboard/wellbeing" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-wellbeing">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-destructive flex items-center justify-center">
                <Heart className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">Wellbeing</span>
            </Link>
          )}

          {/* 13. AI Help */}
          <Link href="/dashboard/ai" className="flex flex-col items-center gap-1 sm:gap-2 p-1 sm:p-4 rounded-lg hover:bg-muted transition-all text-current no-underline" data-testid="quick-ai">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
            </div>
            <span className="text-[10px] sm:text-sm font-medium text-center leading-tight">AI Help</span>
          </Link>
        </div>
      </Card>

      {/* Unread Messages Widget */}
      {dashboard.unread_message_preview && dashboard.unread_message_preview.length > 0 && (
        <Card className="p-6 glass border-l-4 border-primary">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              💬 Unread Messages ({dashboard.unread_messages_count})
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard/messages')}
              className="text-primary hover:text-primary"
            >
              View All →
            </Button>
          </div>
          <div className="space-y-3">
            {dashboard.unread_message_preview.slice(0, 3).map((msg, idx) => (
              <div 
                key={idx} 
                onClick={() => router.push('/dashboard/messages')}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 text-white font-semibold">
                  {msg.sender_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{msg.sender_name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {msg.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <Badge className="bg-primary text-white text-xs">New</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Birthday Widget */}
      {moduleEnabled('birthdays') && dashboard.upcoming_birthdays && dashboard.upcoming_birthdays.length > 0 && (
        <Card className="p-6 glass border-l-4 border-primary">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <Cake className="h-5 w-5 text-primary" />
              🎉 Upcoming Birthdays
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard/birthdays')}
              className="text-primary hover:text-primary"
            >
              View All →
            </Button>
          </div>
          <div className="space-y-3">
            {dashboard.upcoming_birthdays.slice(0, 3).map((person) => (
              <div key={person.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                  <Cake className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{person.first_name} {person.last_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {person.days_until === 0 ? '🎂 Today!' : 
                     person.days_until === 1 ? '🎂 Tomorrow' : 
                     `In ${person.days_until} days`}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => router.push('/dashboard/birthdays')}
                  className="bg-gradient-to-r from-primary to-secondary"
                >
                  Send Wish
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Recognitions Widget */}
      {moduleEnabled('recognition') && dashboard.shoutouts && dashboard.shoutouts.length > 0 && (
        <Card className="p-6 glass border-l-4 border-warning">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <Award className="h-5 w-5 text-warning" />
              🏆 Recent Recognitions
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard/recognition')}
              className="text-warning hover:text-warning"
            >
              View All →
            </Button>
          </div>
          <div className="space-y-3">
            {dashboard.shoutouts.map((shoutout, idx) => {
              // Determine display names
              const fromName = shoutout.from_user_id === user?.id ? 'You' : shoutout.from_user_name;
              const toName = shoutout.to_user_name 
                ? (shoutout.to_user_id === user?.id ? 'You' : shoutout.to_user_name)
                : 'Community';
              
              return (
                <div 
                  key={idx} 
                  onClick={() => router.push('/dashboard/recognition')}
                  className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-warning/10 to-muted hover:from-warning/10 hover:to-warning/10 transition-colors cursor-pointer border-2 border-warning"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning to-secondary flex items-center justify-center flex-shrink-0">
                    <Award className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground mb-1">
                      {fromName} → {toName}
                    </p>
                    <p className="text-sm text-foreground mt-1">
                      {shoutout.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-warning text-white text-xs">{shoutout.category}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(shoutout.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {moduleEnabled('events') && dashboard.upcoming_events && dashboard.upcoming_events.length > 0 && (
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl">Upcoming Events</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard/events')}
              className="text-foreground hover:text-foreground"
              data-testid="view-all-events-btn"
            >
              View All →
            </Button>
          </div>
          <div className="space-y-3">
            {dashboard.upcoming_events.map((event, idx) => (
              <div 
                key={idx} 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEvent(event);
                }}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/50 transition-colors cursor-pointer"
                data-testid={`home-event-${idx}`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-sm text-muted-foreground line-clamp-1">{event.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(event.date).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {dashboard.recent_announcements && dashboard.recent_announcements.length > 0 && (
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl">Recent Announcements</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard/announcements')}
              className="text-foreground hover:text-foreground"
              data-testid="view-all-announcements-btn"
            >
              View All →
            </Button>
          </div>
          <div className="space-y-3">
            {dashboard.recent_announcements.map((ann, idx) => (
              <div 
                key={idx} 
                onClick={() => router.push('/dashboard/announcements')}
                className="p-4 rounded-lg bg-white/50 border-l-4 border-border cursor-pointer hover:shadow-md transition-shadow"
                data-testid={`home-announcement-${idx}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{ann.title}</div>
                  <Badge className="bg-secondary text-white">{ann.priority}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{ann.content}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEvent(null)}
          data-testid="event-detail-modal"
        >
          <Card 
            className="max-w-2xl w-full p-6 glass max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="heading-font text-2xl font-bold mb-2">{selectedEvent.title}</h2>
                  <Badge className="bg-secondary text-white">{selectedEvent.category || 'Event'}</Badge>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground hover:text-foreground p-2"
                  data-testid="close-event-modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold mb-1">Description</h3>
                  <p className="text-foreground">{selectedEvent.description}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-1">📅 Date & Time</h3>
                    <p className="text-foreground">{new Date(selectedEvent.date).toLocaleString()}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">📍 Location</h3>
                    <p className="text-foreground">{selectedEvent.location}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Your RSVP</h3>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => rsvpEvent(selectedEvent.id, 'attending')}
                      data-testid="modal-rsvp-attending-btn"
                      className="flex-1 bg-secondary hover:bg-secondary"
                    >
                      ✓ Attending
                    </Button>
                    <Button
                      onClick={() => rsvpEvent(selectedEvent.id, 'maybe')}
                      data-testid="modal-rsvp-maybe-btn"
                      variant="outline"
                      className="flex-1 border-warning text-warning hover:bg-warning/10"
                    >
                      ? Maybe
                    </Button>
                    <Button
                      onClick={() => rsvpEvent(selectedEvent.id, 'unable')}
                      data-testid="modal-rsvp-unable-btn"
                      variant="outline"
                      className="flex-1 border-border text-foreground hover:bg-muted"
                    >
                      ✗ Unable
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      </div>
    </div>
  );
};

// Events Module  

export default HomeModule;
