import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { authService } from '../../services/authService';
import { useTenant } from '../../contexts/TenantContext';
import { colors, borderRadius, spacing, inputStyle, buttonPrimary } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

const buildPrimaryColor = Constants.expoConfig?.extra?.primaryColor || colors.primary;

export default function ForgotPasswordScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { branding } = useTenant();
  const secondaryColor = branding?.secondaryColor || colors.background;
  const primaryColor = branding?.primaryColor || buildPrimaryColor;

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (error) {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 6 }}>Back</Text>
          </TouchableOpacity>

          {!sent ? (
            <>
              <View style={{ marginBottom: spacing.xxxl }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3, marginBottom: 8 }}>
                  Forgot Password?
                </Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary }}>
                  Enter your email and we'll send you a link to reset your password.
                </Text>
              </View>

              <View style={{ marginBottom: spacing.xxl }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.sm }}>
                  Email Address
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', ...inputStyle }}>
                  <Ionicons name="mail-outline" size={18} color={colors.textTertiary} />
                  <TextInput
                    style={{ flex: 1, paddingVertical: 0, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={{ ...buttonPrimary, backgroundColor: primaryColor, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textInverse }}>
                    Send Reset Link
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={{
                width: 72, height: 72,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: 36,
                justifyContent: 'center', alignItems: 'center',
                marginBottom: spacing.xxl,
              }}>
                <Ionicons name="checkmark" size={36} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.3 }}>
                Check Your Email
              </Text>
              <Text style={{
                fontSize: 15, color: colors.textSecondary, textAlign: 'center',
                marginBottom: spacing.xxxl, paddingHorizontal: spacing.xxl,
              }}>
                If an account exists with {email}, you'll receive a password reset link shortly.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ ...buttonPrimary, backgroundColor: primaryColor, width: '100%' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textInverse }}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
