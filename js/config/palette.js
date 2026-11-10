// Unified Official Color Palette for WhatsApp Android Clone
// Used for chat bubbles, solid wallpapers, and app accents. Strict order preserved.

export const APP_COLOR_PALETTE = [
  // Row 1
  '#25d366', '#2b7a78', '#3a7d54', '#2d6a4f',
  // Row 2
  '#3b6998', '#26616c', '#205068', '#1a365d',
  // Row 3
  '#5b21b6', '#362978', '#4c1d95', '#1e293b',
  // Row 4
  '#7c3aed', '#6b21a8', '#55585f', '#374151',
  // Row 5
  '#c2410c', '#8c3d23', '#4d7c0f', '#365314',
  // Row 6
  '#0d9488', '#115e59', '#be123c', '#881337',
  // Row 7
  '#854d0e', '#573a08', '#78716c', '#44403c',
  // Row 8
  '#0891b2', '#164e63', '#ca8a04', '#713f12',
  // Row 9
  '#65a30d', '#3f6212', '#db2777', '#831843'
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
  document.documentElement.style.setProperty('--wa-bubble-outgoing', hexColor);
  document.documentElement.style.setProperty('--outgoing-bg', hexColor);
  document.documentElement.style.setProperty('--outgoing-inner-card', getDarkerTint(hexColor, 0.25));
  try {
    localStorage.setItem('wa_outgoing_bubble_color', hexColor);
  } catch (e) {
    // ignore
  }
}
