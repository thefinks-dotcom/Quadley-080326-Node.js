import React from 'react';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';

export default function NotificationsScreen() {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { data: notifications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.NOTIFICATIONS);
      return response.data;
    },
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'announcement': return { name: 'megaphone', color: primaryColor };
      case 'event': return { name: 'calendar', color: primaryColor };
      case 'message': return { name: 'chatbubble', color: primaryColor };
      case 'maintenance': return { name: 'construct', color: primaryColor };
      case 'recognition': return { name: 'star', color: colors.error };
      case 'job': return { name: 'briefcase', color: primaryColor };
      default: return { name: 'notifications', color: colors.textSecondary };
    }
  };

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          padding: spacing.lg,
          backgroundColor: item.read ? colors.surface : primaryColor + '15',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            backgroundColor: `${icon.color}20`,
            borderRadius: borderRadius.md,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name={icon.name} size={22} color={icon.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: item.read ? '400' : '600', color: colors.textPrimary }}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>
            {item.created_at ? format(new Date(item.created_at), 'MMM d, h:mm a') : 'Recently'}
          </Text>
        </View>
        {!item.read && (
          <View
            style={{
              width: 10,
              height: 10,
              backgroundColor: primaryColor,
              borderRadius: 5,
              alignSelf: 'center',
            }}
          />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <FlatList
        data={notifications}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderNotification}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.borderDark} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textSecondary, marginTop: 16 }}>
              No notifications
            </Text>
            <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>
              You're all caught up! Check back later for updates.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
