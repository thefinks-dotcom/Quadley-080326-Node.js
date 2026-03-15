import React, { useState } from 'react';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';
import ModuleHeader from '../../components/ModuleHeader';

export default function MaintenanceScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'normal',
    room_number: '',
  });
  const queryClient = useQueryClient();

  const { data: requests, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['maintenanceRequests'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.MAINTENANCE);
      return response.data;
    },
  });

  const createRequest = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(ENDPOINTS.MAINTENANCE, data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Maintenance request submitted!');
      setModalVisible(false);
      setNewRequest({ title: '', description: '', category: 'general', priority: 'normal', room_number: '' });
      queryClient.invalidateQueries({ queryKey: ['maintenanceRequests'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit request');
    },
  });

  const handleSubmit = () => {
    if (!newRequest.title.trim() || !newRequest.description.trim() || !newRequest.room_number.trim()) {
      Alert.alert('Error', 'Please fill in all required fields (Room Number, Title, Description)');
      return;
    }
    // Map mobile fields to backend expected fields
    const backendPayload = {
      room_number: newRequest.room_number,
      issue_type: newRequest.category,
      description: `${newRequest.title}\n\n${newRequest.description}`,
      priority: newRequest.priority,
    };
    createRequest.mutate(backendPayload);
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

  const categories = ['general', 'plumbing', 'electrical', 'hvac', 'furniture', 'cleaning', 'other'];
  const priorities = ['low', 'normal', 'high', 'urgent'];

  const renderRequest = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedRequest(item);
        setDetailModalVisible(true);
      }}
      style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
            {item.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <View
              style={{
                backgroundColor: colors.surfaceSecondary,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: borderRadius.sm,
                marginRight: 8,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12, textTransform: 'capitalize' }}>
                {item.category}
              </Text>
            </View>
            {item.priority === 'urgent' && (
              <View
                style={{
                  backgroundColor: colors.errorLight,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: borderRadius.sm,
                }}
              >
                <Text style={{ color: colors.error, fontSize: 12, fontWeight: '500' }}>Urgent</Text>
              </View>
            )}
          </View>
        </View>
        <View
          style={{
            backgroundColor: `${getStatusColor(item.status)}20`,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: borderRadius.md,
          }}
        >
          <Text
            style={{
              color: getStatusColor(item.status),
              fontWeight: '500',
              fontSize: 12,
              textTransform: 'capitalize',
            }}
          >
            {item.status?.replace('_', ' ')}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 10 }} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: colors.textTertiary }}>
          Submitted: {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy') : 'Recently'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: primaryColor, marginRight: 4 }}>View Details</Text>
          <Ionicons name="chevron-forward" size={14} color={primaryColor} />
        </View>
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ModuleHeader title="Maintenance" onBack={() => navigation.goBack()} onAdd={() => setModalVisible(true)} />
      <FlatList
        data={requests}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderRequest}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
            <Ionicons name="construct-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
              No maintenance requests
            </Text>
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
          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>New Request</Text>
              <TouchableOpacity onPress={handleSubmit} disabled={createRequest.isPending}>
                <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                  {createRequest.isPending ? 'Sending...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ flex: 1, padding: spacing.lg }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
              Room Number *
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: borderRadius.md,
                padding: 12,
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 16,
              }}
              placeholder="e.g., A101, B205"
              placeholderTextColor={colors.textTertiary}
              value={newRequest.room_number}
              onChangeText={(text) => setNewRequest({ ...newRequest, room_number: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
              Title *
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: borderRadius.md,
                padding: 12,
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 16,
              }}
              placeholder="Brief description of the issue"
              placeholderTextColor={colors.textTertiary}
              value={newRequest.title}
              onChangeText={(text) => setNewRequest({ ...newRequest, title: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
              Category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setNewRequest({ ...newRequest, category: cat })}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: newRequest.category === cat ? primaryColor : colors.surfaceSecondary,
                    marginRight: 8,
                  }}
                >
                  <Text
                    style={{
                      color: newRequest.category === cat ? colors.textInverse : colors.textSecondary,
                      fontWeight: '500',
                      textTransform: 'capitalize',
                    }}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
              Priority
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {priorities.map((priority) => (
                <TouchableOpacity
                  key={priority}
                  onPress={() => setNewRequest({ ...newRequest, priority })}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: newRequest.priority === priority ? primaryColor : colors.surfaceSecondary,
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      color: newRequest.priority === priority ? colors.textInverse : colors.textSecondary,
                      fontWeight: '500',
                      textTransform: 'capitalize',
                    }}
                  >
                    {priority}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>
              Description *
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: borderRadius.md,
                padding: 12,
                fontSize: 16,
                color: colors.textPrimary,
                height: 120,
                textAlignVertical: 'top',
              }}
              multiline
              placeholder="Provide more details about the issue..."
              placeholderTextColor={colors.textTertiary}
              value={newRequest.description}
              onChangeText={(text) => setNewRequest({ ...newRequest, description: text })}
            />
            <View style={{ height: 100 }} />
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Request Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setDetailModalVisible(false);
          setSelectedRequest(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 60 }} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Request Details</Text>
            <TouchableOpacity onPress={() => { setDetailModalVisible(false); setSelectedRequest(null); }}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedRequest && (
            <ScrollView style={{ flex: 1, padding: spacing.lg }}>
              {/* Status Badge */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View
                  style={{
                    backgroundColor: `${getStatusColor(selectedRequest.status)}20`,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 20,
                  }}
                >
                  <Text
                    style={{
                      color: getStatusColor(selectedRequest.status),
                      fontWeight: '600',
                      fontSize: 16,
                      textTransform: 'capitalize',
                    }}
                  >
                    {selectedRequest.status?.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Title */}
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 }}>
                {selectedRequest.title}
              </Text>

              {/* Info Cards */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 }}>
                <View style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.md }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Category</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, textTransform: 'capitalize' }}>
                    {selectedRequest.category}
                  </Text>
                </View>
                <View style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.md }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Priority</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: selectedRequest.priority === 'urgent' ? colors.error : colors.textPrimary, textTransform: 'capitalize' }}>
                    {selectedRequest.priority}
                  </Text>
                </View>
                {selectedRequest.room_number && (
                  <View style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.md }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Room</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{selectedRequest.room_number}</Text>
                  </View>
                )}
              </View>

              {/* Description */}
              <View style={{ backgroundColor: colors.background, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Description</Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>{selectedRequest.description}</Text>
              </View>

              {/* Timeline */}
              <View style={{ backgroundColor: colors.background, padding: spacing.lg, borderRadius: borderRadius.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Timeline</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 8 }}>
                    Submitted: {selectedRequest.created_at ? format(new Date(selectedRequest.created_at), 'MMM d, yyyy h:mm a') : 'Recently'}
                  </Text>
                </View>
                {selectedRequest.updated_at && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 8 }}>
                      Updated: {format(new Date(selectedRequest.updated_at), 'MMM d, yyyy h:mm a')}
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
