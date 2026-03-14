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
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { warmupConnection } from '../../services/api';
import { colors as defaultColors, borderRadius, spacing, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import TENANT_LOGOS from '../../utils/tenantLogos';
import BUILD_CONFIG from '../../config/tenantBuild.generated';

const buildTenantCode = BUILD_CONFIG.tenant;
const buildTenantName = BUILD_CONFIG.tenantName;
const buildPrimaryColor = BUILD_CONFIG.primaryColor || defaultColors.primary;
const buildLogo = TENANT_LOGOS[buildTenantCode] || TENANT_LOGOS.quadley;

const BUNDLE_ID = Constants.expoConfig?.ios?.bundleIdentifier || 'com.quadley.app';

export default function LoginScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const { tenant, branding } = useTenant();
  const passwordRef = useRef(null);

  const primaryColor = buildPrimaryColor;
  const displayName = buildTenantName;
  const tenantLogo = buildLogo;

  useEffect(() => {
    warmupConnection(false).catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!result.success) {
      if (result.error.includes('Network') || result.error.includes('timed out') || result.error.includes('timeout')) {
        Alert.alert('Connection Issue', 'Having trouble connecting to the server. Please check your internet connection and try again.', [{ text: 'OK' }]);
      } else {
        Alert.alert('Login Failed', result.error);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setSocialLoading('google');
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;
      if (!idToken) throw new Error('No ID token returned from Google');

      const result = await loginWithGoogle(idToken);
      if (!result.success) {
        Alert.alert('Sign-in Failed', result.error);
      }
    } catch (err) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled — no alert needed
      } else if (err.code === statusCodes.IN_PROGRESS) {
        // sign-in already in progress
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Not Available', 'Google Play Services not available on this device.');
      } else {
        const message = err.response?.data?.detail || err.message || 'Google sign-in failed';
        Alert.alert('Sign-in Failed', message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setSocialLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error('No identity token from Apple');

      const result = await loginWithApple(credential.identityToken, BUNDLE_ID);
      if (!result.success) {
        Alert.alert('Sign-in Failed', result.error);
      }
    } catch (err) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        // user cancelled
      } else {
        const message = err.response?.data?.detail || err.message || 'Apple sign-in failed';
        Alert.alert('Sign-in Failed', message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

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
          {/* Logo & Branding */}
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

          {/* Social Sign-In */}
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
              marginBottom: spacing.lg,
            }}>
              Sign in
            </Text>

            {/* Google Button */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={!!socialLoading}
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
                paddingHorizontal: 16,
                marginBottom: spacing.md,
                opacity: socialLoading ? 0.6 : 1,
              }}
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator color="#4285F4" />
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#3c4043', marginLeft: 10 }}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple Button — iOS only */}
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={borderRadius.md}
                style={{ height: 48, marginBottom: spacing.lg }}
                onPress={handleAppleLogin}
              />
            )}

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginHorizontal: spacing.sm }}>
                or sign in with email
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

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

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
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

          {/* Join Section */}
          <TouchableOpacity
            onPress={() => navigation.navigate('InviteCode')}
            activeOpacity={0.8}
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

function GoogleIcon({ size = 20 }) {
  return (
    <View style={{ width: size, height: size }}>
      <Text style={{ fontSize: size, lineHeight: size + 2 }}>
        <Text style={{ color: '#4285F4' }}>G</Text>
      </Text>
    </View>
  );
}
