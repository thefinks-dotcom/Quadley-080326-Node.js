import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { formatDateTime } from '../../utils/dateUtils';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';

export default function AdminRecognitionScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedShoutout, setSelectedShoutout] = useState(null);
  const [newShoutout, setNewShoutout] = useState({
    recipient_email: '',
    message: '',
    category: 'appreciation',
  });
  const queryClient = useQueryClient();

  const { data: shoutouts, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminShoutouts'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.SHOUTOUTS);
      return response.data;
    },
  });

  const createShoutout = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(ENDPOINTS.SHOUTOUTS, data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Recognition sent!');
      setCreateModalVisible(false);
      setNewShoutout({ recipient_email: '', message: '', category: 'appreciation' });
      queryClient.invalidateQueries(['adminShoutouts']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send recognition');
    },
  });

  const categories = {
    appreciation: { icon: 'heart', color: colors.error, label: 'Appreciation' },
    academic: { icon: 'school', color: primaryColor, label: 'Academic' },
    leadership: { icon: 'flag', color: primaryColor, label: 'Leadership' },
    community: { icon: 'people', color: primaryColor, label: 'Community' },
    sports: { icon: 'football', color: primaryColor, label: 'Sports' },
    creativity: { icon: 'color-palette', color: primaryColor, label: 'Creativity' },
  };

  const getCategoryInfo = (categoryId) => {
    return categories[categoryId] || categories.appreciation;
  };

  const handleCreate = () => {
    if (!newShoutout.recipient_email.trim() || !newShoutout.message.trim()) {
      Alert.alert('Error', 'Please fill in recipient email and message');
      return;
    }
    createShoutout.mutate(newShoutout);
  };

  const renderShoutout = ({ item }) => {
    const category = getCategoryInfo(item.category);
    return (
      <TouchableOpacity
        onPress={() => { setSelectedShoutout(item); setDetailModalVisible(true); }}
        style={{
          backgroundColor: colors.surface,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          borderLeftWidth: 4,
          borderLeftColor: category.color,
        }}
        data-testid={`shoutout-${item.id}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              backgroundColor: `${category.color}20`,
              borderRadius: 20,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name={category.icon} size={20} color={category.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
              {item.recipient_name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              From: {item.sender_name || 'Anonymous'}
            </Text>
          </View>
          <View style={{ backgroundColor: `${category.color}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
            <Text style={{ color: category.color, fontSize: 12, fontWeight: '500', textTransform: 'capitalize' }}>
              {item.category}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }} numberOfLines={2}>
          "{item.message}"
        </Text>
        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 12 }}>
          {item.created_at ? formatDateTime(item.created_at) : 'Recently'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Recognition"
        subtitle={`${shoutouts?.length || 0} recognition${(shoutouts?.length || 0) !== 1 ? 's' : ''}`}
        onBack={() => navigation.goBack()}
        onAdd={() => setCreateModalVisible(true)}
      />

      <FlatList
        data={shoutouts}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderShoutout}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
            <Ionicons name="star-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
              No recognitions yet
            </Text>
            <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 4 }}>
              Tap + to create one
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 100 }}
      />

      {/* Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}>
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2 }} />
            </View>
            {selectedShoutout && (
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Category Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      backgroundColor: `${getCategoryInfo(selectedShoutout.category).color}20`,
                      borderRadius: 28,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 16,
                    }}
                  >
                    <Ionicons name={getCategoryInfo(selectedShoutout.category).icon} size={28} color={getCategoryInfo(selectedShoutout.category).color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' }}>
                      {getCategoryInfo(selectedShoutout.category).label}
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                      {selectedShoutout.recipient_name}
                    </Text>
                  </View>
                </View>

                {/* Message */}
                <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, color: colors.textPrimary, lineHeight: 24, fontStyle: 'italic' }}>
                    "{selectedShoutout.message}"
                  </Text>
                </View>

                {/* Details */}
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                    <Ionicons name="person-outline" size={18} color={colors.secondary} />
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 8 }}>
                      From: {selectedShoutout.sender_name || 'Anonymous'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={18} color={colors.secondary} />
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 8 }}>
                      {selectedShoutout.created_at ? formatDateTime(selectedShoutout.created_at) : 'Recently'}
                    </Text>
                  </View>
                </View>

                {/* Close Button */}
                <TouchableOpacity
                  onPress={() => { setDetailModalVisible(false); setSelectedShoutout(null); }}
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    paddingVertical: 14,
                    borderRadius: borderRadius.md,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={createModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Give Recognition</Text>
            <TouchableOpacity onPress={handleCreate} disabled={createShoutout.isPending}>
              <Text style={{ color: colors.error, fontSize: 16, fontWeight: '600' }}>
                {createShoutout.isPending ? 'Sending...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Recipient Email *</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 14, fontSize: 16, color: colors.textPrimary, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
              placeholder="student@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={newShoutout.recipient_email}
              onChangeText={(text) => setNewShoutout({ ...newShoutout, recipient_email: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {Object.entries(categories).map(([key, { icon, color, label }]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setNewShoutout({ ...newShoutout, category: key })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: newShoutout.category === key ? color : colors.surfaceSecondary,
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name={icon} size={16} color={newShoutout.category === key ? colors.surface : color} />
                  <Text style={{ color: newShoutout.category === key ? colors.surface : colors.textSecondary, fontWeight: '500', marginLeft: 6 }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Message *</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 14, fontSize: 16, color: colors.textPrimary, height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border }}
              multiline
              placeholder="Write a nice message..."
              placeholderTextColor={colors.textTertiary}
              value={newShoutout.message}
              onChangeText={(text) => setNewShoutout({ ...newShoutout, message: text })}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
