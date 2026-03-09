import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import InviteCodeScreen from '../screens/auth/InviteCodeScreen';

// MFA Screens
import MFASetupScreen from '../screens/auth/MFASetupScreen';
import MFAVerifyScreen from '../screens/auth/MFAVerifyScreen';

// Main Tab Navigators
import StudentTabNavigator from './StudentTabNavigator';
import AdminTabNavigator from './AdminTabNavigator';
import RATabNavigator from './RATabNavigator';
import SuperAdminTabNavigator from './SuperAdminTabNavigator';

const Stack = createNativeStackNavigator();

// Separate stack for auth screens
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="InviteCode" component={InviteCodeScreen} />
    </Stack.Navigator>
  );
}

// Get the appropriate main navigator based on user role
function getMainNavigator(role) {
  if (role === 'super_admin') {
    return SuperAdminTabNavigator;
  } else if (role === 'admin') {
    return AdminTabNavigator;
  } else if (role === 'ra') {
    return RATabNavigator;
  }
  return StudentTabNavigator;
}

export default function RootNavigator() {
  const { themeColors: colors } = useAppTheme();
  const { isAuthenticated, loading, user, mfaRequired, mfaSetupRequired } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthStack />;
  }

  // Authenticated but MFA setup required (first-time admin/RA)
  if (mfaSetupRequired) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="MFASetup"
          component={MFASetupScreen}
          initialParams={{ required: true }}
        />
      </Stack.Navigator>
    );
  }

  // Authenticated but MFA verification required (returning admin with MFA enabled)
  if (mfaRequired) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MFAVerify" component={MFAVerifyScreen} />
      </Stack.Navigator>
    );
  }

  // Fully authenticated - render role-based navigator
  const MainNavigator = getMainNavigator(user?.role);
  return <MainNavigator />;
}
