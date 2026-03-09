/**
 * Accessible Text Input Component
 * 
 * A text input component with built-in accessibility support including:
 * - Screen reader labels
 * - Error announcements
 * - Character count announcements
 */

import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { 
  getInputAccessibility, 
  announceForAccessibility,
  getLiveRegionProps 
} from '../utils/accessibility';

const AccessibleInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  accessibilityHint,
  error,
  helperText,
  required = false,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  maxLength,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  icon,
  showClearButton = false,
  onSubmit,
  returnKeyType = 'done',
  style,
  inputStyle,
  testID,
}) => {
  const { themeColors: colors } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = () => {
    setIsFocused(true);
    if (label) {
      announceForAccessibility(`Editing ${label}`);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleClear = () => {
    onChangeText('');
    inputRef.current?.focus();
    announceForAccessibility('Text cleared');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
    announceForAccessibility(showPassword ? 'Password hidden' : 'Password visible');
  };

  const handleChangeText = (text) => {
    onChangeText(text);
    
    // Announce character count for multiline inputs
    if (multiline && maxLength) {
      const remaining = maxLength - text.length;
      if (remaining === 20 || remaining === 10 || remaining === 5) {
        announceForAccessibility(`${remaining} characters remaining`);
      }
    }
  };

  const getBorderColor = () => {
    if (error) return colors.error;
    if (isFocused) return colors.primary;
    return colors.borderDark;
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text 
            style={styles.label}
            {...getInputAccessibility(label, accessibilityHint, required)}
          >
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      )}

      <View 
        style={[
          styles.inputContainer,
          { borderColor: getBorderColor() },
          multiline && styles.multilineContainer,
          !editable && styles.disabledContainer,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? colors.primary : colors.textTertiary}
            style={styles.icon}
          />
        )}

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmit}
          returnKeyType={returnKeyType}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            inputStyle,
          ]}
          {...getInputAccessibility(
            label || placeholder,
            error || accessibilityHint,
            required
          )}
          testID={testID}
        />

        {secureTextEntry && (
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            style={styles.iconButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}

        {showClearButton && value && value.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            accessibilityLabel="Clear text"
            accessibilityRole="button"
            style={styles.iconButton}
          >
            <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error or helper text */}
      {(error || helperText || maxLength) && (
        <View style={styles.bottomRow} {...getLiveRegionProps('polite')}>
          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : helperText ? (
            <Text style={styles.helperText}>{helperText}</Text>
          ) : null}
          
          {maxLength && (
            <Text 
              style={[
                styles.charCount,
                value && value.length > maxLength * 0.9 && styles.charCountWarning,
              ]}
              accessibilityLabel={`${value?.length || 0} of ${maxLength} characters`}
            >
              {value?.length || 0}/{maxLength}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  required: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  multilineContainer: {
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  disabledContainer: {
    backgroundColor: colors.surfaceSecondary,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  iconButton: {
    padding: 4,
    marginLeft: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  charCount: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  charCountWarning: {
    color: colors.warning,
  },
});

export default AccessibleInput;
