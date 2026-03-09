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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { colors, spacing, borderRadius, typography, inputStyle, buttonPrimary, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import TermsOfServiceModal from '../../components/TermsOfServiceModal';

const buildPrimaryColor = Constants.expoConfig?.extra?.primaryColor || colors.primary;

export default function RegisterScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const { register } = useAuth();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || buildPrimaryColor;

  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const studentIdRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!agreedToTerms) {
      Alert.alert('Terms Required', 'Please agree to the Terms of Service & Privacy Policy to continue.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const result = await register({
      email: email.trim().toLowerCase(),
      password,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      student_id: studentId.trim() || undefined,
      role: 'student',
    });
    setLoading(false);

    if (!result.success) {
      Alert.alert('Registration Failed', result.error);
    }
  };

  const InputField = ({ label, icon, inputRef, required, ...props }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ 
        ...typography.label,
        marginBottom: spacing.sm,
        color: colors.textSecondary,
      }}>
        {label} {required && '*'}
      </Text>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        ...inputStyle,
      }}>
        <Ionicons name={icon} size={18} color={colors.textTertiary} />
        <TextInput
          ref={inputRef}
          style={{ 
            flex: 1, 
            paddingVertical: 0, 
            paddingHorizontal: spacing.md, 
            fontSize: 16, 
            color: colors.textPrimary,
          }}
          placeholderTextColor={colors.textTertiary}
          {...props}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 100 }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginBottom: spacing.xxl,
              padding: spacing.xs,
              marginLeft: -spacing.xs,
            }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            <Text style={{ fontSize: 16, color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '500' }}>Back</Text>
          </TouchableOpacity>

          {/* Form Card */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            padding: spacing.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.md,
          }}>
            <View style={{ marginBottom: spacing.xxl }}>
              <Text style={{ ...typography.h2, marginBottom: spacing.xs }}>
                Create Account
              </Text>
              <Text style={{ ...typography.body }}>
                Join your college community
              </Text>
            </View>

            {/* Name Row */}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1, marginBottom: spacing.lg }}>
                <Text style={{ 
                  ...typography.label,
                  marginBottom: spacing.sm,
                  color: colors.textSecondary,
                }}>
                  First Name *
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  ...inputStyle,
                }}>
                  <TextInput
                    style={{ 
                      flex: 1, 
                      paddingVertical: 0, 
                      fontSize: 16, 
                      color: colors.textPrimary,
                    }}
                    placeholder="John"
                    placeholderTextColor={colors.textTertiary}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
              </View>
              <View style={{ flex: 1, marginBottom: spacing.lg }}>
                <Text style={{ 
                  ...typography.label,
                  marginBottom: spacing.sm,
                  color: colors.textSecondary,
                }}>
                  Last Name *
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  ...inputStyle,
                }}>
                  <TextInput
                    ref={lastNameRef}
                    style={{ 
                      flex: 1, 
                      paddingVertical: 0, 
                      fontSize: 16, 
                      color: colors.textPrimary,
                    }}
                    placeholder="Doe"
                    placeholderTextColor={colors.textTertiary}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
              </View>
            </View>

            <InputField
              label="Email"
              icon="mail-outline"
              inputRef={emailRef}
              required
              placeholder="you@college.edu"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => studentIdRef.current?.focus()}
              blurOnSubmit={false}
            />

            <InputField
              label="Student ID"
              icon="card-outline"
              inputRef={studentIdRef}
              placeholder="Optional"
              value={studentId}
              onChangeText={setStudentId}
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* Password Field */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ 
                ...typography.label,
                marginBottom: spacing.sm,
                color: colors.textSecondary,
              }}>
                Password *
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                ...inputStyle,
              }}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  ref={passwordRef}
                  style={{ 
                    flex: 1, 
                    paddingVertical: 0, 
                    paddingHorizontal: spacing.md, 
                    fontSize: 16, 
                    color: colors.textPrimary,
                  }}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Field */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ 
                ...typography.label,
                marginBottom: spacing.sm,
                color: colors.textSecondary,
              }}>
                Confirm Password *
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                ...inputStyle,
              }}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  ref={confirmPasswordRef}
                  style={{ 
                    flex: 1, 
                    paddingVertical: 0, 
                    paddingHorizontal: spacing.md, 
                    fontSize: 16, 
                    color: colors.textPrimary,
                  }}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              </View>
            </View>

            {/* Terms Checkbox */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'flex-start', 
              marginBottom: spacing.xl,
              padding: spacing.md,
              backgroundColor: colors.surfaceSecondary,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <TouchableOpacity
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                style={{ marginTop: 1 }}
              >
                <View style={{
                  width: 22,
                  height: 22,
                  borderRadius: borderRadius.sm,
                  borderWidth: 2,
                  borderColor: agreedToTerms ? primaryColor : colors.border,
                  backgroundColor: agreedToTerms ? primaryColor : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  {agreedToTerms && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
                </View>
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary, marginLeft: spacing.md, lineHeight: 20 }}>
                I agree to the{' '}
                <Text
                  style={{ color: primaryColor, fontWeight: '600' }}
                  onPress={() => setShowTerms(true)}
                  suppressHighlighting={true}
                >
                  Terms of Service & Privacy Policy
                </Text>
              </Text>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading || !agreedToTerms}
              activeOpacity={0.8}
              style={{
                ...buttonPrimary,
                backgroundColor: primaryColor,
                opacity: (loading || !agreedToTerms) ? 0.5 : 1,
                flexDirection: 'row',
              }}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <Text style={{ ...typography.button }}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.textInverse} style={{ marginLeft: spacing.sm }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={{ fontSize: 14, color: primaryColor, fontWeight: '700' }}>Sign In</Text>
            </TouchableOpacity>
          </View>
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
