import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { format } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';

export default function RAIncidentReportingScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [activeTab, setActiveTab] = useState('reports');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [newIncident, setNewIncident] = useState({
    incident_type: '',
    severity: 'medium',
    location: '',
    description: '',
    residents_involved: '',
    action_taken: '',
    follow_up_required: false,
  });
  const queryClient = useQueryClient();

  // Fetch incident reports (safe disclosures visible to RA)
  const { data: incidents, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['raIncidents'],
    queryFn: async () => {
      const response = await api.get('/safe-disclosures');
      return response.data;
    },
  });

  // Fetch floor residents for quick reference
  const { data: floorResidents } = useQuery({
    queryKey: ['floorResidents'],
    queryFn: async () => {
      const response = await api.get('/floor/users');
      return response.data;
    },
  });

  const createIncident = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/safe-disclosures', {
        incident_type: data.incident_type,
        incident_location: data.location,
        description: `${data.description}\n\nResidents Involved: ${data.residents_involved}\n\nAction Taken: ${data.action_taken}`,
        is_anonymous: false,
        severity: data.severity,
        follow_up_required: data.follow_up_required,
      });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Incident report submitted');
      setModalVisible(false);
      setNewIncident({
        incident_type: '',
        severity: 'medium',
        location: '',
        description: '',
        residents_involved: '',
        action_taken: '',
        follow_up_required: false,
      });
      queryClient.invalidateQueries(['raIncidents']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit report');
    },
  });

  const incidentTypes = [
    { id: 'noise', label: 'Noise Complaint', icon: 'volume-high' },
    { id: 'safety', label: 'Safety Concern', icon: 'warning' },
    { id: 'conflict', label: 'Resident Conflict', icon: 'people' },
    { id: 'damage', label: 'Property Damage', icon: 'construct' },
    { id: 'policy', label: 'Policy Violation', icon: 'document-text' },
    { id: 'welfare', label: 'Welfare Check', icon: 'heart' },
    { id: 'emergency', label: 'Emergency', icon: 'alert-circle' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  const severityLevels = [
    { id: 'low', label: 'Low', color: primaryColor },
    { id: 'medium', label: 'Medium', color: primaryColor },
    { id: 'high', label: 'High', color: colors.error },
    { id: 'critical', label: 'Critical', color: colors.error },
  ];

  const handleSubmit = () => {
    if (!newIncident.incident_type || !newIncident.description.trim()) {
      Alert.alert('Error', 'Please select incident type and provide description');
      return;
    }
    createIncident.mutate(newIncident);
  };

  const getSeverityColor = (severity) => {
    const level = severityLevels.find(s => s.id === severity);
    return level?.color || colors.textSecondary;
  };

  const renderIncident = ({ item }) => (
    <TouchableOpacity
      onPress={() => setSelectedReport(item)}
      style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderLeftWidth: 4,
        borderLeftColor: getSeverityColor(item.severity || 'medium'),
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
            {item.incident_type || 'Incident Report'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
              {item.created_at ? format(new Date(item.created_at), 'MMM d, h:mm a') : 'Recently'}
            </Text>
            {item.status && (
              <View
                style={{
                  backgroundColor: item.status === 'resolved' ? primaryColor + '15' : primaryColor + '15',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: borderRadius.sm,
                  marginLeft: 8,
                }}
              >
                <Text style={{ fontSize: 11, color: item.status === 'resolved' ? primaryColor : primaryColor, fontWeight: '500' }}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }}>
      {/* Quick Actions */}
      <View style={{ flexDirection: 'row', padding: spacing.lg, gap: 12 }}>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            alignItems: 'center',
          }}
        >
          <Ionicons name="add-circle" size={28} color={colors.textInverse} />
          <Text style={{ color: colors.textInverse, fontWeight: '600', marginTop: 8 }}>New Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('RAFloorManagement')}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            alignItems: 'center',
            borderWidth: 2,
            borderColor: primaryColor,
          }}
        >
          <Ionicons name="people" size={28} color={primaryColor} />
          <Text style={{ color: colors.primary, fontWeight: '600', marginTop: 8 }}>Floor Residents</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, marginRight: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
            {incidents?.filter(i => i.status !== 'resolved').length || 0}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Open Reports</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, marginLeft: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: primaryColor }}>
            {floorResidents?.length || 0}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Floor Residents</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 }}>
        <TouchableOpacity
          onPress={() => setActiveTab('reports')}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            backgroundColor: activeTab === 'reports' ? primaryColor : colors.border,
            borderRadius: 20,
            marginRight: 8,
          }}
        >
          <Text style={{ color: activeTab === 'reports' ? colors.textInverse : colors.textSecondary, fontWeight: '500' }}>
            All Reports
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('open')}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            backgroundColor: activeTab === 'open' ? primaryColor : colors.border,
            borderRadius: 20,
          }}
        >
          <Text style={{ color: activeTab === 'open' ? colors.textInverse : colors.textSecondary, fontWeight: '500' }}>
            Open Only
          </Text>
        </TouchableOpacity>
      </View>

      {/* Incidents List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'open' ? incidents?.filter(i => i.status !== 'resolved') : incidents}
          keyExtractor={(item, index) => item.id || `item-${index}`}
          renderItem={renderIncident}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>No incident reports</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* New Incident Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>New Incident Report</Text>
              <TouchableOpacity onPress={handleSubmit} disabled={createIncident.isPending}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
                  {createIncident.isPending ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ flex: 1, padding: spacing.lg }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 100 }}
            >
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.md }}>
              Incident Type *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {incidentTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => setNewIncident({ ...newIncident, incident_type: type.id })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: newIncident.incident_type === type.id ? `${primaryColor}15` : colors.surfaceSecondary,
                    borderRadius: borderRadius.md,
                    borderWidth: 2,
                    borderColor: newIncident.incident_type === type.id ? primaryColor : 'transparent',
                  }}
                >
                  <Ionicons name={type.icon} size={18} color={newIncident.incident_type === type.id ? primaryColor : colors.textSecondary} />
                  <Text style={{ marginLeft: 6, color: newIncident.incident_type === type.id ? primaryColor : colors.textPrimary, fontWeight: newIncident.incident_type === type.id ? '600' : '400' }}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.md }}>
              Severity Level
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {severityLevels.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  onPress={() => setNewIncident({ ...newIncident, severity: level.id })}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    backgroundColor: newIncident.severity === level.id ? level.color : colors.surfaceSecondary,
                    borderRadius: borderRadius.md,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: newIncident.severity === level.id ? colors.textInverse : colors.textPrimary, fontWeight: '600' }}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Location</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="e.g., Room 204, Common Room"
              placeholderTextColor={colors.textTertiary}
              value={newIncident.location}
              onChangeText={(text) => setNewIncident({ ...newIncident, location: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Description *</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, height: 100, textAlignVertical: 'top', marginBottom: 16 }}
              multiline
              placeholder="Describe what happened..."
              placeholderTextColor={colors.textTertiary}
              value={newIncident.description}
              onChangeText={(text) => setNewIncident({ ...newIncident, description: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Residents Involved</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="Names or room numbers"
              placeholderTextColor={colors.textTertiary}
              value={newIncident.residents_involved}
              onChangeText={(text) => setNewIncident({ ...newIncident, residents_involved: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Action Taken</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, height: 80, textAlignVertical: 'top', marginBottom: 16 }}
              multiline
              placeholder="What actions did you take?"
              placeholderTextColor={colors.textTertiary}
              value={newIncident.action_taken}
              onChangeText={(text) => setNewIncident({ ...newIncident, action_taken: text })}
            />

            <TouchableOpacity
              onPress={() => setNewIncident({ ...newIncident, follow_up_required: !newIncident.follow_up_required })}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: primaryColor,
                  backgroundColor: newIncident.follow_up_required ? primaryColor : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                {newIncident.follow_up_required && <Ionicons name="checkmark" size={16} color={colors.textInverse} />}
              </View>
              <Text style={{ fontSize: 16, color: colors.textPrimary }}>Follow-up required</Text>
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Report Detail Modal */}
      <Modal visible={!!selectedReport} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedReport(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setSelectedReport(null)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Report Details</Text>
            <View style={{ width: 24 }} />
          </View>
          {selectedReport && (
            <ScrollView style={{ flex: 1, padding: spacing.lg }}>
              <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Incident Type</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                  {selectedReport.incident_type || 'Not specified'}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Description</Text>
                <Text style={{ fontSize: 16, color: colors.textPrimary }}>
                  {selectedReport.description}
                </Text>
              </View>
              {selectedReport.incident_location && (
                <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Location</Text>
                  <Text style={{ fontSize: 16, color: colors.textPrimary }}>
                    {selectedReport.incident_location}
                  </Text>
                </View>
              )}
              <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Submitted</Text>
                <Text style={{ fontSize: 16, color: colors.textPrimary }}>
                  {selectedReport.created_at ? format(new Date(selectedReport.created_at), 'MMMM d, yyyy h:mm a') : 'Unknown'}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Status</Text>
                <Text style={{ fontSize: 16, color: colors.textPrimary, textTransform: 'capitalize' }}>
                  {selectedReport.status || 'Pending'}
                </Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
