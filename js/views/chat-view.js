// Screen 4: Inside Chat View
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { VirtualMessageScroller } from '../virtual-scroller.js';
import { mediaLightbox } from '../components/lightbox.js';
import { Toast } from '../components/toast.js';

export class ChatView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.chatId = null;
    this.chat = null;
    this.scroller = null;
    this.searchMatches = [];
    this.currentSearchMatchIndex = -1;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.chatId = params.id;
    this.chat = await db.getChat(this.chatId);

    if (!this.chat) {
      rootEl.innerHTML = `<div class="empty-state">Chat not found. <a href="#/chats">Go back</a></div>`;
      return;
    }

    const outgoingTheme = await db.getSetting('theme', 'slate');
    const targetMsgId = params.msgId || null;

    let subtitle = 'tap here for contact info';
    if (this.chat.isSelfChat) subtitle = 'Message yourself';
    else if (this.chat.isGroup) subtitle = `${this.chat.participantNames?.length || 3} participants`;

    rootEl.innerHTML = `
      <div class="screen-view chat-screen ${this.chat.wallpaper ? 'has-custom-wallpaper' : ''}" style="${this.chat.wallpaper ? `background-image: url(${this.chat.wallpaper});` : ''}">
        
        <!-- Standard Chat App Bar -->
        <header class="wa-app-bar chat-header" id="chat-default-header">
          <div class="chat-header-left">
            <button class="app-bar-icon-btn" id="btn-chat-back">${Icons.arrowBack('', 24)}</button>
            <div class="chat-header-info" id="chat-header-profile-btn">
              <div class="chat-header-avatar">
                ${this.chat.avatarBlob ? `<img src="${URL.createObjectURL(this.chat.avatarBlob)}" class="chat-avatar-img" />` : (this.chat.isGroup ? Icons.groupAvatar('', 38) : Icons.userAvatar('', 38))}
              </div>
              <div class="chat-header-text">
                <div class="chat-header-title" dir="auto">${this.chat.name}</div>
                <div class="chat-header-subtitle">${subtitle}</div>
              </div>
            </div>
          </div>
          
          <div class="chat-header-actions">
            <button class="app-bar-icon-btn" id="btn-chat-menu">${Icons.moreVert('', 22)}</button>
          </div>
        </header>

        <!-- In-Chat Search Bar (Hidden by default) -->
        <div class="chat-search-bar" id="chat-search-header" style="display:none;">
          <button class="app-bar-icon-btn" id="btn-close-chat-search">${Icons.arrowBack('', 24)}</button>
          <input type="text" id="chat-search-query" placeholder="Search in chat..." />
          <span class="search-match-counter" id="search-match-count">0/0</span>
          <button class="app-bar-icon-btn" id="btn-search-prev">${Icons.chevronDown('rotate-180', 20)}</button>
          <button class="app-bar-icon-btn" id="btn-search-next">${Icons.chevronDown('', 20)}</button>
        </div>

        <!-- 3-Dot Dropdown Menu -->
        <div class="wa-dropdown-menu" id="chat-menu-dropdown" style="display:none;">
          <div class="dropdown-item" id="menu-search-chat">${Icons.search('', 18)}<span>Search in chat</span></div>
          <div class="dropdown-item" id="menu-flip-perspective">${Icons.swap('', 18)}<span>Swap Sender / Receiver</span></div>
          <div class="dropdown-item" id="menu-jump-date">${Icons.calendar('', 18)}<span>Jump to Date</span></div>
          <div class="dropdown-item" id="menu-edit-chat">${Icons.userAvatar('', 18)}<span>Edit Chat Info</span></div>
          <div class="dropdown-item" id="menu-wallpaper">${Icons.gallery('', 18)}<span>Wallpaper</span></div>
          <div class="dropdown-item" id="menu-clear-chat">${Icons.trash('', 18)}<span class="danger-text">Clear chat</span></div>
        </div>

        <!-- Messages Area -->
        <div class="chat-messages-container" id="chat-messages-wrap"></div>

        <!-- Floating Scroll-To-Bottom Button -->
        <button class="chat-scroll-bottom" id="chat-scroll-bottom-btn" title="Scroll to bottom">
          ${Icons.chevronDown('', 22)}
        </button>

        <!-- Bottom Input Bar -->
        <footer class="chat-input-bar">
          <div class="input-pill">
            <button class="input-icon-btn">${Icons.emoji('', 22)}</button>
            <textarea id="chat-input-textarea" placeholder="Message" rows="1" dir="auto"></textarea>
            <label class="input-icon-btn" title="Attach file">
              ${Icons.paperclip('', 22)}
              <input type="file" id="chat-attach-input" style="display:none;" />
            </label>
            <button class="input-icon-btn" id="btn-camera-snap">${Icons.camera('', 22)}</button>
          </div>
          <button class="mic-send-btn" id="btn-mic-send">
            ${Icons.mic('mic-icon', 22)}
          </button>
        </footer>

        <!-- Hidden Date Picker for Jump To Date -->
        <input type="date" id="chat-hidden-date-picker" style="display:none;" />

        <!-- Message Context Action Sheet (Long-Press) -->
        <div class="wa-context-sheet-overlay" id="msg-context-overlay" style="display:none;">
          <div class="wa-context-sheet">
            <div class="reaction-emoji-bar">
              <span class="react-btn" data-emoji="👍">👍</span>
              <span class="react-btn" data-emoji="❤️">❤️</span>
              <span class="react-btn" data-emoji="😂">😂</span>
              <span class="react-btn" data-emoji="😮">😮</span>
              <span class="react-btn" data-emoji="😢">😢</span>
              <span class="react-btn" data-emoji="🙏">🙏</span>
            </div>
            <div class="context-action-list">
              <button class="context-item" id="ctx-copy-text">Copy text</button>
              <button class="context-item" id="ctx-toggle-forward">Toggle "Forwarded"</button>
              <button class="context-item danger-text" id="ctx-delete-msg">Delete message</button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.bindEvents(outgoingTheme, targetMsgId);
  }

  async bindEvents(outgoingTheme, targetMsgId) {
    const messagesWrap = this.container.querySelector('#chat-messages-wrap');

    // Initialize Virtual Message Scroller
    this.scroller = new VirtualMessageScroller(messagesWrap, {
      chatId: this.chatId,
      chat: this.chat,
      outgoingTheme,
      onMediaClick: (mediaItem, msg) => {
        mediaLightbox.show(mediaItem, msg, (cId, mId) => {
          this.scroller.scrollToMessage(mId);
        });
      },
      onMessageAction: (msg, rowEl, evt) => {
        this.openMessageContextMenu(msg, rowEl);
      }
    });

    await this.scroller.loadInitial(targetMsgId);

    // Header Back
    this.container.querySelector('#btn-chat-back').addEventListener('click', () => {
      this.router.navigate('#/chats');
    });

    // Profile Click -> Contact Info Screen 5
    this.container.querySelector('#chat-header-profile-btn').addEventListener('click', () => {
      this.router.navigate(`#/chat/${this.chatId}/info`);
    });

    // 3-Dot Menu Toggle
    const menuBtn = this.container.querySelector('#btn-chat-menu');
    const dropdown = this.container.querySelector('#chat-menu-dropdown');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', () => {
      if (dropdown) dropdown.style.display = 'none';
    });

    // Menu Item: Search in Chat
    this.container.querySelector('#menu-search-chat').addEventListener('click', () => {
      dropdown.style.display = 'none';
      this.toggleSearchHeader(true);
    });

    // Menu Item: Swap Sender / Receiver (Flip Perspective)
    this.container.querySelector('#menu-flip-perspective').addEventListener('click', async () => {
      dropdown.style.display = 'none';
      await this.flipPerspective();
    });

    // Menu Item: Jump to Date
    const datePicker = this.container.querySelector('#chat-hidden-date-picker');
    this.container.querySelector('#menu-jump-date').addEventListener('click', () => {
      dropdown.style.display = 'none';
      datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
    });

    datePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        this.jumpToSelectedDate(e.target.value);
      }
    });

    // Menu Item: Edit Chat Info
    this.container.querySelector('#menu-edit-chat').addEventListener('click', () => {
      dropdown.style.display = 'none';
      this.openEditChatModal();
    });

    // Menu Item: Wallpaper
    this.container.querySelector('#menu-wallpaper').addEventListener('click', () => {
      dropdown.style.display = 'none';
      this.promptWallpaper();
    });

    // Menu Item: Clear Chat
    this.container.querySelector('#menu-clear-chat').addEventListener('click', async () => {
      dropdown.style.display = 'none';
      if (confirm('Clear all messages in this chat?')) {
        const msgs = await db.getMessages(this.chatId);
        for (const m of msgs) await db.deleteMessage(m.id);
        await db.updateChat(this.chatId, { lastMessage: null, updatedAt: Date.now() });
        Toast.show('Chat cleared');
        this.scroller.loadInitial();
      }
    });

    // Floating Scroll to Bottom
    this.container.querySelector('#chat-scroll-bottom-btn').addEventListener('click', () => {
      this.scroller.scrollToBottom(true);
    });

    // In-Chat Search bar events
    this.bindSearchEvents();

    // Input text & Send / Mic button behavior
    const textarea = this.container.querySelector('#chat-input-textarea');
    const sendBtn = this.container.querySelector('#btn-mic-send');

    textarea.addEventListener('input', () => {
      if (textarea.value.trim().length > 0) {
        sendBtn.innerHTML = Icons.send('', 22);
        sendBtn.classList.add('is-send');
      } else {
        sendBtn.innerHTML = Icons.mic('mic-icon', 22);
        sendBtn.classList.remove('is-send');
      }
    });

    sendBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (text) {
        this.sendNewMessage(text);
        textarea.value = '';
        sendBtn.innerHTML = Icons.mic('mic-icon', 22);
        sendBtn.classList.remove('is-send');
      } else {
        Toast.show('Voice recording simulated');
      }
    });

    // Attachment input
    const attachInput = this.container.querySelector('#chat-attach-input');
    attachInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        await this.handleLocalAttachment(e.target.files[0]);
      }
    });
  }

  // Swap Sender / Receiver perspective on the fly!
  async flipPerspective() {
    const msgs = await db.getMessages(this.chatId);
    if (msgs.length === 0) return;

    // Flip outgoing status for all messages
    for (const m of msgs) {
      if (!m.isSystem) {
        m.isOutgoing = !m.isOutgoing;
      }
    }
    await db.saveMessages(msgs);

    // Update last message metadata
    const last = msgs[msgs.length - 1];
    if (last) {
      await db.updateChat(this.chatId, {
        lastMessage: {
          text: last.text,
          timestamp: last.timestamp,
          isOutgoing: last.isOutgoing,
          mediaType: last.mediaType
        }
      });
    }

    Toast.show('Perspective flipped: Outgoing / Incoming reversed!');
    this.scroller.loadInitial();
  }

  async jumpToSelectedDate(dateString) {
    // dateString format YYYY-MM-DD
    const targetDate = new Date(dateString);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
    const endOfDay = startOfDay + 86400000;

    const msgs = await db.getMessages(this.chatId);
    const found = msgs.find((m) => m.timestamp >= startOfDay && m.timestamp <= endOfDay);

    if (found) {
      this.scroller.loadInitial(found.id);
    } else {
      Toast.show('No messages found on this date.');
    }
  }

  toggleSearchHeader(show) {
    const searchHeader = this.container.querySelector('#chat-search-header');
    const defaultHeader = this.container.querySelector('#chat-default-header');
    if (show) {
      searchHeader.style.display = 'flex';
      defaultHeader.style.display = 'none';
      const input = this.container.querySelector('#chat-search-query');
      input.focus();
    } else {
      searchHeader.style.display = 'none';
      defaultHeader.style.display = 'flex';
      this.clearSearchHighlights();
    }
  }

  bindSearchEvents() {
    const searchHeader = this.container.querySelector('#chat-search-header');
    const closeBtn = this.container.querySelector('#btn-close-chat-search');
    const searchInput = this.container.querySelector('#chat-search-query');
    const prevBtn = this.container.querySelector('#btn-search-prev');
    const nextBtn = this.container.querySelector('#btn-search-next');
    const counter = this.container.querySelector('#search-match-count');

    closeBtn.addEventListener('click', () => this.toggleSearchHeader(false));

    searchInput.addEventListener('input', async (e) => {
      const q = e.target.value.trim();
      if (!q) {
        counter.textContent = '0/0';
        this.searchMatches = [];
        this.currentSearchMatchIndex = -1;
        this.clearSearchHighlights();
        return;
      }

      this.searchMatches = await db.searchMessages(q, this.chatId);
      if (this.searchMatches.length > 0) {
        this.currentSearchMatchIndex = this.searchMatches.length - 1; // latest match
        counter.textContent = `${this.currentSearchMatchIndex + 1}/${this.searchMatches.length}`;
        this.jumpToSearchMatch();
      } else {
        counter.textContent = '0/0';
        this.clearSearchHighlights();
      }
    });

    nextBtn.addEventListener('click', () => {
      if (this.searchMatches.length === 0) return;
      this.currentSearchMatchIndex = (this.currentSearchMatchIndex + 1) % this.searchMatches.length;
      counter.textContent = `${this.currentSearchMatchIndex + 1}/${this.searchMatches.length}`;
      this.jumpToSearchMatch();
    });

    prevBtn.addEventListener('click', () => {
      if (this.searchMatches.length === 0) return;
      this.currentSearchMatchIndex = (this.currentSearchMatchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
      counter.textContent = `${this.currentSearchMatchIndex + 1}/${this.searchMatches.length}`;
      this.jumpToSearchMatch();
    });
  }

  jumpToSearchMatch() {
    const match = this.searchMatches[this.currentSearchMatchIndex];
    if (match) {
      this.scroller.loadInitial(match.id);
    }
  }

  clearSearchHighlights() {
    this.container.querySelectorAll('.highlight-flash').forEach((el) => el.classList.remove('highlight-flash'));
  }

  async sendNewMessage(text) {
    const newMsg = {
      id: 'msg_' + Date.now(),
      chatId: this.chatId,
      timestamp: Date.now(),
      sender: this.chat.meParticipant || 'Me',
      isOutgoing: true,
      text,
      mediaName: null,
      mediaType: null,
      mediaId: null,
      isDeleted: false,
      isEdited: false,
      reaction: null
    };

    await db.saveMessages([newMsg]);
    await db.updateChat(this.chatId, {
      lastMessage: {
        text: newMsg.text,
        timestamp: newMsg.timestamp,
        isOutgoing: true,
        mediaType: null
      },
      updatedAt: Date.now()
    });

    this.scroller.loadInitial();
  }

  async handleLocalAttachment(file) {
    const mediaId = 'media_' + Date.now();
    let mediaType = 'document';
    if (file.type.startsWith('image/')) mediaType = 'image';
    else if (file.type.startsWith('video/')) mediaType = 'video';
    else if (file.type.startsWith('audio/')) mediaType = 'audio';
    else if (file.type.includes('pdf')) mediaType = 'pdf';

    const mediaRecord = {
      id: mediaId,
      chatId: this.chatId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      blob: file,
      thumbnailBlob: null,
      size: file.size,
      pageCount: 0
    };

    await db.saveMedia(mediaRecord);

    const newMsg = {
      id: 'msg_' + Date.now(),
      chatId: this.chatId,
      timestamp: Date.now(),
      sender: this.chat.meParticipant || 'Me',
      isOutgoing: true,
      text: '',
      mediaName: file.name,
      mediaType,
      mediaId,
      isDeleted: false,
      isEdited: false
    };

    await db.saveMessages([newMsg]);
    await db.updateChat(this.chatId, {
      lastMessage: {
        text: file.name,
        timestamp: newMsg.timestamp,
        isOutgoing: true,
        mediaType
      },
      updatedAt: Date.now()
    });

    this.scroller.loadInitial();
    Toast.show('Attachment added');
  }

  openMessageContextMenu(msg, rowEl) {
    const overlay = this.container.querySelector('#msg-context-overlay');
    overlay.style.display = 'flex';

    // Reactions: Highlight active reaction and toggle without re-rendering
    const currentReaction = msg.reaction || null;
    overlay.querySelectorAll('.react-btn').forEach((btn) => {
      const emoji = btn.dataset.emoji;
      if (emoji === currentReaction) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }

      btn.onclick = async () => {
        const clickedReaction = btn.dataset.emoji;
        const newReaction = (msg.reaction === clickedReaction) ? null : clickedReaction;
        msg.reaction = newReaction;
        await db.updateMessage(msg.id, { reaction: newReaction });
        overlay.style.display = 'none';

        // Update ONLY this message's DOM node (no scroll jump, no re-render!)
        this.scroller.updateMessageReactionDOM(msg.id, newReaction);
      };
    });

    // Copy Text
    overlay.querySelector('#ctx-copy-text').onclick = () => {
      overlay.style.display = 'none';
      if (msg.text) {
        navigator.clipboard.writeText(msg.text);
        Toast.show('Message copied to clipboard');
      }
    };

    // Toggle Forwarded
    overlay.querySelector('#ctx-toggle-forward').onclick = async () => {
      overlay.style.display = 'none';
      await db.updateMessage(msg.id, { isForwarded: !msg.isForwarded });
      this.scroller.loadInitial();
    };

    // Delete message
    overlay.querySelector('#ctx-delete-msg').onclick = async () => {
      overlay.style.display = 'none';
      if (confirm('Delete this message?')) {
        await db.deleteMessage(msg.id);
        this.scroller.loadInitial();
      }
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    };
  }

  openEditChatModal() {
    const newName = prompt('Edit Chat Name:', this.chat.name);
    if (newName && newName.trim()) {
      db.updateChat(this.chatId, { name: newName.trim() }).then(() => {
        this.chat.name = newName.trim();
        this.container.querySelector('.chat-header-title').textContent = newName.trim();
        Toast.show('Chat name updated');
      });
    }
  }

  promptWallpaper() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = async () => {
          const bgDataUrl = reader.result;
          await db.updateChat(this.chatId, { wallpaper: bgDataUrl });
          this.container.querySelector('.chat-screen').style.backgroundImage = `url(${bgDataUrl})`;
          Toast.show('Wallpaper set for this chat');
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    };
    input.click();
  }

  cleanup() {
    if (this.scroller) {
      this.scroller.cleanup();
    }
  }
}
