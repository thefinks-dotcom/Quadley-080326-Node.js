import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, borderRadius, shadows, typography, buttonPrimary } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function MFAVerifyScreen({ navigation, route }) {
  const { themeColors: colors } = useAppTheme();
  const { completeMfaVerification, logout } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleVerify = async () => {
    const trimmedCode = code.trim().replace(/[- ]/g, '');
    
    if (useBackupCode) {
      if (trimmedCode.length !== 8) {
        setError('Backup codes are 8 characters (XXXX-XXXX)');
        return;
      }
    } else {
      if (trimmedCode.length !== 6) {
        setError('Please enter a 6-digit code');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      await authService.verifyMFA(trimmedCode, useBackupCode);
      completeMfaVerification();
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          bounces={false}
        >
          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={[styles.iconBox, useBackupCode && { backgroundColor: colors.primary }]}>
                <Ionicons 
                  name={useBackupCode ? "key" : "shield-checkmark"} 
                  size={40} 
                  color={colors.textInverse} 
                />
              </View>
            </View>

            <Text style={styles.title}>
              {useBackupCode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
            </Text>

            <Text style={styles.description}>
              {useBackupCode 
                ? 'Enter one of your backup codes to verify your identity.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </Text>

            {/* Code Input */}
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
              placeholderTextColor={colors.textTertiary}
              keyboardType={useBackupCode ? "default" : "number-pad"}
              maxLength={useBackupCode ? 9 : 6}
              textAlign="center"
              autoFocus
              autoCapitalize={useBackupCode ? "characters" : "none"}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            {/* Toggle backup code */}
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => {
                setUseBackupCode(!useBackupCode);
                setCode('');
                setError('');
              }}
            >
              <Text style={styles.linkButtonText}>
                {useBackupCode 
                  ? 'Use authenticator app instead' 
                  : 'Use a backup code'}
              </Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => logout()}
            >
              <Text style={[styles.linkButtonText, { color: colors.textTertiary }]}>
                Cancel login
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xxxl,
  },
  content: {
    padding: spacing.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 12,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    ...buttonPrimary,
    marginBottom: spacing.lg,
  },
  disabledButton: {
    backgroundColor: colors.textTertiary,
  },
  primaryButtonText: {
    ...typography.button,
  },
  linkButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontSize: 14,
  },
});
