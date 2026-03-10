import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { generateReportCSV, exportAsCSV, getExportFilename } from '../../utils/exportUtils';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';

export default function AdminReportsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [exporting, setExporting] = useState(false);
  
  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminReports'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.ADMIN_STATS);
      return response.data;
    },
  });

  const statCards = [
    { label: 'Total Users', value: stats?.total_users || 0, icon: 'people', color: primaryColor, subtext: 'Active accounts' },
    { label: 'Events', value: stats?.total_events || 0, icon: 'calendar', color: primaryColor, subtext: `${stats?.active_events || 0} active` },
    { label: 'News', value: stats?.total_announcements || 0, icon: 'megaphone', color: primaryColor, subtext: 'Published' },
    { label: 'Recognitions', value: stats?.total_shoutouts || 0, icon: 'star', color: colors.error, subtext: 'Total given' },
    { label: 'Service Requests', value: stats?.total_requests || 0, icon: 'construct', color: primaryColor, subtext: `${stats?.pending_requests || 0} pending` },
    { label: 'Job Applications', value: stats?.total_applications || 0, icon: 'briefcase', color: primaryColor, subtext: `${stats?.pending_applications || 0} pending` },
  ];

  const userBreakdown = [
    { role: 'Students', count: stats?.student_count || 0, color: primaryColor },
    { role: 'RAs', count: stats?.ra_count || 0, color: primaryColor },
    { role: 'Admins', count: stats?.admin_count || 0, color: primaryColor },
    { role: 'Super Admins', count: stats?.super_admin_count || 0, color: colors.error },
  ];

  const handleExport = async () => {
    if (!stats) {
      Alert.alert('No Data', 'No data available to export');
      return;
    }
    
    setExporting(true);
    try {
      const sections = [
        {
          title: 'Platform Overview',
          type: 'stats',
          data: {
            'Total Users': stats.total_users || 0,
            'Total Events': stats.total_events || 0,
            'Active Events': stats.active_events || 0,
            'Total News': stats.total_announcements || 0,
            'Total Recognitions': stats.total_shoutouts || 0,
            'Total Service Requests': stats.total_requests || 0,
            'Pending Service Requests': stats.pending_requests || 0,
            'Total Job Applications': stats.total_applications || 0,
            'Pending Applications': stats.pending_applications || 0,
          }
        },
        {
          title: 'Users by Role',
          type: 'breakdown',
          data: {
            'Students': stats.student_count || 0,
            'RAs': stats.ra_count || 0,
            'Admins': stats.admin_count || 0,
            'Super Admins': stats.super_admin_count || 0,
          }
        },
      ];
      
      const csvContent = generateReportCSV(sections);
      const filename = getExportFilename('platform_insights');
      await exportAsCSV(csvContent, filename);
    } catch (error) {
      Alert.alert('Export Failed', error.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
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
      <AdminScreenHeader
        title="Reports & Insights"
        subtitle="Overview of your college community"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Export Button */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, alignItems: 'flex-end' }}>
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting || isLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: exporting ? colors.textTertiary : primaryColor,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 20,
            }}
            data-testid="export-insights-btn"
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Ionicons name="download-outline" size={18} color={colors.surface} />
            )}
            <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6, fontSize: 14 }}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {statCards.map((stat, index) => (
              <View
                key={index}
                style={{
                  width: '48%',
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  shadowColor: colors.textPrimary,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: `${stat.color}15`,
                    borderRadius: borderRadius.md,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: spacing.md,
                  }}
                >
                  <Ionicons name={stat.icon} size={20} color={stat.color} />
                </View>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary }}>
                  {stat.value}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 4 }}>
                  {stat.label}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {stat.subtext}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* User Breakdown */}
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>User Breakdown</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg }}>
            {userBreakdown.map((item, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderBottomWidth: index < userBreakdown.length - 1 ? 1 : 0,
                  borderBottomColor: colors.surfaceSecondary,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      backgroundColor: item.color,
                      borderRadius: 6,
                      marginRight: 12,
                    }}
                  />
                  <Text style={{ fontSize: 15, color: colors.textPrimary }}>{item.role}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ padding: 20, paddingTop: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>Activity Summary</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '15', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="trending-up" size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Event Attendance</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                  {stats?.total_rsvps || 0} RSVPs
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '15', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="chatbubbles" size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Messages Sent</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                  {stats?.total_messages || 0} messages
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '15', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="time" size={20} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Avg. Resolution Time</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                  {stats?.avg_resolution_time || '24'} hours
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
