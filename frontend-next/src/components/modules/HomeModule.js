'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Sparkles, Package, Building,
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { MODULE_REGISTRY, AI_MODULE } from '@/config/moduleRegistry';

const DASHBOARD_CACHE_KEY = 'quadley_dashboard_cache';

const RA_TOOLS = [
  {
    id: 'ra-floor',
    label: 'Floor Mgmt',
    icon: Building,
    href: '/dashboard/ra-floor',
    gradient: 'from-warning to-secondary',
  },
];

const HomeModule = () => {
  const { user, enabledModules } = useContext(AuthContext);
  const router = useRouter();

  const [dashboard, setDashboard] = useState(() => {
    try {
      const cached = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [activeBanner, setActiveBanner] = useState(null);
  const [pendingParcels, setPendingParcels] = useState([]);

  useEffect(() => {
    fetchDashboard();
    checkActiveBanner();
    fetchPendingParcels();
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
      if (today <= dayAfterMoveIn) setActiveBanner('move-in');
      else if (today >= oWeekStart && today <= oWeekEnd) setActiveBanner('o-week');
      else setActiveBanner(null);
    } catch {}
  };

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/dashboard`);
      setDashboard(response.data);
      try { sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(response.data)); } catch {}
    } catch {}
  };

  const fetchPendingParcels = async () => {
    try {
      const response = await axios.get(`${API}/parcels/my-pending`);
      setPendingParcels(response.data);
    } catch {}
  };

  const markParcelCollected = async (parcelId) => {
    try {
      await axios.put(`${API}/parcels/${parcelId}/collect`);
      toast.success('Parcel marked as collected!');
      fetchPendingParcels();
    } catch {
      toast.error('Failed to mark parcel as collected');
    }
  };

  if (!dashboard) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );

  const visibleModules = enabledModules
    ? MODULE_REGISTRY.filter(mod => enabledModules.includes(mod.id))
    : MODULE_REGISTRY;

  const moduleBadges = {
    announcements: dashboard.recent_announcements?.length || 0,
    messages: dashboard.unread_messages_count || 0,
  };

  const tileCount = visibleModules.length + 1;
  const gridCols = tileCount <= 4 ? 2 : tileCount <= 8 ? 3 : 4;

  const isRA = user?.role === 'ra';

  return (
    <div className="min-h-screen bg-background" data-testid="home-module">
      <ModuleHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.first_name}!`}
        showSearch={false}
      />

      <div className="px-4 pt-4 space-y-6">

        {activeBanner === 'move-in' && <MoveInMagicBanner />}
        {activeBanner === 'o-week' && <OWeekBanner />}

        {pendingParcels.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-warning/10 border border-warning/30">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning to-orange-400 flex items-center justify-center text-white text-lg flex-shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">
                {pendingParcels.length} parcel{pendingParcels.length > 1 ? 's' : ''} waiting at reception
              </p>
              {pendingParcels[0]?.sender_name && (
                <p className="text-xs text-muted-foreground truncate">From: {pendingParcels[0].sender_name}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/dashboard/parcels')}
              className="flex-shrink-0 border-warning text-warning hover:bg-warning/10"
            >
              View
            </Button>
          </div>
        )}

        <div
          className="launcher-grid"
          style={{ '--grid-cols': gridCols }}
        >
          {visibleModules.map((mod) => {
            const Icon = mod.icon;
            const badge = moduleBadges[mod.id] || 0;
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className="launcher-tile"
                data-testid={`quick-${mod.id}`}
              >
                <div className="relative">
                  <div className={`launcher-icon bg-gradient-to-br ${mod.gradient}`}>
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                  </div>
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className="launcher-label">{mod.label}</span>
              </Link>
            );
          })}

          <Link
            href={AI_MODULE.href}
            className="launcher-tile"
            data-testid="quick-ai"
          >
            <div className={`launcher-icon bg-gradient-to-br ${AI_MODULE.gradient}`}>
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <span className="launcher-label">{AI_MODULE.label}</span>
          </Link>
        </div>

        {isRA && (
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">RA Tools</h3>
            <div className="grid grid-cols-2 gap-3">
              {RA_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    className="launcher-tile"
                    data-testid={`ra-${tool.id}`}
                  >
                    <div className={`launcher-icon bg-gradient-to-br ${tool.gradient}`}>
                      <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                    </div>
                    <span className="launcher-label">{tool.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const MoveInMagicBanner = () => (
  <Card className="p-4 glass border-2 border-primary bg-gradient-to-r from-primary/10 to-secondary/10">
    <div className="flex items-center gap-3">
      <div className="text-3xl">🏠</div>
      <div>
        <h3 className="font-bold text-lg">Welcome to Your New Home!</h3>
        <p className="text-sm text-muted-foreground">Move-in day is here — explore your campus and get settled in!</p>
      </div>
    </div>
  </Card>
);

const OWeekBanner = () => (
  <Card className="p-4 glass border-2 border-secondary bg-gradient-to-r from-secondary/10 to-primary/10">
    <div className="flex items-center gap-3">
      <div className="text-3xl">🎉</div>
      <div>
        <h3 className="font-bold text-lg">O-Week is ON!</h3>
        <p className="text-sm text-muted-foreground">Check out events, meet your floormates, and make the most of orientation week!</p>
      </div>
    </div>
  </Card>
);

export default HomeModule;
