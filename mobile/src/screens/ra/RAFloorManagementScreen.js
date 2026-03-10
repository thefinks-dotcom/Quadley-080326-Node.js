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

  const [activeTab, setActiveTab] = useState('events');
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

  const raFloor = user?.floor || user?.student_floor;
  const { data: allUsers, isLoading: loadingStudents } = useQuery({
    queryKey: ['floorStudents', raFloor],
    queryFn: async () => {
      const response = await api.get('/users');
      const users = response.data || [];
      if (!raFloor) return users.filter(u => u.role === 'student');
      return users.filter(u =>
        u.role === 'student' &&
        (u.floor === raFloor || u.student_floor === raFloor)
      );
    },
    enabled: activeTab === 'students',
    staleTime: 60 * 1000,
  });

  const { data: activeRollcalls = [], isLoading: loadingEmergencies, refetch: refetchEmergencies } = useQuery({
    queryKey: ['ra-active-rollcalls'],
    queryFn: async () => {
      try {
        const res = await api.get('/emergency-rollcall/active');
        return res.data || [];
      } catch { return []; }
    },
    enabled: activeTab === 'emergencies',
    refetchInterval: activeTab === 'emergencies' ? 20000 : false,
  });

  const [expandedRollcall, setExpandedRollcall] = useState(null);
  const [rollcallSummaries, setRollcallSummaries] = useState({});
  const [rollcallPeopleModal, setRollcallPeopleModal] = useState({ visible: false, title: '', people: [], color: '', icon: '' });

  const loadRollcallSummary = async (rollcallId) => {
    if (rollcallSummaries[rollcallId]) {
      setExpandedRollcall(expandedRollcall === rollcallId ? null : rollcallId);
      return;
    }
    try {
      const res = await api.get(`/emergency-rollcall/${rollcallId}/summary`);
      setRollcallSummaries(prev => ({ ...prev, [rollcallId]: res.data }));
      setExpandedRollcall(rollcallId);
    } catch {
      Alert.alert('Error', 'Could not load floor responses');
    }
  };

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
      queryClient.invalidateQueries({ queryKey: ['floorEvents'] });
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
      queryClient.invalidateQueries({ queryKey: ['floorEvents'] });
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
      queryClient.invalidateQueries({ queryKey: ['floorEvents'] });
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
              {raFloor ? `Floor ${raFloor}` : 'Your Floor'}
            </Text>
          </View>
          {activeTab === 'events' && (
            <TouchableOpacity
              onPress={() => setCreateModalVisible(true)}
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
          { key: 'events', line1: 'Floor', line2: 'Events', count: floorEvents?.length || 0, icon: 'calendar-outline' },
          { key: 'students', line1: 'Floor', line2: 'Students', count: allUsers?.length || 0, icon: 'people-outline' },
          { key: 'emergencies', line1: 'Emer-', line2: 'gencies', count: activeRollcalls?.length || 0, icon: 'warning-outline', alert: activeRollcalls?.length > 0 },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          const iconColor = isActive ? (tab.alert ? '#D32F2F' : primaryColor) : colors.textTertiary;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                paddingVertical: 12, paddingHorizontal: 4, borderRadius: borderRadius.sm + 2,
                backgroundColor: isActive ? colors.surface : 'transparent',
                ...(isActive ? shadows.sm : {}),
              }}
            >
              <Ionicons name={tab.icon} size={18} color={iconColor} />
              <Text style={{ fontWeight: '700', fontSize: 10, color: isActive ? colors.textPrimary : colors.textTertiary, textAlign: 'center', marginTop: 3, lineHeight: 13 }}>
                {tab.line1}
              </Text>
              <Text style={{ fontWeight: '700', fontSize: 10, color: isActive ? colors.textPrimary : colors.textTertiary, textAlign: 'center', lineHeight: 13 }}>
                {tab.line2}
              </Text>
              {tab.count > 0 && (
                <View style={{
                  backgroundColor: isActive ? (tab.alert ? '#D32F2F' : primaryColor) : colors.border,
                  paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, marginTop: 3,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? '#fff' : colors.textTertiary }}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Events Tab */}
      {activeTab === 'events' && (
        !floorEvents && isLoading ? (
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
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 100 }}
          />
        )
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        loadingStudents ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <FlatList
            data={allUsers}
            keyExtractor={(item, index) => item.id || `student-${index}`}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
                <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500' }}>
                  {allUsers?.length || 0} student{allUsers?.length !== 1 ? 's' : ''} on {raFloor ? `Floor ${raFloor}` : 'your floor'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={{
                backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
                borderRadius: borderRadius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center',
                borderWidth: 1, borderColor: colors.border, ...shadows.sm,
              }}>
                <View style={{
                  width: 44, height: 44, backgroundColor: primaryColor + '15',
                  borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12,
                }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: primaryColor }}>
                    {item.first_name?.[0]}{item.last_name?.[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                    {item.first_name} {item.last_name}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {item.room ? `Room ${item.room}` : item.floor || item.student_floor || 'Floor resident'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {item.email && (
                    <Text style={{ fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>
                      {item.email}
                    </Text>
                  )}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>No students found</Text>
                <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>
                  Students on your floor will appear here
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 100 }}
          />
        )
      )}

      {/* Emergencies Tab */}
      {activeTab === 'emergencies' && (
        loadingEmergencies ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#D32F2F" />
          </View>
        ) : activeRollcalls.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <View style={{ width: 72, height: 72, backgroundColor: '#E8F5E9', borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="shield-checkmark" size={36} color="#2E7D32" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>All Clear</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
              No active emergencies on your floor right now.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={loadingEmergencies} onRefresh={refetchEmergencies} tintColor="#D32F2F" />}
          >
            {activeRollcalls.map(rc => {
              const summary = rollcallSummaries[rc.id];
              const floorData = summary?.floors?.[raFloor];
              return (
                <View key={rc.id} style={{ backgroundColor: '#FFF', borderRadius: borderRadius.lg, marginBottom: spacing.md, overflow: 'hidden', borderWidth: 2, borderColor: '#D32F2F', ...shadows.sm }}>
                  <View style={{ backgroundColor: '#D32F2F', padding: spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="warning" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Emergency Roll Call</Text>
                    </View>
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{rc.announcement_title || 'Emergency'}</Text>
                    {rc.announcement_content ? (
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>{rc.announcement_content}</Text>
                    ) : null}
                  </View>

                  <View style={{ padding: spacing.lg }}>
                    {summary ? (
                      <>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                          {raFloor ? `Floor ${raFloor} Status` : 'Your Floor Status'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                          {[
                            { key: 'evacuated', label: 'Evacuated', icon: 'home', color: '#2E7D32', bg: '#E8F5E9', people: floorData?.evacuated || [] },
                            { key: 'not_at_college', label: 'Off-Campus', icon: 'shield-checkmark', color: '#1565C0', bg: '#E3F2FD', people: floorData?.not_at_college || [] },
                            { key: 'pending', label: 'Pending', icon: 'time', color: '#E65100', bg: '#FFF3E0', people: floorData?.pending || [] },
                          ].map(tile => (
                            <TouchableOpacity
                              key={tile.key}
                              onPress={() => setRollcallPeopleModal({ visible: true, title: tile.label, people: tile.people, color: tile.color, icon: tile.icon })}
                              activeOpacity={0.75}
                              style={{ flex: 1, backgroundColor: tile.bg, borderRadius: borderRadius.md, padding: 12, alignItems: 'center' }}
                            >
                              <Ionicons name={tile.icon} size={20} color={tile.color} />
                              <Text style={{ fontSize: 22, fontWeight: '700', color: tile.color }}>{tile.people.length}</Text>
                              <Text style={{ fontSize: 11, color: tile.color, fontWeight: '600' }}>{tile.label}</Text>
                              {tile.people.length > 0 && (
                                <Ionicons name="chevron-down" size={12} color={tile.color} style={{ marginTop: 2, opacity: 0.7 }} />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>

                        {floorData?.pending?.length > 0 && (
                          <>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#E65100', marginBottom: 8 }}>
                              Awaiting response ({floorData.pending.length}):
                            </Text>
                            {floorData.pending.map((s, idx) => (
                              <View key={s.user_id || idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                <Ionicons name="person-outline" size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                                <Text style={{ fontSize: 14, color: colors.textPrimary, flex: 1 }}>{s.user_name}</Text>
                                <View style={{ backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                  <Text style={{ fontSize: 11, color: '#E65100', fontWeight: '600' }}>No response</Text>
                                </View>
                              </View>
                            ))}
                          </>
                        )}
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={() => loadRollcallSummary(rc.id)}
                        style={{ backgroundColor: '#D32F2F', borderRadius: borderRadius.md, padding: 14, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>View Floor Responses</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )
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
      {/* Emergency People List Modal */}
      <Modal
        visible={rollcallPeopleModal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRollcallPeopleModal(p => ({ ...p, visible: false }))}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setRollcallPeopleModal(p => ({ ...p, visible: false }))}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={rollcallPeopleModal.icon} size={18} color={rollcallPeopleModal.color} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: rollcallPeopleModal.color }}>{rollcallPeopleModal.title}</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>
          {rollcallPeopleModal.people.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
                No students in this category yet
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600', marginBottom: spacing.md }}>
                {rollcallPeopleModal.people.length} student{rollcallPeopleModal.people.length !== 1 ? 's' : ''}
              </Text>
              {rollcallPeopleModal.people.map((s, idx) => {
                const name = s.user_name || s.name || 'Student';
                const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <View key={s.user_id || idx} style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md,
                    padding: spacing.md, marginBottom: spacing.sm,
                  }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: rollcallPeopleModal.color + '20',
                      justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: rollcallPeopleModal.color }}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{name}</Text>
                      {s.room && <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>Room {s.room}</Text>}
                    </View>
                    <View style={{ backgroundColor: rollcallPeopleModal.color + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: rollcallPeopleModal.color }}>{rollcallPeopleModal.title}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
