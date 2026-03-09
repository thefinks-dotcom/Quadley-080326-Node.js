/**
 * Accessibility Utilities for Quadley Mobile App
 * 
 * Provides:
 * 1. Screen reader announcements
 * 2. Accessibility labels and hints
 * 3. Focus management helpers
 * 4. Reduced motion support
 */

import { AccessibilityInfo, Platform } from 'react-native';

// Check if screen reader is enabled
export const isScreenReaderEnabled = async () => {
  return await AccessibilityInfo.isScreenReaderEnabled();
};

// Check if reduce motion is enabled
export const isReduceMotionEnabled = async () => {
  return await AccessibilityInfo.isReduceMotionEnabled();
};

// Announce message to screen reader
export const announceForAccessibility = (message) => {
  AccessibilityInfo.announceForAccessibility(message);
};

// Generate accessibility props for common components
export const getAccessibilityProps = (label, hint, role = 'button') => ({
  accessible: true,
  accessibilityLabel: label,
  accessibilityHint: hint,
  accessibilityRole: role,
});

// Common accessibility labels
export const A11Y_LABELS = {
  // Navigation
  BACK_BUTTON: 'Go back',
  CLOSE_BUTTON: 'Close',
  MENU_BUTTON: 'Open menu',
  SEARCH_BUTTON: 'Search',
  REFRESH_BUTTON: 'Refresh content',
  
  // Actions
  SUBMIT_BUTTON: 'Submit',
  CANCEL_BUTTON: 'Cancel',
  SAVE_BUTTON: 'Save changes',
  DELETE_BUTTON: 'Delete',
  EDIT_BUTTON: 'Edit',
  
  // Status
  LOADING: 'Loading content',
  ERROR: 'An error occurred',
  SUCCESS: 'Action completed successfully',
  EMPTY_LIST: 'No items to display',
  
  // Forms
  EMAIL_INPUT: 'Email address',
  PASSWORD_INPUT: 'Password',
  SEARCH_INPUT: 'Search field',
};

// Accessibility hints
export const A11Y_HINTS = {
  // Navigation
  BACK_BUTTON: 'Double tap to go back to the previous screen',
  CLOSE_MODAL: 'Double tap to close this dialog',
  
  // Lists
  LIST_ITEM: 'Double tap to view details',
  EXPANDABLE_ITEM: 'Double tap to expand or collapse',
  
  // Forms
  REQUIRED_FIELD: 'This field is required',
  OPTIONAL_FIELD: 'This field is optional',
  
  // Actions
  DESTRUCTIVE_ACTION: 'This action cannot be undone',
};

// Accessible button component props
export const getButtonAccessibility = (label, isDisabled = false, isLoading = false) => {
  let state = [];
  if (isDisabled) state.push('disabled');
  if (isLoading) state.push('busy');
  
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'button',
    accessibilityState: {
      disabled: isDisabled,
      busy: isLoading,
    },
  };
};

// Accessible text input props
export const getInputAccessibility = (label, hint, isRequired = false) => ({
  accessible: true,
  accessibilityLabel: label,
  accessibilityHint: hint || (isRequired ? A11Y_HINTS.REQUIRED_FIELD : A11Y_HINTS.OPTIONAL_FIELD),
  accessibilityRole: 'none', // React Native doesn't have 'textbox' role
});

// Accessible header props
export const getHeaderAccessibility = (title) => ({
  accessible: true,
  accessibilityLabel: title,
  accessibilityRole: 'header',
});

// Accessible image props
export const getImageAccessibility = (description, isDecorative = false) => {
  if (isDecorative) {
    return {
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    };
  }
  
  return {
    accessible: true,
    accessibilityLabel: description,
    accessibilityRole: 'image',
  };
};

// Accessible list item props
export const getListItemAccessibility = (label, index, total) => ({
  accessible: true,
  accessibilityLabel: `${label}, item ${index + 1} of ${total}`,
  accessibilityRole: 'button',
  accessibilityHint: A11Y_HINTS.LIST_ITEM,
});

// Accessible toggle/switch props
export const getToggleAccessibility = (label, isOn) => ({
  accessible: true,
  accessibilityLabel: label,
  accessibilityRole: 'switch',
  accessibilityState: { checked: isOn },
  accessibilityHint: `Double tap to ${isOn ? 'turn off' : 'turn on'}`,
});

// Accessible checkbox props
export const getCheckboxAccessibility = (label, isChecked) => ({
  accessible: true,
  accessibilityLabel: label,
  accessibilityRole: 'checkbox',
  accessibilityState: { checked: isChecked },
  accessibilityHint: `Double tap to ${isChecked ? 'uncheck' : 'check'}`,
});

// Format date for screen readers
export const formatDateForScreenReader = (date) => {
  if (!date) return 'Date not specified';
  
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Format time for screen readers
export const formatTimeForScreenReader = (date) => {
  if (!date) return 'Time not specified';
  
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Format count for screen readers
export const formatCountForScreenReader = (count, singular, plural) => {
  if (count === 0) return `No ${plural}`;
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
};

// Live region for dynamic content updates
export const getLiveRegionProps = (politeness = 'polite') => ({
  accessibilityLiveRegion: politeness, // 'polite', 'assertive', or 'none'
});

// Skip link for keyboard navigation (web-like behavior)
export const getSkipLinkProps = (targetId) => ({
  accessible: true,
  accessibilityRole: 'link',
  accessibilityLabel: 'Skip to main content',
  accessibilityHint: 'Double tap to skip navigation and go to main content',
});

export default {
  isScreenReaderEnabled,
  isReduceMotionEnabled,
  announceForAccessibility,
  getAccessibilityProps,
  getButtonAccessibility,
  getInputAccessibility,
  getHeaderAccessibility,
  getImageAccessibility,
  getListItemAccessibility,
  getToggleAccessibility,
  getCheckboxAccessibility,
  formatDateForScreenReader,
  formatTimeForScreenReader,
  formatCountForScreenReader,
  getLiveRegionProps,
  A11Y_LABELS,
  A11Y_HINTS,
};
