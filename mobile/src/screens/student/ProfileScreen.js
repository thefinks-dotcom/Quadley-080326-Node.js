import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { colors as defaultColors, borderRadius, spacing, shadows, typography } from '../../theme';
import { useTenant } from '../../contexts/TenantContext';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { user, logout, isAdmin, isSuperAdmin } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin': return colors.error;
      case 'admin': return primaryColor;
      case 'ra': return primaryColor;
      default: return primaryColor;
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'ra': return 'Resident Assistant';
      default: return 'Student';
    }
  };

  const MenuRow = ({ icon, label, onPress, color, isLast }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderLight,
      }}
    >
      <Ionicons name={icon} size={20} color={color || colors.textSecondary} />
      <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: color || colors.textPrimary, fontWeight: '400' }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xl,
          paddingBottom: spacing.xxl,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 }}>
            Profile
          </Text>
        </View>

        {/* Profile Card */}
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            alignItems: 'center',
            ...shadows.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <View style={{
              width: 72,
              height: 72,
              backgroundColor: secondaryColor + '20',
              borderRadius: 36,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.lg,
              borderWidth: 2,
              borderColor: secondaryColor + '40',
            }}>
              <Text style={{ fontSize: 28, fontWeight: '600', color: primaryColor }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.textPrimary }}>
              {user?.first_name} {user?.last_name}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
              {user?.email}
            </Text>
            <View style={{
              backgroundColor: secondaryColor + '15',
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: borderRadius.full,
              marginTop: spacing.md,
              borderWidth: 1,
              borderColor: secondaryColor + '30',
            }}>
              <Text style={{ color: getRoleBadgeColor(user?.role), fontWeight: '600', fontSize: 13 }}>
                {getRoleLabel(user?.role)}
              </Text>
            </View>
          </View>
        </View>

        {/* Information */}
        <View style={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: secondaryColor, marginRight: spacing.sm }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Information
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border }}>
            {user?.floor && (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <Ionicons name="home-outline" size={20} color={colors.textSecondary} />
                <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary }}>Floor</Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary }}>{user.floor}</Text>
              </View>
            )}
            {user?.student_id && (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <Ionicons name="card-outline" size={20} color={colors.textSecondary} />
                <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary }}>Student ID</Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary }}>{user.student_id}</Text>
              </View>
            )}
            {user?.year && (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
                <Ionicons name="school-outline" size={20} color={colors.textSecondary} />
                <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary }}>Year</Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary }}>{user.year}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Account */}
        <View style={{ paddingHorizontal: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: primaryColor, marginRight: spacing.sm }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Account
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border }}>
            <MenuRow icon="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />
            <MenuRow icon="help-circle-outline" label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Contact support@quadley.app for assistance.')} isLast />
          </View>
        </View>

        {/* Admin Tools */}
        {(isAdmin || isSuperAdmin) && (
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Admin
            </Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border }}>
              <MenuRow icon="shield-checkmark-outline" label="Admin Settings" onPress={() => navigation.navigate('AdminSettings')} isLast />
            </View>
          </View>
        )}

        {/* Logout */}
        <View style={{ padding: spacing.xl }}>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              backgroundColor: colors.surface,
              paddingVertical: 15,
              borderRadius: borderRadius.md,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={{ color: colors.error, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
              Log Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <View style={{ alignItems: 'center', paddingBottom: 40 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Quadley v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
