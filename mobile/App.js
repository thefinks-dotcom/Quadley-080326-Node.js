import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, LogBox, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/contexts/AuthContext';
import { TenantProvider } from './src/contexts/TenantContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { ThemeProvider, useAppTheme } from './src/contexts/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runIntegrityChecks } from './src/services/integrityService';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as SplashScreen from 'expo-splash-screen';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

SplashScreen.preventAutoHideAsync();

// Configure Google Sign-In once at app startup.
// iosClientId and webClientId come from app.config.js extra (set via env vars at build time).
GoogleSignin.configure({
  webClientId: Constants.expoConfig?.extra?.googleWebClientId || '',
  iosClientId: Constants.expoConfig?.extra?.googleIosClientId || '',
  offlineAccess: false,
});

// Ignore specific warnings that don't affect functionality
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed',
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#ef4444' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 20, textAlign: 'center' }}>
            Please restart the app
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  const navigationRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [integrityWarning, setIntegrityWarning] = useState(null);

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // Set default font for all Text components
  useEffect(() => {
    if (fontsLoaded || fontError) {
      const originalRender = Text.render;
      Text.render = function (...args) {
        const origin = originalRender.call(this, ...args);
        const style = origin.props.style;
        // Flatten style to check fontWeight
        const flatStyle = Array.isArray(style)
          ? Object.assign({}, ...style.filter(Boolean).map(s => (typeof s === 'object' ? s : {})))
          : (style || {});
        
        let fontFamily = 'PlusJakartaSans_400Regular';
        const weight = flatStyle.fontWeight;
        if (weight === '700' || weight === 'bold') fontFamily = 'PlusJakartaSans_700Bold';
        else if (weight === '600') fontFamily = 'PlusJakartaSans_600SemiBold';
        else if (weight === '500') fontFamily = 'PlusJakartaSans_500Medium';
        else if (weight === '300' || weight === 'light') fontFamily = 'PlusJakartaSans_300Light';

        return React.cloneElement(origin, {
          style: [{ fontFamily }, origin.props.style],
        });
      };
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Run security integrity checks on app startup (OWASP A08)
    const checkIntegrity = async () => {
      try {
        const result = await runIntegrityChecks();
        if (!result.safe) {
          // Log but don't block the app - just warn user
          console.warn('Integrity check failed:', result.checks);
          setIntegrityWarning(result);
          // Show warning to user about potential security risks
          Alert.alert(
            'Security Notice',
            'This device may have modified security settings. Some features may be restricted for your protection.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.warn('Integrity check error:', error);
      }
    };

    checkIntegrity();

    // Small delay to ensure everything is loaded
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Hide splash screen once everything is loaded
  SplashScreen.hideAsync();

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TenantProvider>
              <AuthProvider>
                <NavigationContainer ref={navigationRef}>
                  <NotificationProvider navigationRef={navigationRef}>
                    <RootNavigator />
                    <ThemedStatusBar />
                  </NotificationProvider>
                </NavigationContainer>
              </AuthProvider>
            </TenantProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
