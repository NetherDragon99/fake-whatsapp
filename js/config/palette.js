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

// Authentic WhatsApp Light Mode pastel bubble equivalents (1:1 index mapped to APP_COLOR_PALETTE)
export const LIGHT_BUBBLE_PALETTE = [
  // Row 1 (WhatsApp Light Greens & Teals)
  '#d9fdd3', '#d0f0ec', '#d7f3e3', '#d2ece0',
  // Row 2 (Blues)
  '#d6e6f7', '#d4ebef', '#d2e4f0', '#dce3f5',
  // Row 3 (Indigos & Purples)
  '#e7defa', '#e2dff7', '#eadcfb', '#e3e6ea',
  // Row 4 (Violets & Greys)
  '#ede2fb', '#f2def7', '#e6e7ea', '#e2e5ea',
  // Row 5 (Terracottas & Olives)
  '#fbe2d4', '#f5dfd7', '#e8f3d2', '#e2edd1',
  // Row 6 (Teals & Roses)
  '#d2f3ee', '#d7ece9', '#fbdbe3', '#f3dbe2',
  // Row 7 (Warm Earth & Stone)
  '#f5ecd1', '#ede3d0', '#ebe8e4', '#e5e2de',
  // Row 8 (Cyans & Golds)
  '#d2f1f7', '#d7ebf0', '#faf1ce', '#f2e8cf',
  // Row 9 (Limes & Pinks)
  '#eaf5d1', '#e4edd3', '#fce0ee', '#f4dce8'
];

export function isLightThemeActive() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

export function getBubblePaletteForCurrentTheme(isLight = isLightThemeActive()) {
  return isLight ? LIGHT_BUBBLE_PALETTE : APP_COLOR_PALETTE;
}

export function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let c = hex.trim();
  if (!c.startsWith('#')) return null;
  if (c.length === 4) {
    c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
  }
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null;
}

export function hexToRgb(hex) {
  const norm = normalizeHex(hex);
  if (!norm) return { r: 0, g: 92, b: 75 };
  const clean = norm.slice(1);
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16)
  };
}

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

export function hslToHex(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function isColorDark(hex) {
  return getRelativeLuminance(hex) < 0.36;
}

/**
 * Resolves a saved bubble color for the active light/dark theme.
 * Maps dark-palette colors to light pastel equivalents in Light Mode (and vice versa).
 */
export function resolveBubbleColorForTheme(hexColor, isLight = isLightThemeActive()) {
  const norm = normalizeHex(hexColor);
  if (!norm) {
    return isLight ? '#d9fdd3' : '#005c4b';
  }
  if (isLight) {
    const darkIdx = APP_COLOR_PALETTE.findIndex((c) => c.toLowerCase() === norm);
    if (darkIdx !== -1 && LIGHT_BUBBLE_PALETTE[darkIdx]) {
      return LIGHT_BUBBLE_PALETTE[darkIdx];
    }
    return norm;
  } else {
    const lightIdx = LIGHT_BUBBLE_PALETTE.findIndex((c) => c.toLowerCase() === norm);
    if (lightIdx !== -1 && APP_COLOR_PALETTE[lightIdx]) {
      return APP_COLOR_PALETTE[lightIdx];
    }
    return norm;
  }
}

/**
 * Derives a vibrant, clearly visible Mic/Send FAB color from the chat's bubble color.
 * Keeps the same hue while clamping lightness/saturation to WhatsApp visibility range.
 */
export function deriveChatActionColor(bubbleColor, isLight = isLightThemeActive()) {
  const norm = normalizeHex(bubbleColor);
  if (!norm) {
    return isLight
      ? { bg: '#1dab61', fg: '#ffffff' }
      : { bg: '#25d366', fg: '#0b141a' };
  }

  const { r, g, b } = hexToRgb(norm);
  const { h, s, l } = rgbToHsl(r, g, b);

  let targetL;
  let targetS = s;

  if (s < 0.08) {
    // Neutral / greyscale bubble theme
    targetS = s;
    targetL = isLight ? 0.38 : 0.68;
  } else if (isLight) {
    // Rich visible shade on light chat canvas
    targetS = Math.min(0.88, Math.max(0.55, s));
    targetL = Math.min(0.45, Math.max(0.32, l > 0.6 ? 0.39 : l));
  } else {
    // Vibrant visible shade on dark chat canvas
    targetS = Math.min(0.92, Math.max(0.52, s));
    targetL = Math.min(0.62, Math.max(0.48, l < 0.45 ? 0.55 : l));
  }

  const bg = hslToHex(h, targetS, targetL);
  const fg = isColorDark(bg) ? '#ffffff' : '#0b141a';
  return { bg, fg };
}

/**
 * Computes full contrast-safe styling tokens for a given bubble color.
 */
export function getBubbleThemeTokens(hexColor, isLight = isLightThemeActive()) {
  const bubbleBg = resolveBubbleColorForTheme(hexColor, isLight);
  const darkBubble = isColorDark(bubbleBg);
  const fab = deriveChatActionColor(bubbleBg, isLight);

  return {
    bubbleBg,
    bubbleText: darkBubble ? '#e9edef' : '#111b21',
    bubbleMeta: darkBubble ? 'rgba(233, 237, 239, 0.74)' : '#667781',
    bubbleInnerCard: darkBubble ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.06)',
    bubbleReceiptRead: darkBubble ? '#53bdeb' : '#007bfc',
    fabBg: fab.bg,
    fabFg: fab.fg
  };
}

/**
 * Returns a lighter/darker tint of a hex color for inner cards
 */
export function getLighterTint(hex, factor = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  const nr = Math.min(255, Math.floor(r + (255 - r) * factor));
  const ng = Math.min(255, Math.floor(g + (255 - g) * factor));
  const nb = Math.min(255, Math.floor(b + (255 - b) * factor));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export function getDarkerTint(hex, factor = 0.2) {
  const { r, g, b } = hexToRgb(hex);
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
 * Applies an outgoing bubble color + contrast-safe tokens + derived FAB theme to an element (defaults to root)
 */
export function applyOutgoingBubbleColor(hexColor, targetEl = document.documentElement, persistGlobal = (targetEl === document.documentElement)) {
  if (!hexColor || !targetEl) return;
  const tokens = getBubbleThemeTokens(hexColor, isLightThemeActive());
  targetEl.style.setProperty('--wa-bubble-outgoing', tokens.bubbleBg);
  targetEl.style.setProperty('--wa-bubble-outgoing-green', tokens.bubbleBg);
  targetEl.style.setProperty('--outgoing-bg', tokens.bubbleBg);
  targetEl.style.setProperty('--wa-bubble-outgoing-text', tokens.bubbleText);
  targetEl.style.setProperty('--wa-bubble-outgoing-meta', tokens.bubbleMeta);
  targetEl.style.setProperty('--wa-bubble-inner-card', tokens.bubbleInnerCard);
  targetEl.style.setProperty('--outgoing-inner-card', tokens.bubbleInnerCard);
  targetEl.style.setProperty('--wa-chat-fab-bg', tokens.fabBg);
  targetEl.style.setProperty('--wa-chat-fab-fg', tokens.fabFg);
  targetEl.style.setProperty('--wa-chat-theme-accent', tokens.fabBg);

  if (persistGlobal) {
    try {
      localStorage.setItem('wa_outgoing_bubble_color', hexColor);
    } catch (e) {
      // ignore
    }
  }
}

export function clearOutgoingBubbleColor(targetEl) {
  if (!targetEl) return;
  const props = [
    '--wa-bubble-outgoing',
    '--wa-bubble-outgoing-green',
    '--outgoing-bg',
    '--wa-bubble-outgoing-text',
    '--wa-bubble-outgoing-meta',
    '--wa-bubble-inner-card',
    '--outgoing-inner-card',
    '--wa-chat-fab-bg',
    '--wa-chat-fab-fg',
    '--wa-chat-theme-accent'
  ];
  props.forEach((p) => targetEl.style.removeProperty(p));
}
