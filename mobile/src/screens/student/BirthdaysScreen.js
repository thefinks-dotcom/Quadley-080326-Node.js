import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format, isToday, isTomorrow, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';
import { colors as defaultColors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function BirthdaysScreen() {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const [activeTab, setActiveTab] = useState('upcoming');

  const { data: birthdays, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['birthdays'],
    queryFn: async () => { const r = await api.get(ENDPOINTS.BIRTHDAYS); return r.data; },
  });

  const filterBirthdays = () => {
    if (!birthdays) return [];
    const now = new Date();
    return birthdays.filter(b => {
      if (!b.birthday) return false;
      const bday = parseISO(b.birthday); bday.setFullYear(now.getFullYear());
      switch (activeTab) {
        case 'today': return isToday(bday);
        case 'week': return isThisWeek(bday);
        default: return isThisMonth(bday) || bday > now;
      }
    }).sort((a, b) => {
      const da = parseISO(a.birthday); const db = parseISO(b.birthday);
      da.setFullYear(now.getFullYear()); db.setFullYear(now.getFullYear());
      return da - db;
    });
  };

  const getBirthdayLabel = (str) => {
    if (!str) return '';
    const bday = parseISO(str); bday.setFullYear(new Date().getFullYear());
    if (isToday(bday)) return 'Today!';
    if (isTomorrow(bday)) return 'Tomorrow';
    return format(bday, 'MMM d');
  };

  const filtered = filterBirthdays();
  const todayCount = birthdays?.filter(b => { if (!b.birthday) return false; const d = parseISO(b.birthday); d.setFullYear(new Date().getFullYear()); return isToday(d); })?.length || 0;

  const renderBirthday = ({ item }) => {
    const label = getBirthdayLabel(item.birthday);
    const isTodays = label === 'Today!';
    return (
      <View style={{
        backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
        borderRadius: borderRadius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: isTodays ? primaryColor : colors.border,
      }}>
        <View style={{
          width: 44, height: 44, backgroundColor: isTodays ? primaryColor + '15' : colors.surfaceSecondary,
          borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
        }}>
          {isTodays ? <Ionicons name="gift" size={20} color={primaryColor} />
            : <Text style={{ fontSize: 16, fontWeight: '700', color: primaryColor, letterSpacing: -0.3 }}>{item.first_name?.[0]}{item.last_name?.[0]}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{item.first_name} {item.last_name}</Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{item.floor || 'Resident'}</Text>
        </View>
        <View style={{ backgroundColor: isTodays ? primaryColor : colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.sm }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: isTodays ? colors.textInverse : primaryColor }}>{label}</Text>
        </View>
      </View>
    );
  };

  const tabs = [
    { key: 'today', label: 'Today', icon: 'gift-outline' },
    { key: 'week', label: 'This Week', icon: 'calendar-outline' },
    { key: 'upcoming', label: 'Upcoming', icon: 'arrow-forward-outline' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']} data-testid="birthdays-screen">
      <AnimatedScreen>
      {/* Header */}
      <View style={{
        backgroundColor: primaryColor, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
        borderBottomLeftRadius: borderRadius.xxl, borderBottomRightRadius: borderRadius.xxl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="gift" size={22} color={colors.textInverse} />
          </View>
          <View style={{ marginLeft: spacing.md }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>Birthdays</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
              {todayCount > 0 ? `${todayCount} birthday${todayCount > 1 ? 's' : ''} today!` : 'Celebrate your community'}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md,
        backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 3,
      }}>
        {tabs.map(tab => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} data-testid={`tab-${tab.key}`}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm + 2,
              backgroundColor: activeTab === tab.key ? colors.surface : 'transparent',
              ...(activeTab === tab.key ? shadows.sm : {}),
            }}>
            <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? primaryColor : colors.textTertiary} />
            <Text style={{ marginLeft: 5, fontWeight: '600', fontSize: 12, color: activeTab === tab.key ? colors.textPrimary : colors.textTertiary }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={primaryColor} /></View>
      ) : (
        <FlatList data={filtered} keyExtractor={(i, idx) => i.id || `item-${idx}`} renderItem={renderBirthday}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                <Ionicons name="gift-outline" size={24} color={colors.textTertiary} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>No birthdays {activeTab === 'today' ? 'today' : activeTab === 'week' ? 'this week' : 'coming up'}</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>Check back later</Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 20 }}
        />
      )}
      </AnimatedScreen>
    </SafeAreaView>
  );
}
