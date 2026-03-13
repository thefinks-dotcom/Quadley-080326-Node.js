import React, { useMemo, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const buildPrimaryColor = BUILD_CONFIG.primaryColor || defaultColors.primary;
const buildSecondaryColor = BUILD_CONFIG.secondaryColor || defaultColors.background;
const buildTenantCode = BUILD_CONFIG.tenant;
const BUILD_IS_WHITE_LABEL = buildTenantCode !== 'quadley';
const buildStaticLogo = TENANT_LOGOS[buildTenantCode] || TENANT_LOGOS.quadley;

const LauncherTile = ({ icon, label, onPress, badge, primaryColor, colors }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{
      width: '25%',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: 4,
    }}
    testID={`quick-access-${label.toLowerCase().replace(/\s/g, '-')}`}
  >
    <View style={{ position: 'relative' }}>
      <View style={{
        width: 62,
        height: 62,
        borderRadius: 16,
        backgroundColor: primaryColor,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
      }}>
        <Ionicons name={icon} size={28} color="#fff" />
      </View>
      {badge > 0 && (
        <View style={{
          position: 'absolute',
          top: -4,
          right: -4,
          backgroundColor: colors.error,
          borderRadius: borderRadius.full,
          minWidth: 20,
          height: 20,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: colors.background,
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </View>
    <Text style={{
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '500',
      textAlign: 'center',
      marginTop: 6,
      letterSpacing: 0.1,
    }} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { isModuleEnabled, tenant, branding } = useTenant();
  const { themeColors: colors } = useAppTheme();

  const { data: announcements, refetch: refetchAnnouncements } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.ANNOUNCEMENTS);
      return response.data;
    },
    enabled: isModuleEnabled('announcements'),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const [readIds, setReadIds] = useState({});

  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;
      AsyncStorage.getItem(`read_announcements_${user.id}`)
        .then(stored => { if (stored) setReadIds(JSON.parse(stored)); })
        .catch(() => {});
    }, [user?.id])
  );

  const unreadNewsCount = useMemo(
    () => (announcements || []).filter(a => !readIds[a.id]).length,
    [announcements, readIds]
  );

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
    await refetchAnnouncements();
    setRefreshing(false);
  };

  const isRA = user?.role === 'ra';

  const primaryColor = branding?.primaryColor || buildPrimaryColor;
  const secondaryColor = branding?.secondaryColor || buildSecondaryColor;

  const unreadCount = dashboard?.unread_notifications || 0;

  const allModules = [
    { icon: 'newspaper-outline', label: 'News', screen: 'Announcements', module: 'announcements', badge: unreadNewsCount },
    { icon: 'chatbubbles-outline', label: 'Messages', screen: 'Messages', module: 'messages', badge: dashboard?.unread_messages_count || 0 },
    { icon: 'calendar-outline', label: 'Events', screen: 'Events', module: 'events' },
    { icon: 'restaurant-outline', label: 'Dining', screen: 'Dining', module: 'dining' },
    { icon: 'people-outline', label: 'My Floor', screen: 'Floor', module: 'floor' },
    { icon: 'star-outline', label: 'Shoutouts', screen: 'Recognition', module: 'recognition' },
    { icon: 'gift-outline', label: 'Birthdays', screen: 'Birthdays', module: 'birthdays' },
    { icon: 'flag-outline', label: 'Activities', screen: 'CoCurricular', module: 'cocurricular' },
    { icon: 'construct-outline', label: 'Fixes', screen: 'Maintenance', module: 'maintenance' },
    { icon: 'cube-outline', label: 'Parcels', screen: 'Parcels', module: 'parcels' },
    { icon: 'calendar-number-outline', label: 'Bookings', screen: 'Bookings', module: 'bookings' },
    { icon: 'book-outline', label: 'Study', screen: 'Academics', module: 'academics' },
    { icon: 'briefcase-outline', label: 'Jobs', screen: 'Jobs', module: 'jobs' },
    { icon: 'heart-outline', label: 'Wellbeing', screen: 'Wellbeing', module: 'wellbeing' },
    { icon: 'shield-checkmark-outline', label: 'Safety', screen: 'SafeDisclosure', module: 'safe_disclosure' },
  ].filter(mod => isModuleEnabled(mod.module));

  const raTools = [
    { icon: 'document-text-outline', label: 'Incidents', screen: 'RAIncidentReporting' },
    { icon: 'people-circle-outline', label: 'Floor Mgmt', screen: 'RAFloorManagement' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="home-screen">
      <AnimatedScreen>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
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
                  backgroundColor: colors.error,
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
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textInverse }}>{unreadNewsCount}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>{unreadNewsCount === 1 ? 'Unread' : 'Unread News'}</Text>
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

        {/* Flat Launcher Grid */}
        <View style={{
          marginHorizontal: spacing.lg,
          marginTop: spacing.xl,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
        }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {allModules.map((item, index) => (
              <LauncherTile
                key={`module-${item.label}-${index}`}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                primaryColor={primaryColor}
                colors={colors}
                onPress={() => navigation.navigate(item.screen, item.params)}
              />
            ))}
          </View>
        </View>

        {/* RA Tools — only visible for RA users */}
        {isRA && (
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Text style={{
              fontSize: 11,
              fontWeight: '700',
              color: colors.textTertiary,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: spacing.sm,
              paddingHorizontal: spacing.xs,
            }}>
              RA Tools
            </Text>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              borderWidth: 1,
              borderColor: secondaryColor + '40',
              borderTopWidth: 2,
              borderTopColor: secondaryColor,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.sm,
            }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {raTools.map((item, index) => (
                  <LauncherTile
                    key={`ra-${item.label}-${index}`}
                    icon={item.icon}
                    label={item.label}
                    primaryColor={secondaryColor || primaryColor}
                    colors={colors}
                    onPress={() => navigation.navigate(item.screen)}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Recent Announcements */}
        {isModuleEnabled('announcements') && (
          <View style={{ marginTop: spacing.xxl, marginBottom: 100 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.md,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 4, height: 16, borderRadius: 2,
                  backgroundColor: primaryColor, marginRight: spacing.sm,
                }} />
                <Text style={{ ...typography.label, letterSpacing: 0.3 }}>Latest News</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('Announcements')}
                style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.xs }}
              >
                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 13 }}>View All</Text>
                <Ionicons name="chevron-forward" size={14} color={primaryColor} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: spacing.lg }}>
              {announcements?.length > 0 ? announcements.slice(0, 3).map((announcement, idx) => (
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
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!readIds[announcement.id] && (
                      <View style={{
                        width: 7, height: 7, borderRadius: 3.5,
                        backgroundColor: primaryColor, marginRight: 6, flexShrink: 0,
                      }} />
                    )}
                    <Text style={{ ...typography.label, flex: 1, fontWeight: readIds[announcement.id] ? '500' : '700' }} numberOfLines={1}>
                      {announcement.title}
                    </Text>
                  </View>
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
                    width: 56, height: 56, borderRadius: borderRadius.md,
                    backgroundColor: colors.surfaceSecondary,
                    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
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

      </ScrollView>
      </AnimatedScreen>
    </SafeAreaView>
  );
}
