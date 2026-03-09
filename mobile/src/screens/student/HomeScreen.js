import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BUILD_CONFIG from '../../config/tenantBuild.generated';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { colors as defaultColors, shadows, borderRadius, spacing, typography } from '../../theme';
import TENANT_LOGOS from '../../utils/tenantLogos';
import { useAppTheme } from '../../contexts/ThemeContext';

// Build-time fallback colors
const buildPrimaryColor = BUILD_CONFIG.primaryColor || defaultColors.primary;
const buildSecondaryColor = BUILD_CONFIG.secondaryColor || defaultColors.background;
const buildTenantCode = BUILD_CONFIG.tenant;
// For white-label builds the app icon is baked in at build time and should always be shown.
// Only the generic Quadley build supports overriding the logo via a DB-stored URL.
const BUILD_IS_WHITE_LABEL = buildTenantCode !== 'quadley';
const buildStaticLogo = TENANT_LOGOS[buildTenantCode] || TENANT_LOGOS.quadley;

// Swiss Technical Quick Access Button
const QuickAccessButton = ({ icon, label, onPress, badge, primaryColor, secondaryColor, colors }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{
      width: '25%',
      alignItems: 'center',
      marginBottom: spacing.lg,
      position: 'relative',
    }}
    testID={`quick-access-${label.toLowerCase().replace(/\s/g, '-')}`}
  >
    <View style={{
      width: 58,
      height: 58,
      borderRadius: borderRadius.md,
      backgroundColor: secondaryColor + '12',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: secondaryColor + '25',
      ...shadows.sm,
    }}>
      <Ionicons name={icon} size={26} color={primaryColor} />
    </View>
    <Text style={{
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      letterSpacing: 0.2,
    }} numberOfLines={1}>
      {label}
    </Text>
    {badge > 0 && (
      <View style={{
        position: 'absolute',
        top: -4,
        right: 8,
        backgroundColor: colors.error,
        borderRadius: borderRadius.full,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.surface,
      }}>
        <Text style={{ color: colors.textInverse, fontSize: 10, fontWeight: 'bold' }}>{badge}</Text>
      </View>
    )}
  </TouchableOpacity>
);

// Section Header Component
const SectionHeader = ({ title, onViewAll, accentColor, secondaryAccent, colors }) => (
  <View style={{ 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{
        width: 4,
        height: 16,
        borderRadius: 2,
        backgroundColor: accentColor,
        marginRight: spacing.sm,
      }} />
      <Text style={{
        ...typography.label,
        letterSpacing: 0.3,
      }}>
        {title}
      </Text>
    </View>
    {onViewAll && (
      <TouchableOpacity
        onPress={onViewAll}
        style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.xs }}
      >
        <Text style={{ color: accentColor, fontWeight: '600', fontSize: 13 }}>View All</Text>
        <Ionicons name="chevron-forward" size={14} color={accentColor} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
    )}
  </View>
);

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { isModuleEnabled, tenant, branding } = useTenant();
  const { themeColors: colors } = useAppTheme();

  const { data: announcements, refetch: refetchAnnouncements } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.ANNOUNCEMENTS);
      return response.data.slice(0, 3);
    },
    enabled: isModuleEnabled('announcements'),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.EVENTS);
      return response.data.slice(0, 3);
    },
    enabled: isModuleEnabled('events'),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      try {
        const response = await api.get(ENDPOINTS.DASHBOARD);
        return response.data;
      } catch (e) {
        return null;
      }
    },
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAnnouncements(), refetchEvents()]);
    setRefreshing(false);
  };

  const isRA = user?.role === 'ra';

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

  const screenToModule = {
    'Calendar': 'events', 'Events': 'events', 'Messages': 'messages',
    'Announcements': 'announcements', 'Dining': 'dining', 'Floor': 'floor',
    'Recognition': 'recognition', 'Birthdays': 'birthdays', 'CoCurricular': 'cocurricular',
    'Maintenance': 'maintenance', 'Parcels': 'parcels', 'Bookings': 'bookings',
    'Academics': 'academics', 'Jobs': 'jobs',
    'Wellbeing': 'wellbeing', 'SafeDisclosure': 'safe_disclosure',
  };

  const primaryColor = branding?.primaryColor || buildPrimaryColor;
  const secondaryColor = branding?.secondaryColor || buildSecondaryColor;

  const moduleCategories = [
    {
      title: 'Campus Life',
      modules: [
        { icon: 'calendar-outline', label: 'Calendar', screen: 'Calendar', module: 'events' },
        { icon: 'ticket-outline', label: 'Events', screen: 'Events', module: 'events' },
        { icon: 'restaurant-outline', label: 'Dining', screen: 'Dining', module: 'dining' },
      ],
    },
    {
      title: 'Community',
      modules: [
        { icon: 'people-outline', label: 'My Floor', screen: 'Floor', module: 'floor' },
        { icon: 'star-outline', label: 'Shoutouts', screen: 'Recognition', module: 'recognition' },
        { icon: 'gift-outline', label: 'Birthdays', screen: 'Birthdays', module: 'birthdays' },
        { icon: 'flag-outline', label: 'Activities', screen: 'CoCurricular', module: 'cocurricular' },
      ],
    },
    {
      title: 'Services',
      modules: [
        { icon: 'construct-outline', label: 'Fixes', screen: 'Maintenance', module: 'maintenance' },
        { icon: 'cube-outline', label: 'Parcels', screen: 'Parcels', module: 'parcels' },
        { icon: 'calendar-number-outline', label: 'Bookings', screen: 'Bookings', module: 'bookings' },
      ],
    },
    {
      title: 'Growth & Wellbeing',
      modules: [
        { icon: 'book-outline', label: 'Study', screen: 'Academics', module: 'academics' },
        { icon: 'briefcase-outline', label: 'Jobs', screen: 'Jobs', module: 'jobs' },
        { icon: 'heart-outline', label: 'Wellbeing', screen: 'Wellbeing', module: 'wellbeing' },
        { icon: 'shield-checkmark-outline', label: 'Safety', screen: 'SafeDisclosure', module: 'safe_disclosure' },
      ],
    },
    ...(isRA ? [{
      title: 'RA Tools',
      modules: [
        { icon: 'document-text-outline', label: 'Incidents', screen: 'RAIncidentReporting' },
        { icon: 'people-circle-outline', label: 'Floor Mgmt', screen: 'RAFloorManagement' },
        { icon: 'calendar-outline', label: 'Floor Events', screen: 'RAFloorEvents' },
      ],
    }] : []),
  ];

  const filteredCategories = moduleCategories.map(category => ({
    ...category,
    modules: category.modules.filter(mod =>
      !mod.module || isModuleEnabled(mod.module)
    )
  })).filter(category => category.modules.length > 0);

  const unreadCount = dashboard?.unread_notifications || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="home-screen">
      <AnimatedScreen>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Swiss Technical Style */}
        <View style={{
          backgroundColor: primaryColor,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          borderBottomLeftRadius: borderRadius.xxl,
          borderBottomRightRadius: borderRadius.xxl,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                padding: spacing.xs,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: borderRadius.md,
              }}>
                <Image
                  source={
                    BUILD_IS_WHITE_LABEL
                      ? buildStaticLogo
                      : (branding?.logoUrl ? { uri: branding.logoUrl } : (TENANT_LOGOS[tenant?.code] || buildStaticLogo))
                  }
                  style={{ width: 36, height: 36, borderRadius: borderRadius.sm }}
                  resizeMode="contain"
                />
              </View>
              <View style={{ marginLeft: spacing.md }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.6)',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>
                  Welcome back
                </Text>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.textInverse,
                  letterSpacing: -0.3,
                }}>
                  {user?.first_name || 'Student'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Notifications')}
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.md,
                backgroundColor: 'rgba(255,255,255,0.1)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textInverse} />
              {unreadCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: primaryColor,
                }} />
              )}
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Announcements')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: secondaryColor + '25',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.6)',
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: borderRadius.sm,
                backgroundColor: secondaryColor + '30',
                justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
              }}>
                <Ionicons name="newspaper" size={18} color={colors.textInverse} />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textInverse }}>{announcements?.length || 0}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>News</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Messages')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: secondaryColor + '25',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.6)',
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: borderRadius.sm,
                backgroundColor: secondaryColor + '30',
                justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
              }}>
                <Ionicons name="chatbubbles" size={18} color={colors.textInverse} />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textInverse }}>{dashboard?.unread_messages_count || 0}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>Messages</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Module Categories */}
        <View style={{ backgroundColor: secondaryColor + '0A', paddingBottom: spacing.lg, marginTop: spacing.sm }}>
        {filteredCategories.map((category, catIndex) => {
          const isAlternate = catIndex % 2 === 1;
          const sectionAccent = isAlternate ? secondaryColor : primaryColor;
          return (
          <View key={`cat-${catIndex}`} style={{ marginTop: spacing.xl }}>
            <Text style={{
              ...typography.caption,
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.md,
              color: isAlternate ? secondaryColor : colors.textTertiary,
            }}>
              {category.title}
            </Text>
            <View style={{
              marginHorizontal: spacing.lg,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              paddingHorizontal: spacing.sm,
              paddingTop: spacing.md,
              borderWidth: 1,
              borderColor: isAlternate ? secondaryColor + '30' : colors.border,
              borderTopWidth: 2,
              borderTopColor: sectionAccent + '50',
            }}>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-evenly',
              }}>
                {category.modules.map((item, index) => (
                  <QuickAccessButton
                    key={`${category.title}-${item.label}-${index}`}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    colors={colors}
                    onPress={() => navigation.navigate(item.screen, item.params)}
                  />
                ))}
              </View>
            </View>
          </View>
          );
        })}
        </View>

        {/* Recent Announcements */}
        {isModuleEnabled('announcements') && (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionHeader 
              title="Latest News" 
              accentColor={primaryColor}
              secondaryAccent={secondaryColor}
              colors={colors}
              onViewAll={() => navigation.navigate('Announcements')} 
            />
            <View style={{ paddingHorizontal: spacing.lg }}>
              {announcements?.length > 0 ? announcements.map((announcement, idx) => (
                <TouchableOpacity
                  key={announcement.id || `announcement-${idx}`}
                  onPress={() => navigation.navigate('Announcements')}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: colors.surface,
                    padding: spacing.lg,
                    borderRadius: borderRadius.md,
                    marginBottom: spacing.sm,
                    borderLeftWidth: 3,
                    borderLeftColor: announcement.is_emergency || announcement.priority === 'high' ? colors.error : primaryColor,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  testID={`announcement-${idx}`}
                >
                  {(announcement.is_emergency || announcement.priority === 'high') && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: spacing.xs,
                      backgroundColor: colors.errorLight,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3,
                      borderRadius: borderRadius.sm,
                      alignSelf: 'flex-start',
                    }}>
                      <Ionicons name="alert-circle" size={12} color={colors.error} />
                      <Text style={{ color: colors.error, fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                        Important
                      </Text>
                    </View>
                  )}
                  <Text style={{ ...typography.label }} numberOfLines={1}>
                    {announcement.title}
                  </Text>
                  <Text style={{ ...typography.bodySmall, marginTop: spacing.xs }} numberOfLines={2}>
                    {announcement.content}
                  </Text>
                </TouchableOpacity>
              )) : (
                <View style={{
                  backgroundColor: colors.surface,
                  padding: spacing.xxxl,
                  borderRadius: borderRadius.lg,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <View style={{ 
                    width: 56, 
                    height: 56, 
                    borderRadius: borderRadius.md, 
                    backgroundColor: colors.surfaceSecondary, 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    marginBottom: spacing.md 
                  }}>
                    <Ionicons name="newspaper-outline" size={28} color={primaryColor} />
                  </View>
                  <Text style={{ ...typography.bodyMedium }}>No announcements yet</Text>
                  <Text style={{ ...typography.bodySmall, marginTop: spacing.xs }}>Check back soon for updates</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Upcoming Events */}
        {isModuleEnabled('events') && (
          <View style={{ marginTop: spacing.xl, marginBottom: 100 }}>
            <SectionHeader 
              title="Upcoming Events" 
              accentColor={secondaryColor}
              secondaryAccent={secondaryColor}
              colors={colors}
              onViewAll={() => navigation.navigate('Events')} 
            />
            <View style={{ paddingHorizontal: spacing.lg }}>
              {events?.length > 0 ? events.map((event, idx) => (
                <TouchableOpacity
                  key={event.id || `event-${idx}`}
                  onPress={() => navigation.navigate('EventDetail', { event })}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: colors.surface,
                    padding: spacing.lg,
                    borderRadius: borderRadius.md,
                    marginBottom: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  testID={`event-${idx}`}
                >
                  <View style={{
                    width: 48,
                    height: 48,
                    backgroundColor: secondaryColor + '20',
                    borderRadius: borderRadius.md,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: spacing.md,
                  }}>
                    <Ionicons name="calendar" size={22} color={secondaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.label }} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                        {formatEventDate(event.date || event.start_time)}
                      </Text>
                    </View>
                    {event.location && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }} numberOfLines={1}>
                          {event.location}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.border} />
                </TouchableOpacity>
              )) : (
                <View style={{
                  backgroundColor: colors.surface,
                  padding: spacing.xxxl,
                  borderRadius: borderRadius.lg,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <View style={{ 
                    width: 56, 
                    height: 56, 
                    borderRadius: borderRadius.md, 
                    backgroundColor: secondaryColor + '15', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    marginBottom: spacing.md 
                  }}>
                    <Ionicons name="calendar-outline" size={28} color={secondaryColor} />
                  </View>
                  <Text style={{ ...typography.bodyMedium }}>No upcoming events</Text>
                  <Text style={{ ...typography.bodySmall, marginTop: spacing.xs }}>Events will show up here</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      </AnimatedScreen>
    </SafeAreaView>
  );
}
