import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import ModuleHeader from '../../components/ModuleHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';
import { colors as defaultColors, spacing, borderRadius, shadows } from '../../theme';
import { useTenant } from '../../contexts/TenantContext';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function DiningScreen({ navigation }) {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [lateMealModalVisible, setLateMealModalVisible] = useState(false);
  const [viewAllRequestsModal, setViewAllRequestsModal] = useState(false);
  const [editRequestModal, setEditRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [dietaryRequirements, setDietaryRequirements] = useState('');
  const [editMealType, setEditMealType] = useState(null);
  const [editDietaryRequirements, setEditDietaryRequirements] = useState('');
  const queryClient = useQueryClient();

  const { data: menu, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['diningMenu', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.DINING}/menu?date=${format(selectedDate, 'yyyy-MM-dd')}`);
      return response.data;
    },
  });
  const { data: lateMeals, refetch: refetchLateMeals } = useQuery({
    queryKey: ['lateMeals'],
    queryFn: async () => { const r = await api.get(ENDPOINTS.LATE_MEALS); return r.data; },
  });

  const requestLateMeal = useMutation({
    mutationFn: async (mealType) => {
      const r = await api.post(ENDPOINTS.LATE_MEALS, { meal_type: mealType, date: format(selectedDate, 'yyyy-MM-dd'), reason: 'Late meal request', dietary_requirements: dietaryRequirements || null });
      return r.data;
    },
    onSuccess: () => { Alert.alert('Success', 'Late meal requested!'); setLateMealModalVisible(false); setDietaryRequirements(''); queryClient.invalidateQueries({ queryKey: ['lateMeals'] }); },
    onError: (e) => { Alert.alert('Error', e.response?.data?.detail || 'Failed to request late meal'); },
  });
  const updateLateMeal = useMutation({
    mutationFn: async ({ requestId, mealType, dietaryReqs }) => {
      const r = await api.put(`${ENDPOINTS.LATE_MEALS}/${requestId}`, { meal_type: mealType, date: selectedRequest?.date || format(selectedDate, 'yyyy-MM-dd'), reason: 'Late meal request', dietary_requirements: dietaryReqs || null });
      return r.data;
    },
    onSuccess: () => { Alert.alert('Success', 'Request updated!'); setEditRequestModal(false); setSelectedRequest(null); queryClient.invalidateQueries({ queryKey: ['lateMeals'] }); },
    onError: (e) => { Alert.alert('Error', e.response?.data?.detail || 'Failed to update'); },
  });
  const cancelLateMeal = useMutation({
    mutationFn: async (id) => { await api.delete(`${ENDPOINTS.LATE_MEALS}/${id}`); },
    onSuccess: () => { Alert.alert('Success', 'Request cancelled'); setViewAllRequestsModal(false); queryClient.invalidateQueries({ queryKey: ['lateMeals'] }); },
    onError: (e) => { Alert.alert('Error', e.response?.data?.detail || 'Failed to cancel'); },
  });

  const confirmLateMealRequest = () => { if (selectedMealType) requestLateMeal.mutate(selectedMealType); };
  const openEditModal = (req) => { setViewAllRequestsModal(false); setSelectedRequest(req); setEditMealType(req.meal_type); setEditDietaryRequirements(req.dietary_requirements || ''); setTimeout(() => setEditRequestModal(true), 100); };
  const handleUpdateRequest = () => { if (selectedRequest && editMealType) updateLateMeal.mutate({ requestId: selectedRequest.id, mealType: editMealType, dietaryReqs: editDietaryRequirements }); };
  const handleCancelRequest = (id) => { Alert.alert('Cancel Request', 'Are you sure?', [{ text: 'No', style: 'cancel' }, { text: 'Yes', style: 'destructive', onPress: () => cancelLateMeal.mutate(id) }]); };

  const getMealIcon = (t) => { const type = t?.toLowerCase(); return type === 'breakfast' ? 'sunny' : type === 'lunch' ? 'restaurant' : type === 'dinner' ? 'moon' : 'cafe'; };

  const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const groupedMenu = MEAL_TYPES.map(m => ({ meal_type: m, items: (menu || []).filter(i => i.meal_type?.toLowerCase() === m.toLowerCase()) })).filter(g => g.items.length > 0);
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

  const renderMeal = ({ item }) => (
    <View style={{ backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      <View style={{ height: 3, backgroundColor: primaryColor }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.surfaceSecondary }}>
        <View style={{ width: 32, height: 32, backgroundColor: primaryColor + '12', borderRadius: borderRadius.sm, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name={getMealIcon(item.meal_type)} size={16} color={primaryColor} />
        </View>
        <Text style={{ color: colors.textPrimary, fontWeight: '600', marginLeft: 10, textTransform: 'capitalize', fontSize: 15 }}>{item.meal_type}</Text>
        <Text style={{ color: colors.textTertiary, marginLeft: 'auto', fontSize: 12, fontWeight: '500' }}>{item.items?.length || 0} items</Text>
      </View>
      <View style={{ padding: spacing.lg }}>
        {item.items?.length > 0 ? item.items.map((mi, idx) => (
          <View key={mi.id || idx} style={{ marginBottom: idx < item.items.length - 1 ? 12 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: 5, height: 5, backgroundColor: primaryColor, borderRadius: 3, marginRight: 10, marginTop: 7 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{mi.name}</Text>
                {mi.description && <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{mi.description}</Text>}
                {mi.dietary_tags?.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 }}>
                    {mi.dietary_tags.map((tag, ti) => (
                      <View key={ti} style={{ backgroundColor: primaryColor + '12', paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm }}>
                        <Text style={{ fontSize: 10, color: primaryColor, fontWeight: '500' }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        )) : <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 8 }}>No items available</Text>}
        <TouchableOpacity onPress={() => { setSelectedMealType(item.meal_type.toLowerCase()); setLateMealModalVisible(true); }} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: primaryColor + '08', paddingVertical: 10, borderRadius: borderRadius.md, borderWidth: 1, borderColor: primaryColor + '20' }}>
          <Ionicons name="time-outline" size={16} color={primaryColor} />
          <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 6, fontSize: 13 }}>Request Late Meal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={primaryColor} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']} data-testid="dining-screen">
      <ModuleHeader title="Dining" onBack={() => navigation.goBack()} />
      <AnimatedScreen>

      {/* Date Selector */}
      <FlatList
        horizontal data={weekDates} keyExtractor={(i) => i.toISOString()} showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}
        renderItem={({ item }) => {
          const isSelected = format(item, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isToday = format(item, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          return (
            <TouchableOpacity onPress={() => setSelectedDate(item)} style={{
              width: 52, height: 68, backgroundColor: isSelected ? primaryColor : colors.surface,
              borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4,
              borderWidth: isSelected ? 0 : 1, borderColor: colors.border,
            }}>
              <Text style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,0.7)' : colors.textTertiary, fontWeight: '600', letterSpacing: 0.3 }}>{format(item, 'EEE')}</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isSelected ? colors.textInverse : colors.textPrimary, marginTop: 2 }}>{format(item, 'd')}</Text>
              {isToday && <View style={{ width: 5, height: 5, backgroundColor: isSelected ? colors.textInverse : primaryColor, borderRadius: 3, marginTop: 3 }} />}
            </TouchableOpacity>
          );
        }}
      />

      {/* Menu */}
      <FlatList
        data={groupedMenu} keyExtractor={(i, idx) => `meal-${i.meal_type}-${idx}`} renderItem={renderMeal}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />}
        ListHeaderComponent={lateMeals?.length > 0 ? (
          <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.2 }}>Recent Requests</Text>
              <View style={{ backgroundColor: primaryColor, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm }}>
                <Text style={{ color: colors.textInverse, fontSize: 11, fontWeight: '700' }}>{lateMeals.length}</Text>
              </View>
            </View>
            {[...lateMeals].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at)).slice(0, 2).map((req, idx) => (
              <TouchableOpacity key={idx} onPress={() => (!req.status || req.status === 'pending') && openEditModal(req)} activeOpacity={(!req.status || req.status === 'pending') ? 0.7 : 1}
                style={{ backgroundColor: colors.surface, padding: 12, borderRadius: borderRadius.md, marginBottom: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <View style={{ width: 36, height: 36, backgroundColor: primaryColor + '12', borderRadius: borderRadius.sm, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <Ionicons name={getMealIcon(req.meal_type)} size={16} color={primaryColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, textTransform: 'capitalize' }}>{req.meal_type}</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{req.date}</Text>
                </View>
                <View style={{ backgroundColor: req.status === 'rejected' ? colors.errorLight : primaryColor + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: req.status === 'rejected' ? colors.error : primaryColor, textTransform: 'capitalize' }}>{req.status || 'Pending'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
              <Ionicons name="restaurant-outline" size={24} color={colors.textTertiary} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>No menu available</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>Check back for this date</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      </AnimatedScreen>

      {/* Late Meal Modal */}
      <Modal visible={lateMealModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLateMealModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setLateMealModalVisible(false)}><Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text></TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Request Late Meal</Text>
              <View style={{ width: 50 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
              <View style={{ backgroundColor: primaryColor + '10', padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 20, borderWidth: 1, borderColor: primaryColor + '20' }}>
                <Text style={{ fontSize: 14, color: primaryColor, fontWeight: '500' }}>Select a meal for {format(selectedDate, 'EEEE, MMMM d')}.</Text>
              </View>
              {['breakfast', 'lunch', 'dinner'].map(meal => (
                <TouchableOpacity key={meal} onPress={() => setSelectedMealType(meal)} style={{
                  flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
                  backgroundColor: selectedMealType === meal ? primaryColor + '10' : colors.surface,
                  borderRadius: borderRadius.md, marginBottom: spacing.sm,
                  borderWidth: selectedMealType === meal ? 2 : 1, borderColor: selectedMealType === meal ? primaryColor : colors.border,
                }}>
                  <View style={{ width: 44, height: 44, backgroundColor: primaryColor + '12', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                    <Ionicons name={getMealIcon(meal)} size={20} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, textTransform: 'capitalize' }}>{meal}</Text>
                    <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{meal === 'breakfast' ? '7–9 AM' : meal === 'lunch' ? '12–2 PM' : '6–8 PM'}</Text>
                  </View>
                  {selectedMealType === meal && <Ionicons name="checkmark-circle" size={22} color={primaryColor} />}
                </TouchableOpacity>
              ))}
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6, marginTop: spacing.md }}>Dietary Requirements (Optional)</Text>
              <TextInput style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 16, minHeight: 48 }}
                placeholder="e.g., Vegetarian, Gluten-free..." placeholderTextColor={colors.textTertiary} value={dietaryRequirements} onChangeText={setDietaryRequirements} returnKeyType="done" blurOnSubmit />
              <TouchableOpacity onPress={confirmLateMealRequest} disabled={!selectedMealType || requestLateMeal.isPending}
                style={{ backgroundColor: selectedMealType ? primaryColor : colors.border, paddingVertical: 14, borderRadius: borderRadius.md, alignItems: 'center' }}>
                <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 15 }}>{requestLateMeal.isPending ? 'Requesting...' : 'Confirm Request'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* View All Modal */}
      <Modal visible={viewAllRequestsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewAllRequestsModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={() => setViewAllRequestsModal(false)}><Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text></TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Late Meal Requests</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            {lateMeals?.length > 0 ? [...lateMeals].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at)).map((req, idx) => (
              <View key={req.id || idx} style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '12', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name={getMealIcon(req.meal_type)} size={18} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, textTransform: 'capitalize' }}>{req.meal_type}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{req.date}</Text>
                  </View>
                  <View style={{ backgroundColor: req.status === 'rejected' ? colors.errorLight : primaryColor + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.sm }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: req.status === 'rejected' ? colors.error : primaryColor, textTransform: 'capitalize' }}>{req.status || 'Pending'}</Text>
                  </View>
                </View>
                {req.dietary_requirements && <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Diet: {req.dietary_requirements}</Text>}
                {(!req.status || req.status === 'pending') && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity onPress={() => openEditModal(req)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: primaryColor, paddingVertical: 8, borderRadius: borderRadius.sm }}>
                      <Ionicons name="create-outline" size={15} color={colors.textInverse} /><Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleCancelRequest(req.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorLight, paddingVertical: 8, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.error + '30' }}>
                      <Ionicons name="trash-outline" size={15} color={colors.error} /><Text style={{ color: colors.error, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )) : <View style={{ padding: 40, alignItems: 'center' }}><Ionicons name="time-outline" size={40} color={colors.textTertiary} /><Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 12 }}>No requests yet</Text></View>}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editRequestModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditRequestModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setEditRequestModal(false)}><Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text></TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Edit Request</Text>
            <TouchableOpacity onPress={handleUpdateRequest} disabled={updateLateMeal.isPending}>
              <Text style={{ color: updateLateMeal.isPending ? colors.textTertiary : primaryColor, fontSize: 16, fontWeight: '600' }}>{updateLateMeal.isPending ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Meal Type</Text>
            {['breakfast', 'lunch', 'dinner'].map(meal => (
              <TouchableOpacity key={meal} onPress={() => setEditMealType(meal)} style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md,
                backgroundColor: editMealType === meal ? primaryColor + '10' : colors.surfaceSecondary,
                borderRadius: borderRadius.md, marginBottom: 8, borderWidth: editMealType === meal ? 2 : 1, borderColor: editMealType === meal ? primaryColor : colors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={getMealIcon(meal)} size={20} color={primaryColor} />
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary, marginLeft: 10, textTransform: 'capitalize' }}>{meal}</Text>
                </View>
                {editMealType === meal && <Ionicons name="checkmark-circle" size={22} color={primaryColor} />}
              </TouchableOpacity>
            ))}
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6, marginTop: 16 }}>Dietary Requirements</Text>
            <TextInput style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, minHeight: 48 }}
              placeholder="e.g., Vegetarian..." placeholderTextColor={colors.textTertiary} value={editDietaryRequirements} onChangeText={setEditDietaryRequirements} returnKeyType="done" blurOnSubmit />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
