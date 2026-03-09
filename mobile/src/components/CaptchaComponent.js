/**
 * CAPTCHA Component for Quadley Mobile App
 * 
 * Supports:
 * 1. Math CAPTCHA (built-in)
 * 2. hCaptcha (WebView-based)
 * 
 * Usage:
 * <CaptchaComponent 
 *   onVerify={(success) => console.log('Verified:', success)}
 *   onError={(error) => console.error(error)}
 * />
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { ENDPOINTS } from '../config/api';
import { 
  announceForAccessibility, 
  getButtonAccessibility,
  getInputAccessibility 
} from '../utils/accessibility';

// hCaptcha HTML template
const getHCaptchaHTML = (siteKey) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://js.hcaptcha.com/1/api.js" async defer></script>
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f9fafb;
    }
  </style>
</head>
<body>
  <div class="h-captcha" data-sitekey="${siteKey}" data-callback="onVerify"></div>
  <script>
    function onVerify(token) {
  const { themeColors: colors } = useAppTheme();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'verify', token: token }));
    }
  </script>
</body>
</html>
`;

const CaptchaComponent = ({ 
  onVerify, 
  onError,
  style,
}) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [showHCaptcha, setShowHCaptcha] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get(`${ENDPOINTS.CAPTCHA || '/captcha'}/config`);
      setConfig(response.data);
      
      if (response.data.provider === 'math') {
        await fetchChallenge();
      }
    } catch (err) {
      console.error('Failed to fetch CAPTCHA config:', err);
      setError('Failed to load CAPTCHA');
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChallenge = async () => {
    try {
      const response = await api.get(`${ENDPOINTS.CAPTCHA || '/captcha'}/challenge`);
      setChallenge(response.data);
      setAnswer('');
      setError('');
      announceForAccessibility(`CAPTCHA challenge: ${response.data.question}`);
    } catch (err) {
      console.error('Failed to fetch challenge:', err);
      setError('Failed to load challenge');
    }
  };

  const verifyMathCaptcha = async () => {
    if (!answer.trim()) {
      setError('Please enter your answer');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const response = await api.post(`${ENDPOINTS.CAPTCHA || '/captcha'}/verify`, {
        captcha_type: 'math',
        captcha_id: challenge.captcha_id,
        answer: answer.trim(),
      });

      if (response.data.verified) {
        announceForAccessibility('CAPTCHA verified successfully');
        onVerify?.(true);
      } else {
        setError('Incorrect answer. Please try again.');
        announceForAccessibility('Incorrect answer. Please try again.');
        await fetchChallenge();
        onVerify?.(false);
      }
    } catch (err) {
      const message = err.response?.data?.detail || 'Verification failed';
      setError(message);
      announceForAccessibility(message);
      await fetchChallenge();
      onVerify?.(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleHCaptchaMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'verify' && data.token) {
        setShowHCaptcha(false);
        setVerifying(true);

        const response = await api.post(`${ENDPOINTS.CAPTCHA || '/captcha'}/verify`, {
          captcha_type: 'hcaptcha',
          token: data.token,
        });

        if (response.data.verified) {
          announceForAccessibility('CAPTCHA verified successfully');
          onVerify?.(true);
        } else {
          setError('Verification failed');
          onVerify?.(false);
        }
        setVerifying(false);
      }
    } catch (err) {
      setError('Verification failed');
      setVerifying(false);
      onVerify?.(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading CAPTCHA...</Text>
      </View>
    );
  }

  // hCaptcha/reCAPTCHA provider
  if (config?.provider === 'hcaptcha' && config?.sitekey) {
    return (
      <View style={[styles.container, style]}>
        <TouchableOpacity
          style={styles.hcaptchaButton}
          onPress={() => setShowHCaptcha(true)}
          disabled={verifying}
          {...getButtonAccessibility('Complete CAPTCHA verification', verifying, verifying)}
        >
          {verifying ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              <Text style={styles.hcaptchaText}>Verify you're human</Text>
            </>
          )}
        </TouchableOpacity>

        <Modal
          visible={showHCaptcha}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowHCaptcha(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowHCaptcha(false)}
                accessibilityLabel="Close CAPTCHA"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              
              <WebView
                ref={webViewRef}
                source={{ html: getHCaptchaHTML(config.sitekey) }}
                onMessage={handleHCaptchaMessage}
                style={styles.webview}
              />
            </View>
          </View>
        </Modal>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  // Math CAPTCHA (default)
  return (
    <View style={[styles.container, style]}>
      <View style={styles.mathContainer}>
        <View style={styles.questionRow}>
          <View style={styles.questionBox}>
            <Text 
              style={styles.question}
              accessibilityLabel={`CAPTCHA: ${challenge?.question || 'Loading...'}`}
            >
              {challenge?.question || 'Loading...'}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={fetchChallenge}
            disabled={verifying}
            accessibilityLabel="Get new CAPTCHA"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.answerRow}>
          <TextInput
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Your answer"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={verifyMathCaptcha}
            editable={!verifying}
            {...getInputAccessibility('CAPTCHA answer', 'Enter the answer to the math problem', true)}
          />
          
          <TouchableOpacity
            style={[styles.verifyButton, verifying && styles.verifyingButton]}
            onPress={verifyMathCaptcha}
            disabled={verifying || !answer.trim()}
            {...getButtonAccessibility('Verify CAPTCHA', verifying || !answer.trim(), verifying)}
          >
            {verifying ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.verifyText}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  mathContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionBox: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 12,
    marginLeft: 8,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 12,
  },
  verifyingButton: {
    backgroundColor: colors.textTertiary,
  },
  verifyText: {
    color: colors.textInverse,
    fontWeight: '600',
    fontSize: 16,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  hcaptchaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hcaptchaText: {
    marginLeft: 8,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '90%',
    height: 400,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 8,
  },
  webview: {
    flex: 1,
  },
});

export default CaptchaComponent;
