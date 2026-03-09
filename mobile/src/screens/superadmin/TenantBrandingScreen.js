import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { buildCategoryAccents } from '../../utils/colorUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_SCALE = 0.48;
const PREVIEW_WIDTH = SCREEN_WIDTH - 40;
const MOCK_WIDTH = PREVIEW_WIDTH / PREVIEW_SCALE;

const PRESETS = [
  { id: 'classic_blue', name: 'Blue', primary: colors.primary, secondary: colors.borderDark },
  { id: 'modern_purple', name: 'Purple', primary: colors.primary, secondary: colors.primaryLight },
  { id: 'nature_green', name: 'Green', primary: colors.primary, secondary: colors.primaryLight },
  { id: 'warm_orange', name: 'Orange', primary: colors.warning, secondary: colors.warningLight },
  { id: 'slate', name: 'Slate', primary: colors.textSecondary, secondary: colors.borderDark },
  { id: 'rose', name: 'Rose', primary: colors.error, secondary: colors.errorLight },
];

// Inline color swatch strip
const SwatchStrip = ({ value, onChange, swatches }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {swatches.map((c) => (
      <TouchableOpacity
        key={c}
        onPress={() => onChange(c)}
        data-testid={`swatch-${c.replace('#','')}`}
        style={{
          width: 32,
          height: 32,
          borderRadius: borderRadius.sm,
          backgroundColor: c,
          borderWidth: value?.toUpperCase() === c.toUpperCase() ? 3 : 1,
          borderColor: value?.toUpperCase() === c.toUpperCase() ? colors.primary : colors.border,
        }}
      />
    ))}
  </View>
);

// --------------- Mock Student Home Preview ---------------
const MockStudentHomePreview = React.memo(({ primaryColor, secondaryColor, tenantName }) => {
  const pc = primaryColor || colors.primary;
  const bgColor = secondaryColor || colors.borderDark;
  const accents = useMemo(() => buildCategoryAccents(pc), [pc]);

  const categories = [
    {
      title: 'Campus Life',
      modules: [
        { icon: 'calendar-outline', label: 'Calendar' },
        { icon: 'chatbubbles-outline', label: 'Messages' },
        { icon: 'newspaper-outline', label: 'News' },
        { icon: 'restaurant-outline', label: 'Dining' },
      ],
    },
    {
      title: 'Community',
      modules: [
        { icon: 'people-outline', label: 'My Floor' },
        { icon: 'star-outline', label: 'Shoutouts' },
        { icon: 'gift-outline', label: 'Birthdays' },
        { icon: 'flag-outline', label: 'Activities' },
      ],
    },
    {
      title: 'Services',
      modules: [
        { icon: 'construct-outline', label: 'Fixes' },
        { icon: 'cube-outline', label: 'Parcels' },
        { icon: 'calendar-number-outline', label: 'Bookings' },
        { icon: 'card-outline', label: 'Finance' },
      ],
    },
    {
      title: 'Growth & Wellbeing',
      modules: [
        { icon: 'book-outline', label: 'Study' },
        { icon: 'briefcase-outline', label: 'Jobs' },
        { icon: 'heart-outline', label: 'Wellbeing' },
        { icon: 'shield-checkmark-outline', label: 'Safety' },
      ],
    },
  ];

  return (
    <View
      style={{
        width: MOCK_WIDTH,
        transform: [{ scale: PREVIEW_SCALE }],
        transformOrigin: 'top left',
        backgroundColor: bgColor,
        borderRadius: 24,
        overflow: 'hidden',
      }}
    >
      {/* Status bar mock */}
      <View style={{ height: 44, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>9:41</Text>
      </View>

      {/* Header */}
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: '500' }}>Good morning,</Text>
            <Text style={{ fontSize: 26, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5, marginTop: 2 }}>Alex</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: 6,
              backgroundColor: `${pc}15`, paddingHorizontal: 10, paddingVertical: 4,
              borderRadius: 999, alignSelf: 'flex-start',
            }}>
              <Ionicons name="school-outline" size={12} color={pc} />
              <Text style={{ color: pc, fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
                {tenantName || 'College Name'}
              </Text>
            </View>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="notifications-outline" size={20} color={colors.secondary} />
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14 }}>
        {[
          { icon: 'calendar-outline', label: 'Upcoming Events', val: '3', color: pc },
          { icon: 'newspaper-outline', label: 'Latest News', val: '5', color: accents['Community']?.icon || primaryColor },
        ].map((s) => (
          <View key={s.label} style={{
            flex: 1, marginHorizontal: 4,
            backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: 14,
            shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
          }}>
            <View style={{ width: 30, height: 30, borderRadius: borderRadius.md, backgroundColor: `${s.color}18`, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name={s.icon} size={15} color={s.color} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>{s.val}</Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2, fontWeight: '500' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Module Categories */}
      {categories.map((category) => {
        const accent = accents[category.title] || accents['Campus Life'];
        return (
          <View key={category.title} style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: accent.icon, marginRight: 6 }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.3 }}>
                {category.title}
              </Text>
            </View>
            <View style={{
              backgroundColor: accent.cardBg, borderRadius: 18,
              paddingHorizontal: 10, paddingTop: 14, paddingBottom: 4,
              borderWidth: 1.5, borderColor: accent.border,
              shadowColor: accent.icon, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {category.modules.map((m) => (
                  <View key={m.label} style={{ width: '23%', alignItems: 'center', marginBottom: spacing.md }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 14,
                      backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 5,
                      shadowColor: accent.icon, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 5, elevation: 3,
                    }}>
                      <Ionicons name={m.icon} size={20} color={accent.icon} />
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
      })}

      {/* Mock announcement */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: pc, marginRight: 6 }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.3 }}>Latest News</Text>
        </View>
        <View style={{
          backgroundColor: colors.surface, borderRadius: 14, padding: 12,
          borderLeftWidth: 3, borderLeftColor: pc,
          shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>Welcome Week Schedule</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>Activities and events for new students...</Text>
        </View>
      </View>

      {/* Mock Tab Bar */}
      <View style={{
        flexDirection: 'row', backgroundColor: colors.surface,
        borderTopWidth: 1, borderTopColor: colors.border,
        paddingTop: 8, paddingBottom: 8,
      }}>
        {[
          { icon: 'home', label: 'Home', active: true },
          { icon: 'calendar-outline', label: 'Calendar' },
          { icon: 'chatbubbles-outline', label: 'Messages' },
          { icon: 'person-outline', label: 'Profile' },
        ].map((tab) => (
          <View key={tab.label} style={{ flex: 1, alignItems: 'center' }}>
            <Ionicons name={tab.icon} size={20} color={tab.active ? pc : colors.textTertiary} />
            <Text style={{ fontSize: 9, fontWeight: '500', color: tab.active ? pc : colors.textTertiary, marginTop: 2 }}>
              {tab.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

// --------------- Main Screen (single-page: preview + controls) ---------------
export default function TenantBrandingScreen({ route, navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { tenant: initialTenant } = route.params;
  const [branding, setBranding] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tenant-branding', initialTenant.code],
    queryFn: async () => {
      const response = await api.get(`/branding/tenant/${initialTenant.code}`);
      return response.data;
    },
  });

  useEffect(() => {
    if (data?.branding) {
      setBranding(data.branding);
    }
  }, [data]);

  const updateBranding = useMutation({
    mutationFn: async (updates) => {
      const response = await api.put(`/branding/tenant/${initialTenant.code}`, updates);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Published', 'Brand colors saved and published to all users.');
      setHasChanges(false);
      queryClient.invalidateQueries(['tenant-branding', initialTenant.code]);
      queryClient.invalidateQueries(['tenant', initialTenant.code]);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save branding');
    },
  });

  const resetBranding = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/branding/tenant/${initialTenant.code}/reset`);
      return response.data;
    },
    onSuccess: (responseData) => {
      Alert.alert('Reset', 'Branding reset to defaults');
      setBranding(responseData.branding || {});
      setHasChanges(false);
      queryClient.invalidateQueries(['tenant-branding', initialTenant.code]);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to reset');
    },
  });

  const updateField = useCallback((field, value) => {
    setBranding(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    Alert.alert(
      'Publish Changes',
      'This will update the brand colors for all students at this college. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', onPress: () => updateBranding.mutate(branding) },
      ],
    );
  };

  const handleReset = () => {
    Alert.alert('Reset Branding', 'Reset all colors to Quadley defaults?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => resetBranding.mutate() },
    ]);
  };

  const handleApplyPreset = (preset) => {
    setBranding(prev => ({
      ...prev,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Use the same defaults as the real HomeScreen
  const primaryColor = branding.primary_color || colors.primary;
  const secondaryColor = branding.secondary_color || colors.borderDark;

  const PRIMARY_SWATCHES = [
    colors.primary,colors.primary,colors.primary,
    colors.primary,primaryColor,primaryColor,
    primaryColor,primaryColor,primaryColor,
    colors.warning,colors.warning,colors.warning,
    colors.error,colors.error,colors.error,
    colors.error,colors.error,colors.error,
    colors.textPrimary,colors.textPrimary,colors.textSecondary,
    primaryColor,primaryColor,primaryColor,
  ];

  const SECONDARY_SWATCHES = [
    colors.borderDark,colors.borderDark,colors.border,
    primaryColor + '15',primaryColor + '15',primaryColor + '15',
    primaryColor + '15',primaryColor + '15',primaryColor + '15',
    primaryColor + '15',colors.warningLight,colors.warningLight,
    colors.errorLight,colors.errorLight,colors.errorLight,
    colors.surfaceSecondary,colors.background,primaryColor + '15',
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12, padding: 4 }} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Theme Customise</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{initialTenant.name}</Text>
        </View>
        {hasChanges && (
          <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full }}>
            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '600' }}>Unsaved</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: hasChanges ? 100 : 40 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ---- LIVE PREVIEW ---- */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginBottom: 10, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Live Preview
              </Text>
              {/* Color indicator pills */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: primaryColor, marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Primary {primaryColor}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: secondaryColor, marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Background {secondaryColor}</Text>
                </View>
              </View>

              {/* Phone frame */}
              <View style={{
                width: PREVIEW_WIDTH,
                height: (MOCK_WIDTH * 2.6) * PREVIEW_SCALE,
                overflow: 'hidden',
                borderRadius: 20,
                backgroundColor: secondaryColor,
                borderWidth: 2,
                borderColor: colors.textPrimary,
                ...shadows.md,
              }}
              data-testid="phone-preview-frame"
              >
                <MockStudentHomePreview
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  tenantName={initialTenant.name}
                />
              </View>
            </View>

            {/* ---- QUICK PRESETS ---- */}
            <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginBottom: 10, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Quick Presets
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PRESETS.map((preset) => {
                  const isActive = branding.primary_color === preset.primary && branding.secondary_color === preset.secondary;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => handleApplyPreset(preset)}
                      data-testid={`preset-${preset.id}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isActive ? `${preset.primary}15` : colors.surface,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: borderRadius.full,
                        borderWidth: isActive ? 2 : 1,
                        borderColor: isActive ? preset.primary : colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', marginRight: 6 }}>
                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preset.primary }} />
                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preset.secondary, marginLeft: -4, borderWidth: 1, borderColor: colors.surface }} />
                      </View>
                      <Text style={{ fontSize: 13, color: isActive ? preset.primary : colors.textPrimary, fontWeight: isActive ? '700' : '500' }}>{preset.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ---- PRIMARY COLOR PICKER ---- */}
            <View style={{
              marginHorizontal: 20,
              marginTop: 20,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: primaryColor, marginRight: 8 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Primary Color
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 6 }}>
                  (module group shades)
                </Text>
              </View>
              <SwatchStrip value={primaryColor} onChange={(v) => updateField('primary_color', v)} swatches={PRIMARY_SWATCHES} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: borderRadius.sm, backgroundColor: primaryColor, borderWidth: 1, borderColor: colors.border }} />
                <TextInput
                  value={branding.primary_color || ''}
                  onChangeText={(v) => updateField('primary_color', v)}
                  placeholder={primaryColor}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="characters"
                  data-testid="primary-color-input"
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    fontSize: 14,
                    color: colors.textPrimary,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                />
              </View>
            </View>

            {/* ---- SECONDARY (BACKGROUND) COLOR PICKER ---- */}
            <View style={{
              marginHorizontal: 20,
              marginTop: 16,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: secondaryColor, marginRight: 8, borderWidth: 1, borderColor: colors.border }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Background Color
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 6 }}>
                  (screen background)
                </Text>
              </View>
              <SwatchStrip value={secondaryColor} onChange={(v) => updateField('secondary_color', v)} swatches={SECONDARY_SWATCHES} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: borderRadius.sm, backgroundColor: secondaryColor, borderWidth: 1, borderColor: colors.border }} />
                <TextInput
                  value={branding.secondary_color || ''}
                  onChangeText={(v) => updateField('secondary_color', v)}
                  placeholder={colors.borderDark}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="characters"
                  data-testid="secondary-color-input"
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    fontSize: 14,
                    color: colors.textPrimary,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                />
              </View>
            </View>

            {/* ---- IDENTITY (optional) ---- */}
            <View style={{
              marginHorizontal: 20,
              marginTop: 16,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginBottom: 14, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Identity
              </Text>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>App Name</Text>
                <TextInput
                  value={branding.app_name || ''}
                  onChangeText={(v) => updateField('app_name', v)}
                  placeholder={initialTenant.name}
                  placeholderTextColor={colors.textTertiary}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: colors.textPrimary,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                />
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>Tagline</Text>
                <TextInput
                  value={branding.tagline || ''}
                  onChangeText={(v) => updateField('tagline', v)}
                  placeholder="Your campus, your community"
                  placeholderTextColor={colors.textTertiary}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: colors.textPrimary,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Floating action bar */}
      {hasChanges && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 34 : 16,
          flexDirection: 'row',
          gap: 12,
        }}>
          <TouchableOpacity
            onPress={handleReset}
            disabled={resetBranding.isPending}
            data-testid="reset-branding-btn"
            style={{
              flex: 1,
              backgroundColor: colors.errorLight,
              paddingVertical: 14,
              borderRadius: borderRadius.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.error, fontWeight: '600' }}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={updateBranding.isPending}
            data-testid="publish-branding-btn"
            style={{
              flex: 2,
              backgroundColor: primaryColor,
              paddingVertical: 14,
              borderRadius: borderRadius.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {updateBranding.isPending ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={colors.surface} />
                <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6 }}>Publish Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
