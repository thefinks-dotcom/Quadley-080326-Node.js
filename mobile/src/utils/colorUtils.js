/**
 * Shared color utility for dynamic theming.
 * Generates category accent palettes from a primary brand color.
 */

export const hexToHSL = (hex) => {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

export const hslToHex = (h, s, l) => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

/**
 * Generate category accent colors as gradients of the primary brand color.
 * Each category gets a different lightness/saturation gradient while staying on the same hue.
 */
export const buildCategoryAccents = (primary) => {
  const [h, s] = hexToHSL(primary);
  const sat = Math.min(s, 85);
  const cats = ['Campus Life', 'Community', 'Services', 'Growth & Wellbeing', 'RA Tools'];
  // Varying lightness levels for each category to create gradient effect
  const lightLevels = [30, 38, 34, 42, 28];
  const bgLightLevels = [94, 96, 92, 97, 93];
  const borderLightLevels = [78, 82, 76, 85, 80];
  const accents = {};
  cats.forEach((cat, i) => {
    accents[cat] = {
      icon:   hslToHex(h, sat, lightLevels[i]),
      cardBg: hslToHex(h, Math.max(sat - 15, 20), bgLightLevels[i]),
      border: hslToHex(h, Math.max(sat - 10, 25), borderLightLevels[i]),
    };
  });
  return accents;
};
