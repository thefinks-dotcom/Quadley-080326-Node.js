import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { colors as defaultColors, borderRadius, spacing, inputStyle, buttonPrimary } from '../../theme';
import { useTenant } from '../../contexts/TenantContext';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function SettingsScreen({ navigation }) {
  const { branding } = useTenant();
  const { isDark, themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { user, refreshUser } = useAuth();

  // Change Password state
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Change Email state
  const [changeEmailModal, setChangeEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState(1); // 1 = enter email+pw, 2 = enter code
  const [emailData, setEmailData] = useState({ newEmail: '', currentPassword: '', code: '' });
  const [emailLoading, setEmailLoading] = useState(false);

  // Notification settings
  const [notifications, setNotifications] = useState({
    announcements: user?.notif_announcements ?? true,
    events: user?.notif_events ?? true,
    messages: user?.notif_messages ?? true,
    maintenance: user?.notif_maintenance ?? true,
    dining: user?.notif_dining_menu ?? true,
    recognition: user?.notif_shoutouts ?? true,
  });

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword(passwords.current, passwords.new);
      Alert.alert('Success', 'Password changed successfully!');
      setChangePasswordModal(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to change password');
    }
    setPasswordLoading(false);
  };

  const handleRequestEmailChange = async () => {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(emailData.newEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!emailData.currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    setEmailLoading(true);
    try {
      await authService.requestEmailChange(emailData.newEmail, emailData.currentPassword);
      Alert.alert('Code Sent', `A 6-digit verification code has been sent to ${emailData.newEmail}`);
      setEmailStep(2);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to request email change');
    }
    setEmailLoading(false);
  };

  const handleVerifyEmailChange = async () => {
    if (!emailData.code || emailData.code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }

    setEmailLoading(true);
    try {
      const result = await authService.verifyEmailChange(emailData.code);
      Alert.alert('Success', `Email changed to ${result.new_email}`);
      setChangeEmailModal(false);
      setEmailStep(1);
      setEmailData({ newEmail: '', currentPassword: '', code: '' });
      if (refreshUser) refreshUser();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to verify email change');
    }
    setEmailLoading(false);
  };

  const resetEmailModal = () => {
    setChangeEmailModal(false);
    setEmailStep(1);
    setEmailData({ newEmail: '', currentPassword: '', code: '' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ScrollView>
        {/* Account Settings */}
        <View style={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: primaryColor, marginRight: spacing.sm }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Account
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border }}>
            <TouchableOpacity
              onPress={() => setChangePasswordModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
            >
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
              <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary }}>Change Password</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setChangeEmailModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
            >
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ fontSize: 15, color: colors.textPrimary }}>Change Email</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{user?.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}
            >
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary }}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications */}
        <View style={{ paddingHorizontal: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: secondaryColor, marginRight: spacing.sm }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Notifications
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('NotificationSettings')}
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary }}>Push Notification Settings</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy */}
        <View style={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: primaryColor, marginRight: spacing.sm }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Privacy
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border }}>
            <TouchableOpacity
              onPress={() => Alert.alert('Privacy Policy', 'Privacy policy details here.')}
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
            >
              <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
              <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary }}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert('Terms of Service', 'Terms of service details here.')}
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              <Text style={{ flex: 1, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary }}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChangePasswordModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setChangePasswordModal(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Change Password</Text>
            <TouchableOpacity onPress={handleChangePassword} disabled={passwordLoading}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                {passwordLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.xl }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Current Password</Text>
            <TextInput
              style={{ ...inputStyle, marginBottom: spacing.lg }}
              placeholder="Enter current password" placeholderTextColor={colors.textTertiary}
              secureTextEntry value={passwords.current}
              onChangeText={(text) => setPasswords({ ...passwords, current: text })}
            />
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>New Password</Text>
            <TextInput
              style={{ ...inputStyle, marginBottom: spacing.lg }}
              placeholder="Min. 8 characters" placeholderTextColor={colors.textTertiary}
              secureTextEntry value={passwords.new}
              onChangeText={(text) => setPasswords({ ...passwords, new: text })}
            />
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Confirm New Password</Text>
            <TextInput
              style={{ ...inputStyle }}
              placeholder="Re-enter new password" placeholderTextColor={colors.textTertiary}
              secureTextEntry value={passwords.confirm}
              onChangeText={(text) => setPasswords({ ...passwords, confirm: text })}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Change Email Modal */}
      <Modal
        visible={changeEmailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetEmailModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={resetEmailModal}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Change Email</Text>
              <View style={{ width: 50 }} />
            </View>
            <ScrollView style={{ flex: 1, padding: spacing.xl }}>
              {emailStep === 1 ? (
                <>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xl }}>
                    Current email: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{user?.email}</Text>
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>New Email Address</Text>
                  <TextInput
                    style={{ ...inputStyle, marginBottom: spacing.lg }}
                    placeholder="Enter new email address" placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                    value={emailData.newEmail}
                    onChangeText={(text) => setEmailData({ ...emailData, newEmail: text })}
                  />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Current Password</Text>
                  <TextInput
                    style={{ ...inputStyle, marginBottom: spacing.sm }}
                    placeholder="Enter your current password" placeholderTextColor={colors.textTertiary}
                    secureTextEntry value={emailData.currentPassword}
                    onChangeText={(text) => setEmailData({ ...emailData, currentPassword: text })}
                  />
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: spacing.xxl }}>
                    Password required to verify your identity
                  </Text>
                  <TouchableOpacity
                    onPress={handleRequestEmailChange} disabled={emailLoading}
                    style={{ ...buttonPrimary, opacity: emailLoading ? 0.6 : 1 }}
                  >
                    {emailLoading ? (
                      <ActivityIndicator color={colors.textInverse} />
                    ) : (
                      <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600' }}>Send Verification Code</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={{ backgroundColor: colors.primaryLight, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: spacing.xl, borderLeftWidth: 3, borderLeftColor: primaryColor }}>
                    <Text style={{ fontSize: 14, color: primaryColor }}>
                      A 6-digit verification code has been sent to{' '}
                      <Text style={{ fontWeight: '600' }}>{emailData.newEmail}</Text>
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Verification Code</Text>
                  <TextInput
                    style={{
                      ...inputStyle, padding: spacing.lg, fontSize: 24, textAlign: 'center',
                      letterSpacing: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: spacing.sm,
                    }}
                    placeholder="000000" placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad" maxLength={6}
                    value={emailData.code}
                    onChangeText={(text) => setEmailData({ ...emailData, code: text.replace(/\D/g, '').slice(0, 6) })}
                  />
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: spacing.xxl, textAlign: 'center' }}>
                    Code expires in 15 minutes
                  </Text>
                  <TouchableOpacity
                    onPress={handleVerifyEmailChange} disabled={emailLoading}
                    style={{ ...buttonPrimary, opacity: emailLoading ? 0.6 : 1, marginBottom: spacing.md }}
                  >
                    {emailLoading ? (
                      <ActivityIndicator color={colors.textInverse} />
                    ) : (
                      <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600' }}>Verify & Change Email</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setEmailStep(1); setEmailData({ ...emailData, code: '' }); }}
                    style={{ alignItems: 'center', padding: spacing.md }}
                  >
                    <Text style={{ color: primaryColor, fontSize: 14 }}>Back to Step 1</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
