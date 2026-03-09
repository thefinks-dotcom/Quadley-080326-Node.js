/**
 * Quadley App Theme - Swiss Technical Design System
 * Clean, professional aesthetic with tenant-agnostic design.
 * Colors should come from tenant branding - this provides sensible defaults.
 */

export const fonts = {
  light: 'PlusJakartaSans_300Light',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export const colors = {
  // Primary - Deep Blue (Quadley default)
  primary: '#1e3a5f',
  primaryLight: '#2d4a6f',
  primaryMuted: '#3d5a7f',
  
  // Secondary - Silver/Cool Gray
  secondary: '#64748b',
  secondaryLight: '#94a3b8',
  
  // Backgrounds
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceSecondary: '#f1f5f9',
  surfaceDark: '#1e3a5f',

  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  textInverse: '#ffffff',

  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  borderDark: '#cbd5e1',

  // Status (semantic colors - these stay consistent across tenants)
  success: '#059669',
  successLight: '#d1fae5',
  warning: '#d97706',
  warningLight: '#fef3c7',
  error: '#dc2626',
  errorLight: '#fee2e2',
  info: '#0284c7',
  infoLight: '#e0f2fe',

  // Accent - Used for action items, pending states, highlights
  accent: '#3b7dd8',
  accentLight: '#e8f0fe',

  // Module icons
  moduleIcon: '#64748b',

  // Tab bar
  tabActive: '#1e3a5f',
  tabInactive: '#94a3b8',
};

export const darkColors = {
  // Primary - stays the same for branding
  primary: '#1e3a5f',
  primaryLight: '#2d4a6f',
  primaryMuted: '#3d5a7f',

  // Secondary
  secondary: '#94a3b8',
  secondaryLight: '#64748b',

  // Backgrounds - dark surfaces
  background: '#0f1419',
  surface: '#1a2332',
  surfaceSecondary: '#232f3e',
  surfaceDark: '#1e3a5f',

  // Text - inverted hierarchy
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  textInverse: '#ffffff',

  // Borders - subtle on dark
  border: '#2a3a4e',
  borderLight: '#232f3e',
  borderDark: '#3d5068',

  // Status - slightly muted for dark
  success: '#10b981',
  successLight: '#064e3b',
  warning: '#f59e0b',
  warningLight: '#78350f',
  error: '#ef4444',
  errorLight: '#7f1d1d',
  info: '#38bdf8',
  infoLight: '#0c4a6e',

  // Accent
  accent: '#60a5fa',
  accentLight: '#1e3a5f',

  // Module icons
  moduleIcon: '#94a3b8',

  // Tab bar
  tabActive: '#60a5fa',
  tabInactive: '#64748b',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const typography = {
  // Headings - tight letter spacing
  h1: { 
    fontSize: 28, 
    fontFamily: fonts.bold, 
    color: colors.textPrimary, 
    letterSpacing: -0.5 
  },
  h2: { 
    fontSize: 22, 
    fontFamily: fonts.bold, 
    color: colors.textPrimary, 
    letterSpacing: -0.3 
  },
  h3: { 
    fontSize: 17, 
    fontFamily: fonts.semiBold, 
    color: colors.textPrimary,
    letterSpacing: -0.2
  },
  // Body text
  body: { 
    fontSize: 15, 
    fontFamily: fonts.regular, 
    color: colors.textSecondary, 
    lineHeight: 22 
  },
  bodyMedium: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    lineHeight: 22
  },
  bodySmall: { 
    fontSize: 13, 
    fontFamily: fonts.regular, 
    color: colors.textSecondary 
  },
  // UI elements
  caption: { 
    fontSize: 11, 
    fontFamily: fonts.semiBold, 
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  label: { 
    fontSize: 15, 
    fontFamily: fonts.semiBold, 
    color: colors.textPrimary 
  },
  button: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textInverse,
  },
};

// Common card style
export const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: borderRadius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  ...shadows.sm,
};

// Common input style
export const inputStyle = {
  backgroundColor: colors.surface,
  borderRadius: borderRadius.md,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: spacing.lg,
  paddingVertical: 14,
  fontSize: 16,
  color: colors.textPrimary,
};

// Primary button - uses tenant primary color
export const buttonPrimary = {
  backgroundColor: colors.primary,
  paddingVertical: 16,
  paddingHorizontal: spacing.xxl,
  borderRadius: borderRadius.md,
  alignItems: 'center',
  justifyContent: 'center',
  ...shadows.sm,
};

// Secondary button - outline
export const buttonSecondary = {
  backgroundColor: 'transparent',
  paddingVertical: 15,
  paddingHorizontal: spacing.xxl,
  borderRadius: borderRadius.md,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1.5,
  borderColor: colors.border,
};

// Tab bar style
export const tabBarStyle = {
  backgroundColor: colors.surface,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  paddingTop: 8,
  paddingBottom: 8,
  height: 60,
};

// Header style
export const headerStyle = {
  backgroundColor: colors.surface,
  elevation: 0,
  shadowOpacity: 0,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
};

// Screen container
export const screenContainer = {
  flex: 1,
  backgroundColor: colors.background,
};

// Badge styles
export const badge = {
  paddingHorizontal: spacing.sm,
  paddingVertical: 4,
  borderRadius: borderRadius.full,
  backgroundColor: colors.surfaceSecondary,
};

export const badgeText = {
  fontSize: 11,
  fontFamily: fonts.semiBold,
  color: colors.textSecondary,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
};
