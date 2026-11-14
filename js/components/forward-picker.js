// Forward Chat Picker — bottom sheet for picking destination chats when forwarding messages
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { Toast } from './toast.js';
import { Motion } from '../ui-motion.js';

/**
 * ForwardPicker
 * Usage:
 *   const picker = new ForwardPicker();
 *   const result = await picker.open(messagesToForward);
 *   // result: { chatIds: string[] } | null (null = cancelled)
 *   picker.destroy();
 */
export class ForwardPicker {
  constructor() {
    this.overlay = null;
    this.chats = [];
    this.filteredChats = [];
    this.selectedChatIds = new Set();
    this.mediaCacheUrls = [];
    this._resolvePromise = null;
  }

  /**
   * @param {Array} messages — array of message objects to forward
   * @returns {Promise<{ chatIds: string[] } | null>}
   */
  open(messages) {
    return new Promise(async (resolve) => {
      this._resolvePromise = resolve;
      this.selectedChatIds.clear();
      this.messages = messages || [];

      // Load chats
      this.chats = await db.getChats();
      this.filteredChats = [...this.chats];

      // Build the overlay DOM
      this._buildDOM();
      document.body.appendChild(this.overlay);

      // Slide up
      Motion.openSheet(this.overlay, 'flex');
    });
  }

  _buildDOM() {
    const overlay = document.createElement('div');
    overlay.className = 'wa-context-sheet-overlay fwd-picker-overlay';
    overlay.style.display = 'none';

    const msgCount = this.messages.length;
    const msgLabel = msgCount === 1 ? '1 message' : `${msgCount} messages`;

    overlay.innerHTML = `
      <div class="wa-context-sheet fwd-picker-sheet">
        <div class="fwd-picker-header">
          <div class="fwd-picker-title">Forward ${msgLabel}</div>
          <button type="button" class="app-bar-icon-btn fwd-picker-close" aria-label="Cancel">
            ${Icons.close('', 20)}
          </button>
        </div>
        <div class="fwd-picker-search-wrap">
          <div class="fwd-search-icon">${Icons.search('', 18)}</div>
          <input
            type="search"
            class="fwd-picker-search"
            placeholder="Search chats…"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="fwd-picker-list" id="fwd-chat-list">
          <div class="fwd-picker-loading">Loading chats…</div>
        </div>
        <div class="fwd-picker-footer" id="fwd-picker-footer" style="display:none;">
          <span class="fwd-selected-label" id="fwd-selected-label">0 selected</span>
          <button type="button" class="fwd-send-btn" id="fwd-send-btn">
            ${Icons.send('', 20)}
            <span>Send</span>
          </button>
        </div>
      </div>
    `;

    this.overlay = overlay;

    // Close on backdrop
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._cancel();
    });

    // Close button
    overlay.querySelector('.fwd-picker-close').addEventListener('click', () => this._cancel());

    // Search
    const searchInput = overlay.querySelector('.fwd-picker-search');
    searchInput.addEventListener('input', () => {
      this._filterChats(searchInput.value.trim());
    });

    // Send button
    overlay.querySelector('#fwd-send-btn').addEventListener('click', () => this._confirmSend());

    // Render list
    this._renderChatList();
  }

  _filterChats(query) {
    if (!query) {
      this.filteredChats = [...this.chats];
    } else {
      const q = query.toLowerCase();
      this.filteredChats = this.chats.filter((c) =>
        (c.name || '').toLowerCase().includes(q)
      );
    }
    this._renderChatList();
  }

  _renderChatList() {
    const listEl = this.overlay.querySelector('#fwd-chat-list');
    if (!listEl) return;

    if (this.filteredChats.length === 0) {
      listEl.innerHTML = `<div class="fwd-picker-empty">No chats found</div>`;
      return;
    }

    listEl.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (const chat of this.filteredChats) {
      const item = this._createChatItem(chat);
      frag.appendChild(item);
    }

    listEl.appendChild(frag);
  }

  _createChatItem(chat) {
    const item = document.createElement('div');
    const isSelected = this.selectedChatIds.has(String(chat.id));
    item.className = `fwd-chat-item${isSelected ? ' is-selected' : ''}`;
    item.dataset.chatId = String(chat.id);

    // Avatar
    let avatarHtml = '';
    if (chat.avatarBlob) {
      const url = URL.createObjectURL(chat.avatarBlob);
      this.mediaCacheUrls.push(url);
      avatarHtml = `<img src="${url}" alt="Avatar" class="fwd-chat-avatar-img" />`;
    } else {
      avatarHtml = chat.isGroup ? Icons.groupAvatar('', 44) : Icons.userAvatar('', 44);
    }

    // Last message preview
    const lastMsg = chat.lastMessage || '';
    const lastMsgText = typeof lastMsg === 'string' ? lastMsg : (lastMsg.text || '');
    const preview = lastMsgText.length > 40 ? lastMsgText.slice(0, 40) + '…' : lastMsgText;

    item.innerHTML = `
      <div class="fwd-chat-avatar">${avatarHtml}</div>
      <div class="fwd-chat-info">
        <div class="fwd-chat-name" dir="auto">${this._escapeHtml(chat.name || 'Chat')}</div>
        ${preview ? `<div class="fwd-chat-preview" dir="auto">${this._escapeHtml(preview)}</div>` : ''}
      </div>
      <div class="fwd-chat-check">
        <div class="fwd-check-circle${isSelected ? ' checked' : ''}"></div>
      </div>
    `;

    item.addEventListener('click', () => {
      this._toggleChat(String(chat.id), item);
    });

    return item;
  }

  _toggleChat(chatId, itemEl) {
    if (this.selectedChatIds.has(chatId)) {
      this.selectedChatIds.delete(chatId);
      itemEl.classList.remove('is-selected');
      itemEl.querySelector('.fwd-check-circle')?.classList.remove('checked');
    } else {
      this.selectedChatIds.add(chatId);
      itemEl.classList.add('is-selected');
      itemEl.querySelector('.fwd-check-circle')?.classList.add('checked');
    }
    this._updateFooter();
  }

  _updateFooter() {
    const footer = this.overlay.querySelector('#fwd-picker-footer');
    const label = this.overlay.querySelector('#fwd-selected-label');
    const count = this.selectedChatIds.size;

    if (footer) footer.style.display = count > 0 ? 'flex' : 'none';
    if (label) label.textContent = count === 1 ? '1 chat selected' : `${count} chats selected`;
  }

  _confirmSend() {
    if (this.selectedChatIds.size === 0) return;
    this._close({ chatIds: Array.from(this.selectedChatIds) });
  }

  _cancel() {
    this._close(null);
  }

  _close(result) {
    if (this.overlay) {
      Motion.closeSheet(this.overlay);
      setTimeout(() => {
        this.destroy();
      }, 320);
    }
    if (this._resolvePromise) {
      this._resolvePromise(result);
      this._resolvePromise = null;
    }
  }

  destroy() {
    // Revoke object URLs
    for (const url of this.mediaCacheUrls) {
      URL.revokeObjectURL(url);
    }
    this.mediaCacheUrls = [];

    // Remove from DOM
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

/**
 * forwardMessagesToChats
 * Core logic: copies each message into each target chat with isForwarded:true
 * @param {Array} messages — original message objects
 * @param {string[]} targetChatIds — destination chat IDs
 */
export async function forwardMessagesToChats(messages, targetChatIds) {
  if (!messages.length || !targetChatIds.length) return;

  const now = Date.now();

  for (const chatId of targetChatIds) {
    const chat = await db.getChat(chatId);
    if (!chat) continue;

    const newMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const src = messages[i];
      const newMsg = {
        // New unique id: timestamp + chatId slice + index to avoid collisions
        id: db.generateUUID ? db.generateUUID() : `${now}_${Math.random().toString(36).slice(2, 9)}`,
        chatId,
        text: src.text || '',
        timestamp: now + i, // slight offset to preserve order
        isOutgoing: true,
        isForwarded: true,
        status: 'sent',
        // Copy media references so the forwarded msg shows the same media
        mediaId: src.mediaId || null,
        mediaType: src.mediaType || null,
        mediaName: src.mediaName || null,
        // Clear sender info (it's now "you" forwarding)
        sender: null,
        isEdited: false,
        isStarred: false,
        reaction: null,
      };
      newMessages.push(newMsg);
    }

    await db.saveMessages(newMessages);

    // Update chat's lastMessage and updatedAt so it bubbles to top
    const lastNew = newMessages[newMessages.length - 1];
    const lastMsgPreview = lastNew.text || (lastNew.mediaType ? `📎 ${lastNew.mediaType}` : 'Forwarded');
    await db.updateChat(chatId, {
      lastMessage: lastMsgPreview,
      updatedAt: now + messages.length,
    });
  }
}

