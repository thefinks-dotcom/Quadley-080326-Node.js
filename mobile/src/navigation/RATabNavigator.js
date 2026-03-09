import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Student Screens (RA has access to these)
import HomeScreen from '../screens/student/HomeScreen';
import EventsScreen from '../screens/student/EventsScreen';
import EventDetailScreen from '../screens/student/EventDetailScreen';
import AnnouncementsScreen from '../screens/student/AnnouncementsScreen';
import MessagesScreen from '../screens/student/MessagesScreen';
import ChatScreen from '../screens/student/ChatScreen';
import JobsScreen from '../screens/student/JobsScreen';
import JobDetailScreen from '../screens/student/JobDetailScreen';
import DiningScreen from '../screens/student/DiningScreen';
import MaintenanceScreen from '../screens/student/MaintenanceScreen';
import RecognitionScreen from '../screens/student/RecognitionScreen';
import WellbeingScreen from '../screens/student/WellbeingScreen';
import ProfileScreen from '../screens/student/ProfileScreen';
import SettingsScreen from '../screens/student/SettingsScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import CalendarScreen from '../screens/student/CalendarScreen';
import AcademicsScreen from '../screens/student/AcademicsScreen';
import CoCurricularScreen from '../screens/student/CoCurricularScreen';
import FloorScreen from '../screens/student/FloorScreen';
import BirthdaysScreen from '../screens/student/BirthdaysScreen';
import SafeDisclosureScreen from '../screens/student/SafeDisclosureScreen';
import ParcelsScreen from '../screens/student/ParcelsScreen';
import BookingsScreen from '../screens/student/BookingsScreen';

// RA Specific Screens
import RAIncidentReportingScreen from '../screens/ra/RAIncidentReportingScreen';
import RAFloorManagementScreen from '../screens/ra/RAFloorManagementScreen';
import RAFloorEventsScreen from '../screens/ra/RAFloorEventsScreen';

import { colors as defaultColors } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useTenant } from '../contexts/TenantContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const getScreenOptions = (colors) => ({ navigation }) => ({
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
});

// Home Stack - All modules accessible from home
function HomeStack() {
  const { themeColors: colors } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={getScreenOptions(colors)}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      {/* RA Specific Screens accessible from Home */}
      <Stack.Screen name="RAIncidentReporting" component={RAIncidentReportingScreen} options={{ title: 'RA Tools' }} />
      <Stack.Screen name="RAFloorManagement" component={RAFloorManagementScreen} options={{ title: 'Floor Management' }} />
      <Stack.Screen name="RAFloorEvents" component={RAFloorEventsScreen} options={{ title: 'Floor Events' }} />
      {/* Core Modules */}
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
      {/* Additional Modules */}
      <Stack.Screen name="Academics" component={AcademicsScreen} options={{ title: 'Study' }} />
      <Stack.Screen name="CoCurricular" component={CoCurricularScreen} options={{ title: 'Activities' }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params?.name || 'Chat' })} />
      <Stack.Screen name="Floor" component={FloorScreen} options={{ title: 'My Floor' }} />
      <Stack.Screen name="Birthdays" component={BirthdaysScreen} options={{ title: 'Birthdays' }} />
      <Stack.Screen name="SafeDisclosure" component={SafeDisclosureScreen} options={{ title: 'Safe Disclosure' }} />
      <Stack.Screen name="Parcels" component={ParcelsScreen} options={{ title: 'My Parcels' }} />
      <Stack.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Bookings' }} />
    </Stack.Navigator>
  );
}

// RA Tools Stack - Incident Reporting & Floor Management
function RADutiesStack() {
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
      <Stack.Screen name="RAIncidentReporting" component={RAIncidentReportingScreen} options={{ title: 'RA Tools' }} />
      <Stack.Screen name="RAFloorManagement" component={RAFloorManagementScreen} options={{ title: 'Floor Management' }} />
      <Stack.Screen name="RAFloorEvents" component={RAFloorEventsScreen} options={{ title: 'Floor Events' }} />
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
    </Stack.Navigator>
  );
}

export default function RATabNavigator() {
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
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'RA Tools') {
            iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="RA Tools" component={RADutiesStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
