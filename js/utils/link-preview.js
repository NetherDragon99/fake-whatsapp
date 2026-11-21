/**
 * Hybrid Link Embedded Preview Engine:
 * - Instant offline/local metadata & thumbnail parsing (YouTube, GitHub, generic domains)
 * - Optional CORS-safe online enrichment (noembed -> microlink) cached in localStorage
 * - Supports quick manual title/description customization & dismiss controls in composer
 */
import { Icons } from '../icons.js';
import { escapeHtml, sanitizeUrl } from './rich-text.js';

const CACHE_KEY = 'wa_link_preview_cache_v1';
const CACHE_MAX = 60;
const memoryCache = new Map();

function loadStorageCache() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveStorageCache(mapObj) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(mapObj));
  } catch (_) {}
}

function getCachedPreview(url) {
  if (memoryCache.has(url)) return memoryCache.get(url);
  const stored = loadStorageCache();
  if (stored && stored[url]) {
    memoryCache.set(url, stored[url]);
    return stored[url];
  }
  return null;
}

function setCachedPreview(url, preview) {
  if (!url || !preview) return;
  memoryCache.set(url, preview);
  const stored = loadStorageCache();
  stored[url] = { ...preview, cachedAt: Date.now() };
  const keys = Object.keys(stored);
  if (keys.length > CACHE_MAX) {
    keys.sort((a, b) => (stored[a]?.cachedAt || 0) - (stored[b]?.cachedAt || 0));
    for (let i = 0; i < keys.length - CACHE_MAX; i++) {
      delete stored[keys[i]];
    }
  }
  saveStorageCache(stored);
}

/**
 * Extract the first valid http/https URL from raw or canonical-markup message text.
 */
export function extractFirstUrl(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Word link [label](https://...)
  const mdMatch = text.match(/\[[^\]\n]+?\]\((https?:\/\/[^\s)\n]+)\)/i);
  if (mdMatch) {
    const valid = sanitizeUrl(mdMatch[1]);
    if (valid) return valid;
  }

  // 2. Bare URL
  const bareMatch = text.match(/(https?:\/\/[^\s<)\]]+)/i);
  if (bareMatch) {
    const cleaned = bareMatch[1].replace(/[.,!?;:]+$/, '');
    const valid = sanitizeUrl(cleaned);
    if (valid) return valid;
  }

  return null;
}

function extractYouTubeId(parsedUrl) {
  const host = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase();
  if (host === 'youtu.be') {
    const seg = parsedUrl.pathname.split('/').filter(Boolean)[0];
    return seg && /^[a-zA-Z0-9_-]{6,20}$/.test(seg) ? seg : null;
  }
  if (host.endsWith('youtube.com')) {
    const v = parsedUrl.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{6,20}$/.test(v)) return v;
    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    if ((parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') && parts[1]) {
      return parts[1];
    }
  }
  return null;
}

/**
 * Build an instant offline-capable preview card directly from URL structure.
 */
export function buildLocalLinkPreview(rawUrl) {
  const safeUrl = sanitizeUrl(rawUrl);
  if (!safeUrl) return null;

  const parsed = new URL(safeUrl);
  const domain = parsed.hostname.replace(/^www\./i, '');
  const cleanPath = (parsed.pathname && parsed.pathname !== '/') ? parsed.pathname : '';
  const search = parsed.search || '';

  // YouTube zero-latency card + thumbnail
  const ytId = extractYouTubeId(parsed);
  if (ytId) {
    return {
      url: safeUrl,
      domain: 'youtube.com',
      siteName: 'YouTube',
      title: `YouTube Video (${ytId})`,
      description: `https://youtu.be/${ytId}`,
      imageUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      isManual: false,
      fetchedOnline: false
    };
  }

  // GitHub repo heuristic
  if (domain.toLowerCase() === 'github.com') {
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return {
        url: safeUrl,
        domain: 'github.com',
        siteName: 'GitHub',
        title: `${parts[0]}/${parts[1]}`,
        description: parts.length > 2 ? `GitHub · ${parts.slice(2).join('/')}` : 'GitHub Repository',
        imageUrl: null,
        isManual: false,
        fetchedOnline: false
      };
    }
  }

  const lastSegment = cleanPath.split('/').filter(Boolean).pop();
  let readableTitle = domain;
  if (lastSegment) {
    try {
      readableTitle = decodeURIComponent(lastSegment).replace(/[-_]+/g, ' ').trim() || domain;
    } catch (_) {
      readableTitle = lastSegment;
    }
  }

  const descPath = `${domain}${cleanPath}${search}`.slice(0, 140);
  return {
    url: safeUrl,
    domain,
    siteName: domain,
    title: readableTitle,
    description: descPath,
    imageUrl: null,
    isManual: false,
    fetchedOnline: false
  };
}

function isOEmbedCandidate(domain) {
  const d = (domain || '').toLowerCase();
  return [
    'youtube.com', 'youtu.be', 'vimeo.com', 'reddit.com',
    'soundcloud.com', 'tiktok.com', 'twitter.com', 'x.com', 'open.spotify.com'
  ].some((host) => d === host || d.endsWith('.' + host));
}

/**
 * Enrich link preview online via CORS-friendly oEmbed/Microlink endpoints with safe timeout & offline fallback.
 */
export async function fetchEnhancedLinkPreview(rawUrl, { signal = null, fetchImpl = globalThis.fetch } = {}) {
  const local = buildLocalLinkPreview(rawUrl);
  if (!local) return null;

  const cached = getCachedPreview(local.url);
  if (cached) return { ...cached };

  if ((typeof navigator !== 'undefined' && navigator.onLine === false) || typeof fetchImpl !== 'function') {
    return local;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  const onParentAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      return local;
    }
    signal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    let enriched = null;

    if (isOEmbedCandidate(local.domain)) {
      try {
        const res = await fetchImpl(`https://noembed.com/embed?url=${encodeURIComponent(local.url)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.title && !data.error) {
            enriched = {
              ...local,
              siteName: data.provider_name || local.siteName,
              title: String(data.title).trim().slice(0, 140),
              description: (data.author_name ? `By ${data.author_name}` : local.description).slice(0, 200),
              imageUrl: sanitizeUrl(data.thumbnail_url) || local.imageUrl,
              fetchedOnline: true
            };
          }
        }
      } catch (_) {}
    }

    if (!enriched && !controller.signal.aborted) {
      try {
        const res = await fetchImpl(`https://api.microlink.io/?url=${encodeURIComponent(local.url)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const payload = await res.json();
          const d = payload && payload.status === 'success' ? payload.data : null;
          if (d && (d.title || d.description || d.image?.url)) {
            enriched = {
              ...local,
              siteName: d.publisher || local.siteName,
              title: d.title ? String(d.title).trim().slice(0, 140) : local.title,
              description: d.description ? String(d.description).trim().slice(0, 220) : local.description,
              imageUrl: sanitizeUrl(d.image?.url) || sanitizeUrl(d.logo?.url) || local.imageUrl,
              fetchedOnline: true
            };
          }
        }
      } catch (_) {}
    }

    if (enriched) {
      setCachedPreview(local.url, enriched);
      return enriched;
    }
    return local;
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onParentAbort);
  }
}

/**
 * Create a styled WhatsApp-like embedded link preview card element.
 */
export function renderLinkPreviewCard(preview, { mode = 'bubble', onEdit = null, onDismiss = null, canNavigate = null } = {}) {
  if (!preview || !preview.url) return null;
  const safeUrl = sanitizeUrl(preview.url);
  if (!safeUrl) return null;

  const card = document.createElement('div');
  card.className = `wa-link-preview-card mode-${mode}`;
  card.dataset.url = safeUrl;

  const safeImg = preview.imageUrl ? sanitizeUrl(preview.imageUrl) : null;
  const siteLabel = preview.siteName || preview.domain || 'Link';

  card.innerHTML = `
    <div class="wa-lp-inner">
      ${safeImg ? `<div class="wa-lp-thumb"><img src="${escapeHtml(safeImg)}" alt="" loading="lazy" /></div>` : ''}
      <div class="wa-lp-body">
        <div class="wa-lp-site">${escapeHtml(siteLabel)}</div>
        <div class="wa-lp-title" dir="auto">${escapeHtml(preview.title || siteLabel)}</div>
        ${preview.description ? `<div class="wa-lp-desc" dir="auto">${escapeHtml(preview.description)}</div>` : ''}
        <div class="wa-lp-url">
          <span class="wa-lp-url-icon">${Icons.externalLink('', 12)}</span>
          <span class="wa-lp-url-text">${escapeHtml(preview.domain || safeUrl)}</span>
        </div>
      </div>
      ${mode === 'composer' ? `
        <div class="wa-lp-actions">
          <button type="button" class="wa-lp-action-btn wa-lp-edit-btn" title="Edit link preview" aria-label="Edit link preview">${Icons.edit('', 15)}</button>
          <button type="button" class="wa-lp-action-btn wa-lp-dismiss-btn" title="Remove preview" aria-label="Remove preview">${Icons.close('', 15)}</button>
        </div>
      ` : ''}
    </div>
  `;

  const img = card.querySelector('.wa-lp-thumb img');
  if (img) {
    img.addEventListener('error', () => {
      const thumbWrap = img.closest('.wa-lp-thumb');
      if (thumbWrap) thumbWrap.remove();
    });
  }

  if (mode === 'composer') {
    card.querySelector('.wa-lp-edit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (typeof onEdit === 'function') onEdit(preview);
    });
    card.querySelector('.wa-lp-dismiss-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (typeof onDismiss === 'function') onDismiss(preview);
    });
  } else {
    card.addEventListener('click', (e) => {
      if (typeof canNavigate === 'function' && !canNavigate()) return;
      e.stopPropagation();
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    });
  }

  return card;
}
