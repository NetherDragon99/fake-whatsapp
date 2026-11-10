// When new files are added to assets/wallpapers/, add them to this list and they are pre-cached automatically.

export const WALLPAPER_PRESETS = [
  // Default Wallpaper
  { id: 'default', category: 'default', file: '', label: 'Default' },

  // Nature Wallpapers (sorted numerically 1 to 12)
  { id: 'nature-1', category: 'nature', file: 'assets/wallpapers/nature-1.webp', label: 'Nature 1' },
  { id: 'nature-2', category: 'nature', file: 'assets/wallpapers/nature-2.webp', label: 'Nature 2' },
  { id: 'nature-3', category: 'nature', file: 'assets/wallpapers/nature-3.webp', label: 'Nature 3' },
  { id: 'nature-4', category: 'nature', file: 'assets/wallpapers/nature-4.webp', label: 'Nature 4' },
  { id: 'nature-5', category: 'nature', file: 'assets/wallpapers/nature-5.webp', label: 'Nature 5' },
  { id: 'nature-6', category: 'nature', file: 'assets/wallpapers/nature-6.webp', label: 'Nature 6' },
  { id: 'nature-7', category: 'nature', file: 'assets/wallpapers/nature-7.webp', label: 'Nature 7' },
  { id: 'nature-8', category: 'nature', file: 'assets/wallpapers/nature-8.webp', label: 'Nature 8' },
  { id: 'nature-9', category: 'nature', file: 'assets/wallpapers/nature-9.webp', label: 'Nature 9' },
  { id: 'nature-10', category: 'nature', file: 'assets/wallpapers/nature-10.webp', label: 'Nature 10' },
  { id: 'nature-11', category: 'nature', file: 'assets/wallpapers/nature-11.webp', label: 'Nature 11' },
  { id: 'nature-12', category: 'nature', file: 'assets/wallpapers/nature-12.webp', label: 'Nature 12' },

  // Vibrant Wallpapers (sorted numerically 1 to 14)
  { id: 'vibrant-1', category: 'vibrant', file: 'assets/wallpapers/vibrant-1.webp', label: 'Vibrant 1' },
  { id: 'vibrant-2', category: 'vibrant', file: 'assets/wallpapers/vibrant-2.webp', label: 'Vibrant 2' },
  { id: 'vibrant-3', category: 'vibrant', file: 'assets/wallpapers/vibrant-3.webp', label: 'Vibrant 3' },
  { id: 'vibrant-4', category: 'vibrant', file: 'assets/wallpapers/vibrant-4.webp', label: 'Vibrant 4' },
  { id: 'vibrant-5', category: 'vibrant', file: 'assets/wallpapers/vibrant-5.webp', label: 'Vibrant 5' },
  { id: 'vibrant-6', category: 'vibrant', file: 'assets/wallpapers/vibrant-6.webp', label: 'Vibrant 6' },
  { id: 'vibrant-7', category: 'vibrant', file: 'assets/wallpapers/vibrant-7.webp', label: 'Vibrant 7' },
  { id: 'vibrant-8', category: 'vibrant', file: 'assets/wallpapers/vibrant-8.webp', label: 'Vibrant 8' },
  { id: 'vibrant-9', category: 'vibrant', file: 'assets/wallpapers/vibrant-9.webp', label: 'Vibrant 9' },
  { id: 'vibrant-10', category: 'vibrant', file: 'assets/wallpapers/vibrant-10.webp', label: 'Vibrant 10' },
  { id: 'vibrant-11', category: 'vibrant', file: 'assets/wallpapers/vibrant-11.webp', label: 'Vibrant 11' },
  { id: 'vibrant-12', category: 'vibrant', file: 'assets/wallpapers/vibrant-12.webp', label: 'Vibrant 12' },
  { id: 'vibrant-13', category: 'vibrant', file: 'assets/wallpapers/vibrant-13.webp', label: 'Vibrant 13' },
  { id: 'vibrant-14', category: 'vibrant', file: 'assets/wallpapers/vibrant-14.webp', label: 'Vibrant 14' }
];

/**
 * Helper to get a preset by ID
 */
export function getWallpaperPreset(id) {
  if (!id) return WALLPAPER_PRESETS[0];
  return WALLPAPER_PRESETS.find(p => p.id === id || p.file === id) || null;
}
