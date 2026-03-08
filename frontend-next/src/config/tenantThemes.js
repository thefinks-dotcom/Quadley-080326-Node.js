/**
 * Tenant Theme Configuration
 * ===========================
 * Defines the CSS variable palette for each known tenant, plus the
 * Quadley platform defaults. All color values are in "H S% L%" format
 * so they drop directly into Tailwind's `hsl(var(--token))` pattern.
 *
 * These static entries serve as an instant fallback while the live
 * branding API call is in flight, preventing a visible color flash on
 * page load.
 *
 * To add a new tenant:
 *   1. Add an entry to TENANT_THEMES keyed by the tenant code (uppercase).
 *   2. Set primary/secondary from the college's brand guidelines.
 *   3. Derived tokens (accent, ring, avatarBg) can be left null to
 *      inherit automatically from primary/secondary.
 */

/**
 * Quadley platform-level defaults — navy blue & silver (matched to logo).
 * Logo dominant blue: #1C3A53  hsl(207 49% 22%)
 * Primary uses same hue at 30% lightness for readable UI elements.
 * Applied when no ?tenant= param and no REACT_APP_TENANT_CODE env var.
 */
export const PLATFORM_THEME = {
  name: 'Quadley',
  primary:          '207 55% 30',
  primaryForeground:'0 0% 100',
  secondary:        '210 18% 58',
  secondaryForeground: '0 0% 100',
  background:       '210 20% 97',
  foreground:       '210 30% 10',
  muted:            '210 18% 93',
  mutedForeground:  '210 15% 48',
  accent:           '207 55% 30',
  accentForeground: '0 0% 100',
  ring:             '207 55% 30',
  border:           '210 18% 87',
  input:            '210 18% 87',
  avatarBg:         '207 30% 88',
  avatarFg:         '207 55% 30',
};

/**
 * Per-tenant overrides.
 * Only tokens that differ from the platform defaults need to be set.
 * Missing tokens fall back to PLATFORM_THEME values.
 */
export const TENANT_THEMES = {
  GRAC7421: {
    name: 'Grace College',
    logoPath: '/logos/grace-college.svg',
    primary:          '0 84% 60',
    primaryForeground:'0 0% 100',
    secondary:        '263 70% 50',
    secondaryForeground: '0 0% 100',
    background:       '240 5% 96',
    foreground:       '220 20% 14',
    muted:            '240 5% 94',
    mutedForeground:  '220 10% 50',
    accent:           '0 84% 60',
    accentForeground: '0 0% 100',
    ring:             '0 84% 60',
    border:           '240 5% 89',
    input:            '240 5% 89',
    avatarBg:         '263 40% 92',
    avatarFg:         '0 84% 60',
  },
};

/**
 * Return the static theme for a given tenant code, merged over the
 * platform defaults. Returns PLATFORM_THEME if the code is unknown.
 */
export function getStaticThemeForTenant(tenantCode) {
  if (!tenantCode) return PLATFORM_THEME;
  const overrides = TENANT_THEMES[tenantCode?.toUpperCase()];
  if (!overrides) return PLATFORM_THEME;
  return { ...PLATFORM_THEME, ...overrides };
}
