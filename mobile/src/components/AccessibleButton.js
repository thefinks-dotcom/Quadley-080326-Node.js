/**
 * Accessible Button Component
 * 
 * A button component with built-in accessibility support including:
 * - Screen reader labels
 * - Loading states
 * - Disabled states
 * - Haptic feedback
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { getButtonAccessibility } from '../utils/accessibility';

const AccessibleButton = ({
  onPress,
  title,
  accessibilityLabel,
  accessibilityHint,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger', 'text'
  size = 'medium', // 'small', 'medium', 'large'
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  testID,
}) => {
  const { themeColors: colors } = useAppTheme();
  const isDisabled = disabled || loading;
  const label = accessibilityLabel || title;
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          button: { backgroundColor: colors.secondary },
          text: { color: colors.textInverse },
        };
      case 'outline':
        return {
          button: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary },
          text: { color: colors.primary },
        };
      case 'danger':
        return {
          button: { backgroundColor: colors.error },
          text: { color: colors.textInverse },
        };
      case 'text':
        return {
          button: { backgroundColor: 'transparent', paddingHorizontal: 8 },
          text: { color: colors.primary },
        };
      default: // primary
        return {
          button: { backgroundColor: colors.primary },
          text: { color: colors.textInverse },
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          button: { paddingVertical: 8, paddingHorizontal: 12 },
          text: { fontSize: 14 },
          icon: 18,
        };
      case 'large':
        return {
          button: { paddingVertical: 16, paddingHorizontal: 24 },
          text: { fontSize: 18 },
          icon: 24,
        };
      default: // medium
        return {
          button: { paddingVertical: 12, paddingHorizontal: 20 },
          text: { fontSize: 16 },
          icon: 20,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        variantStyles.button,
        sizeStyles.button,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...getButtonAccessibility(label, isDisabled, loading)}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variantStyles.text.color} 
          accessibilityLabel="Loading"
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={sizeStyles.icon}
              color={isDisabled ? colors.textTertiary : variantStyles.text.color}
              style={styles.iconLeft}
            />
          )}
          <Text
            style={[
              styles.text,
              variantStyles.text,
              sizeStyles.text,
              isDisabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={sizeStyles.icon}
              color={isDisabled ? colors.textTertiary : variantStyles.text.color}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  disabledText: {
    color: colors.textTertiary,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

export default AccessibleButton;
