// Screen: Starred Messages Screen (Global & Per-Chat)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { Toast } from '../components/toast.js';
import { Motion } from '../ui-motion.js';

export class StarredMessagesView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.chatId = null;
    this.chat = null;
    this.chatsMap = new Map();
    this.messages = [];
    this.selectedMessageIds = new Set();
    this.isSelectionMode = false;
    this.mediaCache = new Map();
    this.activeLongPressTimer = null;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.chatId = params.chatId || null;
    this.selectedMessageIds.clear();
    this.isSelectionMode = false;

    if (this.chatId) {
      this.chat = await db.getChat(this.chatId);
    } else {
      this.chat = null;
    }

    const titleText = this.chat ? `Starred messages` : 'Starred messages';
    const subtitleText = this.chat ? this.chat.name : null;

    rootEl.innerHTML = `
      <div class="screen-view starred-screen">
        <!-- Normal App Bar -->
        <header class="wa-app-bar" id="starred-default-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-starred-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="starred-header-info">
            <div class="app-title">${titleText}</div>
            ${subtitleText ? `<div class="app-subtitle">${this.escapeHtml(subtitleText)}</div>` : ''}
          </div>
          <div class="app-bar-actions">
            <button type="button" class="app-bar-icon-btn" id="btn-starred-enter-select" title="Select messages">
              ${Icons.edit('', 20)}
            </button>
          </div>
        </header>

        <!-- Selection Mode Action Bar -->
        <header class="wa-app-bar selection-bar" id="starred-selection-bar" style="display:none;">
          <div class="selection-left">
            <button type="button" class="app-bar-icon-btn" id="btn-cancel-starred-select" aria-label="Cancel selection">
              ${Icons.arrowBack('', 24)}
            </button>
            <span class="selection-count-title" id="starred-select-count">1</span>
          </div>
          <div class="app-bar-actions">
            <button type="button" class="app-bar-text-btn" id="btn-starred-select-all">Select all</button>
            <button type="button" class="app-bar-icon-btn" id="btn-starred-unstar-selected" title="Unstar">
              ${Icons.unstar('', 20)}
            </button>
          </div>
        </header>

        <!-- Starred Messages Scrollable Container -->
        <div class="starred-content-scroller" id="starred-messages-container">
          <div class="starred-loading-spinner">Loading starred messages...</div>
        </div>

        <!-- Message Context Action Sheet (Long-Press / Quick Action) -->
        <div class="wa-context-sheet-overlay" id="starred-context-overlay" style="display:none;">
          <div class="wa-context-sheet">
            <div class="context-action-list">
              <button type="button" class="context-item" id="ctx-starred-unstar">
                <span class="ctx-icon">${Icons.unstar('', 20)}</span>
                <span>Unstar message</span>
              </button>
              <button type="button" class="context-item" id="ctx-starred-go-chat">
                <span class="ctx-icon">${Icons.chatPlus('', 20)}</span>
                <span>Go to chat</span>
              </button>
              <button type="button" class="context-item" id="ctx-starred-copy">
                <span class="ctx-icon">${Icons.copy('', 20)}</span>
                <span>Copy text</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindGlobalEvents();
    await this.loadStarredMessages();
  }

  bindGlobalEvents() {
    // Back navigation
    this.container.querySelector('#btn-starred-back').addEventListener('click', () => {
      this.router.back();
    });

    // Enter Selection Mode
    this.container.querySelector('#btn-starred-enter-select')?.addEventListener('click', () => {
      this.enterSelectionMode();
    });

    // Cancel Selection Mode
    this.container.querySelector('#btn-cancel-starred-select')?.addEventListener('click', () => {
      this.exitSelectionMode();
    });

    // Select All
    this.container.querySelector('#btn-starred-select-all')?.addEventListener('click', () => {
      this.selectAll();
    });

    // Unstar Selected
    this.container.querySelector('#btn-starred-unstar-selected')?.addEventListener('click', async () => {
      await this.unstarSelected();
    });
  }

  async loadStarredMessages() {
    const listEl = this.container.querySelector('#starred-messages-container');
    if (!listEl) return;

    try {
      this.messages = await db.getStarredMessages(this.chatId);

      // Preload chats for header labels and avatars
      const allChats = await db.getChats();
      this.chatsMap.clear();
      for (const c of allChats) {
        this.chatsMap.set(c.id, c);
      }

      if (this.messages.length === 0) {
        this.renderEmptyState(listEl);
        const editBtn = this.container.querySelector('#btn-starred-enter-select');
        if (editBtn) editBtn.style.display = 'none';
        return;
      }

      const editBtn = this.container.querySelector('#btn-starred-enter-select');
      if (editBtn) editBtn.style.display = 'inline-flex';

      listEl.innerHTML = '';
      const fragment = document.createDocumentFragment();

      for (const msg of this.messages) {
        const card = await this.createStarredCard(msg);
        fragment.appendChild(card);
      }

      listEl.appendChild(fragment);
    } catch (err) {
      console.error('[StarredMessagesView] Failed to load messages:', err);
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 40px 16px; text-align: center;">
          <p style="color: var(--wa-text-secondary);">Failed to load starred messages.</p>
        </div>
      `;
    }
  }

  renderEmptyState(container) {
    container.innerHTML = `
      <div class="starred-empty-state">
        <div class="starred-empty-circle">
          ${Icons.star('', 54)}
        </div>
        <h3 class="starred-empty-title">No starred messages</h3>
        <p class="starred-empty-subtitle">
          Tap and hold on any message in any chat to star it, so you can easily find it later.
        </p>
      </div>
    `;
  }

  async createStarredCard(msg) {
    const chat = this.chatsMap.get(msg.chatId) || { name: 'Chat', isGroup: false };
    const card = document.createElement('div');
    card.className = 'starred-card-item';
    card.dataset.msgId = String(msg.id);
    card.dataset.chatId = String(msg.chatId);

    // Chat / Sender Avatar
    let avatarHtml = '';
    if (chat.avatarBlob) {
      const url = URL.createObjectURL(chat.avatarBlob);
      this.mediaCache.set(`avatar_${chat.id}`, url);
      avatarHtml = `<img src="${url}" alt="Avatar" class="starred-sender-avatar" />`;
    } else {
      avatarHtml = chat.isGroup ? Icons.groupAvatar('', 34) : Icons.userAvatar('', 34);
    }

    // Sender Label
    const senderName = msg.isOutgoing ? 'You' : (msg.sender || chat.name);
    const chatTitle = chat.isGroup ? `${senderName} in ${chat.name}` : chat.name;

    // Date & Time formatting
    const formattedDateTime = this.formatDateTime(msg.timestamp);

    // Message Content
    const contentHtml = await this.renderMessageContent(msg);

    // Metadata inside bubble
    const timeShort = this.formatTime(msg.timestamp);
    let checksHtml = '';
    if (msg.isOutgoing) {
      checksHtml = Icons.checks(true, 'receipt-check', 14);
    }
    const editedHtml = msg.isEdited ? '<span class="edited-tag">Edited</span>' : '';
    const starHtml = `<span class="msg-star-badge" title="Starred">${Icons.star('star-icon-meta', 11)}</span>`;

    card.innerHTML = `
      <div class="starred-selection-indicator">
        <span class="starred-select-check"></span>
      </div>
      <div class="starred-card-inner">
        <!-- Card Header: Chat Info + Timestamp + Jump affordance -->
        <div class="starred-card-header">
          <div class="starred-header-left">
            <div class="starred-avatar-wrap">${avatarHtml}</div>
            <div class="starred-meta-texts">
              <span class="starred-chat-name" dir="auto">${this.escapeHtml(chatTitle)}</span>
              <span class="starred-date-time">${formattedDateTime}</span>
            </div>
          </div>
          <button type="button" class="starred-jump-btn" title="Go to message" aria-label="Go to message">
            ${Icons.chevronDown('rotate-270', 16)}
          </button>
        </div>

        <!-- Card Body: Message Bubble Replica -->
        <div class="starred-bubble-wrap ${msg.isOutgoing ? 'outgoing' : 'incoming'}">
          <div class="msg-bubble ${msg.isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'}" dir="auto">
            ${contentHtml}
            <span class="msg-meta">
              ${editedHtml}
              ${starHtml}
              <span class="msg-time">${timeShort}</span>
              ${checksHtml}
            </span>
          </div>
        </div>
      </div>
    `;

    // Long press detection for selection mode / context menu
    this.attachLongPress(card, (e) => {
      this.handleCardLongPress(msg, card, e);
    });

    // Click handler: Jump to chat OR toggle selection
    card.addEventListener('click', (e) => {
      if (this.isSelectionMode) {
        this.toggleSelection(msg.id, card);
      } else {
        this.jumpToMessage(msg.chatId, msg.id);
      }
    });

    return card;
  }

  async renderMessageContent(msg) {
    // 1. Text Message
    if (msg.text && (!msg.mediaName && !msg.mediaId)) {
      return `<div class="msg-text" dir="auto">${this.formatMessageText(msg.text)}</div>`;
    }

    // 2. Media Message (Photo / Video / Sticker / Audio / Document)
    let mediaItem = null;
    if (msg.mediaId) {
      mediaItem = await db.getMedia(msg.mediaId);
    }

    const type = msg.mediaType || (mediaItem ? mediaItem.type : 'document');
    let mediaUrl = null;
    if (mediaItem && mediaItem.blob) {
      if (this.mediaCache.has(mediaItem.id)) {
        mediaUrl = this.mediaCache.get(mediaItem.id);
      } else {
        mediaUrl = URL.createObjectURL(mediaItem.blob);
        this.mediaCache.set(mediaItem.id, mediaUrl);
      }
    }

    let mediaHtml = '';
    const captionHtml = msg.text && msg.text.trim() ? `<div class="msg-text media-caption" dir="auto">${this.formatMessageText(msg.text)}</div>` : '';

    if (type === 'image' || type === 'sticker') {
      if (mediaUrl) {
        mediaHtml = `
          <div class="media-image-wrap ${type === 'sticker' ? 'is-sticker' : ''}">
            <img src="${mediaUrl}" alt="${this.escapeHtml(msg.mediaName || 'Photo')}" class="bubble-photo" loading="lazy" />
          </div>
        `;
      } else {
        mediaHtml = `<div class="media-placeholder">${Icons.gallery('', 28)} <span>${this.escapeHtml(msg.mediaName || 'Photo')}</span></div>`;
      }
    } else if (type === 'video') {
      if (mediaUrl) {
        mediaHtml = `
          <div class="media-video-wrap">
            <video src="${mediaUrl}" preload="metadata" class="bubble-video"></video>
            <div class="video-play-overlay">${Icons.play('', 28)}</div>
          </div>
        `;
      } else {
        mediaHtml = `<div class="media-placeholder">${Icons.callVideo('', 28)} <span>${this.escapeHtml(msg.mediaName || 'Video')}</span></div>`;
      }
    } else if (type === 'audio') {
      mediaHtml = `
        <div class="starred-audio-card">
          <div class="starred-audio-icon">${Icons.mic('', 22)}</div>
          <div class="starred-audio-info">
            <span class="starred-audio-title">${this.escapeHtml(msg.mediaName || 'Voice note')}</span>
            <span class="starred-audio-sub">Audio message</span>
          </div>
        </div>
      `;
    } else if (type === 'pdf' || type === 'document') {
      mediaHtml = `
        <div class="starred-doc-card">
          <div class="starred-doc-icon">${type === 'pdf' ? Icons.pdfIcon('', 24) : Icons.documentIcon('', 24)}</div>
          <div class="starred-doc-info">
            <span class="starred-doc-title" title="${this.escapeHtml(msg.mediaName || 'Document')}">${this.escapeHtml(msg.mediaName || 'Document')}</span>
            <span class="starred-doc-sub">${mediaItem ? db.formatBytes(mediaItem.size) : 'File'}</span>
          </div>
        </div>
      `;
    }

    return `${mediaHtml}${captionHtml}`;
  }

  jumpToMessage(chatId, messageId) {
    if (!chatId || !messageId) return;
    this.router.navigate(`#/chat/${chatId}?msgId=${messageId}`);
  }

  handleCardLongPress(msg, cardEl, e) {
    if (this.isSelectionMode) {
      this.toggleSelection(msg.id, cardEl);
      return;
    }

    // Open context bottom sheet with options
    const overlay = this.container.querySelector('#starred-context-overlay');
    if (!overlay) {
      this.enterSelectionMode(msg.id);
      return;
    }

    const unstarBtn = overlay.querySelector('#ctx-starred-unstar');
    const goChatBtn = overlay.querySelector('#ctx-starred-go-chat');
    const copyBtn = overlay.querySelector('#ctx-starred-copy');

    if (copyBtn) {
      copyBtn.style.display = (msg.text && msg.text.trim()) ? 'flex' : 'none';
      copyBtn.onclick = () => {
        Motion.closeSheet(overlay);
        navigator.clipboard.writeText(msg.text);
        Toast.show('Message copied to clipboard');
      };
    }

    if (unstarBtn) {
      unstarBtn.onclick = async () => {
        Motion.closeSheet(overlay);
        await db.updateMessage(msg.id, { isStarred: false });
        Toast.show('Message unstarred');
        await this.loadStarredMessages();
      };
    }

    if (goChatBtn) {
      goChatBtn.onclick = () => {
        Motion.closeSheet(overlay);
        this.jumpToMessage(msg.chatId, msg.id);
      };
    }

    overlay.onclick = (ev) => {
      if (ev.target === overlay) Motion.closeSheet(overlay);
    };

    Motion.openSheet(overlay, 'flex');
  }

  enterSelectionMode(initialMsgId = null) {
    this.isSelectionMode = true;
    this.selectedMessageIds.clear();

    const defaultBar = this.container.querySelector('#starred-default-bar');
    const selectionBar = this.container.querySelector('#starred-selection-bar');

    if (defaultBar) defaultBar.style.display = 'none';
    if (selectionBar) selectionBar.style.display = 'flex';

    this.container.querySelector('.starred-screen')?.classList.add('selection-active');

    if (initialMsgId) {
      this.selectedMessageIds.add(String(initialMsgId));
      const el = this.container.querySelector(`.starred-card-item[data-msg-id="${initialMsgId}"]`);
      if (el) el.classList.add('is-selected');
    }

    this.updateSelectionBar();
  }

  toggleSelection(msgId, cardEl) {
    const idStr = String(msgId);
    if (this.selectedMessageIds.has(idStr)) {
      this.selectedMessageIds.delete(idStr);
      if (cardEl) cardEl.classList.remove('is-selected');
    } else {
      this.selectedMessageIds.add(idStr);
      if (cardEl) cardEl.classList.add('is-selected');
    }

    if (this.selectedMessageIds.size === 0) {
      this.exitSelectionMode();
    } else {
      this.updateSelectionBar();
    }
  }

  selectAll() {
    const allCards = this.container.querySelectorAll('.starred-card-item[data-msg-id]');
    const allSelected = this.selectedMessageIds.size === allCards.length;

    if (allSelected) {
      this.selectedMessageIds.clear();
      allCards.forEach((c) => c.classList.remove('is-selected'));
      this.exitSelectionMode();
    } else {
      this.selectedMessageIds.clear();
      allCards.forEach((c) => {
        const id = c.dataset.msgId;
        if (id) {
          this.selectedMessageIds.add(id);
          c.classList.add('is-selected');
        }
      });
      this.updateSelectionBar();
    }
  }

  updateSelectionBar() {
    const countEl = this.container.querySelector('#starred-select-count');
    if (countEl) {
      countEl.textContent = `${this.selectedMessageIds.size}`;
    }
  }

  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selectedMessageIds.clear();

    const defaultBar = this.container.querySelector('#starred-default-bar');
    const selectionBar = this.container.querySelector('#starred-selection-bar');

    if (defaultBar) defaultBar.style.display = 'flex';
    if (selectionBar) selectionBar.style.display = 'none';

    this.container.querySelector('.starred-screen')?.classList.remove('selection-active');
    this.container.querySelectorAll('.starred-card-item.is-selected').forEach((c) => {
      c.classList.remove('is-selected');
    });
  }

  async unstarSelected() {
    if (this.selectedMessageIds.size === 0) return;
    const ids = Array.from(this.selectedMessageIds);

    await db.setMessagesStarred(ids, false);
    const count = ids.length;
    Toast.show(count > 1 ? `${count} messages unstarred` : 'Message unstarred');

    this.exitSelectionMode();
    await this.loadStarredMessages();
  }

  attachLongPress(element, callback, duration = 450) {
    let startX = 0;
    let startY = 0;

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      this.cancelPendingLongPress();

      this.activeLongPressTimer = setTimeout(() => {
        callback(e);
        this.activeLongPressTimer = null;
      }, duration);
    };

    const onPointerMove = (e) => {
      if (!this.activeLongPressTimer) return;
      const curX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const curY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      if (Math.hypot(curX - startX, curY - startY) > 10) {
        this.cancelPendingLongPress();
      }
    };

    const cancelLongPress = () => this.cancelPendingLongPress();

    element.addEventListener('touchstart', onPointerDown, { passive: true });
    element.addEventListener('touchmove', onPointerMove, { passive: true });
    element.addEventListener('touchend', cancelLongPress, { passive: true });
    element.addEventListener('touchcancel', cancelLongPress, { passive: true });

    element.addEventListener('mousedown', onPointerDown);
    element.addEventListener('mousemove', onPointerMove);
    element.addEventListener('mouseup', cancelLongPress);
    element.addEventListener('mouseleave', cancelLongPress);
  }

  cancelPendingLongPress() {
    if (this.activeLongPressTimer) {
      clearTimeout(this.activeLongPressTimer);
      this.activeLongPressTimer = null;
    }
  }

  formatDateTime(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;

    const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  }

  formatTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  formatMessageText(text) {
    if (!text) return '';
    let escaped = this.escapeHtml(text);

    // Code blocks
    escaped = escaped.replace(/```([\s\S]+?)```/g, '<pre class="chat-code-block"><code>$1</code></pre>');
    // Inline code
    escaped = escaped.replace(/`([^`\n]+?)`/g, '<code class="chat-inline-code">$1</code>');
    // Bold
    escaped = escaped.replace(/(^|[\s\(\[\{.,!?:;])\*([^*\n]+?)\*($|[\s\)\]}.,!?:;])/g, '$1<strong>$2</strong>$3');
    // Italic
    escaped = escaped.replace(/(^|[\s\(\[\{.,!?:;])_([^*\n]+?)_($|[\s\)\]}.,!?:;])/g, '$1<em>$2</em>$3');
    // Strikethrough
    escaped = escaped.replace(/(^|[\s\(\[\{.,!?:;])~([^*\n]+?)~($|[\s\)\]}.,!?:;])/g, '$1<del>$2</del>$3');

    return escaped;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  cleanup() {
    this.cancelPendingLongPress();
    for (const url of this.mediaCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.mediaCache.clear();
  }
}

