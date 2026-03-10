import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';

export default function AdminAnnouncementsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [modalVisible, setModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [selectedAnnouncementStats, setSelectedAnnouncementStats] = useState(null);
  const [selectedRollcall, setSelectedRollcall] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal',
    emergency: false,
    expires_at: '',
  });
  const queryClient = useQueryClient();

  const { data: announcements, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminAnnouncements'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.ANNOUNCEMENTS);
      return response.data;
    },
  });

  const { data: readStatsSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['announcementReadStats'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.ANNOUNCEMENTS}/read-stats/summary`);
      return response.data;
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: async (data) => {
      const payload = {
        title: data.title,
        content: data.content,
        priority: data.priority,
        is_emergency: data.emergency,
        target_audience: 'all',
      };
      // Add expiry date if provided
      if (data.expires_at && data.expires_at.trim()) {
        // Parse DD-MM-YYYY format to ISO
        const parts = data.expires_at.split('-');
        if (parts.length === 3) {
          const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}T23:59:59Z`;
          payload.expires_at = isoDate;
        }
      }
      const response = await api.post(ENDPOINTS.ANNOUNCEMENTS, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminAnnouncements']);
      queryClient.invalidateQueries(['announcements']);
      queryClient.invalidateQueries(['announcementReadStats']);
      setModalVisible(false);
      setNewAnnouncement({ title: '', content: '', priority: 'normal', emergency: false, expires_at: '' });
      Alert.alert('Success', 'News item posted');
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to post news item');
    },
  });

  const handleCreate = () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    createAnnouncement.mutate(newAnnouncement);
  };

  const openAnnouncementStats = async (item) => {
    setSelectedAnnouncement(item);
    setStatsModalVisible(true);
    setLoadingStats(true);
    setSelectedAnnouncementStats(null);
    setSelectedRollcall(null);

    try {
      const [statsRes, rollcallRes] = await Promise.allSettled([
        api.get(`${ENDPOINTS.ANNOUNCEMENTS}/${item.id}/read-stats`),
        item.is_emergency
          ? api.get(`${ENDPOINTS.EMERGENCY_ROLLCALL}/by-announcement/${item.id}`)
          : Promise.resolve(null),
      ]);

      if (statsRes.status === 'fulfilled') setSelectedAnnouncementStats(statsRes.value.data);
      else Alert.alert('Error', 'Failed to load read statistics');

      if (item.is_emergency && rollcallRes.status === 'fulfilled' && rollcallRes.value?.data) {
        const rc = rollcallRes.value.data;
        // Also fetch the full floor summary
        try {
          const summaryRes = await api.get(`${ENDPOINTS.EMERGENCY_ROLLCALL}/${rc.id}/summary`);
          setSelectedRollcall(summaryRes.data);
        } catch {
          setSelectedRollcall(rc);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load details');
    } finally {
      setLoadingStats(false);
    }
  };

  const priorities = ['low', 'normal', 'high'];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return colors.error;
      case 'normal': return primaryColor;
      default: return colors.textSecondary;
    }
  };

  const getReadCount = (announcementId) => {
    const stats = readStatsSummary?.find(s => s.id === announcementId);
    return stats?.read_count || 0;
  };

  const getReadPercentage = (announcementId) => {
    const stats = readStatsSummary?.find(s => s.id === announcementId);
    return stats?.read_percentage || 0;
  };

  const renderAnnouncement = ({ item }) => (
    <TouchableOpacity
      onPress={() => openAnnouncementStats(item)}
      activeOpacity={0.7}
      style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderLeftWidth: 4,
        borderLeftColor: getPriorityColor(item.priority),
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}
      data-testid={`announcement-${item.id}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1 }}>
          {item.title}
        </Text>
        {item.is_emergency && (
          <View style={{ backgroundColor: colors.errorLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm, marginLeft: 8 }}>
            <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>Emergency</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }} numberOfLines={2}>
        {item.content}
      </Text>
      
      {/* Read Stats Bar */}
      <View style={{ marginTop: 12, backgroundColor: colors.background, padding: 12, borderRadius: borderRadius.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="eye-outline" size={16} color={primaryColor} />
            <Text style={{ fontSize: 13, color: colors.textPrimary, marginLeft: 6, fontWeight: '500' }}>
              {getReadCount(item.id)} students read
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: primaryColor, fontWeight: '700' }}>
            {getReadPercentage(item.id)}%
          </Text>
        </View>
        <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3 }}>
          <View
            style={{
              height: 6,
              backgroundColor: primaryColor,
              borderRadius: 3,
              width: `${Math.min(getReadPercentage(item.id), 100)}%`,
            }}
          />
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: colors.textTertiary }}>
          {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy h:mm a') : 'Recently'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: primaryColor, fontWeight: '500' }}>View Details</Text>
          <Ionicons name="chevron-forward" size={14} color={primaryColor} style={{ marginLeft: 2 }} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Announcements"
        subtitle={`${announcements?.length || 0} news item${(announcements?.length || 0) !== 1 ? 's' : ''}`}
        onBack={() => navigation.goBack()}
        onAdd={() => setModalVisible(true)}
      />

      <FlatList
        data={announcements}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderAnnouncement}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); refetchSummary(); }} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
            <Ionicons name="megaphone-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>No news items yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 16 }}
      />

      {/* Create Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>New News Item</Text>
            <TouchableOpacity onPress={handleCreate} disabled={createAnnouncement.isPending}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                {createAnnouncement.isPending ? 'Posting...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Title *</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="News title"
              placeholderTextColor={colors.textTertiary}
              value={newAnnouncement.title}
              onChangeText={(text) => setNewAnnouncement({ ...newAnnouncement, title: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Priority</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              {priorities.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setNewAnnouncement({ ...newAnnouncement, priority: p })}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: newAnnouncement.priority === p ? getPriorityColor(p) : colors.surfaceSecondary,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: newAnnouncement.priority === p ? colors.surface : colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' }}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.errorLight, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="warning" size={20} color={colors.error} />
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.error, marginLeft: 8 }}>Emergency Alert</Text>
              </View>
              <Switch
                value={newAnnouncement.emergency}
                onValueChange={(value) => setNewAnnouncement({ ...newAnnouncement, emergency: value })}
                trackColor={{ false: colors.border, true: colors.error }}
                thumbColor={newAnnouncement.emergency ? colors.error : colors.textTertiary}
              />
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Content *</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, height: 150, textAlignVertical: 'top' }}
              multiline
              placeholder="News content..."
              placeholderTextColor={colors.textTertiary}
              value={newAnnouncement.content}
              onChangeText={(text) => setNewAnnouncement({ ...newAnnouncement, content: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8, marginTop: 16 }}>End Date (Optional)</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="DD-MM-YYYY"
              placeholderTextColor={colors.textTertiary}
              value={newAnnouncement.expires_at}
              onChangeText={(text) => setNewAnnouncement({ ...newAnnouncement, expires_at: text })}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: -12, marginBottom: 16 }}>
              News will be hidden after this date
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Individual Announcement Stats Modal */}
      <Modal
        visible={statsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Announcement Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {loadingStats ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading statistics...</Text>
            </View>
          ) : selectedAnnouncementStats ? (
            <ScrollView style={{ flex: 1 }}>
              {/* Announcement Content */}
              <View style={{ backgroundColor: colors.surface, padding: spacing.lg, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ 
                    width: 4, 
                    height: 24, 
                    backgroundColor: getPriorityColor(selectedAnnouncement?.priority), 
                    borderRadius: 2,
                    marginRight: 12 
                  }} />
                  <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>
                    {selectedAnnouncementStats.title}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 }}>
                  {selectedAnnouncement?.content}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                    {selectedAnnouncement?.created_at ? format(new Date(selectedAnnouncement.created_at), 'MMMM d, yyyy h:mm a') : ''}
                  </Text>
                </View>
              </View>

              {/* Stats Summary Cards */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: 20, marginRight: 8, alignItems: 'center', shadowColor: colors.textPrimary, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                  <Ionicons name="people" size={24} color={primaryColor} style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 36, fontWeight: '700', color: primaryColor }}>
                    {selectedAnnouncementStats.total_reads}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Students Read</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: 20, marginLeft: 8, alignItems: 'center', shadowColor: colors.textPrimary, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                  <Ionicons name="checkmark-circle" size={24} color={primaryColor} style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 36, fontWeight: '700', color: primaryColor }}>
                    {selectedAnnouncementStats.read_percentage}%
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Read Rate</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Read Progress</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      {selectedAnnouncementStats.total_reads} of {selectedAnnouncementStats.total_target_audience} students
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      {selectedAnnouncementStats.total_target_audience - selectedAnnouncementStats.total_reads} have not read
                    </Text>
                  </View>
                  <View style={{ height: 12, backgroundColor: colors.border, borderRadius: 6 }}>
                    <View
                      style={{
                        height: 12,
                        backgroundColor: primaryColor,
                        borderRadius: 6,
                        width: `${Math.min(selectedAnnouncementStats.read_percentage, 100)}%`,
                      }}
                    />
                  </View>
                </View>
              </View>

              {/* Readers List */}
              <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                  Who Read This ({selectedAnnouncementStats.readers?.length || 0})
                </Text>
                {selectedAnnouncementStats.readers?.length > 0 ? (
                  selectedAnnouncementStats.readers.map((reader, index) => (
                    <View
                      key={reader.user_id || index}
                      style={{
                        backgroundColor: colors.surface,
                        padding: 14,
                        borderRadius: borderRadius.md,
                        marginBottom: 8,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: 20, 
                          backgroundColor: primaryColor + '15', 
                          justifyContent: 'center', 
                          alignItems: 'center',
                          marginRight: 12
                        }}>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: primaryColor }}>
                            {(reader.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }}>
                            {reader.name || 'Unknown User'}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                            {reader.floor || 'No floor'} • {reader.email}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Ionicons name="checkmark-circle" size={22} color={primaryColor} />
                        <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                          {reader.read_at ? format(new Date(reader.read_at), 'MMM d, h:mm a') : ''}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ backgroundColor: colors.surface, padding: 32, borderRadius: borderRadius.lg, alignItems: 'center' }}>
                    <Ionicons name="eye-off-outline" size={40} color={colors.borderDark} />
                    <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 12 }}>No one has read this announcement yet</Text>
                  </View>
                )}
              </View>

              {/* Emergency Roll Call Summary */}
              {selectedAnnouncement?.is_emergency && selectedRollcall && (
                <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                    <Ionicons name="warning" size={18} color="#D32F2F" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#D32F2F', marginLeft: 8 }}>
                      Emergency Roll Call Responses
                    </Text>
                  </View>

                  {/* Status counts */}
                  <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
                    <View style={{ flex: 1, backgroundColor: '#E8F5E9', borderRadius: borderRadius.lg, padding: 16, alignItems: 'center' }}>
                      <Ionicons name="home" size={22} color="#2E7D32" />
                      <Text style={{ fontSize: 28, fontWeight: '700', color: '#2E7D32', marginTop: 4 }}>
                        {selectedRollcall.total_evacuated ?? selectedRollcall.evacuated ?? 0}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#2E7D32', textAlign: 'center', fontWeight: '600' }}>Evacuated</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#E3F2FD', borderRadius: borderRadius.lg, padding: 16, alignItems: 'center' }}>
                      <Ionicons name="shield-checkmark" size={22} color="#1565C0" />
                      <Text style={{ fontSize: 28, fontWeight: '700', color: '#1565C0', marginTop: 4 }}>
                        {selectedRollcall.total_not_at_college ?? selectedRollcall.not_at_college ?? 0}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#1565C0', textAlign: 'center', fontWeight: '600' }}>Not at College</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#FFF3E0', borderRadius: borderRadius.lg, padding: 16, alignItems: 'center' }}>
                      <Ionicons name="time" size={22} color="#E65100" />
                      <Text style={{ fontSize: 28, fontWeight: '700', color: '#E65100', marginTop: 4 }}>
                        {selectedRollcall.total_pending ?? selectedRollcall.pending ?? 0}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#E65100', textAlign: 'center', fontWeight: '600' }}>Pending</Text>
                    </View>
                  </View>

                  {/* Floor breakdown */}
                  {selectedRollcall.floors && Object.keys(selectedRollcall.floors).length > 0 && (
                    <>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>By Floor</Text>
                      {Object.entries(selectedRollcall.floors).map(([floor, data]) => {
                        const evacuated = data.evacuated?.length || 0;
                        const notAt = data.not_at_college?.length || 0;
                        const pending = data.pending?.length || 0;
                        const total = evacuated + notAt + pending;
                        return (
                          <View key={floor} style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{floor}</Text>
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{evacuated + notAt}/{total} responded</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <View style={{ flex: evacuated || 0.001, height: 8, backgroundColor: '#4CAF50', borderRadius: 4 }} />
                              <View style={{ flex: notAt || 0.001, height: 8, backgroundColor: '#2196F3', borderRadius: 4 }} />
                              <View style={{ flex: pending || 0.001, height: 8, backgroundColor: '#FF9800', borderRadius: 4 }} />
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}

                  {/* Pending students */}
                  {selectedRollcall.pending?.length > 0 && (
                    <>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#E65100', marginTop: 8, marginBottom: 8 }}>
                        Not yet responded ({selectedRollcall.pending.length})
                      </Text>
                      {selectedRollcall.pending.slice(0, 20).map((s, idx) => (
                        <View key={s.user_id || idx} style={{ backgroundColor: '#FFF3E0', borderRadius: borderRadius.md, padding: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="person-outline" size={16} color="#E65100" style={{ marginRight: 8 }} />
                          <Text style={{ fontSize: 14, color: colors.textPrimary, flex: 1 }}>{s.user_name}</Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{s.user_floor || 'No floor'}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Overall Report Modal */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setReportModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Read Statistics Report</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={{ flex: 1 }}>
            {/* Summary Stats */}
            <View style={{ padding: spacing.lg }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: 20, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>Overall Statistics</Text>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: '700', color: primaryColor }}>
                      {readStatsSummary?.length || 0}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Total News</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: '700', color: primaryColor }}>
                      {readStatsSummary ? Math.round(readStatsSummary.reduce((acc, s) => acc + s.read_percentage, 0) / (readStatsSummary.length || 1)) : 0}%
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Avg Read Rate</Text>
                  </View>
                </View>
              </View>

              {/* All News Stats */}
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                All News
              </Text>
              {readStatsSummary?.map((stat, index) => (
                <TouchableOpacity
                  key={stat.id || index}
                  onPress={() => {
                    const ann = announcements?.find(a => a.id === stat.id);
                    if (ann) {
                      setReportModalVisible(false);
                      setTimeout(() => openAnnouncementStats(ann), 300);
                    }
                  }}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.md,
                    padding: spacing.lg,
                    marginBottom: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                      {stat.title}
                    </Text>
                    <View style={{ 
                      backgroundColor: stat.read_percentage >= 50 ? primaryColor + '15' : stat.read_percentage >= 25 ? primaryColor + '15' : colors.errorLight,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: borderRadius.md,
                      marginLeft: 8
                    }}>
                      <Text style={{ 
                        fontSize: 13, 
                        fontWeight: '700',
                        color: stat.read_percentage >= 50 ? primaryColor : stat.read_percentage >= 25 ? primaryColor : colors.error
                      }}>
                        {stat.read_percentage}%
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 8 }}>
                    <View
                      style={{
                        height: 6,
                        backgroundColor: stat.read_percentage >= 50 ? primaryColor : stat.read_percentage >= 25 ? primaryColor : colors.error,
                        borderRadius: 3,
                        width: `${Math.min(stat.read_percentage, 100)}%`,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {stat.read_count} of {stat.total_target} read
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                      {stat.created_at ? format(new Date(stat.created_at), 'MMM d, yyyy') : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {(!readStatsSummary || readStatsSummary.length === 0) && (
                <View style={{ backgroundColor: colors.surface, padding: 32, borderRadius: borderRadius.lg, alignItems: 'center' }}>
                  <Ionicons name="document-text-outline" size={40} color={colors.borderDark} />
                  <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 12 }}>No news to report</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
