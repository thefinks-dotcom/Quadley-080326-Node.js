import React, { useState } from 'react';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { formatDateLong, DATE_FORMATS } from '../../utils/dateUtils';
import { useTenant } from '../../contexts/TenantContext';

export default function EventDetailScreen({ route, navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { event } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current RSVP status
  const { data: rsvpStatus } = useQuery({
    queryKey: ['eventRsvp', event.id],
    queryFn: async () => {
      try {
        const response = await api.get(`${ENDPOINTS.EVENTS}/${event.id}/my-rsvp`);
        return response.data;
      } catch (error) {
        return { response: null };
      }
    },
  });

  const currentStatus = rsvpStatus?.response || null;

  const rsvpMutation = useMutation({
    mutationFn: async (status) => {
      const response = await api.post(`${ENDPOINTS.EVENTS}/${event.id}/rsvp`, { response: status });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['events']);
      queryClient.invalidateQueries(['eventRsvp', event.id]);
      queryClient.invalidateQueries(['calendar']);
      const statusMsg = variables === 'attending' ? 'You are attending this event!' : 'You have declined this event.';
      Alert.alert('RSVP Updated', statusMsg);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.detail || 'Failed to update RSVP';
      if (errorMsg.toLowerCase().includes('not authenticated') || error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again to RSVP.');
      } else {
        Alert.alert('Error', errorMsg);
      }
    },
  });

  const eventDate = new Date(event.date);
  const isFull = event.max_attendees && event.attendees?.length >= event.max_attendees;
  const isAttending = currentStatus === 'attending';
  const isNotAttending = currentStatus === 'not_attending';
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <ScrollView>
        {/* Hero Section */}
        <View
          style={{
            backgroundColor: primaryColor,
            padding: spacing.xxl,
            paddingTop: 16,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: borderRadius.md,
              alignSelf: 'flex-start',
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.textInverse, fontWeight: '500', textTransform: 'capitalize' }}>
              {event.category}
            </Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textInverse }}>
            {event.title}
          </Text>
          
          {/* RSVP Status Badge */}
          {currentStatus && (
            <View
              style={{
                backgroundColor: isAttending ? primaryColor : colors.border,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: borderRadius.md,
                alignSelf: 'flex-start',
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons 
                name={isAttending ? 'checkmark-circle' : 'close-circle'} 
                size={16} 
                color={colors.textInverse} 
              />
              <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 4 }}>
                {isAttending ? 'Attending' : 'Not Attending'}
              </Text>
            </View>
          )}
        </View>

        {/* Event Details */}
        <View style={{ padding: 20 }}>
          {/* Date & Time Card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: 16,
              ...shadows.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: primaryColor + '15',
                  borderRadius: borderRadius.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="calendar" size={22} color={primaryColor} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                  {formatDateLong(eventDate)}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
                  {format(eventDate, 'h:mm a')}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: primaryColor + '15',
                  borderRadius: borderRadius.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="location" size={22} color={primaryColor} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                  {event.location}
                </Text>
              </View>
            </View>
          </View>

          {/* Attendees */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="people" size={22} color={primaryColor} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>
                  Attendees
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                {event.attendees?.length || 0}
                {event.max_attendees ? ` / ${event.max_attendees}` : ''}
              </Text>
            </View>
            {isFull && !isAttending && (
              <View
                style={{
                  backgroundColor: colors.errorLight,
                  padding: 8,
                  borderRadius: borderRadius.sm,
                  marginTop: 12,
                }}
              >
                <Text style={{ color: colors.error, textAlign: 'center' }}>
                  This event is at full capacity
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {event.description ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  About this event
                </Text>
              </View>
              <Text
                style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}
                numberOfLines={descriptionExpanded ? undefined : 3}
              >
                {event.description}
              </Text>
              <TouchableOpacity
                onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                style={{ marginTop: spacing.sm }}
              >
                <Text style={{ fontSize: 13, color: primaryColor, fontWeight: '600' }}>
                  {descriptionExpanded ? 'Show less' : '...more'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* RSVP Buttons */}
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
            RSVP
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Attending Button */}
            <TouchableOpacity
              onPress={() => rsvpMutation.mutate('attending')}
              disabled={rsvpMutation.isPending || (isFull && !isAttending)}
              style={{
                flex: 1,
                backgroundColor: isAttending ? primaryColor : primaryColor + '15',
                paddingVertical: 16,
                borderRadius: borderRadius.md,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: primaryColor,
                opacity: rsvpMutation.isPending || (isFull && !isAttending) ? 0.6 : 1,
              }}
            >
              {rsvpMutation.isPending ? (
                <ActivityIndicator color={isAttending ? colors.textInverse : primaryColor} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons 
                    name={isAttending ? 'checkmark-circle' : 'checkmark-circle-outline'} 
                    size={20} 
                    color={isAttending ? colors.textInverse : primaryColor} 
                  />
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: '600', 
                    color: isAttending ? colors.textInverse : primaryColor,
                    marginLeft: 8,
                  }}>
                    Attending
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Not Attending Button */}
            <TouchableOpacity
              onPress={() => rsvpMutation.mutate('not_attending')}
              disabled={rsvpMutation.isPending}
              style={{
                flex: 1,
                backgroundColor: isNotAttending ? colors.error : colors.errorLight,
                paddingVertical: 16,
                borderRadius: borderRadius.md,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: colors.error,
                opacity: rsvpMutation.isPending ? 0.6 : 1,
              }}
            >
              {rsvpMutation.isPending ? (
                <ActivityIndicator color={isNotAttending ? colors.textInverse : colors.error} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons 
                    name={isNotAttending ? 'close-circle' : 'close-circle-outline'} 
                    size={20} 
                    color={isNotAttending ? colors.textInverse : colors.error} 
                  />
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: '600', 
                    color: isNotAttending ? colors.textInverse : colors.error,
                    marginLeft: 8,
                  }}>
                    Not Attending
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          {isAttending && (
            <View style={{ 
              backgroundColor: primaryColor + '15', 
              padding: 12, 
              borderRadius: borderRadius.md, 
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Ionicons name="calendar-outline" size={18} color={primaryColor} />
              <Text style={{ color: primaryColor, marginLeft: 8, flex: 1 }}>
                This event will appear in your calendar
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
