import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { generateReportCSV, exportAsCSV, getExportFilename } from '../../utils/exportUtils';
import { useTenant } from '../../contexts/TenantContext';

const { width } = Dimensions.get('window');

const StatCard = ({ icon, label, value, color, subtitle }) => (
  <View style={{
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.surfaceSecondary,
  }}>
    <View style={{
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      backgroundColor: `${color}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    }}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>{value}</Text>
    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    {subtitle && (
      <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{subtitle}</Text>
    )}
  </View>
);

const FeatureUsageBar = ({ label, count, maxCount, color }) => {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
  
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: colors.textPrimary }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>{count}</Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{
          width: `${Math.min(percentage, 100)}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: 4,
        }} />
      </View>
    </View>
  );
};

export default function AnalyticsReportsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState('usage'); // 'usage' | 'gbv'
  const [exporting, setExporting] = useState(false);

  // Student Usage Analytics
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage, isRefetching: usageRefetching } = useQuery({
    queryKey: ['analytics-usage', selectedPeriod],
    queryFn: async () => {
      const response = await api.get(`/analytics/student-usage?period=${selectedPeriod}`);
      return response.data;
    },
  });

  // Gender Violence Report
  const { data: gbvData, isLoading: gbvLoading, refetch: refetchGbv, isRefetching: gbvRefetching } = useQuery({
    queryKey: ['analytics-gbv'],
    queryFn: async () => {
      const response = await api.get('/analytics/gender-violence-report');
      return response.data;
    },
    enabled: activeTab === 'gbv',
  });

  const periods = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: '365d', label: '1 Year' },
  ];

  const maxFeatureCount = usageData?.feature_usage 
    ? Math.max(...Object.values(usageData.feature_usage))
    : 1;

  const featureColors = {
    'Messages Sent': primaryColor,
    'Event RSVPs': primaryColor,
    'Service Requests': colors.error,
    'Shoutouts Given': primaryColor,
    'Study Groups': primaryColor,
    'Job Applications': primaryColor,
    'Room Bookings': colors.error,
  };

  const isLoading = activeTab === 'usage' ? usageLoading : gbvLoading;
  const isRefetching = activeTab === 'usage' ? usageRefetching : gbvRefetching;

  const onRefresh = () => {
    if (activeTab === 'usage') {
      refetchUsage();
    } else {
      refetchGbv();
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let sections = [];
      
      if (activeTab === 'usage' && usageData) {
        sections = [
          {
            title: `Student Usage Analytics (${selectedPeriod})`,
            type: 'stats',
            data: {
              'Total Users': usageData.summary?.total_users || 0,
              'Active Users': usageData.summary?.active_users || 0,
              'Engagement Rate': `${usageData.summary?.engagement_rate || 0}%`,
            }
          },
          {
            title: 'Users by Role',
            type: 'breakdown',
            data: usageData.users_by_role || {}
          },
          {
            title: 'Feature Usage',
            type: 'breakdown',
            data: usageData.feature_usage || {}
          },
          {
            title: 'Engagement by Category',
            type: 'breakdown',
            data: usageData.engagement_by_category || {}
          },
        ];
      } else if (activeTab === 'gbv' && gbvData) {
        sections = [
          {
            title: `Safety Report - ${gbvData.academic_year || 'Current Year'}`,
            type: 'stats',
            data: {
              'Total GBV Disclosures': gbvData.summary?.total_gbv_disclosures || 0,
              'Resolution Rate': `${gbvData.summary?.resolution_rate || 0}%`,
              'Anonymous Reports': gbvData.summary?.anonymous_reports || 0,
              'Identified Reports': gbvData.summary?.identified_reports || 0,
            }
          },
        ];
        
        if (gbvData.by_type?.length > 0) {
          const typeBreakdown = {};
          gbvData.by_type.forEach(item => {
            typeBreakdown[item.type || 'Unknown'] = item.count;
          });
          sections.push({
            title: 'Reports by Type',
            type: 'breakdown',
            data: typeBreakdown
          });
        }
        
        if (gbvData.by_severity) {
          sections.push({
            title: 'By Severity',
            type: 'breakdown',
            data: gbvData.by_severity
          });
        }
        
        if (gbvData.response_time) {
          sections.push({
            title: 'Response Time (Days)',
            type: 'stats',
            data: {
              'Fastest': gbvData.response_time.fastest_days || 0,
              'Average': gbvData.response_time.average_days || 0,
              'Slowest': gbvData.response_time.slowest_days || 0,
            }
          });
        }
      }
      
      if (sections.length === 0) {
        Alert.alert('No Data', 'No data available to export');
        return;
      }
      
      const csvContent = generateReportCSV(sections);
      const filename = getExportFilename(activeTab === 'usage' ? 'student_usage_analytics' : 'safety_report');
      await exportAsCSV(csvContent, filename);
    } catch (error) {
      Alert.alert('Export Failed', error.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: 'bold' }}>Analytics & Reports</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Platform insights</Text>
          </View>
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting || isLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: exporting ? 'rgba(255,255,255,0.3)' : primaryColor,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
            }}
            data-testid="export-analytics-btn"
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Ionicons name="download-outline" size={18} color={colors.surface} />
            )}
            <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: borderRadius.md, padding: 4 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('usage')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: borderRadius.sm,
              backgroundColor: activeTab === 'usage' ? colors.surface : 'transparent',
            }}
          >
            <Text style={{
              textAlign: 'center',
              fontWeight: '600',
              color: activeTab === 'usage' ? colors.textPrimary : 'rgba(255,255,255,0.7)',
            }}>
              Student Usage
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('gbv')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: borderRadius.sm,
              backgroundColor: activeTab === 'gbv' ? colors.surface : 'transparent',
            }}
          >
            <Text style={{
              textAlign: 'center',
              fontWeight: '600',
              color: activeTab === 'gbv' ? colors.textPrimary : 'rgba(255,255,255,0.7)',
            }}>
              Safety Reports
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading analytics...</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'usage' ? (
            <>
              {/* Period Selector */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {periods.map((period) => (
                    <TouchableOpacity
                      key={period.key}
                      onPress={() => setSelectedPeriod(period.key)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: selectedPeriod === period.key ? primaryColor : colors.surface,
                        marginRight: 8,
                        borderWidth: 1,
                        borderColor: selectedPeriod === period.key ? primaryColor : colors.border,
                      }}
                    >
                      <Text style={{
                        color: selectedPeriod === period.key ? colors.surface : colors.textSecondary,
                        fontWeight: '500',
                        fontSize: 13,
                      }}>
                        {period.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Summary Stats */}
              <View style={{ paddingHorizontal: 12, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <StatCard
                    icon="people"
                    label="Total Users"
                    value={usageData?.summary?.total_users || 0}
                    color={primaryColor}
                  />
                  <StatCard
                    icon="pulse"
                    label="Active Users"
                    value={usageData?.summary?.active_users || 0}
                    color={primaryColor}
                    subtitle={`${usageData?.summary?.engagement_rate || 0}% engagement`}
                  />
                </View>
              </View>

              {/* Users by Role */}
              <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                  Users by Role
                </Text>
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                    {Object.entries(usageData?.users_by_role || {}).map(([role, count]) => (
                      <View key={role} style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary }}>{count}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>
                          {role.replace('_', ' ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* Feature Usage */}
              <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                  Feature Usage
                </Text>
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                  {usageData?.feature_usage && Object.entries(usageData.feature_usage)
                    .filter(([_, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([label, count]) => (
                      <FeatureUsageBar
                        key={label}
                        label={label}
                        count={count}
                        maxCount={maxFeatureCount}
                        color={featureColors[label] || colors.textSecondary}
                      />
                    ))}
                  {(!usageData?.feature_usage || Object.values(usageData.feature_usage).every(v => v === 0)) && (
                    <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>
                      No feature usage data for this period
                    </Text>
                  )}
                </View>
              </View>

              {/* Engagement by Category */}
              <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                  Engagement by Category
                </Text>
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                  {usageData?.engagement_by_category && Object.entries(usageData.engagement_by_category)
                    .filter(([_, count]) => count > 0)
                    .map(([category, count]) => (
                      <View key={category} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}>
                        <Text style={{ fontSize: 14, color: colors.textPrimary, textTransform: 'capitalize' }}>
                          {category.replace('_', ' ')}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{count}</Text>
                      </View>
                    ))}
                </View>
              </View>
            </>
          ) : (
            <>
              {/* GBV Report Header */}
              <View style={{ padding: spacing.lg }}>
                <View style={{ backgroundColor: primaryColor + '15', borderRadius: borderRadius.md, padding: 14, flexDirection: 'row', marginBottom: 16 }}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: primaryColor }}>
                      Confidential Report
                    </Text>
                    <Text style={{ fontSize: 12, color: primaryColor, marginTop: 2 }}>
                      All data is anonymized and aggregated for compliance reporting.
                    </Text>
                  </View>
                </View>

                {/* Report Period */}
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>Academic Year</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                    {gbvData?.academic_year || 'N/A'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
                    {gbvData?.period?.start} - {gbvData?.period?.end}
                  </Text>
                </View>

                {/* Summary Stats */}
                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                  <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginRight: 8, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                    <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primary }}>
                      {gbvData?.summary?.total_gbv_disclosures || 0}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>GBV Reports</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginLeft: 8, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                    <Text style={{ fontSize: 28, fontWeight: '700', color: primaryColor }}>
                      {gbvData?.summary?.resolution_rate || 0}%
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Resolution Rate</Text>
                  </View>
                </View>

                {/* Report Type Breakdown */}
                {gbvData?.by_type && gbvData.by_type.length > 0 && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                      Reports by Type
                    </Text>
                    {gbvData.by_type.map((item, index) => (
                      <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: index < gbvData.by_type.length - 1 ? 1 : 0, borderBottomColor: colors.surfaceSecondary }}>
                        <Text style={{ fontSize: 14, color: colors.textPrimary, textTransform: 'capitalize' }}>
                          {(item.type || 'Unknown').replace(/_/g, ' ')}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{item.count}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Severity Distribution */}
                {gbvData?.by_severity && Object.keys(gbvData.by_severity).length > 0 && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                      By Severity
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      {['low', 'medium', 'high'].map((severity) => (
                        <View key={severity} style={{ alignItems: 'center' }}>
                          <View style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            backgroundColor: severity === 'high' ? colors.errorLight : severity === 'medium' ? primaryColor + '15' : primaryColor + '15',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 8,
                          }}>
                            <Text style={{
                              fontSize: 18,
                              fontWeight: '700',
                              color: severity === 'high' ? colors.error : severity === 'medium' ? primaryColor : primaryColor,
                            }}>
                              {gbvData.by_severity[severity] || 0}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>{severity}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Anonymous vs Identified */}
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                    Reporting Method
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="eye-off" size={24} color={colors.primary} />
                      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 8 }}>
                        {gbvData?.summary?.anonymous_reports || 0}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Anonymous</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="person" size={24} color={primaryColor} />
                      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 8 }}>
                        {gbvData?.summary?.identified_reports || 0}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Identified</Text>
                    </View>
                  </View>
                </View>

                {/* Response Time */}
                {gbvData?.response_time && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, marginBottom: 24, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                      Response Time
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: primaryColor }}>
                          {gbvData.response_time.fastest_days || 0}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Fastest (days)</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: primaryColor }}>
                          {gbvData.response_time.average_days || 0}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Average (days)</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: primaryColor }}>
                          {gbvData.response_time.slowest_days || 0}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Slowest (days)</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* No Data State */}
                {(!gbvData?.summary?.total_gbv_disclosures || gbvData.summary.total_gbv_disclosures === 0) && (
                  <View style={{ backgroundColor: primaryColor + '15', borderRadius: 14, padding: 20, alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={48} color={primaryColor} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: primaryColor, marginTop: 12 }}>
                      No Reports This Period
                    </Text>
                    <Text style={{ fontSize: 13, color: primaryColor, marginTop: 4, textAlign: 'center' }}>
                      No gender-based violence disclosures have been reported for this academic year.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
