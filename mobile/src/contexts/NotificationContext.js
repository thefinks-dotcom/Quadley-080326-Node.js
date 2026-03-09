/**
 * Notification Context
 * Provides app-wide notification state and functions
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import pushNotificationService from '../services/pushNotificationService';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children, navigationRef }) => {
  const { user, isAuthenticated } = useAuth();
  const [pushToken, setPushToken] = useState(null);
  const [notification, setNotification] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const appState = useRef(AppState.currentState);

  // Register for push notifications when user logs in
  useEffect(() => {
    let mounted = true;

    const setupNotifications = async () => {
      if (!isAuthenticated || !user) {
        return;
      }

      try {
        // Register for push notifications
        const token = await pushNotificationService.registerForPushNotifications();
        
        if (mounted && token) {
          setPushToken(token);
          setPermissionStatus('granted');
          
          // Register with backend
          await pushNotificationService.registerDeviceWithBackend(token);
          
          // Get user's notification preferences
          const prefs = await pushNotificationService.getPreferences();
          if (prefs) {
            setPreferences(prefs);
          }
        } else if (mounted) {
          setPermissionStatus('denied');
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user]);

  // Navigate to appropriate screen based on notification type
  const handleNotificationNavigation = useCallback((data, nav) => {
    try {
      switch (data.type) {
        case 'message':
          nav.navigate('Messages', { 
            screen: 'Chat', 
            params: { userId: data.sender_id } 
          });
          break;
        case 'announcement':
          nav.navigate('Home', { 
            screen: 'Announcements' 
          });
          break;
        case 'event':
        case 'event_reminder':
          nav.navigate('Home', { 
            screen: 'Events' 
          });
          break;
        case 'parcel':
          nav.navigate('Home', { 
            screen: 'Parcels' 
          });
          break;
        case 'maintenance':
          nav.navigate('Home', { 
            screen: 'Maintenance' 
          });
          break;
        case 'shoutout':
          nav.navigate('Home', { 
            screen: 'Recognition' 
          });
          break;
        case 'job_application':
          // Admin notification - go to job applications
          nav.navigate('Jobs', {
            screen: 'JobApplications',
            params: { jobId: data.job_id }
          });
          break;
        case 'job_application_status':
          // Student notification - go to my applications
          nav.navigate('Jobs', {
            screen: 'MyApplications'
          });
          break;
        default:
          // Default to notifications list
          nav.navigate('Home', {
            screen: 'Notifications'
          });
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, []);

  // Set up notification listeners
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Handle notification received while app is open
    const handleNotificationReceived = (notification) => {
      setNotification(notification);
      // You could also show an in-app alert here
    };

    // Handle notification tap
    const handleNotificationResponse = (response) => {
      const data = response.notification.request.content.data;
      
      // Navigate based on notification type (use ref.current)
      if (data?.type && navigationRef?.current) {
        handleNotificationNavigation(data, navigationRef.current);
      }
    };

    pushNotificationService.setupListeners(
      handleNotificationReceived,
      handleNotificationResponse
    );

    return () => {
      pushNotificationService.removeListeners();
    };
  }, [isAuthenticated, navigationRef, handleNotificationNavigation]);

  // Clear badge when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground
        pushNotificationService.clearBadge();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Update notification preferences
  const updatePreferences = useCallback(async (newPrefs) => {
    const success = await pushNotificationService.updatePreferences(newPrefs);
    if (success) {
      setPreferences(prev => ({ ...prev, ...newPrefs }));
    }
    return success;
  }, []);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    return await pushNotificationService.sendTestNotification();
  }, []);

  // Unregister device (call on logout)
  const unregisterDevice = useCallback(async () => {
    await pushNotificationService.unregisterDevice();
    setPushToken(null);
  }, []);

  const value = {
    pushToken,
    notification,
    preferences,
    permissionStatus,
    updatePreferences,
    sendTestNotification,
    unregisterDevice,
    clearNotification: () => setNotification(null),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
