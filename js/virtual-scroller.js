// WhatsApp Message Scroller & Chunk-Based Windowed Virtual Renderer
import { Icons } from './icons.js';
import { db } from './db.js';
import { audioManager } from './audio-player.js';

export class VirtualMessageScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.chatId = options.chatId;
    this.chat = options.chat || {};
    this.onMediaClick = options.onMediaClick || (() => {});
    this.onMessageAction = options.onMessageAction || (() => {});
    this.outgoingTheme = options.outgoingTheme || 'slate'; // 'slate' or 'green'

    this.CHUNK_SIZE = 50;
    this.MAX_DOM_MESSAGES = 150;
    this.allMessages = [];
    this.visibleStartIndex = 0;
    this.visibleEndIndex = 0;
    this.isLoadingMore = false;
    this.mediaCache = new Map(); // id -> objectURL

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

  async loadInitial(targetMessageId = null) {
    this.container.innerHTML = '';
    this.allMessages = await db.getMessages(this.chatId);

    if (this.allMessages.length === 0) {
      this.container.innerHTML = `
        <div class="empty-chat-notice">
          <div class="encryption-pill">
            ${Icons.lock('lock-icon', 13)}
            <span>Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.</span>
          </div>
        </div>`;
      return;
    }

    let targetIdx = this.allMessages.length - 1;
    if (targetMessageId) {
      const foundIdx = this.allMessages.findIndex((m) => m.id === targetMessageId);
      if (foundIdx !== -1) targetIdx = foundIdx;
    }

    this.visibleStartIndex = Math.max(0, targetIdx - this.CHUNK_SIZE + 1);
    this.visibleEndIndex = Math.min(this.allMessages.length, this.visibleStartIndex + this.CHUNK_SIZE * 2);

    this.renderBatch(this.visibleStartIndex, this.visibleEndIndex, 'replace');

    if (targetMessageId) {
      this.scrollToMessage(targetMessageId);
    } else {
      this.scrollToBottom(false);
    }
  }

  initScrollListener() {
    this.container.addEventListener('scroll', () => {
      // Load older messages when scrolled near top
      if (this.container.scrollTop < 200 && !this.isLoadingMore && this.visibleStartIndex > 0) {
        this.loadOlder();
      }

      // Check floating scroll-to-bottom button
      const scrollBottomDist = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight;
      const scrollBtn = document.getElementById('chat-scroll-bottom-btn');
      if (scrollBtn) {
        if (scrollBottomDist > 400) {
          scrollBtn.classList.add('visible');
        } else {
          scrollBtn.classList.remove('visible');
        }
      }
    });
  }

  async loadOlder() {
    if (this.isLoadingMore || this.visibleStartIndex <= 0) return;
    this.isLoadingMore = true;

    const prevScrollHeight = this.container.scrollHeight;
    const prevScrollTop = this.container.scrollTop;

    const newStart = Math.max(0, this.visibleStartIndex - this.CHUNK_SIZE);
    const newEnd = this.visibleStartIndex;

    await this.renderBatch(newStart, newEnd, 'prepend');
    this.visibleStartIndex = newStart;

    // Prune excess bottom messages if DOM exceeds MAX_DOM_MESSAGES
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_MESSAGES) {
      const pruneCount = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_MESSAGES;
      this.visibleEndIndex -= pruneCount;
      const nodes = Array.from(this.container.querySelectorAll('.msg-row, .date-pill-row'));
      for (let i = nodes.length - 1; i >= nodes.length - pruneCount; i--) {
        if (nodes[i]) nodes[i].remove();
      }
    }

    // Preserve scroll position seamlessly without jumping
    const newScrollHeight = this.container.scrollHeight;
    this.container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);

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

  async createMessageElement(msg) {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.isOutgoing ? 'outgoing' : 'incoming'}`;
    row.dataset.msgId = msg.id;

    if (msg.isSystem) {
      row.className = 'msg-row system';
      row.innerHTML = `<div class="system-pill">${msg.text}</div>`;
      return row;
    }

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${msg.isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'} ${this.outgoingTheme === 'green' && msg.isOutgoing ? 'theme-green' : ''}`;
    bubble.setAttribute('dir', 'auto');

    // Group sender label (for incoming messages in group chats)
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
        textDiv.textContent = msg.text;
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

    // Long press / Context menu handling
    let touchTimer = null;
    row.addEventListener('touchstart', (e) => {
      touchTimer = setTimeout(() => {
        this.onMessageAction(msg, row, e);
      }, 500);
    }, { passive: true });

    row.addEventListener('touchend', () => {
      if (touchTimer) clearTimeout(touchTimer);
    });

    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onMessageAction(msg, row, e);
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

    // Photo / Image
    if (type === 'image') {
      const wrap = document.createElement('div');
      wrap.className = 'media-image-wrap';
      if (mediaUrl) {
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.alt = msg.mediaName || 'Photo';
        img.loading = 'lazy';
        img.className = 'bubble-photo';
        img.addEventListener('click', () => this.onMediaClick(mediaItem, msg));
        wrap.appendChild(img);
      } else {
        wrap.innerHTML = `<div class="media-placeholder">${Icons.gallery('', 32)}<span>${msg.mediaName || 'Image'}</span></div>`;
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
        return audioManager.createVoiceNoteCard(mediaItem || { filename: msg.mediaName }, mediaUrl);
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
        <button class="pdf-download-btn" title="Download Document">
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
      <button class="doc-download-btn">${Icons.download('', 18)}</button>
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

  scrollToBottom(smooth = true) {
    if (smooth) {
      this.container.scrollTo({ top: this.container.scrollHeight, behavior: 'smooth' });
    } else {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  scrollToMessage(messageId) {
    const el = this.container.querySelector(`[data-msg-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2500);
    }
  }

  cleanup() {
    audioManager.stopCurrent();
    for (const url of this.mediaCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.mediaCache.clear();
  }
}
