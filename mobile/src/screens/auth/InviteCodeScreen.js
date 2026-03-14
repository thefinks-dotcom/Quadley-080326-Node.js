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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, ENDPOINTS } from '../../config/api';
import api from '../../services/api';
import { borderRadius, spacing, inputStyle, buttonPrimary } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';
import TermsOfServiceModal from '../../components/TermsOfServiceModal';
import BUILD_CONFIG from '../../config/tenantBuild.generated';
import TENANT_LOGOS from '../../utils/tenantLogos';

const buildTenantCode = BUILD_CONFIG.tenant;
const buildPrimaryColor = BUILD_CONFIG.primaryColor;
const buildTenantName = BUILD_CONFIG.tenantName;
const buildLogo = TENANT_LOGOS[buildTenantCode] || TENANT_LOGOS.quadley;

// iPadOS 26 crashes with KeyboardAvoidingView behavior="padding" — disable on iPad
const kvBehavior = Platform.OS === 'ios'
  ? (Platform.isPad ? undefined : 'padding')
  : 'height';

export default function InviteCodeScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const [step, setStep] = useState('code'); // 'code' | 'register'
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Registration fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { registerWithCode } = useAuth();
  const lastNameRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  // Always use the build's tenant color — consistent on both steps
  const primaryColor = buildPrimaryColor;

  const handleVerifyCode = async () => {
    setErrorMessage('');
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setErrorMessage('Please enter your invite code');
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
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage('');
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Please enter your first and last name');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('Please agree to the Terms of Service & Privacy Policy to continue.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await registerWithCode({
        invite_code: inviteCode.trim().toUpperCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
      });
      if (!result.success) {
        setErrorMessage(result.error || 'Registration failed. Please try again.');
      }
    } catch (e) {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'register' && inviteData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView behavior={kvBehavior} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: spacing.xxl }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back button */}
            <TouchableOpacity
              onPress={() => { setStep('code'); setErrorMessage(''); }}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 6 }}>Back</Text>
            </TouchableOpacity>

            {/* Tenant branding — uses build logo + color */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xxxl }}>
              <View style={{
                padding: spacing.sm,
                backgroundColor: primaryColor,
                borderRadius: borderRadius.lg,
                marginBottom: spacing.md,
              }}>
                <Image
                  source={buildLogo}
                  style={{ width: 52, height: 52, borderRadius: borderRadius.sm }}
                  resizeMode="contain"
                />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 }}>
                {inviteData.tenant_name || buildTenantName}
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
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>Last Name</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', ...inputStyle }}>
                <Ionicons name="person-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  ref={lastNameRef}
                  style={{ flex: 1, paddingVertical: 0, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
                  placeholder="Last name" placeholderTextColor={colors.textTertiary}
                  value={lastName} onChangeText={setLastName}
                  autoCapitalize="words" returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

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
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Terms of Service Checkbox */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg }}>
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

            {/* Inline error */}
            {!!errorMessage && (
              <View style={{
                backgroundColor: '#fef2f2',
                borderRadius: borderRadius.md,
                borderWidth: 1,
                borderColor: '#fecaca',
                paddingVertical: 10,
                paddingHorizontal: 14,
                marginBottom: spacing.md,
              }}>
                <Text style={{ fontSize: 14, color: '#dc2626', lineHeight: 20 }}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading || !agreedToTerms}
              style={{ ...buttonPrimary, backgroundColor: primaryColor, opacity: (loading || !agreedToTerms) ? 0.5 : 1, marginBottom: spacing.lg }}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textInverse }}>Create Account</Text>
              )}
            </TouchableOpacity>
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
      <KeyboardAvoidingView behavior={kvBehavior} style={{ flex: 1 }}>
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

          {/* Header with build tenant color */}
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
                  setErrorMessage('');
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

            {/* Inline error */}
            {!!errorMessage && (
              <View style={{
                backgroundColor: '#fef2f2',
                borderRadius: borderRadius.md,
                borderWidth: 1,
                borderColor: '#fecaca',
                paddingVertical: 10,
                paddingHorizontal: 14,
                marginTop: spacing.md,
              }}>
                <Text style={{ fontSize: 14, color: '#dc2626', lineHeight: 20 }}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Verify Button */}
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
