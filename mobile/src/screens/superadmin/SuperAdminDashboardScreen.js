import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import AddTenantModal from '../../components/AddTenantModal';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

// Move components outside of main component
const StatCard = ({ icon, label, value, subvalue, color, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    style={{
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
      <View style={{ 
        width: 36, 
        height: 36, 
        borderRadius: borderRadius.md, 
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Ionicons name={icon} size={20} color={color || colors.moduleIcon} />
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
      )}
    </View>
    <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary }}>{value}</Text>
    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    {subvalue && (
      <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{subvalue}</Text>
    )}
  </TouchableOpacity>
);

const QuickAction = ({ icon, label, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <View style={{
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    }}>
      <Ionicons name={icon} size={22} color={colors.moduleIcon} />
    </View>
    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{label}</Text>
  </TouchableOpacity>
);

const PeriodSelector = ({ value, onChange }) => (
  <View style={{
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.lg,
  }}>
    {[
      { key: 'day', label: 'Day' },
      { key: 'month', label: 'Month' },
      { key: 'year', label: 'Year' },
    ].map((period) => (
      <TouchableOpacity
        key={period.key}
        onPress={() => onChange(period.key)}
        style={{
          flex: 1,
          paddingVertical: 8,
          borderRadius: borderRadius.sm,
          backgroundColor: value === period.key ? colors.surface : 'transparent',
          alignItems: 'center',
        }}
      >
        <Text style={{ 
          fontWeight: '600', 
          fontSize: 13,
          color: value === period.key ? colors.textPrimary : colors.textSecondary,
        }}>
          {period.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const ModuleActivityCard = ({ icon, label, value }) => (
  <View style={{
    width: '47%',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: spacing.md,
  }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <View style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Ionicons name={icon} size={14} color={colors.moduleIcon} />
      </View>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 8, flex: 1 }}>{label}</Text>
    </View>
    <Text style={{ fontSize: 26, fontWeight: '700', color: colors.textPrimary }}>{value}</Text>
  </View>
);

export default function SuperAdminDashboardScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { user } = useAuth();
  const [addTenantVisible, setAddTenantVisible] = useState(false);
  const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Get days for selected period
  const getPeriodDays = () => {
    switch (selectedPeriod) {
      case 'day': return 1;
      case 'month': return 30;
      case 'year': return 365;
      default: return 30;
    }
  };

  // Fetch cross-tenant analytics
  const { data: analytics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cross-tenant-analytics'],
    queryFn: async () => {
      const response = await api.get('/analytics/cross-tenant/overview');
      return response.data;
    },
  });

  // Fetch tenants
  const { data: tenants, refetch: refetchTenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await api.get('/tenants');
      return response.data;
    },
  });

  // Fetch activity metrics
  const { data: activityMetrics, refetch: refetchActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['activity-metrics', selectedPeriod],
    queryFn: async () => {
      const days = getPeriodDays();
      const response = await api.get(`/analytics/cross-tenant/activity?days=${days}`);
      return response.data;
    },
  });

  const handleTenantAdded = () => {
    setAddTenantVisible(false);
    refetchTenants();
    refetch();
  };

  const handleRefresh = () => {
    refetch();
    refetchTenants();
    refetchActivity();
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const periodLabel = selectedPeriod === 'day' ? 'Today' : selectedPeriod === 'month' ? 'Last 30 Days' : 'Last Year';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: '500' }}>Welcome back,</Text>
              <Text style={{ ...typography.h1, marginTop: 2 }}>
                {user?.first_name || 'Super Admin'}
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing.sm,
                backgroundColor: colors.primaryLight,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: borderRadius.full,
                alignSelf: 'flex-start',
              }}>
                <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                  Super Admin
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.full,
                backgroundColor: colors.surfaceSecondary,
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={{ padding: spacing.lg }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginBottom: spacing.md, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Platform Overview
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: spacing.md }}>
            <StatCard
              icon="business"
              label="Total Colleges"
              value={analytics?.tenants?.total || 0}
              subvalue={`${analytics?.tenants?.active || 0} active`}
              color={colors.primary}
              onPress={() => navigation.navigate('TenantManagement')}
            />
            <StatCard
              icon="people"
              label="Total Users"
              value={analytics?.users?.total || 0}
              subvalue={`${analytics?.users?.by_role?.student || 0} students`}
              color={colors.primary}
              onPress={() => setAnalyticsModalVisible(true)}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatCard
              icon="card"
              label="Monthly Revenue"
              value={`$${analytics?.revenue?.monthly_recurring || 0}`}
              subvalue="recurring"
              color={colors.warning}
              onPress={() => setAnalyticsModalVisible(true)}
            />
            <StatCard
              icon="mail"
              label="Pending Invites"
              value={analytics?.users?.pending_invitations || 0}
              onPress={() => navigation.navigate('TenantManagement')}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ padding: spacing.lg, paddingTop: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginBottom: spacing.md, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Quick Actions
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <QuickAction
              icon="add-circle"
              label="Add College"
              onPress={() => setAddTenantVisible(true)}
            />
            <QuickAction
              icon="people"
              label="Manage Tenants"
              onPress={() => navigation.navigate('TenantManagement')}
            />
            <QuickAction
              icon="analytics"
              label="Analytics"
              onPress={() => setAnalyticsModalVisible(true)}
            />
          </View>
        </View>

        {/* Aggregated Activity Summary */}
        <View style={{ padding: spacing.lg, paddingTop: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Activity Summary
            </Text>
            <TouchableOpacity onPress={() => setAnalyticsModalVisible(true)}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}>View Details</Text>
            </TouchableOpacity>
          </View>

          <PeriodSelector value={selectedPeriod} onChange={(p) => setSelectedPeriod(p)} />

          {activityLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={{ 
              backgroundColor: colors.surface, 
              borderRadius: borderRadius.lg, 
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
                {periodLabel}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <ModuleActivityCard icon="calendar" label="Events" value={activityMetrics?.totals?.events_created || 0} />
                <ModuleActivityCard icon="megaphone" label="Announcements" value={activityMetrics?.totals?.announcements_created || 0} />
                <ModuleActivityCard icon="chatbubbles" label="Messages" value={activityMetrics?.totals?.messages_sent || 0} />
                <ModuleActivityCard icon="construct" label="Maintenance" value={activityMetrics?.totals?.maintenance_requests || 0} />
                <ModuleActivityCard icon="bookmark" label="Bookings" value={activityMetrics?.totals?.bookings_made || 0} />
                <ModuleActivityCard icon="star" label="Shoutouts" value={activityMetrics?.totals?.shoutouts_given || 0} />
              </View>
              <View style={{ 
                marginTop: spacing.md, 
                paddingTop: spacing.md, 
                borderTopWidth: 1, 
                borderTopColor: colors.borderLight,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>New Users</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="person-add" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                    {activityMetrics?.totals?.new_users_registered || 0}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Recent Tenants */}
        <View style={{ padding: spacing.lg, paddingTop: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Recent Colleges
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('TenantManagement')}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}>View All</Text>
            </TouchableOpacity>
          </View>

          {tenants?.slice(0, 5).map((tenant) => (
            <TouchableOpacity
              key={tenant.code || tenant.id}
              onPress={() => navigation.navigate('TenantDetail', { tenant })}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: 10,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: borderRadius.md,
                backgroundColor: colors.surfaceSecondary,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: spacing.md,
              }}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                  {tenant.name?.[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{tenant.name}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  {tenant.user_count || 0} users
                </Text>
              </View>
              <View style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: borderRadius.full,
                backgroundColor: tenant.status === 'active' ? colors.primary + '15' : colors.errorLight,
              }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: tenant.status === 'active' ? colors.primary : colors.error,
                  textTransform: 'capitalize',
                }}>
                  {tenant.status}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ))}

          {(!tenants || tenants.length === 0) && (
            <View style={{ alignItems: 'center', padding: 40, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="business-outline" size={48} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No colleges yet</Text>
              <TouchableOpacity
                onPress={() => setAddTenantVisible(true)}
                style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: borderRadius.md }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: '600' }}>Add First College</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Subscription Breakdown */}
        <View style={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 100 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginBottom: spacing.md, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Subscription Tiers
          </Text>
          
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            {[
              { tier: 'Basic', count: analytics?.subscriptions?.basic || 0, price: '$99/mo', icon: 'cube' },
              { tier: 'Pro', count: analytics?.subscriptions?.pro || 0, price: '$299/mo', icon: 'flash' },
              { tier: 'Enterprise', count: analytics?.subscriptions?.enterprise || 0, price: 'Custom', icon: 'diamond' },
            ].map((item, index) => (
              <View
                key={item.tier}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: index < 2 ? 1 : 0,
                  borderBottomColor: colors.borderLight,
                }}
              >
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: borderRadius.sm,
                  backgroundColor: colors.surfaceSecondary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name={item.icon} size={16} color={colors.moduleIcon} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }}>{item.tier}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.price}</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Add Tenant Modal */}
      <AddTenantModal
        visible={addTenantVisible}
        onClose={() => setAddTenantVisible(false)}
        onSuccess={handleTenantAdded}
      />

      {/* Analytics Modal */}
      <Modal
        visible={analyticsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAnalyticsModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setAnalyticsModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Platform Analytics</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            {/* Total Users Section */}
            <View style={{ 
              backgroundColor: colors.primaryLight, 
              borderRadius: borderRadius.lg, 
              padding: 20, 
              marginBottom: 20,
              alignItems: 'center'
            }}>
              <Ionicons name="people" size={32} color={colors.primary} />
              <Text style={{ fontSize: 40, fontWeight: '700', color: colors.textPrimary, marginTop: 8 }}>
                {analytics?.users?.total || 0}
              </Text>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>Total Users</Text>
              <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                    {analytics?.users?.by_role?.admin || 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Admins</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                    {analytics?.users?.by_role?.ra || 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>RAs</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                    {analytics?.users?.by_role?.student || 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Students</Text>
                </View>
              </View>
            </View>

            {/* Activity by Period */}
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
              Module Activity
            </Text>
            
            <PeriodSelector value={selectedPeriod} onChange={(p) => setSelectedPeriod(p)} />

            {activityLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  { label: 'Events', value: activityMetrics?.totals?.events_created || 0, icon: 'calendar' },
                  { label: 'Announcements', value: activityMetrics?.totals?.announcements_created || 0, icon: 'megaphone' },
                  { label: 'Messages', value: activityMetrics?.totals?.messages_sent || 0, icon: 'chatbubbles' },
                  { label: 'Maintenance', value: activityMetrics?.totals?.maintenance_requests || 0, icon: 'construct' },
                  { label: 'Bookings', value: activityMetrics?.totals?.bookings_made || 0, icon: 'bookmark' },
                  { label: 'Shoutouts', value: activityMetrics?.totals?.shoutouts_given || 0, icon: 'star' },
                  { label: 'New Users', value: activityMetrics?.totals?.new_users_registered || 0, icon: 'person-add' },
                ].map((stat) => (
                  <View
                    key={stat.label}
                    style={{
                      width: '47%',
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: borderRadius.md,
                      padding: spacing.lg,
                      marginBottom: spacing.md,
                    }}
                  >
                    <Ionicons name={stat.icon} size={24} color={colors.moduleIcon} />
                    <Text style={{ fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginTop: 8 }}>
                      {stat.value}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Revenue Summary */}
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginTop: 24, marginBottom: 16 }}>
              Revenue Summary
            </Text>
            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: spacing.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={{ color: colors.textSecondary }}>Monthly Recurring</Text>
                <Text style={{ fontWeight: '600', color: colors.textPrimary }}>${analytics?.revenue?.monthly_recurring || 0}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={{ color: colors.textSecondary }}>Basic Tier Revenue</Text>
                <Text style={{ fontWeight: '600', color: colors.textPrimary }}>${(analytics?.subscriptions?.basic || 0) * 99}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary }}>Pro Tier Revenue</Text>
                <Text style={{ fontWeight: '600', color: colors.textPrimary }}>${(analytics?.subscriptions?.pro || 0) * 299}</Text>
              </View>
            </View>

            {/* Top Active Tenants */}
            {activityMetrics?.by_tenant && activityMetrics.by_tenant.length > 0 && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginTop: 24, marginBottom: 16 }}>
                  Most Active Colleges ({periodLabel})
                </Text>
                {activityMetrics.by_tenant.slice(0, 5).map((tenant, index) => (
                  <View 
                    key={tenant.tenant_code}
                    style={{ 
                      backgroundColor: colors.surfaceSecondary, 
                      borderRadius: borderRadius.md, 
                      padding: 14, 
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}
                  >
                    <View style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.surface,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>{tenant.tenant_name}</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {tenant.events || 0} events · {tenant.messages || 0} messages · {tenant.announcements || 0} announcements
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
