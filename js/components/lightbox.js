// Full-screen Media Lightbox with "Show in Chat" & Multi-Image Album Viewer
import { Icons } from '../icons.js';
import { db } from '../db.js';

class Lightbox {
  constructor() {
    this.overlay = null;         // top-most visible overlay
    this.stackedOverlay = null;  // kept alive under fullscreen album view
    this.currentUrl = null;
    this.albumUrls = [];
    this.onShowInChat = null;
    this._albumKeyDownHandler = null;
  }

  show(mediaItem, msg, onShowInChat) {
    this.onShowInChat = onShowInChat;
    this.close(); // Close any existing

    this.overlay = document.createElement('div');
    this.overlay.className = 'wa-lightbox-overlay';

    let mediaContent = '';
    const isVideo = msg.mediaType === 'video';

    if (mediaItem && mediaItem.blob) {
      this.currentUrl = URL.createObjectURL(mediaItem.blob);
      if (isVideo) {
        mediaContent = `<video src="${this.currentUrl}" controls autoplay playsinline class="lightbox-media"></video>`;
      } else {
        mediaContent = `<img src="${this.currentUrl}" alt="${msg.mediaName || 'Photo'}" class="lightbox-media" />`;
      }
    } else {
      mediaContent = `<div class="lightbox-error">Media content unavailable</div>`;
    }

    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

    this.overlay.innerHTML = `
      <div class="lightbox-header">
        <button class="lightbox-back-btn" aria-label="Close">${Icons.arrowBack('', 24)}</button>
        <div class="lightbox-title-box">
          <div class="lightbox-sender">${msg.sender || 'Media'}</div>
          <div class="lightbox-time">${timeStr}</div>
        </div>
        <div class="lightbox-actions">
          <button class="lightbox-show-in-chat" title="Show in Chat">
            ${Icons.chatPlus('', 20)}
            <span>Show in Chat</span>
          </button>
          <button class="lightbox-download-btn" title="Download">${Icons.download('', 22)}</button>
        </div>
      </div>
      <div class="lightbox-body">
        ${mediaContent}
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.overlay.querySelector('.lightbox-back-btn').addEventListener('click', () => this.close());
    
    this.overlay.querySelector('.lightbox-download-btn').addEventListener('click', () => {
      if (this.currentUrl) {
        const a = document.createElement('a');
        a.href = this.currentUrl;
        a.download = msg.mediaName || (isVideo ? 'video.mp4' : 'photo.jpg');
        a.click();
      }
    });

    this.overlay.querySelector('.lightbox-show-in-chat').addEventListener('click', () => {
      const targetChatId = msg.chatId;
      const targetMsgId = msg.id;
      this.close();
      if (this.onShowInChat) {
        this.onShowInChat(targetChatId, targetMsgId);
      }
    });

    window.history.pushState({ modal: 'lightbox' }, '');
    window.addEventListener('popstate', this.handlePopState);
  }

  // --- Fullscreen Multi-Image Album Lightbox ---
  // When called from within a stacked view (stackedOverlay is live), closing this
  // goes BACK to the stacked view instead of fully closing.
  async showAlbum(albumMsgs, startIndex = 0, onShowInChat) {
    this.onShowInChat = onShowInChat;

    // If a fullscreen album overlay is already open (not stacked), close it first
    if (this.overlay && !this.overlay.classList.contains('stacked-album-overlay')) {
      const old = this.overlay;
      old.classList.add('overlay-closing');
      setTimeout(() => old.remove(), 210);
      this.overlay = null;
      if (this._albumKeyDownHandler) {
        document.removeEventListener('keydown', this._albumKeyDownHandler);
        this._albumKeyDownHandler = null;
      }
    }

    this.overlay = document.createElement('div');
    this.overlay.className = 'wa-lightbox-overlay album-lightbox-overlay';

    const totalCount = albumMsgs.length;
    let currentIndex = Math.max(0, Math.min(totalCount - 1, startIndex));

    const firstMsg = albumMsgs[0];
    const dateFormatted = firstMsg && firstMsg.timestamp
      ? new Date(firstMsg.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const countLabel = `${totalCount} ${totalCount === 1 ? 'photo' : 'photos'}`;
    const headerTitle = dateFormatted ? `${countLabel} • ${dateFormatted}` : countLabel;

    this.overlay.innerHTML = `
      <div class="lightbox-header">
        <button type="button" class="lightbox-back-btn" aria-label="Close">${Icons.arrowBack('', 24)}</button>
        <div class="lightbox-title-box">
          <div class="lightbox-sender">${headerTitle}</div>
          <div class="lightbox-time" id="album-counter-subtitle">${currentIndex + 1} of ${totalCount}</div>
        </div>
        <div class="lightbox-actions">
          <button type="button" class="lightbox-show-in-chat" id="album-btn-show-in-chat" title="Show in Chat">
            ${Icons.chatPlus('', 20)}
            <span>Show in Chat</span>
          </button>
          <button type="button" class="lightbox-download-btn" id="album-btn-download" title="Download">${Icons.download('', 22)}</button>
        </div>
      </div>
      <div class="lightbox-body album-lightbox-body">
        <div class="album-slider-scroller" id="album-slider-track">
          <!-- Populated dynamically -->
        </div>
        ${totalCount > 1 ? `
          <button type="button" class="album-nav-arrow prev-arrow" id="btn-album-prev" aria-label="Previous">${Icons.chevronDown('rotate-90', 24)}</button>
          <button type="button" class="album-nav-arrow next-arrow" id="btn-album-next" aria-label="Next">${Icons.chevronDown('rotate-270', 24)}</button>
        ` : ''}
      </div>
    `;

    document.body.appendChild(this.overlay);

    const track = this.overlay.querySelector('#album-slider-track');
    const counterSub = this.overlay.querySelector('#album-counter-subtitle');

    // Create slides for all album photos
    this.albumUrls = [];
    for (let idx = 0; idx < totalCount; idx++) {
      const msg = albumMsgs[idx];
      let url = null;
      if (msg.mediaId) {
        const med = await db.getMedia(msg.mediaId);
        if (med && med.blob) {
          url = URL.createObjectURL(med.blob);
          this.albumUrls.push(url);
        }
      }

      const slide = document.createElement('div');
      slide.className = 'album-slide-page';
      slide.dataset.index = idx;

      if (url) {
        slide.innerHTML = `<img src="${url}" alt="${msg.mediaName || 'Photo'}" class="lightbox-media" />`;
      } else {
        slide.innerHTML = `<div class="lightbox-error">Media content unavailable</div>`;
      }
      track.appendChild(slide);
    }

    const updateCurrentIndex = (newIdx) => {
      currentIndex = Math.max(0, Math.min(totalCount - 1, newIdx));
      if (counterSub) {
        counterSub.textContent = `${currentIndex + 1} of ${totalCount}`;
      }
    };

    // Scroll to initial selected index
    requestAnimationFrame(() => {
      const targetSlide = track.children[currentIndex];
      if (targetSlide) {
        track.scrollLeft = targetSlide.offsetLeft;
      }
      setTimeout(() => {
        const ts = track.children[currentIndex];
        if (ts && Math.abs(track.scrollLeft - ts.offsetLeft) > 5) {
          track.scrollLeft = ts.offsetLeft;
        }
      }, 50);
    });

    // Track scroll events to update counter
    track.addEventListener('scroll', () => {
      const slideWidth = track.clientWidth || 1;
      const calcIdx = Math.round(track.scrollLeft / slideWidth);
      if (calcIdx !== currentIndex) {
        updateCurrentIndex(calcIdx);
      }
    }, { passive: true });

    // Arrow buttons
    const prevBtn = this.overlay.querySelector('#btn-album-prev');
    const nextBtn = this.overlay.querySelector('#btn-album-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
          const prevSlide = track.children[currentIndex - 1];
          if (prevSlide) prevSlide.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentIndex < totalCount - 1) {
          const nextSlide = track.children[currentIndex + 1];
          if (nextSlide) nextSlide.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
      });
    }

    // Back button — if stacked view is underneath, return to it; otherwise fully close
    this.overlay.querySelector('.lightbox-back-btn').addEventListener('click', () => {
      this._closeAlbumOverlay();
    });

    // Download current photo
    this.overlay.querySelector('#album-btn-download').addEventListener('click', () => {
      const currentMsg = albumMsgs[currentIndex];
      const curSlideImg = track.children[currentIndex]?.querySelector('img');
      if (curSlideImg && curSlideImg.src) {
        const a = document.createElement('a');
        a.href = curSlideImg.src;
        a.download = (currentMsg && currentMsg.mediaName) || 'photo.jpg';
        a.click();
      }
    });

    // Show in chat
    this.overlay.querySelector('#album-btn-show-in-chat').addEventListener('click', () => {
      const currentMsg = albumMsgs[currentIndex];
      const targetChatId = currentMsg.chatId;
      const targetMsgId = currentMsg.id;
      this.close();
      if (this.onShowInChat) {
        this.onShowInChat(targetChatId, targetMsgId);
      }
    });

    // Keyboard navigation
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        this._closeAlbumOverlay();
      } else if (e.key === 'ArrowLeft' && prevBtn) {
        prevBtn.click();
      } else if (e.key === 'ArrowRight' && nextBtn) {
        nextBtn.click();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    this._albumKeyDownHandler = onKeyDown;

    // History state push for Android hardware back button
    window.history.pushState({ modal: 'lightbox' }, '');
    window.addEventListener('popstate', this.handlePopState);
  }

  // Close only the top-level album overlay; if stacked view is underneath, re-show it
  _closeAlbumOverlay(triggerBack = true) {
    if (this.overlay && this.overlay !== this.stackedOverlay) {
      const closingEl = this.overlay;
      closingEl.classList.add('overlay-closing');
      setTimeout(() => closingEl.remove(), 210);
      this.overlay = null;
    }
    if (this._albumKeyDownHandler) {
      document.removeEventListener('keydown', this._albumKeyDownHandler);
      this._albumKeyDownHandler = null;
    }

    if (this.stackedOverlay && this.stackedOverlay.isConnected) {
      this.overlay = this.stackedOverlay;
    }

    if (triggerBack && history.state && history.state.modal === 'lightbox') {
      this._suppressNextPopState = true;
      history.back();
    }
  }

  // --- Fullscreen Vertically Stacked Album View ---
  // Navigation: grid → stacked view → (tap image) → fullscreen album → back → stacked → back → chat
  async showStackedAlbum(albumMsgs, chatName = '', onShowInChat) {
    this.onShowInChat = onShowInChat;
    this.close(); // close any old overlays

    const stackedEl = document.createElement('div');
    stackedEl.className = 'wa-lightbox-overlay stacked-album-overlay';
    this.stackedOverlay = stackedEl;
    this.overlay = stackedEl;

    const totalCount = albumMsgs.length;
    const firstMsg = albumMsgs[0];
    const dateFormatted = firstMsg && firstMsg.timestamp
      ? new Date(firstMsg.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const title = chatName || (firstMsg && firstMsg.sender) || 'Media';
    const subtitle = `${totalCount} ${totalCount === 1 ? 'photo' : 'photos'}${dateFormatted ? ' • ' + dateFormatted : ''}`;

    stackedEl.innerHTML = `
      <div class="stacked-album-header">
        <button type="button" class="lightbox-back-btn" aria-label="Close">${Icons.arrowBack('', 24)}</button>
        <div class="stacked-album-title-box">
          <div class="stacked-album-title">${title}</div>
          <div class="stacked-album-subtitle">${subtitle}</div>
        </div>
      </div>
      <div class="stacked-album-body" id="stacked-album-list">
        <!-- Loaded dynamically -->
      </div>
    `;

    document.body.appendChild(stackedEl);

    const listContainer = stackedEl.querySelector('#stacked-album-list');

    this.albumUrls = [];
    for (let idx = 0; idx < totalCount; idx++) {
      const msg = albumMsgs[idx];
      let url = null;
      if (msg.mediaId) {
        const med = await db.getMedia(msg.mediaId);
        if (med && med.blob) {
          url = URL.createObjectURL(med.blob);
          this.albumUrls.push(url);
        }
      }

      const item = document.createElement('div');
      item.className = 'stacked-photo-item';
      item.dataset.index = idx;

      const timeFormatted = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
        : '';

      if (url) {
        item.innerHTML = `
          <img src="${url}" alt="${msg.mediaName || 'Photo'}" class="stacked-photo-img" loading="lazy" />
          <div class="stacked-photo-hd-badge">HD</div>
          <div class="stacked-photo-time-pill">${timeFormatted}</div>
        `;
      } else {
        item.innerHTML = `
          <div class="lightbox-error" style="height:200px; display:flex; align-items:center; justify-content:center;">Media content unavailable</div>
        `;
      }

      // Tapping an item in stacked view opens fullscreen album focused on that item.
      // The stacked overlay stays in the DOM so back-from-fullscreen returns here.
      item.addEventListener('click', () => {
        // Keep stackedEl in DOM but hide behind the album overlay
        this.overlay = null; // allow showAlbum to not close the stacked overlay
        this.showAlbum(albumMsgs, idx, onShowInChat);
      });

      listContainer.appendChild(item);
    }

    stackedEl.querySelector('.lightbox-back-btn').addEventListener('click', () => {
      this.close(true);
    });

    window.history.pushState({ modal: 'stacked-album' }, '');
    window.addEventListener('popstate', this.handlePopState);
  }

  handlePopState = (e) => {
    if (this._suppressNextPopState) {
      this._suppressNextPopState = false;
      return;
    }
    if (this.overlay) {
      if (this.overlay.classList.contains('album-lightbox-overlay') && this.stackedOverlay && this.stackedOverlay.isConnected) {
        this._closeAlbumOverlay(false);
      } else {
        this.close(false); // already popped by browser
      }
    }
  };

  close(triggerBack = true) {
    // Close album overlay
    if (this.overlay) {
      const closingEl = this.overlay;
      closingEl.classList.add('overlay-closing');
      setTimeout(() => closingEl.remove(), 210);
      this.overlay = null;
    }
    // Also close stacked overlay if it's separate
    if (this.stackedOverlay && this.stackedOverlay.isConnected) {
      const se = this.stackedOverlay;
      se.classList.add('overlay-closing');
      setTimeout(() => se.remove(), 210);
    }
    this.stackedOverlay = null;

    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
    if (this.albumUrls && this.albumUrls.length) {
      this.albumUrls.forEach((u) => URL.revokeObjectURL(u));
      this.albumUrls = [];
    }
    if (this._albumKeyDownHandler) {
      document.removeEventListener('keydown', this._albumKeyDownHandler);
      this._albumKeyDownHandler = null;
    }
    window.removeEventListener('popstate', this.handlePopState);
    if (triggerBack && history.state && (history.state.modal === 'lightbox' || history.state.modal === 'stacked-album')) {
      history.back();
    }
  }
}

export const mediaLightbox = new Lightbox();
