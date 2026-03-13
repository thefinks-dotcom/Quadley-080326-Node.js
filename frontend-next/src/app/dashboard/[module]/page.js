'use client';

import { useParams } from 'next/navigation';
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
import ParcelsModule from '@/components/modules/ParcelsModule';

const MODULE_MAP = {
  messages:       MessagesModule,
  events:         EventsModule,
  announcements:  AnnouncementsModule,
  incidents:      IncidentReportingModule,
  maintenance:    MaintenanceModule,
  academics:      AcademicsModule,
  wellbeing:      WellbeingModule,
  pastoral:       PastoralCareModule,
  resources:      WellnessResourcesModule,
  'safe-disclosure': SafeDisclosureModule,
  dining:         DiningModule,
  houses:         HousesModule,
  recognition:    RecognitionModule,
  oweek:          OWeekModule,
  memory:         MemoryLaneModule,
  ai:             AIModule,
  profile:        ProfileModule,
  settings:       SettingsModule,
  cocurricular:   CoCurricularModule,
  cultural:       CulturalModule,
  sports:         SportsModule,
  clubs:          ClubsModule,
  birthdays:      BirthdayModule,
  'ra-floor':     RAFloorManagementModule,
  admin:          AdminModule,
  jobs:           AdminModule,
  parcels:        ParcelsModule,
};

export default function DashboardModulePage() {
  const { module: moduleSlug } = useParams();
  const ModuleComponent = MODULE_MAP[moduleSlug];

  if (!ModuleComponent) {
    return (
      <div className="min-h-[calc(100vh-var(--bottom-nav-height))] flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="font-heading text-lg font-semibold text-foreground">Module not found</p>
          <p className="text-sm text-muted-foreground">The module "{moduleSlug}" doesn't exist.</p>
        </div>
      </div>
    );
  }

  return <ModuleComponent />;
}
