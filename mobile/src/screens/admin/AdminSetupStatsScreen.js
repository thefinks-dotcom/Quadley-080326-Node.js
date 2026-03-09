import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { formatDate, DATE_FORMATS } from '../../utils/dateUtils';
import { generateReportCSV, exportAsCSV, getExportFilename } from '../../utils/exportUtils';
import { useTenant } from '../../contexts/TenantContext';

export default function AdminSetupStatsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [refreshing, setRefreshing] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(null);
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['setupStats'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.ADMIN_USERS}/setup-stats`.replace('/users', ''));
      return response.data;
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await api.post(`${ENDPOINTS.ADMIN_USERS}/resend-invite/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Invitation email resent successfully');
      queryClient.invalidateQueries(['setupStats']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to resend invitation');
    },
  });

  const [sendingReminders, setSendingReminders] = useState(false);

  const handleSendReminders = async () => {
    Alert.alert(
      'Send Setup Reminders',
      'This will send reminder emails to all users who were invited 3+ days ago and haven\'t completed their account setup.\n\nUsers will only receive one reminder per 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reminders',
          onPress: async () => {
            setSendingReminders(true);
            try {
              const response = await api.post(`${ENDPOINTS.ADMIN_USERS}/send-setup-reminders`.replace('/users', ''), null, {
                params: { min_days: 3 }
              });
              const data = response.data;
              
              if (data.reminders_sent > 0) {
                Alert.alert(
                  'Reminders Sent',
                  `Successfully sent ${data.reminders_sent} reminder email(s).\n\n${data.skipped_expired > 0 ? `Skipped ${data.skipped_expired} expired invitations.\n` : ''}${data.failed > 0 ? `Failed to send ${data.failed} email(s).` : ''}`,
                  [{ text: 'OK' }]
                );
              } else if (data.total_found === 0) {
                Alert.alert('No Reminders Needed', 'All pending users were either invited recently or have already received a reminder in the last 24 hours.');
              } else {
                Alert.alert('No Reminders Sent', `Found ${data.total_found} pending users but couldn\'t send reminders. ${data.skipped_expired} had expired invitations.`);
              }
              
              queryClient.invalidateQueries(['setupStats']);
            } catch (error) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to send reminders');
            } finally {
              setSendingReminders(false);
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    if (!stats) {
      Alert.alert('No Data', 'No data available to export');
      return;
    }
    
    setExporting(true);
    try {
      const sections = [
        {
          title: 'Account Setup Summary',
          type: 'stats',
          data: {
            'Total Invited': stats.summary?.total_invited || 0,
            'Completed Setup': stats.summary?.completed_setup || 0,
            'Pending Setup': stats.summary?.pending_setup || 0,
            'Completion Rate': `${stats.summary?.completion_rate || 0}%`,
            'Self Registered': stats.summary?.self_registered || 0,
            'Expired Invitations': stats.summary?.expired_invitations || 0,
          }
        },
        {
          title: 'Recent Activity',
          type: 'stats',
          data: {
            'Completions Last 7 Days': stats.recent_activity?.completions_last_7_days || 0,
            'Completions Last 30 Days': stats.recent_activity?.completions_last_30_days || 0,
          }
        },
        {
          title: 'Users by Role',
          type: 'breakdown',
          data: stats.role_breakdown || {}
        },
      ];
      
      // Add pending users if any
      if (stats.pending_users && stats.pending_users.length > 0) {
        sections.push({
          title: 'Pending Users',
          type: 'table',
          headers: ['first_name', 'last_name', 'email', 'floor', 'room', 'invited_at'],
          data: stats.pending_users
        });
      }
      
      const csvContent = generateReportCSV(sections);
      const filename = getExportFilename('setup_statistics');
      await exportAsCSV(csvContent, filename);
    } catch (error) {
      Alert.alert('Export Failed', error.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const handleResendInvite = async (userId) => {
    setResendingInvite(userId);
    try {
      await resendInviteMutation.mutateAsync(userId);
    } finally {
      setResendingInvite(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatLocalDate = (dateString) => {
    if (!dateString) return 'N/A';
    return formatDate(dateString);
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading setup statistics...</Text>
      </SafeAreaView>
    );
  }

  const summary = stats?.summary || {};
  const recentActivity = stats?.recent_activity || {};
  const roleBreakdown = stats?.role_breakdown || {};
  const pendingUsers = stats?.pending_users || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} edges={['bottom']}>
      {/* Header with Export */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'flex-end', 
        paddingHorizontal: 16, 
        paddingTop: 8,
        paddingBottom: 4,
      }}>
        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting || isLoading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: exporting ? colors.textTertiary : primaryColor,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
          }}
          data-testid="export-setup-stats-btn"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Ionicons name="download-outline" size={18} color={colors.surface} />
          )}
          <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6, fontSize: 14 }}>
            Export CSV
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.lg }}
      >
        {/* Header Card with Completion Rate */}
        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            padding: spacing.xxl,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8 }}>
            Account Setup Completion
          </Text>
          
          {/* Progress Circle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.textInverse, fontSize: 48, fontWeight: 'bold' }}>
                {summary.completion_rate || 0}%
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                Completion Rate
              </Text>
            </View>
            
            {/* Mini Stats */}
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: primaryColor,
                    marginRight: 8,
                  }}
                />
                <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600' }}>
                  {summary.completed_setup || 0}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 4 }}>
                  Completed
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: primaryColor,
                    marginRight: 8,
                  }}
                />
                <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600' }}>
                  {summary.pending_setup || 0}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 4 }}>
                  Pending
                </Text>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View
            style={{
              height: 8,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 4,
              marginTop: 20,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${summary.completion_rate || 0}%`,
                backgroundColor: primaryColor,
                borderRadius: 4,
              }}
            />
          </View>

          {/* Send Reminders Button */}
          {(summary.pending_setup || 0) > 0 && (
            <TouchableOpacity
              onPress={handleSendReminders}
              disabled={sendingReminders}
              style={{
                marginTop: 16,
                backgroundColor: sendingReminders ? 'rgba(255,255,255,0.3)' : primaryColor,
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: borderRadius.md,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              data-testid="send-reminders-btn"
            >
              {sendingReminders ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={18} color={colors.surface} />
                  <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 8 }}>
                    Send Reminder Emails
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Grid - Clickable boxes */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 }}>
          {/* Total Invited - Clickable */}
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminUsers')}
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
            data-testid="stat-total-invited"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.md,
                backgroundColor: primaryColor + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Ionicons name="mail-outline" size={20} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary }}>
              {summary.total_invited || 0}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Total Invited</Text>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>Tap to view users</Text>
          </TouchableOpacity>

          {/* Self Registered - Clickable */}
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminUsers')}
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
            data-testid="stat-self-registered"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.md,
                backgroundColor: primaryColor + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Ionicons name="person-add-outline" size={20} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary }}>
              {summary.self_registered || 0}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Self Registered</Text>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>Tap to view users</Text>
          </TouchableOpacity>

          {/* Expired Invitations - Clickable to show pending modal */}
          <TouchableOpacity
            onPress={() => setShowPendingModal(true)}
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
            data-testid="stat-expired-invites"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.md,
                backgroundColor: colors.errorLight,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Ionicons name="time-outline" size={20} color={colors.error} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary }}>
              {summary.expired_invitations || 0}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Expired Invites</Text>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>Tap to view pending</Text>
          </TouchableOpacity>

          {/* Recent Completions - Clickable */}
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminUsers')}
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
            data-testid="stat-recent-completions"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.md,
                backgroundColor: primaryColor + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Ionicons name="trending-up" size={20} color={colors.warning} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary }}>
              {recentActivity.completions_last_7_days || 0}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Last 7 Days</Text>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>Tap to view users</Text>
          </TouchableOpacity>
        </View>

        {/* Role Breakdown */}
        {Object.keys(roleBreakdown).length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: 16,
              shadowColor: colors.textPrimary,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>
              Users by Role
            </Text>
            {Object.entries(roleBreakdown).map(([role, count]) => (
              <View
                key={role}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surfaceSecondary,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={role === 'admin' || role === 'super_admin' ? 'shield' : role === 'ra' ? 'ribbon' : 'person'}
                    size={18}
                    color={role === 'admin' || role === 'super_admin' ? primaryColor : role === 'ra' ? primaryColor : primaryColor}
                  />
                  <Text style={{ fontSize: 14, color: colors.textPrimary, marginLeft: 10, textTransform: 'capitalize' }}>
                    {role.replace('_', ' ')}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pending Users Button */}
        {pendingUsers.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowPendingModal(true)}
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: colors.textPrimary,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
            data-testid="view-pending-users-btn"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: borderRadius.md,
                  backgroundColor: primaryColor + '15',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="hourglass-outline" size={22} color={colors.warning} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                  Pending Setup Users
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  {pendingUsers.length} users waiting to complete setup
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Recent Activity Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>
            Recent Activity
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: primaryColor }}>
                {recentActivity.completions_last_7_days || 0}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Last 7 Days</Text>
            </View>
            <View
              style={{
                width: 1,
                backgroundColor: colors.border,
                marginHorizontal: spacing.lg,
              }}
            />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: primaryColor }}>
                {recentActivity.completions_last_30_days || 0}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Last 30 Days</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Pending Users Modal */}
      <Modal visible={showPendingModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
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
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
              Pending Setup ({pendingUsers.length})
            </Text>
            <TouchableOpacity onPress={() => setShowPendingModal(false)}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={pendingUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.lg }}
            renderItem={({ item }) => {
              const expired = isExpired(item.setup_token_expires);
              return (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.md,
                    padding: spacing.lg,
                    marginBottom: spacing.md,
                    shadowColor: colors.textPrimary,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                        {item.first_name} {item.last_name}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                        {item.email}
                      </Text>
                      {item.floor && (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                          Floor: {item.floor} {item.room ? `• Room: ${item.room}` : ''}
                        </Text>
                      )}
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
                        Invited: {formatDate(item.invited_at)}
                      </Text>
                    </View>
                    {expired && (
                      <View
                        style={{
                          backgroundColor: colors.errorLight,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: borderRadius.sm,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: colors.error, fontWeight: '600' }}>
                          EXPIRED
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Resend Invite Button */}
                  <TouchableOpacity
                    onPress={() => handleResendInvite(item.id)}
                    disabled={resendingInvite === item.id}
                    style={{
                      marginTop: 12,
                      backgroundColor: expired ? colors.error : primaryColor,
                      paddingVertical: 10,
                      borderRadius: borderRadius.sm,
                      alignItems: 'center',
                      opacity: resendingInvite === item.id ? 0.7 : 1,
                    }}
                    data-testid={`resend-invite-${item.id}`}
                  >
                    {resendingInvite === item.id ? (
                      <ActivityIndicator size="small" color={colors.surface} />
                    ) : (
                      <Text style={{ color: colors.textInverse, fontWeight: '600' }}>
                        {expired ? 'Resend Expired Invite' : 'Resend Invitation'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="checkmark-circle" size={48} color={primaryColor} />
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
                  All users have completed setup!
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
