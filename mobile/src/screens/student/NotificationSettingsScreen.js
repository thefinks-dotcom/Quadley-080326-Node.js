import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTenant } from '../../contexts/TenantContext';

export default function NotificationSettingsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { 
    preferences, 
    updatePreferences, 
    permissionStatus, 
    sendTestNotification,
    pushToken 
  } = useNotifications();
  
  const [localPrefs, setLocalPrefs] = useState({
    announcements: true,
    events: true,
    messages: true,
    shoutouts: true,
    dining_menu: true,
    parcels: true,
    maintenance: true,
  });
  const [saving, setSaving] = useState(false);
  const [testingSending, setTestingSending] = useState(false);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const handleToggle = async (key) => {
    const newValue = !localPrefs[key];
    setLocalPrefs(prev => ({ ...prev, [key]: newValue }));
    
    setSaving(true);
    const success = await updatePreferences({ [key]: newValue });
    setSaving(false);
    
    if (!success) {
      // Revert on failure
      setLocalPrefs(prev => ({ ...prev, [key]: !newValue }));
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  const handleTestNotification = async () => {
    if (!pushToken) {
      Alert.alert(
        'Push Notifications Disabled',
        'Please enable push notifications in your device settings to receive notifications.'
      );
      return;
    }

    setTestingSending(true);
    const result = await sendTestNotification();
    setTestingSending(false);

    if (result?.success) {
      Alert.alert('Success', 'Test notification sent! You should receive it shortly.');
    } else {
      Alert.alert(
        'Error',
        result?.message || 'Failed to send test notification. Make sure notifications are enabled.'
      );
    }
  };

  const notificationOptions = [
    { key: 'announcements', label: 'Announcements', icon: 'megaphone', color: primaryColor, description: 'College-wide announcements and updates' },
    { key: 'events', label: 'Events', icon: 'calendar', color: primaryColor, description: 'Event reminders and updates' },
    { key: 'messages', label: 'Messages', icon: 'chatbubble', color: primaryColor, description: 'Direct messages from other residents' },
    { key: 'shoutouts', label: 'Recognition', icon: 'star', color: colors.error, description: 'When someone gives you a shoutout' },
    { key: 'dining_menu', label: 'Dining', icon: 'restaurant', color: primaryColor, description: 'Daily menu updates and dining alerts' },
    { key: 'parcels', label: 'Parcels', icon: 'cube', color: primaryColor, description: 'When a parcel arrives for you' },
    { key: 'maintenance', label: 'Maintenance', icon: 'construct', color: colors.error, description: 'Updates on your service requests' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <ScrollView>
        {/* Status Section */}
        <View style={{ padding: spacing.lg }}>
          <View style={{
            backgroundColor: permissionStatus === 'granted' ? primaryColor + '15' : colors.errorLight,
            borderRadius: borderRadius.md,
            padding: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: permissionStatus === 'granted' ? primaryColor + '15' : colors.errorLight,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Ionicons
                name={permissionStatus === 'granted' ? 'notifications' : 'notifications-off'}
                size={24}
                color={permissionStatus === 'granted' ? primaryColor : colors.error}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: permissionStatus === 'granted' ? primaryColor : colors.error,
              }}>
                {permissionStatus === 'granted' ? 'Notifications Enabled' : 'Notifications Disabled'}
              </Text>
              <Text style={{
                fontSize: 13,
                color: permissionStatus === 'granted' ? primaryColor : colors.error,
                marginTop: 2,
              }}>
                {permissionStatus === 'granted' 
                  ? 'You will receive push notifications' 
                  : 'Enable in device settings to receive notifications'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Test Notification */}
        {permissionStatus === 'granted' && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={handleTestNotification}
              disabled={testingSending}
              style={{
                backgroundColor: primaryColor,
                borderRadius: borderRadius.md,
                padding: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: testingSending ? 0.7 : 1,
              }}
            >
              {testingSending ? (
                <ActivityIndicator color={colors.textInverse} style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name="paper-plane" size={20} color={colors.textInverse} style={{ marginRight: 8 }} />
              )}
              <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600' }}>
                {testingSending ? 'Sending...' : 'Send Test Notification'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notification Categories */}
        <View style={{ padding: spacing.lg }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Notification Categories
          </Text>
          
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
            {notificationOptions.map((option, index) => (
              <View key={option.key}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.lg,
                  borderBottomWidth: index < notificationOptions.length - 1 ? 1 : 0,
                  borderBottomColor: colors.surfaceSecondary,
                }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.md,
                    backgroundColor: `${option.color}15`,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name={option.icon} size={20} color={option.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textPrimary }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                      {option.description}
                    </Text>
                  </View>
                  <Switch
                    value={localPrefs[option.key]}
                    onValueChange={() => handleToggle(option.key)}
                    trackColor={{ false: colors.border, true: primaryColor + '15' }}
                    thumbColor={localPrefs[option.key] ? primaryColor : colors.surfaceSecondary}
                    disabled={saving}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Info Section */}
        <View style={{ padding: spacing.lg, marginTop: 8 }}>
          <View style={{
            backgroundColor: primaryColor + '15',
            borderRadius: borderRadius.md,
            padding: spacing.lg,
            flexDirection: 'row',
          }}>
            <Ionicons name="information-circle" size={24} color={primaryColor} style={{ marginRight: 12, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: primaryColor, marginBottom: 4 }}>
                About Notifications
              </Text>
              <Text style={{ fontSize: 13, color: primaryColor, lineHeight: 20 }}>
                These settings control which types of push notifications you receive. 
                You can still view all updates within the app regardless of these settings.
              </Text>
            </View>
          </View>
        </View>

        {saving && (
          <View style={{ padding: spacing.lg, alignItems: 'center' }}>
            <ActivityIndicator color={primaryColor} />
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
