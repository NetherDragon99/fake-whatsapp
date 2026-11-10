// Base path detection and asset URL resolution for GitHub Pages subpath deployment

/**
 * Returns the application root base path with a trailing slash.
 * E.g. '/fake-whatsapp/' on GitHub Pages or '/' when served from root.
 */
export function getBasePath() {
  if (typeof window !== 'undefined' && window.location) {
    const pathname = window.location.pathname;
    // Strip trailing filename if any (like index.html)
    const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    return dir || '/';
  }
  return './';
}

/**
 * Resolves a relative asset path against the application base path.
 * E.g. assetUrl('assets/wallpapers/nature-1.webp') -> '/fake-whatsapp/assets/wallpapers/nature-1.webp'
 * @param {string} relativePath
 * @returns {string}
 */
export function assetUrl(relativePath) {
  if (!relativePath) return '';
  // If already an absolute URL (http:// or https://) or data/blob URI, return as-is
  if (/^(?:[a-z]+:)?\/\//i.test(relativePath) || relativePath.startsWith('data:') || relativePath.startsWith('blob:')) {
    return relativePath;
  }
  // Strip leading './' or '/'
  const cleanPath = relativePath.replace(/^(\.\/|\/)/, '');
  const base = getBasePath();
  return base + cleanPath;
}
