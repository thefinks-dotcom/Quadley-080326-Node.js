import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, ENDPOINTS } from '../../config/api';
import api from '../../services/api';
import { colors, borderRadius, spacing, inputStyle, buttonPrimary } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';
import TermsOfServiceModal from '../../components/TermsOfServiceModal';

const BUNDLE_ID = Constants.expoConfig?.ios?.bundleIdentifier || 'com.quadley.app';

export default function InviteCodeScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const [step, setStep] = useState('code'); // 'code' | 'register'
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);

  // Registration fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { registerWithCode, registerWithGoogle, registerWithApple } = useAuth();
  const lastNameRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const handleVerifyCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Error', 'Please enter your invite code');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(ENDPOINTS.INVITE_CODE_VERIFY, {
        invite_code: code,
      });
      const data = response.data;
      setInviteData(data);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setStep('register');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid or expired invite code';
      Alert.alert('Invalid Code', msg);
    } finally {
      setLoading(false);
    }
  };

  const requireTerms = () => {
    if (!agreedToTerms) {
      Alert.alert('Terms Required', 'Please agree to the Terms of Service & Privacy Policy to continue.');
      return false;
    }
    return true;
  };

  const requireName = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Please enter your first and last name');
      return false;
    }
    return true;
  };

  const handleGoogleRegister = async () => {
    if (!requireName() || !requireTerms()) return;

    setSocialLoading('google');
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;
      if (!idToken) throw new Error('No ID token returned from Google');

      const result = await registerWithGoogle(
        inviteCode.trim().toUpperCase(),
        idToken,
        firstName.trim(),
        lastName.trim(),
      );
      if (!result.success) {
        Alert.alert('Registration Failed', result.error);
      }
    } catch (err) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled
      } else if (err.code === statusCodes.IN_PROGRESS) {
        // already in progress
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Not Available', 'Google Play Services not available on this device.');
      } else {
        const message = err.response?.data?.detail || err.message || 'Google sign-in failed';
        Alert.alert('Registration Failed', message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleRegister = async () => {
    if (!requireName() || !requireTerms()) return;

    setSocialLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');

      const result = await registerWithApple(
        inviteCode.trim().toUpperCase(),
        credential.identityToken,
        BUNDLE_ID,
        firstName.trim(),
        lastName.trim(),
      );
      if (!result.success) {
        Alert.alert('Registration Failed', result.error);
      }
    } catch (err) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        // user cancelled
      } else {
        const message = err.response?.data?.detail || err.message || 'Apple sign-in failed';
        Alert.alert('Registration Failed', message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handlePasswordRegister = async () => {
    if (!requireName() || !requireTerms()) return;
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await registerWithCode({
      invite_code: inviteCode.trim().toUpperCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      password,
    });
    setLoading(false);

    if (!result.success) {
      Alert.alert('Registration Failed', result.error);
    }
  };

  const primaryColor = inviteData?.tenant_primary_color || colors.primary;

  if (step === 'register' && inviteData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: spacing.xxl }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back button */}
            <TouchableOpacity
              onPress={() => setStep('code')}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 6 }}>Back</Text>
            </TouchableOpacity>

            {/* Tenant branding */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xxxl }}>
              {inviteData.tenant_logo ? (
                <Image
                  source={{ uri: `${API_BASE_URL.replace('/api', '')}${inviteData.tenant_logo}` }}
                  style={{ width: 60, height: 60, borderRadius: borderRadius.lg, marginBottom: spacing.md }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{
                  width: 60, height: 60, backgroundColor: primaryColor,
                  borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center',
                  marginBottom: spacing.md,
                }}>
                  <Text style={{ fontSize: 26, fontWeight: '700', color: colors.textInverse }}>
                    {inviteData.tenant_name?.[0] || 'Q'}
                  </Text>
                </View>
              )}
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 }}>
                {inviteData.tenant_name}
              </Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 4 }}>
                Create your account
              </Text>
            </View>

            {/* Email (read-only) */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Email</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', ...inputStyle, opacity: 0.6 }}>
                <Ionicons name="mail-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  style={{ flex: 1, paddingVertical: 0, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
                  value={inviteData.email}
                  editable={false}
                />
              </View>
            </View>

            {/* First Name */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>First Name</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', ...inputStyle }}>
                <Ionicons name="person-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  style={{ flex: 1, paddingVertical: 0, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
                  placeholder="First name" placeholderTextColor={colors.textTertiary}
                  value={firstName} onChangeText={setFirstName}
                  autoCapitalize="words" returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
            </View>

            {/* Last Name */}
            <View style={{ marginBottom: spacing.xxl }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Last Name</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', ...inputStyle }}>
                <Ionicons name="person-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  ref={lastNameRef}
                  style={{ flex: 1, paddingVertical: 0, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
                  placeholder="Last name" placeholderTextColor={colors.textTertiary}
                  value={lastName} onChangeText={setLastName}
                  autoCapitalize="words" returnKeyType="done"
                />
              </View>
            </View>

            {/* Terms of Service Checkbox */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xxl }}>
              <TouchableOpacity
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                style={{ paddingTop: 1 }}
              >
                <Ionicons
                  name={agreedToTerms ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={agreedToTerms ? primaryColor : colors.textTertiary}
                />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary, marginLeft: 10, lineHeight: 20 }}>
                I agree to the{' '}
                <Text
                  style={{ color: primaryColor, fontWeight: '500', textDecorationLine: 'underline' }}
                  onPress={() => setShowTerms(true)}
                  suppressHighlighting={true}
                >
                  Terms of Service & Privacy Policy
                </Text>
              </Text>
            </View>

            {/* ── Social Sign-In (Primary) ── */}
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.xl,
              marginBottom: spacing.lg,
            }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' }}>
                Continue with
              </Text>

              {/* Google */}
              <TouchableOpacity
                onPress={handleGoogleRegister}
                disabled={!!socialLoading || loading}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#fff',
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: '#dadce0',
                  paddingVertical: 14,
                  marginBottom: spacing.md,
                  opacity: (socialLoading || loading) ? 0.6 : 1,
                }}
              >
                {socialLoading === 'google' ? (
                  <ActivityIndicator color="#4285F4" />
                ) : (
                  <>
                    <Text style={{ fontSize: 18, color: '#4285F4', fontWeight: '700', marginRight: 10 }}>G</Text>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#3c4043' }}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Apple — iOS only */}
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={borderRadius.md}
                  style={{ height: 48 }}
                  onPress={handleAppleRegister}
                />
              )}
            </View>

            {/* ── Password Option (Secondary / Collapsible) ── */}
            <TouchableOpacity
              onPress={() => setShowPasswordForm(!showPasswordForm)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing.md,
                marginBottom: showPasswordForm ? spacing.md : spacing.lg,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                {showPasswordForm ? 'Hide password option' : 'Set a password instead'}
              </Text>
              <Ionicons
                name={showPasswordForm ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.textTertiary}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            {showPasswordForm && (
              <View style={{ marginBottom: spacing.lg }}>
                {/* Password */}
                <View style={{ marginBottom: spacing.lg }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Password</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', ...inputStyle }}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
                    <TextInput
                      ref={passwordRef}
                      style={{ flex: 1, paddingVertical: 0, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
                      placeholder="Create a password" placeholderTextColor={colors.textTertiary}
                      value={password} onChangeText={setPassword}
                      secureTextEntry={!showPassword} returnKeyType="next"
                      onSubmitEditing={() => confirmRef.current?.focus()}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={{ marginBottom: spacing.lg }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Confirm Password</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', ...inputStyle }}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
                    <TextInput
                      ref={confirmRef}
                      style={{ flex: 1, paddingVertical: 0, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
                      placeholder="Confirm your password" placeholderTextColor={colors.textTertiary}
                      value={confirmPassword} onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword} returnKeyType="go"
                      onSubmitEditing={handlePasswordRegister}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handlePasswordRegister}
                  disabled={loading || !agreedToTerms}
                  style={{ ...buttonPrimary, backgroundColor: primaryColor, opacity: (loading || !agreedToTerms) ? 0.5 : 1 }}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textInverse }}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        <TermsOfServiceModal
          visible={showTerms}
          onClose={() => setShowTerms(false)}
          primaryColor={primaryColor}
        />
      </SafeAreaView>
    );
  }

  // Step 1: Enter invite code
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back to login */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 6 }}>Back to Login</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={{
            backgroundColor: primaryColor,
            borderRadius: borderRadius.xl,
            padding: spacing.xxl,
            alignItems: 'center',
            marginBottom: spacing.xxl,
          }}>
            <View style={{
              width: 56, height: 56,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 14, justifyContent: 'center', alignItems: 'center',
              marginBottom: spacing.md,
            }}>
              <Ionicons name="ticket-outline" size={28} color="white" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: 'white', letterSpacing: -0.3 }}>
              Join with Invite Code
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' }}>
              Enter the code from your invitation email
            </Text>
          </View>

          {/* Invite Code Input */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
              Invite Code
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md,
              borderWidth: 1, borderColor: colors.border,
              paddingHorizontal: 14,
            }}>
              <Ionicons name="keypad-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={{
                  flex: 1, paddingVertical: 14, paddingHorizontal: 10,
                  fontSize: 22, fontWeight: '700', color: colors.textPrimary,
                  letterSpacing: 3,
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                }}
                placeholder="XXXX-XXXX"
                placeholderTextColor={colors.textTertiary}
                value={inviteCode}
                onChangeText={(text) => {
                  let cleaned = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                  let letters = cleaned.replace(/-/g, '');
                  if (letters.length > 4) {
                    letters = letters.slice(0, 4) + '-' + letters.slice(4, 8);
                  }
                  setInviteCode(letters);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                returnKeyType="go"
                onSubmitEditing={handleVerifyCode}
              />
            </View>

            <TouchableOpacity
              onPress={handleVerifyCode}
              disabled={loading}
              style={{
                backgroundColor: primaryColor,
                paddingVertical: 16,
                borderRadius: borderRadius.md,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: spacing.lg,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Help text */}
          <View style={{
            padding: spacing.lg,
            backgroundColor: primaryColor + '10',
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: primaryColor + '25',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: primaryColor, marginBottom: 4 }}>
              Where do I find my invite code?
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
              Check your email for an invitation from your college. The code looks like XXXX-XXXX and is shown in the email.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
