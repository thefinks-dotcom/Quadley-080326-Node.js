import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Super Admin Screens
import SuperAdminDashboardScreen from '../screens/superadmin/SuperAdminDashboardScreen';
import TenantManagementScreen from '../screens/admin/TenantManagementScreen';
import TenantDetailScreen from '../screens/superadmin/TenantDetailScreen';
import TenantBrandingScreen from '../screens/superadmin/TenantBrandingScreen';

// Shared Screens
import ProfileScreen from '../screens/student/ProfileScreen';
import SettingsScreen from '../screens/student/SettingsScreen';
import MessagesScreen from '../screens/student/MessagesScreen';
import ChatScreen from '../screens/student/ChatScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import NotificationSettingsScreen from '../screens/student/NotificationSettingsScreen';

import { colors } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useTenant } from '../contexts/TenantContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Dashboard Stack for Super Admin
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
      <Stack.Screen 
        name="SuperAdminDashboardMain" 
        component={SuperAdminDashboardScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="TenantManagement" 
        component={TenantManagementScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="TenantDetail" 
        component={TenantDetailScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="TenantBranding" 
        component={TenantBrandingScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ title: 'Notifications' }} 
      />
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
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notification Settings' }} />
    </Stack.Navigator>
  );
}

export default function SuperAdminTabNavigator() {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const secondaryColor = branding?.secondaryColor || colors.border;
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
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
            iconName = focused ? 'business' : 'business-outline';
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
