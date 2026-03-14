import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import ModuleHeader from '../../components/ModuleHeader';

export default function ParcelsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;

  const [activeTab, setActiveTab] = useState('pending');

  const { data: parcels, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['parcels'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.PARCELS);
      return response.data;
    },
  });

  const getStatusInfo = (status) => {
    switch (status) {
      case 'waiting':
      case 'pending':
        return { color: colors.warning, bg: colors.warningLight, label: 'Awaiting Pickup', icon: 'time' };
      case 'ready':
        return { color: primaryColor, bg: primaryColor + '15', label: 'Ready for Pickup', icon: 'checkmark-circle' };
      case 'collected':
        return { color: colors.textSecondary, bg: colors.surfaceSecondary, label: 'Collected', icon: 'cube' };
      default:
        return { color: colors.textSecondary, bg: colors.surfaceSecondary, label: status, icon: 'cube' };
    }
  };

  const filteredParcels = parcels?.filter((p) => {
    if (activeTab === 'pending') return p.status === 'waiting' || p.status === 'pending' || p.status === 'ready';
    return p.status === 'collected';
  }) || [];

  const renderParcel = ({ item }) => {
    const statusInfo = getStatusInfo(item.status);
    
    return (
      <View style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderLeftWidth: 3,
        borderLeftColor: statusInfo.color,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{
            width: 48,
            height: 48,
            backgroundColor: statusInfo.bg,
            borderRadius: borderRadius.md,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.md,
          }}>
            <Ionicons name={statusInfo.icon} size={22} color={statusInfo.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.label }}>{item.description || 'Package'}</Text>
            <Text style={{ ...typography.bodySmall, marginTop: 4 }}>
              From: {item.sender || 'Unknown sender'}
            </Text>
            {item.tracking_number && (
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2, fontFamily: 'monospace' }}>
                #{item.tracking_number}
              </Text>
            )}
          </View>
          <View style={{
            backgroundColor: statusInfo.bg,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: borderRadius.sm,
          }}>
            <Text style={{ color: statusInfo.color, fontSize: 11, fontWeight: '600' }}>
              {statusInfo.label}
            </Text>
          </View>
        </View>
        
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          marginTop: spacing.md, 
          paddingTop: spacing.md, 
          borderTopWidth: 1, 
          borderTopColor: colors.borderLight,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
              {item.received_date ? format(new Date(item.received_date), 'MMM d, yyyy') : 'Date not available'}
            </Text>
          </View>
          {item.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>{item.location}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const tabs = [
    { key: 'pending', label: 'Pending', count: parcels?.filter(p => p.status !== 'collected').length || 0 },
    { key: 'collected', label: 'Collected', count: parcels?.filter(p => p.status === 'collected').length || 0 },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ModuleHeader title="Parcels" onBack={() => navigation.goBack()} />
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
            <Text style={{ 
              fontWeight: '600', 
              color: activeTab === tab.key ? primaryColor : colors.textTertiary,
              fontSize: 14,
            }}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={{
                backgroundColor: activeTab === tab.key ? primaryColor : colors.surfaceSecondary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: borderRadius.full,
                marginLeft: spacing.xs,
              }}>
                <Text style={{ 
                  fontSize: 11, 
                  fontWeight: '700', 
                  color: activeTab === tab.key ? colors.textInverse : colors.textTertiary,
                }}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={filteredParcels}
          keyExtractor={(item, index) => item.id || `parcel-${index}`}
          renderItem={renderParcel}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xxxxl, alignItems: 'center' }}>
              <View style={{
                width: 72,
                height: 72,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: borderRadius.xl,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: spacing.lg,
              }}>
                <Ionicons name="cube-outline" size={32} color={colors.textTertiary} />
              </View>
              <Text style={{ ...typography.bodyMedium }}>
                {activeTab === 'pending' ? 'No packages waiting' : 'No collected packages'}
              </Text>
              <Text style={{ ...typography.bodySmall, marginTop: spacing.xs, textAlign: 'center' }}>
                {activeTab === 'pending' 
                  ? 'When you receive a package, it will appear here' 
                  : 'Your collected packages will be shown here'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: spacing.lg }}
        />
      )}
    </SafeAreaView>
  );
}
