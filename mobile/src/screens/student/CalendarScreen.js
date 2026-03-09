import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from 'date-fns';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';

export default function CalendarScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: events, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.EVENTS, {
        params: { include_past: true, limit: 100 },
      });
      return response.data;
    },
  });

  // Get days for the calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get events for a specific date
  // Compare date strings directly (YYYY-MM-DD) to avoid timezone drift
  const getEventsForDate = (date) => {
    if (!events) return [];
    const targetStr = format(date, 'yyyy-MM-dd');
    return events.filter((event) => {
      if (!event.date) return false;
      const eventStr = event.date.slice(0, 10);
      return eventStr === targetStr;
    });
  };

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    return getEventsForDate(selectedDate);
  }, [selectedDate, events]);

  // Check if date has events
  const hasEvents = (date) => {
    return getEventsForDate(date).length > 0;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const getCategoryColor = () => primaryColor;

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xl,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={goToPreviousMonth} style={{ padding: 8 }}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>
                {format(currentMonth, 'MMMM yyyy')}
              </Text>
              <TouchableOpacity onPress={goToToday}>
                <Text style={{ fontSize: 14, color: primaryColor, marginTop: 4, fontWeight: '500' }}>
                  Today
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={goToNextMonth} style={{ padding: 8 }}>
              <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendar Grid */}
        <View style={{ backgroundColor: colors.surface, paddingVertical: 16 }}>
          {/* Week day headers */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 8, marginBottom: 8 }}>
            {weekDays.map((day) => (
              <View key={day} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textTertiary }}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar days */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 }}>
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedDate(day)}
                  style={{
                    width: '14.28%',
                    aspectRatio: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 2,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: isSelected
                        ? primaryColor
                        : isTodayDate
                        ? colors.primaryLight
                        : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: isSelected || isTodayDate ? '600' : '400',
                        color: isSelected
                          ? colors.textInverse
                          : !isCurrentMonth
                          ? colors.borderLight
                          : isTodayDate
                          ? primaryColor
                          : colors.textPrimary,
                      }}
                    >
                      {format(day, 'd')}
                    </Text>
                  </View>
                  {/* Event indicators */}
                  {dayEvents.length > 0 && (
                    <View style={{ flexDirection: 'row', marginTop: 2 }}>
                      {dayEvents.slice(0, 3).map((event, i) => (
                        <View
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: primaryColor,
                            marginHorizontal: 1,
                          }}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected Date Events */}
        <View style={{ padding: spacing.lg }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
            {isSameDay(selectedDate, new Date())
              ? "Today's Events"
              : format(selectedDate, 'EEEE, MMMM d')}
          </Text>

          {selectedDateEvents.length > 0 ? (
            selectedDateEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => navigation.navigate('EventDetail', { event })}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  borderLeftWidth: 4,
                  borderLeftColor: getCategoryColor(event.category),
                  ...shadows.sm,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                      {event.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                      <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 6 }}>
                        {event.date ? format(parseISO(event.date), 'h:mm a') : 'TBD'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                      <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 6 }}>
                        {event.location}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      backgroundColor: `${getCategoryColor(event.category)}20`,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: borderRadius.sm,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: getCategoryColor(event.category),
                        textTransform: 'capitalize',
                      }}
                    >
                      {event.category}
                    </Text>
                  </View>
                </View>
                {event.description && (
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }} numberOfLines={2}>
                    {event.description}
                  </Text>
                )}
                {event.rsvp_deadline && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: 8,
                      backgroundColor: primaryColor + '15',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Ionicons name="alarm" size={14} color={primaryColor} />
                    <Text style={{ fontSize: 12, color: primaryColor, marginLeft: 4 }}>
                      RSVP by {format(parseISO(event.rsvp_deadline), 'MMM d')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: 32,
                alignItems: 'center',
              }}
            >
              <Ionicons name="calendar-outline" size={48} color={colors.borderDark} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
                No events on this day
              </Text>
              <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 4 }}>
                Select another date to view events
              </Text>
            </View>
          )}
        </View>

        {/* Upcoming Events Section */}
        <View style={{ padding: spacing.lg, paddingTop: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
            All Upcoming Events
          </Text>
          {events && events.length > 0 ? (
            events
              .filter((event) => {
                if (!event.date) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return new Date(event.date) >= today;
              })
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .slice(0, 5)
              .map((event) => (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => {
                    setSelectedDate(parseISO(event.date));
                    navigation.navigate('EventDetail', { event });
                  }}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.md,
                    padding: 12,
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      backgroundColor: primaryColor + '15',
                      borderRadius: borderRadius.md,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: primaryColor }}>
                      {format(parseISO(event.date), 'd')}
                    </Text>
                    <Text style={{ fontSize: 10, color: primaryColor }}>
                      {format(parseISO(event.date), 'MMM')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                      {event.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                      {event.location} • {format(parseISO(event.date), 'h:mm a')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))
          ) : (
            <View style={{ backgroundColor: colors.surface, padding: 20, borderRadius: borderRadius.md, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>No upcoming events</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
