import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';

export default function RAFloorManagementScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { user } = useAuth();
  const [selectedResidents, setSelectedResidents] = useState([]);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [primaryResident, setPrimaryResident] = useState(null);
  const queryClient = useQueryClient();

  const { data: residents, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['floorResidents'],
    queryFn: async () => {
      const response = await api.get('/floor/users');
      return response.data;
    },
  });

  // Fetch floor events
  const { data: floorEvents, isLoading: loadingFloorEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['floorEventsPreview', user?.floor],
    queryFn: async () => {
      try {
        // First try floor-events endpoint
        const floorResponse = await api.get('/floor-events');
        if (floorResponse.data && floorResponse.data.length > 0) {
          const events = floorResponse.data
            .sort((a, b) => new Date(b.date || b.start_time || 0) - new Date(a.date || a.start_time || 0))
            .slice(0, 3);
          return events;
        }
        
        // Fallback: get general events (most recent first)
        const generalResponse = await api.get('/events');
        const allEvents = generalResponse.data || [];
        const recent = allEvents
          .sort((a, b) => new Date(b.date || b.start_time || 0) - new Date(a.date || a.start_time || 0))
          .slice(0, 3);
        return recent;
      } catch (error) {
        console.log('Error fetching floor events:', error);
        return [];
      }
    },
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Refetch events when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetchEvents();
    }, [refetchEvents])
  );

  const handleCall = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleEmail = (email) => {
    if (email) {
      Linking.openURL(`mailto:${email}`);
    }
  };

  const handleMessage = (resident) => {
    setPrimaryResident(resident);
    setSelectedResidents([resident]);
    setMessageModalVisible(true);
  };

  const toggleResidentSelection = (resident) => {
    if (resident.id === primaryResident?.id) return; // Can't deselect primary
    
    setSelectedResidents(prev => {
      const isSelected = prev.some(r => r.id === resident.id);
      if (isSelected) {
        return prev.filter(r => r.id !== resident.id);
      } else {
        return [...prev, resident];
      }
    });
  };

  const startGroupMessage = () => {
    setMessageModalVisible(false);
    
    if (selectedResidents.length === 1) {
      // Direct message to single person
      const resident = selectedResidents[0];
      navigation.getParent()?.navigate('Messages', {
        screen: 'Chat',
        params: { 
          id: resident.id || resident._id,
          name: `${resident.first_name} ${resident.last_name}`,
          type: 'direct',
          userId: resident.id || resident._id,
          isNew: true,
        },
      });
    } else {
      // Group message - navigate to MessagesMain to create group
      navigation.getParent()?.navigate('Messages', {
        screen: 'MessagesMain',
      });
      // Show alert about creating group
      setTimeout(() => {
        Alert.alert(
          'Create Group Chat',
          `To message ${selectedResidents.length} people, tap the group icon (orange) to create a new group chat.`,
          [{ text: 'OK' }]
        );
      }, 500);
    }
    
    setSelectedResidents([]);
    setPrimaryResident(null);
  };

  const renderResident = ({ item }) => (
    <View
      style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 50,
            height: 50,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: 25,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.primary }}>
            {item.first_name?.[0]}{item.last_name?.[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
            {item.room || item.floor || 'Room not assigned'}
          </Text>
          {item.email && (
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              {item.email}
            </Text>
          )}
        </View>
      </View>
      
      {/* Quick Actions */}
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        <TouchableOpacity
          onPress={() => handleMessage(item)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceSecondary,
            paddingVertical: 10,
            borderRadius: borderRadius.md,
          }}
        >
          <Ionicons name="chatbubble" size={18} color={primaryColor} />
          <Text style={{ color: colors.primary, fontWeight: '500', marginLeft: 6 }}>Message</Text>
        </TouchableOpacity>
        {item.phone && (
          <TouchableOpacity
            onPress={() => handleCall(item.phone)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: primaryColor + '15',
              paddingVertical: 10,
              borderRadius: borderRadius.md,
            }}
          >
            <Ionicons name="call" size={18} color={primaryColor} />
            <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 6 }}>Call</Text>
          </TouchableOpacity>
        )}
        {item.email && (
          <TouchableOpacity
            onPress={() => handleEmail(item.email)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: primaryColor + '15',
              paddingVertical: 10,
              borderRadius: borderRadius.md,
            }}
          >
            <Ionicons name="mail" size={18} color={primaryColor} />
            <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 6 }}>Email</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['top', 'bottom']}>
      {/* Stats Header */}
      <View style={{ backgroundColor: colors.surface, padding: spacing.lg, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
              {residents?.length || 0}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Total Residents</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: primaryColor }}>
              {residents?.filter(r => r.status === 'active').length || residents?.length || 0}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Active</Text>
          </View>
        </View>
      </View>

      {/* Floor Events Preview */}
      <View style={{ backgroundColor: colors.surface, padding: spacing.lg, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Floor Events</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('RAFloorEvents')}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <Text style={{ color: colors.primary, fontWeight: '500', marginRight: 4 }}>Manage</Text>
            <Ionicons name="chevron-forward" size={16} color={primaryColor} />
          </TouchableOpacity>
        </View>
        
        {loadingFloorEvents ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator size="small" color={primaryColor} />
          </View>
        ) : floorEvents && floorEvents.length > 0 ? (
          floorEvents.map((event, index) => (
            <TouchableOpacity
              key={event.id || index}
              onPress={() => navigation.navigate('RAFloorEvents')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: index < floorEvents.length - 1 ? 1 : 0,
                borderBottomColor: colors.surfaceSecondary,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: borderRadius.md,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="calendar" size={18} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }} numberOfLines={1}>{event.title}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {event.date || event.start_time 
                    ? format(new Date(event.date || event.start_time), 'MMM d, yyyy')
                    : 'Date TBD'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No upcoming events</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('RAFloorEvents')}
              style={{ marginTop: 8 }}
            >
              <Text style={{ color: colors.primary, fontWeight: '500' }}>+ Create Event</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Residents Section Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.background }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Residents</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={residents}
          keyExtractor={(item, index) => item.id || item.email || `item-${index}`}
          renderItem={renderResident}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>No residents found</Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}

      {/* Message Modal - Add others to conversation */}
      <Modal visible={messageModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMessageModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => { setMessageModalVisible(false); setSelectedResidents([]); setPrimaryResident(null); }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>New Message</Text>
            <TouchableOpacity onPress={startGroupMessage}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Start</Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ padding: spacing.lg, backgroundColor: colors.background }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
              Messaging: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{primaryResident?.first_name} {primaryResident?.last_name}</Text>
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              Add others from your floor to create a group message:
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }}>
            {residents?.filter(r => r.id !== primaryResident?.id).map((resident) => {
              const isSelected = selectedResidents.some(r => r.id === resident.id);
              return (
                <TouchableOpacity
                  key={resident.id}
                  onPress={() => toggleResidentSelection(resident)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.lg,
                    backgroundColor: isSelected ? `${primaryColor}15` : colors.surface,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surfaceSecondary,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: isSelected ? primaryColor : colors.border,
                      borderRadius: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    {isSelected ? (
                      <Ionicons name="checkmark" size={20} color={colors.textInverse} />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                        {resident.first_name?.[0]}{resident.last_name?.[0]}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textPrimary }}>
                      {resident.first_name} {resident.last_name}
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                      {resident.room || 'Room N/A'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedResidents.length > 1 && (
            <View style={{ padding: spacing.lg, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                {selectedResidents.length} people selected for group message
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
