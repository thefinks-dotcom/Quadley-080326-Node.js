import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { spacing, borderRadius, shadows, typography, buttonPrimary } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function MFASetupScreen({ navigation, route }) {
  const { themeColors: colors } = useAppTheme();
  const { refreshUser, completeMfaSetup } = useAuth();
  const [step, setStep] = useState('intro');
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');

  const isRequired = route?.params?.required || false;

  const handleSetupMFA = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await authService.setupMFA();
      setSetupData(data);
      setStep('setup');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start MFA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await authService.enableMFA(verificationCode);
      setStep('backup');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      await refreshUser(false);
    } catch (err) {
      console.log('[MFASetup] User refresh after setup failed (non-fatal):', err?.message);
    }
    completeMfaSetup();
  };

  // Dynamic styles that use the theme-context colors (not static module-scope colors)
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: borderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      minHeight: 52,
      ...shadows.md,
    },
    disabledButton: {
      backgroundColor: colors.textTertiary,
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
  };

  const renderIntro = () => (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: spacing.xxl,
        paddingTop: spacing.xxl + 40,
        paddingBottom: spacing.xxxxl || 64,
      }}
      keyboardShouldPersistTaps="always"
      bounces={false}
    >
      <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
        <View style={{
          width: 80, height: 80, borderRadius: borderRadius.xl,
          backgroundColor: colors.primary, alignItems: 'center',
          justifyContent: 'center', ...shadows.lg,
        }}>
          <Ionicons name="shield-checkmark" size={40} color={colors.textInverse} />
        </View>
      </View>
      
      <Text style={{ ...typography.h1, textAlign: 'center', marginBottom: spacing.md, color: colors.textPrimary }}>
        Two-Factor Authentication
      </Text>
      
      <Text style={{ ...typography.body, textAlign: 'center', marginBottom: spacing.xxl, paddingHorizontal: spacing.lg, color: colors.textSecondary }}>
        {isRequired 
          ? 'As an administrator, you are required to enable two-factor authentication to protect your account.'
          : 'Add an extra layer of security to your account with two-factor authentication.'}
      </Text>

      <View style={{ marginBottom: spacing.xxxl }}>
        {[
          'Protects against unauthorized access',
          'Works with authenticator apps',
          'Backup codes for recovery',
        ].map((text, i) => (
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.surface, padding: spacing.md,
            borderRadius: borderRadius.md, marginBottom: spacing.sm,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.primary + '15',
              alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
            }}>
              <Ionicons name="checkmark" size={14} color={colors.primary} />
            </View>
            <Text style={{ ...typography.bodyMedium, flex: 1, color: colors.textPrimary }}>{text}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={{ color: colors.error, textAlign: 'center', marginBottom: spacing.lg, fontSize: 14 }}>{error}</Text> : null}

      {/* Set Up 2FA — uses Pressable with hitSlop for reliable iPad touch handling */}
      <Pressable
        onPress={handleSetupMFA}
        disabled={loading}
        testID="setup-2fa-button"
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Set Up Two-Factor Authentication"
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        style={({ pressed }) => [
          dynamicStyles.primaryButton,
          loading && dynamicStyles.disabledButton,
          pressed && { opacity: 0.85 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <>
            <Text style={dynamicStyles.primaryButtonText}>Set Up 2FA</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.textInverse} style={{ marginLeft: 8 }} />
          </>
        )}
      </Pressable>

      {!isRequired && (
        <Pressable
          onPress={() => completeMfaSetup()}
          testID="mfa-skip-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Skip two-factor authentication setup"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: spacing.lg, alignItems: 'center' }}
        >
          <Text style={{ ...typography.body, color: colors.textTertiary }}>Maybe Later</Text>
        </Pressable>
      )}
    </ScrollView>
  );

  const renderSetup = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, padding: spacing.xxl }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xxxxl || 64 }}
        keyboardShouldPersistTaps="always"
      >
        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ ...typography.caption, marginBottom: spacing.xs, color: colors.textTertiary }}>STEP 1 OF 2</Text>
          <Text style={{ ...typography.h2, color: colors.textPrimary }}>Scan QR Code</Text>
        </View>
        
        <Text style={{ ...typography.body, marginBottom: spacing.lg, color: colors.textSecondary }}>
          Open your authenticator app and scan this code:
        </Text>

        {setupData?.qr_code && (
          <View style={{
            alignItems: 'center', backgroundColor: colors.surface,
            padding: spacing.xxl, borderRadius: borderRadius.lg,
            marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border,
          }}>
            <Image 
              source={{ uri: `data:image/png;base64,${setupData.qr_code}` }}
              style={{ width: 180, height: 180 }}
              resizeMode="contain"
            />
          </View>
        )}

        <Text style={{ ...typography.bodySmall, textAlign: 'center', marginBottom: spacing.md, color: colors.textTertiary }}>
          Or enter manually:
        </Text>
        
        <View style={{
          backgroundColor: colors.primary, padding: spacing.lg,
          borderRadius: borderRadius.md, marginBottom: spacing.xxl,
        }}>
          <Text selectable style={{
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: 13, textAlign: 'center', color: colors.textInverse, letterSpacing: 1,
          }}>
            {setupData?.secret}
          </Text>
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ ...typography.caption, marginBottom: spacing.xs, color: colors.textTertiary }}>STEP 2 OF 2</Text>
          <Text style={{ ...typography.h2, color: colors.textPrimary }}>Verify Code</Text>
        </View>
        
        <Text style={{ ...typography.body, marginBottom: spacing.lg, color: colors.textSecondary }}>
          Enter the 6-digit code from your app:
        </Text>

        <TextInput
          style={{
            backgroundColor: colors.surface, borderWidth: 1,
            borderColor: colors.border, borderRadius: borderRadius.md,
            padding: spacing.lg, fontSize: 28, fontWeight: '700',
            letterSpacing: 12, color: colors.textPrimary, marginBottom: spacing.lg,
          }}
          value={verificationCode}
          onChangeText={setVerificationCode}
          placeholder="000000"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          testID="mfa-verification-input"
        />

        {error ? <Text style={{ color: colors.error, textAlign: 'center', marginBottom: spacing.lg, fontSize: 14 }}>{error}</Text> : null}

        <Pressable
          onPress={handleVerifyCode}
          disabled={loading || verificationCode.length !== 6}
          testID="mfa-verify-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Verify and enable two-factor authentication"
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={({ pressed }) => [
            dynamicStyles.primaryButton,
            verificationCode.length !== 6 && dynamicStyles.disabledButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={dynamicStyles.primaryButtonText}>Verify & Enable</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderBackupCodes = () => (
    <ScrollView
      style={{ flex: 1, padding: spacing.xxl }}
      contentContainerStyle={{ paddingBottom: spacing.xxxxl || 64 }}
    >
      <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
        <View style={{
          width: 80, height: 80, borderRadius: borderRadius.xl,
          backgroundColor: colors.primary, alignItems: 'center',
          justifyContent: 'center', ...shadows.lg,
        }}>
          <Ionicons name="key" size={36} color={colors.textInverse} />
        </View>
      </View>

      <Text style={{ ...typography.h1, textAlign: 'center', marginBottom: spacing.md, color: colors.textPrimary }}>
        Save Your Backup Codes
      </Text>
      
      <Text style={{ ...typography.body, textAlign: 'center', marginBottom: spacing.xxl, paddingHorizontal: spacing.lg, color: colors.textSecondary }}>
        Store these codes securely. Each can only be used once.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.xxl }}>
        {setupData?.backup_codes?.map((code, index) => (
          <View key={index} style={{
            width: '48%', backgroundColor: colors.primary,
            padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm,
          }}>
            <Text style={{
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              fontSize: 13, textAlign: 'center', color: colors.textInverse, fontWeight: '600',
            }}>
              {code}
            </Text>
          </View>
        ))}
      </View>

      <View style={{
        flexDirection: 'row', backgroundColor: colors.primary + '15',
        padding: spacing.lg, borderRadius: borderRadius.md,
        marginBottom: spacing.xxl, alignItems: 'center',
        borderWidth: 1, borderColor: colors.primary,
      }}>
        <Ionicons name="warning" size={20} color={colors.primary} />
        <Text style={{ flex: 1, marginLeft: spacing.md, color: colors.primary, fontSize: 14, fontWeight: '500' }}>
          Save these codes now! You won't see them again.
        </Text>
      </View>

      <Pressable
        onPress={() => setStep('complete')}
        testID="mfa-codes-saved-button"
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="I have saved my backup codes"
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        style={({ pressed }) => [
          dynamicStyles.primaryButton,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={dynamicStyles.primaryButtonText}>I've Saved My Codes</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.textInverse} style={{ marginLeft: 8 }} />
      </Pressable>
    </ScrollView>
  );

  const renderComplete = () => (
    <View style={{ flex: 1, padding: spacing.xxl, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
        <View style={{
          width: 80, height: 80, borderRadius: borderRadius.xl,
          backgroundColor: colors.primary, alignItems: 'center',
          justifyContent: 'center', ...shadows.lg,
        }}>
          <Ionicons name="checkmark" size={48} color={colors.textInverse} />
        </View>
      </View>
      
      <Text style={{ ...typography.h1, textAlign: 'center', marginBottom: spacing.md, color: colors.textPrimary }}>
        2FA Enabled!
      </Text>
      
      <Text style={{ ...typography.body, textAlign: 'center', marginBottom: spacing.xxl, paddingHorizontal: spacing.lg, color: colors.textSecondary }}>
        Your account is now protected. You'll need a code from your authenticator app when logging in.
      </Text>

      <Pressable
        onPress={handleComplete}
        testID="mfa-complete-button"
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Continue to the app"
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        style={({ pressed }) => [
          dynamicStyles.primaryButton,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={dynamicStyles.primaryButtonText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.textInverse} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top', 'bottom']}>
      {!isRequired && step !== 'complete' && (
        <View style={dynamicStyles.header}>
          <Pressable
            onPress={() => completeMfaSetup()}
            testID="mfa-close-button"
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close two-factor authentication setup"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ width: 40, height: 40, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ ...typography.h3, color: colors.textPrimary }}>Two-Factor Authentication</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {step === 'intro' && renderIntro()}
      {step === 'setup' && renderSetup()}
      {step === 'backup' && renderBackupCodes()}
      {step === 'complete' && renderComplete()}
    </SafeAreaView>
  );
}
