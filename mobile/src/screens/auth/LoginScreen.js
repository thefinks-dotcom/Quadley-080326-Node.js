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
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { warmupConnection } from '../../services/api';
import { colors as defaultColors, borderRadius, spacing, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import TENANT_LOGOS from '../../utils/tenantLogos';

const buildTenantCode = Constants.expoConfig?.extra?.tenant || 'quadley';
const buildTenantName = Constants.expoConfig?.extra?.tenantName || 'Quadley';
const buildPrimaryColor = Constants.expoConfig?.extra?.primaryColor || defaultColors.primary;
const buildLogo = TENANT_LOGOS[buildTenantCode] || TENANT_LOGOS.quadley;

export default function LoginScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { tenant, branding } = useTenant();
  const passwordRef = useRef(null);

  // Login screen ALWAYS shows the build's white-label branding.
  // Stored tenant data (from a previous session on a different build) must not
  // bleed into the login screen identity — the build IS the tenant here.
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
