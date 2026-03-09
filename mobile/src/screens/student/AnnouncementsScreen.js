import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { formatDate, formatDateTime, DATE_FORMATS } from '../../utils/dateUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, borderRadius, spacing, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';
import { AnimatedScreen } from '../../components/AnimatedScreen';

export default function AnnouncementsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [readAnnouncements, setReadAnnouncements] = useState({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const loadReadStatus = async () => {
    try {
      const stored = await AsyncStorage.getItem(`read_announcements_${user?.id}`);
      if (stored) {
        setReadAnnouncements(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading read status:', error);
    }
  };

  // Load read status from local storage on mount
  React.useEffect(() => {
    loadReadStatus();
  }, [user?.id]);

  const markAsRead = async (announcementId) => {
    try {
      const newReadStatus = { ...readAnnouncements, [announcementId]: true };
      setReadAnnouncements(newReadStatus);
      await AsyncStorage.setItem(`read_announcements_${user?.id}`, JSON.stringify(newReadStatus));
      
      // Optionally notify the backend
      try {
        await api.post(`${ENDPOINTS.ANNOUNCEMENTS}/${announcementId}/mark-read`);
      } catch (error) {
        // Silently fail if endpoint doesn't exist
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const { data: announcements, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.ANNOUNCEMENTS);
      return response.data;
    },
  });

  // Sort announcements: unread first, then by date (newest first)
  const sortedAnnouncements = React.useMemo(() => {
    if (!announcements) return [];
    
    return [...announcements].sort((a, b) => {
      const aRead = readAnnouncements[a.id];
      const bRead = readAnnouncements[b.id];
      
      // Unread items first
      if (aRead !== bRead) {
        return aRead ? 1 : -1;
      }
      
      // Then sort by date (newest first)
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });
  }, [announcements, readAnnouncements]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      default: return primaryColor;
    }
  };

  const renderAnnouncement = ({ item }) => {
    const isRead = readAnnouncements[item.id];
    
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedAnnouncement(item);
          setDetailModalVisible(true);
          if (!isRead) { markAsRead(item.id); }
        }}
        style={{
          backgroundColor: isRead ? colors.surfaceSecondary : colors.surface,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          ...shadows.sm,
          borderLeftWidth: 3,
          borderLeftColor: getPriorityColor(item.priority),
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
                {isRead && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                    <Ionicons name="checkmark-circle" size={14} color={primaryColor} />
                  </View>
                )}
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

  const unreadCount = announcements?.filter(a => !readAnnouncements[a.id]).length || 0;

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
          {navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textInverse} />
            </TouchableOpacity>
          )}
          {!navigation.canGoBack() && (
            <View style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="megaphone" size={22} color={colors.textInverse} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>News</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
              {unreadCount > 0 ? `${unreadCount} unread item${unreadCount !== 1 ? 's' : ''}` : `${announcements?.length || 0} announcement${announcements?.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={sortedAnnouncements}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderAnnouncement}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
            <Ionicons name="megaphone-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
              No news yet
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 16 }}
      />
      </AnimatedScreen>

      {/* Announcement Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setDetailModalVisible(false);
          setSelectedAnnouncement(null);
        }}
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
              {/* Priority & Emergency Badges */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 }}>
                <View
                  style={{
                    backgroundColor: `${getPriorityColor(selectedAnnouncement.priority)}20`,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: borderRadius.lg,
                  }}
                >
                  <Text style={{ color: getPriorityColor(selectedAnnouncement.priority), fontWeight: '600', textTransform: 'capitalize' }}>
                    {selectedAnnouncement.priority || 'Normal'} Priority
                  </Text>
                </View>
                {(selectedAnnouncement.emergency || selectedAnnouncement.is_emergency) && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.errorLight,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: borderRadius.lg,
                    }}
                  >
                    <Ionicons name="warning" size={16} color={colors.error} />
                    <Text style={{ color: colors.error, fontWeight: '600', marginLeft: 4 }}>Emergency</Text>
                  </View>
                )}
              </View>

              {/* Title */}
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 }}>
                {selectedAnnouncement.title}
              </Text>

              {/* Content */}
              <View style={{ backgroundColor: colors.background, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, color: colors.textPrimary, lineHeight: 24 }}>
                  {selectedAnnouncement.content}
                </Text>
              </View>

              {/* Metadata */}
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
