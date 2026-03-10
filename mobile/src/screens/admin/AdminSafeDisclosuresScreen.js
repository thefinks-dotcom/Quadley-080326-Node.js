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
import AdminScreenHeader from '../../components/AdminScreenHeader';

const STATUS_OPTIONS = [
  { id: 'pending_risk_assessment', label: 'Pending', color: null },
  { id: 'risk_assessment_complete', label: 'Assessed', color: null },
  { id: 'support_plan_active', label: 'Support', color: null },
  { id: 'investigation', label: 'Review', color: colors.error },
  { id: 'resolved', label: 'Resolved', color: null },
  { id: 'appeal_under_review', label: 'Appeal', color: null },
  { id: 'appeal_resolved', label: 'Appeal Resolved', color: null },
];

const RISK_LEVELS = [
  { id: 'none', label: 'No Risk', color: colors.textSecondary },
  { id: 'low', label: 'Low Risk', color: null },
  { id: 'medium', label: 'Medium Risk', color: null },
  { id: 'high', label: 'High Risk', color: colors.error },
];

const INTERIM_MEASURE_TYPES = [
  'Alternative Accommodation',
  'Supervision Arrangement',
  'Contact Restriction',
  'Teaching Arrangement',
  'Other',
];

const getStatusConfig = (status, fallbackColor = colors.primary) => {
  const config = STATUS_OPTIONS.find(s => s.id === status) || { label: status, color: colors.textSecondary };
  return { ...config, color: config.color || fallbackColor };
};

const getRiskConfig = (level) => {
  return RISK_LEVELS.find(r => r.id === level) || { label: level, color: colors.textSecondary };
};

function DeadlineBadge({ disclosure }) {
  const deadline = disclosure.investigation_deadline;
  const isResolved = ['resolved', 'appeal_resolved'].includes(disclosure.status);
  if (!deadline || isResolved) return null;

  const now = new Date();
  const dl = new Date(deadline);
  const diffDays = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
        <Ionicons name="alert-circle" size={12} color="#B91C1C" />
        <Text style={{ fontSize: 10, color: '#B91C1C', fontWeight: '700', marginLeft: 3 }}>
          {Math.abs(diffDays)}d OVERDUE
        </Text>
      </View>
    );
  }
  if (diffDays <= 14) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
        <Ionicons name="time" size={12} color="#B45309" />
        <Text style={{ fontSize: 10, color: '#B45309', fontWeight: '600', marginLeft: 3 }}>
          {diffDays}d left
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
      <Ionicons name="time-outline" size={12} color="#065F46" />
      <Text style={{ fontSize: 10, color: '#065F46', fontWeight: '600', marginLeft: 3 }}>
        {diffDays}d left
      </Text>
    </View>
  );
}

export default function AdminSafeDisclosuresScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [selectedDisclosure, setSelectedDisclosure] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('details');

  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [riskModalVisible, setRiskModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);

  // Form states — existing
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

  // Respondent form
  const [respondentName, setRespondentName] = useState('');
  const [respondentUserId, setRespondentUserId] = useState('');

  // Interim measure form
  const [measureType, setMeasureType] = useState(INTERIM_MEASURE_TYPES[0]);
  const [measureDesc, setMeasureDesc] = useState('');

  // Case note form
  const [noteText, setNoteText] = useState('');

  // NSO form
  const [nsoReference, setNsoReference] = useState('');
  const [nsoNotes, setNsoNotes] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['safeDisclosures'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.SAFE_DISCLOSURE);
      return response.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['disclosureStats'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.SAFE_DISCLOSURE}/stats`);
      return response.data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['safeDisclosures'] });
    queryClient.invalidateQueries({ queryKey: ['disclosureStats'] });
  };

  const forwardMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.post(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/forward`, data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Disclosure forwarded successfully');
      setForwardModalVisible(false);
      resetForwardForm();
      invalidate();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to forward disclosure');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const response = await api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/status`, { status, notes });
      return response.data;
    },
    onSuccess: () => { invalidate(); },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    },
  });

  const riskAssessmentMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/risk-assessment`, data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Risk assessment completed');
      setRiskModalVisible(false);
      resetRiskForm();
      invalidate();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to complete risk assessment');
    },
  });

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
      invalidate();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to resolve disclosure');
    },
  });

  const respondentMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/respondent`, data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Saved', 'Respondent information recorded');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['safeDisclosures'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save respondent');
    },
  });

  const addMeasureMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.post(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/interim-measures`, data);
      return response.data;
    },
    onSuccess: (result) => {
      setMeasureType(INTERIM_MEASURE_TYPES[0]);
      setMeasureDesc('');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['safeDisclosures'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add measure');
    },
  });

  const removeMeasureMutation = useMutation({
    mutationFn: async ({ disclosureId, measureId }) => {
      const response = await api.delete(`${ENDPOINTS.SAFE_DISCLOSURE}/${disclosureId}/interim-measures/${measureId}`);
      return response.data;
    },
    onSuccess: () => { invalidate(); },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to remove measure');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }) => {
      const response = await api.post(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/notes`, { note, is_internal: true });
      return response.data;
    },
    onSuccess: () => {
      setNoteText('');
      invalidate();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add note');
    },
  });

  const escalateNSOMutation = useMutation({
    mutationFn: async ({ id, reference, notes }) => {
      const response = await api.post(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/escalate-nso`, { reference, notes });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Escalated', 'Case escalated to National Student Ombudsman');
      setNsoReference('');
      setNsoNotes('');
      invalidate();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to escalate to NSO');
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
    riskAssessmentMutation.mutate({
      id: selectedDisclosure.id,
      data: {
        risk_level: riskLevel,
        safety_measures: safetyMeasures,
        assessment_notes: riskNotes.trim() || null,
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

  const handleSaveRespondent = () => {
    if (!respondentName.trim()) {
      Alert.alert('Error', 'Please enter respondent name');
      return;
    }
    respondentMutation.mutate({
      id: selectedDisclosure.id,
      data: { respondent_name: respondentName.trim(), respondent_id: respondentUserId.trim() || null },
    });
  };

  const handleAddMeasure = () => {
    if (!measureDesc.trim()) {
      Alert.alert('Error', 'Please enter a description for this measure');
      return;
    }
    addMeasureMutation.mutate({
      id: selectedDisclosure.id,
      data: { measure_type: measureType, description: measureDesc.trim() },
    });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNoteMutation.mutate({ id: selectedDisclosure.id, note: noteText.trim() });
  };

  const handleEscalateNSO = () => {
    Alert.alert(
      'Escalate to NSO',
      'This will permanently record an escalation to the National Student Ombudsman. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          style: 'destructive',
          onPress: () => {
            escalateNSOMutation.mutate({
              id: selectedDisclosure.id,
              reference: nsoReference.trim(),
              notes: nsoNotes.trim(),
            });
          },
        },
      ]
    );
  };

  const openDetailModal = (disclosure) => {
    setSelectedDisclosure(disclosure);
    setRespondentName(disclosure.respondent_name || '');
    setRespondentUserId(disclosure.respondent_id || '');
    setActiveDetailTab('details');
    setDetailModalVisible(true);
  };

  const refreshSelected = useCallback(() => {
    if (!selectedDisclosure) return;
    const updated = (data || []).find(d => d.id === selectedDisclosure.id);
    if (updated) setSelectedDisclosure(updated);
  }, [selectedDisclosure, data]);

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

  // Pull current disclosure data from cache (for live updates inside modal)
  const liveDisclosure = selectedDisclosure
    ? (disclosures.find(d => d.id === selectedDisclosure.id) || selectedDisclosure)
    : null;

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const statBadgeStyle = (color, active) => ({
    backgroundColor: active ? color : colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 64,
  });

  const statNumberStyle = { fontSize: 20, fontWeight: '700', color: colors.textPrimary };
  const statLabelStyle = { fontSize: 11, color: colors.textSecondary, marginTop: 2 };

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

  const actionButtonStyle = (bg) => ({
    backgroundColor: bg,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  });

  const actionButtonTextStyle = { color: colors.textInverse, fontWeight: '600', fontSize: 15 };

  function DetailRow({ label, value, multiline }) {
    if (!value) return null;
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: multiline ? 20 : undefined }}>{value}</Text>
      </View>
    );
  }

  function SafetyBadge({ label, active }) {
    return (
      <View style={{
        backgroundColor: active ? '#FEE2E2' : colors.surfaceSecondary,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: borderRadius.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}>
        <Ionicons name={active ? 'warning' : 'checkmark'} size={12} color={active ? colors.error : colors.textTertiary} />
        <Text style={{ fontSize: 12, color: active ? colors.error : colors.textTertiary, fontWeight: active ? '600' : '400' }}>{label}</Text>
      </View>
    );
  }

  function InputField({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize }) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' }}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.lg,
            fontSize: 15,
            color: colors.textPrimary,
            minHeight: multiline ? 80 : undefined,
            textAlignVertical: multiline ? 'top' : undefined,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
      </View>
    );
  }

  const DETAIL_TABS = [
    { key: 'details', label: 'Details', icon: 'document-text-outline' },
    { key: 'respondent', label: 'Respondent', icon: 'person-outline' },
    { key: 'notes', label: 'Actions', icon: 'chatbubble-outline' },
    { key: 'nso', label: 'NSO', icon: 'shield-outline' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Safe Disclosures"
        subtitle={`${disclosures.length} total • ${stats?.urgent_count || 0} urgent`}
        onBack={() => navigation.goBack()}
      />

      {/* Stats Row */}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          {stats && (
            <>
              <TouchableOpacity onPress={() => setFilter('all')} style={statBadgeStyle(colors.textSecondary, filter === 'all')}>
                <Text style={statNumberStyle}>{disclosures.length}</Text>
                <Text style={statLabelStyle}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilter('pending_risk_assessment')} style={statBadgeStyle(primaryColor, filter === 'pending_risk_assessment')}>
                <Text style={statNumberStyle}>{stats.pending_risk_assessment}</Text>
                <Text style={statLabelStyle}>Pending</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilter('risk_assessment_complete')} style={statBadgeStyle(primaryColor, filter === 'risk_assessment_complete')}>
                <Text style={statNumberStyle}>{stats.risk_assessment_complete}</Text>
                <Text style={statLabelStyle}>Assessed</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilter('support_plan_active')} style={statBadgeStyle(primaryColor, filter === 'support_plan_active')}>
                <Text style={statNumberStyle}>{stats.support_plan_active}</Text>
                <Text style={statLabelStyle}>Support</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilter('investigation')} style={statBadgeStyle(colors.error, filter === 'investigation')}>
                <Text style={statNumberStyle}>{stats.investigation}</Text>
                <Text style={statLabelStyle}>Review</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilter('resolved')} style={statBadgeStyle(primaryColor, filter === 'resolved')}>
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
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: 32, alignItems: 'center' }}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 16 }}>No Disclosures</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
              {filter === 'all' ? 'No safe disclosures have been submitted yet.' : 'No disclosures match this filter.'}
            </Text>
          </View>
        ) : (
          filteredDisclosures.map(disclosure => {
            const statusConfig = getStatusConfig(disclosure.status, primaryColor);
            const isUrgent = disclosure.urgency === 'urgent' || disclosure.immediate_danger;
            const hasRespondent = !!disclosure.respondent_name;
            const hasMeasures = (disclosure.interim_measures || []).length > 0;
            const isNSOEscalated = !!disclosure.nso_escalated;

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
                  ...shadows.sm,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                      {isUrgent && (
                        <View style={{ backgroundColor: colors.errorLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="warning" size={12} color={colors.error} />
                          <Text style={{ fontSize: 10, color: colors.error, fontWeight: '600', marginLeft: 2 }}>URGENT</Text>
                        </View>
                      )}
                      {disclosure.is_anonymous && (
                        <View style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="eye-off" size={12} color={colors.secondary} />
                          <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500', marginLeft: 2 }}>Anonymous</Text>
                        </View>
                      )}
                      {isNSOEscalated && (
                        <View style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="shield-checkmark" size={12} color="#6D28D9" />
                          <Text style={{ fontSize: 10, color: '#6D28D9', fontWeight: '600', marginLeft: 2 }}>NSO</Text>
                        </View>
                      )}
                      {hasMeasures && (
                        <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, color: '#B45309', fontWeight: '600' }}>{disclosure.interim_measures.length} measure{disclosure.interim_measures.length !== 1 ? 's' : ''}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                      {disclosure.incident_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Incident'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: `${statusConfig.color}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md }}>
                    <Text style={{ fontSize: 11, color: statusConfig.color, fontWeight: '600' }}>{statusConfig.label}</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }} numberOfLines={2}>
                  {disclosure.description || 'No description provided'}
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  {disclosure.incident_date && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>{disclosure.incident_date}</Text>
                    </View>
                  )}
                  {disclosure.incident_location && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>{disclosure.incident_location}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>{formatDate(disclosure.created_at)}</Text>
                  </View>
                  <DeadlineBadge disclosure={disclosure} />
                </View>

                {/* Quick actions */}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {disclosure.status === 'pending_risk_assessment' && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); setSelectedDisclosure(disclosure); setRiskModalVisible(true); }}
                      style={{ backgroundColor: primaryColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Ionicons name="arrow-forward" size={14} color={colors.surface} />
                      <Text style={{ fontSize: 12, color: colors.textInverse, fontWeight: '600', marginLeft: 4 }}>Assess</Text>
                    </TouchableOpacity>
                  )}
                  {disclosure.status === 'risk_assessment_complete' && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); setSelectedDisclosure(disclosure); setRiskModalVisible(true); }}
                      style={{ backgroundColor: primaryColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Ionicons name="arrow-forward" size={14} color={colors.surface} />
                      <Text style={{ fontSize: 12, color: colors.textInverse, fontWeight: '600', marginLeft: 4 }}>Add Support</Text>
                    </TouchableOpacity>
                  )}
                  {(disclosure.status === 'support_plan_active' || disclosure.status === 'risk_assessment_complete') && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); setSelectedDisclosure(disclosure); setResolveModalVisible(true); }}
                      style={{ backgroundColor: primaryColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Ionicons name="checkmark-circle" size={14} color={colors.surface} />
                      <Text style={{ fontSize: 12, color: colors.textInverse, fontWeight: '600', marginLeft: 4 }}>Resolve</Text>
                    </TouchableOpacity>
                  )}
                  {disclosure.status !== 'resolved' && disclosure.status !== 'appeal_resolved' && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); setSelectedDisclosure(disclosure); setForwardModalVisible(true); }}
                      style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}
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

      {/* ── Detail Modal ── */}
      <Modal visible={detailModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Case Details</Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Tab Bar */}
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {DETAIL_TABS.map(tab => {
              const isActive = activeDetailTab === tab.key;
              const hasBadge =
                (tab.key === 'respondent' && liveDisclosure?.respondent_name) ||
                (tab.key === 'respondent' && (liveDisclosure?.interim_measures || []).length > 0) ||
                (tab.key === 'notes' && (liveDisclosure?.case_notes || []).length > 0) ||
                (tab.key === 'nso' && liveDisclosure?.nso_escalated);
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveDetailTab(tab.key)}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: isActive ? primaryColor : 'transparent' }}
                >
                  <Ionicons name={tab.icon} size={16} color={isActive ? primaryColor : colors.textTertiary} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: isActive ? '600' : '400', color: isActive ? primaryColor : colors.textTertiary }}>{tab.label}</Text>
                    {hasBadge && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: primaryColor, marginLeft: 3 }} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {liveDisclosure && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>

              {/* ── TAB: DETAILS ── */}
              {activeDetailTab === 'details' && (
                <>
                  {/* Status Banner */}
                  <View style={{ backgroundColor: `${getStatusConfig(liveDisclosure.status, primaryColor).color}15`, padding: 12, borderRadius: borderRadius.md, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getStatusConfig(liveDisclosure.status, primaryColor).color, marginRight: 8 }} />
                    <Text style={{ color: getStatusConfig(liveDisclosure.status, primaryColor).color, fontWeight: '600', flex: 1 }}>
                      Status: {getStatusConfig(liveDisclosure.status, primaryColor).label}
                    </Text>
                    {liveDisclosure.immediate_danger && (
                      <View style={{ backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                        <Text style={{ color: colors.textInverse, fontSize: 11, fontWeight: '700' }}>DANGER</Text>
                      </View>
                    )}
                  </View>

                  {/* Deadline countdown */}
                  {liveDisclosure.investigation_deadline && !['resolved', 'appeal_resolved'].includes(liveDisclosure.status) && (
                    <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="timer-outline" size={18} color={colors.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>45-day investigation deadline</Text>
                        <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '500', marginTop: 2 }}>
                          {new Date(liveDisclosure.investigation_deadline).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                      <DeadlineBadge disclosure={liveDisclosure} />
                    </View>
                  )}

                  {/* Incident Info */}
                  <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Incident Information</Text>
                    <DetailRow label="Type" value={liveDisclosure.incident_type?.replace(/_/g, ' ')} />
                    <DetailRow label="Date" value={liveDisclosure.incident_date} />
                    <DetailRow label="Location" value={liveDisclosure.incident_location} />
                    <DetailRow label="Description" value={liveDisclosure.description} multiline />
                    <DetailRow label="Individuals Involved" value={liveDisclosure.individuals_involved} />
                    {liveDisclosure.witness_present && <DetailRow label="Witness Details" value={liveDisclosure.witness_details} />}
                  </View>

                  {/* Safety Info */}
                  <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Safety Information</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <SafetyBadge label="Immediate Danger" active={liveDisclosure.immediate_danger} />
                      <SafetyBadge label="Medical Attention" active={liveDisclosure.medical_attention_needed} />
                      <SafetyBadge label="Police Notified" active={liveDisclosure.police_notified} />
                    </View>
                  </View>

                  {/* Reporter Info */}
                  {!liveDisclosure.is_anonymous && (
                    <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Reporter Information</Text>
                      <DetailRow label="Name" value={liveDisclosure.reporter_name} />
                      <DetailRow label="Email" value={liveDisclosure.reporter_email} />
                      <DetailRow label="Preferred Contact" value={liveDisclosure.preferred_contact} />
                    </View>
                  )}

                  {/* Risk Assessment */}
                  {liveDisclosure.risk_assessment && (
                    <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Risk Assessment</Text>
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>Risk Level</Text>
                        <View style={{ backgroundColor: `${getRiskConfig(liveDisclosure.risk_assessment.risk_level).color}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.sm, alignSelf: 'flex-start', marginTop: 4 }}>
                          <Text style={{ color: getRiskConfig(liveDisclosure.risk_assessment.risk_level).color, fontWeight: '600' }}>
                            {getRiskConfig(liveDisclosure.risk_assessment.risk_level).label}
                          </Text>
                        </View>
                      </View>
                      {liveDisclosure.risk_assessment.assessment_notes && <DetailRow label="Notes" value={liveDisclosure.risk_assessment.assessment_notes} />}
                      <DetailRow label="Completed By" value={liveDisclosure.risk_assessment.completed_by_name} />
                      <DetailRow label="Completed At" value={formatDate(liveDisclosure.risk_assessment.completed_at)} />
                    </View>
                  )}

                  {/* Support Plan */}
                  {liveDisclosure.support_plan && (
                    <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Support Plan</Text>
                      {liveDisclosure.support_plan.support_services?.length > 0 && (
                        <View style={{ marginBottom: 8 }}>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>Services</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {liveDisclosure.support_plan.support_services.map((service, idx) => (
                              <View key={idx} style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                <Text style={{ fontSize: 12, color: colors.textPrimary }}>{service}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                      {liveDisclosure.support_plan.plan_notes && <DetailRow label="Notes" value={liveDisclosure.support_plan.plan_notes} />}
                      {liveDisclosure.support_plan.follow_up_date && <DetailRow label="Follow-up Date" value={liveDisclosure.support_plan.follow_up_date} />}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={{ gap: 12, marginBottom: 32 }}>
                    {liveDisclosure.status === 'pending_risk_assessment' && (
                      <TouchableOpacity onPress={() => { setDetailModalVisible(false); setRiskModalVisible(true); }} style={actionButtonStyle(primaryColor)}>
                        <Ionicons name="clipboard" size={20} color={colors.surface} />
                        <Text style={actionButtonTextStyle}>Complete Risk Assessment</Text>
                      </TouchableOpacity>
                    )}
                    {liveDisclosure.status === 'risk_assessment_complete' && (
                      <TouchableOpacity onPress={() => { setDetailModalVisible(false); setRiskModalVisible(true); }} style={actionButtonStyle(primaryColor)}>
                        <Ionicons name="heart" size={20} color={colors.surface} />
                        <Text style={actionButtonTextStyle}>Add Support Plan</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => { setDetailModalVisible(false); setForwardModalVisible(true); }} style={actionButtonStyle(colors.textPrimary)}>
                      <Ionicons name="mail" size={20} color={colors.surface} />
                      <Text style={actionButtonTextStyle}>Forward to Email</Text>
                    </TouchableOpacity>
                    {liveDisclosure.status !== 'resolved' && liveDisclosure.status !== 'appeal_resolved' && (
                      <TouchableOpacity onPress={() => { setDetailModalVisible(false); setResolveModalVisible(true); }} style={actionButtonStyle(primaryColor)}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.surface} />
                        <Text style={actionButtonTextStyle}>Mark as Resolved</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {/* ── TAB: RESPONDENT ── */}
              {activeDetailTab === 'respondent' && (
                <>
                  {/* Respondent identity */}
                  <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>Respondent Identity</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>Record the identity of the respondent. They do not need to be a Quadley account holder.</Text>

                    {liveDisclosure.respondent_name ? (
                      <View style={{ backgroundColor: '#F0FDF4', borderRadius: borderRadius.md, padding: 12, marginBottom: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#15803D' }}>{liveDisclosure.respondent_name}</Text>
                        {liveDisclosure.respondent_recorded_at && (
                          <Text style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>
                            Recorded by {liveDisclosure.respondent_recorded_by} on {formatDate(liveDisclosure.respondent_recorded_at)}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={{ backgroundColor: '#FEF9C3', borderRadius: borderRadius.md, padding: 10, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="information-circle-outline" size={16} color='#854D0E' />
                        <Text style={{ fontSize: 13, color: '#854D0E' }}>No respondent recorded yet</Text>
                      </View>
                    )}

                    <InputField label="Respondent Name *" value={respondentName} onChangeText={setRespondentName} placeholder="Full name of the respondent" />
                    <InputField label="Quadley User ID (optional)" value={respondentUserId} onChangeText={setRespondentUserId} placeholder="Link to registered user if applicable" autoCapitalize="none" />

                    <TouchableOpacity
                      onPress={handleSaveRespondent}
                      disabled={respondentMutation.isPending || !respondentName.trim()}
                      style={{ backgroundColor: respondentName.trim() ? primaryColor : colors.border, borderRadius: borderRadius.md, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                      {respondentMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                        {liveDisclosure.respondent_name ? 'Update Respondent' : 'Record Respondent'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Interim Measures */}
                  <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>Interim Protective Measures</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>Document any interim measures imposed while the case is active.</Text>

                    {(liveDisclosure.interim_measures || []).length > 0 ? (
                      <View style={{ gap: 10, marginBottom: 20 }}>
                        {liveDisclosure.interim_measures.map(m => (
                          <View key={m.id} style={{ backgroundColor: '#FFF7ED', borderRadius: borderRadius.md, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E' }}>{m.measure_type}</Text>
                              <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 2 }}>{m.description}</Text>
                              <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>Imposed by {m.imposed_by_name} · {formatDate(m.recorded_at)}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert('Remove Measure', 'Remove this interim measure?', [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Remove', style: 'destructive', onPress: () => removeMeasureMutation.mutate({ disclosureId: liveDisclosure.id, measureId: m.id }) },
                                ]);
                              }}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="close-circle" size={20} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 10, marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>No interim measures recorded</Text>
                      </View>
                    )}

                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 }}>Add Measure</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                      {INTERIM_MEASURE_TYPES.map(t => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setMeasureType(t)}
                          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: measureType === t ? primaryColor : colors.surfaceSecondary }}
                        >
                          <Text style={{ fontSize: 13, color: measureType === t ? '#fff' : colors.textSecondary, fontWeight: '500' }}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <InputField label="Description" value={measureDesc} onChangeText={setMeasureDesc} placeholder="Describe the measure in detail..." multiline />
                    <TouchableOpacity
                      onPress={handleAddMeasure}
                      disabled={addMeasureMutation.isPending || !measureDesc.trim()}
                      style={{ backgroundColor: measureDesc.trim() ? '#D97706' : colors.border, borderRadius: borderRadius.md, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                      {addMeasureMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add-circle-outline" size={18} color="#fff" />}
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Add Measure</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── TAB: NOTES / ACTIONS ── */}
              {activeDetailTab === 'notes' && (
                <>
                  <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>Action Log</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>Internal case notes and timestamped action record.</Text>

                    {(liveDisclosure.case_notes || []).length === 0 ? (
                      <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, marginBottom: 16, alignItems: 'center' }}>
                        <Ionicons name="chatbubble-outline" size={24} color={colors.textTertiary} />
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>No notes recorded yet</Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10, marginBottom: 20 }}>
                        {[...(liveDisclosure.case_notes || [])].reverse().map(note => (
                          <View key={note.id} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12 }}>
                            <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 19 }}>{note.note}</Text>
                            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 6 }}>
                              {note.created_by_name} · {formatDate(note.created_at)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <InputField label="Add Note" value={noteText} onChangeText={setNoteText} placeholder="Record an action, decision, or update..." multiline />
                    <TouchableOpacity
                      onPress={handleAddNote}
                      disabled={addNoteMutation.isPending || !noteText.trim()}
                      style={{ backgroundColor: noteText.trim() ? primaryColor : colors.border, borderRadius: borderRadius.md, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                      {addNoteMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add-circle-outline" size={18} color="#fff" />}
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Add Note</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── TAB: NSO ESCALATION ── */}
              {activeDetailTab === 'nso' && (
                <>
                  <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Ionicons name="shield-checkmark-outline" size={22} color='#6D28D9' />
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>National Student Ombudsman</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>
                      Standard 5 — Cases meeting the threshold must be escalated to the National Student Ombudsman. Once recorded this cannot be undone.
                    </Text>

                    {liveDisclosure.nso_escalated ? (
                      <View style={{ backgroundColor: '#EDE9FE', borderRadius: borderRadius.md, padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Ionicons name="checkmark-circle" size={20} color='#6D28D9' />
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#4C1D95' }}>Escalated to NSO</Text>
                        </View>
                        <DetailRow label="Date" value={formatDate(liveDisclosure.nso_escalation_date)} />
                        <DetailRow label="Escalated By" value={liveDisclosure.nso_escalated_by_name} />
                        {liveDisclosure.nso_reference && <DetailRow label="NSO Reference" value={liveDisclosure.nso_reference} />}
                        {liveDisclosure.nso_notes && <DetailRow label="Notes" value={liveDisclosure.nso_notes} />}
                      </View>
                    ) : (
                      <>
                        <View style={{ backgroundColor: '#FEF9C3', borderRadius: borderRadius.md, padding: 10, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="information-circle-outline" size={16} color='#854D0E' />
                          <Text style={{ fontSize: 13, color: '#854D0E', flex: 1 }}>Not yet escalated to the National Student Ombudsman</Text>
                        </View>
                        <InputField label="NSO Reference Number (optional)" value={nsoReference} onChangeText={setNsoReference} placeholder="e.g. NSO-2026-00123" autoCapitalize="none" />
                        <InputField label="Notes (optional)" value={nsoNotes} onChangeText={setNsoNotes} placeholder="Context for the NSO referral..." multiline />
                        <TouchableOpacity
                          onPress={handleEscalateNSO}
                          disabled={escalateNSOMutation.isPending}
                          style={{ backgroundColor: '#6D28D9', borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                          {escalateNSOMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />}
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Escalate to National Student Ombudsman</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </>
              )}

            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Forward Modal ── */}
      <Modal visible={forwardModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setForwardModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={modalHeaderStyle}>
              <TouchableOpacity onPress={() => setForwardModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Forward Disclosure</Text>
              <TouchableOpacity onPress={handleForward} disabled={forwardMutation.isPending}>
                {forwardMutation.isPending ? <ActivityIndicator size="small" color={primaryColor} /> : <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Send</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              <InputField label="Recipient Email *" value={forwardEmail} onChangeText={setForwardEmail} placeholder="example@email.com" keyboardType="email-address" autoCapitalize="none" />
              <InputField label="Recipient Name" value={forwardName} onChangeText={setForwardName} placeholder="Optional" />
              <InputField label="Additional Notes" value={forwardNotes} onChangeText={setForwardNotes} placeholder="Any additional context..." multiline />
              {!selectedDisclosure?.is_anonymous && (
                <TouchableOpacity
                  onPress={() => setIncludeContact(!includeContact)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, marginTop: 16 }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: includeContact ? primaryColor : colors.border, backgroundColor: includeContact ? primaryColor : colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    {includeContact && <Ionicons name="checkmark" size={16} color={colors.surface} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '500' }}>Include Reporter Contact</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Share reporter's name and contact info with recipient</Text>
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Risk Assessment Modal ── */}
      <Modal visible={riskModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRiskModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={modalHeaderStyle}>
              <TouchableOpacity onPress={() => setRiskModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Assessment</Text>
              <TouchableOpacity onPress={handleRiskAssessment} disabled={riskAssessmentMutation.isPending}>
                {riskAssessmentMutation.isPending ? <ActivityIndicator size="small" color={primaryColor} /> : <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Save</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Risk Level</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {RISK_LEVELS.map(level => (
                  <TouchableOpacity
                    key={level.id}
                    onPress={() => setRiskLevel(level.id)}
                    style={{ backgroundColor: riskLevel === level.id ? level.color : colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: level.color }}
                  >
                    <Text style={{ color: riskLevel === level.id ? colors.surface : level.color, fontWeight: '600' }}>{level.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <InputField label="Assessment Notes" value={riskNotes} onChangeText={setRiskNotes} placeholder="Document your risk assessment..." multiline />
              <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Support Plan (Optional)</Text>
                <InputField label="Support Notes" value={supportNotes} onChangeText={setSupportNotes} placeholder="Document the support plan..." multiline />
                <InputField label="Follow-up Date" value={followUpDate} onChangeText={setFollowUpDate} placeholder="DD-MM-YYYY" />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Resolve Modal ── */}
      <Modal visible={resolveModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setResolveModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={modalHeaderStyle}>
              <TouchableOpacity onPress={() => setResolveModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Resolve Case</Text>
              <TouchableOpacity onPress={handleResolve} disabled={resolveMutation.isPending}>
                {resolveMutation.isPending ? <ActivityIndicator size="small" color={primaryColor} /> : <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Resolve</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 20 }}>
                Provide resolution notes to complete this case. The reporter's 20-business-day appeal window will open from this date.
              </Text>
              <InputField label="Resolution Notes *" value={resolutionNotes} onChangeText={setResolutionNotes} placeholder="Document how this case was resolved..." multiline />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
