import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';

import { colors, borderRadius, spacing, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import ModuleHeader from '../../components/ModuleHeader';

export default function EventsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const { user } = useAuth();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: events, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.EVENTS, { params: { include_past: true, limit: 100 } });
      return response.data;
    },
  });

  const categories = ['all', 'social', 'academic', 'sports', 'cultural', 'other'];

  const now = new Date();

  const filteredEvents = (events || [])
    .filter((event) => selectedCategory === 'all' || event.category === selectedCategory)
    .sort((a, b) => {
      const aDate = new Date(a.date);
      const bDate = new Date(b.date);
      const aUpcoming = aDate >= now;
      const bUpcoming = bDate >= now;
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;
      if (aUpcoming && bUpcoming) return aDate - bDate;
      return bDate - aDate;
    });

  const renderEvent = ({ item }) => {
    const eventDate = new Date(item.date);
    const isAttending = item.attendees?.includes(user?.id);
    const isPast = eventDate < now;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('EventDetail', { event: item })}
        style={{
          backgroundColor: colors.surface,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          ...shadows.sm,
          borderWidth: isAttending ? 2 : 1,
          borderColor: isAttending ? primaryColor : colors.border,
          opacity: isPast ? 0.7 : 1,
        }}
      >
        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{
              width: 50,
              backgroundColor: isPast ? colors.surfaceSecondary : primaryColor + '15',
              borderRadius: borderRadius.sm,
              padding: 8,
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isPast ? colors.textTertiary : primaryColor }}>
                {format(eventDate, 'd')}
              </Text>
              <Text style={{ fontSize: 12, color: isPast ? colors.textTertiary : primaryColor, fontWeight: '500' }}>
                {format(eventDate, 'MMM')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 }}>
                  {item.title}
                </Text>
                {isAttending && (
                  <View style={{
                    backgroundColor: primaryColor,
                    paddingHorizontal: 8, paddingVertical: 3,
                    borderRadius: borderRadius.full,
                    flexDirection: 'row', alignItems: 'center',
                  }}>
                    <Ionicons name="checkmark-circle" size={12} color="#fff" />
                    <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600', marginLeft: 3 }}>Going</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 4 }}>
                  {item.location}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 4 }}>
                  {format(eventDate, 'h:mm a')}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'space-between' }}>
            <View style={{
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: 10, paddingVertical: 4,
              borderRadius: borderRadius.full,
              maxWidth: 120,
            }}>
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>
                {isPast ? 'Past · ' : ''}{item.category}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people-outline" size={16} color={colors.textTertiary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 4 }}>
                {item.attendees?.length || 0}{item.max_attendees ? `/${item.max_attendees}` : ''}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <ModuleHeader title="Events" onBack={() => navigation.goBack()} />
      {/* Category Filter */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 }}
        style={{ flexGrow: 0 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedCategory(item)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: borderRadius.full,
              backgroundColor: selectedCategory === item ? primaryColor : colors.surface,
              marginRight: 6,
              borderWidth: 1,
              borderColor: selectedCategory === item ? primaryColor : colors.border,
            }}
          >
            <Text numberOfLines={1} style={{
              color: selectedCategory === item ? colors.textInverse : colors.textSecondary,
              fontWeight: '500',
              textTransform: 'capitalize',
              fontSize: 12,
            }}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Events List */}
      <FlatList
        data={filteredEvents}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderEvent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
              No events found
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}
