// Unified Official Color Palette for WhatsApp Android Clone
// Used for chat bubbles, solid wallpapers, and app accents. Strict order preserved.

export const APP_COLOR_PALETTE = [
  '#2b7a78', '#3a7d54', '#2d6a4f',
  '#3b6998', '#26616c', '#205068',
  '#362978', '#55585f', '#606c38',
  '#858731', '#7a721a', '#a66811',
  '#5c060a', '#660c14', '#590d18',
  '#4a1525', '#8c3d23', '#33292e',
  '#263335', '#1e485e', '#112233',
  '#393e46', '#121212', '#221122',
  '#52687a', '#7a8511', '#859846'
];

/**
 * Returns a lighter/darker tint of a hex color for inner cards
 */
export function getLighterTint(hex, factor = 0.15) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  const nr = Math.min(255, Math.floor(r + (255 - r) * factor));
  const ng = Math.min(255, Math.floor(g + (255 - g) * factor));
  const nb = Math.min(255, Math.floor(b + (255 - b) * factor));

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export function getDarkerTint(hex, factor = 0.2) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  const nr = Math.max(0, Math.floor(r * (1 - factor)));
  const ng = Math.max(0, Math.floor(g * (1 - factor)));
  const nb = Math.max(0, Math.floor(b * (1 - factor)));

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/**
 * Applies an accent color to the document root CSS variables
 */
export function applyAppAccent(hexColor) {
  if (!hexColor) return;
  document.documentElement.style.setProperty('--app-accent', hexColor);
  document.documentElement.style.setProperty('--accent-color', hexColor);
  try {
    localStorage.setItem('wa_app_accent', hexColor);
  } catch (e) {
    // ignore
  }
}

/**
 * Applies an outgoing bubble color to CSS variables
 */
export function applyOutgoingBubbleColor(hexColor) {
  if (!hexColor) return;
  document.documentElement.style.setProperty('--outgoing-bg', hexColor);
  document.documentElement.style.setProperty('--outgoing-inner-card', getDarkerTint(hexColor, 0.25));
  try {
    localStorage.setItem('wa_outgoing_bubble_color', hexColor);
  } catch (e) {
    // ignore
  }
}
