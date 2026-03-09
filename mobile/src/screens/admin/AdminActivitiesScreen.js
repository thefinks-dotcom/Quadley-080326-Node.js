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
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';

const ACTIVITY_TYPES = [
  { id: 'sports', name: 'Sports', icon: 'football', color: null },
  { id: 'clubs', name: 'Clubs', icon: 'people', color: null },
  { id: 'cultural', name: 'Cultural', icon: 'musical-notes', color: null },
  { id: 'academic', name: 'Academic', icon: 'school', color: null },
  { id: 'other', name: 'Other', icon: 'apps', color: null },
];

const getTypeConfig = (type, fallbackColor) => {
  const config = ACTIVITY_TYPES.find(t => t.id === type) || ACTIVITY_TYPES[4];
  return { ...config, color: config.color || fallbackColor };
};

export default function AdminActivitiesScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantCode = user?.tenant_code;
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'clubs',
    description: '',
    leader_name: '',
    leader_email: '',
    meeting_times: '',
    location: '',
  });

  // Fetch activities
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminActivities'],
    queryFn: async () => {
      const response = await api.get('/cocurricular/groups/all');
      return response.data;
    },
  });

  // Create activity mutation
  const createMutation = useMutation({
    mutationFn: async (activityData) => {
      const response = await api.post('/cocurricular/groups', activityData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminActivities']);
      Alert.alert('Success', 'Activity created');
      closeModal();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create activity');
    },
  });

  // Update activity mutation
  const updateMutation = useMutation({
    mutationFn: async ({ activityId, activityData }) => {
      const response = await api.put(`/cocurricular/groups/${activityId}`, activityData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminActivities']);
      Alert.alert('Success', 'Activity updated');
      closeModal();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update activity');
    },
  });

  // Delete activity mutation
  const deleteMutation = useMutation({
    mutationFn: async (activityId) => {
      const response = await api.delete(`/cocurricular/groups/${activityId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminActivities']);
      Alert.alert('Success', 'Activity deleted');
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete activity');
    },
  });

  const activities = data || [];

  const openAddModal = () => {
    setEditingActivity(null);
    setFormData({
      name: '',
      type: 'clubs',
      description: '',
      leader_name: '',
      leader_email: '',
      meeting_times: '',
      location: '',
    });
    setModalVisible(true);
  };

  const openEditModal = (activity) => {
    setEditingActivity(activity);
    setFormData({
      name: activity.name || '',
      type: activity.type || 'clubs',
      description: activity.description || '',
      leader_name: activity.leader_name || '',
      leader_email: activity.leader_email || '',
      meeting_times: activity.meeting_times || '',
      location: activity.location || '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingActivity(null);
    setFormData({
      name: '',
      type: 'clubs',
      description: '',
      leader_name: '',
      leader_email: '',
      meeting_times: '',
      location: '',
    });
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Activity name is required');
      return;
    }

    const activityData = {
      type: formData.type,
      name: formData.name.trim(),
      description: formData.description || '',
      meeting_times: formData.meeting_times || '',
      competition_times: '',
      other_details: formData.location || '',
    };

    if (editingActivity) {
      // Update existing activity
      updateMutation.mutate({
        activityId: editingActivity.id,
        activityData,
      });
    } else {
      // Create new activity
      createMutation.mutate(activityData);
    }
  };

  const handleDelete = (activity) => {
    const memberCount = activity.members?.length || 0;
    if (memberCount > 0) {
      Alert.alert(
        'Cannot Delete',
        `This activity has ${memberCount} members. Remove all members before deleting.`
      );
      return;
    }
    
    Alert.alert(
      'Delete Activity',
      `Are you sure you want to delete "${activity.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(activity.id);
          },
        },
      ]
    );
  };

  const groupedActivities = ACTIVITY_TYPES.map(type => ({
    ...type,
    activities: activities.filter(a => a.type === type.id),
  })).filter(group => group.activities.length > 0);

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
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.surface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: 'bold' }}>Activities</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={openAddModal}
          style={{
            backgroundColor: primaryColor,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: borderRadius.sm,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="add" size={18} color={colors.surface} />
          <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 4 }}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {activities.length === 0 ? (
          <View style={{ 
            backgroundColor: colors.surface, 
            borderRadius: borderRadius.lg, 
            padding: 32,
            alignItems: 'center',
          }}>
            <Ionicons name="apps-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 16 }}>
              No Activities Yet
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
              Add sports, clubs, and other activities for your students
            </Text>
            <TouchableOpacity
              onPress={openAddModal}
              style={{
                backgroundColor: primaryColor,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: borderRadius.sm,
                marginTop: 20,
              }}
            >
              <Text style={{ color: colors.textInverse, fontWeight: '600' }}>Add First Activity</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Activity Type Filter */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {ACTIVITY_TYPES.map(type => {
                const count = activities.filter(a => a.type === type.id).length;
                return (
                  <View
                    key={type.id}
                    style={{
                      backgroundColor: colors.surface,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      marginRight: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name={type.icon} size={16} color={type.color || primaryColor} />
                    <Text style={{ marginLeft: 6, fontSize: 13, color: colors.textPrimary }}>
                      {type.name}
                    </Text>
                    <View style={{
                      backgroundColor: count > 0 ? type.color : colors.border,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: borderRadius.md,
                      marginLeft: 6,
                    }}>
                      <Text style={{ fontSize: 11, color: count > 0 ? colors.surface : colors.textSecondary, fontWeight: '600' }}>
                        {count}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Grouped Activities */}
            {groupedActivities.map(group => (
              <View key={group.id} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <Ionicons name={group.icon} size={20} color={group.color} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>
                    {group.name}
                  </Text>
                </View>
                
                {group.activities.map(activity => (
                  <TouchableOpacity
                    key={activity.id}
                    onPress={() => openEditModal(activity)}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: borderRadius.md,
                      padding: spacing.lg,
                      marginBottom: 10,
                      shadowColor: colors.textPrimary,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                          {activity.name}
                        </Text>
                        {activity.description && (
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }} numberOfLines={2}>
                            {activity.description}
                          </Text>
                        )}
                        
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 }}>
                          {activity.leader_name && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="person-outline" size={14} color={colors.secondary} />
                              <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
                                {activity.leader_name}
                              </Text>
                            </View>
                          )}
                          {activity.meeting_times && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="time-outline" size={14} color={colors.secondary} />
                              <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
                                {activity.meeting_times}
                              </Text>
                            </View>
                          )}
                          {activity.location && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="location-outline" size={14} color={colors.secondary} />
                              <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
                                {activity.location}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => openEditModal(activity)}
                          style={{ padding: 8 }}
                        >
                          <Ionicons name="pencil" size={18} color={primaryColor} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(activity)}
                          style={{ padding: 8 }}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
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
              <TouchableOpacity onPress={closeModal}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>
                {editingActivity ? 'Edit Activity' : 'Add Activity'}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              {/* Activity Type */}
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
                Type
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {ACTIVITY_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setFormData(prev => ({ ...prev, type: type.id }))}
                    style={{
                      backgroundColor: formData.type === type.id ? (type.color || primaryColor) : colors.surface,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      marginRight: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: formData.type === type.id ? (type.color || primaryColor) : colors.border,
                    }}
                  >
                    <Ionicons 
                      name={type.icon} 
                      size={16} 
                      color={formData.type === type.id ? colors.surface : (type.color || primaryColor)} 
                    />
                    <Text style={{ 
                      marginLeft: 6, 
                      fontSize: 14, 
                      color: formData.type === type.id ? colors.surface : colors.textPrimary,
                      fontWeight: formData.type === type.id ? '600' : '400',
                    }}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Name */}
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
                Name *
              </Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="e.g., Chess Club"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 16,
                  marginBottom: 16,
                }}
              />

              {/* Description */}
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
                Description
              </Text>
              <TextInput
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Brief description of the activity"
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 16,
                  marginBottom: 16,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />

              {/* Leader Name */}
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
                Leader/Coach Name
              </Text>
              <TextInput
                value={formData.leader_name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, leader_name: text }))}
                placeholder="e.g., John Smith"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 16,
                  marginBottom: 16,
                }}
              />

              {/* Leader Email */}
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
                Leader/Coach Email
              </Text>
              <TextInput
                value={formData.leader_email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, leader_email: text }))}
                placeholder="e.g., coach@college.edu"
                keyboardType="email-address"
                autoCapitalize="none"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 16,
                  marginBottom: 16,
                }}
              />

              {/* Meeting Times */}
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
                Meeting Times
              </Text>
              <TextInput
                value={formData.meeting_times}
                onChangeText={(text) => setFormData(prev => ({ ...prev, meeting_times: text }))}
                placeholder="e.g., Mon/Wed 5-7pm"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 16,
                  marginBottom: 16,
                }}
              />

              {/* Location */}
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
                Location
              </Text>
              <TextInput
                value={formData.location}
                onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
                placeholder="e.g., Main Gym, Room 101"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  padding: 14,
                  fontSize: 16,
                  marginBottom: 32,
                }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
