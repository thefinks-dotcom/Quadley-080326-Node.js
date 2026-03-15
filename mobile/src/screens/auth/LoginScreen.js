import React, { useState, useRef, useEffect } from 'react';
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
import { useTenant } from '../../contexts/TenantContext';
import { warmupConnection } from '../../services/api';
import { colors as defaultColors, borderRadius, spacing, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import Constants from 'expo-constants';
import TENANT_LOGOS from '../../utils/tenantLogos';
import BUILD_CONFIG from '../../config/tenantBuild.generated';

// Prefer Constants.expoConfig.extra (baked into the native binary by Xcode at
// build time) over tenantBuild.generated.js (a JS file that can be stale when
// Metro runs without TENANT env var set, e.g. local dev after git pull).
const _expoExtra = Constants.expoConfig?.extra || {};
const buildTenantCode   = _expoExtra.tenant       || BUILD_CONFIG.tenant;
const buildTenantName   = _expoExtra.tenantName   || BUILD_CONFIG.tenantName;
const buildPrimaryColor = _expoExtra.primaryColor  || BUILD_CONFIG.primaryColor || defaultColors.primary;
const buildLogo = TENANT_LOGOS[buildTenantCode] || TENANT_LOGOS.quadley;

export default function LoginScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuth();
  const { tenant, branding } = useTenant();
  const passwordRef = useRef(null);

  // Login screen shows the build's white-label branding.
  // TenantContext is initialised with BUILD_CONFIG values and may be updated
  // by a background pre-login branding fetch (for white-label non-Quadley builds)
  // or by saveTenant after login. clearTenant on logout resets to BUILD_CONFIG.
  // Using branding.primaryColor here means the correct tenant colour is always
  // shown even when tenantBuild.generated.js still holds Quadley defaults in a
  // local dev / Metro session without the TENANT env var set.
  const primaryColor = branding?.primaryColor || buildPrimaryColor;
  const displayName = buildTenantName;
  const tenantLogo = buildLogo;

  useEffect(() => {
    warmupConnection(false).catch(() => {});
  }, []);

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (!result.success) {
        if (result.error.includes('Network') || result.error.includes('timed out') || result.error.includes('timeout')) {
          setErrorMessage('Having trouble connecting. Please check your internet and try again.');
        } else {
          setErrorMessage(result.error);
        }
      }
    } catch (e) {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // iPadOS 26 crashes with KeyboardAvoidingView behavior="padding" — disable on iPad
  const kvBehavior = Platform.OS === 'ios'
    ? (Platform.isPad ? undefined : 'padding')
    : 'height';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={kvBehavior}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Branding — compact */}
          <View style={{ alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xxxl }}>
            <View style={{
              padding: spacing.sm,
              backgroundColor: primaryColor,
              borderRadius: borderRadius.lg,
              marginBottom: spacing.md,
            }}>
              <Image
                source={tenantLogo}
                style={{ width: 52, height: 52, borderRadius: borderRadius.sm }}
                resizeMode="contain"
              />
            </View>
            <Text style={{
              fontSize: 22, fontWeight: '700', color: colors.textPrimary,
              letterSpacing: -0.3,
            }}>
              {displayName}
            </Text>
          </View>

          {/* Sign In Form */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
          }}>
            <Text style={{
              fontSize: 18, fontWeight: '600', color: colors.textPrimary,
              marginBottom: spacing.xl,
            }}>
              Sign in
            </Text>

            {/* Email */}
            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
              Email
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md,
              borderWidth: 1, borderColor: colors.border,
              paddingHorizontal: 14, marginBottom: spacing.lg,
            }}>
              <Ionicons name="mail-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={{
                  flex: 1, paddingVertical: 14, paddingHorizontal: 10,
                  fontSize: 16, color: colors.textPrimary,
                  letterSpacing: 0,
                }}
                placeholder="you@college.edu"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                data-testid="login-email-input"
              />
            </View>

            {/* Password */}
            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
              Password
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md,
              borderWidth: 1, borderColor: colors.border,
              paddingHorizontal: 14, marginBottom: spacing.sm,
            }}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
              <TextInput
                ref={passwordRef}
                style={{
                  flex: 1, paddingVertical: 14, paddingHorizontal: 10,
                  fontSize: 16, color: colors.textPrimary,
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                data-testid="login-password-input"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={{ alignSelf: 'flex-end', marginBottom: spacing.xl, paddingVertical: 4 }}
            >
              <Text style={{ fontSize: 13, color: primaryColor, fontWeight: '600' }}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Inline error — replaces Alert.alert to avoid iPad iOS 26 popover crash */}
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

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
              data-testid="login-submit-btn"
              style={{
                backgroundColor: primaryColor,
                paddingVertical: 16,
                borderRadius: borderRadius.md,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Join Section — prominent, not hidden */}
          <TouchableOpacity
            onPress={() => navigation.navigate('InviteCode')}
            activeOpacity={0.8}
            data-testid="join-with-invite-btn"
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              padding: spacing.xl,
              borderWidth: 1.5,
              borderColor: primaryColor + '40',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: borderRadius.md,
              backgroundColor: primaryColor + '15',
              justifyContent: 'center', alignItems: 'center',
              marginRight: spacing.md,
            }}>
              <Ionicons name="ticket-outline" size={22} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                New here? Join with Invite Code
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                Use the code from your invitation email
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={primaryColor} />
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
