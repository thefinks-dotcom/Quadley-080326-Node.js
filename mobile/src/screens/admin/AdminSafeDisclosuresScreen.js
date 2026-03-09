import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useTenant } from '../../contexts/TenantContext';

const STATUS_OPTIONS = [
  { id: 'pending_risk_assessment', label: 'Pending', color: null },
  { id: 'risk_assessment_complete', label: 'Assessed', color: null },
  { id: 'support_plan_active', label: 'Support', color: null },
  { id: 'investigation', label: 'Review', color: colors.error },
  { id: 'resolved', label: 'Resolved', color: null },
];

const RISK_LEVELS = [
  { id: 'none', label: 'No Risk', color: colors.textSecondary },
  { id: 'low', label: 'Low Risk', color: null },
  { id: 'medium', label: 'Medium Risk', color: null },
  { id: 'high', label: 'High Risk', color: colors.error },
];

const getStatusConfig = (status, fallbackColor = colors.primary) => {
  const config = STATUS_OPTIONS.find(s => s.id === status) || { label: status, color: colors.textSecondary };
  return { ...config, color: config.color || fallbackColor };
};

const getRiskConfig = (level) => {
  return RISK_LEVELS.find(r => r.id === level) || { label: level, color: colors.textSecondary };
};

export default function AdminSafeDisclosuresScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [selectedDisclosure, setSelectedDisclosure] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [riskModalVisible, setRiskModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);

  // Form states
  const [forwardEmail, setForwardEmail] = useState('');
  const [forwardName, setForwardName] = useState('');
  const [forwardNotes, setForwardNotes] = useState('');
  const [includeContact, setIncludeContact] = useState(false);
  const [riskLevel, setRiskLevel] = useState('low');
  const [riskNotes, setRiskNotes] = useState('');
  const [safetyMeasures, setSafetyMeasures] = useState([]);
  const [supportNotes, setSupportNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Fetch disclosures
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['safeDisclosures'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.SAFE_DISCLOSURE);
      return response.data;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['disclosureStats'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.SAFE_DISCLOSURE}/stats`);
      return response.data;
    },
  });

  // Forward disclosure mutation
  const forwardMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.post(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/forward`, data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Disclosure forwarded successfully');
      setForwardModalVisible(false);
      resetForwardForm();
      queryClient.invalidateQueries(['safeDisclosures']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to forward disclosure');
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const response = await api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/status`, { status, notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['safeDisclosures']);
      queryClient.invalidateQueries(['disclosureStats']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    },
  });

  // Risk assessment mutation
  const riskAssessmentMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/risk-assessment`, data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Risk assessment completed');
      setRiskModalVisible(false);
      resetRiskForm();
      queryClient.invalidateQueries(['safeDisclosures']);
      queryClient.invalidateQueries(['disclosureStats']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to complete risk assessment');
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }) => {
      const response = await api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/resolve`, { resolution_notes: notes });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Disclosure resolved');
      setResolveModalVisible(false);
      setResolutionNotes('');
      setDetailModalVisible(false);
      queryClient.invalidateQueries(['safeDisclosures']);
      queryClient.invalidateQueries(['disclosureStats']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to resolve disclosure');
    },
  });

  const resetForwardForm = () => {
    setForwardEmail('');
    setForwardName('');
    setForwardNotes('');
    setIncludeContact(false);
  };

  const resetRiskForm = () => {
    setRiskLevel('low');
    setRiskNotes('');
    setSafetyMeasures([]);
    setSupportNotes('');
    setFollowUpDate('');
  };

  const handleForward = () => {
    if (!forwardEmail.trim()) {
      Alert.alert('Error', 'Please enter recipient email');
      return;
    }
    forwardMutation.mutate({
      id: selectedDisclosure.id,
      data: {
        recipient_email: forwardEmail.trim(),
        recipient_name: forwardName.trim() || null,
        include_reporter_contact: includeContact,
        additional_notes: forwardNotes.trim() || null,
      },
    });
  };

  const handleRiskAssessment = async () => {
    // First submit risk assessment
    riskAssessmentMutation.mutate({
      id: selectedDisclosure.id,
      data: {
        risk_level: riskLevel,
        safety_measures: safetyMeasures,
        assessment_notes: riskNotes.trim() || null,
        // Include support plan data if provided
        support_notes: supportNotes.trim() || null,
        follow_up_date: followUpDate.trim() || null,
      },
    });
  };

  const handleResolve = () => {
    if (!resolutionNotes.trim()) {
      Alert.alert('Error', 'Please enter resolution notes');
      return;
    }
    resolveMutation.mutate({
      id: selectedDisclosure.id,
      notes: resolutionNotes.trim(),
    });
  };

  const openDetailModal = (disclosure) => {
    setSelectedDisclosure(disclosure);
    setDetailModalVisible(true);
  };

  const disclosures = data || [];
  const filteredDisclosures = filter === 'all' 
    ? disclosures 
    : disclosures.filter(d => d.status === filter);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['top']}>
      {/* Header */}
      <View style={{ 
        backgroundColor: colors.primary, 
        paddingHorizontal: 16, 
        paddingTop: 8, 
        paddingBottom: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: 'bold' }}>Safe Disclosures</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              {disclosures.length} total • {stats?.urgent_count || 0} urgent
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('AnnualDisclosureReport')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: borderRadius.sm,
            }}
          >
            <Ionicons name="stats-chart" size={20} color={colors.surface} />
          </TouchableOpacity>
        </View>

        {/* Stats Row - Clickable to filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {stats && (
            <>
              <TouchableOpacity 
                onPress={() => setFilter('all')}
                style={statBadgeStyle(colors.textSecondary, filter === 'all')}
              >
                <Text style={statNumberStyle}>{disclosures.length}</Text>
                <Text style={statLabelStyle}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setFilter('pending_risk_assessment')}
                style={statBadgeStyle(primaryColor, filter === 'pending_risk_assessment')}
              >
                <Text style={statNumberStyle}>{stats.pending_risk_assessment}</Text>
                <Text style={statLabelStyle}>Pending</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setFilter('risk_assessment_complete')}
                style={statBadgeStyle(primaryColor, filter === 'risk_assessment_complete')}
              >
                <Text style={statNumberStyle}>{stats.risk_assessment_complete}</Text>
                <Text style={statLabelStyle}>Assessed</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setFilter('support_plan_active')}
                style={statBadgeStyle(primaryColor, filter === 'support_plan_active')}
              >
                <Text style={statNumberStyle}>{stats.support_plan_active}</Text>
                <Text style={statLabelStyle}>Support</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setFilter('resolved')}
                style={statBadgeStyle(primaryColor, filter === 'resolved')}
              >
                <Text style={statNumberStyle}>{stats.resolved}</Text>
                <Text style={statLabelStyle}>Resolved</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {filteredDisclosures.length === 0 ? (
          <View style={{ 
            backgroundColor: colors.surface, 
            borderRadius: borderRadius.lg, 
            padding: 32,
            alignItems: 'center',
          }}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 16 }}>
              No Disclosures
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
              {filter === 'all' ? 'No safe disclosures have been submitted yet.' : 'No disclosures match this filter.'}
            </Text>
          </View>
        ) : (
          filteredDisclosures.map(disclosure => {
            const statusConfig = getStatusConfig(disclosure.status, primaryColor);
            const isUrgent = disclosure.urgency === 'urgent' || disclosure.immediate_danger;
            
            return (
              <TouchableOpacity
                key={disclosure.id}
                onPress={() => openDetailModal(disclosure)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  borderLeftWidth: 4,
                  borderLeftColor: isUrgent ? colors.error : statusConfig.color,
                  shadowColor: colors.textPrimary,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                }}
                data-testid={`disclosure-card-${disclosure.id}`}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {isUrgent && (
                        <View style={{ 
                          backgroundColor: colors.errorLight, 
                          paddingHorizontal: 8, 
                          paddingVertical: 2, 
                          borderRadius: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}>
                          <Ionicons name="warning" size={12} color={colors.error} />
                          <Text style={{ fontSize: 10, color: colors.error, fontWeight: '600', marginLeft: 2 }}>URGENT</Text>
                        </View>
                      )}
                      {disclosure.is_anonymous && (
                        <View style={{ 
                          backgroundColor: colors.surfaceSecondary, 
                          paddingHorizontal: 8, 
                          paddingVertical: 2, 
                          borderRadius: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}>
                          <Ionicons name="eye-off" size={12} color={colors.secondary} />
                          <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500', marginLeft: 2 }}>Anonymous</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                      {disclosure.incident_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Incident'}
                    </Text>
                  </View>
                  <View style={{ 
                    backgroundColor: `${statusConfig.color}15`, 
                    paddingHorizontal: 10, 
                    paddingVertical: 4, 
                    borderRadius: borderRadius.md,
                  }}>
                    <Text style={{ fontSize: 11, color: statusConfig.color, fontWeight: '600' }}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }} numberOfLines={2}>
                  {disclosure.description || 'No description provided'}
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {disclosure.incident_date && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                        {disclosure.incident_date}
                      </Text>
                    </View>
                  )}
                  {disclosure.incident_location && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                        {disclosure.incident_location}
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                      {formatDate(disclosure.created_at)}
                    </Text>
                  </View>
                </View>

                {/* Workflow Actions */}
                <View style={{ flexDirection: 'row', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
                  {/* Show next step action based on current status */}
                  {disclosure.status === 'pending_risk_assessment' && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedDisclosure(disclosure);
                        setRiskModalVisible(true);
                      }}
                      style={{
                        backgroundColor: primaryColor,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="arrow-forward" size={14} color={colors.surface} />
                      <Text style={{ fontSize: 12, color: colors.textInverse, fontWeight: '600', marginLeft: 4 }}>Assess</Text>
                    </TouchableOpacity>
                  )}
                  {disclosure.status === 'risk_assessment_complete' && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedDisclosure(disclosure);
                        setRiskModalVisible(true);
                      }}
                      style={{
                        backgroundColor: primaryColor,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="arrow-forward" size={14} color={colors.surface} />
                      <Text style={{ fontSize: 12, color: colors.textInverse, fontWeight: '600', marginLeft: 4 }}>Add Support</Text>
                    </TouchableOpacity>
                  )}
                  {(disclosure.status === 'support_plan_active' || disclosure.status === 'risk_assessment_complete') && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedDisclosure(disclosure);
                        setResolveModalVisible(true);
                      }}
                      style={{
                        backgroundColor: primaryColor,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={14} color={colors.surface} />
                      <Text style={{ fontSize: 12, color: colors.textInverse, fontWeight: '600', marginLeft: 4 }}>Resolve</Text>
                    </TouchableOpacity>
                  )}
                  {/* Forward always available except for resolved */}
                  {disclosure.status !== 'resolved' && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedDisclosure(disclosure);
                        setForwardModalVisible(true);
                      }}
                      style={{
                        backgroundColor: colors.surfaceSecondary,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="mail-outline" size={14} color={colors.textPrimary} />
                      <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: '500', marginLeft: 4 }}>Forward</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          }}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Disclosure Details</Text>
            <View style={{ width: 50 }} />
          </View>

          {selectedDisclosure && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              {/* Status Banner */}
              <View style={{
                backgroundColor: `${getStatusConfig(selectedDisclosure.status, primaryColor).color}15`,
                padding: 12,
                borderRadius: borderRadius.md,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <View style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: getStatusConfig(selectedDisclosure.status, primaryColor).color,
                  marginRight: 8,
                }} />
                <Text style={{ 
                  color: getStatusConfig(selectedDisclosure.status, primaryColor).color, 
                  fontWeight: '600',
                  flex: 1,
                }}>
                  Status: {getStatusConfig(selectedDisclosure.status, primaryColor).label}
                </Text>
                {selectedDisclosure.immediate_danger && (
                  <View style={{ 
                    backgroundColor: colors.error, 
                    paddingHorizontal: 8, 
                    paddingVertical: 4, 
                    borderRadius: 4 
                  }}>
                    <Text style={{ color: colors.textInverse, fontSize: 11, fontWeight: '700' }}>DANGER</Text>
                  </View>
                )}
              </View>

              {/* Incident Info */}
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Incident Information</Text>
                
                <DetailRow label="Type" value={selectedDisclosure.incident_type?.replace(/_/g, ' ')} />
                <DetailRow label="Date" value={selectedDisclosure.incident_date} />
                <DetailRow label="Location" value={selectedDisclosure.incident_location} />
                <DetailRow label="Description" value={selectedDisclosure.description} multiline />
                <DetailRow label="Individuals Involved" value={selectedDisclosure.individuals_involved} />
                {selectedDisclosure.witness_present && (
                  <DetailRow label="Witness Details" value={selectedDisclosure.witness_details} />
                )}
              </View>

              {/* Safety Info */}
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Safety Information</Text>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <SafetyBadge label="Immediate Danger" active={selectedDisclosure.immediate_danger} />
                  <SafetyBadge label="Medical Attention" active={selectedDisclosure.medical_attention_needed} />
                  <SafetyBadge label="Police Notified" active={selectedDisclosure.police_notified} />
                </View>
              </View>

              {/* Reporter Info (if not anonymous) */}
              {!selectedDisclosure.is_anonymous && (
                <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Reporter Information</Text>
                  
                  <DetailRow label="Name" value={selectedDisclosure.reporter_name} />
                  <DetailRow label="Email" value={selectedDisclosure.reporter_email} />
                  <DetailRow label="Preferred Contact" value={selectedDisclosure.preferred_contact} />
                </View>
              )}

              {/* Risk Assessment (if completed) */}
              {selectedDisclosure.risk_assessment && (
                <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Risk Assessment</Text>
                  
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Risk Level</Text>
                    <View style={{
                      backgroundColor: `${getRiskConfig(selectedDisclosure.risk_assessment.risk_level).color}15`,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: borderRadius.sm,
                      alignSelf: 'flex-start',
                      marginTop: 4,
                    }}>
                      <Text style={{ 
                        color: getRiskConfig(selectedDisclosure.risk_assessment.risk_level).color,
                        fontWeight: '600',
                      }}>
                        {getRiskConfig(selectedDisclosure.risk_assessment.risk_level).label}
                      </Text>
                    </View>
                  </View>
                  {selectedDisclosure.risk_assessment.assessment_notes && (
                    <DetailRow label="Notes" value={selectedDisclosure.risk_assessment.assessment_notes} />
                  )}
                  <DetailRow label="Completed By" value={selectedDisclosure.risk_assessment.completed_by_name} />
                  <DetailRow label="Completed At" value={formatDate(selectedDisclosure.risk_assessment.completed_at)} />
                </View>
              )}

              {/* Support Plan (if active) */}
              {selectedDisclosure.support_plan && (
                <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Support Plan</Text>
                  
                  {selectedDisclosure.support_plan.support_services?.length > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>Services</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {selectedDisclosure.support_plan.support_services.map((service, idx) => (
                          <View key={idx} style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                            <Text style={{ fontSize: 12, color: colors.textPrimary }}>{service}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {selectedDisclosure.support_plan.plan_notes && (
                    <DetailRow label="Notes" value={selectedDisclosure.support_plan.plan_notes} />
                  )}
                  {selectedDisclosure.support_plan.follow_up_date && (
                    <DetailRow label="Follow-up Date" value={selectedDisclosure.support_plan.follow_up_date} />
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ gap: 12, marginBottom: 32 }}>
                {selectedDisclosure.status === 'pending_risk_assessment' && (
                  <TouchableOpacity
                    onPress={() => {
                      setDetailModalVisible(false);
                      setRiskModalVisible(true);
                    }}
                    style={actionButtonStyle(primaryColor)}
                  >
                    <Ionicons name="clipboard" size={20} color={colors.surface} />
                    <Text style={actionButtonTextStyle}>Complete Risk Assessment</Text>
                  </TouchableOpacity>
                )}

                {selectedDisclosure.status === 'risk_assessment_complete' && (
                  <TouchableOpacity
                    onPress={() => {
                      setDetailModalVisible(false);
                      setRiskModalVisible(true);
                    }}
                    style={actionButtonStyle(primaryColor)}
                  >
                    <Ionicons name="heart" size={20} color={colors.surface} />
                    <Text style={actionButtonTextStyle}>Add Support Plan</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setDetailModalVisible(false);
                    setForwardModalVisible(true);
                  }}
                  style={actionButtonStyle(colors.textPrimary)}
                >
                  <Ionicons name="mail" size={20} color={colors.surface} />
                  <Text style={actionButtonTextStyle}>Forward to Email</Text>
                </TouchableOpacity>

                {selectedDisclosure.status !== 'resolved' && (
                  <TouchableOpacity
                    onPress={() => {
                      setDetailModalVisible(false);
                      setResolveModalVisible(true);
                    }}
                    style={actionButtonStyle(primaryColor)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={colors.surface} />
                    <Text style={actionButtonTextStyle}>Mark as Resolved</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Forward Modal */}
      <Modal
        visible={forwardModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setForwardModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={modalHeaderStyle}>
              <TouchableOpacity onPress={() => setForwardModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Forward Disclosure</Text>
              <TouchableOpacity onPress={handleForward} disabled={forwardMutation.isPending}>
                {forwardMutation.isPending ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Send</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              <InputField 
                label="Recipient Email *" 
                value={forwardEmail} 
                onChangeText={setForwardEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <InputField 
                label="Recipient Name" 
                value={forwardName} 
                onChangeText={setForwardName}
                placeholder="Optional"
              />
              <InputField 
                label="Additional Notes" 
                value={forwardNotes} 
                onChangeText={setForwardNotes}
                placeholder="Any additional context..."
                multiline
              />
              
              {!selectedDisclosure?.is_anonymous && (
                <TouchableOpacity
                  onPress={() => setIncludeContact(!includeContact)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    padding: spacing.lg,
                    borderRadius: borderRadius.md,
                    marginTop: 16,
                  }}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: includeContact ? primaryColor : colors.border,
                    backgroundColor: includeContact ? primaryColor : colors.surface,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    {includeContact && <Ionicons name="checkmark" size={16} color={colors.surface} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '500' }}>Include Reporter Contact</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      Share reporter&apos;s name and contact info with recipient
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Risk Assessment Modal - Combined with Support Plan */}
      <Modal
        visible={riskModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRiskModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={modalHeaderStyle}>
              <TouchableOpacity onPress={() => setRiskModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Assessment</Text>
              <TouchableOpacity onPress={handleRiskAssessment} disabled={riskAssessmentMutation.isPending}>
                {riskAssessmentMutation.isPending ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              {/* Risk Level Section */}
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Risk Level</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {RISK_LEVELS.map(level => (
                  <TouchableOpacity
                    key={level.id}
                    onPress={() => setRiskLevel(level.id)}
                    style={{
                      backgroundColor: riskLevel === level.id ? level.color : colors.surface,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: level.color,
                    }}
                  >
                    <Text style={{ 
                      color: riskLevel === level.id ? colors.surface : level.color,
                      fontWeight: '600',
                    }}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <InputField 
                label="Assessment Notes" 
                value={riskNotes} 
                onChangeText={setRiskNotes}
                placeholder="Document your risk assessment..."
                multiline
              />

              {/* Support Plan Section */}
              <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Support Plan (Optional)</Text>
                
                <InputField 
                  label="Support Notes" 
                  value={supportNotes} 
                  onChangeText={setSupportNotes}
                  placeholder="Document the support plan..."
                  multiline
                />
                <InputField 
                  label="Follow-up Date" 
                  value={followUpDate} 
                  onChangeText={setFollowUpDate}
                  placeholder="DD-MM-YYYY"
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        visible={resolveModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setResolveModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={modalHeaderStyle}>
              <TouchableOpacity onPress={() => setResolveModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Resolve Disclosure</Text>
              <TouchableOpacity onPress={handleResolve} disabled={resolveMutation.isPending}>
                {resolveMutation.isPending ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Resolve</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              <InputField 
                label="Resolution Notes *" 
                value={resolutionNotes} 
                onChangeText={setResolutionNotes}
                placeholder="Document how this disclosure was resolved..."
                multiline
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Style helpers
const statBadgeStyle = (color, active) => ({
  backgroundColor: active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: borderRadius.md,
  marginRight: 8,
  alignItems: 'center',
  minWidth: 70,
  borderWidth: active ? 2 : 0,
  borderColor: colors.surface,
});

const statNumberStyle = {
  fontSize: 20,
  fontWeight: 'bold',
  color: colors.textInverse,
};

const statLabelStyle = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.8)',
  marginTop: 2,
};

const modalHeaderStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  backgroundColor: colors.surface,
};

const actionButtonStyle = (color) => ({
  backgroundColor: color,
  paddingVertical: 14,
  borderRadius: borderRadius.md,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
});

const actionButtonTextStyle = {
  color: colors.textInverse,
  fontSize: 16,
  fontWeight: '600',
  marginLeft: 8,
};

// Subcomponents
const DetailRow = ({ label, value, multiline }) => {
  if (!value) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 2 }}>{label}</Text>
      <Text style={{ 
        fontSize: 15, 
        color: colors.textPrimary, 
        textTransform: label === 'Type' ? 'capitalize' : 'none',
        lineHeight: multiline ? 22 : undefined,
      }}>
        {value}
      </Text>
    </View>
  );
};

const SafetyBadge = ({ label, active }) => (
  <View style={{
    backgroundColor: active ? colors.errorLight : colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  }}>
    <Ionicons 
      name={active ? 'checkmark-circle' : 'close-circle'} 
      size={16} 
      color={active ? colors.error : colors.textTertiary} 
    />
    <Text style={{ 
      fontSize: 13, 
      color: active ? colors.error : colors.textTertiary,
      marginLeft: 4,
      fontWeight: active ? '600' : '400',
    }}>
      {label}
    </Text>
  </View>
);

const InputField = ({ label, value, onChangeText, placeholder, multiline, ...props }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline={multiline}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: 14,
        fontSize: 16,
        minHeight: multiline ? 100 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
      {...props}
    />
  </View>
);
