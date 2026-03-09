import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useTenant } from '../../contexts/TenantContext';

export default function AnnualDisclosureReportScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [selectedYear, setSelectedYear] = useState(null);
  const [exporting, setExporting] = useState(null); // 'csv' or 'pdf'

  // Get available years
  const { data: availableYears, isLoading: loadingYears } = useQuery({
    queryKey: ['availableReportYears'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.SAFE_DISCLOSURE}/annual-report`);
      return response.data;
    },
  });

  // Get report for selected year
  const { data: report, isLoading: loadingReport, refetch } = useQuery({
    queryKey: ['annualReport', selectedYear],
    queryFn: async () => {
      if (!selectedYear) return null;
      const response = await api.get(`${ENDPOINTS.SAFE_DISCLOSURE}/annual-report/${selectedYear}`);
      return response.data;
    },
    enabled: !!selectedYear,
  });

  // Auto-select current academic year
  React.useEffect(() => {
    if (availableYears && !selectedYear) {
      setSelectedYear(availableYears.current_academic_year);
    }
  }, [availableYears]);

  const handleExport = async (format) => {
    if (!selectedYear) {
      Alert.alert('Error', 'Please select a year first');
      return;
    }
    
    setExporting(format);
    try {
      // Request a signed download URL from the backend
      const response = await api.post(
        `${ENDPOINTS.SAFE_DISCLOSURE}/annual-report/${selectedYear}/export-url`,
        { format }
      );
      
      const { download_path, expires, signature } = response.data;
      
      // Construct the full download URL with signature
      const baseUrl = api.defaults.baseURL || '';
      const downloadUrl = `${baseUrl}${download_path}?expires=${expires}&signature=${signature}`;
      
      // Open in browser - the signed URL will work without auth
      Alert.alert(
        `Download ${format.toUpperCase()}`,
        `Your secure download link is ready and will expire in 5 minutes.`,
        [
          {
            text: 'Download Now',
            onPress: () => Linking.openURL(downloadUrl),
          },
          {
            text: 'Share Link',
            onPress: async () => {
              try {
                await Share.share({
                  message: `Annual Disclosure Report ${selectedYear}-${selectedYear + 1}: ${downloadUrl}`,
                  url: downloadUrl,
                  title: `Annual Report ${selectedYear}-${selectedYear + 1}`,
                });
              } catch (error) {
                Alert.alert('Error', 'Failed to share');
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to generate download link';
      Alert.alert('Error', message);
    } finally {
      setExporting(null);
    }
  };

  const StatCard = ({ title, value, icon, color, subtext }) => (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: borderRadius.md,
          backgroundColor: `${color}20`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={{ fontSize: 14, color: colors.textSecondary, flex: 1 }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary }}>{value}</Text>
      {subtext && <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>{subtext}</Text>}
    </View>
  );

  const BreakdownSection = ({ title, data, colorFn }) => {
    if (!data || Object.keys(data).length === 0) return null;
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    
    return (
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
      }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>{title}</Text>
        {Object.entries(data).map(([key, count]) => {
          const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
          const color = colorFn ? colorFn(key) : primaryColor;
          return (
            <View key={key} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textTransform: 'capitalize' }}>
                  {key.replace(/_/g, ' ')}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>
                  {count} ({percentage}%)
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 4 }}>
                <View style={{
                  height: 8,
                  backgroundColor: color,
                  borderRadius: 4,
                  width: `${percentage}%`,
                }} />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return primaryColor;
      case 'investigation': return colors.error;
      case 'support_plan_active': return primaryColor;
      case 'risk_assessment_complete': return primaryColor;
      default: return colors.textSecondary;
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return colors.error;
      case 'medium': return primaryColor;
      case 'low': return primaryColor;
      default: return colors.textSecondary;
    }
  };

  if (loadingYears) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
          </TouchableOpacity>
          <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: 'bold' }}>Annual Disclosure Report</Text>
        </View>
        
        {/* Year Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {availableYears?.available_academic_years?.map((yearObj) => (
            <TouchableOpacity
              key={yearObj.year}
              onPress={() => setSelectedYear(yearObj.year)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: selectedYear === yearObj.year ? colors.surface : 'rgba(255,255,255,0.2)',
                marginRight: 8,
              }}
            >
              <Text style={{
                color: selectedYear === yearObj.year ? primaryColor : colors.surface,
                fontWeight: '600',
              }}>
                {yearObj.label}
              </Text>
            </TouchableOpacity>
          ))}
          {(!availableYears?.available_academic_years || availableYears.available_academic_years.length === 0) && (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)' }}>No reports available yet</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={loadingReport} onRefresh={refetch} />}
      >
        {loadingReport && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading report...</Text>
          </View>
        )}

        {/* Export Buttons */}
        {report && !loadingReport && (
          <View style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginBottom: 16,
            gap: 8,
          }}>
            <TouchableOpacity
              onPress={() => handleExport('csv')}
              disabled={exporting === 'csv'}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: primaryColor,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: borderRadius.md,
                opacity: exporting === 'csv' ? 0.6 : 1,
              }}
            >
              {exporting === 'csv' ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Ionicons name="document-text" size={18} color={colors.surface} />
              )}
              <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6 }}>CSV</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => handleExport('pdf')}
              disabled={exporting === 'pdf'}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.error,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: borderRadius.md,
                opacity: exporting === 'pdf' ? 0.6 : 1,
              }}
            >
              {exporting === 'pdf' ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Ionicons name="document" size={18} color={colors.surface} />
              )}
              <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6 }}>PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {report && !loadingReport && (
          <>
            {/* Report Period Info */}
            <View style={{
              backgroundColor: colors.surfaceSecondary,
              padding: 12,
              borderRadius: borderRadius.md,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Ionicons name="calendar" size={20} color={primaryColor} />
              <Text style={{ color: colors.primary, marginLeft: 8, flex: 1 }}>
                Report Period: {report.report_period.start_date} to {report.report_period.end_date}
              </Text>
            </View>

            {/* Summary Stats */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <StatCard
                  title="Total Disclosures"
                  value={report.summary.total_disclosures}
                  icon="document-text"
                  color={primaryColor}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <StatCard
                  title="Resolution Rate"
                  value={`${report.summary.resolution_rate_percent}%`}
                  icon="checkmark-circle"
                  color={primaryColor}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <StatCard
                  title="Anonymous"
                  value={report.summary.anonymous_disclosures}
                  icon="eye-off"
                  color={colors.secondary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <StatCard
                  title="Avg Resolution"
                  value={report.summary.average_resolution_days ? `${report.summary.average_resolution_days}d` : 'N/A'}
                  icon="time"
                  color={colors.warning}
                />
              </View>
            </View>

            {/* Safety Metrics */}
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 8, marginBottom: spacing.md }}>
              Safety Metrics
            </Text>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <View style={{ width: '50%', marginBottom: spacing.md }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.error }}>
                    {report.safety_metrics.immediate_danger_cases}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Immediate Danger</Text>
                </View>
                <View style={{ width: '50%', marginBottom: spacing.md }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: primaryColor }}>
                    {report.safety_metrics.medical_attention_needed}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Medical Attention</Text>
                </View>
                <View style={{ width: '50%' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: primaryColor }}>
                    {report.safety_metrics.police_notified}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Police Notified</Text>
                </View>
                <View style={{ width: '50%' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: primaryColor }}>
                    {report.safety_metrics.formal_reports_filed}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Formal Reports</Text>
                </View>
              </View>
            </View>

            {/* Breakdowns */}
            <BreakdownSection
              title="Incident Types"
              data={report.incident_types}
              colorFn={() => primaryColor}
            />

            <BreakdownSection
              title="Status Breakdown"
              data={report.status_breakdown}
              colorFn={getStatusColor}
            />

            <BreakdownSection
              title="Risk Level Distribution"
              data={report.risk_level_distribution}
              colorFn={getRiskColor}
            />

            {/* Compliance Note */}
            <View style={{
              backgroundColor: primaryColor + '15',
              padding: 12,
              borderRadius: borderRadius.md,
              marginTop: 8,
              marginBottom: 24,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="shield-checkmark" size={18} color={colors.warning} />
                <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 8 }}>Compliance Note</Text>
              </View>
              <Text style={{ color: primaryColor, fontSize: 12 }}>
                {report.compliance_note}
              </Text>
            </View>
          </>
        )}

        {!report && !loadingReport && selectedYear && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="document-text-outline" size={64} color={colors.borderDark} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
              No disclosures found for the selected academic year.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
