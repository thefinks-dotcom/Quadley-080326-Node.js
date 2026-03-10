import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';
import { formatDate, formatDateTime, DATE_FORMATS } from '../../utils/dateUtils';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';

export default function AdminServiceRequestsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const { data: requests, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminServiceRequests'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.MAINTENANCE);
      return response.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ requestId, status }) => {
      const response = await api.patch(`${ENDPOINTS.MAINTENANCE}/${requestId}`, { status });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Request status updated!');
      queryClient.invalidateQueries({ queryKey: ['adminServiceRequests'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    },
  });

  const prepareEmail = (request) => {
    const subject = `Service Request: ${request.title || request.issue_type || 'Maintenance Request'}`;
    const body = `SERVICE REQUEST DETAILS
━━━━━━━━━━━━━━━━━━━━━━

Title: ${request.title || request.issue_type || 'N/A'}
Category: ${request.category || request.issue_type || 'N/A'}
Status: ${(request.status || 'pending').replace('_', ' ')}
Priority: ${request.priority || 'Normal'}

Submitted By: ${request.submitted_by_name || request.student_name || 'Unknown'}
Room/Location: ${request.room_number || request.location || 'Not specified'}
Date Submitted: ${request.created_at ? formatDateTime(request.created_at) : 'Recently'}

DESCRIPTION:
${request.description || 'No description provided'}

━━━━━━━━━━━━━━━━━━━━━━
Request ID: ${request.id}
`;
    
    setSelectedRequest(request);
    setEmailSubject(subject);
    setEmailBody(body);
    setEmailTo('');
    setShowEmailModal(true);
  };

  const sendEmail = () => {
    if (!emailTo.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    const mailtoUrl = `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    Linking.canOpenURL(mailtoUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(mailtoUrl);
          setShowEmailModal(false);
          handleStatusChange(selectedRequest);
        } else {
          Alert.alert('Error', 'Email is not supported on this device');
        }
      })
      .catch((err) => {
        console.error('Error opening email:', err);
        Alert.alert('Error', 'Could not open email app');
      });
  };

  const handleRequestAction = (request) => {
    Alert.alert(
      'Service Request',
      `What would you like to do?`,
      [
        {
          text: 'Update Status',
          onPress: () => handleStatusChange(request),
        },
        {
          text: 'Email Someone',
          onPress: () => prepareEmail(request),
        },
        {
          text: 'View Details',
          onPress: () => showRequestDetails(request),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const showRequestDetails = (request) => {
    Alert.alert(
      request.title || request.issue_type || 'Service Request',
      `Category: ${request.category || request.issue_type || 'N/A'}
Status: ${(request.status || 'pending').replace('_', ' ')}
Priority: ${request.priority || 'Normal'}

Submitted By: ${request.submitted_by_name || request.student_name || 'Unknown'}
Room: ${request.room_number || 'N/A'}
Date: ${request.created_at ? formatDate(request.created_at) : 'Recently'}

Description:
${request.description || 'No description'}`,
      [{ text: 'OK' }]
    );
  };

  const handleStatusChange = (request) => {
    const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    Alert.alert(
      'Update Status',
      `Select new status for this request`,
      [
        ...statuses.map((status) => ({
          text: status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1),
          onPress: () => updateStatus.mutate({ requestId: request.id, status }),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return primaryColor;
      case 'in_progress': return primaryColor;
      case 'completed': return primaryColor;
      case 'cancelled': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return colors.error;
      case 'high': return primaryColor;
      default: return colors.textSecondary;
    }
  };

  const renderRequest = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleRequestAction(item)}
      style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
      }}
      data-testid={`service-request-${item.id}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
            {item.title || item.issue_type || 'Service Request'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
            <View style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, textTransform: 'capitalize' }}>{item.category || item.issue_type}</Text>
            </View>
            {item.priority && item.priority !== 'normal' && (
              <View style={{ backgroundColor: `${getPriorityColor(item.priority)}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                <Text style={{ color: getPriorityColor(item.priority), fontSize: 12, fontWeight: '500', textTransform: 'capitalize' }}>
                  {item.priority}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ backgroundColor: `${getStatusColor(item.status)}20`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.md }}>
          <Text style={{ color: getStatusColor(item.status), fontWeight: '500', fontSize: 12, textTransform: 'capitalize' }}>
            {item.status?.replace('_', ' ')}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 10 }} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: colors.textTertiary }}>
          By: {item.submitted_by_name || item.student_name || 'Unknown'}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textTertiary }}>
          {item.created_at ? formatDate(item.created_at) : 'Recently'}
        </Text>
      </View>
      {/* Quick action hint */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.surfaceSecondary }}>
        <Ionicons name="hand-left-outline" size={14} color={colors.textTertiary} />
        <Text style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 4 }}>
          Tap for options: Update Status, Email, View Details
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;
  const inProgressCount = requests?.filter(r => r.status === 'in_progress').length || 0;

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests?.filter(r => r.status === statusFilter);

  const FILTER_TABS = [
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'in_progress', label: 'In Progress', count: inProgressCount },
    { key: 'all', label: 'All', count: requests?.length || 0 },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Service Requests"
        subtitle={`${pendingCount} pending · ${requests?.length || 0} total`}
        onBack={() => navigation.goBack()}
      />

      {/* Filter Tabs */}
      <View style={{
        flexDirection: 'row',
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        backgroundColor: colors.surfaceSecondary,
        borderRadius: borderRadius.md,
        padding: 3,
      }}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setStatusFilter(tab.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 8,
              borderRadius: borderRadius.sm,
              backgroundColor: statusFilter === tab.key ? colors.surface : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: statusFilter === tab.key ? colors.textPrimary : colors.textTertiary,
            }}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={{
                backgroundColor: statusFilter === tab.key ? primaryColor + '20' : 'transparent',
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 8,
                marginLeft: 4,
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: statusFilter === tab.key ? primaryColor : colors.textTertiary,
                }}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredRequests}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderRequest}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
            <Ionicons name="construct-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
              {statusFilter === 'pending' ? 'No pending requests' : statusFilter === 'in_progress' ? 'No requests in progress' : 'No service requests'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 16 }}
      />

      {/* Email Modal */}
      <Modal visible={showEmailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: spacing.lg,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity onPress={() => setShowEmailModal(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>
              Email Request
            </Text>
            <TouchableOpacity onPress={sendEmail} data-testid="send-email-btn">
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Send</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
            {/* To Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                To:
              </Text>
              <TextInput
                value={emailTo}
                onChangeText={setEmailTo}
                placeholder="Enter email address"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                data-testid="email-to-input"
              />
            </View>

            {/* Subject Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                Subject:
              </Text>
              <TextInput
                value={emailSubject}
                onChangeText={setEmailSubject}
                placeholder="Email subject"
                placeholderTextColor={colors.textTertiary}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                data-testid="email-subject-input"
              />
            </View>

            {/* Body Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                Message:
              </Text>
              <TextInput
                value={emailBody}
                onChangeText={setEmailBody}
                placeholder="Email content"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={15}
                textAlignVertical="top"
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 300,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                }}
                data-testid="email-body-input"
              />
            </View>

            {/* Info Box */}
            <View
              style={{
                backgroundColor: primaryColor + '15',
                borderRadius: borderRadius.md,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <Ionicons name="information-circle" size={20} color={primaryColor} style={{ marginRight: 10, marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 13, color: primaryColor, lineHeight: 18 }}>
                Tapping "Send" will open your default email app with this content pre-filled. You can edit before sending.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
