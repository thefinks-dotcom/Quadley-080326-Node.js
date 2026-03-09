import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTenant } from '../../contexts/TenantContext';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function JobDetailScreen({ route, navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { job } = route.params;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <ScrollView>
        {/* Header */}
        <View
          style={{
            backgroundColor: primaryColor,
            padding: spacing.xxl,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: borderRadius.md,
              alignSelf: 'flex-start',
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.textInverse, fontWeight: '500' }}>
              {job.category}
            </Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textInverse }}>
            {job.title}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}>
              <Ionicons name="time" size={18} color={colors.textInverse} />
              <Text style={{ color: colors.textInverse, marginLeft: 6, fontSize: 15 }}>
                {job.hours_per_week} hrs/week
              </Text>
            </View>
            {job.pay_rate && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cash" size={18} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, marginLeft: 6, fontSize: 15, fontWeight: '600' }}>
                  {job.pay_rate}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ padding: 20 }}>
          {/* Description */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
              Job Description
            </Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 24 }}>
              {job.description}
            </Text>
          </View>

          {/* Requirements */}
          {job.requirements && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                Requirements
              </Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 24 }}>
                {job.requirements}
              </Text>
            </View>
          )}

          {/* Details Card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
              Job Details
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>Status</Text>
              <View
                style={{
                  backgroundColor: job.status === 'active' ? primaryColor + '15' : colors.errorLight,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: borderRadius.sm,
                }}
              >
                <Text
                  style={{
                    color: job.status === 'active' ? primaryColor : colors.error,
                    fontWeight: '500',
                    textTransform: 'capitalize',
                  }}
                >
                  {job.status}
                </Text>
              </View>
            </View>
            {job.location && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Location</Text>
                <Text style={{ fontSize: 14, color: colors.textPrimary }}>{job.location}</Text>
              </View>
            )}
            {job.department && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Department</Text>
                <Text style={{ fontSize: 14, color: colors.textPrimary }}>{job.department}</Text>
              </View>
            )}
          </View>

          {/* Apply Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              backgroundColor: primaryColor,
              paddingVertical: 16,
              borderRadius: borderRadius.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textInverse }}>
              Apply for this Position
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
