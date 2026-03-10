import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';
import api from '../../services/api';
import AdminScreenHeader from '../../components/AdminScreenHeader';
import { spacing, borderRadius, shadows } from '../../theme';

const STATUS_COLORS = {
  open: { bg: '#FEF3C7', text: '#B45309' },
  resolved: { bg: '#D1FAE5', text: '#065F46' },
  content_removed: { bg: '#EDE9FE', text: '#6D28D9' },
  dismissed: { bg: '#F3F4F6', text: '#6B7280' },
};

const CATEGORY_LABELS = {
  harassment: 'Harassment',
  threats: 'Threats or violence',
  inappropriate: 'Inappropriate content',
  bullying: 'Bullying',
  spam: 'Spam',
  other: 'Other',
};

export default function AdminMessageReportsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('open');
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [killSwitchUser, setKillSwitchUser] = useState(null);

  const { data: reports = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminMessageReports', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await api.get(`/admin/message-reports${params}`);
      return res.data || [];
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ reportId, action }) => {
      const res = await api.put(`/admin/message-reports/${reportId}/action`, { action });
      return res.data;
    },
    onSuccess: (_, vars) => {
      const labels = { suspend: 'User suspended from messaging', warn: 'Warning issued', remove_message: 'Message removed', dismiss: 'Report dismissed' };
      Alert.alert('Done', labels[vars.action] || 'Action applied');
      setDetailVisible(false);
      queryClient.invalidateQueries({ queryKey: ['adminMessageReports'] });
    },
    onError: (err) => {
      Alert.alert('Error', err.response?.data?.detail || 'Action failed');
    },
  });

  const killSwitchMutation = useMutation({
    mutationFn: async (userId) => {
      const res = await api.put(`/admin/users/${userId}/messaging-suspend`);
      return res.data;
    },
    onSuccess: (data) => {
      Alert.alert(
        data.messaging_suspended ? 'Suspended' : 'Reinstated',
        data.message
      );
      queryClient.invalidateQueries({ queryKey: ['adminMessageReports'] });
    },
    onError: (err) => {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to toggle messaging access');
    },
  });

  const handleAction = (reportId, action, confirmMsg) => {
    Alert.alert('Confirm', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: action === 'dismiss' ? 'cancel' : 'destructive', onPress: () => actionMutation.mutate({ reportId, action }) },
    ]);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  };

  const openReports = reports.filter(r => r.status === 'open').length;

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <AdminScreenHeader
        title="Message Reports"
        subtitle={`${openReports} open report${openReports !== 1 ? 's' : ''}`}
        onBack={() => navigation.goBack()}
      />

      {/* Filter tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {[
          { key: 'open', label: 'Open' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'content_removed', label: 'Removed' },
          { key: 'all', label: 'All' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setFilter(tab.key)}
            style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: filter === tab.key ? primaryColor : 'transparent' }}
          >
            <Text style={{ fontSize: 13, fontWeight: filter === tab.key ? '600' : '400', color: filter === tab.key ? primaryColor : colors.textTertiary }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {reports.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: 32, alignItems: 'center' }}>
            <Ionicons name="flag-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 16 }}>No Reports</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
              No message reports match this filter.
            </Text>
          </View>
        ) : (
          reports.map(report => {
            const statusStyle = STATUS_COLORS[report.status] || STATUS_COLORS.open;
            const catLabel = CATEGORY_LABELS[report.category] || report.category;
            return (
              <TouchableOpacity
                key={report.id}
                onPress={() => { setSelectedReport(report); setDetailVisible(true); }}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  borderLeftWidth: 4,
                  borderLeftColor: report.status === 'open' ? '#EF4444' : colors.border,
                  ...shadows.sm,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{ backgroundColor: statusStyle.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: statusStyle.text }}>{report.status?.replace(/_/g, ' ').toUpperCase()}</Text>
                      </View>
                      <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, color: '#1D4ED8' }}>{catLabel}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                      Reported: {report.reported_user_name || report.reported_user_id}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                      By: {report.reporter_name || 'Anonymous'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </View>

                {report.message_content && (
                  <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: report.message_removed ? colors.textTertiary : colors.textPrimary, fontStyle: report.message_removed ? 'italic' : 'normal' }} numberOfLines={2}>
                      {report.message_content}
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{formatDate(report.created_at)}</Text>
                  {report.status === 'open' && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleAction(report.id, 'remove_message', 'Remove this message content? This cannot be undone.')}
                        style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                      >
                        <Text style={{ fontSize: 12, color: '#6D28D9', fontWeight: '600' }}>Remove</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleAction(report.id, 'suspend', `Suspend ${report.reported_user_name || 'this user'} from messaging?`)}
                        style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                      >
                        <Text style={{ fontSize: 12, color: '#B91C1C', fontWeight: '600' }}>Suspend</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={() => setDetailVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Report Detail</Text>
            <View style={{ width: 50 }} />
          </View>

          {selectedReport && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              {/* Status + category */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(() => {
                  const s = STATUS_COLORS[selectedReport.status] || STATUS_COLORS.open;
                  return (
                    <View style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: s.text }}>{selectedReport.status?.replace(/_/g, ' ').toUpperCase()}</Text>
                    </View>
                  );
                })()}
                <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                  <Text style={{ fontSize: 12, color: '#1D4ED8' }}>{CATEGORY_LABELS[selectedReport.category] || selectedReport.category}</Text>
                </View>
              </View>

              {/* Reported message */}
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Reported Message</Text>
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: selectedReport.message_removed ? colors.textTertiary : colors.textPrimary, fontStyle: selectedReport.message_removed ? 'italic' : 'normal' }}>
                    {selectedReport.message_content || 'Message content not available'}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textTertiary }}>Reported {formatDate(selectedReport.created_at)}</Text>
              </View>

              {/* Parties */}
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 }}>Parties</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '600', marginBottom: 4 }}>REPORTED USER</Text>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500' }}>{selectedReport.reported_user_name || selectedReport.reported_user_id}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: '#1D4ED8', fontWeight: '600', marginBottom: 4 }}>REPORTER</Text>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500' }}>{selectedReport.reporter_name || 'Anonymous'}</Text>
                  </View>
                </View>
              </View>

              {/* Details */}
              {selectedReport.details && (
                <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Additional Details</Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{selectedReport.details}</Text>
                </View>
              )}

              {/* Kill switch */}
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="toggle-outline" size={20} color={colors.textSecondary} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>Messaging Kill Switch</Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14 }}>
                  Immediately suspend or reinstate messaging access for {selectedReport.reported_user_name || 'this user'}. Takes effect on their next send attempt.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Toggle Messaging Access',
                      `Toggle messaging access for ${selectedReport.reported_user_name || 'this user'}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Toggle', onPress: () => killSwitchMutation.mutate(selectedReport.reported_user_id) },
                      ]
                    );
                  }}
                  disabled={killSwitchMutation.isPending}
                  style={{ backgroundColor: '#FEE2E2', borderRadius: borderRadius.md, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {killSwitchMutation.isPending
                    ? <ActivityIndicator size="small" color="#B91C1C" />
                    : <Ionicons name="toggle" size={20} color="#B91C1C" />}
                  <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 15 }}>Toggle Messaging Access</Text>
                </TouchableOpacity>
              </View>

              {/* Actions — only for open reports */}
              {selectedReport.status === 'open' && (
                <View style={{ gap: 10, marginBottom: 32 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>Take Action</Text>

                  <TouchableOpacity
                    onPress={() => handleAction(selectedReport.id, 'remove_message', 'Remove message content? This replaces content with a moderator notice but preserves the report record.')}
                    disabled={actionMutation.isPending}
                    style={{ backgroundColor: '#EDE9FE', borderRadius: borderRadius.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#6D28D9" />
                    <Text style={{ color: '#6D28D9', fontWeight: '600', fontSize: 15 }}>Remove Message Content</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleAction(selectedReport.id, 'suspend', `Suspend ${selectedReport.reported_user_name || 'this user'} from messaging?`)}
                    disabled={actionMutation.isPending}
                    style={{ backgroundColor: '#FEE2E2', borderRadius: borderRadius.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="ban-outline" size={18} color="#B91C1C" />
                    <Text style={{ color: '#B91C1C', fontWeight: '600', fontSize: 15 }}>Suspend User Messaging</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleAction(selectedReport.id, 'warn', `Issue a warning to ${selectedReport.reported_user_name || 'this user'}?`)}
                    disabled={actionMutation.isPending}
                    style={{ backgroundColor: '#FEF3C7', borderRadius: borderRadius.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="warning-outline" size={18} color="#B45309" />
                    <Text style={{ color: '#B45309', fontWeight: '600', fontSize: 15 }}>Issue Warning</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleAction(selectedReport.id, 'dismiss', 'Dismiss this report? The message will be unflagged.')}
                    disabled={actionMutation.isPending}
                    style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>Dismiss Report</Text>
                  </TouchableOpacity>

                  {actionMutation.isPending && (
                    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                      <ActivityIndicator size="small" color={primaryColor} />
                    </View>
                  )}
                </View>
              )}

              {/* Already actioned */}
              {selectedReport.status !== 'open' && selectedReport.actioned_at && (
                <View style={{ backgroundColor: '#D1FAE5', borderRadius: borderRadius.md, padding: 14, marginBottom: 32 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#065F46' }}>
                    Action: {selectedReport.action_taken?.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>
                    {formatDate(selectedReport.actioned_at)}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
