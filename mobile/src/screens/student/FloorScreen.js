import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { colors as defaultColors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function FloorScreen({ navigation }) {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('residents');
  const [residents, setResidents] = useState([]);
  const [floorEvents, setFloorEvents] = useState([]);
  const [raInfo, setRaInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isRA = user?.role === 'ra';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const fetchData = useCallback(async () => {
    try {
      let residentsData = [];
      if (isAdmin) {
        const response = await api.get('/admin/users');
        residentsData = response.data.filter(u => u.role === 'student' || u.role === 'ra');
      } else {
        const response = await api.get('/floor/users');
        residentsData = response.data || [];
      }
      setResidents(residentsData);
      setRaInfo(residentsData.find(u => u.role === 'ra'));

      let eventsData = [];
      try {
        const floorResponse = await api.get('/floor-events');
        eventsData = floorResponse.data?.length ? floorResponse.data : [];
        if (!eventsData.length) throw new Error('empty');
      } catch {
        const eventsResponse = await api.get(ENDPOINTS.EVENTS);
        eventsData = (eventsResponse.data || []).filter(e =>
          e.floor === user?.floor || e.event_type === 'floor' || e.category === 'floor_event'
        );
      }
      eventsData.sort((a, b) => new Date(a.date || a.start_time || 0) - new Date(b.date || b.start_time || 0));
      setFloorEvents(eventsData);
    } catch (error) {
      console.error('Error fetching floor data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, user?.floor]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleEventPress = (event) => {
    const message = `${event.description || 'No description'}\n\nDate: ${event.date ? new Date(event.date).toLocaleDateString() : 'TBD'}\nLocation: ${event.location || 'TBD'}`;
    if (isRA) {
      Alert.alert(event.title, message, [
        { text: 'Edit Event', onPress: () => navigation.navigate('RAFloorEvents', { editEvent: event }) },
        { text: 'Close', style: 'cancel' },
      ]);
    } else {
      Alert.alert(event.title, message, [{ text: 'OK' }]);
    }
  };

  const startChat = (resident) => {
    navigation.navigate('Messages', {
      screen: 'Chat',
      params: { id: resident.id, name: `${resident.first_name} ${resident.last_name}`, type: 'direct', userId: resident.id, isNew: true },
    });
  };

  const renderResident = ({ item }) => (
    <TouchableOpacity
      onPress={() => startChat(item)}
      activeOpacity={0.7}
      data-testid={`resident-${item.id}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{
        width: 44, height: 44,
        backgroundColor: primaryColor + '12',
        borderRadius: borderRadius.md,
        justifyContent: 'center', alignItems: 'center',
        marginRight: spacing.md,
      }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: primaryColor, letterSpacing: -0.3 }}>
          {item.first_name?.[0]}{item.last_name?.[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.2 }}>
            {item.first_name} {item.last_name}
          </Text>
          {item.role === 'ra' && (
            <View style={{
              backgroundColor: primaryColor,
              paddingHorizontal: 6, paddingVertical: 2,
              borderRadius: borderRadius.sm,
              marginLeft: spacing.sm,
            }}>
              <Text style={{ color: colors.textInverse, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>RA</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2, letterSpacing: 0.1 }}>
          Room {item.room_number || item.room || 'N/A'}
        </Text>
      </View>
      <View style={{
        width: 36, height: 36,
        backgroundColor: primaryColor + '0A',
        borderRadius: borderRadius.md,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Ionicons name="chatbubble-outline" size={18} color={primaryColor} />
      </View>
    </TouchableOpacity>
  );

  const renderEvent = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleEventPress(item)}
      activeOpacity={0.7}
      data-testid={`floor-event-${item.id}`}
      style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {/* Top accent bar */}
      <View style={{ height: 3, backgroundColor: primaryColor }} />
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.2 }} numberOfLines={2}>
              {item.title}
            </Text>
            {item.description && (
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
          {isRA && (
            <View style={{
              backgroundColor: primaryColor + '12',
              paddingHorizontal: 8, paddingVertical: 4,
              borderRadius: borderRadius.sm,
              marginLeft: spacing.sm,
            }}>
              <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>Edit</Text>
            </View>
          )}
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          marginTop: spacing.md, paddingTop: spacing.md,
          borderTopWidth: 1, borderTopColor: colors.borderLight,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4, fontWeight: '500' }}>
              {item.date ? new Date(item.date).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD'}
            </Text>
          </View>
          {item.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4, fontWeight: '500' }}>
                {item.location}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']} data-testid="floor-screen">
      <AnimatedScreen>
      {/* Header */}
      <View style={{
        backgroundColor: primaryColor,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        borderBottomLeftRadius: borderRadius.xxl,
        borderBottomRightRadius: borderRadius.xxl,
      }}>
        <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>
          {isAdmin ? 'Student Directory' : (user?.floor || 'My Floor')}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
          {isAdmin ? `${residents.length} students` : `${residents.length} residents · ${floorEvents.length} upcoming`}
        </Text>

        {raInfo && !isRA && (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            marginTop: spacing.md,
            backgroundColor: 'rgba(255,255,255,0.12)',
            padding: spacing.md,
            borderRadius: borderRadius.md,
          }}>
            <View style={{
              width: 32, height: 32,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: borderRadius.sm,
              justifyContent: 'center', alignItems: 'center',
              marginRight: spacing.sm,
            }}>
              <Ionicons name="shield-checkmark" size={16} color={colors.textInverse} />
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Your RA
              </Text>
              <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 14 }}>
                {raInfo.first_name} {raInfo.last_name}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row',
        marginHorizontal: spacing.lg,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: colors.surfaceSecondary,
        borderRadius: borderRadius.md,
        padding: 3,
      }}>
        {[
          { key: 'residents', label: 'Residents', count: residents.length, icon: 'people-outline' },
          { key: 'events', label: 'Events', count: floorEvents.length, icon: 'calendar-outline' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            data-testid={`tab-${tab.key}`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.sm + 2,
              borderRadius: borderRadius.sm + 2,
              backgroundColor: activeTab === tab.key ? colors.surface : 'transparent',
              ...(activeTab === tab.key ? shadows.sm : {}),
            }}
          >
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? primaryColor : colors.textTertiary} />
            <Text style={{
              marginLeft: 6,
              fontWeight: '600',
              fontSize: 13,
              color: activeTab === tab.key ? colors.textPrimary : colors.textTertiary,
            }}>
              {tab.label}
            </Text>
            <View style={{
              backgroundColor: activeTab === tab.key ? primaryColor + '18' : colors.border,
              paddingHorizontal: 6, paddingVertical: 1,
              borderRadius: 10,
              marginLeft: 6,
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

      {/* RA Manage Button */}
      {isRA && activeTab === 'events' && (
        <TouchableOpacity
          onPress={() => navigation.navigate('RAFloorEvents')}
          activeOpacity={0.8}
          data-testid="manage-events-btn"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primaryColor,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.md,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
          }}
        >
          <Ionicons name="settings-outline" size={18} color={colors.textInverse} />
          <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 14, marginLeft: spacing.sm }}>
            Manage Floor Events
          </Text>
        </TouchableOpacity>
      )}

      {/* List */}
      <FlatList
        data={activeTab === 'residents' ? residents : floorEvents}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={activeTab === 'residents' ? renderResident : renderEvent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} colors={[primaryColor]} />
        }
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
            <View style={{
              width: 56, height: 56,
              backgroundColor: colors.surfaceSecondary,
              borderRadius: borderRadius.lg,
              justifyContent: 'center', alignItems: 'center',
              marginBottom: spacing.lg,
            }}>
              <Ionicons
                name={activeTab === 'residents' ? 'people-outline' : 'calendar-outline'}
                size={24}
                color={colors.textTertiary}
              />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
              {activeTab === 'residents' ? 'No residents found' : 'No floor events yet'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>
              {activeTab === 'residents' ? 'Check back later' : 'Events will appear here when created'}
            </Text>
            {isRA && activeTab === 'events' && (
              <TouchableOpacity
                onPress={() => navigation.navigate('RAFloorEvents', { openCreate: true })}
                style={{
                  marginTop: spacing.lg,
                  backgroundColor: primaryColor + '12',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: borderRadius.md,
                }}
              >
                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 14 }}>+ Create First Event</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      </AnimatedScreen>

      {/* FAB for RAs */}
      {isRA && activeTab === 'events' && (
        <TouchableOpacity
          onPress={() => navigation.navigate('RAFloorEvents', { openCreate: true })}
          activeOpacity={0.8}
          testID="add-event-fab"
          style={{
            position: 'absolute',
            bottom: 24, right: 24,
            width: 52, height: 52,
            backgroundColor: primaryColor,
            borderRadius: borderRadius.xl,
            justifyContent: 'center', alignItems: 'center',
            ...shadows.lg,
          }}
        >
          <Ionicons name="add" size={26} color={colors.textInverse} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
