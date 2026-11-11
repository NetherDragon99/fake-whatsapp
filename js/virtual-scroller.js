// WhatsApp Message Scroller & Chunk-Based Windowed Virtual Renderer
import { Icons } from './icons.js';
import { db } from './db.js';
import { audioManager } from './audio-player.js';
import { mediaLightbox } from './components/lightbox.js';

export class VirtualMessageScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.chatId = options.chatId;
    this.chat = options.chat || {};
    this.onMediaClick = options.onMediaClick || (() => { });
    this.onMessageAction = options.onMessageAction || (() => { });
    this.onMessageClick = options.onMessageClick || null;
    this.outgoingTheme = options.outgoingTheme || 'slate';

    this.CHUNK_SIZE = 50;
    this.MAX_DOM_MESSAGES = 250;
    this.BUFFER_PX = 350;
    this.allMessages = [];
    this.visibleStartIndex = 0;
    this.visibleEndIndex = 0;
    this.isLoadingMore = false;
    this.isAutoScrolling = false;
    this.autoScrollTimer = null;
    this.mediaCache = new Map(); // id -> objectURL
    this.activeLongPressTimer = null;

    this.initScrollListener();
  }

  // Format date header pill: "Today", "Yesterday", or "DD/MM/YYYY"
  formatDatePill(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }

  // Format message time: "7:51 pm"
  formatTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // Assign distinct colors to group participants
  getParticipantColor(name) {
    const colors = [
      '#25d366', '#34b7f1', '#e542a3', '#f39c12',
      '#9b59b6', '#1abc9c', '#e74c3c', '#00a884'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  formatMessageText(text) {
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // Code blocks: ```code```
    escaped = escaped.replace(/```([\s\S]+?)```/g, '<pre class="chat-code-block"><code>$1</code></pre>');

    // Inline code: `code`
    escaped = escaped.replace(/`([^`\n]+?)`/g, '<code class="chat-inline-code">$1</code>');

    // Bold: *text*
    escaped = escaped.replace(/(^|[\s\(\[\{.,!?:;])\*([^*\n]+?)\*($|[\s\)\]}.,!?:;])/g, '$1<strong>$2</strong>$3');

    // Italic: _text_
    escaped = escaped.replace(/(^|[\s\(\[\{.,!?:;])_([^_\n]+?)_($|[\s\)\]}.,!?:;])/g, '$1<em>$2</em>$3');

    // Strikethrough: ~text~
    escaped = escaped.replace(/(^|[\s\(\[\{.,!?:;])~([^~\n]+?)~($|[\s\)\]}.,!?:;])/g, '$1<del>$2</del>$3');

    // URLs: https?://...
    escaped = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>');

    return escaped;
  }

  isSticker(msg) {
    return msg.mediaType === 'sticker' || (msg.mediaName && (/\.webp$/i.test(msg.mediaName) || /stk-/i.test(msg.mediaName) || /sticker/i.test(msg.mediaName)));
  }

  isVisualMedia(msg) {
    if (!msg || msg.isSystem || this.isSticker(msg)) return false;
    if (msg.mediaType === 'image' || msg.mediaType === 'video') return true;
    if (msg.mediaName && /\.(jpg|jpeg|png|webp|gif|mp4|mov|webm)$/i.test(msg.mediaName)) return true;
    return false;
  }

  cancelPendingLongPress() {
    if (this.activeLongPressTimer) {
      clearTimeout(this.activeLongPressTimer);
      this.activeLongPressTimer = null;
    }
  }

  attachLongPress(element, onAction) {
    let startX = 0;
    let startY = 0;

    const onPointerDown = (e) => {
      this.cancelPendingLongPress();
      startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      this.activeLongPressTimer = setTimeout(() => {
        onAction(e);
        this.activeLongPressTimer = null;
      }, 450);
    };

    const onPointerMove = (e) => {
      if (!this.activeLongPressTimer) return;
      const curX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const curY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      // Cancel long-press if moved more than 10px
      if (Math.hypot(curX - startX, curY - startY) > 10) {
        this.cancelPendingLongPress();
      }
    };

    const onPointerUp = () => {
      this.cancelPendingLongPress();
    };

    element.addEventListener('touchstart', onPointerDown, { passive: true });
    element.addEventListener('touchmove', onPointerMove, { passive: true });
    element.addEventListener('touchend', onPointerUp, { passive: true });
    element.addEventListener('touchcancel', onPointerUp, { passive: true });

    element.addEventListener('mousedown', onPointerDown);
    element.addEventListener('mousemove', onPointerMove);
    element.addEventListener('mouseup', onPointerUp);
    element.addEventListener('mouseleave', onPointerUp);

    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelPendingLongPress();
      onAction(e);
    });
  }

  async loadInitial(targetMessageId = null) {
    this.container.innerHTML = '';
    this.allMessages = await db.getMessages(this.chatId);

    if (this.allMessages.length === 0) {
      this.container.innerHTML = `
        <div class="empty-chat-notice">
          <div class="encryption-pill">
            ${Icons.lock('lock-icon', 13)}
            <span>Messages and calls are end-to-end encrypted. No one outside of this chat, not even steven the app creator, can read or listen to them as the chat work localy on your device without any synic, The app oly recive updates but not able to send any data.</span>
          </div>
          <div class="empty-chat-demo-card">
            <p>This conversation is empty.</p>
            <button type="button" class="empty-demo-action-btn" id="btn-load-demo-into-chat">
              ${Icons.download('', 16)}
              <span>Load Default Demo Messages</span>
            </button>
          </div>
        </div>`;

      this.container.querySelector('#btn-load-demo-into-chat')?.addEventListener('click', async () => {
        if (window.app && window.app.loadDemoDataForChat) {
          await window.app.loadDemoDataForChat(this.chatId);
        }
      });
      return;
    }

    if (targetMessageId) {
      const foundIdx = this.allMessages.findIndex((m) => m.id === targetMessageId);
      const targetIdx = foundIdx !== -1 ? foundIdx : this.allMessages.length - 1;
      this.visibleStartIndex = Math.max(0, targetIdx - Math.floor(this.CHUNK_SIZE / 2));
      this.visibleEndIndex = Math.min(this.allMessages.length, this.visibleStartIndex + this.CHUNK_SIZE);
    } else {
      this.visibleStartIndex = Math.max(0, this.allMessages.length - this.CHUNK_SIZE);
      this.visibleEndIndex = this.allMessages.length;
    }

    await this.renderBatch(this.visibleStartIndex, this.visibleEndIndex, 'replace');

    if (targetMessageId) {
      this.scrollToMessage(targetMessageId);
    } else {
      this.container.scrollTop = this.container.scrollHeight;
      requestAnimationFrame(() => {
        this.container.scrollTop = this.container.scrollHeight;
      });
      setTimeout(() => {
        this.container.scrollTop = this.container.scrollHeight;
      }, 50);
    }
  }

  initScrollListener() {
    this.container.addEventListener('scroll', () => {
      // Scrolling ALWAYS cancels any pending long-press timer
      this.cancelPendingLongPress();

      const scrollHeight = this.container.scrollHeight;
      const scrollTop = this.container.scrollTop;
      const clientHeight = this.container.clientHeight;
      const scrollBottomDist = scrollHeight - scrollTop - clientHeight;

      // Check floating scroll-to-bottom button visibility
      const scrollBtn = document.getElementById('chat-scroll-bottom-btn');
      if (scrollBtn) {
        const isAwayFromBottom = scrollBottomDist > 300 || this.visibleEndIndex < this.allMessages.length;
        if (isAwayFromBottom) {
          scrollBtn.classList.add('visible');
        } else {
          scrollBtn.classList.remove('visible');
        }
      }

      // If auto-scrolling is active (scrollToBottom glide, jumpToDate, scrollToMessage), mute boundary loading!
      if (this.isAutoScrolling) {
        return;
      }

      const BUFFER_PX = this.BUFFER_PX || 350;

      // Pre-load older messages when user enters the top 350px buffer of loaded content
      if (scrollTop < BUFFER_PX && !this.isLoadingMore && this.visibleStartIndex > 0) {
        this.loadOlder();
      }

      // Pre-load newer messages when user enters the bottom 350px buffer of loaded content
      if (scrollBottomDist < BUFFER_PX && !this.isLoadingMore && this.visibleEndIndex < this.allMessages.length) {
        this.loadNewer();
      }
    }, { passive: true });
  }

  async loadOlder() {
    if (this.isLoadingMore || this.isAutoScrolling || this.visibleStartIndex <= 0) return;
    this.isLoadingMore = true;

    const prevScrollHeight = this.container.scrollHeight;
    const prevScrollTop = this.container.scrollTop;

    const newStart = Math.max(0, this.visibleStartIndex - this.CHUNK_SIZE);
    const newEnd = this.visibleStartIndex;

    await this.renderBatch(newStart, newEnd, 'prepend');
    this.visibleStartIndex = newStart;

    // Zero-drift mathematical scroll compensation for prepended content
    const newScrollHeight = this.container.scrollHeight;
    const heightDelta = newScrollHeight - prevScrollHeight;
    this.container.scrollTop = prevScrollTop + heightDelta;

    // Prune excess from bottom if exceeding MAX_DOM_MESSAGES
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_MESSAGES) {
      const pruneTarget = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_MESSAGES;
      let msgsRemoved = 0;

      while (this.container.lastElementChild && msgsRemoved < pruneTarget) {
        const lastChild = this.container.lastElementChild;
        if (lastChild.classList.contains('msg-row') || lastChild.classList.contains('album-msg-row')) {
          const count = parseInt(lastChild.dataset.msgCount, 10) || 1;
          msgsRemoved += count;
          lastChild.remove();
        } else {
          lastChild.remove();
        }
      }

      this.visibleEndIndex -= msgsRemoved;

      // Remove any trailing date pill without messages following it
      while (this.container.lastElementChild && this.container.lastElementChild.classList.contains('date-pill-row')) {
        this.container.lastElementChild.remove();
      }
    }

    this.isLoadingMore = false;
  }

  async loadNewer() {
    if (this.isLoadingMore || this.isAutoScrolling || this.visibleEndIndex >= this.allMessages.length) return;
    this.isLoadingMore = true;

    const newStart = this.visibleEndIndex;
    const newEnd = Math.min(this.allMessages.length, this.visibleEndIndex + this.CHUNK_SIZE);

    // Appending content at bottom has zero effect on viewport scroll position above
    await this.renderBatch(newStart, newEnd, 'append');
    this.visibleEndIndex = newEnd;

    // Prune excess from top if exceeding MAX_DOM_MESSAGES
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_MESSAGES) {
      const pruneTarget = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_MESSAGES;

      const prevScrollHeight = this.container.scrollHeight;
      const prevScrollTop = this.container.scrollTop;

      let msgsRemoved = 0;

      while (this.container.firstElementChild && msgsRemoved < pruneTarget) {
        const firstChild = this.container.firstElementChild;
        if (firstChild.classList.contains('msg-row') || firstChild.classList.contains('album-msg-row')) {
          const count = parseInt(firstChild.dataset.msgCount, 10) || 1;
          msgsRemoved += count;
          firstChild.remove();
        } else {
          firstChild.remove();
        }
      }

      // Remove orphaned leading date pills
      while (this.container.firstElementChild && this.container.firstElementChild.classList.contains('date-pill-row')) {
        const next = this.container.firstElementChild.nextElementSibling;
        if (!next || next.classList.contains('date-pill-row')) {
          this.container.firstElementChild.remove();
        } else {
          break;
        }
      }

      this.visibleStartIndex += msgsRemoved;

      // Mathematical offset adjustment for elements removed from top
      const afterScrollHeight = this.container.scrollHeight;
      const removedHeight = prevScrollHeight - afterScrollHeight;
      if (removedHeight > 0) {
        this.container.scrollTop = Math.max(0, prevScrollTop - removedHeight);
      }
    }

    this.isLoadingMore = false;
  }

  async renderBatch(startIndex, endIndex, mode = 'append') {
    const fragment = document.createDocumentFragment();
    let lastDateStr = null;

    if (mode === 'append' && startIndex > 0) {
      const prevMsg = this.allMessages[startIndex - 1];
      if (prevMsg) lastDateStr = this.formatDatePill(prevMsg.timestamp);
    }

    for (let i = startIndex; i < endIndex; i++) {
      const msg = this.allMessages[i];
      if (!msg) continue;

      const dateStr = this.formatDatePill(msg.timestamp);
      if (dateStr !== lastDateStr) {
        const datePill = document.createElement('div');
        datePill.className = 'date-pill-row';
        datePill.innerHTML = `<span class="date-pill">${dateStr}</span>`;
        fragment.appendChild(datePill);
        lastDateStr = dateStr;
      }

      // Check if message is visual media (photos & videos) eligible for album grouping
      const isVisualMsg = this.isVisualMedia(msg);

      if (isVisualMsg) {
        // Look ahead for consecutive same-minute same-sender visual messages
        const albumMsgs = [msg];
        let nextIdx = i + 1;
        while (nextIdx < endIndex) {
          const nextMsg = this.allMessages[nextIdx];
          if (!nextMsg) break;
          const isNextVisual = this.isVisualMedia(nextMsg);
          const isSameSender = nextMsg.sender === msg.sender && nextMsg.isOutgoing === msg.isOutgoing;
          const isSameMinute = Math.abs(nextMsg.timestamp - msg.timestamp) < 60000;
          const isSameBatch = msg.batchId && nextMsg.batchId && msg.batchId === nextMsg.batchId;

          if (isNextVisual && isSameSender && (isSameMinute || isSameBatch)) {
            albumMsgs.push(nextMsg);
            nextIdx++;
          } else {
            break;
          }
        }

        if (albumMsgs.length > 1) {
          // Render grouped Media Album Bubble
          const albumRow = await this.createAlbumElement(albumMsgs);
          fragment.appendChild(albumRow);
          i = nextIdx - 1; // Advance loop to skip grouped messages
          continue;
        }
      }

      const msgRow = await this.createMessageElement(msg);
      fragment.appendChild(msgRow);
    }

    if (mode === 'prepend') {
      this.container.insertBefore(fragment, this.container.firstChild);
    } else if (mode === 'append') {
      this.container.appendChild(fragment);
    } else {
      this.container.innerHTML = '';
      this.container.appendChild(fragment);
    }
  }

  // --- Multi-Image Album Grid inside Chat Bubbles (Step 4) ---

  async _getMediaDimensions(msg) {
    if (msg.mediaWidth && msg.mediaHeight) {
      return { width: msg.mediaWidth, height: msg.mediaHeight };
    }
    let mediaUrl = null;
    if (msg.mediaId) {
      if (this.mediaCache.has(msg.mediaId)) {
        mediaUrl = this.mediaCache.get(msg.mediaId);
      } else {
        const item = await db.getMedia(msg.mediaId);
        if (item && item.blob) {
          mediaUrl = URL.createObjectURL(item.blob);
          this.mediaCache.set(msg.mediaId, mediaUrl);
        }
      }
    }
    if (!mediaUrl) return { width: 1, height: 1 };

    return new Promise((resolve) => {
      const isVideo = msg.mediaType === 'video' || (msg.mediaName && /\.(mp4|mov|webm)$/i.test(msg.mediaName));
      if (isVideo) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          msg.mediaWidth = video.videoWidth || 16;
          msg.mediaHeight = video.videoHeight || 9;
          resolve({ width: msg.mediaWidth, height: msg.mediaHeight });
        };
        video.onerror = () => resolve({ width: 16, height: 9 });
        video.src = mediaUrl;
      } else {
        const img = new Image();
        img.onload = () => {
          msg.mediaWidth = img.naturalWidth || 1;
          msg.mediaHeight = img.naturalHeight || 1;
          resolve({ width: msg.mediaWidth, height: msg.mediaHeight });
        };
        img.onerror = () => resolve({ width: 1, height: 1 });
        img.src = mediaUrl;
      }
    });
  }

  /**
   * Compute a smart layout for a 3-image grid.
   * Picks the photo with the most extreme aspect ratio (landscape or portrait)
   * to occupy the double slot, and places it (top/bottom/left/right) based on send order.
   */
  async _computeTripleLayout(albumMsgs) {
    const dims = await Promise.all([
      this._getMediaDimensions(albumMsgs[0]),
      this._getMediaDimensions(albumMsgs[1]),
      this._getMediaDimensions(albumMsgs[2])
    ]);

    let bestIdx = 0;
    let maxDist = -1;
    let bestOrientation = 'col';

    for (let i = 0; i < 3; i++) {
      const w = dims[i].width || 1;
      const h = dims[i].height || 1;
      const ratio = w / h;
      const dist = ratio >= 1 ? ratio : 1 / ratio;
      if (dist > maxDist) {
        maxDist = dist;
        bestIdx = i;
        bestOrientation = ratio >= 1 ? 'row' : 'col';
      }
    }

    const position = bestIdx === 0
      ? (bestOrientation === 'row' ? 'top' : 'left')
      : (bestOrientation === 'row' ? 'bottom' : 'right');

    return { doubleIdx: bestIdx, layout: bestOrientation, position };
  }

  async createAlbumElement(albumMsgs) {
    const firstMsg = albumMsgs[0];
    const lastMsg = albumMsgs[albumMsgs.length - 1];

    const row = document.createElement('div');
    row.className = `msg-row ${firstMsg.isOutgoing ? 'outgoing' : 'incoming'} album-msg-row`;
    row.id = `msg-${firstMsg.id}`;
    row.dataset.msgId = firstMsg.id;
    row.dataset.msgCount = String(albumMsgs.length);

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${firstMsg.isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'} ${this.outgoingTheme === 'green' && firstMsg.isOutgoing ? 'theme-green' : ''} media-album-bubble`;

    // Group sender title if group
    if (this.chat.isGroup && !firstMsg.isOutgoing && firstMsg.sender) {
      const senderHeader = document.createElement('div');
      senderHeader.className = 'group-sender-title';
      senderHeader.style.color = this.getParticipantColor(firstMsg.sender);
      senderHeader.style.padding = '4px 8px 2px 8px';
      senderHeader.textContent = firstMsg.sender;
      bubble.appendChild(senderHeader);
    }

    // Grid container — fixed display count capped at 4; for 3-image, compute smart layout
    const displayCount = Math.min(4, albumMsgs.length);
    const gridContainer = document.createElement('div');
    gridContainer.className = `album-grid-container count-${displayCount}`;

    // For 3-image grids, compute which image gets the double slot and how
    let tripleLayout = null;
    if (displayCount === 3) {
      tripleLayout = await this._computeTripleLayout(albumMsgs);
      gridContainer.classList.add(`triple-layout-${tripleLayout.layout}`);
      gridContainer.classList.add(`triple-pos-${tripleLayout.position}`);
    }

    // All grid clicks open the stacked album view first (Goal 2).
    // Individual image focus is then achieved from within the stacked view.
    const openStacked = () => {
      mediaLightbox.showStackedAlbum(albumMsgs, this.chat.name, (chatId, msgId) => {
        this.scrollToMessage(msgId);
      });
    };

    gridContainer.addEventListener('click', () => {
      openStacked();
    });

    const thumbWraps = [];
    for (let idx = 0; idx < displayCount; idx++) {
      const itemMsg = albumMsgs[idx];
      let mediaItem = null;
      if (itemMsg.mediaId) {
        mediaItem = await db.getMedia(itemMsg.mediaId);
      }

      let mediaUrl = null;
      if (mediaItem && mediaItem.blob) {
        if (this.mediaCache.has(mediaItem.id)) {
          mediaUrl = this.mediaCache.get(mediaItem.id);
        } else {
          mediaUrl = URL.createObjectURL(mediaItem.blob);
          this.mediaCache.set(mediaItem.id, mediaUrl);
        }
      }

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'album-thumb-wrap';

      if (mediaUrl) {
        if (itemMsg.mediaType === 'video' || (itemMsg.mediaName && /\.(mp4|mov|webm)$/i.test(itemMsg.mediaName))) {
          const video = document.createElement('video');
          video.src = mediaUrl;
          video.className = 'album-thumb-img';
          video.muted = true;
          video.playsInline = true;
          thumbWrap.appendChild(video);

          const playBadge = document.createElement('div');
          playBadge.className = 'album-video-play-badge';
          playBadge.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
          thumbWrap.appendChild(playBadge);
        } else {
          const img = document.createElement('img');
          img.src = mediaUrl;
          img.alt = itemMsg.mediaName || 'Photo';
          img.loading = 'lazy';
          img.className = 'album-thumb-img';
          thumbWrap.appendChild(img);

          const hdBadge = document.createElement('div');
          hdBadge.className = 'album-thumb-hd-badge';
          hdBadge.textContent = 'HD';
          thumbWrap.appendChild(hdBadge);
        }

        // Goal 2: ALL thumb clicks open the stacked view, not direct fullscreen
        thumbWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          openStacked();
        });
      } else {
        thumbWrap.innerHTML = `<div class="media-placeholder">${Icons.gallery('', 24)}</div>`;
        thumbWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          openStacked();
        });
      }

      // 4th item +N overlay if more than 4 items — also opens stacked view
      if (idx === 3 && albumMsgs.length > 4) {
        const plusOverlay = document.createElement('div');
        plusOverlay.className = 'album-plus-overlay';
        plusOverlay.textContent = `+${albumMsgs.length - 4}`;
        plusOverlay.addEventListener('click', (e) => {
          e.stopPropagation();
          openStacked();
        });
        thumbWrap.appendChild(plusOverlay);
      }

      thumbWraps.push(thumbWrap);
    }

    // Apply explicit gridArea placement for 3-image smart layout so no vacant cells exist
    if (tripleLayout && thumbWraps.length === 3) {
      const doubleThumb = thumbWraps[tripleLayout.doubleIdx];
      doubleThumb.classList.add('album-thumb-double', `album-thumb-double-${tripleLayout.layout}`);
      const otherThumbs = [0, 1, 2]
        .filter((i) => i !== tripleLayout.doubleIdx)
        .map((i) => thumbWraps[i]);

      if (tripleLayout.layout === 'row') {
        if (tripleLayout.position === 'top') {
          doubleThumb.style.gridArea = '1 / 1 / 2 / 3';
          otherThumbs[0].style.gridArea = '2 / 1 / 3 / 2';
          otherThumbs[1].style.gridArea = '2 / 2 / 3 / 3';
        } else {
          otherThumbs[0].style.gridArea = '1 / 1 / 2 / 2';
          otherThumbs[1].style.gridArea = '1 / 2 / 2 / 3';
          doubleThumb.style.gridArea = '2 / 1 / 3 / 3';
        }
      } else {
        if (tripleLayout.position === 'left') {
          doubleThumb.style.gridArea = '1 / 1 / 3 / 2';
          otherThumbs[0].style.gridArea = '1 / 2 / 2 / 3';
          otherThumbs[1].style.gridArea = '2 / 2 / 3 / 3';
        } else {
          otherThumbs[0].style.gridArea = '1 / 1 / 2 / 2';
          otherThumbs[1].style.gridArea = '2 / 1 / 3 / 2';
          doubleThumb.style.gridArea = '1 / 2 / 3 / 3';
        }
      }
    }

    thumbWraps.forEach((tw) => gridContainer.appendChild(tw));
    bubble.appendChild(gridContainer);

    // Goal 1: Timestamp & checks always go in a footer row BELOW the grid,
    // styled exactly like a text message meta row — never overlaid on the photos.
    const captionMsg = albumMsgs.find((m) => m.text && m.text.trim().length > 0);
    if (captionMsg) {
      const captionBlock = document.createElement('div');
      captionBlock.className = 'album-caption-block';

      let checksHtml = '';
      if (firstMsg.isOutgoing) {
        checksHtml = Icons.checks(true, 'receipt-check', 15);
      }

      captionBlock.innerHTML = `
        <div class="album-caption-text">${this.escapeHtml(captionMsg.text.trim())}</div>
        <div class="album-caption-meta">
          <span>${this.formatTime(lastMsg.timestamp)}</span>
          ${checksHtml}
        </div>
      `;
      bubble.appendChild(captionBlock);
    } else {
      // No caption: timestamp goes in a clean footer meta row (Goal 1)
      const metaRow = document.createElement('div');
      metaRow.className = 'album-meta-row';
      let checksHtml = '';
      if (firstMsg.isOutgoing) {
        checksHtml = Icons.checks(true, 'receipt-check', 15);
      }
      metaRow.innerHTML = `<span class="album-meta-time">${this.formatTime(lastMsg.timestamp)}</span>${checksHtml}`;
      bubble.appendChild(metaRow);
    }
    row.appendChild(bubble);

    // Attach touch & long-press handler
    this.attachLongPress(row, (e) => {
      this.onMessageAction(firstMsg, row, e);
    });

    row.addEventListener('click', (e) => {
      if (this.onMessageClick) {
        this.onMessageClick(firstMsg, row, e);
      }
    });

    return row;
  }

  async createMessageElement(msg) {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.isOutgoing ? 'outgoing' : 'incoming'}`;
    row.id = `msg-${msg.id}`;
    row.dataset.msgId = msg.id;
    row.dataset.msgCount = '1';

    if (msg.isSystem) {
      row.className = 'msg-row system';
      row.innerHTML = `<div class="system-pill">${msg.text}</div>`;
      return row;
    }

    const isSticker = this.isSticker(msg);

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${msg.isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'} ${this.outgoingTheme === 'green' && msg.isOutgoing ? 'theme-green' : ''} ${isSticker ? 'sticker-bubble' : ''}`;
    bubble.setAttribute('dir', 'auto');

    // Group sender label
    if (this.chat.isGroup && !msg.isOutgoing && msg.sender) {
      const senderHeader = document.createElement('div');
      senderHeader.className = 'group-sender-title';
      senderHeader.style.color = this.getParticipantColor(msg.sender);
      senderHeader.textContent = msg.sender;
      bubble.appendChild(senderHeader);
    }

    // Forwarded badge
    if (msg.isForwarded) {
      const forwardedBadge = document.createElement('div');
      forwardedBadge.className = 'forwarded-header';
      forwardedBadge.innerHTML = `${Icons.forward('forward-icon', 13)} <i>Forwarded</i>`;
      bubble.appendChild(forwardedBadge);
    }

    // Call badge in chat
    if (msg.callInfo) {
      const callBox = document.createElement('div');
      callBox.className = 'chat-call-notice';
      const icon = msg.callInfo.callType === 'video' ? Icons.callVideo('', 18) : Icons.callVoice('', 18);
      callBox.innerHTML = `
        <span class="call-icon-wrap">${icon}</span>
        <span class="call-text">${msg.callInfo.isMissed ? 'Missed call' : 'Call'}</span>
      `;
      bubble.appendChild(callBox);
    }

    // Media preview rendering
    if (msg.mediaName || msg.mediaId) {
      const mediaBox = await this.renderMediaCard(msg);
      if (mediaBox) bubble.appendChild(mediaBox);
    }

    // Message text
    if (msg.text && (!msg.mediaName || msg.text.trim() !== '')) {
      const textDiv = document.createElement('div');
      textDiv.className = 'msg-text';
      textDiv.setAttribute('dir', 'auto');
      if (msg.isDeleted) {
        textDiv.className += ' is-deleted';
        textDiv.innerHTML = `${Icons.lock('', 13)} <i>This message was deleted</i>`;
      } else {
        textDiv.innerHTML = this.formatMessageText(msg.text);
      }
      bubble.appendChild(textDiv);
    }

    // Message metadata: Time + Read Receipts
    const metaSpan = document.createElement('span');
    metaSpan.className = 'msg-meta';
    let checksHtml = '';
    if (msg.isOutgoing) {
      checksHtml = Icons.checks(true, 'receipt-check', 15);
    }
    const editedHtml = msg.isEdited ? '<span class="edited-tag">Edited</span>' : '';
    metaSpan.innerHTML = `${editedHtml}<span class="msg-time">${this.formatTime(msg.timestamp)}</span>${checksHtml}`;
    bubble.appendChild(metaSpan);

    // Reaction badge
    if (msg.reaction) {
      const reactBadge = document.createElement('div');
      reactBadge.className = 'msg-reaction-badge';
      reactBadge.textContent = msg.reaction;
      bubble.appendChild(reactBadge);
    }

    row.appendChild(bubble);

    // Attach reliable long-press gesture (cancels on pointer move > 10px and scroll)
    this.attachLongPress(row, (e) => {
      this.onMessageAction(msg, row, e);
    });

    row.addEventListener('click', (e) => {
      if (this.onMessageClick) {
        this.onMessageClick(msg, row, e);
      }
    });

    return row;
  }

  async renderMediaCard(msg) {
    let mediaItem = null;
    if (msg.mediaId) {
      mediaItem = await db.getMedia(msg.mediaId);
    }

    const type = msg.mediaType || 'document';
    let mediaUrl = null;

    if (mediaItem && mediaItem.blob) {
      if (this.mediaCache.has(mediaItem.id)) {
        mediaUrl = this.mediaCache.get(mediaItem.id);
      } else {
        mediaUrl = URL.createObjectURL(mediaItem.blob);
        this.mediaCache.set(mediaItem.id, mediaUrl);
      }
    }

    // Photo / Image / Sticker
    if (type === 'image' || type === 'sticker') {
      const wrap = document.createElement('div');
      wrap.className = 'media-image-wrap';
      if (mediaUrl) {
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.alt = msg.mediaName || (type === 'sticker' ? 'Sticker' : 'Photo');
        img.loading = 'lazy';
        img.className = 'bubble-photo';
        if (type !== 'sticker') {
          img.addEventListener('click', () => this.onMediaClick(mediaItem, msg));
        }
        wrap.appendChild(img);
      } else {
        wrap.innerHTML = `<div class="media-placeholder">${type === 'sticker' ? Icons.emoji('', 32) : Icons.gallery('', 32)}<span>${msg.mediaName || (type === 'sticker' ? 'Sticker' : 'Image')}</span></div>`;
      }
      return wrap;
    }

    // Video
    if (type === 'video') {
      const wrap = document.createElement('div');
      wrap.className = 'media-video-wrap';
      if (mediaUrl) {
        const vid = document.createElement('video');
        vid.src = mediaUrl;
        vid.preload = 'metadata';
        vid.className = 'bubble-video';
        wrap.appendChild(vid);
        const playOverlay = document.createElement('div');
        playOverlay.className = 'video-play-overlay';
        playOverlay.innerHTML = Icons.play('', 28);
        playOverlay.addEventListener('click', () => this.onMediaClick(mediaItem, msg));
        wrap.appendChild(playOverlay);
      } else {
        wrap.innerHTML = `<div class="media-placeholder">${Icons.callVideo('', 32)}<span>${msg.mediaName || 'Video'}</span></div>`;
      }
      return wrap;
    }

    // Audio Voice Note
    if (type === 'audio') {
      if (mediaUrl) {
        const item = mediaItem || { filename: msg.mediaName, duration: msg.duration };
        if (item && !item.duration && msg.duration) {
          item.duration = msg.duration;
        }
        if (item && !item.filename && msg.mediaName) {
          item.filename = msg.mediaName;
        }
        return audioManager.createVoiceNoteCard(item, mediaUrl);
      } else {
        const audioHolder = document.createElement('div');
        audioHolder.className = 'media-placeholder';
        audioHolder.innerHTML = `${Icons.mic('', 24)}<span>${msg.mediaName || 'Voice note'}</span>`;
        return audioHolder;
      }
    }

    // PDF Card
    if (type === 'pdf') {
      const card = document.createElement('div');
      card.className = `pdf-card ${msg.isForwarded ? 'forwarded-pdf' : ''}`;

      // Thumbnail Box
      const thumbBox = document.createElement('div');
      thumbBox.className = 'pdf-thumb-box';

      if (mediaItem && mediaItem.thumbnailBlob) {
        const thumbUrl = URL.createObjectURL(mediaItem.thumbnailBlob);
        thumbBox.innerHTML = `<img src="${thumbUrl}" alt="PDF Page 1" class="pdf-page-thumb" />`;
      } else {
        thumbBox.innerHTML = `<div class="pdf-icon-placeholder">${Icons.pdfIcon('', 44)}</div>`;
      }
      card.appendChild(thumbBox);

      // Footer Box
      const footer = document.createElement('div');
      footer.className = 'pdf-footer-box';
      const sizeStr = mediaItem ? db.formatBytes(mediaItem.size) : 'PDF';
      const pageCountStr = mediaItem && mediaItem.pageCount ? `${mediaItem.pageCount} pages • ` : '';

      footer.innerHTML = `
        <div class="pdf-meta-left">
          <div class="pdf-filename" title="${msg.mediaName}">${msg.mediaName || 'Document.pdf'}</div>
          <div class="pdf-submeta">${pageCountStr}${sizeStr} • PDF</div>
        </div>
        <button type="button" class="pdf-download-btn" title="Download Document">
          ${Icons.download('', 18)}
        </button>
      `;

      footer.querySelector('.pdf-download-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (mediaUrl) {
          const a = document.createElement('a');
          a.href = mediaUrl;
          a.download = msg.mediaName || 'document.pdf';
          a.click();
        }
      });

      card.addEventListener('click', () => {
        if (mediaUrl) window.open(mediaUrl, '_blank');
      });

      return card;
    }

    // Generic Document
    const docCard = document.createElement('div');
    docCard.className = 'generic-doc-card';
    const sizeStr = mediaItem ? db.formatBytes(mediaItem.size) : '';
    docCard.innerHTML = `
      <div class="doc-icon-wrap">${Icons.documentIcon('', 24)}</div>
      <div class="doc-meta">
        <div class="doc-filename">${msg.mediaName || 'Document'}</div>
        <div class="doc-filesize">${sizeStr}</div>
      </div>
      <button type="button" class="doc-download-btn">${Icons.download('', 18)}</button>
    `;

    if (mediaUrl) {
      docCard.querySelector('.doc-download-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = mediaUrl;
        a.download = msg.mediaName || 'document';
        a.click();
      });
    }

    return docCard;
  }

  async scrollToBottom(smooth = true) {
    clearTimeout(this.autoScrollTimer);
    this.isAutoScrolling = true;

    // Immediately hide the floating scroll-to-bottom button
    const scrollBtn = document.getElementById('chat-scroll-bottom-btn');
    if (scrollBtn) {
      scrollBtn.classList.remove('visible');
    }

    const isUnloadedHistory = this.visibleEndIndex < this.allMessages.length;

    if (isUnloadedHistory) {
      // User is viewing older/unloaded history:
      // Instantly swap to the latest message batch (last 50 messages)
      const batchCount = Math.min(this.allMessages.length, this.CHUNK_SIZE);
      this.visibleStartIndex = Math.max(0, this.allMessages.length - batchCount);
      this.visibleEndIndex = this.allMessages.length;

      await this.renderBatch(this.visibleStartIndex, this.visibleEndIndex, 'replace');

      if (smooth) {
        // Native WhatsApp Glide: position viewport slightly above the bottom (~350px) for a short, fluid glide downward (~250ms)
        const maxScroll = Math.max(0, this.container.scrollHeight - this.container.clientHeight);
        const glideStart = Math.max(0, maxScroll - 350);
        this.container.scrollTop = glideStart;

        requestAnimationFrame(() => {
          this.container.scrollTo({ top: this.container.scrollHeight, behavior: 'smooth' });
        });
      } else {
        this.container.scrollTop = this.container.scrollHeight;
      }
    } else {
      // All messages down to the bottom are already loaded: simply smooth scroll
      if (smooth) {
        this.container.scrollTo({ top: this.container.scrollHeight, behavior: 'smooth' });
      } else {
        this.container.scrollTop = this.container.scrollHeight;
      }
    }

    // Safety timeout: reset the auto-scrolling lock after animation completes and guarantee final bottom alignment
    this.autoScrollTimer = setTimeout(() => {
      this.isAutoScrolling = false;
      this.container.scrollTop = this.container.scrollHeight;
      if (scrollBtn) {
        scrollBtn.classList.remove('visible');
      }
    }, smooth ? 400 : 60);
  }

  async scrollToMessage(messageId) {
    clearTimeout(this.autoScrollTimer);
    this.isAutoScrolling = true;

    let el = this.container.querySelector(`[data-msg-id="${messageId}"]`) ||
      this.container.querySelector(`#msg-${messageId}`);

    if (!el) {
      const foundIdx = this.allMessages.findIndex((m) => m.id === messageId);
      if (foundIdx !== -1) {
        this.visibleStartIndex = Math.max(0, foundIdx - Math.floor(this.CHUNK_SIZE / 2));
        this.visibleEndIndex = Math.min(this.allMessages.length, this.visibleStartIndex + this.CHUNK_SIZE);
        await this.renderBatch(this.visibleStartIndex, this.visibleEndIndex, 'replace');
        el = this.container.querySelector(`[data-msg-id="${messageId}"]`) ||
          this.container.querySelector(`#msg-${messageId}`);
      }
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2500);
    }

    this.autoScrollTimer = setTimeout(() => {
      this.isAutoScrolling = false;
    }, 600);
  }

  async jumpToDate(targetMsg, dateString) {
    if (!targetMsg) return;
    clearTimeout(this.autoScrollTimer);
    this.isAutoScrolling = true;

    // Check if target message is already in DOM
    let el = this.container.querySelector(`[data-msg-id="${targetMsg.id}"]`) ||
      this.container.querySelector(`#msg-${targetMsg.id}`);

    const foundIdx = this.allMessages.findIndex((m) => m.id === targetMsg.id);
    const curCenterIdx = Math.floor((this.visibleStartIndex + this.visibleEndIndex) / 2);
    const isJumpingFromNewer = curCenterIdx >= foundIdx;

    if (!el) {
      if (foundIdx !== -1) {
        this.visibleStartIndex = Math.max(0, foundIdx - 15);
        this.visibleEndIndex = Math.min(this.allMessages.length, this.visibleStartIndex + this.CHUNK_SIZE);
        await this.renderBatch(this.visibleStartIndex, this.visibleEndIndex, 'replace');

        el = this.container.querySelector(`[data-msg-id="${targetMsg.id}"]`) ||
          this.container.querySelector(`#msg-${targetMsg.id}`);
      }
    }

    if (!el) {
      this.isAutoScrolling = false;
      return;
    }

    // Locate the date pill preceding the message
    let datePillRow = null;
    let prev = el.previousElementSibling;
    while (prev) {
      if (prev.classList.contains('date-pill-row')) {
        datePillRow = prev;
        break;
      }
      if (prev.classList.contains('msg-row') || prev.classList.contains('album-msg-row')) {
        break;
      }
      prev = prev.previousElementSibling;
    }

    const anchorEl = datePillRow || el;
    const containerRect = this.container.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const relativeTop = anchorRect.top - containerRect.top;
    const finalScrollTop = Math.max(0, this.container.scrollTop + relativeTop - 24);

    // Initial offset for glide animation (~350px)
    const glideOffset = isJumpingFromNewer ? 350 : -350;
    const initialGlideScrollTop = Math.max(0, Math.min(this.container.scrollHeight - this.container.clientHeight, finalScrollTop + glideOffset));

    this.container.scrollTop = initialGlideScrollTop;

    // Trigger smooth glide to destination
    requestAnimationFrame(() => {
      this.container.scrollTo({
        top: finalScrollTop,
        behavior: 'smooth'
      });
    });

    // Pulse highlight the date pill & target message
    const pillSpan = datePillRow ? datePillRow.querySelector('.date-pill') : null;
    if (pillSpan) {
      pillSpan.classList.add('jump-date-pulse');
      setTimeout(() => pillSpan.classList.remove('jump-date-pulse'), 2500);
    }
    el.classList.add('jump-date-pulse');
    setTimeout(() => el.classList.remove('jump-date-pulse'), 2500);

    this.autoScrollTimer = setTimeout(() => {
      this.isAutoScrolling = false;
    }, 600);
  }

  updateMessageReactionDOM(msgId, reaction) {
    const found = this.allMessages.find((m) => m.id === msgId);
    if (found) found.reaction = reaction;

    const row = this.container.querySelector(`#msg-${msgId}`) ||
      this.container.querySelector(`[data-msg-id="${msgId}"]`);
    if (!row) return;

    const bubble = row.querySelector('.msg-bubble');
    if (!bubble) return;

    let badge = bubble.querySelector('.msg-reaction-badge');
    if (reaction) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'msg-reaction-badge';
        bubble.appendChild(badge);
      }
      badge.textContent = reaction;
    } else if (badge) {
      badge.remove();
    }
  }

  cleanup() {
    clearTimeout(this.autoScrollTimer);
    this.cancelPendingLongPress();
    audioManager.stopCurrent();
    for (const url of this.mediaCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.mediaCache.clear();
  }
}
