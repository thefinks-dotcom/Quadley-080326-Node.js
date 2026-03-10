import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { colors as defaultColors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function AcademicsScreen({ navigation }) {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('study-groups');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroup, setNewGroup] = useState({
    subject: '', topic: '', location: '', max_members: '6', description: '',
  });
  const queryClient = useQueryClient();

  const { data: studyGroups, isLoading: loadingGroups, refetch: refetchGroups, isRefetching } = useQuery({
    queryKey: ['studyGroups'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.STUDY_GROUPS);
      return response.data;
    },
  });

  const sortedStudyGroups = React.useMemo(() => {
    if (!studyGroups || !user) return studyGroups || [];
    return [...studyGroups].sort((a, b) => {
      const aJoined = a.members?.some(m => m.user_id === user.id || m === user.id);
      const bJoined = b.members?.some(m => m.user_id === user.id || m === user.id);
      if (aJoined !== bJoined) return aJoined ? -1 : 1;
      return (b.members?.length || 0) - (a.members?.length || 0);
    });
  }, [studyGroups, user]);

  const { data: tutoring, isLoading: loadingTutoring, refetch: refetchTutoring } = useQuery({
    queryKey: ['tutoring'],
    queryFn: async () => {
      const response = await api.get('/tutoring/approved');
      return response.data?.map(tutor => ({
        id: tutor.id,
        tutor_name: tutor.student_name,
        subject: tutor.subjects?.join(', ') || 'Various subjects',
        available_times: tutor.available_times,
        bio: tutor.bio,
      })) || [];
    },
  });

  const createStudyGroup = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(ENDPOINTS.STUDY_GROUPS, {
        name: `${data.subject}: ${data.topic}`,
        subject: data.subject,
        location: data.location,
        max_members: parseInt(data.max_members),
        meeting_schedule: data.description,
      });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Study group created!');
      setModalVisible(false);
      setNewGroup({ subject: '', topic: '', location: '', max_members: '6', description: '' });
      queryClient.invalidateQueries({ queryKey: ['studyGroups'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create study group');
    },
  });

  const joinGroup = useMutation({
    mutationFn: async (groupId) => {
      const response = await api.post(`${ENDPOINTS.STUDY_GROUPS}/${groupId}/join`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Joined study group!');
      queryClient.invalidateQueries({ queryKey: ['studyGroups'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to join group');
    },
  });

  const handleCreate = () => {
    if (!newGroup.subject.trim() || !newGroup.topic.trim()) {
      Alert.alert('Error', 'Please fill in subject and topic');
      return;
    }
    createStudyGroup.mutate(newGroup);
  };

  const groupCount = sortedStudyGroups?.length || 0;
  const tutorCount = tutoring?.length || 0;

  const renderStudyGroup = ({ item }) => {
    const isJoined = item.members?.some(m => m.user_id === user?.id || m === user?.id);
    const isFull = (item.members?.length || 0) >= (item.max_members || 10);
    return (
      <TouchableOpacity
        data-testid={`study-group-${item.id}`}
        activeOpacity={0.85}
        onPress={() => { setSelectedGroup(item); setDetailVisible(true); }}
        style={{
          backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.md,
          borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
        }}
      >
        <View style={{ height: 3, backgroundColor: primaryColor }} />
        <View style={{ padding: spacing.lg }}>
          {isJoined && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm,
              backgroundColor: primaryColor + '15', paddingHorizontal: 8, paddingVertical: 4,
              borderRadius: borderRadius.sm, alignSelf: 'flex-start',
            }}>
              <Ionicons name="checkmark-circle" size={14} color={primaryColor} />
              <Text style={{ fontSize: 11, color: primaryColor, fontWeight: '600', marginLeft: 4 }}>Joined</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.2 }}>
                {item.name || item.subject}
              </Text>
            </View>
            {!isJoined ? (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); joinGroup.mutate(item.id); }}
                data-testid={`join-group-${item.id}`}
                disabled={isFull}
                style={{
                  backgroundColor: isFull ? colors.borderLight : primaryColor,
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: borderRadius.sm, marginLeft: spacing.sm,
                }}>
                <Text style={{ color: isFull ? colors.textTertiary : colors.textInverse, fontWeight: '600', fontSize: 13 }}>
                  {isFull ? 'Full' : 'Join'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ marginTop: 2 }} />
            )}
          </View>
          {item.meeting_schedule && (
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
              {item.meeting_schedule}
            </Text>
          )}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            marginTop: spacing.md, paddingTop: spacing.md,
            borderTopWidth: 1, borderTopColor: colors.borderLight,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4, fontWeight: '500' }}>
                {item.location || 'TBD'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people-outline" size={14} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4, fontWeight: '500' }}>
                {item.members?.length || 0}/{item.max_members || 10}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTutoring = ({ item }) => (
    <View data-testid={`tutor-${item.id}`} style={{
      backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
      borderRadius: borderRadius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={{
        width: 44, height: 44, backgroundColor: primaryColor + '12',
        borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
      }}>
        <Ionicons name="school" size={20} color={primaryColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.2 }}>
          {item.tutor_name}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{item.subject}</Text>
      </View>
      <TouchableOpacity style={{
        backgroundColor: primaryColor + '12', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: borderRadius.sm,
      }}>
        <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 13 }}>Book</Text>
      </TouchableOpacity>
    </View>
  );

  const isLoading = activeTab === 'study-groups' ? loadingGroups : loadingTutoring;
  const data = activeTab === 'study-groups' ? sortedStudyGroups : tutoring;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']} data-testid="academics-screen">
      <AnimatedScreen>
      {/* Hero Header */}
      <View style={{
        backgroundColor: primaryColor, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
        borderBottomLeftRadius: borderRadius.xxl, borderBottomRightRadius: borderRadius.xxl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textInverse} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="book" size={22} color={colors.textInverse} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>Study</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
              {groupCount} groups · {tutorCount} tutors
            </Text>
          </View>
          {activeTab === 'study-groups' && (
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="add" size={24} color={colors.textInverse} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pill Tabs */}
      <View style={{
        flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md,
        backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 3,
      }}>
        {[
          { key: 'study-groups', label: 'Study Groups', count: groupCount, icon: 'people-outline' },
          { key: 'tutoring', label: 'Tutoring', count: tutorCount, icon: 'school-outline' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            data-testid={`tab-${tab.key}`}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm + 2,
              backgroundColor: activeTab === tab.key ? colors.surface : 'transparent',
              ...(activeTab === tab.key ? shadows.sm : {}),
            }}>
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? primaryColor : colors.textTertiary} />
            <Text style={{
              marginLeft: 6, fontWeight: '600', fontSize: 13,
              color: activeTab === tab.key ? colors.textPrimary : colors.textTertiary,
            }}>
              {tab.label}
            </Text>
            <View style={{
              backgroundColor: activeTab === tab.key ? primaryColor + '18' : colors.border,
              paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, marginLeft: 6,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: activeTab === tab.key ? primaryColor : colors.textTertiary,
              }}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={data || []}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={activeTab === 'study-groups' ? renderStudyGroup : renderTutoring}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => { refetchGroups(); refetchTutoring(); }} tintColor={primaryColor} colors={[primaryColor]} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
            <View style={{
              width: 56, height: 56, backgroundColor: colors.surfaceSecondary,
              borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg,
            }}>
              <Ionicons
                name={activeTab === 'study-groups' ? 'people-outline' : 'school-outline'}
                size={24} color={colors.textTertiary}
              />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
              {activeTab === 'study-groups' ? 'No study groups yet' : 'No tutors available'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>
              {activeTab === 'study-groups' ? 'Create one to get started' : 'Check back later'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 80 }}
      />
      </AnimatedScreen>


      {/* Study Group Detail Modal */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setDetailVisible(false); setSelectedGroup(null); }}
      >
        {selectedGroup && (() => {
          const g = selectedGroup;
          const liveGroup = sortedStudyGroups?.find(sg => sg.id === g.id) || g;
          const isJoined = liveGroup.members?.some(m => m.user_id === user?.id || m === user?.id);
          const memberCount = liveGroup.members?.length || 0;
          const maxMembers = liveGroup.max_members || 10;
          const isFull = memberCount >= maxMembers;
          const spotsLeft = maxMembers - memberCount;
          return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => { setDetailVisible(false); setSelectedGroup(null); }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Study Group</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
                <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                  <View style={{ width: 72, height: 72, backgroundColor: primaryColor + '15', borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md }}>
                    <Ionicons name="people" size={36} color={primaryColor} />
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.4 }}>
                    {liveGroup.name || liveGroup.subject}
                  </Text>
                  {liveGroup.subject && liveGroup.name && liveGroup.name !== liveGroup.subject && (
                    <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: spacing.sm }}>
                      <Text style={{ fontSize: 13, color: primaryColor, fontWeight: '600' }}>{liveGroup.subject}</Text>
                    </View>
                  )}
                  {isJoined && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, backgroundColor: primaryColor + '15', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
                      <Ionicons name="checkmark-circle" size={14} color={primaryColor} />
                      <Text style={{ fontSize: 13, color: primaryColor, fontWeight: '600', marginLeft: 4 }}>You are a member</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                  <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={20} color={primaryColor} />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>{memberCount}/{maxMembers}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '500' }}>Members</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}>
                    <Ionicons name="add-circle-outline" size={20} color={isFull ? colors.textTertiary : '#2E7D32'} />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: isFull ? colors.textTertiary : '#2E7D32', marginTop: 4 }}>
                      {isFull ? '0' : spotsLeft}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '500' }}>Spots Left</Text>
                  </View>
                </View>

                {liveGroup.location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
                    <Ionicons name="location" size={20} color={primaryColor} style={{ marginRight: spacing.md }} />
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Location</Text>
                      <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '500', marginTop: 2 }}>{liveGroup.location}</Text>
                    </View>
                  </View>
                ) : null}

                {liveGroup.meeting_schedule ? (
                  <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                      <Ionicons name="calendar-outline" size={18} color={primaryColor} style={{ marginRight: spacing.sm }} />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Schedule / Description</Text>
                    </View>
                    <Text style={{ fontSize: 15, color: colors.textPrimary, lineHeight: 22 }}>{liveGroup.meeting_schedule}</Text>
                  </View>
                ) : null}

                {liveGroup.members?.length > 0 && (
                  <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }}>
                      Members ({memberCount})
                    </Text>
                    {liveGroup.members.map((m, idx) => {
                      const name = m.user_name || m.name || (typeof m === 'string' ? m : null);
                      const isMe = m.user_id === user?.id || m === user?.id;
                      return (
                        <View key={m.user_id || m.id || idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: idx < liveGroup.members.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: primaryColor + '20', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: primaryColor }}>
                              {name ? name[0].toUpperCase() : '?'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, color: colors.textPrimary, flex: 1 }}>
                            {name || 'Member'}
                          </Text>
                          {isMe && (
                            <Text style={{ fontSize: 11, color: primaryColor, fontWeight: '600' }}>You</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>

              {!isJoined && (
                <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
                  <TouchableOpacity
                    onPress={() => joinGroup.mutate(liveGroup.id)}
                    disabled={isFull || joinGroup.isPending}
                    style={{
                      backgroundColor: isFull ? colors.borderLight : primaryColor,
                      borderRadius: borderRadius.md, padding: spacing.lg, alignItems: 'center',
                      opacity: joinGroup.isPending ? 0.7 : 1,
                    }}
                  >
                    <Text style={{ color: isFull ? colors.textTertiary : colors.textInverse, fontSize: 16, fontWeight: '700' }}>
                      {joinGroup.isPending ? 'Joining...' : isFull ? 'Group is Full' : 'Join This Group'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </SafeAreaView>
          );
        })()}
      </Modal>

      {/* Create Study Group Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>New Study Group</Text>
            <TouchableOpacity onPress={handleCreate} disabled={createStudyGroup.isPending}>
              <Text style={{ color: createStudyGroup.isPending ? colors.textTertiary : primaryColor, fontSize: 16, fontWeight: '600' }}>
                {createStudyGroup.isPending ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Subject *</Text>
            <TextInput
              data-testid="input-subject"
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="e.g., Mathematics, Physics" placeholderTextColor={colors.textTertiary}
              value={newGroup.subject} onChangeText={(t) => setNewGroup({ ...newGroup, subject: t })}
            />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Topic *</Text>
            <TextInput
              data-testid="input-topic"
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="e.g., Calculus, Midterm prep" placeholderTextColor={colors.textTertiary}
              value={newGroup.topic} onChangeText={(t) => setNewGroup({ ...newGroup, topic: t })}
            />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Location</Text>
            <TextInput
              data-testid="input-location"
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="e.g., Library Room 201" placeholderTextColor={colors.textTertiary}
              value={newGroup.location} onChangeText={(t) => setNewGroup({ ...newGroup, location: t })}
            />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Max Members</Text>
            <TextInput
              data-testid="input-max-members"
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="6" placeholderTextColor={colors.textTertiary} keyboardType="numeric"
              value={newGroup.max_members} onChangeText={(t) => setNewGroup({ ...newGroup, max_members: t })}
            />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Description</Text>
            <TextInput
              data-testid="input-description"
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, height: 100, textAlignVertical: 'top' }}
              multiline placeholder="What will you study?" placeholderTextColor={colors.textTertiary}
              value={newGroup.description} onChangeText={(t) => setNewGroup({ ...newGroup, description: t })}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
