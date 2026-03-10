import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminEventsScreen from '../screens/admin/AdminEventsScreen';
import AdminAnnouncementsScreen from '../screens/admin/AdminAnnouncementsScreen';
import AdminJobsScreen from '../screens/admin/AdminJobsScreen';
import AdminServiceRequestsScreen from '../screens/admin/AdminServiceRequestsScreen';
import AdminRecognitionScreen from '../screens/admin/AdminRecognitionScreen';
import AdminMessagesScreen from '../screens/admin/AdminMessagesScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import StudentViewScreen from '../screens/admin/StudentViewScreen';
import AnnualDisclosureReportScreen from '../screens/admin/AnnualDisclosureReportScreen';
import StudentReportsScreen from '../screens/admin/StudentReportsScreen';
import TenantManagementScreen from '../screens/admin/TenantManagementScreen';
import TenantDetailScreen from '../screens/superadmin/TenantDetailScreen';
import TenantBrandingScreen from '../screens/superadmin/TenantBrandingScreen';
import AnalyticsReportsScreen from '../screens/admin/AnalyticsReportsScreen';
import AdminDiningMenuScreen from '../screens/admin/AdminDiningMenuScreen';
import AdminCsvTemplatesScreen from '../screens/admin/AdminCsvTemplatesScreen';
import AdminSetupStatsScreen from '../screens/admin/AdminSetupStatsScreen';
import AdminActivitiesScreen from '../screens/admin/AdminActivitiesScreen';
import AdminSafeDisclosuresScreen from '../screens/admin/AdminSafeDisclosuresScreen';
import RelationshipDisclosuresScreen from '../screens/admin/RelationshipDisclosuresScreen';
import GBVTrainingScreen from '../screens/admin/GBVTrainingScreen';

import { colors } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useTenant } from '../contexts/TenantContext';

// Student Screens (shared with Admin)
import ProfileScreen from '../screens/student/ProfileScreen';
import SettingsScreen from '../screens/student/SettingsScreen';
import ChatScreen from '../screens/student/ChatScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import CalendarScreen from '../screens/student/CalendarScreen';
import EventsScreen from '../screens/student/EventsScreen';
import EventDetailScreen from '../screens/student/EventDetailScreen';
import AnnouncementsScreen from '../screens/student/AnnouncementsScreen';
import JobsScreen from '../screens/student/JobsScreen';
import JobDetailScreen from '../screens/student/JobDetailScreen';
import DiningScreen from '../screens/student/DiningScreen';
import MaintenanceScreen from '../screens/student/MaintenanceScreen';
import RecognitionScreen from '../screens/student/RecognitionScreen';
import WellbeingScreen from '../screens/student/WellbeingScreen';
import AcademicsScreen from '../screens/student/AcademicsScreen';
import CoCurricularScreen from '../screens/student/CoCurricularScreen';
import FloorScreen from '../screens/student/FloorScreen';
import BirthdaysScreen from '../screens/student/BirthdaysScreen';
import SafeDisclosureScreen from '../screens/student/SafeDisclosureScreen';
import ParcelsScreen from '../screens/student/ParcelsScreen';
import BookingsScreen from '../screens/student/BookingsScreen';
import MessagesScreen from '../screens/student/MessagesScreen';
import NotificationSettingsScreen from '../screens/student/NotificationSettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Dashboard Stack - includes Admin screens and all Student modules
function DashboardStack() {
  const { themeColors: colors } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerBackTitleVisible: false,
        headerTintColor: colors.textPrimary,
        animation: 'fade_from_bottom',
        animationDuration: 250,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerLeft: () => (
          navigation.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 8, padding: 8 }}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : null
        ),
      })}
    >
      <Stack.Screen name="DashboardMain" component={AdminDashboardScreen} options={{ headerShown: false }} />
      
      {/* Admin-specific Screens */}
      <Stack.Screen name="StudentView" component={StudentViewScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'User Management' }} />
      <Stack.Screen name="AdminEvents" component={AdminEventsScreen} options={{ title: 'Events Management' }} />
      <Stack.Screen name="AdminAnnouncements" component={AdminAnnouncementsScreen} options={{ title: 'News' }} />
      <Stack.Screen name="AdminJobs" component={AdminJobsScreen} options={{ title: 'Job Management' }} />
      <Stack.Screen name="AdminServiceRequests" component={AdminServiceRequestsScreen} options={{ title: 'Service Requests' }} />
      <Stack.Screen name="AdminRecognition" component={AdminRecognitionScreen} options={{ title: 'Shoutouts' }} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: 'Reports & Insights' }} />
      <Stack.Screen name="AnnualDisclosureReport" component={AnnualDisclosureReportScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StudentReports" component={StudentReportsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TenantManagement" component={TenantManagementScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TenantDetail" component={TenantDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TenantBranding" component={TenantBrandingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AnalyticsReports" component={AnalyticsReportsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminDiningMenu" component={AdminDiningMenuScreen} options={{ title: 'Manage Dining Menu' }} />
      <Stack.Screen name="AdminCsvTemplates" component={AdminCsvTemplatesScreen} options={{ title: 'CSV Templates' }} />
      <Stack.Screen name="AdminSetupStats" component={AdminSetupStatsScreen} options={{ title: 'Account Setup Stats' }} />
      <Stack.Screen name="AdminActivities" component={AdminActivitiesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminMessages" component={AdminMessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminSafeDisclosures" component={AdminSafeDisclosuresScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RelationshipDisclosures" component={RelationshipDisclosuresScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GBVTraining" component={GBVTrainingScreen} options={{ headerShown: false }} />
      
      {/* Student Modules (accessible by Admin) */}
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'News' }} />
      <Stack.Screen name="Jobs" component={JobsScreen} options={{ title: 'College Jobs' }} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job Details' }} />
      <Stack.Screen name="Dining" component={DiningScreen} options={{ title: 'Dining' }} />
      <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Maintenance' }} />
      <Stack.Screen name="Recognition" component={RecognitionScreen} options={{ title: 'Shoutouts' }} />
      <Stack.Screen name="Wellbeing" component={WellbeingScreen} options={{ title: 'Wellbeing' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Academics" component={AcademicsScreen} options={{ title: 'Study' }} />
      <Stack.Screen name="CoCurricular" component={CoCurricularScreen} options={{ title: 'Activities' }} />
      <Stack.Screen name="Floor" component={FloorScreen} options={{ title: 'My Floor' }} />
      <Stack.Screen name="Birthdays" component={BirthdaysScreen} options={{ title: 'Birthdays' }} />
      <Stack.Screen name="SafeDisclosure" component={SafeDisclosureScreen} options={{ title: 'Safe Disclosure' }} />
      <Stack.Screen name="Parcels" component={ParcelsScreen} options={{ title: 'My Parcels' }} />
      <Stack.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Bookings' }} />
    </Stack.Navigator>
  );
}

// Messages Stack
function MessagesStack() {
  const { themeColors: colors } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
        headerTintColor: colors.textPrimary,
        animation: 'fade_from_bottom',
        animationDuration: 250,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="MessagesMain" component={MessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params?.name || 'Chat' })} />
    </Stack.Navigator>
  );
}

// Profile Stack
function ProfileStack() {
  const { themeColors: colors } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
        headerTintColor: colors.textPrimary,
        animation: 'fade_from_bottom',
        animationDuration: 250,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} options={{ title: 'Admin Settings' }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notification Settings' }} />
    </Stack.Navigator>
  );
}

export default function AdminTabNavigator() {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const secondaryColor = branding?.secondaryColor || colors.border;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 2,
          borderTopColor: secondaryColor + '40',
          paddingTop: 6,
          paddingBottom: 28,
          height: 85,
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Dashboard') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
