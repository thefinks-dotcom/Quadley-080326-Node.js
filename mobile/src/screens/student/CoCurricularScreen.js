import React, { useState, useCallback, useMemo } from 'react';
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import debounce from 'lodash.debounce';
import { useTenant } from '../../contexts/TenantContext';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function CoCurricularScreen() {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;

  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();

  const debouncedSetSearch = useMemo(
    () => debounce((text) => setDebouncedSearch(text), 300),
    []
  );

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    debouncedSetSearch(text);
  };

  const categories = [
    { id: 'all', label: 'All', icon: 'apps' },
    { id: 'cultural', label: 'Cultural', icon: 'color-palette' },
    { id: 'sports', label: 'Sports', icon: 'football' },
    { id: 'clubs', label: 'Clubs', icon: 'people' },
  ];

  const { data: activities, isLoading: loadingActivities, refetch: refetchActivities, isRefetching } = useQuery({
    queryKey: ['cocurricularActivities'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.COCURRICULAR}/groups/all`);
      return response.data?.map(group => ({
        id: group.id,
        title: group.name,
        category: group.type || 'clubs',
        description: group.description,
        schedule: group.meeting_times,
        location: group.other_details,
        participants: group.members || [],
      })) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    
    let filtered = activities;
    
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase().trim();
      filtered = filtered.filter(activity => {
        const title = (activity.title || activity.name || '').toLowerCase();
        const description = (activity.description || '').toLowerCase();
        const category = (activity.category || activity.type || '').toLowerCase();
        const location = (activity.location || '').toLowerCase();
        return title.includes(searchLower) || description.includes(searchLower) || category.includes(searchLower) || location.includes(searchLower);
      });
    }
    
    if (activeCategory !== 'all') {
      filtered = filtered.filter(activity => {
        const cat = (activity.category || activity.type || '').toLowerCase();
        if (activeCategory === 'cultural') return cat.includes('cultural') || cat.includes('arts') || cat.includes('music') || cat.includes('dance') || cat.includes('drama');
        if (activeCategory === 'sports') return cat.includes('sport') || cat.includes('athletic') || cat.includes('fitness');
        if (activeCategory === 'clubs') return cat.includes('club') || cat.includes('community') || cat.includes('academic') || cat.includes('social') || (!cat.includes('cultural') && !cat.includes('sport') && !cat.includes('arts'));
        return true;
      });
    }
    
    return [...filtered].sort((a, b) => {
      const aJoined = a.participants?.some(p => p.user_id === user?.id || p === user?.id);
      const bJoined = b.participants?.some(p => p.user_id === user?.id || p === user?.id);
      if (aJoined !== bJoined) return aJoined ? -1 : 1;
      return 0;
    });
  }, [activities, activeCategory, debouncedSearch, user]);

  const signUp = useMutation({
    mutationFn: async (activityId) => {
      const response = await api.post(`${ENDPOINTS.COCURRICULAR}/groups/${activityId}/join`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'You have signed up for this activity!');
      setDetailModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['cocurricularActivities'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to sign up');
    },
  });

  const getCategoryIcon = useCallback((category) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('sport') || cat.includes('athletic')) return { name: 'football', color: primaryColor };
    if (cat.includes('cultural') || cat.includes('arts') || cat.includes('music')) return { name: 'color-palette', color: primaryColor };
    if (cat.includes('dance') || cat.includes('drama')) return { name: 'musical-notes', color: primaryColor };
    if (cat.includes('community') || cat.includes('social')) return { name: 'people', color: primaryColor };
    if (cat.includes('academic')) return { name: 'school', color: primaryColor };
    return { name: 'star', color: colors.textTertiary };
  }, [primaryColor]);

  const renderActivity = useCallback(({ item }) => {
    const icon = getCategoryIcon(item.category || item.type);
    const isJoined = item.participants?.some(p => p.user_id === user?.id || p === user?.id);
    
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedActivity(item);
          setDetailModalVisible(true);
        }}
        activeOpacity={0.7}
        style={{
          backgroundColor: colors.surface,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          borderLeftWidth: isJoined ? 3 : 0,
          borderLeftColor: primaryColor,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ padding: spacing.lg }}>
          {isJoined && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginBottom: spacing.sm,
              backgroundColor: primaryColor + '15',
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: borderRadius.sm,
              alignSelf: 'flex-start',
            }}>
              <Ionicons name="checkmark-circle" size={14} color={primaryColor} />
              <Text style={{ fontSize: 11, color: primaryColor, fontWeight: '700', marginLeft: 4 }}>Joined</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 48,
                height: 48,
                backgroundColor: `${icon.color}15`,
                borderRadius: borderRadius.md,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: spacing.md,
              }}
            >
              <Ionicons name={icon.name} size={22} color={icon.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.label }}>{item.title || item.name}</Text>
              <Text style={{ ...typography.bodySmall, marginTop: 2 }}>{item.category || item.type}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="people" size={16} color={colors.textTertiary} />
                <Text style={{ fontSize: 14, color: colors.textTertiary, marginLeft: 4 }}>{item.participants?.length || 0}</Text>
              </View>
            </View>
          </View>
          {(item.schedule || item.meeting_times) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 4 }}>{item.schedule || item.meeting_times}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [getCategoryIcon, user]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      {/* Search Bar */}
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          backgroundColor: colors.surfaceSecondary, 
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            placeholder="Search activities..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            style={{ flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, fontSize: 15, color: colors.textPrimary, letterSpacing: 0 }}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setDebouncedSearch(''); }}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Tabs */}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, height: 60 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, alignItems: 'center', height: 60 }}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                marginRight: spacing.sm,
                borderRadius: borderRadius.full,
                backgroundColor: activeCategory === cat.id ? primaryColor : colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: activeCategory === cat.id ? primaryColor : colors.border,
              }}
            >
              <Ionicons name={cat.icon} size={18} color={activeCategory === cat.id ? colors.textInverse : colors.textTertiary} />
              <Text style={{ marginLeft: spacing.sm, fontWeight: '600', color: activeCategory === cat.id ? colors.textInverse : colors.textTertiary }}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {debouncedSearch.trim() && (
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surfaceSecondary }}>
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
            {filteredActivities.length} result{filteredActivities.length !== 1 ? 's' : ''} for "{debouncedSearch}"
          </Text>
        </View>
      )}

      {loadingActivities ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item, index) => item.id || `item-${index}`}
          renderItem={renderActivity}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchActivities} tintColor={primaryColor} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xxxxl, alignItems: 'center' }}>
              <View style={{ width: 64, height: 64, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                <Ionicons name={debouncedSearch ? "search-outline" : "flag-outline"} size={28} color={colors.textTertiary} />
              </View>
              <Text style={{ ...typography.bodyMedium, textAlign: 'center' }}>
                {debouncedSearch ? `No activities found for "${debouncedSearch}"` : 'No activities in this category'}
              </Text>
              {debouncedSearch && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setDebouncedSearch(''); }} style={{ marginTop: spacing.md }}>
                  <Text style={{ color: primaryColor, fontWeight: '600' }}>Clear search</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={{ paddingVertical: spacing.lg }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}

      {/* Activity Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={{ padding: spacing.xs }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={{ ...typography.h3 }}>Activity Details</Text>
            <View style={{ width: 32 }} />
          </View>
          {selectedActivity && (
            <ScrollView style={{ flex: 1 }}>
              <View style={{ padding: spacing.xl }}>
                <View style={{ width: 64, height: 64, backgroundColor: `${getCategoryIcon(selectedActivity.category).color}15`, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                  <Ionicons name={getCategoryIcon(selectedActivity.category).name} size={32} color={getCategoryIcon(selectedActivity.category).color} />
                </View>
                <Text style={{ ...typography.h1, marginBottom: spacing.sm }}>{selectedActivity.title}</Text>
                <View style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md, alignSelf: 'flex-start' }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{selectedActivity.category}</Text>
                </View>

                <View style={{ marginTop: spacing.xxl }}>
                  {selectedActivity.schedule && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                      <View style={{ width: 36, height: 36, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md }}>
                        <Ionicons name="time" size={18} color={colors.textSecondary} />
                      </View>
                      <Text style={{ fontSize: 15, color: colors.textSecondary }}>{selectedActivity.schedule}</Text>
                    </View>
                  )}
                  {selectedActivity.location && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                      <View style={{ width: 36, height: 36, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md }}>
                        <Ionicons name="location" size={18} color={colors.textSecondary} />
                      </View>
                      <Text style={{ fontSize: 15, color: colors.textSecondary }}>{selectedActivity.location}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                    <View style={{ width: 36, height: 36, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md }}>
                      <Ionicons name="people" size={18} color={colors.textSecondary} />
                    </View>
                    <Text style={{ fontSize: 15, color: colors.textSecondary }}>{selectedActivity.participants?.length || 0} participants</Text>
                  </View>
                </View>

                {selectedActivity.description && (
                  <View style={{ marginTop: spacing.xxl }}>
                    <Text style={{ ...typography.label, marginBottom: spacing.sm }}>About</Text>
                    <Text style={{ ...typography.body, lineHeight: 24 }}>{selectedActivity.description}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => signUp.mutate(selectedActivity.id)}
                  disabled={signUp.isPending}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: primaryColor,
                    paddingVertical: spacing.lg,
                    borderRadius: borderRadius.md,
                    alignItems: 'center',
                    marginTop: spacing.xxxl,
                    opacity: signUp.isPending ? 0.7 : 1,
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ ...typography.button }}>{signUp.isPending ? 'Signing up...' : 'Sign Up for Activity'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
