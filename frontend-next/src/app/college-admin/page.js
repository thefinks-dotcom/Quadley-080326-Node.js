'use client';

import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext } from '@/contexts/AuthContext';
import { useTenantTheme } from '@/contexts/TenantThemeContext';
import TenantLogo from '@/components/TenantLogo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users,
  Wrench,
  Shield,
  Heart,
  Award,
  MessageSquare,
  Calendar,
  Megaphone,
  Settings,
  ArrowRight,
  AlertTriangle,
  LayoutGrid,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Activity,
  Bell,
  RefreshCw,
  Search,
  X,
  Plus,
  Zap,
  Keyboard,
  FileText,
  Eye,
  Briefcase,
  Menu,
  LogOut,
  User,
  ChevronDown,
  Home,
  DollarSign,
  Lock,
  Package,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = '';

const CollegeAdminDashboard = () => {
  const router = useRouter();
  const { user, logout } = useContext(AuthContext);
  const { tenantName } = useTenantTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingServiceRequests: 0,
    urgentWellbeing: 0,
    upcomingEvents: 0,
    totalAnnouncements: 0,
    totalMessages: 0,
    pendingRecognitions: 0,
    totalGroups: 0,
    activeJobs: 0,
    pendingApplications: 0,
    wellbeingRequests: 0
  });
  const [adminData, setAdminData] = useState(null);
  const [upcomingEventsList, setUpcomingEventsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Global Search State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], events: [], announcements: [], groups: [] });
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef(null);
  
  // Quick Actions State
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  
  // Keyboard Shortcuts State
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [keySequence, setKeySequence] = useState('');

  // Parcels State
  const [parcels, setParcels] = useState([]);
  const [parcelUsers, setParcelUsers] = useState([]);
  const [parcelFilter, setParcelFilter] = useState('waiting');
  const [showAddParcel, setShowAddParcel] = useState(false);
  const [parcelSubmitting, setParcelSubmitting] = useState(false);
  const [newParcel, setNewParcel] = useState({ student_id: '', tracking_number: '', sender_name: '', description: '' });

  const isFullAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    fetchAllData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownOpen && !event.target.closest('[data-testid="profile-dropdown-btn"]') && !event.target.closest('[data-testid="profile-dropdown-menu"]')) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  // Keyboard Shortcuts
  useEffect(() => {
    let keyTimer = null;
    
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const key = e.key.toLowerCase();
      
      // CMD/CTRL + K for search
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
        return;
      }
      
      // ESC to close modals
      if (key === 'escape') {
        setSearchOpen(false);
        setQuickActionsOpen(false);
        setShowShortcuts(false);
        setKeySequence('');
        return;
      }
      
      // ? for shortcuts help
      if (key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      
      // G + letter shortcuts
      setKeySequence(prev => {
        const newSeq = prev + key;
        
        // Clear after 1 second
        clearTimeout(keyTimer);
        keyTimer = setTimeout(() => setKeySequence(''), 1000);
        
        // Check for shortcuts
        if (newSeq === 'ge') { router.push('/college-admin/events'); return ''; }
        if (newSeq === 'ga') { router.push('/college-admin/announcements'); return ''; }
        if (newSeq === 'gu') { router.push('/college-admin/users'); return ''; }
        if (newSeq === 'gs') { router.push('/college-admin/service-requests'); return ''; }
        if (newSeq === 'gr') { router.push('/college-admin/recognition'); return ''; }
        if (newSeq === 'gw') { router.push('/college-admin/wellbeing'); return ''; }
        if (newSeq === 'gc') { router.push('/college-admin/co-curricular'); return ''; }
        if (newSeq === 'gj') { router.push('/college-admin/jobs'); return ''; }
        if (newSeq === 'gm') { router.push('/college-admin/messages'); return ''; }
        if (newSeq === 'gh') { router.push('/college-admin'); return ''; }
        
        return newSeq.slice(-2); // Keep last 2 chars
      });
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(keyTimer);
    };
  }, [router]);

  // Global Search
  const performSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults({ users: [], events: [], announcements: [], groups: [] });
      return;
    }
    
    setSearching(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const q = query.toLowerCase();
      
      const [usersRes, eventsRes, announcementsRes, groupsRes] = await Promise.all([
        axios.get(`${API}/api/users/list`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/events`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/announcements`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/cocurricular/groups/all`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setSearchResults({
        users: (usersRes.data || []).filter(u => 
          `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        ).slice(0, 5),
        events: (eventsRes.data || []).filter(e => 
          e.title?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q)
        ).slice(0, 5),
        announcements: (announcementsRes.data || []).filter(a => 
          a.title?.toLowerCase().includes(q) ||
          a.content?.toLowerCase().includes(q)
        ).slice(0, 5),
        groups: (groupsRes.data || []).filter(g => 
          g.name?.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q)
        ).slice(0, 5)
      });
    } catch (error) {
      console.error('Search error', error);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchOpen && searchQuery) {
        performSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchOpen, performSearch]);

  const quickActions = [
    { label: 'Create Announcement', icon: Megaphone, action: () => router.push('/college-admin/announcements'), color: 'text-primary' },
    { label: 'Post New Job', icon: Briefcase, action: () => router.push('/college-admin/jobs'), color: 'text-success' },
    { label: 'View Pending Requests', icon: Wrench, action: () => router.push('/college-admin/service-requests'), color: 'text-primary' },
    { label: 'Create Event', icon: Calendar, action: () => router.push('/college-admin/events'), color: 'text-primary' },
    { label: 'Safety Reports', icon: Shield, action: () => router.push('/college-admin/safety-support'), color: 'text-destructive' },
    { label: 'Send Recognition', icon: Award, action: () => router.push('/college-admin/recognition'), color: 'text-primary' },
    { label: 'View as Student', icon: Eye, action: () => router.push('/dashboard'), color: 'text-primary' },
  ];

  const shortcuts = [
    { keys: ['⌘', 'K'], description: 'Open search' },
    { keys: ['G', 'E'], description: 'Go to Events' },
    { keys: ['G', 'A'], description: 'Go to Announcements' },
    { keys: ['G', 'U'], description: 'Go to Users' },
    { keys: ['G', 'S'], description: 'Go to Service Requests' },
    { keys: ['G', 'R'], description: 'Go to Recognition' },
    { keys: ['G', 'W'], description: 'Go to Wellbeing' },
    { keys: ['G', 'C'], description: 'Go to Co-curricular' },
    { keys: ['G', 'J'], description: 'Go to Jobs' },
    { keys: ['G', 'M'], description: 'Go to Messages' },
    { keys: ['G', 'H'], description: 'Go to Home' },
    { keys: ['?'], description: 'Show shortcuts' },
    { keys: ['ESC'], description: 'Close dialogs' },
  ];

  const totalSearchResults = searchResults.users.length + searchResults.events.length + 
                             searchResults.announcements.length + searchResults.groups.length;

  const fetchAllData = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch admin dashboard data
      const [adminRes, usersRes, eventsRes, maintenanceRes, safetyRes, wellbeingRes, announcementsRes, shoutoutsRes, groupsRes, jobsRes, jobAppsRes, messagesRes, parcelsRes] = await Promise.all([
        axios.get(`${API}/api/dashboard/admin`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
        axios.get(`${API}/api/users/list`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/events`).catch(() => ({ data: [] })),
        axios.get(`${API}/api/maintenance`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/safe-disclosures/stats`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { urgent_count: 0, pending_risk_assessment: 0 } })),
        axios.get(`${API}/api/wellbeing-admin/requests/stats`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { urgent_count: 0, total_count: 0 } })),
        axios.get(`${API}/api/announcements`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/shoutouts`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/cocurricular/groups/all`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/jobs`).catch(() => ({ data: [] })),
        axios.get(`${API}/api/jobs/admin/all-applications`).catch(() => ({ data: [] })),
        axios.get(`${API}/api/messages`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/parcels`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
      ]);
      
      setAdminData(adminRes.data);
      
      const pendingMaintenance = Array.isArray(maintenanceRes.data) 
        ? maintenanceRes.data.filter(m => m.status === 'pending').length 
        : 0;
      
      const safetyUrgent = safetyRes.data?.urgent_count || 0;
      const safetyPendingRA = safetyRes.data?.pending_risk_assessment || 0;
      const wellbeingUrgent = wellbeingRes.data?.urgent_count || 0;
      const wellbeingTotal = wellbeingRes.data?.total_count || 0;
      
      // Count active jobs
      const activeJobs = Array.isArray(jobsRes.data) 
        ? jobsRes.data.filter(j => j.status === 'active').length 
        : 0;
      
      // Count pending applications
      const pendingApps = Array.isArray(jobAppsRes.data)
        ? jobAppsRes.data.filter(a => a.status === 'pending').length
        : 0;
      
      setStats({
        totalUsers: usersRes.data?.length || 0,
        pendingServiceRequests: pendingMaintenance,
        urgentWellbeing: Math.max(safetyUrgent, safetyPendingRA, wellbeingUrgent),
        wellbeingRequests: wellbeingTotal,
        upcomingEvents: Array.isArray(eventsRes.data) ? eventsRes.data.length : 0,
        totalAnnouncements: Array.isArray(announcementsRes.data) ? announcementsRes.data.length : 0,
        totalMessages: Array.isArray(messagesRes.data) ? messagesRes.data.length : 0,
        pendingRecognitions: Array.isArray(shoutoutsRes.data) ? shoutoutsRes.data.filter(s => s.status !== 'scheduled').length : 0,
        totalGroups: Array.isArray(groupsRes.data) ? groupsRes.data.length : 0,
        activeJobs: activeJobs,
        pendingApplications: pendingApps
      });
      setParcels(Array.isArray(parcelsRes.data) ? parcelsRes.data : []);
      setParcelUsers(Array.isArray(usersRes.data) ? usersRes.data.filter(u => u.role === 'student' || u.role === 'ra') : []);
      const now = new Date();
      const upcoming = Array.isArray(eventsRes.data) ? [...eventsRes.data].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
      setUpcomingEventsList(upcoming);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (iconName) => {
    const icons = {
      award: Award,
      wrench: Wrench,
      shield: Shield,
      calendar: Calendar,
      megaphone: Megaphone,
      heart: Heart
    };
    const IconComponent = icons[iconName] || Activity;
    return IconComponent;
  };

  const getColorClasses = (color) => {
    const colors = {
      amber: 'bg-muted text-primary',
      orange: 'bg-muted text-primary',
      red: 'bg-destructive/10 text-destructive',
      blue: 'bg-muted text-primary',
      purple: 'bg-muted text-primary',
      pink: 'bg-muted text-primary',
      green: 'bg-success/10 text-success'
    };
    return colors[color] || 'bg-muted text-muted-foreground';
  };

  const handleAddParcel = async (e) => {
    e.preventDefault();
    if (!newParcel.student_id) {
      toast.error('Please select a resident');
      return;
    }
    setParcelSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/api/parcels`, newParcel, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParcels(prev => [res.data, ...prev]);
      toast.success('Parcel notification sent!');
      setShowAddParcel(false);
      setNewParcel({ student_id: '', tracking_number: '', sender_name: '', description: '' });
    } catch (error) {
      toast.error('Failed to create parcel notification');
    } finally {
      setParcelSubmitting(false);
    }
  };

  const handleMarkParcelCollected = async (parcelId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/parcels/${parcelId}/collect`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: 'collected', collected_at: new Date().toISOString() } : p));
      toast.success('Parcel marked as collected');
    } catch (error) {
      toast.error('Failed to update parcel status');
    }
  };

  const adminModules = [
    {
      id: 'service-requests',
      name: 'Service Requests',
      description: 'Manage maintenance requests',
      icon: Wrench,
      color: 'from-primary to-warning',
      bgColor: 'bg-muted',
      borderColor: 'border-border',
      path: '/college-admin/service-requests',
      stat: stats.pendingServiceRequests,
      statLabel: 'pending'
    },
    {
      id: 'wellbeing',
      name: 'Wellbeing & Safety',
      description: 'Wellbeing, incidents & safety',
      icon: Heart,
      color: 'from-primary to-secondary',
      bgColor: 'bg-muted',
      borderColor: 'border-destructive',
      path: '/college-admin/wellbeing',
      stat: stats.urgentWellbeing,
      statLabel: 'urgent',
      urgent: stats.urgentWellbeing > 0
    },
    {
      id: 'recognition',
      name: 'Shoutouts',
      description: 'Manage shoutouts',
      icon: Award,
      color: 'from-warning to-secondary',
      bgColor: 'bg-muted',
      borderColor: 'border-border',
      path: '/college-admin/recognition',
      stat: stats.pendingRecognitions,
      statLabel: 'posted'
    },
    {
      id: 'events',
      name: 'Events',
      description: 'Manage events',
      icon: Calendar,
      color: 'from-primary to-secondary',
      bgColor: 'bg-muted',
      borderColor: 'border-border',
      path: '/college-admin/events',
      stat: stats.upcomingEvents,
      statLabel: 'upcoming'
    },
    {
      id: 'announcements',
      name: 'Announcements',
      description: 'Create announcements',
      icon: Megaphone,
      color: 'from-primary to-secondary',
      bgColor: 'bg-muted',
      borderColor: 'border-border',
      path: '/college-admin/announcements',
      stat: stats.totalAnnouncements,
      statLabel: 'total'
    },
    {
      id: 'co-curricular',
      name: 'Co-curricular',
      description: 'Clubs & activities',
      icon: Users,
      color: 'from-primary to-secondary',
      bgColor: 'bg-muted',
      borderColor: 'border-border',
      path: '/college-admin/co-curricular',
      stat: stats.totalGroups,
      statLabel: 'groups'
    },
    {
      id: 'jobs',
      name: 'College Jobs',
      description: 'Job postings & applications',
      icon: Briefcase,
      color: 'from-success to-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success',
      path: '/college-admin/jobs',
      stat: stats.activeJobs,
      statLabel: 'active',
      secondaryStat: stats.pendingApplications,
      secondaryLabel: 'apps'
    },
    {
      id: 'financials',
      name: 'Financials',
      description: 'Financial management',
      icon: DollarSign,
      color: 'from-success to-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success',
      path: '/college-admin/financials'
    },
    {
      id: 'messages',
      name: 'Messages',
      description: 'Message center',
      icon: MessageSquare,
      color: 'from-primary to-secondary',
      bgColor: 'bg-muted',
      borderColor: 'border-border',
      path: '/college-admin/messages',
      stat: stats.totalMessages,
      statLabel: 'total'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      {/* Top Bar - Same as Dashboard */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              data-testid="home-logo-btn"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <TenantLogo size={40} />
              <span className="heading-font text-2xl font-bold gradient-text">{tenantName || 'Quadley'}</span>
            </button>
            <Badge className="bg-muted text-primary hidden sm:flex">College Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
              title="Preview the student and RA experience"
            >
              <Eye className="w-4 h-4" />
              View as Student
            </button>
            <div className="text-right hidden sm:block">
              <div className="font-semibold">{user?.first_name} {user?.last_name}</div>
              <div className="text-xs text-muted-foreground">{user?.role}</div>
            </div>
            
            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileDropdownOpen(!profileDropdownOpen);
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                data-testid="profile-dropdown-btn"
              >
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                    {user?.first_name?.[0]?.toUpperCase()}{user?.last_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-border py-2 z-50"
                  data-testid="profile-dropdown-menu"
                >
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      router.push('/dashboard/profile');
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      router.push('/dashboard/settings');
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      router.push('/dashboard');
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3 transition-colors text-primary"
                  >
                    <Home className="h-4 w-4" />
                    <span>Student Dashboard</span>
                  </button>
                  {user?.role === 'super_admin' && (
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        router.push('/admin');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3 transition-colors text-primary"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Super Admin</span>
                    </button>
                  )}
                  <div className="border-t border-border my-1"></div>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-destructive/5 flex items-center gap-3 transition-colors text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Sidebar */}
      {mobileMenuOpen && (
        <div 
          className="fixed top-[72px] left-0 right-0 bottom-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="bg-white w-64 h-full shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <nav className="space-y-2">
              {adminModules.map(module => (
                <button
                  key={module.id}
                  onClick={() => { router.push(module.path); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-muted transition-colors`}
                >
                  <module.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{module.name}</span>
                  {module.stat !== undefined && module.stat > 0 && (
                    <Badge className="ml-auto text-xs">{module.stat}</Badge>
                  )}
                </button>
              ))}
              <div className="border-t border-border pt-2 mt-2">
                <button
                  onClick={() => { router.push('/dashboard'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-primary hover:bg-primary/5 transition-colors"
                >
                  <Eye className="h-5 w-5" />
                  <span className="text-sm font-medium">View as Student</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title & Search/Refresh Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
              <LayoutGrid className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">College Admin</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-muted rounded text-xs ml-1">⌘K</kbd>
            </Button>
            <Button
              onClick={fetchAllData}
              variant="outline"
              size="sm"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''} sm:mr-1`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {isFullAdmin && (
              <Button
                onClick={() => router.push('/college-admin/settings')}
                variant="outline"
                size="sm"
              >
                <Settings className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            )}
          </div>
        </div>

        {/* ===== PENDING ITEMS ===== */}
        {adminData?.needs_attention?.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {adminData.needs_attention.map((item, idx) => {
                const IconComponent = getActivityIcon(item.icon);
                return (
                  <Card 
                    key={idx}
                    className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${
                      item.priority === 'critical' ? 'border-l-destructive bg-destructive/5' :
                      item.priority === 'high' ? 'border-l-warning bg-muted' :
                      item.priority === 'medium' ? 'border-l-warning/50 bg-warning/10' :
                      'border-l-info bg-muted'
                    }`}
                    onClick={() => router.push(item.action)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getColorClasses(item.color)}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">{item.count}</p>
                          <p className="text-xs text-muted-foreground">{item.title}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== STATS COMPARISON ===== */}
        {adminData?.stats_comparison && (
          <div className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(adminData.stats_comparison).map(([key, data]) => {
                const TrendIcon = data.trend.direction === 'up' ? TrendingUp : 
                                  data.trend.direction === 'down' ? TrendingDown : Minus;
                const trendColor = data.trend.direction === 'up' ? 'text-success' :
                                   data.trend.direction === 'down' ? 'text-destructive' : 'text-muted-foreground';
                const trendBg = data.trend.direction === 'up' ? 'bg-success/10' :
                                data.trend.direction === 'down' ? 'bg-destructive/5' : 'bg-muted';
                
                return (
                  <Card key={key} className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">{data.label}</span>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trendBg} ${trendColor}`}>
                          <TrendIcon className="h-3 w-3" />
                          {data.trend.percent}%
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">{data.current}</span>
                        <span className="text-sm text-muted-foreground">vs {data.previous}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Activity Feed */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4" />
                  Recent Activity
                </h2>
                <div className="space-y-3 max-h-[200px] lg:max-h-[400px] overflow-y-auto">
                  {adminData?.activity_feed?.length > 0 ? (
                    adminData.activity_feed.map((activity, idx) => {
                      const IconComponent = getActivityIcon(activity.icon);
                      return (
                        <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted">
                          <div className={`p-1.5 rounded-lg ${getColorClasses(activity.color)}`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{activity.title}</p>
                            <p className="text-xs text-muted-foreground">{activity.subtitle}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block">
                            {formatTimeAgo(activity.timestamp)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Admin Modules */}
          <div className="lg:col-span-2">
            {/* Full Admin Section */}
            {isFullAdmin && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-foreground mb-3">Administration</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card 
                    className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all"
                    onClick={() => router.push('/college-admin/users')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-sm">User Management</h3>
                          <p className="text-xs text-muted-foreground">{stats.totalUsers} total users</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all"
                    onClick={() => router.push('/college-admin/modules')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                          <LayoutGrid className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-sm">Module Settings</h3>
                          <p className="text-xs text-muted-foreground">Configure modules</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all"
                    onClick={() => router.push('/college-admin/sso')}
                    data-testid="sso-settings-card"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                          <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-sm">SSO Settings</h3>
                          <p className="text-xs text-muted-foreground">Single Sign-On</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all"
                    onClick={() => router.push('/college-admin/privacy')}
                    data-testid="data-privacy-card"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                          <Lock className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-sm">Data Privacy</h3>
                          <p className="text-xs text-muted-foreground">PII encryption status</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all"
                    onClick={() => router.push('/college-admin/security')}
                    data-testid="security-alerts-card"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-destructive to-destructive rounded-xl">
                          <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-sm">Security Alerts</h3>
                          <p className="text-xs text-muted-foreground">IP anomaly detection</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all"
                    onClick={() => router.push('/college-admin/reports')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-success to-success rounded-xl">
                          <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-sm">Reports</h3>
                          <p className="text-xs text-muted-foreground">Export & analytics</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Admin Modules Grid */}
            <h2 className="text-sm font-semibold text-foreground mb-3">Management Tools</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {adminModules.map((module) => (
                <Card
                  key={module.id}
                  className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all ${module.bgColor} ${module.borderColor} ${module.urgent ? 'ring-2 ring-destructive' : ''}`}
                  onClick={() => router.push(module.path)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className={`p-2 bg-gradient-to-br ${module.color} rounded-lg`}>
                        <module.icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {module.stat !== undefined && (
                          <Badge className={`text-xs font-medium ${module.urgent ? 'bg-destructive/80 text-white' : 'bg-secondary text-white'}`}>
                            {module.stat} {module.statLabel}
                          </Badge>
                        )}
                        {module.secondaryStat !== undefined && module.secondaryStat > 0 && (
                          <Badge className="text-xs font-medium bg-secondary text-white">
                            {module.secondaryStat} {module.secondaryLabel}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{module.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* ===== UPCOMING EVENTS SECTION ===== */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Events
              {upcomingEventsList.length > 0 && (
                <Badge className="bg-primary/80 text-white text-xs">{upcomingEventsList.length}</Badge>
              )}
            </h2>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => router.push('/college-admin/events')}>
              Manage Events
            </Button>
          </div>
          {upcomingEventsList.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No upcoming events scheduled</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingEventsList.map(event => (
                <Card key={event.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/college-admin/events')}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(event.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} at {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {event.location && <p className="text-xs text-muted-foreground truncate">{event.location}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge className="text-xs bg-muted text-foreground capitalize">{event.category}</Badge>
                          {event.attendees?.length > 0 && (
                            <span className="text-xs text-muted-foreground">{event.attendees.length} RSVP{event.attendees.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ===== PARCELS SECTION ===== */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Parcels
              {parcels.filter(p => p.status === 'waiting').length > 0 && (
                <Badge className="bg-warning/80 text-white text-xs">
                  {parcels.filter(p => p.status === 'waiting').length} awaiting collection
                </Badge>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                {['waiting', 'collected', 'all'].map(f => (
                  <button
                    key={f}
                    onClick={() => setParcelFilter(f)}
                    className={`px-3 py-1.5 capitalize transition-colors ${parcelFilter === f ? 'bg-primary text-white' : 'bg-white text-muted-foreground hover:bg-muted'}`}
                  >
                    {f === 'waiting' ? 'Pending' : f}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddParcel(true)}
                className="flex items-center gap-1.5 text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Parcel
              </Button>
            </div>
          </div>

          {parcels.filter(p => parcelFilter === 'all' || p.status === parcelFilter).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {parcelFilter === 'waiting' ? 'No parcels awaiting collection' : parcelFilter === 'collected' ? 'No collected parcels' : 'No parcels logged yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {parcels
                .filter(p => parcelFilter === 'all' || p.status === parcelFilter)
                .map(parcel => (
                  <Card key={parcel.id} className={`${parcel.status === 'collected' ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${parcel.status === 'collected' ? 'bg-success/10' : 'bg-warning/10'}`}>
                            <Package className={`h-4 w-4 ${parcel.status === 'collected' ? 'text-success' : 'text-warning'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{parcel.student_name}</p>
                            <p className="text-xs text-muted-foreground">{parcel.student_email}</p>
                          </div>
                        </div>
                        <Badge className={`text-xs ${parcel.status === 'collected' ? 'bg-success/80 text-white' : 'bg-warning/80 text-white'}`}>
                          {parcel.status === 'collected' ? 'Collected' : 'Pending'}
                        </Badge>
                      </div>
                      {(parcel.sender_name || parcel.tracking_number || parcel.description) && (
                        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {parcel.sender_name && <p>From: <span className="text-foreground">{parcel.sender_name}</span></p>}
                          {parcel.tracking_number && <p>Tracking: <span className="text-foreground font-mono">{parcel.tracking_number}</span></p>}
                          {parcel.description && <p>{parcel.description}</p>}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{formatTimeAgo(parcel.created_at)}</p>
                        {parcel.status === 'waiting' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex items-center gap-1"
                            onClick={() => handleMarkParcelCollected(parcel.id)}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Mark Collected
                          </Button>
                        )}
                        {parcel.status === 'collected' && parcel.collected_at && (
                          <p className="text-xs text-success">Collected {formatTimeAgo(parcel.collected_at)}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Parcel Modal */}
      {showAddParcel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddParcel(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Log New Parcel</h2>
              </div>
              <button onClick={() => setShowAddParcel(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleAddParcel} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Resident *</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newParcel.student_id}
                  onChange={e => setNewParcel(p => ({ ...p, student_id: e.target.value }))}
                  required
                >
                  <option value="">Select a resident...</option>
                  {parcelUsers
                    .slice()
                    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sender Name</label>
                <Input
                  placeholder="e.g. Amazon, Royal Mail..."
                  value={newParcel.sender_name}
                  onChange={e => setNewParcel(p => ({ ...p, sender_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tracking Number</label>
                <Input
                  placeholder="Optional tracking number"
                  value={newParcel.tracking_number}
                  onChange={e => setNewParcel(p => ({ ...p, tracking_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <Input
                  placeholder="Any additional details..."
                  value={newParcel.description}
                  onChange={e => setNewParcel(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddParcel(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={parcelSubmitting || !newParcel.student_id}>
                  {parcelSubmitting ? 'Sending...' : 'Notify Resident'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setSearchOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center gap-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search users, events, announcements, groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-0 focus-visible:ring-0 text-lg"
                autoFocus
              />
              {searching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button onClick={() => setSearchOpen(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {searchQuery.length < 2 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p>Type at least 2 characters to search</p>
                  <p className="text-xs mt-2 text-muted-foreground">Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd> anytime to open search</p>
                </div>
              ) : totalSearchResults === 0 && !searching ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No results found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="p-2">
                  {/* Users */}
                  {searchResults.users.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground px-3 py-2">USERS</p>
                      {searchResults.users.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer"
                          onClick={() => { router.push('/college-admin/users'); setSearchOpen(false); }}
                        >
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <Badge className="ml-auto text-xs">{user.role}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Events */}
                  {searchResults.events.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground px-3 py-2">EVENTS</p>
                      {searchResults.events.map(event => (
                        <div
                          key={event.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer"
                          onClick={() => { router.push('/college-admin/events'); setSearchOpen(false); }}
                        >
                          <div className="p-2 bg-muted rounded-lg">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.date?.slice(0, 10)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Announcements */}
                  {searchResults.announcements.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground px-3 py-2">ANNOUNCEMENTS</p>
                      {searchResults.announcements.map(ann => (
                        <div
                          key={ann.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer"
                          onClick={() => { router.push('/college-admin/announcements'); setSearchOpen(false); }}
                        >
                          <div className="p-2 bg-muted rounded-lg">
                            <Megaphone className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{ann.title}</p>
                            <p className="text-xs text-muted-foreground">{ann.target_audience}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Groups */}
                  {searchResults.groups.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground px-3 py-2">CO-CURRICULAR GROUPS</p>
                      {searchResults.groups.map(group => (
                        <div
                          key={group.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer"
                          onClick={() => { router.push('/college-admin/co-curricular'); setSearchOpen(false); }}
                        >
                          <div className="p-2 bg-muted rounded-lg">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{group.name}</p>
                            <p className="text-xs text-muted-foreground">{group.type} • {group.members?.length || 0} members</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t bg-muted rounded-b-xl flex items-center justify-between text-xs text-muted-foreground">
              <span>Press <kbd className="px-1.5 py-0.5 bg-white rounded border">ESC</kbd> to close</span>
              <span>{totalSearchResults} result(s)</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions FAB */}
      <div className="fixed bottom-6 right-6 z-40">
        {quickActionsOpen && (
          <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl border p-2 w-56 mb-2">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => { action.action(); setQuickActionsOpen(false); }}
                className="flex items-center gap-3 w-full p-3 hover:bg-muted rounded-lg text-left"
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-sm font-medium text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setQuickActionsOpen(!quickActionsOpen)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            quickActionsOpen 
              ? 'bg-secondary rotate-45' 
              : 'bg-gradient-to-br from-primary to-secondary hover:from-secondary hover:to-secondary'
          }`}
        >
          <Plus className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Keyboard Shortcuts Help */}
      <button
        onClick={() => setShowShortcuts(true)}
        className="fixed bottom-6 left-6 z-40 p-3 bg-white rounded-full shadow-lg border hover:bg-muted transition-all group"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="h-5 w-5 text-muted-foreground" />
      </button>

{/* Search button removed from fixed position - integrated into header */}

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-2">
              {shortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, i) => (
                      <kbd key={i} className="px-2 py-1 bg-muted rounded text-xs font-mono">{key}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground text-center">Press <kbd className="px-1.5 py-0.5 bg-muted rounded">?</kbd> anytime to show this</p>
          </div>
        </div>
      )}

      {/* Key Sequence Indicator */}
      {keySequence && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm font-mono">
          {keySequence.split('').map((k, i) => (
            <span key={i} className="px-1">{k.toUpperCase()}</span>
          ))}
          <span className="text-muted-foreground ml-2">...</span>
        </div>
      )}
    </div>
  );
};

export default CollegeAdminDashboard;
