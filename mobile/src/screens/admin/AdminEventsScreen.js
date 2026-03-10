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
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import AdminScreenHeader from '../../components/AdminScreenHeader';
import { formatDate, formatDateTime, formatDateLong, formatForApi, isSameDay, DATE_FORMATS } from '../../utils/dateUtils';
import { useTenant } from '../../contexts/TenantContext';

export default function AdminEventsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showRsvpDatePicker, setShowRsvpDatePicker] = useState(false);
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    location: '',
    category: 'social',
    date: new Date(),
    time: '18:00',
    rsvp_deadline: addDays(new Date(), -1),
    max_attendees: '',
  });
  const queryClient = useQueryClient();

  const { data: events, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminEvents'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.EVENTS);
      return response.data;
    },
  });

  const createEvent = useMutation({
    mutationFn: async (data) => {
      // Combine date and time
      const [hours, minutes] = data.time.split(':').map(Number);
      let eventDate = new Date(data.date);
      eventDate = setHours(eventDate, hours);
      eventDate = setMinutes(eventDate, minutes);
      
      const payload = {
        title: data.title,
        description: data.description,
        location: data.location,
        category: data.category,
        date: eventDate.toISOString(),
        rsvp_deadline: data.rsvp_deadline ? data.rsvp_deadline.toISOString() : null,
        max_attendees: data.max_attendees ? parseInt(data.max_attendees) : null,
      };
      
      const response = await api.post(ENDPOINTS.EVENTS, payload);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Event created successfully!');
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['adminEvents'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create event');
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ eventId, data }) => {
      // Combine date and time
      const [hours, minutes] = data.time.split(':').map(Number);
      let eventDate = new Date(data.date);
      eventDate = setHours(eventDate, hours);
      eventDate = setMinutes(eventDate, minutes);
      
      const payload = {
        title: data.title,
        description: data.description,
        location: data.location,
        category: data.category,
        date: eventDate.toISOString(),
        rsvp_deadline: data.rsvp_deadline ? data.rsvp_deadline.toISOString() : null,
        max_attendees: data.max_attendees ? parseInt(data.max_attendees) : null,
      };
      
      const response = await api.put(`${ENDPOINTS.EVENTS}/${eventId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Event updated successfully!');
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['adminEvents'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update event');
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId) => {
      await api.delete(`${ENDPOINTS.EVENTS}/${eventId}`);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Event deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['adminEvents'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete event');
    },
  });

  const closeModal = () => {
    setModalVisible(false);
    setEditMode(false);
    setEditingEventId(null);
    // Reset all picker states
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowRsvpDatePicker(false);
    resetForm();
  };

  const openEditModal = (event) => {
    // Close any open picker modals first
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowRsvpDatePicker(false);
    
    const eventDate = event.date ? new Date(event.date) : new Date();
    const timeStr = event.date 
      ? format(new Date(event.date), 'HH:mm')
      : '18:00';
    
    setNewEvent({
      title: event.title || '',
      description: event.description || '',
      location: event.location || '',
      category: event.category || 'social',
      date: eventDate,
      time: timeStr,
      rsvp_deadline: event.rsvp_deadline ? new Date(event.rsvp_deadline) : addDays(new Date(), -1),
      max_attendees: event.max_attendees ? String(event.max_attendees) : '',
    });
    setEditingEventId(event.id);
    setEditMode(true);
    setModalVisible(true);
  };

  const handleDeleteEvent = (event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEvent.mutate(event.id) },
      ]
    );
  };

  const resetForm = () => {
    setNewEvent({
      title: '',
      description: '',
      location: '',
      category: 'social',
      date: new Date(),
      time: '18:00',
      rsvp_deadline: addDays(new Date(), -1),
      max_attendees: '',
    });
  };

  const handleCreate = () => {
    if (!newEvent.title.trim() || !newEvent.description.trim() || !newEvent.location.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    if (editMode && editingEventId) {
      updateEvent.mutate({ eventId: editingEventId, data: newEvent });
    } else {
      createEvent.mutate(newEvent);
    }
  };

  const categories = ['social', 'academic', 'sports', 'cultural', 'other'];
  
  // Generate date options (today + next 30 days)
  const dateOptions = Array.from({ length: 31 }, (_, i) => addDays(new Date(), i));
  
  // Generate time options (hourly from 6am to 11pm)
  const timeOptions = [];
  for (let h = 6; h <= 23; h++) {
    timeOptions.push(`${h.toString().padStart(2, '0')}:00`);
    timeOptions.push(`${h.toString().padStart(2, '0')}:30`);
  }

  const renderEvent = ({ item }) => (
    <TouchableOpacity
      onPress={() => openEditModal(item)}
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
            <Ionicons name="calendar-outline" size={14} color={colors.secondary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 4 }}>
              {item.date ? formatDateTime(item.date) : 'TBD'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="location-outline" size={14} color={colors.secondary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 4 }}>
              {item.location}
            </Text>
          </View>
          {item.rsvp_deadline && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <Text style={{ fontSize: 12, color: primaryColor, marginLeft: 4 }}>
                RSVP by: {format(new Date(item.rsvp_deadline), 'MMM d')}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="people" size={16} color={colors.secondary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 4 }}>
              {item.attendees?.length || 0}{item.max_attendees ? `/${item.max_attendees}` : ''}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: borderRadius.sm,
              marginTop: 6,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>
              {item.category}
            </Text>
          </View>
        </View>
      </View>
      {/* Edit/Delete buttons */}
      <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.surfaceSecondary, gap: 10 }}>
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primaryColor,
            paddingVertical: 8,
            borderRadius: borderRadius.sm,
          }}
        >
          <Ionicons name="create-outline" size={16} color={colors.surface} />
          <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6, fontSize: 14 }}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteEvent(item)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.error,
            paddingVertical: 8,
            borderRadius: borderRadius.sm,
          }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.surface} />
          <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6, fontSize: 14 }}>Delete</Text>
        </TouchableOpacity>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Events"
        subtitle={`${events.length} event${events.length !== 1 ? 's' : ''}`}
        onBack={() => navigation.goBack()}
        onAdd={() => setModalVisible(true)}
      />

      <FlatList
        data={events}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderEvent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
              No events yet
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 16 }}
      />

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
              {editMode ? 'Edit Event' : 'New Event'}
            </Text>
            <TouchableOpacity onPress={handleCreate} disabled={createEvent.isPending || updateEvent.isPending}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                {editMode 
                  ? (updateEvent.isPending ? 'Saving...' : 'Save')
                  : (createEvent.isPending ? 'Creating...' : 'Create')
                }
              </Text>
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView 
              style={{ flex: 1, padding: spacing.lg }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 150 }}
              showsVerticalScrollIndicator={true}
            >
            {/* Title */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Title *</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="Event title"
              placeholderTextColor={colors.textTertiary}
              value={newEvent.title}
              onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
            />

            {/* Location */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Location *</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="Event location"
              placeholderTextColor={colors.textTertiary}
              value={newEvent.location}
              onChangeText={(text) => setNewEvent({ ...newEvent, location: text })}
            />

            {/* Date Picker */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Date *</Text>
            <TouchableOpacity
              onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}
              style={{
                backgroundColor: `${primaryColor}12`,
                borderRadius: borderRadius.md,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 2,
                borderColor: primaryColor,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar" size={22} color={primaryColor} />
                <Text style={{ fontSize: 16, color: primaryColor, fontWeight: '600', marginLeft: 10 }}>
                  {formatDate(newEvent.date)}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={primaryColor} />
            </TouchableOpacity>

            {/* Time Picker */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Time *</Text>
            <TouchableOpacity
              onPress={() => { Keyboard.dismiss(); setShowTimePicker(true); }}
              style={{
                backgroundColor: `${primaryColor}12`,
                borderRadius: borderRadius.md,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 2,
                borderColor: primaryColor,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time" size={22} color={primaryColor} />
                <Text style={{ fontSize: 16, color: primaryColor, fontWeight: '600', marginLeft: 10 }}>
                  {newEvent.time}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={primaryColor} />
            </TouchableOpacity>

            {/* RSVP Deadline */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>RSVP Deadline</Text>
            <TouchableOpacity
              onPress={() => { Keyboard.dismiss(); setShowRsvpDatePicker(true); }}
              style={{
                backgroundColor: `${primaryColor}12`,
                borderRadius: borderRadius.md,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 2,
                borderColor: primaryColor,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="alarm" size={22} color={primaryColor} />
                <Text style={{ fontSize: 16, color: primaryColor, fontWeight: '600', marginLeft: 10 }}>
                  {formatDate(newEvent.rsvp_deadline)}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={primaryColor} />
            </TouchableOpacity>

            {/* Max Attendees */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Max Attendees (optional)</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="Leave empty for unlimited"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              value={newEvent.max_attendees}
              onChangeText={(text) => setNewEvent({ ...newEvent, max_attendees: text })}
            />

            {/* Category */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setNewEvent({ ...newEvent, category: cat })}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: newEvent.category === cat ? primaryColor : colors.surfaceSecondary,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: newEvent.category === cat ? colors.surface : colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Description */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Description *</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, height: 120, textAlignVertical: 'top', marginBottom: 24 }}
              multiline
              placeholder="Event description..."
              placeholderTextColor={colors.textTertiary}
              value={newEvent.description}
              onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
            />
          </ScrollView>
          </KeyboardAvoidingView>
          
          {/* Date Picker - Native Calendar */}
          {showDatePicker && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 18, fontWeight: '600' }}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={newEvent.date instanceof Date ? newEvent.date : new Date()}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setNewEvent({ ...newEvent, date: selectedDate });
                    }
                    if (Platform.OS === 'android') setShowDatePicker(false);
                  }}
                  accentColor={primaryColor}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            </View>
          )}

          {/* Time Picker - Native */}
          {showTimePicker && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 18, fontWeight: '600' }}>Select Time</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={(() => {
                    const [h, m] = (newEvent.time || '09:00').split(':').map(Number);
                    const d = new Date(); d.setHours(h, m, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  display="spinner"
                  minuteInterval={15}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const hours = selectedDate.getHours().toString().padStart(2, '0');
                      const mins = selectedDate.getMinutes().toString().padStart(2, '0');
                      setNewEvent({ ...newEvent, time: `${hours}:${mins}` });
                    }
                    if (Platform.OS === 'android') setShowTimePicker(false);
                  }}
                  accentColor={primaryColor}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            </View>
          )}

          {/* RSVP Date Picker - Native Calendar */}
          {showRsvpDatePicker && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 18, fontWeight: '600' }}>RSVP Deadline</Text>
                  <TouchableOpacity onPress={() => setShowRsvpDatePicker(false)}>
                    <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={newEvent.rsvp_deadline instanceof Date ? newEvent.rsvp_deadline : new Date()}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setNewEvent({ ...newEvent, rsvp_deadline: selectedDate });
                    }
                    if (Platform.OS === 'android') setShowRsvpDatePicker(false);
                  }}
                  accentColor={primaryColor}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
