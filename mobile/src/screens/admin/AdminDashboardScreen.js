import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

// Build-time fallback colors
const buildPrimaryColor = Constants.expoConfig?.extra?.primaryColor;
const buildSecondaryColor = Constants.expoConfig?.extra?.secondaryColor;

export default function AdminDashboardScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { user, isSuperAdmin } = useAuth();
  const { branding, isModuleEnabled } = useTenant();
  const [refreshing, setRefreshing] = React.useState(false);

  const primaryColor = branding?.primaryColor || buildPrimaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || buildSecondaryColor || colors.surfaceSecondary;

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.ADMIN_STATS);
      return response.data;
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchStats();
    setRefreshing(false);
  };

  const iconColor = primaryColor;

  // Super Admin specific items
  const superAdminItems = isSuperAdmin ? [
    { title: 'Tenant Management', icon: 'business', screen: 'TenantManagement', description: 'Manage colleges/institutions' },
  ] : [];

  // Standard admin items — always visible regardless of enabled student modules
  // Module-conditional items appended at the end based on tenant configuration
  const managementItems = [
    ...superAdminItems,
    { title: 'View as Student', icon: 'eye', screen: 'StudentView', description: 'See student experience' },
    { title: 'Messages', icon: 'chatbubbles', screen: 'AdminMessages', description: 'All conversations' },
    { title: 'News', icon: 'megaphone', screen: 'AdminAnnouncements', count: stats?.total_announcements },
    { title: 'Safety Disclosures', icon: 'shield', screen: 'AdminSafeDisclosures', description: 'Confidential incident reports' },
    { title: 'Relationship Disclosures', icon: 'heart', screen: 'RelationshipDisclosures', description: 'Governance tracking' },
    { title: 'GBV Training', icon: 'shield-checkmark', screen: 'GBVTraining', description: 'Staff training compliance' },
    { title: 'Academics', icon: 'school', screen: 'Academics', description: 'Study groups & resources' },
    { title: 'User Management', icon: 'people', screen: 'AdminUsers', count: stats?.total_users },
    { title: 'CSV Templates', icon: 'document-text', screen: 'AdminCsvTemplates', description: 'Download & upload templates' },
    // Module-conditional — only shown when that student module is enabled for this college:
    isModuleEnabled('dining') && { title: 'Dining Menu', icon: 'restaurant', screen: 'AdminDiningMenu', description: 'Manage daily menus' },
    isModuleEnabled('maintenance') && { title: 'Service Requests', icon: 'construct', screen: 'AdminServiceRequests', count: stats?.pending_requests },
    isModuleEnabled('events') && { title: 'Events', icon: 'calendar', screen: 'AdminEvents', count: stats?.total_events },
    isModuleEnabled('jobs') && { title: 'Job Postings', icon: 'briefcase', screen: 'AdminJobs', count: stats?.active_jobs },
    isModuleEnabled('recognition') && { title: 'Recognition', icon: 'star', screen: 'AdminRecognition', count: stats?.total_shoutouts },
    isModuleEnabled('cocurricular') && { title: 'Activities', icon: 'football', screen: 'AdminActivities', description: 'Clubs, sports & activities' },
  ].filter(Boolean);

  // Reports section items — unified icon color
  const reportsItems = [
    { title: 'Setup Statistics', icon: 'checkmark-done-circle', screen: 'AdminSetupStats', description: 'Account setup completion' },
    { title: 'Analytics', icon: 'stats-chart', screen: 'AnalyticsReports', description: 'Usage & Safety Reports' },
    { title: 'Student Reports', icon: 'search', screen: 'StudentReports', description: 'Search & Activity History' },
    { title: 'Insights', icon: 'bar-chart', screen: 'AdminReports', description: 'Data & Trends' },
    { title: 'Annual Report', icon: 'shield-checkmark', screen: 'AnnualDisclosureReport', description: 'Disclosure Reports' },
  ];

  // Stat cards — use theme status colors only where meaningful
  const statCards = [
    { label: 'Pending Requests', value: stats?.pending_requests || 0, icon: 'alert-circle', accent: colors.error, screen: 'AdminServiceRequests' },
    { label: 'Applications', value: stats?.pending_applications || 0, icon: 'document-text', accent: colors.warning, screen: 'AdminJobs' },
    { label: 'Total Users', value: stats?.total_users || 0, icon: 'people', accent: secondaryColor, screen: 'AdminUsers' },
    { label: 'Active Events', value: stats?.active_events || 0, icon: 'calendar', accent: primaryColor, screen: 'AdminEvents' },
  ];

  const [reportsExpanded, setReportsExpanded] = React.useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: '500' }}>Admin Dashboard</Text>
              <Text style={{ ...typography.h1, marginTop: 2 }}>
                {user?.first_name} {user?.last_name}
              </Text>
              <View
                style={{
                  backgroundColor: `${primaryColor}15`,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: borderRadius.full,
                  alignSelf: 'flex-start',
                  marginTop: spacing.sm,
                }}
              >
                <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '600' }}>
                  Admin
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={{
                width: 40,
                height: 40,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: borderRadius.full,
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              padding: spacing.lg,
              shadowColor: colors.textPrimary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {statCards.map((stat, index) => (
                <TouchableOpacity
                  key={`stat-${stat.label}-${index}`}
                  onPress={() => navigation.navigate(stat.screen)}
                  style={{
                    width: '48%',
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: borderRadius.md,
                    padding: spacing.lg,
                    marginBottom: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: `${stat.accent}15`,
                      borderRadius: borderRadius.md,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Ionicons name={stat.icon} size={18} color={stat.accent} />
                  </View>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary }}>
                    {stat.value}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{stat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Management Section */}
        <View style={{ padding: spacing.xl, paddingBottom: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: primaryColor, marginRight: spacing.sm }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Management
            </Text>
          </View>
          {managementItems.map((item, index) => (
            <TouchableOpacity
              key={`mgmt-${item.screen}-${index}`}
              onPress={() => navigation.navigate(item.screen)}
              data-testid={`management-${item.screen}`}
              style={{
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: colors.textPrimary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: borderRadius.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: spacing.lg,
                }}
              >
                <Ionicons name={item.icon} size={22} color={iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                  {item.title}
                </Text>
                {item.count !== undefined && (
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {item.count} total
                  </Text>
                )}
                {item.description && item.count === undefined && (
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Reports Section - Collapsible */}
        <View style={{ padding: spacing.xl, paddingTop: spacing.sm }}>
          <TouchableOpacity
            onPress={() => setReportsExpanded(!reportsExpanded)}
            data-testid="reports-section-toggle"
            style={{
              backgroundColor: colors.surfaceSecondary,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: colors.textPrimary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: secondaryColor + '20',
                  borderRadius: borderRadius.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: spacing.lg,
                }}
              >
                <Ionicons name="analytics" size={22} color={secondaryColor} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                  Reports
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  {reportsItems.length} reports available
                </Text>
              </View>
            </View>
            <Ionicons 
              name={reportsExpanded ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={colors.textTertiary} 
            />
          </TouchableOpacity>

          {reportsExpanded && (
            <View style={{ marginTop: 4 }}>
              {reportsItems.map((item, index) => (
                <TouchableOpacity
                  key={`report-${item.screen}-${index}`}
                  onPress={() => navigation.navigate(item.screen)}
                  data-testid={`report-${item.screen}`}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.lg,
                    padding: spacing.lg,
                    marginBottom: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginLeft: spacing.lg,
                    borderLeftWidth: 3,
                    borderLeftColor: primaryColor,
                    shadowColor: colors.textPrimary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: borderRadius.md,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: spacing.md,
                    }}
                  >
                    <Ionicons name={item.icon} size={20} color={iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                      {item.title}
                    </Text>
                    {item.description && (
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {item.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
