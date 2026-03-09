import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Student Screens
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
import NotificationSettingsScreen from '../screens/student/NotificationSettingsScreen';
import CalendarScreen from '../screens/student/CalendarScreen';
// New Module Screens
import AcademicsScreen from '../screens/student/AcademicsScreen';
import CoCurricularScreen from '../screens/student/CoCurricularScreen';
import FloorScreen from '../screens/student/FloorScreen';
import BirthdaysScreen from '../screens/student/BirthdaysScreen';
import SafeDisclosureScreen from '../screens/student/SafeDisclosureScreen';
import ParcelsScreen from '../screens/student/ParcelsScreen';
import BookingsScreen from '../screens/student/BookingsScreen';

import { colors as defaultColors, tabBarStyle, headerStyle, spacing, borderRadius, typography } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useTenant } from '../contexts/TenantContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Shared stack screen options - Swiss Technical style headers
const stackScreenOptions = (colors) => ({ navigation }) => ({
  headerBackTitleVisible: false,
  headerTintColor: colors.textPrimary,
  animation: 'fade_from_bottom',
  animationDuration: 250,
  headerStyle: {
    backgroundColor: colors.surface,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleStyle: {
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  headerShadowVisible: false,
  headerLeft: () => (
    navigation.canGoBack() ? (
      <TouchableOpacity 
        onPress={() => navigation.goBack()} 
        style={{ 
          marginLeft: 4, 
          padding: 10,
          borderRadius: borderRadius.md,
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
    ) : null
  ),
});

// Home Stack - All modules accessible from home
function HomeStack() {
  const { themeColors: colors } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      {/* Core Modules */}
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ headerShown: false }} />
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
      <Stack.Screen name="SafeDisclosure" component={SafeDisclosureScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Parcels" component={ParcelsScreen} options={{ title: 'My Parcels' }} />
      <Stack.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Bookings' }} />
    </Stack.Navigator>
  );
}

// Messages Stack
function MessagesStack() {
  const { themeColors: colors } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="MessagesMain" component={MessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params?.name || 'Chat' })} />
    </Stack.Navigator>
  );
}

// Profile Stack
function ProfileStack() {
  const { themeColors: colors } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notification Settings' }} />
    </Stack.Navigator>
  );
}

// Custom Tab Bar Icon with label
const TabIcon = ({ focused, icon, iconFocused, label, colors }) => (
  <View style={{ alignItems: 'center', justifyContent: 'center', height: 46 }}>
    <Ionicons 
      name={focused ? iconFocused : icon} 
      size={22} 
      color={focused ? colors.tabActive : colors.tabInactive} 
    />
    <Text numberOfLines={1} style={{
      fontSize: 10,
      fontWeight: focused ? '600' : '500',
      color: focused ? colors.tabActive : colors.tabInactive,
      marginTop: 3,
    }}>
      {label}
    </Text>
  </View>
);

export default function StudentTabNavigator() {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const secondaryColor = branding?.secondaryColor || colors.border;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 2,
          borderTopColor: secondaryColor + '40',
          paddingTop: 6,
          paddingBottom: 28,
          height: 85,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarIcon: ({ focused, color }) => {
          let icon;
          if (route.name === 'Home') icon = focused ? 'home' : 'home-outline';
          else if (route.name === 'Messages') icon = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Profile') icon = focused ? 'person' : 'person-outline';
          return <Ionicons name={icon} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
