/**
 * Color Utilities for Tenant Theming
 * ====================================
 * Converts hex colors from the backend branding API into the HSL
 * component string format ("H S% L%") that Tailwind/shadcn CSS
 * variables require — e.g. --primary is used as hsl(var(--primary)).
 */

/**
 * Convert a hex color (#RRGGBB or #RGB) to "H S% L%" string.
 * Returns null for invalid input.
 */
export function hexToHsl(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  if (full.length !== 6) return null;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
    default: h = 0;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Shift the lightness of an HSL string by `delta` percentage points.
 * Positive delta = lighter, negative delta = darker.
 * Input/output format: "H S% L%"
 */
export function shiftLightness(hslStr, delta) {
  if (!hslStr) return hslStr;
  const match = hslStr.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) return hslStr;
  const [, h, s, l] = match;
  const newL = Math.max(0, Math.min(100, parseInt(l) + delta));
  return `${h} ${s}% ${newL}%`;
}

/**
 * Derive a muted/soft variant of a primary HSL color.
 * Reduces saturation and increases lightness significantly.
 */
export function toMutedVariant(hslStr) {
  if (!hslStr) return null;
  const match = hslStr.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) return null;
  const [, h, s] = match;
  const newS = Math.max(10, parseInt(s) - 30);
  return `${h} ${newS}% 88%`;
}
