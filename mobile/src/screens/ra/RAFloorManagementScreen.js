import React, { useState, useEffect, useCallback } from 'react';
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
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';

export default function RAFloorManagementScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [newEvent, setNewEvent] = useState({ title: '', description: '', location: '', date: new Date(), time: new Date() });
  const [showCreateDatePicker, setShowCreateDatePicker] = useState(false);
  const [showCreateTimePicker, setShowCreateTimePicker] = useState(false);

  const [editEvent, setEditEvent] = useState({ title: '', description: '', location: '', date: new Date(), time: new Date() });
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);

  const { data: floorEvents, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['floorEvents', user?.floor],
    queryFn: async () => {
      const response = await api.get('/floor-events');
      const eventsData = response.data || [];
      return eventsData.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    },
    refetchOnMount: true,
    staleTime: 0,
  });

  useEffect(() => { refetch(); }, []);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const combineDateAndTime = (dateObj, timeObj) => {
    const combined = new Date(dateObj);
    combined.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
    return combined.toISOString();
  };

  const createEvent = useMutation({
    mutationFn: async (data) => {
      const eventDate = combineDateAndTime(data.date, data.time);
      const response = await api.post('/floor-events', {
        title: data.title,
        description: data.description,
        location: data.location || `${user?.floor || 'Floor'} Common Area`,
        date: eventDate,
        floor: user?.floor || '',
      });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Floor event created!');
      setCreateModalVisible(false);
      setNewEvent({ title: '', description: '', location: '', date: new Date(), time: new Date() });
      queryClient.invalidateQueries(['floorEvents']);
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create event');
    },
  });

  const updateEvent = useMutation({
    mutationFn: async (data) => {
      const eventDate = combineDateAndTime(data.date, data.time);
      const response = await api.put(`/floor-events/${selectedEvent.id}`, {
        title: data.title,
        description: data.description,
        location: data.location,
        date: eventDate,
        floor: user?.floor || '',
      });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Event updated!');
      setEditModalVisible(false);
      setDetailModalVisible(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries(['floorEvents']);
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update event');
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId) => { await api.delete(`/floor-events/${eventId}`); },
    onSuccess: () => {
      Alert.alert('Success', 'Event deleted!');
      setDetailModalVisible(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries(['floorEvents']);
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete event');
    },
  });

  const handleCreate = () => {
    if (!newEvent.title.trim()) { Alert.alert('Error', 'Please enter an event title'); return; }
    createEvent.mutate(newEvent);
  };

  const handleUpdate = () => {
    if (!editEvent.title.trim()) { Alert.alert('Error', 'Please enter an event title'); return; }
    updateEvent.mutate(editEvent);
  };

  const handleDelete = () => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent.mutate(selectedEvent.id) },
    ]);
  };

  const openEventDetail = (event) => { setSelectedEvent(event); setDetailModalVisible(true); };

  const openEditModal = () => {
    const eventDate = selectedEvent?.date ? new Date(selectedEvent.date) : new Date();
    setEditEvent({ title: selectedEvent?.title || '', description: selectedEvent?.description || '', location: selectedEvent?.location || '', date: eventDate, time: eventDate });
    setDetailModalVisible(false);
    setEditModalVisible(true);
  };

  const formatEventDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    try { return format(parseISO(dateStr), "EEE, dd MMM yyyy 'at' h:mm a"); } catch { return dateStr; }
  };

  const PickerButton = ({ icon, label, value, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}
    >
      <View style={{ width: 36, height: 36, backgroundColor: primaryColor + '12', borderRadius: borderRadius.sm, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={18} color={primaryColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
        <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '500', marginTop: 2 }}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  const renderEvent = ({ item }) => (
    <TouchableOpacity
      onPress={() => openEventDetail(item)}
      style={{
        backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.md,
        borderRadius: borderRadius.lg, padding: spacing.lg, borderLeftWidth: 4, borderLeftColor: primaryColor, ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 48, height: 48, backgroundColor: primaryColor + '15', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
          <Ionicons name="calendar" size={24} color={primaryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 4 }}>
              {formatEventDate(item.date || item.start_time)}
            </Text>
          </View>
          {item.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 4 }}>{item.location}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </View>
      {item.description && (
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 10 }} numberOfLines={2}>{item.description}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
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
              <Ionicons name="calendar" size={22} color={colors.textInverse} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>Floor Management</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
              {floorEvents?.length || 0} event{floorEvents?.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons name="add" size={24} color={colors.textInverse} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Events List */}
      {!floorEvents && isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={floorEvents}
          keyExtractor={(item, index) => item.id || `item-${index}`}
          renderItem={renderEvent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>No floor events yet</Text>
              <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>
                Tap + to create your first event
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: 100 }}
        />
      )}

      {/* Event Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Event Details</Text>
            <TouchableOpacity onPress={openEditModal}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Edit</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 80, height: 80, backgroundColor: primaryColor + '15', borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="calendar" size={40} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center' }}>{selectedEvent?.title}</Text>
              <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 8 }}>
                <Text style={{ color: primaryColor, fontWeight: '600' }}>Floor Event</Text>
              </View>
            </View>
            <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '15', borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="time" size={20} color={primaryColor} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Date & Time</Text>
                  <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textPrimary }}>
                    {formatEventDate(selectedEvent?.date || selectedEvent?.start_time)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '15', borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="location" size={20} color={primaryColor} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Location</Text>
                  <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textPrimary }}>{selectedEvent?.location || 'TBD'}</Text>
                </View>
              </View>
            </View>
            {selectedEvent?.description && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Description</Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>{selectedEvent.description}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleDelete}
              style={{ backgroundColor: colors.errorLight, padding: spacing.lg, borderRadius: borderRadius.md, alignItems: 'center', marginTop: 16 }}
            >
              <Text style={{ color: colors.error, fontWeight: '600', fontSize: 16 }}>Delete Event</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Event Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => { setEditModalVisible(false); setDetailModalVisible(true); }}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Edit Event</Text>
              <TouchableOpacity onPress={handleUpdate} disabled={updateEvent.isPending}>
                <Text style={{ color: updateEvent.isPending ? colors.textTertiary : primaryColor, fontSize: 16, fontWeight: '600' }}>
                  {updateEvent.isPending ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: spacing.lg }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Event Title *</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
                placeholder="e.g., Floor Game Night" placeholderTextColor={colors.textTertiary}
                value={editEvent.title} onChangeText={(text) => setEditEvent({ ...editEvent, title: text })}
              />
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Description</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16, height: 100, textAlignVertical: 'top' }}
                multiline placeholder="What's the event about?" placeholderTextColor={colors.textTertiary}
                value={editEvent.description} onChangeText={(text) => setEditEvent({ ...editEvent, description: text })}
              />
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Location</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
                placeholder={`${user?.floor || 'Floor'} Common Area`} placeholderTextColor={colors.textTertiary}
                value={editEvent.location} onChangeText={(text) => setEditEvent({ ...editEvent, location: text })}
              />
              <PickerButton icon="calendar-outline" label="Event Date" value={format(editEvent.date, 'EEEE, dd MMMM yyyy')} onPress={() => setShowEditDatePicker(true)} />
              {showEditDatePicker && (
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, marginBottom: 16, overflow: 'hidden' }}>
                  <DateTimePicker
                    value={editEvent.date} mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    themeVariant={colors.background === '#0f1419' ? 'dark' : 'light'}
                    accentColor={primaryColor}
                    onChange={(e, date) => { if (Platform.OS === 'android') setShowEditDatePicker(false); if (date) setEditEvent({ ...editEvent, date }); }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowEditDatePicker(false)} style={{ alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 15 }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <PickerButton icon="time-outline" label="Event Time" value={format(editEvent.time, 'h:mm a')} onPress={() => setShowEditTimePicker(true)} />
              {showEditTimePicker && (
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, marginBottom: 16, overflow: 'hidden' }}>
                  <DateTimePicker
                    value={editEvent.time} mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                    themeVariant={colors.background === '#0f1419' ? 'dark' : 'light'}
                    accentColor={primaryColor}
                    onChange={(e, time) => { if (Platform.OS === 'android') setShowEditTimePicker(false); if (time) setEditEvent({ ...editEvent, time }); }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowEditTimePicker(false)} style={{ alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 15 }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={{ height: 100 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Create Event Modal */}
      <Modal visible={createModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>New Floor Event</Text>
              <TouchableOpacity onPress={handleCreate} disabled={createEvent.isPending}>
                <Text style={{ color: createEvent.isPending ? colors.textTertiary : primaryColor, fontSize: 16, fontWeight: '600' }}>
                  {createEvent.isPending ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: spacing.lg }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Event Title *</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
                placeholder="e.g., Floor Game Night" placeholderTextColor={colors.textTertiary}
                value={newEvent.title} onChangeText={(text) => setNewEvent({ ...newEvent, title: text })} autoFocus
              />
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Description</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16, height: 100, textAlignVertical: 'top' }}
                multiline placeholder="What's the event about?" placeholderTextColor={colors.textTertiary}
                value={newEvent.description} onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
              />
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Location</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
                placeholder={`${user?.floor || 'Floor'} Common Area`} placeholderTextColor={colors.textTertiary}
                value={newEvent.location} onChangeText={(text) => setNewEvent({ ...newEvent, location: text })}
              />
              <PickerButton icon="calendar-outline" label="Event Date" value={format(newEvent.date, 'EEEE, dd MMMM yyyy')} onPress={() => setShowCreateDatePicker(true)} />
              {showCreateDatePicker && (
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, marginBottom: 16, overflow: 'hidden' }}>
                  <DateTimePicker
                    value={newEvent.date} mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    themeVariant={colors.background === '#0f1419' ? 'dark' : 'light'}
                    accentColor={primaryColor}
                    onChange={(e, date) => { if (Platform.OS === 'android') setShowCreateDatePicker(false); if (date) setNewEvent({ ...newEvent, date }); }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowCreateDatePicker(false)} style={{ alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 15 }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <PickerButton icon="time-outline" label="Event Time" value={format(newEvent.time, 'h:mm a')} onPress={() => setShowCreateTimePicker(true)} />
              {showCreateTimePicker && (
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, marginBottom: 16, overflow: 'hidden' }}>
                  <DateTimePicker
                    value={newEvent.time} mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                    themeVariant={colors.background === '#0f1419' ? 'dark' : 'light'}
                    accentColor={primaryColor}
                    onChange={(e, time) => { if (Platform.OS === 'android') setShowCreateTimePicker(false); if (time) setNewEvent({ ...newEvent, time }); }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowCreateTimePicker(false)} style={{ alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 15 }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={{ height: 100 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
