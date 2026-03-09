import React, { useState, useEffect, useContext } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '@/App';
import {
  LayoutGrid,
  MessageCircle,
  User,
} from 'lucide-react';

import HomeModule from '@/components/modules/HomeModule';
import MessagesModule from '@/modules/MessagesModule';
import EventsModule from '@/components/modules/EventsModule';
import AnnouncementsModule from '@/components/modules/AnnouncementsModule';
import IncidentReportingModule from '@/components/modules/IncidentReportingModule';
import MaintenanceModule from '@/components/modules/MaintenanceModule';
import AcademicsModule from '@/components/modules/AcademicsModule';
import WellbeingModule from '@/components/modules/WellbeingModule';
import PastoralCareModule from '@/components/modules/PastoralCareModule';
import WellnessResourcesModule from '@/components/modules/WellnessResourcesModule';
import SafeDisclosureModule from '@/components/modules/SafeDisclosureModule';
import DiningModule from '@/components/modules/DiningModule';
import HousesModule from '@/components/modules/HousesModule';
import RecognitionModule from '@/components/modules/RecognitionModule';
import OWeekModule from '@/components/modules/OWeekModule';
import MemoryLaneModule from '@/components/modules/MemoryLaneModule';
import AIModule from '@/components/modules/AIModule';
import ProfileModule from '@/components/modules/ProfileModule';
import SettingsModule from '@/components/modules/SettingsModule';
import CoCurricularModule from '@/components/modules/CoCurricularModule';
import CulturalModule from '@/components/modules/CulturalModule';
import SportsModule from '@/components/modules/SportsModule';
import ClubsModule from '@/components/modules/ClubsModule';
import BirthdayModule from '@/components/modules/BirthdayModule';
import AdminModule from '@/components/modules/AdminModule';
import RAFloorManagementModule from '@/components/modules/RAFloorManagementModule';
import RAFloorEventsModule from '@/components/modules/RAFloorEventsModule';
import OnboardingModal from '@/components/OnboardingModal';

const BOTTOM_NAV_TABS = [
  { id: 'home', label: 'Dashboard', icon: LayoutGrid, path: '/dashboard' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
  { id: 'profile', label: 'Profile', icon: User, path: '/dashboard/profile' },
];

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !user.onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [user]);

  const currentPath = location.pathname;

  const isTabActive = (path) => {
    if (path === '/dashboard') return currentPath === '/dashboard';
    return currentPath.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'var(--bottom-nav-height)' }}>
        <Routes>
          <Route index element={<HomeModule />} />
          <Route path="messages" element={<MessagesModule />} />
          <Route path="events" element={<EventsModule />} />
          <Route path="announcements" element={<AnnouncementsModule />} />
          <Route path="incidents" element={<IncidentReportingModule />} />
          <Route path="maintenance" element={<MaintenanceModule />} />
          <Route path="academics" element={<AcademicsModule />} />
          <Route path="wellbeing" element={<WellbeingModule />} />
          <Route path="wellbeing/pastoral" element={<PastoralCareModule />} />
          <Route path="wellbeing/resources" element={<WellnessResourcesModule />} />
          <Route path="safe-disclosure" element={<SafeDisclosureModule />} />
          <Route path="dining" element={<DiningModule />} />
          <Route path="houses" element={<HousesModule />} />
          <Route path="recognition" element={<RecognitionModule />} />
          <Route path="oweek" element={<OWeekModule />} />
          <Route path="memory" element={<MemoryLaneModule />} />
          <Route path="ai" element={<AIModule />} />
          <Route path="profile" element={<ProfileModule />} />
          <Route path="settings" element={<SettingsModule />} />
          <Route path="cocurricular" element={<CoCurricularModule />} />
          <Route path="cocurricular/cultural" element={<CulturalModule />} />
          <Route path="cocurricular/sports" element={<SportsModule />} />
          <Route path="cocurricular/clubs" element={<ClubsModule />} />
          <Route path="birthdays" element={<BirthdayModule />} />
          <Route path="ra-floor" element={<RAFloorManagementModule />} />
          <Route path="ra-events" element={<RAFloorEventsModule />} />
          <Route path="admin" element={<AdminModule />} />
        </Routes>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 flex items-center justify-around"
        style={{ height: 'var(--bottom-nav-height)' }}
      >
        {BOTTOM_NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.path);
          return (
            <button
              key={tab.id}
              data-testid={`bottom-nav-${tab.id}`}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.5 : 1.5}
                style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Dashboard;
