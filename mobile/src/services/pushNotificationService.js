/**
 * Push Notification Service
 * Handles registration, permissions, and notification handling for iOS/Android
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { colors } from '../theme';
import api from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  /**
   * Request notification permissions and get push token
   */
  async registerForPushNotifications() {
    let token = null;

    // Must be a physical device for push notifications
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    try {
      // Get the Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.warn('Project ID not found, using getDevicePushTokenAsync');
        // Fallback to native push token for production builds
        const nativeToken = await Notifications.getDevicePushTokenAsync();
        token = nativeToken.data;
      } else {
        const expoPushToken = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        token = expoPushToken.data;
      }

      this.expoPushToken = token;
      console.log('Push token obtained successfully');

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: colors.primary,
        });
      }

      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Register the device token with the backend
   */
  async registerDeviceWithBackend(token) {
    if (!token) {
      console.log('No token to register');
      return false;
    }

    try {
      // Clean up the token (remove ExponentPushToken[] wrapper if present)
      let cleanToken = token;
      if (token.startsWith('ExponentPushToken[')) {
        cleanToken = token.replace('ExponentPushToken[', '').replace(']', '');
      }

      await api.post('/notifications/register-device', {
        device_token: cleanToken,
        platform: Platform.OS,
      });

      console.log('Device registered with backend');
      return true;
    } catch (error) {
      console.error('Failed to register device:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Unregister device from backend (call on logout)
   */
  async unregisterDevice() {
    try {
      await api.delete('/notifications/unregister-device');
      console.log('Device unregistered from backend');
      return true;
    } catch (error) {
      console.error('Failed to unregister device:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Set up notification listeners
   * @param {Function} onNotificationReceived - Callback when notification received while app is open
   * @param {Function} onNotificationResponse - Callback when user taps notification
   */
  setupListeners(onNotificationReceived, onNotificationResponse) {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for when user interacts with notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });
  }

  /**
   * Remove notification listeners
   */
  removeListeners() {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Get notification preferences from backend
   */
  async getPreferences() {
    try {
      const response = await api.get('/notifications/preferences');
      return response.data;
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return null;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences) {
    try {
      await api.put('/notifications/preferences', preferences);
      return true;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  /**
   * Send test notification to self
   */
  async sendTestNotification() {
    try {
      const response = await api.post('/notifications/test', {
        title: 'Test Notification',
        body: 'Push notifications are working! 🎉',
      });
      return response.data;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current push token
   */
  getToken() {
    return this.expoPushToken;
  }

  /**
   * Clear badge count
   */
  async clearBadge() {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllScheduledNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
