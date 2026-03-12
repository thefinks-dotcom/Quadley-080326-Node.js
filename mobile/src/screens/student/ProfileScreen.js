import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { colors as defaultColors, borderRadius, spacing, shadows, typography } from '../../theme';
import { useTenant } from '../../contexts/TenantContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import api from '../../services/api';

export default function ProfileScreen({ navigation }) {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { user, logout, isAdmin, isSuperAdmin } = useAuth();

  const [deleteStep, setDeleteStep] = useState(0);
  const [deletePassword, setDeletePassword] = useState('');

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

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete('/auth/users/me', { data: { password: deletePassword } });
      return res.data;
    },
    onSuccess: () => {
      setDeleteStep(0);
      setDeletePassword('');
      Alert.alert(
        'Account Deleted',
        'Your account and all associated personal data have been permanently deleted.',
        [{ text: 'OK', onPress: logout }]
      );
    },
    onError: (err) => {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to delete account. Please try again.');
    },
  });

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
            <MenuRow icon="help-circle-outline" label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Contact support@quadley.app for assistance.')} />
            <MenuRow
              icon="trash-outline"
              label="Delete Account"
              color={colors.error}
              onPress={() => setDeleteStep(1)}
              isLast
            />
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

      {/* Delete Account Modal — Step 1: Warning */}
      <Modal visible={deleteStep === 1} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDeleteStep(0)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={() => setDeleteStep(0)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Delete Account</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.xl }}>
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="trash-outline" size={36} color="#B91C1C" />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 }}>
                Permanently delete your account?
              </Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                This action cannot be undone. The following will be permanently deleted:
              </Text>
            </View>

            {[
              { icon: 'person-outline', text: 'Your name, email, and profile information' },
              { icon: 'chatbubbles-outline', text: 'All messages you have sent' },
              { icon: 'notifications-outline', text: 'Your notification preferences and tokens' },
              { icon: 'shield-outline', text: 'Your account access and login credentials' },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <Ionicons name={item.icon} size={20} color="#B91C1C" style={{ marginRight: 12 }} />
                <Text style={{ flex: 1, fontSize: 14, color: '#7F1D1D', lineHeight: 20 }}>{item.text}</Text>
              </View>
            ))}

            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 10, padding: 14, marginTop: 8, marginBottom: 32 }}>
              <Text style={{ fontSize: 13, color: '#78350F', lineHeight: 20 }}>
                Note: Some data may be retained where required by law. Deletion is permanent and your account cannot be recovered.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setDeleteStep(2)}
              style={{ backgroundColor: '#B91C1C', borderRadius: borderRadius.md, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>I understand — continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDeleteStep(0)}
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 16 }}>Keep my account</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Delete Account Modal — Step 2: Password + final confirm */}
      <Modal visible={deleteStep === 2} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setDeleteStep(0); setDeletePassword(''); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={() => { setDeleteStep(1); setDeletePassword(''); }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Final Confirmation</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="warning-outline" size={32} color="#B91C1C" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
                Confirm your identity
              </Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                Enter your password to permanently delete the account for{' '}
                <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{user?.first_name} {user?.last_name}</Text>.
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: colors.textTertiary, marginBottom: 6 }}>Your password</Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: borderRadius.md,
                padding: 14,
                fontSize: 15,
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
              }}
              placeholder="Enter your password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={deletePassword}
              onChangeText={setDeletePassword}
            />

            <TouchableOpacity
              onPress={() => deleteAccountMutation.mutate()}
              disabled={deleteAccountMutation.isPending || !deletePassword.trim()}
              style={{
                backgroundColor: deletePassword.trim() ? '#B91C1C' : colors.surfaceSecondary,
                borderRadius: borderRadius.md,
                paddingVertical: 18,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 14,
              }}
            >
              {deleteAccountMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Ionicons name="trash" size={20} color={deletePassword.trim() ? '#fff' : colors.textTertiary} />}
              <Text style={{ color: deletePassword.trim() ? '#fff' : colors.textTertiary, fontWeight: '700', fontSize: 16 }}>
                {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete my account permanently'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setDeleteStep(0); setDeletePassword(''); }}
              disabled={deleteAccountMutation.isPending}
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 16 }}>Cancel — keep my account</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
