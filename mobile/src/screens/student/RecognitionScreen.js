import React, { useState, useMemo, useCallback } from 'react';
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
import { format } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';
import { spacing, borderRadius, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

const categories = [
  { id: 'appreciation', label: 'Appreciation', icon: 'heart' },
  { id: 'academic', label: 'Academic', icon: 'school' },
  { id: 'leadership', label: 'Leadership', icon: 'flag' },
  { id: 'community', label: 'Community', icon: 'people' },
  { id: 'sports', label: 'Sports', icon: 'football' },
  { id: 'creativity', label: 'Creativity', icon: 'color-palette' },
];

const getCategoryInfo = (id) => categories.find(c => c.id === id) || categories[0];

const roleLabel = (role) => {
  const map = { admin: 'Admin', ra: 'RA', student: 'Student', college_admin: 'Admin', super_admin: 'Super Admin' };
  return map[role] || role;
};

export default function RecognitionScreen() {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const [modalVisible, setModalVisible] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [newShoutout, setNewShoutout] = useState({ category: 'appreciation', message: '' });
  const queryClient = useQueryClient();

  const { data: shoutouts, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['shoutouts'],
    queryFn: async () => { const r = await api.get(ENDPOINTS.SHOUTOUTS); return r.data; },
  });

  const { data: participants, isLoading: participantsLoading } = useQuery({
    queryKey: ['recognition-participants'],
    queryFn: async () => { const r = await api.get(ENDPOINTS.RECOGNITION_PARTICIPANTS); return r.data; },
    enabled: modalVisible,
  });

  const filteredParticipants = useMemo(() => {
    if (!participants) return [];
    if (!pickerSearch.trim()) return participants;
    const q = pickerSearch.toLowerCase();
    return participants.filter(p =>
      p.name.toLowerCase().includes(q)
    );
  }, [participants, pickerSearch]);

  const createShoutout = useMutation({
    mutationFn: async (data) => { const r = await api.post(ENDPOINTS.SHOUTOUTS, data); return r.data; },
    onSuccess: () => {
      Alert.alert('Success', 'Shoutout sent!');
      setModalVisible(false);
      setShowPicker(false);
      setSelectedRecipient(null);
      setNewShoutout({ category: 'appreciation', message: '' });
      queryClient.invalidateQueries({ queryKey: ['shoutouts'] });
    },
    onError: (e) => { Alert.alert('Error', e.response?.data?.detail || 'Failed to send'); },
  });

  const handleSubmit = useCallback(() => {
    if (!selectedRecipient) { Alert.alert('Error', 'Please select a person'); return; }
    if (!newShoutout.message.trim()) { Alert.alert('Error', 'Please write a message'); return; }
    createShoutout.mutate({
      recipient_name: selectedRecipient.name,
      recipient_id: selectedRecipient.id,
      category: newShoutout.category,
      message: newShoutout.message,
    });
  }, [selectedRecipient, newShoutout, createShoutout]);

  const openCreateModal = useCallback(() => {
    setSelectedRecipient(null);
    setNewShoutout({ category: 'appreciation', message: '' });
    setShowPicker(false);
    setPickerSearch('');
    setModalVisible(true);
  }, []);

  const handleSelectParticipant = useCallback((item) => {
    setSelectedRecipient(item);
    setShowPicker(false);
    setPickerSearch('');
  }, []);

  const renderShoutout = ({ item }) => {
    const cat = getCategoryInfo(item.category);
    return (
      <View style={{
        backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.md,
        borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
      }}>
        <View style={{ height: 3, backgroundColor: primaryColor }} />
        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '12', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Ionicons name={cat.icon} size={18} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{item.recipient_name}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{cat.label} · From {item.sender_name || 'Anonymous'}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, fontStyle: 'italic' }}>"{item.message}"</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
            <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4, fontWeight: '500' }}>
              {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy') : 'Recently'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={primaryColor} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']} testID="recognition-screen">
      <AnimatedScreen>
      <View style={{
        backgroundColor: primaryColor, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
        borderBottomLeftRadius: borderRadius.xxl, borderBottomRightRadius: borderRadius.xxl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="star" size={22} color={colors.textInverse} />
          </View>
          <View style={{ marginLeft: spacing.md }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>Shoutouts</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>{shoutouts?.length || 0} shoutouts shared</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={shoutouts} keyExtractor={(i, idx) => i.id || `item-${idx}`} renderItem={renderShoutout}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />}
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
              <Ionicons name="star-outline" size={24} color={colors.textTertiary} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>No shoutouts yet</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>Be the first to give someone a shoutout</Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: 80 }}
      />
      </AnimatedScreen>

      {/* FAB */}
      <TouchableOpacity onPress={openCreateModal} testID="add-shoutout-fab"
        style={{ position: 'absolute', bottom: 24, right: 24, width: 52, height: 52, backgroundColor: primaryColor, borderRadius: borderRadius.xl, justifyContent: 'center', alignItems: 'center', ...shadows.lg }}>
        <Ionicons name="add" size={26} color={colors.textInverse} />
      </TouchableOpacity>

      {/* Single Modal — toggles between form view and picker view */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (showPicker) { setShowPicker(false); } else { setModalVisible(false); } }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          {showPicker ? (
            /* ---- Participant Picker View ---- */
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => { setShowPicker(false); setPickerSearch(''); }} testID="picker-back-btn">
                  <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Select Person</Text>
                <View style={{ width: 22 }} />
              </View>
              <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
                  <Ionicons name="search" size={18} color={colors.textTertiary} />
                  <TextInput
                    style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 15, color: colors.textPrimary }}
                    placeholder="Search by name..."
                    placeholderTextColor={colors.textTertiary}
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    autoFocus
                    testID="participant-search-input"
                  />
                  {pickerSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setPickerSearch('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {participantsLoading ? (
                <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 40 }} />
              ) : (
                <FlatList
                  data={filteredParticipants}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleSelectParticipant(item)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: (colors.borderLight || colors.border + '30') }}
                      testID={`participant-item-${item.id}`}
                    >
                      <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '15', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: primaryColor }}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }}>{item.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{item.role}</Text>
                      </View>
                      <View style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500' }}>{roleLabel(item.role)}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
                      <Ionicons name="people-outline" size={32} color={colors.textTertiary} />
                      <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 8 }}>
                        {pickerSearch ? 'No matches found' : 'No participants available'}
                      </Text>
                    </View>
                  }
                />
              )}
            </>
          ) : (
            /* ---- Shoutout Form View ---- */
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => setModalVisible(false)} testID="create-shoutout-cancel">
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Give Shoutout</Text>
                <TouchableOpacity onPress={handleSubmit} disabled={createShoutout.isPending} testID="create-shoutout-send">
                  <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>{createShoutout.isPending ? 'Sending...' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1, padding: spacing.lg }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Shoutout to *</Text>
                <TouchableOpacity
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.6}
                  style={{
                    backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
                  }}
                  testID="open-participant-picker"
                >
                  {selectedRecipient ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{ width: 32, height: 32, backgroundColor: primaryColor + '15', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: primaryColor }}>{selectedRecipient.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }}>{selectedRecipient.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>{selectedRecipient.role}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 15, color: colors.textTertiary }}>Tap to select a person...</Text>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>

                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 }}>
                  {categories.map(cat => (
                    <TouchableOpacity key={cat.id} onPress={() => setNewShoutout({ ...newShoutout, category: cat.id })}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.md, backgroundColor: newShoutout.category === cat.id ? primaryColor : colors.surfaceSecondary }}
                      testID={`category-${cat.id}`}
                    >
                      <Ionicons name={cat.icon} size={15} color={newShoutout.category === cat.id ? colors.textInverse : colors.textSecondary} />
                      <Text style={{ color: newShoutout.category === cat.id ? colors.textInverse : colors.textSecondary, fontWeight: '600', marginLeft: 6, fontSize: 13 }}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Message *</Text>
                <TextInput
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, height: 120, textAlignVertical: 'top' }}
                  multiline placeholder="Share why you're giving this shoutout..." placeholderTextColor={colors.textTertiary}
                  value={newShoutout.message} onChangeText={t => setNewShoutout({ ...newShoutout, message: t })}
                  testID="shoutout-message-input"
                />
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
