// Screen 4: Inside Chat View with Touch Fix, Scroll Animation & Material 3 Styling
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { VirtualMessageScroller } from '../virtual-scroller.js';
import { mediaLightbox } from '../components/lightbox.js';
import { Toast } from '../components/toast.js';
import { showConfirm, showAlert, showPrompt } from '../components/custom-dialog.js';
import { WALLPAPER_PRESETS } from '../config/wallpapers.js';
import { assetUrl } from '../config/base-path.js';

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

    const defaultWp = await db.getSetting('defaultWallpaper', 'default');
    const defaultDimming = await db.getSetting('defaultDimming', 0);
    const outgoingTheme = await db.getSetting('theme', 'slate');
    const targetMsgId = params.msgId || null;

    let subtitle = 'tap here for contact info';
    if (this.chat.isSelfChat) subtitle = 'Message yourself';
    else if (this.chat.isGroup) subtitle = `${this.chat.participantNames?.length || 3} participants`;

    // Resolve wallpaper & dimming
    const wpSelection = this.chat.wallpaper || defaultWp;
    const dimmingVal = this.chat.wallpaperDimming !== undefined ? this.chat.wallpaperDimming : defaultDimming;
    let wpBgStyle = '';

    if (wpSelection && typeof wpSelection === 'string') {
      if (wpSelection.startsWith('color:')) {
        wpBgStyle = `background-color: ${wpSelection.replace('color:', '')}; background-image: none;`;
      } else if (wpSelection !== 'default') {
        const preset = WALLPAPER_PRESETS.find((p) => p.id === wpSelection);
        if (preset && preset.file) {
          wpBgStyle = `background-image: url(${assetUrl(preset.file)});`;
        }
      }
    } else if (wpSelection instanceof Blob) {
      wpBgStyle = `background-image: url(${URL.createObjectURL(wpSelection)});`;
    }

    rootEl.innerHTML = `
      <div class="screen-view chat-screen ${wpBgStyle ? 'has-custom-wallpaper' : ''}" style="${wpBgStyle}">
        <!-- Wallpaper Dimming Layer -->
        <div class="chat-dimming-layer" style="background-color: rgba(0, 0, 0, ${dimmingVal / 100});"></div>

        <!-- Standard Chat App Bar (Material 3 flat) -->
        <header class="wa-app-bar chat-header flat-app-bar" id="chat-default-header">
          <div class="chat-header-left">
            <button type="button" class="app-bar-icon-btn" id="btn-chat-back" aria-label="Go back">${Icons.arrowBack('', 24)}</button>
            <div class="chat-header-info" id="chat-header-profile-btn">
              <div class="chat-header-avatar">
                ${this.chat.avatarBlob ? `<img src="${URL.createObjectURL(this.chat.avatarBlob)}" class="chat-avatar-img" alt="Avatar" />` : (this.chat.isGroup ? Icons.groupAvatar('', 38) : Icons.userAvatar('', 38))}
              </div>
              <div class="chat-header-text">
                <div class="chat-header-title" dir="auto">${this.chat.name}</div>
                <div class="chat-header-subtitle">${subtitle}</div>
              </div>
            </div>
          </div>
          
          <div class="chat-header-actions">
            <button type="button" class="app-bar-icon-btn" id="btn-chat-video-call" aria-label="Video Call">${Icons.callVideo('', 22)}</button>
            <button type="button" class="app-bar-icon-btn" id="btn-chat-voice-call" aria-label="Voice Call">${Icons.callVoice('', 22)}</button>
            <button type="button" class="app-bar-icon-btn" id="btn-chat-menu-more" aria-label="More options">${Icons.moreVert('', 22)}</button>
          </div>
        </header>

        <!-- 3-Dot Dropdown Menu (Cloned from @refrance14) -->
        <div class="wa-dropdown-menu chat-dropdown-menu" id="chat-dropdown-menu" style="display: none;">
          <div class="dropdown-item" id="menu-search-in-chat">
            <span class="dropdown-item-icon">${Icons.search('', 20)}</span>
            <span>Search in chat</span>
          </div>
          <div class="dropdown-item" id="menu-swap-perspective">
            <span class="dropdown-item-icon">${Icons.swap('', 20)}</span>
            <span>Swap Sender / Receiver</span>
          </div>
          <div class="dropdown-item" id="menu-jump-to-date">
            <span class="dropdown-item-icon">${Icons.calendar('', 20)}</span>
            <span>Jump to Date</span>
          </div>
          <div class="dropdown-item" id="menu-edit-chat-info">
            <span class="dropdown-item-icon">${Icons.userAvatar('', 20)}</span>
            <span>Edit Chat Info</span>
          </div>
          <div class="dropdown-item" id="menu-chat-wallpaper">
            <span class="dropdown-item-icon">${Icons.gallery('', 20)}</span>
            <span>Wallpaper</span>
          </div>
          <div class="dropdown-item danger-item" id="menu-clear-chat">
            <span class="dropdown-item-icon">${Icons.trash('', 20)}</span>
            <span class="danger-text">Clear chat</span>
          </div>
        </div>

        <input type="date" id="chat-date-picker" style="display: none;" />

        <!-- In-Chat Search Bar (Hidden by default) -->
        <div class="chat-search-bar" id="chat-search-header" style="display:none;">
          <button type="button" class="app-bar-icon-btn" id="btn-close-chat-search">${Icons.arrowBack('', 24)}</button>
          <input type="text" id="chat-search-query" placeholder="Search in chat..." />
          <span class="search-match-counter" id="search-match-count">0/0</span>
          <button type="button" class="app-bar-icon-btn" id="btn-search-prev">${Icons.chevronDown('rotate-180', 20)}</button>
          <button type="button" class="app-bar-icon-btn" id="btn-search-next">${Icons.chevronDown('', 20)}</button>
        </div>

        <!-- Messages Area -->
        <div class="chat-messages-container" id="chat-messages-wrap"></div>

        <!-- Floating Scroll-To-Bottom Button -->
        <button type="button" class="chat-scroll-bottom" id="chat-scroll-bottom-btn" title="Scroll to bottom">
          ${Icons.chevronDown('', 22)}
        </button>

        <!-- Bottom Input Bar -->
        <footer class="chat-input-bar">
          <div class="input-pill">
            <button type="button" class="input-icon-btn" aria-label="Emoji">${Icons.emoji('', 22)}</button>
            <textarea id="chat-input-textarea" placeholder="Message" rows="1" dir="auto"></textarea>
            <label class="input-icon-btn" title="Attach file">
              ${Icons.paperclip('', 22)}
              <input type="file" id="chat-attach-input" style="display:none;" />
            </label>
            <button type="button" class="input-icon-btn" id="btn-camera-snap" aria-label="Camera">${Icons.camera('', 22)}</button>
          </div>
          <button type="button" class="mic-send-btn" id="btn-mic-send" aria-label="Send or record audio">
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
              <button type="button" class="context-item" id="ctx-copy-text">Copy text</button>
              <button type="button" class="context-item" id="ctx-toggle-forward">Toggle "Forwarded"</button>
              <button type="button" class="context-item danger-text" id="ctx-delete-msg">Delete message</button>
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

    // Auto-open search if navigated from Contact Info "Search in chat"
    if (params.search === '1' || params.search === 'true') {
      setTimeout(() => this.toggleSearchHeader(true), 100);
    }
    if (params.jumpDate) {
      setTimeout(() => this.jumpToSelectedDate(params.jumpDate), 200);
    }

    // Profile Picture Subtle Scroll Animation in Header (Step 6)
    let scrollRafTicking = false;
    const headerAvatar = this.container.querySelector('.chat-header-avatar');
    messagesWrap.addEventListener('scroll', () => {
      if (!scrollRafTicking) {
        window.requestAnimationFrame(() => {
          const scrollTop = messagesWrap.scrollTop;
          const factor = Math.min(1, Math.max(0, scrollTop / 300));
          if (headerAvatar) {
            headerAvatar.style.transform = `scale(${1 - factor * 0.12})`;
          }
          scrollRafTicking = false;
        });
        scrollRafTicking = true;
      }
    }, { passive: true });

    // Header Back
    this.container.querySelector('#btn-chat-back').addEventListener('click', () => {
      this.router.navigate('#/chats');
    });

    // Profile Click -> Contact Info Screen 5
    this.container.querySelector('#chat-header-profile-btn').addEventListener('click', () => {
      this.router.navigate(`#/chat/${this.chatId}/info`);
    });

    // Video & Voice Call Actions (Task 6)
    const vidCallBtn = this.container.querySelector('#btn-chat-video-call');
    if (vidCallBtn) {
      vidCallBtn.addEventListener('click', () => {
        Toast.show(`Video calling ${this.chat.name}...`);
      });
    }

    const voiceCallBtn = this.container.querySelector('#btn-chat-voice-call');
    if (voiceCallBtn) {
      voiceCallBtn.addEventListener('click', () => {
        Toast.show(`Calling ${this.chat.name}...`);
      });
    }

    // 3-Dot Dropdown Menu Listeners (@refrance14)
    const moreMenuBtn = this.container.querySelector('#btn-chat-menu-more');
    const dropdownMenu = this.container.querySelector('#chat-dropdown-menu');
    if (moreMenuBtn && dropdownMenu) {
      moreMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#chat-dropdown-menu') && !e.target.closest('#btn-chat-menu-more')) {
          if (dropdownMenu) dropdownMenu.style.display = 'none';
        }
      });

      this.container.querySelector('#menu-search-in-chat')?.addEventListener('click', () => {
        dropdownMenu.style.display = 'none';
        this.toggleSearchHeader(true);
      });

      this.container.querySelector('#menu-swap-perspective')?.addEventListener('click', () => {
        dropdownMenu.style.display = 'none';
        this.flipPerspective();
      });

      this.container.querySelector('#menu-jump-to-date')?.addEventListener('click', () => {
        dropdownMenu.style.display = 'none';
        const dp = this.container.querySelector('#chat-date-picker') || this.container.querySelector('#chat-hidden-date-picker');
        if (dp) {
          if (typeof dp.showPicker === 'function') {
            dp.showPicker();
          } else {
            dp.click();
          }
        }
      });

      this.container.querySelector('#menu-edit-chat-info')?.addEventListener('click', () => {
        dropdownMenu.style.display = 'none';
        this.openEditChatModal();
      });

      this.container.querySelector('#menu-chat-wallpaper')?.addEventListener('click', () => {
        dropdownMenu.style.display = 'none';
        this.router.navigate('#/wallpaper-picker?chatId=' + this.chatId);
      });

      this.container.querySelector('#menu-clear-chat')?.addEventListener('click', () => {
        dropdownMenu.style.display = 'none';
        this.clearChatHistory();
      });
    }

    // Date picker for Jump to Date
    const datePicker = this.container.querySelector('#chat-date-picker') || this.container.querySelector('#chat-hidden-date-picker');
    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        if (e.target.value) {
          this.jumpToSelectedDate(e.target.value);
        }
      });
    }

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

    // File Attachment
    const attachInput = this.container.querySelector('#chat-attach-input');
    attachInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        await this.handleFileAttachment(file);
        attachInput.value = '';
      }
    });

    // Camera snap simulation
    this.container.querySelector('#btn-camera-snap').addEventListener('click', () => {
      attachInput.click();
    });
  }

  async sendNewMessage(text) {
    const newMsg = {
      id: db.generateUUID(),
      chatId: this.chatId,
      timestamp: Date.now(),
      sender: this.chat.isOutgoingDefault ? (this.chat.customMeName || 'Me') : this.chat.name,
      isOutgoing: true,
      text: text,
      mediaId: null,
      mediaName: null,
      mediaType: null
    };

    await db.saveMessage(newMsg);
    await db.updateChat(this.chatId, {
      lastMessage: text,
      updatedAt: Date.now()
    });

    this.scroller.allMessages.push(newMsg);
    const msgEl = await this.scroller.createMessageElement(newMsg);
    this.container.querySelector('#chat-messages-wrap').appendChild(msgEl);
    this.scroller.scrollToBottom(true);
  }

  async handleFileAttachment(file) {
    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';
    else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) type = 'pdf';

    const mediaId = db.generateUUID();
    const mediaItem = {
      id: mediaId,
      chatId: this.chatId,
      filename: file.name,
      type: type,
      size: file.size,
      blob: file,
      thumbnailBlob: null,
      timestamp: Date.now()
    };

    await db.saveMedia(mediaItem);

    const newMsg = {
      id: db.generateUUID(),
      chatId: this.chatId,
      timestamp: Date.now(),
      sender: this.chat.customMeName || 'Me',
      isOutgoing: true,
      text: '',
      mediaId: mediaId,
      mediaName: file.name,
      mediaType: type
    };

    await db.saveMessage(newMsg);
    await db.updateChat(this.chatId, {
      lastMessage: `📷 ${file.name}`,
      updatedAt: Date.now()
    });

    this.scroller.allMessages.push(newMsg);
    const msgEl = await this.scroller.createMessageElement(newMsg);
    this.container.querySelector('#chat-messages-wrap').appendChild(msgEl);
    this.scroller.scrollToBottom(true);
    Toast.show('File attached');
  }

  async flipPerspective() {
    const currentPerspective = this.chat.isOutgoingDefault ?? true;
    const newPerspective = !currentPerspective;

    const msgs = await db.getMessages(this.chatId);
    for (const m of msgs) {
      if (!m.isSystem) {
        m.isOutgoing = !m.isOutgoing;
        await db.updateMessage(m.id, { isOutgoing: m.isOutgoing });
      }
    }

    await db.updateChat(this.chatId, { isOutgoingDefault: newPerspective });
    this.chat.isOutgoingDefault = newPerspective;

    Toast.show('Perspective flipped: ' + (newPerspective ? 'You are Sender' : 'You are Receiver'));
    await this.scroller.loadInitial();
  }

  async jumpToSelectedDate(dateString) {
    const selectedDate = new Date(dateString);
    selectedDate.setHours(0, 0, 0, 0);

    const msgs = this.scroller.allMessages;
    let targetMsg = null;

    for (const m of msgs) {
      const msgDate = new Date(m.timestamp);
      msgDate.setHours(0, 0, 0, 0);
      if (msgDate.getTime() >= selectedDate.getTime()) {
        targetMsg = m;
        break;
      }
    }

    if (targetMsg) {
      await this.scroller.loadInitial(targetMsg.id);
      Toast.show(`Jumped to ${dateString}`);
    } else {
      Toast.show('No messages found around this date');
    }
  }

  bindSearchEvents() {
    const searchHeader = this.container.querySelector('#chat-search-header');
    const defaultHeader = this.container.querySelector('#chat-default-header');
    const searchInput = this.container.querySelector('#chat-search-query');
    const matchCountEl = this.container.querySelector('#search-match-count');
    const closeBtn = this.container.querySelector('#btn-close-chat-search');
    const prevBtn = this.container.querySelector('#btn-search-prev');
    const nextBtn = this.container.querySelector('#btn-search-next');

    closeBtn.addEventListener('click', () => {
      this.toggleSearchHeader(false);
    });

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        this.searchMatches = [];
        this.currentSearchMatchIndex = -1;
        matchCountEl.textContent = '0/0';
        return;
      }

      this.searchMatches = this.scroller.allMessages.filter((m) => {
        return (m.text && m.text.toLowerCase().includes(q)) ||
               (m.mediaName && m.mediaName.toLowerCase().includes(q));
      });

      if (this.searchMatches.length > 0) {
        this.currentSearchMatchIndex = this.searchMatches.length - 1;
        matchCountEl.textContent = `${this.currentSearchMatchIndex + 1}/${this.searchMatches.length}`;
        this.scroller.scrollToMessage(this.searchMatches[this.currentSearchMatchIndex].id);
      } else {
        this.currentSearchMatchIndex = -1;
        matchCountEl.textContent = '0/0';
      }
    });

    nextBtn.addEventListener('click', () => {
      if (this.searchMatches.length === 0) return;
      this.currentSearchMatchIndex = (this.currentSearchMatchIndex + 1) % this.searchMatches.length;
      matchCountEl.textContent = `${this.currentSearchMatchIndex + 1}/${this.searchMatches.length}`;
      this.scroller.scrollToMessage(this.searchMatches[this.currentSearchMatchIndex].id);
    });

    prevBtn.addEventListener('click', () => {
      if (this.searchMatches.length === 0) return;
      this.currentSearchMatchIndex = (this.currentSearchMatchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
      matchCountEl.textContent = `${this.currentSearchMatchIndex + 1}/${this.searchMatches.length}`;
      this.scroller.scrollToMessage(this.searchMatches[this.currentSearchMatchIndex].id);
    });
  }

  toggleSearchHeader(show) {
    const searchHeader = this.container.querySelector('#chat-search-header');
    const defaultHeader = this.container.querySelector('#chat-default-header');
    const searchInput = this.container.querySelector('#chat-search-query');

    if (show) {
      defaultHeader.style.display = 'none';
      searchHeader.style.display = 'flex';
      searchInput.focus();
    } else {
      searchHeader.style.display = 'none';
      defaultHeader.style.display = 'flex';
      searchInput.value = '';
      this.searchMatches = [];
      this.currentSearchMatchIndex = -1;
    }
  }

  openMessageContextMenu(msg, rowEl) {
    const overlay = this.container.querySelector('#msg-context-overlay');
    overlay.style.display = 'flex';

    // Highlight active reaction
    const reactButtons = overlay.querySelectorAll('.react-btn');
    reactButtons.forEach((btn) => {
      const emoji = btn.dataset.emoji;
      if (msg.reaction === emoji) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }

      btn.onclick = async () => {
        const clickedEmoji = btn.dataset.emoji;
        const newReaction = (msg.reaction === clickedEmoji) ? null : clickedEmoji;

        await db.updateMessage(msg.id, { reaction: newReaction });
        msg.reaction = newReaction;
        overlay.style.display = 'none';

        // Update ONLY this message's DOM node
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

    // Delete message (replaces native confirm with showConfirm)
    overlay.querySelector('#ctx-delete-msg').onclick = async () => {
      overlay.style.display = 'none';
      const confirmed = await showConfirm({
        title: 'Delete message?',
        message: 'Do you want to delete this message?',
        confirmText: 'Delete for me',
        cancelText: 'Cancel',
        isDanger: true
      });
      if (confirmed) {
        await db.deleteMessage(msg.id);
        this.scroller.loadInitial();
      }
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    };
  }

  async openEditChatModal() {
    const newName = await showPrompt({
      title: 'Edit Chat Name',
      message: 'Enter new name for this contact or group:',
      defaultValue: this.chat.name,
      placeholder: 'Chat name',
      confirmText: 'Save',
      cancelText: 'Cancel'
    });
    if (newName && newName.trim()) {
      await db.updateChat(this.chatId, { name: newName.trim() });
      this.chat.name = newName.trim();
      const titleEl = this.container.querySelector('.chat-header-title');
      if (titleEl) titleEl.textContent = newName.trim();
      Toast.show('Chat name updated');
    }
  }

  async clearChatHistory() {
    const msgs = await db.getMessages(this.chatId);
    if (msgs.length === 0) {
      Toast.show('Chat is already empty');
      return;
    }
    const confirmed = await showConfirm({
      title: 'Clear this chat?',
      message: 'Are you sure you want to clear all messages in this chat?',
      confirmText: 'Clear chat',
      cancelText: 'Cancel',
      isDanger: true
    });
    if (confirmed) {
      for (const m of msgs) await db.deleteMessage(m.id);
      await db.updateChat(this.chatId, { lastMessage: null, updatedAt: Date.now() });
      await this.scroller.loadInitial();
      Toast.show('Messages cleared');
    }
  }

  cleanup() {
    if (this.scroller) {
      this.scroller.cleanup();
    }
  }
}
