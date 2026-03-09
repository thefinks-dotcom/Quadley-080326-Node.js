import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { buildCategoryAccents } from '../../utils/colorUtils';
import TENANT_LOGOS from '../../utils/tenantLogos';

const buildTenantCode = Constants.expoConfig?.extra?.tenant || 'quadley';

const QuickAccessButton = ({ icon, label, onPress, accent }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{
      width: '23%',
      alignItems: 'center',
      marginBottom: 16,
    }}
  >
    <View style={{
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      shadowColor: accent?.icon || colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 4,
    }}>
      <Ionicons name={icon} size={27} color={accent?.icon || colors.primary} />
    </View>
    <Text style={{
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      paddingHorizontal: 2,
    }} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function StudentViewScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { user } = useAuth();
  const { tenant, branding } = useTenant();

  const { data: announcements, refetch: refetchAnnouncements } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.ANNOUNCEMENTS);
      return response.data.slice(0, 3);
    },
  });

  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.EVENTS);
      return response.data.slice(0, 3);
    },
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.DASHBOARD);
      return response.data;
    },
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAnnouncements(), refetchEvents()]);
    setRefreshing(false);
  };

  const formatEventDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = parseISO(dateStr);
      if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
      if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`;
      return format(date, 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.surfaceSecondary;

  const categoryAccents = useMemo(() => buildCategoryAccents(primaryColor), [primaryColor]);

  const moduleCategories = [
    {
      title: 'Campus Life',
      modules: [
        { icon: 'calendar-outline', label: 'Calendar', screen: 'Calendar' },
        { icon: 'ticket-outline', label: 'Events', screen: 'Events' },
        { icon: 'chatbubbles-outline', label: 'Messages', screen: 'Messages' },
        { icon: 'newspaper-outline', label: 'News', screen: 'Announcements' },
      ],
    },
    {
      title: 'Community',
      modules: [
        { icon: 'people-outline', label: 'My Floor', screen: 'Floor' },
        { icon: 'star-outline', label: 'Shoutouts', screen: 'Recognition' },
        { icon: 'gift-outline', label: 'Birthdays', screen: 'Birthdays' },
        { icon: 'flag-outline', label: 'Activities', screen: 'CoCurricular' },
      ],
    },
    {
      title: 'Services',
      modules: [
        { icon: 'construct-outline', label: 'Fixes', screen: 'Maintenance' },
        { icon: 'cube-outline', label: 'Parcels', screen: 'Parcels' },
        { icon: 'calendar-number-outline', label: 'Bookings', screen: 'Bookings' },
        { icon: 'restaurant-outline', label: 'Dining', screen: 'Dining' },
      ],
    },
    {
      title: 'Growth & Wellbeing',
      modules: [
        { icon: 'book-outline', label: 'Study', screen: 'Academics' },
        { icon: 'briefcase-outline', label: 'Jobs', screen: 'Jobs' },
        { icon: 'heart-outline', label: 'Wellbeing', screen: 'Wellbeing' },
        { icon: 'shield-checkmark-outline', label: 'Safety', screen: 'SafeDisclosure' },
      ],
    },
  ];

  const handleModulePress = (screen) => {
    try {
      navigation.navigate(screen);
    } catch {
      Alert.alert('Preview Mode', `The "${screen}" module would open here for students.`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Admin preview banner */}
        <View style={{
          backgroundColor: primaryColor + '15',
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: primaryColor + '15',
        }}>
          <Ionicons name="eye-outline" size={18} color={colors.warning} />
          <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600', marginLeft: 8, flex: 1 }}>
            Student View Preview
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            data-testid="back-to-admin-btn"
            style={{
              backgroundColor: primaryColor + '15',
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: primaryColor + '15',
            }}
          >
            <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600' }}>Exit Preview</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={TENANT_LOGOS[tenant?.code || buildTenantCode] || TENANT_LOGOS.quadley}
              style={{
                width: 36,
                height: 36,
                borderRadius: borderRadius.md,
              }}
              resizeMode="contain"
            />
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.textInverse,
              marginLeft: 10,
              textShadowColor: 'rgba(0,0,0,0.3)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}>
              {tenant?.name || 'College'}
            </Text>
          </View>
        </View>

        {/* Compact Stats */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, marginBottom: 4 }}>
          <TouchableOpacity
            onPress={() => handleModulePress('Announcements')}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: secondaryColor + '25', borderRadius: 14, padding: 14, marginHorizontal: 4,
              flexDirection: 'row', alignItems: 'center',
              shadowColor: colors.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
            }}>
            <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, backgroundColor: secondaryColor + '30', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
              <Ionicons name="newspaper" size={16} color={colors.textInverse} />
            </View>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textInverse }}>{announcements?.length || 0}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>News</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleModulePress('Messages')}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: secondaryColor + '25', borderRadius: 14, padding: 14, marginHorizontal: 4,
              flexDirection: 'row', alignItems: 'center',
              shadowColor: colors.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
            }}>
            <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, backgroundColor: secondaryColor + '30', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
              <Ionicons name="chatbubbles" size={16} color={colors.textInverse} />
            </View>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textInverse }}>{dashboard?.unread_messages_count || 0}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>Messages</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Module Categories */}
        {moduleCategories.map((category, catIndex) => {
          const accent = categoryAccents[category.title] || categoryAccents['Campus Life'];
          return (
            <View key={catIndex} style={{ paddingHorizontal: 16, paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 5, height: 18, borderRadius: 3, backgroundColor: accent.icon, marginRight: 8 }} />
                <Text style={{
                  fontSize: 15, fontWeight: '700', color: colors.textInverse, letterSpacing: 0.3,
                  textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
                }}>
                  {category.title}
                </Text>
              </View>
              <View style={{
                backgroundColor: accent.cardBg, borderRadius: 22,
                paddingHorizontal: 12, paddingTop: 18, paddingBottom: 6,
                borderWidth: 1.5, borderColor: accent.border,
                shadowColor: accent.icon, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
              }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {category.modules.map((item, index) => (
                    <QuickAccessButton
                      key={`${category.title}-${item.label}-${index}`}
                      icon={item.icon}
                      label={item.label}
                      accent={accent}
                      onPress={() => handleModulePress(item.screen)}
                    />
                  ))}
                </View>
              </View>
            </View>
          );
        })}

        {/* Announcements */}
        <View style={{ paddingHorizontal: 16, marginTop: 22, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 5, height: 18, borderRadius: 3, backgroundColor: primaryColor, marginRight: 8 }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.3 }}>
              Latest News
            </Text>
          </View>
          {announcements?.length > 0 ? announcements.map((announcement, idx) => (
            <View
              key={announcement.id || `a-${idx}`}
              style={{
                backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: 10,
                borderLeftWidth: 3,
                borderLeftColor: announcement.priority === 'high' ? colors.error : primaryColor,
                shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                {announcement.title}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }} numberOfLines={2}>
                {announcement.content}
              </Text>
            </View>
          )) : (
            <View style={{
              backgroundColor: colors.surface, padding: 32, borderRadius: borderRadius.lg, alignItems: 'center',
              shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
            }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: primaryColor + '15', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md }}>
                <Ionicons name="newspaper-outline" size={28} color={primaryColor} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>No announcements yet</Text>
            </View>
          )}
        </View>

        {/* Events */}
        <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 5, height: 18, borderRadius: 3, backgroundColor: colors.primary, marginRight: 8 }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.3 }}>
              Upcoming Events
            </Text>
          </View>
          {events?.length > 0 ? events.map((event, idx) => (
            <View
              key={event.id || `e-${idx}`}
              style={{
                backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: 10,
                flexDirection: 'row', alignItems: 'center',
                shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
              }}
            >
              <View style={{
                width: 50, height: 50, backgroundColor: `${primaryColor}15`,
                borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14,
              }}>
                <Ionicons name="calendar" size={24} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                  {event.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                    {formatEventDate(event.date || event.start_time)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.borderDark} />
            </View>
          )) : (
            <View style={{
              backgroundColor: colors.surface, padding: 32, borderRadius: borderRadius.lg, alignItems: 'center',
              shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
            }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md }}>
                <Ionicons name="calendar-outline" size={28} color={primaryColor} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>No upcoming events</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
