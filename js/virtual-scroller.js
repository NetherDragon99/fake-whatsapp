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
    this.onMediaClick = options.onMediaClick || (() => {});
    this.onMessageAction = options.onMessageAction || (() => {});
    this.outgoingTheme = options.outgoingTheme || 'slate';

    this.CHUNK_SIZE = 50;
    this.MAX_DOM_MESSAGES = 150;
    this.allMessages = [];
    this.visibleStartIndex = 0;
    this.visibleEndIndex = 0;
    this.isLoadingMore = false;
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
            <span>Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.</span>
          </div>
        </div>`;
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

      // Load older messages when scrolled near top
      if (this.container.scrollTop < 250 && !this.isLoadingMore && this.visibleStartIndex > 0) {
        this.loadOlder();
      }

      // Load newer messages when scrolled near bottom (Task 3)
      const scrollBottomDist = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight;
      if (scrollBottomDist < 350 && !this.isLoadingMore && this.visibleEndIndex < this.allMessages.length) {
        this.loadNewer();
      }

      // Check floating scroll-to-bottom button
      const scrollBtn = document.getElementById('chat-scroll-bottom-btn');
      if (scrollBtn) {
        if (scrollBottomDist > 400) {
          scrollBtn.classList.add('visible');
        } else {
          scrollBtn.classList.remove('visible');
        }
      }
    }, { passive: true });
  }

  async loadOlder() {
    if (this.isLoadingMore || this.visibleStartIndex <= 0) return;
    this.isLoadingMore = true;

    // Anchor detection to eliminate scroll jumping
    const containerRect = this.container.getBoundingClientRect();
    let anchorNode = null;
    let anchorOffset = 0;
    for (const child of this.container.children) {
      if (child.classList.contains('msg-row') || child.classList.contains('album-msg-row')) {
        const r = child.getBoundingClientRect();
        if (r.bottom > containerRect.top + 5) {
          anchorNode = child;
          anchorOffset = r.top - containerRect.top;
          break;
        }
      }
    }

    const prevScrollHeight = this.container.scrollHeight;
    const prevScrollTop = this.container.scrollTop;

    const newStart = Math.max(0, this.visibleStartIndex - this.CHUNK_SIZE);
    const newEnd = this.visibleStartIndex;

    await this.renderBatch(newStart, newEnd, 'prepend');
    this.visibleStartIndex = newStart;

    // Prune excess from bottom if exceeding MAX_DOM_MESSAGES
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_MESSAGES) {
      const pruneCount = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_MESSAGES;
      this.visibleEndIndex -= pruneCount;
      const nodes = Array.from(this.container.querySelectorAll('.msg-row'));
      for (let i = nodes.length - 1; i >= nodes.length - pruneCount && i >= 0; i--) {
        if (nodes[i]) nodes[i].remove();
      }
      // Remove any orphaned trailing date pills
      let lastChild = this.container.lastElementChild;
      while (lastChild && lastChild.classList.contains('date-pill-row')) {
        lastChild.remove();
        lastChild = this.container.lastElementChild;
      }
    }

    // Scroll Anchoring: compensate exact drift mathematically
    if (anchorNode && anchorNode.isConnected) {
      const newRect = anchorNode.getBoundingClientRect();
      const currentOffset = newRect.top - containerRect.top;
      const drift = currentOffset - anchorOffset;
      if (Math.abs(drift) > 0.5) {
        this.container.scrollTop += drift;
      }
    } else {
      const newScrollHeight = this.container.scrollHeight;
      this.container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
    }

    this.isLoadingMore = false;
  }

  async loadNewer() {
    if (this.isLoadingMore || this.visibleEndIndex >= this.allMessages.length) return;
    this.isLoadingMore = true;

    // Pick a landmark anchor node visible near bottom/center that will not be pruned from top
    const containerRect = this.container.getBoundingClientRect();
    let anchorNode = null;
    let anchorOffset = 0;
    const msgNodes = Array.from(this.container.querySelectorAll('.msg-row'));
    for (let i = msgNodes.length - 1; i >= 0; i--) {
      const node = msgNodes[i];
      const r = node.getBoundingClientRect();
      if (r.top < containerRect.bottom - 20) {
        anchorNode = node;
        anchorOffset = r.top - containerRect.top;
        break;
      }
    }

    const prevScrollTop = this.container.scrollTop;
    const newStart = this.visibleEndIndex;
    const newEnd = Math.min(this.allMessages.length, this.visibleEndIndex + this.CHUNK_SIZE);

    await this.renderBatch(newStart, newEnd, 'append');
    this.visibleEndIndex = newEnd;

    // Prune excess from top if exceeding MAX_DOM_MESSAGES
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_MESSAGES) {
      const pruneCount = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_MESSAGES;
      let msgCountRemoved = 0;
      const children = Array.from(this.container.children);

      for (let i = 0; i < children.length && msgCountRemoved < pruneCount; i++) {
        const node = children[i];
        if (node.classList.contains('msg-row')) {
          msgCountRemoved++;
        }
        node.remove();
      }

      // Remove orphaned leading date pills
      let firstChild = this.container.firstElementChild;
      while (firstChild && firstChild.classList.contains('date-pill-row')) {
        const next = firstChild.nextElementSibling;
        if (!next || next.classList.contains('date-pill-row')) {
          firstChild.remove();
          firstChild = this.container.firstElementChild;
        } else {
          break;
        }
      }

      this.visibleStartIndex += msgCountRemoved;
    }

    // Scroll Anchoring: compensate exact drift mathematically
    if (anchorNode && anchorNode.isConnected) {
      const newRect = anchorNode.getBoundingClientRect();
      const currentOffset = newRect.top - containerRect.top;
      const drift = currentOffset - anchorOffset;
      if (Math.abs(drift) > 0.5) {
        this.container.scrollTop += drift;
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

      // Check if message is an image eligible for album grouping (Step 4)
      const isImageMsg = (msg.mediaType === 'image' || (!msg.mediaType && msg.mediaName && /\.(jpg|jpeg|png|webp|gif)$/i.test(msg.mediaName))) &&
                         !msg.isSystem &&
                         !this.isSticker(msg) &&
                         (!msg.text || !msg.text.trim());

      if (isImageMsg) {
        // Look ahead for consecutive same-minute same-sender image messages
        const albumMsgs = [msg];
        let nextIdx = i + 1;
        while (nextIdx < endIndex) {
          const nextMsg = this.allMessages[nextIdx];
          if (!nextMsg) break;
          const isNextImage = (nextMsg.mediaType === 'image' || (!nextMsg.mediaType && nextMsg.mediaName && /\.(jpg|jpeg|png|webp|gif)$/i.test(nextMsg.mediaName))) &&
                              !nextMsg.isSystem &&
                              !this.isSticker(nextMsg) &&
                              (!nextMsg.text || !nextMsg.text.trim());
          const isSameSender = nextMsg.sender === msg.sender && nextMsg.isOutgoing === msg.isOutgoing;
          const isSameMinute = Math.abs(nextMsg.timestamp - msg.timestamp) < 60000;

          if (isNextImage && isSameSender && isSameMinute) {
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
  async createAlbumElement(albumMsgs) {
    const firstMsg = albumMsgs[0];
    const lastMsg = albumMsgs[albumMsgs.length - 1];

    const row = document.createElement('div');
    row.className = `msg-row ${firstMsg.isOutgoing ? 'outgoing' : 'incoming'} album-msg-row`;
    row.id = `msg-${firstMsg.id}`;
    row.dataset.msgId = firstMsg.id;

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

    // Grid container
    const displayCount = Math.min(4, albumMsgs.length);
    const gridContainer = document.createElement('div');
    gridContainer.className = `album-grid-container count-${displayCount}`;

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
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.alt = itemMsg.mediaName || 'Photo';
        img.loading = 'lazy';
        img.className = 'album-thumb-img';
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          mediaLightbox.showAlbum(albumMsgs, idx, (chatId, msgId) => {
            this.scrollToMessage(msgId);
          });
        });
        thumbWrap.appendChild(img);

        const hdBadge = document.createElement('div');
        hdBadge.className = 'album-thumb-hd-badge';
        hdBadge.textContent = 'HD';
        thumbWrap.appendChild(hdBadge);
      } else {
        thumbWrap.innerHTML = `<div class="media-placeholder">${Icons.gallery('', 24)}</div>`;
      }

      // 4th item +N overlay if more than 4 items (Opens Stacked Album View @refrance12)
      if (idx === 3 && albumMsgs.length > 4) {
        const plusOverlay = document.createElement('div');
        plusOverlay.className = 'album-plus-overlay';
        plusOverlay.textContent = `+${albumMsgs.length - 4}`;
        plusOverlay.addEventListener('click', (e) => {
          e.stopPropagation();
          mediaLightbox.showStackedAlbum(albumMsgs, this.chat.name, (chatId, msgId) => {
            this.scrollToMessage(msgId);
          });
        });
        thumbWrap.appendChild(plusOverlay);
      }

      gridContainer.appendChild(thumbWrap);
    }

    // Overlaid Timestamp & Read Receipts at bottom right of the entire grid
    const metaPill = document.createElement('div');
    metaPill.className = 'album-meta-pill';
    let checksHtml = '';
    if (firstMsg.isOutgoing) {
      checksHtml = Icons.checks(true, 'receipt-check-white', 15);
    }
    metaPill.innerHTML = `<span>${this.formatTime(lastMsg.timestamp)}</span>${checksHtml}`;
    gridContainer.appendChild(metaPill);

    bubble.appendChild(gridContainer);
    row.appendChild(bubble);

    // Attach touch & long-press handler
    this.attachLongPress(row, (e) => {
      this.onMessageAction(firstMsg, row, e);
    });

    return row;
  }

  async createMessageElement(msg) {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.isOutgoing ? 'outgoing' : 'incoming'}`;
    row.id = `msg-${msg.id}`;
    row.dataset.msgId = msg.id;

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
    if (this.visibleEndIndex < this.allMessages.length) {
      this.visibleStartIndex = Math.max(0, this.allMessages.length - this.CHUNK_SIZE);
      this.visibleEndIndex = this.allMessages.length;
      await this.renderBatch(this.visibleStartIndex, this.visibleEndIndex, 'replace');
    }
    if (smooth) {
      this.container.scrollTo({ top: this.container.scrollHeight, behavior: 'smooth' });
    } else {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  async scrollToMessage(messageId) {
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
    this.cancelPendingLongPress();
    audioManager.stopCurrent();
    for (const url of this.mediaCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.mediaCache.clear();
  }
}
