import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateTime } from '../../utils/dateUtils';

import { borderRadius, spacing, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';
import { AnimatedScreen } from '../../components/AnimatedScreen';

const EMERGENCY_RED = '#D32F2F';
const EMERGENCY_DARK = '#B71C1C';

export default function AnnouncementsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [readAnnouncements, setReadAnnouncements] = useState({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('unread');

  React.useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(`read_announcements_${user?.id}`);
        if (stored) setReadAnnouncements(JSON.parse(stored));
      } catch {}
    })();
  }, [user?.id]);

  const markAsRead = async (announcementId) => {
    try {
      const next = { ...readAnnouncements, [announcementId]: true };
      setReadAnnouncements(next);
      await AsyncStorage.setItem(`read_announcements_${user?.id}`, JSON.stringify(next));
      try { await api.post(`${ENDPOINTS.ANNOUNCEMENTS}/${announcementId}/mark-read`); } catch {}
    } catch {}
  };

  const { data: announcements = [], isLoading: loadingAnn, refetch: refetchAnn, isRefetching: refetchingAnn } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.ANNOUNCEMENTS);
      return res.data;
    },
  });

  const { data: activeRollcalls = [], isLoading: loadingRC, refetch: refetchRC } = useQuery({
    queryKey: ['emergency-rollcalls-active'],
    queryFn: async () => {
      try {
        const res = await api.get(`${ENDPOINTS.EMERGENCY_ROLLCALL}/active`);
        return res.data || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ rollcallId, status }) => {
      const res = await api.post(`${ENDPOINTS.EMERGENCY_ROLLCALL}/${rollcallId}/respond`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-rollcalls-active'] });
    },
    onError: (err) => {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not record response. Please try again.');
    },
  });

  const handleRespond = (rollcallId, status) => {
    respondMutation.mutate({ rollcallId, status });
  };

  const rollcallByAnnId = useMemo(() => {
    const map = {};
    for (const rc of activeRollcalls) {
      map[rc.announcement_id] = rc;
    }
    return map;
  }, [activeRollcalls]);

  const unansweredRollcalls = useMemo(
    () => activeRollcalls.filter(rc => !rc.my_response),
    [activeRollcalls]
  );

  const isLoading = loadingAnn || loadingRC;

  const refetch = () => {
    refetchAnn();
    refetchRC();
  };

  const isRefetching = refetchingAnn;

  const filteredAndSorted = useMemo(() => {
    let list = [...announcements];

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.content?.toLowerCase().includes(q)
      );
    }

    const unread = list.filter(a => !readAnnouncements[a.id]);
    const read   = list.filter(a =>  readAnnouncements[a.id]);

    const byDate = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
    unread.sort(byDate);
    read.sort(byDate);

    return { unread, read };
  }, [announcements, readAnnouncements, searchText]);

  const displayList = activeTab === 'unread' ? filteredAndSorted.unread : filteredAndSorted.read;
  const unreadCount = filteredAndSorted.unread.length;
  const readCount   = filteredAndSorted.read.length;

  const renderEmergencyCard = (item, rollcall) => {
    const hasResponded = !!rollcall.my_response;
    const authorLine = [
      item.created_at ? formatDateTime(item.created_at) : null,
      item.author_name,
    ].filter(Boolean).join(' · ');

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.92}
        onPress={() => {
          setSelectedAnnouncement(item);
          setDetailModalVisible(true);
          if (!readAnnouncements[item.id]) markAsRead(item.id);
        }}
        style={{
          backgroundColor: EMERGENCY_RED,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          ...shadows.md,
        }}
      >
        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Ionicons name="warning" size={18} color="rgba(255,255,255,0.9)" />
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {hasResponded ? 'EMERGENCY — Response Recorded' : 'EMERGENCY — Response Required'}
            </Text>
          </View>

          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: spacing.xs }}>
            {item.title}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>
            {item.content}
          </Text>

          {hasResponded ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: borderRadius.md,
              padding: spacing.md,
            }}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                {rollcall.my_response === 'evacuated' ? 'You confirmed: I have evacuated' : 'You confirmed: Not at College'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.md }}>
                PLEASE CONFIRM YOUR STATUS IMMEDIATELY:
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    alignItems: 'center',
                    opacity: respondMutation.isPending ? 0.7 : 1,
                  }}
                  onPress={() => handleRespond(rollcall.id, 'evacuated')}
                  disabled={respondMutation.isPending}
                >
                  <Ionicons name="home" size={28} color="#2E7D32" />
                  <Text style={{ color: '#2E7D32', fontSize: 14, fontWeight: '700', marginTop: 6 }}>I have evacuated</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>I am outside</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    alignItems: 'center',
                    opacity: respondMutation.isPending ? 0.7 : 1,
                  }}
                  onPress={() => handleRespond(rollcall.id, 'not_at_college')}
                  disabled={respondMutation.isPending}
                >
                  <Ionicons name="shield-checkmark" size={28} color="#1565C0" />
                  <Text style={{ color: '#1565C0', fontSize: 14, fontWeight: '700', marginTop: 6 }}>Not at College</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>I am off-campus</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {authorLine ? (
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center', marginTop: spacing.md }}>
              Posted {authorLine}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderAnnouncement = ({ item }) => {
    const rollcall = rollcallByAnnId[item.id];
    if (rollcall) {
      return renderEmergencyCard(item, rollcall);
    }

    const isRead = readAnnouncements[item.id];
    const priorityColor = item.priority === 'high' ? colors.error : item.priority === 'medium' ? colors.warning : primaryColor;

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedAnnouncement(item);
          setDetailModalVisible(true);
          if (!isRead) markAsRead(item.id);
        }}
        style={{
          backgroundColor: isRead ? colors.surfaceSecondary : colors.surface,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          ...shadows.sm,
          borderLeftWidth: 3,
          borderLeftColor: priorityColor,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: isRead ? colors.textSecondary : colors.textPrimary, flex: 1 }}>
                  {item.title}
                </Text>
                {isRead && <Ionicons name="checkmark-circle" size={14} color={primaryColor} style={{ marginLeft: 8 }} />}
              </View>
              {(item.emergency || item.is_emergency) && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: colors.errorLight,
                  paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: 6, marginTop: 8, alignSelf: 'flex-start',
                }}>
                  <Ionicons name="warning" size={13} color={colors.error} />
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: '500', marginLeft: 4 }}>Emergency</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={{ fontSize: 14, color: isRead ? colors.textTertiary : colors.textSecondary, marginTop: spacing.md, lineHeight: 20 }} numberOfLines={2}>
            {item.content}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                {item.created_at ? formatDateTime(item.created_at) : 'Recently'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AnimatedScreen>
        {/* Hero Header */}
        <View style={{
          backgroundColor: primaryColor,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
          borderBottomLeftRadius: borderRadius.xxl,
          borderBottomRightRadius: borderRadius.xxl,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {navigation.canGoBack() ? (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="megaphone" size={22} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>News</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
                {unreadCount > 0 ? `${unreadCount} unread item${unreadCount !== 1 ? 's' : ''}` : `${announcements.length} announcement${announcements.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Emergency Banner */}
        {unansweredRollcalls.length > 0 && (
          <View style={{
            backgroundColor: EMERGENCY_RED,
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            flexDirection: 'row',
            alignItems: 'flex-start',
            ...shadows.sm,
          }}>
            <Ionicons name="warning" size={20} color="#fff" style={{ marginTop: 2, marginRight: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Emergency Roll Call Active</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                You must respond to the emergency below before it can be dismissed.
              </Text>
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceSecondary,
          marginHorizontal: spacing.lg,
          marginTop: spacing.lg,
          borderRadius: borderRadius.lg,
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search announcements..."
            placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: spacing.sm, fontSize: 14, color: colors.textPrimary }}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={{
          flexDirection: 'row',
          marginHorizontal: spacing.lg,
          marginTop: spacing.md,
          marginBottom: spacing.sm,
          backgroundColor: colors.surfaceSecondary,
          borderRadius: borderRadius.xl,
          padding: 4,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: borderRadius.lg,
              backgroundColor: activeTab === 'unread' ? colors.surface : 'transparent',
              ...(activeTab === 'unread' ? shadows.sm : {}),
            }}
            onPress={() => setActiveTab('unread')}
          >
            <Ionicons name="megaphone-outline" size={15} color={activeTab === 'unread' ? colors.textPrimary : colors.textTertiary} />
            <Text style={{ fontSize: 14, fontWeight: activeTab === 'unread' ? '600' : '400', color: activeTab === 'unread' ? colors.textPrimary : colors.textTertiary, marginLeft: 6 }}>
              Unread
            </Text>
            {unreadCount > 0 && (
              <View style={{ backgroundColor: primaryColor, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 6, paddingHorizontal: 5 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: borderRadius.lg,
              backgroundColor: activeTab === 'read' ? colors.surface : 'transparent',
              ...(activeTab === 'read' ? shadows.sm : {}),
            }}
            onPress={() => setActiveTab('read')}
          >
            <Ionicons name="archive-outline" size={15} color={activeTab === 'read' ? colors.textPrimary : colors.textTertiary} />
            <Text style={{ fontSize: 14, fontWeight: activeTab === 'read' ? '600' : '400', color: activeTab === 'read' ? colors.textPrimary : colors.textTertiary, marginLeft: 6 }}>
              Read ({readCount})
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={displayList}
          keyExtractor={(item, index) => item.id || `item-${index}`}
          renderItem={renderAnnouncement}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
              <Ionicons name="megaphone-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
                {activeTab === 'unread' ? 'Nothing unread' : 'No read items'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: spacing.xxl }}
        />
      </AnimatedScreen>

      {/* Announcement Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setDetailModalVisible(false); setSelectedAnnouncement(null); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 60 }} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Announcement</Text>
            <TouchableOpacity onPress={() => { setDetailModalVisible(false); setSelectedAnnouncement(null); }}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedAnnouncement && (
            <ScrollView style={{ flex: 1, padding: spacing.lg }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 }}>
                {(selectedAnnouncement.emergency || selectedAnnouncement.is_emergency) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.errorLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.lg }}>
                    <Ionicons name="warning" size={16} color={colors.error} />
                    <Text style={{ color: colors.error, fontWeight: '600', marginLeft: 4 }}>Emergency</Text>
                  </View>
                )}
                {selectedAnnouncement.priority && (
                  <View style={{ backgroundColor: `${selectedAnnouncement.priority === 'high' ? colors.error : primaryColor}20`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.lg }}>
                    <Text style={{ color: selectedAnnouncement.priority === 'high' ? colors.error : primaryColor, fontWeight: '600', textTransform: 'capitalize' }}>
                      {selectedAnnouncement.priority} Priority
                    </Text>
                  </View>
                )}
              </View>

              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 }}>
                {selectedAnnouncement.title}
              </Text>

              <View style={{ backgroundColor: colors.background, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, color: colors.textPrimary, lineHeight: 24 }}>
                  {selectedAnnouncement.content}
                </Text>
              </View>

              <View style={{ backgroundColor: colors.background, padding: spacing.lg, borderRadius: borderRadius.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 8 }}>
                    Posted: {selectedAnnouncement.created_at ? formatDateTime(selectedAnnouncement.created_at) : 'Recently'}
                  </Text>
                </View>
                {selectedAnnouncement.author_name && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 8 }}>
                      By: {selectedAnnouncement.author_name}
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
