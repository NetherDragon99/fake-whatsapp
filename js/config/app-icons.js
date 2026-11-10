// 15 Custom App Icons extracted from WhatsApp reference
import { assetUrl } from './base-path.js';

export const APP_ICONS = [
  {
    "id": "icon-1",
    "file": "assets/icons/app-icon-1.png",
    "name": "Classic WhatsApp"
  },
  {
    "id": "icon-2",
    "file": "assets/icons/app-icon-2.png",
    "name": "Solid Green"
  },
  {
    "id": "icon-3",
    "file": "assets/icons/app-icon-3.png",
    "name": "Sparkle Teal"
  },
  {
    "id": "icon-4",
    "file": "assets/icons/app-icon-4.png",
    "name": "Origami Emerald"
  },
  {
    "id": "icon-5",
    "file": "assets/icons/app-icon-5.png",
    "name": "Electric Blue"
  },
  {
    "id": "icon-6",
    "file": "assets/icons/app-icon-6.png",
    "name": "Neon Magma"
  },
  {
    "id": "icon-7",
    "file": "assets/icons/app-icon-7.png",
    "name": "Bubblegum Pink"
  },
  {
    "id": "icon-8",
    "file": "assets/icons/app-icon-8.png",
    "name": "Violet Fur"
  },
  {
    "id": "icon-9",
    "file": "assets/icons/app-icon-9.png",
    "name": "Sunset Glow"
  },
  {
    "id": "icon-10",
    "file": "assets/icons/app-icon-10.png",
    "name": "Soft Lilac"
  },
  {
    "id": "icon-11",
    "file": "assets/icons/app-icon-11.png",
    "name": "Sky Pastel"
  },
  {
    "id": "icon-12",
    "file": "assets/icons/app-icon-12.png",
    "name": "Peach Cream"
  },
  {
    "id": "icon-13",
    "file": "assets/icons/app-icon-13.png",
    "name": "Mint Matcha"
  },
  {
    "id": "icon-14",
    "file": "assets/icons/app-icon-14.png",
    "name": "Fresh White"
  },
  {
    "id": "icon-15",
    "file": "assets/icons/app-icon-15.png",
    "name": "Monochrome Dark"
  }
];

export function getAppIcon(id) {
  if (!id) return APP_ICONS[0];
  return APP_ICONS.find(i => i.id === id) || APP_ICONS[0];
}

/**
 * Applies the selected app icon to the document favicon, apple touch icon,
 * and dynamic web manifest for PWA installation.
 */
export async function applyAppIcon(iconId) {
  const icon = getAppIcon(iconId);
  if (!icon) return;

  const iconSrc = assetUrl(icon.file);

  // 1. Update all favicon links
  const favicons = document.querySelectorAll("link[rel*='icon']");
  if (favicons.length > 0) {
    favicons.forEach(fav => {
      fav.href = iconSrc;
    });
  } else {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = iconSrc;
    document.head.appendChild(link);
  }

  // 2. Update Apple Touch Icons
  const appleIcons = document.querySelectorAll("link[rel='apple-touch-icon']");
  if (appleIcons.length > 0) {
    appleIcons.forEach(a => {
      a.href = iconSrc;
    });
  } else {
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = iconSrc;
    document.head.appendChild(link);
  }

  // 3. Update Dynamic Manifest for PWA installs
  try {
    const resp = await fetch(assetUrl('manifest.webmanifest'));
    if (resp.ok) {
      const manifest = await resp.json();
      const base = window.location.href;
      manifest.start_url = new URL(manifest.start_url || './', base).href;
      manifest.scope = new URL(manifest.scope || './', base).href;
      const fullIconSrc = new URL(iconSrc, base).href;
      manifest.icons = [
        { src: fullIconSrc, sizes: '192x192', type: 'image/png' },
        { src: fullIconSrc, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: fullIconSrc, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ];
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
      let linkManifest = document.querySelector("link[rel='manifest']");
      if (linkManifest) {
        linkManifest.href = URL.createObjectURL(blob);
      }
    }
  } catch (e) {
    // silently ignore if manifest cannot be fetched (e.g. offline)
  }

  try {
    localStorage.setItem('wa_app_icon_id', icon.id);
  } catch (e) {}
}
