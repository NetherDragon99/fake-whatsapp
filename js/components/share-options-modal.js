// Component: Responsive Share Options Modal / Sheet
// Features: Media preview card, 9 platforms (WhatsApp, Telegram, X, Facebook, Email, Instagram, TikTok, Snapchat, Messenger),
// Download button, and Copy-to-Clipboard (only displayed when the shared item is an image).
// Instantly closes the dialog on any action to keep the next step directly visible.

import { Toast } from './toast.js';

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let s = bytes;
  while (s >= 1024 && i < units.length - 1) {
    s /= 1024;
    i++;
  }
  return `${s.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function copyBlobToClipboard(blob, fallbackText = '') {
  if (navigator.clipboard && window.ClipboardItem && blob && blob.type.startsWith('image/')) {
    try {
      let pngBlob = blob;
      if (blob.type !== 'image/png') {
        pngBlob = await new Promise((resolve) => {
          const img = new Image();
          const objUrl = URL.createObjectURL(blob);
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(objUrl);
            canvas.toBlob((b) => resolve(b || blob), 'image/png');
          };
          img.onerror = () => {
            URL.revokeObjectURL(objUrl);
            resolve(blob);
          };
          img.src = objUrl;
        });
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      return 'image';
    } catch (err) {
      console.warn('[ShareOptions] Clipboard image write failed, falling back to text:', err);
    }
  }

  if (fallbackText && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(fallbackText);
      return 'text';
    } catch (_) {}
  }
  return false;
}

export class ShareOptionsModal {
  constructor({ msg, blob, onComplete = null } = {}) {
    this.msg = msg || {};
    this.blob = blob || null;
    this.onComplete = onComplete;
    this.overlay = null;
    this.isOpen = false;
    this.thumbUrl = null;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    const existing = document.querySelector('.share-options-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'share-options-overlay';

    const card = document.createElement('div');
    card.className = 'share-options-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', 'Share media options');

    const fileName = this.msg.mediaName || (this.blob ? `shared_media.${(this.blob.type || 'bin').split('/')[1] || 'bin'}` : 'Media');
    const fileSize = this.blob ? formatFileSize(this.blob.size) : '';
    const isImage = (this.blob && this.blob.type.startsWith('image/')) || (this.msg.mediaType === 'image');
    const mediaType = (this.msg.mediaType || (this.blob ? this.blob.type.split('/')[0] : 'file')).toUpperCase();
    const caption = this.msg.text || '';
    const canUseSystemShare = typeof navigator.share === 'function';

    // Create thumbnail preview if image, video, audio or document
    let previewHtml = '';
    if (this.blob && this.blob.type.startsWith('image/')) {
      this.thumbUrl = URL.createObjectURL(this.blob);
      previewHtml = `
        <div class="share-preview-thumb">
          <img src="${this.thumbUrl}" alt="Preview" class="share-preview-img" />
        </div>
      `;
    } else if (this.blob && this.blob.type.startsWith('video/')) {
      previewHtml = `
        <div class="share-preview-thumb share-thumb-video">
          <div class="share-thumb-icon">🎬</div>
        </div>
      `;
    } else if (this.blob && this.blob.type.startsWith('audio/')) {
      previewHtml = `
        <div class="share-preview-thumb share-thumb-audio">
          <div class="share-thumb-icon">🎵</div>
        </div>
      `;
    } else {
      previewHtml = `
        <div class="share-preview-thumb share-thumb-doc">
          <div class="share-thumb-icon">📄</div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="share-options-header">
        <div class="share-options-title-row">
          <h3 class="share-options-title">Share</h3>
          <button type="button" class="share-options-close-btn" id="btn-share-close" aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Media Preview Card -->
      <div class="share-media-card">
        ${previewHtml}
        <div class="share-media-meta">
          <div class="share-media-name" title="${fileName}">${fileName}</div>
          <div class="share-media-sub">
            <span class="share-type-badge">${mediaType}</span>
            ${fileSize ? `<span class="share-size-badge">${fileSize}</span>` : ''}
          </div>
          ${caption ? `<div class="share-caption-preview">${caption}</div>` : ''}
        </div>
      </div>

      <!-- Action Tools: Download (always) & Copy (only if item is an image) -->
      <div class="share-actions-row ${!isImage ? 'single-action' : ''}">
        ${isImage ? `
          <button type="button" class="share-action-pill-btn" id="btn-share-copy">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy</span>
          </button>
        ` : ''}
        <button type="button" class="share-action-pill-btn btn-share-download-pill" id="btn-share-download">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Download</span>
        </button>
      </div>

      <div class="share-platforms-label">Share to platform</div>

      <!-- 9 Clean Social Media Platforms Grid -->
      <div class="share-platforms-grid">
        <!-- 1. WhatsApp -->
        <button type="button" class="share-platform-btn" id="btn-platform-whatsapp" data-platform="whatsapp">
          <div class="share-platform-icon-wrap" style="background:#25D366;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.28c-.24.68-1.38 1.26-1.92 1.32-.49.06-1.12.08-3.63-.95-3.08-1.27-5.07-4.43-5.23-4.63-.15-.2-1.24-1.65-1.24-3.15 0-1.5 1.05-2.24 1.42-2.54.3-.24.66-.3.88-.3.22 0 .44 0 .63.01.21.01.48-.08.75.57.28.68.96 2.34 1.04 2.51.08.17.14.37.02.6-.11.23-.17.37-.34.57-.17.2-.36.45-.51.6-.17.17-.35.36-.15.7.2.34.89 1.47 1.91 2.38 1.31 1.17 2.42 1.53 2.76 1.7.34.17.54.14.74-.08.2-.23.86-1 1.09-1.35.23-.34.46-.28.77-.17.31.11 1.99.94 2.33 1.11.34.17.57.26.65.4.08.14.08.82-.16 1.5z"/>
            </svg>
          </div>
          <span class="share-platform-name">WhatsApp</span>
        </button>

        <!-- 2. Telegram -->
        <button type="button" class="share-platform-btn" id="btn-platform-telegram" data-platform="telegram">
          <div class="share-platform-icon-wrap" style="background:#24A1DE;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
            </svg>
          </div>
          <span class="share-platform-name">Telegram</span>
        </button>

        <!-- 3. X (Twitter) -->
        <button type="button" class="share-platform-btn" id="btn-platform-x" data-platform="x">
          <div class="share-platform-icon-wrap" style="background:#000; border: 1px solid rgba(255,255,255,0.15);">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </div>
          <span class="share-platform-name">X</span>
        </button>

        <!-- 4. Facebook -->
        <button type="button" class="share-platform-btn" id="btn-platform-facebook" data-platform="facebook">
          <div class="share-platform-icon-wrap" style="background:#1877F2;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <span class="share-platform-name">Facebook</span>
        </button>

        <!-- 5. Email -->
        <button type="button" class="share-platform-btn" id="btn-platform-email" data-platform="email">
          <div class="share-platform-icon-wrap" style="background:#EA4335;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
          </div>
          <span class="share-platform-name">Email</span>
        </button>

        <!-- 6. Instagram -->
        <button type="button" class="share-platform-btn" id="btn-platform-instagram" data-platform="instagram">
          <div class="share-platform-icon-wrap" style="background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%);">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </div>
          <span class="share-platform-name">Instagram</span>
        </button>

        <!-- 7. TikTok -->
        <button type="button" class="share-platform-btn" id="btn-platform-tiktok" data-platform="tiktok">
          <div class="share-platform-icon-wrap" style="background: #000; border: 1px solid rgba(255,255,255,0.18);">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.89a8.16 8.16 0 0 0 4.77 1.52V7.96a4.85 4.85 0 0 1-1-.27z"/>
            </svg>
          </div>
          <span class="share-platform-name">TikTok</span>
        </button>

        <!-- 8. Snapchat -->
        <button type="button" class="share-platform-btn" id="btn-platform-snapchat" data-platform="snapchat">
          <div class="share-platform-icon-wrap" style="background: #FFFC00;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#000">
              <path d="M12.03 2.5c-3.1 0-5.18 2.35-5.18 5.48 0 .68.08 1.48.24 2.15-.38.16-1.12.5-1.57.86-.38.3-.47.66-.27 1.05.27.52.92.83 1.74.83.17 0 .34-.01.5-.04-.08.47-.13.98-.13 1.5 0 .37.03.73.08 1.07-.63.22-1.4.58-1.78 1.1-.33.45-.19.98.37 1.33.86.54 2.22.45 3.19.22.86 1.07 1.86 1.45 2.81 1.45.95 0 1.95-.38 2.81-1.45.97.23 2.33.32 3.19-.22.56-.35.7-.88.37-1.33-.38-.52-1.15-.88-1.78-1.1.05-.34.08-.7.08-1.07 0-.52-.05-1.03-.13-1.5.16.03.33.04.5.04.82 0 1.47-.31 1.74-.83.2-.39.11-.75-.27-1.05-.45-.36-1.19-.7-1.57-.86.16-.67.24-1.47.24-2.15 0-3.13-2.08-5.48-5.18-5.48z"/>
            </svg>
          </div>
          <span class="share-platform-name">Snapchat</span>
        </button>

        <!-- 9. Messenger -->
        <button type="button" class="share-platform-btn" id="btn-platform-messenger" data-platform="messenger">
          <div class="share-platform-icon-wrap" style="background: linear-gradient(135deg, #00B2FE 0%, #006AFF 50%, #9026FD 100%);">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff">
              <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.43 3.14 7.15.16.14.26.35.26.56l-.08 1.74c-.03.73.74 1.23 1.39.9l1.94-.98c.17-.09.37-.11.56-.06.88.24 1.82.38 2.79.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.09 13.06l-2.54-2.71-4.96 2.71c-.67.36-1.43-.33-1.09-.98l5.34-7.14c.39-.52 1.19-.52 1.58 0l2.54 2.71 4.96-2.71c.67-.36 1.43.33 1.09.98l-5.34 7.14c-.39.52-1.19.52-1.58 0z"/>
            </svg>
          </div>
          <span class="share-platform-name">Messenger</span>
        </button>

        ${canUseSystemShare ? `
        <!-- 10. More apps (Native System Share - rendered only when supported by the browser) -->
        <button type="button" class="share-platform-btn" id="btn-platform-more" data-platform="more" aria-label="More apps">
          <div class="share-platform-icon-wrap" style="background: linear-gradient(135deg, #8A2BE2 0%, #4A00E0 100%);">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/>
            </svg>
          </div>
          <span class="share-platform-name">More apps</span>
        </button>
        ` : ''}
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Trigger transition
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    if (window.router) {
      window.router.pushOverlay('share-options-modal', () => this.close(false));
    }

    this.bindEvents(card, fileName, caption, isImage);
  }

  bindEvents(card, fileName, caption, isImage) {
    const textToShare = caption ? `${caption}\n(${fileName})` : fileName;

    // Close on backdrop click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Close button
    card.querySelector('#btn-share-close').addEventListener('click', () => this.close());

    // Copy to clipboard (only present if item is an image)
    const copyBtn = card.querySelector('#btn-share-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        this.close();
        const copiedType = await copyBlobToClipboard(this.blob, textToShare);
        if (copiedType === 'image') {
          Toast.show('Image copied to clipboard');
        } else if (copiedType === 'text') {
          Toast.show('Details copied to clipboard');
        } else {
          Toast.show('Copied');
        }
      });
    }

    // Download / Save file (always present)
    card.querySelector('#btn-share-download').addEventListener('click', () => {
      this.close();
      if (this.blob) {
        const url = URL.createObjectURL(this.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Toast.show('Media downloaded');
      } else {
        Toast.show('Media unavailable');
      }
    });

    // 1. WhatsApp
    card.querySelector('#btn-platform-whatsapp').addEventListener('click', () => {
      this.close();
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    // 2. Telegram
    card.querySelector('#btn-platform-telegram').addEventListener('click', () => {
      this.close();
      const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(textToShare)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    // 3. X (Twitter)
    card.querySelector('#btn-platform-x').addEventListener('click', () => {
      this.close();
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(textToShare)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    // 4. Facebook
    card.querySelector('#btn-platform-facebook').addEventListener('click', () => {
      this.close();
      const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(textToShare)}&u=${encodeURIComponent(window.location.href)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    // 5. Email
    card.querySelector('#btn-platform-email').addEventListener('click', () => {
      this.close();
      const subject = `Sharing ${fileName}`;
      const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textToShare)}`;
      window.location.href = url;
    });

    // 6. Instagram
    card.querySelector('#btn-platform-instagram').addEventListener('click', async () => {
      this.close();
      if (textToShare && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(textToShare);
          Toast.show('Details copied — ready to paste into Instagram!');
        } catch (_) {}
      }
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    });

    // 7. TikTok
    card.querySelector('#btn-platform-tiktok').addEventListener('click', async () => {
      this.close();
      if (textToShare && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(textToShare);
          Toast.show('Details copied — ready to paste into TikTok!');
        } catch (_) {}
      }
      window.open('https://www.tiktok.com/', '_blank', 'noopener,noreferrer');
    });

    // 8. Snapchat
    card.querySelector('#btn-platform-snapchat').addEventListener('click', async () => {
      this.close();
      if (textToShare && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(textToShare);
          Toast.show('Details copied — ready to paste into Snapchat!');
        } catch (_) {}
      }
      window.open('https://www.snapchat.com/', '_blank', 'noopener,noreferrer');
    });

    // 9. Messenger
    card.querySelector('#btn-platform-messenger').addEventListener('click', () => {
      this.close();
      const url = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(window.location.href)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(window.location.href)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    // 10. More apps (Native System Share - if supported by browser/device)
    const moreBtn = card.querySelector('#btn-platform-more');
    if (moreBtn && typeof navigator.share === 'function') {
      moreBtn.addEventListener('click', async () => {
        // Immediately close the share dialog so the native share sheet is directly visible
        this.close();

        // 1. Try sharing actual file if blob is available and canShare supports files
        if (this.blob) {
          try {
            const ext = (this.blob.type || 'bin').split('/')[1] || 'bin';
            const file = new File([this.blob], fileName, { type: this.blob.type || 'application/octet-stream' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: fileName,
                text: caption || ''
              });
              return;
            }
          } catch (fileErr) {
            if (fileErr.name === 'AbortError') return; // User dismissed native share sheet
            console.warn('[ShareOptions] File sharing rejected by device, trying text fallback:', fileErr);
          }
        }

        // 2. Fallback: share text/link via native system share
        try {
          await navigator.share({
            title: fileName,
            text: textToShare,
            url: window.location.href
          });
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return; // User cancelled
          console.warn('[ShareOptions] Native share failed:', shareErr);
        }
      });
    }
  }

  close(notifyRouter = true) {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (notifyRouter && window.router) {
      window.router.removeOverlay('share-options-modal');
    }

    if (this.thumbUrl) {
      URL.revokeObjectURL(this.thumbUrl);
      this.thumbUrl = null;
    }

    if (this.overlay) {
      this.overlay.classList.remove('active');
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
      }, 220);
    }

    if (this.onComplete) {
      this.onComplete();
    }
  }
}
