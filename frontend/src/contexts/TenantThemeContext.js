/**
 * TenantThemeContext
 * ==================
 * Manages the active tenant's color palette and branding data.
 *
 * Lifecycle:
 *  1. On mount (or when user/URL changes), determine the active tenant code:
 *       • Post-login  → user.tenant_code from AuthContext
 *       • Pre-login   → ?tenant=CODE URL param or REACT_APP_TENANT_CODE env var
 *  2. Apply the static fallback theme immediately (zero-flash).
 *  3. Fetch live branding from /api/branding/public/{code} in the background.
 *  4. Re-apply CSS variables with the live values once fetched.
 *
 * How colors reach components:
 *  CSS custom properties are injected onto <html> (document.documentElement).
 *  Tailwind reads them via hsl(var(--primary)) etc, so all utility classes
 *  (bg-primary, text-primary, border-primary …) automatically reflect the
 *  active tenant's palette. Components do NOT need to call useTenantTheme
 *  for colors — only for branding metadata (logo, app name, etc.).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
// NOTE: useContext is kept for the useTenantTheme() consumer hook below
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { hexToHsl, shiftLightness, toMutedVariant } from '@/utils/colorUtils';
import {
  PLATFORM_THEME,
  getStaticThemeForTenant,
} from '@/config/tenantThemes';

const TenantThemeContext = createContext({
  branding: null,
  tenantCode: null,
  tenantName: null,
  isThemeLoaded: false,
});

export const useTenantTheme = () => useContext(TenantThemeContext);

function setCssVar(name, value) {
  if (value != null) {
    document.documentElement.style.setProperty(name, value);
  }
}

/**
 * Inject a complete theme token-set as CSS custom properties on :root.
 * Only tokens present in the theme object are applied; missing tokens
 * are left as-is (CSS file fallback values remain active).
 */
function applyThemeToDom(theme) {
  setCssVar('--primary',             theme.primary);
  setCssVar('--primary-foreground',  theme.primaryForeground);
  setCssVar('--secondary',           theme.secondary);
  setCssVar('--secondary-foreground',theme.secondaryForeground);
  setCssVar('--background',          theme.background);
  setCssVar('--foreground',          theme.foreground);
  setCssVar('--muted',               theme.muted);
  setCssVar('--muted-foreground',    theme.mutedForeground);
  setCssVar('--accent',              theme.accent);
  setCssVar('--accent-foreground',   theme.accentForeground);
  setCssVar('--ring',                theme.ring);
  setCssVar('--border',              theme.border);
  setCssVar('--input',               theme.input);
  setCssVar('--avatar-bg',           theme.avatarBg);
  setCssVar('--avatar-fg',           theme.avatarFg);
  setCssVar('--chart-1',             theme.primary);
}

/**
 * Convert a raw branding object from the API into the token-set
 * that applyThemeToDom expects.  Falls back to PLATFORM_THEME
 * for any token whose source color is absent.
 *
 * Key white-label principle: ALL neutral tokens (muted, border, input)
 * are derived from the tenant's primary hue so the entire app feels
 * on-brand, not navy-tinted from the Quadley platform defaults.
 */
function brandingToTheme(branding = {}) {
  const primary   = hexToHsl(branding.primary_color)   || PLATFORM_THEME.primary;
  const secondary = hexToHsl(branding.secondary_color) || PLATFORM_THEME.secondary;
  const background= hexToHsl(branding.background_color)|| PLATFORM_THEME.background;
  const foreground= hexToHsl(branding.text_color)      || PLATFORM_THEME.foreground;

  // Extract the hue from primary so neutrals carry a subtle tint that
  // matches the tenant brand rather than Quadley's navy (hue 207).
  const hue = (primary.match(/^(\d+)/) || ['', '207'])[1];

  return {
    primary,
    primaryForeground:   '0 0% 100%',
    secondary,
    secondaryForeground: '0 0% 100%',
    background,
    foreground,
    muted:               `${hue} 8% 94%`,
    mutedForeground:     `${hue} 6% 48%`,
    accent:              primary,
    accentForeground:    '0 0% 100%',
    ring:                primary,
    border:              `${hue} 8% 88%`,
    input:               `${hue} 8% 88%`,
    avatarBg:            toMutedVariant(secondary) || `${hue} 25% 92%`,
    avatarFg:            primary,
  };
}

export function TenantThemeProvider({ children }) {
  const [searchParams] = useSearchParams();

  const [branding, setBranding]           = useState(null);
  const [tenantCode, setTenantCode]       = useState(null);
  const [tenantName, setTenantName]       = useState(null);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  const fetchAndApplyTheme = useCallback(async (code) => {
    if (!code) {
      applyThemeToDom(PLATFORM_THEME);
      setIsThemeLoaded(true);
      return;
    }

    const staticTheme = getStaticThemeForTenant(code);
    applyThemeToDom(staticTheme);

    try {
      const res = await axios.get(`${API}/branding/public/${code}`);
      const data = res.data;
      const liveBranding = data.branding || {};
      setBranding(liveBranding);
      setTenantName(data.tenant_name || liveBranding.app_name || null);
      applyThemeToDom(brandingToTheme(liveBranding));
    } catch {
      setBranding(null);
    } finally {
      setIsThemeLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Theme source of truth is the URL (?tenant=CODE) or the build-time
    // env var (REACT_APP_TENANT_CODE set for tenant-specific deployments).
    // The logged-in user's tenant_code is intentionally NOT used here so
    // that the platform/dev preview always shows Quadley branding and tenant
    // colours only appear when accessing a dedicated tenant URL/deployment.
    const code =
      searchParams.get('tenant') ||
      process.env.REACT_APP_TENANT_CODE ||
      null;

    setTenantCode(code);
    fetchAndApplyTheme(code);
  }, [searchParams, fetchAndApplyTheme]);

  return (
    <TenantThemeContext.Provider
      value={{ branding, tenantCode, tenantName, isThemeLoaded }}
    >
      {children}
    </TenantThemeContext.Provider>
  );
}
