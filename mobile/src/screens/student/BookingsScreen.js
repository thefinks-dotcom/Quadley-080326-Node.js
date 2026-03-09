import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { format, addDays } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function BookingsScreen() {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;

  const [activeTab, setActiveTab] = useState('facilities');
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('10:00');
  const queryClient = useQueryClient();

  const { data: facilities, isLoading: loadingFacilities, refetch: refetchFacilities, isRefetching } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      return [
        { id: '1', name: 'Study Room A', type: 'study room', location: 'Level 1', capacity: 6, available: true },
        { id: '2', name: 'Music Room', type: 'music room', location: 'Level 2', capacity: 4, available: true },
        { id: '3', name: 'Common Room', type: 'common room', location: 'Ground Floor', capacity: 20, available: true },
        { id: '4', name: 'Gym', type: 'gym', location: 'Basement', capacity: 15, available: true },
        { id: '5', name: 'Kitchen', type: 'kitchen', location: 'Level 1', capacity: 8, available: true },
      ];
    },
  });

  const { data: myBookings, isLoading: loadingBookings, refetch: refetchBookings } = useQuery({
    queryKey: ['myBookings'],
    queryFn: async () => {
      const response = await api.get('/bookings');
      return response.data;
    },
  });

  const createBooking = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/bookings', {
        facility: selectedFacility?.name,
        date: data.date,
        duration: data.duration || 60,
        purpose: 'Facility booking',
        booking_type: 'facility',
      });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Booking confirmed!');
      setBookingModalVisible(false);
      setSelectedFacility(null);
      queryClient.invalidateQueries(['myBookings']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create booking');
    },
  });

  const getFacilityIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'study room': return 'book';
      case 'music room': return 'musical-notes';
      case 'common room': return 'people';
      case 'gym': return 'fitness';
      case 'kitchen': return 'restaurant';
      default: return 'cube';
    }
  };

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  const renderFacility = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedFacility(item);
        setBookingModalVisible(true);
      }}
      activeOpacity={0.7}
      style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
      }}
    >
      <View style={{
        width: 52,
        height: 52,
        backgroundColor: `${primaryColor}15`,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
      }}>
        <Ionicons name={getFacilityIcon(item.type)} size={24} color={primaryColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.label }}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 4 }}>{item.location}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <Ionicons name="people-outline" size={14} color={colors.textTertiary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 4 }}>Capacity: {item.capacity}</Text>
        </View>
      </View>
      <View style={{
        backgroundColor: item.available ? primaryColor + '15' : colors.errorLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
      }}>
        <Text style={{ color: item.available ? primaryColor : colors.error, fontSize: 11, fontWeight: '600' }}>
          {item.available ? 'Available' : 'Busy'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderBooking = ({ item }) => (
    <View style={{
      backgroundColor: colors.surface,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ ...typography.label }}>{item.facility || item.title || 'Booking'}</Text>
        <View style={{
          backgroundColor: item.status === 'confirmed' ? primaryColor + '15' : colors.warningLight,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          borderRadius: borderRadius.sm,
        }}>
          <Text style={{ 
            color: item.status === 'confirmed' ? primaryColor : colors.warning, 
            fontSize: 11, 
            fontWeight: '600',
            textTransform: 'capitalize',
          }}>
            {item.status || 'Pending'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 4 }}>
          {item.date ? format(new Date(item.date), 'EEE, MMM d, yyyy') : 'Date TBD'}
        </Text>
      </View>
      {item.time && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 4 }}>{item.time}</Text>
        </View>
      )}
    </View>
  );

  const tabs = [
    { key: 'facilities', label: 'Facilities', icon: 'cube-outline' },
    { key: 'mybookings', label: 'My Bookings', icon: 'calendar-outline' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      {/* Tab Bar */}
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: colors.surface, 
        paddingHorizontal: spacing.lg, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.border,
      }}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{ 
              flex: 1, 
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.md, 
              borderBottomWidth: 2, 
              borderBottomColor: activeTab === tab.key ? primaryColor : 'transparent',
            }}
          >
            <Ionicons 
              name={tab.icon} 
              size={18} 
              color={activeTab === tab.key ? primaryColor : colors.textTertiary} 
            />
            <Text style={{ 
              marginLeft: spacing.xs,
              fontWeight: '600', 
              color: activeTab === tab.key ? primaryColor : colors.textTertiary,
              fontSize: 14,
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'facilities' ? (
        loadingFacilities ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <FlatList
            data={facilities}
            keyExtractor={(item) => item.id}
            renderItem={renderFacility}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchFacilities} tintColor={primaryColor} />}
            ListEmptyComponent={
              <View style={{ padding: spacing.xxxxl, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                  <Ionicons name="cube-outline" size={28} color={colors.textTertiary} />
                </View>
                <Text style={{ ...typography.bodyMedium }}>No facilities available</Text>
              </View>
            }
            contentContainerStyle={{ paddingVertical: spacing.lg }}
          />
        )
      ) : (
        loadingBookings ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <FlatList
            data={myBookings}
            keyExtractor={(item, index) => item.id || `booking-${index}`}
            renderItem={renderBooking}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refetchBookings} tintColor={primaryColor} />}
            ListEmptyComponent={
              <View style={{ padding: spacing.xxxxl, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                  <Ionicons name="calendar-outline" size={28} color={colors.textTertiary} />
                </View>
                <Text style={{ ...typography.bodyMedium }}>No bookings yet</Text>
                <Text style={{ ...typography.bodySmall, marginTop: spacing.xs }}>Book a facility to get started</Text>
              </View>
            }
            contentContainerStyle={{ paddingVertical: spacing.lg }}
          />
        )
      )}

      {/* Booking Modal */}
      <Modal visible={bookingModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBookingModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setBookingModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={{ ...typography.h3 }}>Book {selectedFacility?.name}</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView style={{ flex: 1 }}>
            <View style={{ padding: spacing.lg }}>
              {/* Date Selection */}
              <Text style={{ ...typography.caption, marginBottom: spacing.md }}>SELECT DATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xxl }}>
                {dates.map((date, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedDate(date)}
                    style={{
                      width: 64,
                      paddingVertical: spacing.md,
                      borderRadius: borderRadius.md,
                      backgroundColor: format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') ? primaryColor : colors.surfaceSecondary,
                      marginRight: spacing.sm,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') ? primaryColor : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') ? colors.textInverse : colors.textTertiary, fontWeight: '500' }}>
                      {format(date, 'EEE')}
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') ? colors.textInverse : colors.textPrimary, marginTop: 2 }}>
                      {format(date, 'd')}
                    </Text>
                    <Text style={{ fontSize: 11, color: format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') ? colors.textInverse : colors.textTertiary }}>
                      {format(date, 'MMM')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Time Selection */}
              <Text style={{ ...typography.caption, marginBottom: spacing.md }}>SELECT TIME</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xxl }}>
                {timeSlots.map((time) => (
                  <TouchableOpacity
                    key={time}
                    onPress={() => setSelectedTime(time)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: borderRadius.md,
                      backgroundColor: selectedTime === time ? primaryColor : colors.surfaceSecondary,
                      marginRight: spacing.sm,
                      marginBottom: spacing.sm,
                      borderWidth: 1,
                      borderColor: selectedTime === time ? primaryColor : colors.border,
                    }}
                  >
                    <Text style={{ color: selectedTime === time ? colors.textInverse : colors.textSecondary, fontWeight: '500', fontSize: 14 }}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                onPress={() => createBooking.mutate({ date: `${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`, duration: 60 })}
                disabled={createBooking.isPending}
                style={{
                  backgroundColor: primaryColor,
                  paddingVertical: spacing.lg,
                  borderRadius: borderRadius.md,
                  alignItems: 'center',
                  opacity: createBooking.isPending ? 0.7 : 1,
                  ...shadows.sm,
                }}
              >
                <Text style={{ ...typography.button }}>
                  {createBooking.isPending ? 'Booking...' : 'Confirm Booking'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
