// Screen 4: Inside Chat View with Touch Fix, Scroll Animation & Material 3 Styling
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { VirtualMessageScroller } from '../virtual-scroller.js';
import { mediaLightbox } from '../components/lightbox.js';
import { Toast } from '../components/toast.js';
import { showConfirm, showAlert, showPrompt, showLoadingDialog } from '../components/custom-dialog.js';
import { WALLPAPER_PRESETS } from '../config/wallpapers.js';
import { assetUrl } from '../config/base-path.js';
import { VoiceRecorder } from '../components/voice-recorder.js';
import { MediaEditorModal } from '../components/media-editor-modal.js';
import { StickerDrawer } from '../components/sticker-drawer.js';
import { Motion } from '../ui-motion.js';
import { ForwardPicker, forwardMessagesToChats } from '../components/forward-picker.js';
import { PinDurationPicker } from '../components/pin-duration-picker.js';
import { PinnedPanel } from '../components/pinned-panel.js';
import { ReactionBar } from '../components/reaction-bar.js';
import { EmojiPickerSheet } from '../components/emoji-picker-sheet.js';
import { MessageInfoSheet } from '../components/message-info-sheet.js';
import { ShareOptionsModal } from '../components/share-options-modal.js';

export class ChatView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.chatId = null;
    this.chat = null;
    this.scroller = null;
    this.searchMatches = [];
    this.currentSearchMatchIndex = -1;
    this.selectedMessageIds = new Set();
    this.isSelectionMode = false;
    this.replyingTo = null;
    this.chatPins = [];
    this.pinPriorityMode = { mode: 'last_added', mixedDays: 7, switcherSeconds: 10 };
    this.pinnedBarDismissed = false;
    this.switcherInterval = null;
    this.switcherIndex = 0;
    this.reactionBar = null;
    this.emojiPickerSheet = null;
    this.messageInfoSheet = null;
    this.stickerDrawer = null;
    this._onResize = null;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.chatId = params.id;
    this.chat = await db.getChat(this.chatId);

    if (!this.chat) {
      rootEl.innerHTML = `<div class="empty-state">Chat not found. <a href="#/chats">Go back</a></div>`;
      return;
    }

    // Automatically mark chat as read upon opening
    if (this.chat.unreadCount > 0 || this.chat.isMarkedUnread) {
      await db.updateChat(this.chatId, { unreadCount: 0, isMarkedUnread: false });
      this.chat.unreadCount = 0;
      this.chat.isMarkedUnread = false;
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
        const preset = WALLPAPER_PRESETS.find((p) => p.id === wpSelection || p.file === wpSelection);
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

        <!-- Chat Message Selection Bar (WhatsApp Native Responsive) -->
        <header class="wa-app-bar chat-header selection-bar" id="chat-selection-header" style="display: none;">
          <div class="selection-header-left">
            <button type="button" class="app-bar-icon-btn" id="btn-cancel-msg-select" aria-label="Cancel selection">${Icons.arrowBack('', 24)}</button>
            <div class="selection-count-title" id="chat-select-count">1</div>
          </div>
          <div class="selection-spacer"></div>
          <div class="selection-tools-bar" id="selection-tools-bar">
            <!-- Dynamically populated responsive tools -->
          </div>
          <div class="selection-overflow-wrap" id="selection-overflow-wrap" style="display: none;">
            <button type="button" class="app-bar-icon-btn" id="btn-selection-overflow" title="More options" aria-label="More options">
              ${Icons.moreVert('', 20)}
            </button>
            <div class="wa-dropdown-menu selection-overflow-menu" id="selection-overflow-menu" style="display: none;">
              <!-- Dynamically populated overflow items -->
            </div>
          </div>
        </header>

        <!-- 3-Dot Dropdown Menu (Cloned from @refrance14) -->
        <div class="wa-dropdown-menu chat-dropdown-menu" id="chat-dropdown-menu" style="display: none;">
          <div class="dropdown-item" id="menu-search-in-chat">
            <span class="dropdown-item-icon">${Icons.search('', 20)}</span>
            <span>Search in chat</span>
          </div>
          <div class="dropdown-item" id="menu-pinned-messages">
            <span class="dropdown-item-icon">${Icons.pin('', 20)}</span>
            <span>Pinned messages</span>
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

        <!-- Pinned Message Bar (WhatsApp Native Single Line Bar) -->
        <div class="chat-pinned-bar" id="chat-pinned-bar" style="display:none;">
          <div class="pinned-bar-pin-icon">${Icons.pin('', 18)}</div>
          <div class="pinned-bar-content" id="pinned-bar-content">
            <div class="pinned-bar-label" id="pinned-bar-label">Pinned message</div>
            <div class="pinned-bar-snippet" id="pinned-bar-snippet"></div>
          </div>
          <button type="button" class="pinned-bar-close" id="pinned-bar-close" aria-label="Dismiss pinned bar">${Icons.close('', 18)}</button>
        </div>

        <!-- Messages Area -->
        <div class="chat-messages-container" id="chat-messages-wrap"></div>

        <!-- Floating Scroll-To-Bottom Button -->
        <button type="button" class="chat-scroll-bottom" id="chat-scroll-bottom-btn" title="Scroll to bottom">
          ${Icons.chevronDown('', 22)}
        </button>

        <!-- Reply Preview Banner (above input bar) -->
        <div class="chat-reply-preview-banner" id="chat-reply-banner" style="display: none;"></div>

        <!-- Bottom Input Bar -->
        <footer class="chat-input-bar" id="chat-default-input-bar">
          <div class="input-pill" id="chat-input-pill">
            <div class="chat-input-drag-handle" id="chat-input-drag-handle" style="display: none;" aria-label="Drag to resize message input">
              <div class="chat-input-drag-dash"></div>
            </div>
            <div class="chat-input-fs-header" id="chat-input-fs-header" style="display: none;">
              <button type="button" class="app-bar-icon-btn chat-input-fs-back-btn" id="btn-chat-input-fs-back" aria-label="Exit fullscreen">
                ${Icons.arrowBack('', 22)}
              </button>
              <span class="chat-input-fs-title">Message</span>
            </div>
            <div class="input-pill-main-row">
              <button type="button" class="input-icon-btn" id="btn-open-stickers" aria-label="Stickers">${Icons.sticker('', 22)}</button>
              <textarea id="chat-input-textarea" placeholder="Message" rows="1" dir="auto"></textarea>
              <label class="input-icon-btn" id="btn-gallery-attach" title="Attach file or photo">
                ${Icons.paperclip('', 22)}
                <input type="file" id="chat-gallery-input" accept="image/*,video/*" multiple style="display:none;" />
              </label>
              <button type="button" class="input-icon-btn" id="btn-camera-snap" aria-label="Camera">${Icons.camera('', 22)}</button>
              <input type="file" id="chat-camera-input" accept="image/*" capture="environment" style="display:none;" />
            </div>
          </div>
          <button type="button" class="mic-send-btn" id="btn-mic-send" aria-label="Send or record audio">
            ${Icons.mic('mic-icon', 22)}
          </button>
        </footer>

        <!-- Holding Voice Recording Bar (@refrance 1 & 2) -->
        <div class="chat-voice-holding-bar" id="chat-voice-holding-bar" style="display: none;">
          <div class="voice-holding-left">
            <span class="voice-red-mic-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#ef4444">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </span>
            <span class="voice-holding-timer" id="voice-holding-timer">0:00</span>
          </div>
          <div class="voice-holding-slide" id="voice-holding-slide">
            <span class="slide-chevron">&lt;</span>
            <span class="slide-text">Slide to cancel</span>
          </div>
          <div class="voice-holding-mic-space"></div>
        </div>

        <!-- Floating Lock Capsule above mic button (@refrance 1 & 2) -->
        <div class="voice-lock-capsule" id="voice-lock-capsule" style="display: none;">
          <div class="lock-icon-wrap">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </div>
          <div class="lock-chevron-wrap">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
            </svg>
          </div>
        </div>

        <!-- Locked Voice Recording Bar (@refrance 3) -->
        <div class="chat-voice-locked-bar" id="chat-voice-locked-bar" style="display: none;">
          <div class="voice-locked-top">
            <div class="voice-locked-timer" id="voice-locked-timer">0:00</div>
            <div class="voice-locked-waveform" id="voice-locked-waveform">
              <span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span>
              <span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span>
              <span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span>
              <span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span>
              <span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span><span class="v-dot"></span>
            </div>
            <!-- Audio Playback Preview while Paused -->
            <div class="voice-locked-preview" id="voice-locked-preview" style="display: none;">
              <button type="button" class="voice-preview-play-btn" id="btn-voice-preview-play" aria-label="Play recording preview">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" id="icon-preview-play-svg">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
              <div class="voice-preview-track-wrap" id="voice-preview-track">
                <div class="voice-preview-progress-bar" id="voice-preview-progress" style="width: 0%;"></div>
              </div>
              <span class="voice-preview-time" id="voice-preview-time">0:00</span>
            </div>
          </div>
          <div class="voice-locked-bottom">
            <button type="button" class="voice-btn-discard" id="btn-voice-discard" aria-label="Discard recording">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
            <button type="button" class="voice-btn-pause-resume" id="btn-voice-pause-resume" aria-label="Pause or Resume">
              <span class="pause-bars">||</span>
              <span class="pause-label">Pause</span>
            </button>
            <button type="button" class="voice-btn-send" id="btn-voice-send" aria-label="Send voice message">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Hidden Date Picker for Jump To Date -->
        <input type="date" id="chat-hidden-date-picker" style="display:none;" />
      </div>
    `;

    await this.bindEvents(outgoingTheme, targetMsgId, params);
  }

  async bindEvents(outgoingTheme, targetMsgId, params = {}) {
    const messagesWrap = this.container.querySelector('#chat-messages-wrap');

    // Initialize Floating Reaction Bar & Sheets
    this.reactionBar = new ReactionBar({
      onReact: async (msgId, emoji) => {
        if (!msgId) return;
        await db.updateMessage(msgId, { reaction: emoji });
        const m = this.scroller?.allMessages.find((x) => String(x.id) === String(msgId));
        if (m) m.reaction = emoji;
        this.scroller?.updateMessageReactionDOM(msgId, emoji);
      },
      onOpenPicker: (msgId) => {
        if (!msgId) return;
        this.reactionBar?.hide();
        this.scroller?.scrollMessageAboveSheet(msgId, 60);
        this.emojiPickerSheet?.open(async (chosenEmoji) => {
          await db.updateMessage(msgId, { reaction: chosenEmoji });
          const m = this.scroller?.allMessages.find((x) => String(x.id) === String(msgId));
          if (m) m.reaction = chosenEmoji;
          this.scroller?.updateMessageReactionDOM(msgId, chosenEmoji);
        });
      }
    });

    this.emojiPickerSheet = new EmojiPickerSheet();
    this.messageInfoSheet = new MessageInfoSheet();

    // Initialize Virtual Message Scroller
    this.scroller = new VirtualMessageScroller(messagesWrap, {
      chatId: this.chatId,
      chat: this.chat,
      outgoingTheme,
      onMediaClick: (mediaItem, msg) => {
        if (this.isSelectionMode) {
          this.reactionBar?.hide();
          this.toggleMessageSelection(msg.id);
          return;
        }
        mediaLightbox.show(mediaItem, msg, (cId, mId) => {
          this.scroller.scrollToMessage(mId);
        });
      },
      onMessageClick: (msg, rowEl, evt) => {
        if (this.isSelectionMode) {
          evt?.stopPropagation();
          this.reactionBar?.hide();
          this.toggleMessageSelection(msg.id, rowEl);
        }
      },
      onMessageAction: (msg, rowEl, evt) => {
        this._handleMessageLongPress(msg, rowEl, evt);
      },
      onMessageLongPress: (msg, rowEl, evt) => {
        this._handleMessageLongPress(msg, rowEl, evt);
      },
      onMessageTapInSelection: (msg, rowEl, evt) => {
        evt?.stopPropagation();
        this.reactionBar?.hide();
        this.toggleMessageSelection(msg.id, rowEl);
      },
      onMessageReply: (msg) => {
        if (!this.isSelectionMode) this.startReply(msg);
      },
      onQuotedMessageClick: async (targetId) => {
        const found = await this.scroller.scrollToMessage(targetId);
        if (!found) Toast.show('Original message not found');
      }
    });

    await this.scroller.loadInitial(targetMsgId);
    await this.loadAndRenderPins();

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
      this.router.back();
    });

    // Message Selection Header Actions
    this.container.querySelector('#btn-cancel-msg-select')?.addEventListener('click', () => {
      this.exitSelectionMode();
    });

    const overflowBtn = this.container.querySelector('#btn-selection-overflow');
    const overflowMenu = this.container.querySelector('#selection-overflow-menu');
    overflowBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = overflowMenu.style.display !== 'none';
      overflowMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (overflowMenu && overflowMenu.style.display !== 'none' && !e.target.closest('#selection-overflow-wrap')) {
        overflowMenu.style.display = 'none';
      }
    });

    this._onResize = () => {
      if (this.isSelectionMode) {
        this.updateMessageSelectionBar();
      }
    };
    window.addEventListener('resize', this._onResize);

    // Pinned Message Bar Click -> Open Panel
    const pinnedBar = this.container.querySelector('#chat-pinned-bar');
    if (pinnedBar) {
      pinnedBar.addEventListener('click', (e) => {
        if (e.target.closest('#pinned-bar-close')) return;
        this.openPinnedPanel();
      });
    }

    // Pinned Message Bar Close Button -> Session Dismiss
    const pinnedBarClose = this.container.querySelector('#pinned-bar-close');
    if (pinnedBarClose) {
      pinnedBarClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pinnedBarDismissed = true;
        this.renderPinnedBar();
      });
    }

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
        if (Motion.isMenuOpen(dropdownMenu)) Motion.closeMenu(dropdownMenu); else Motion.openMenu(dropdownMenu, moreMenuBtn);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#chat-dropdown-menu') && !e.target.closest('#btn-chat-menu-more')) {
          if (dropdownMenu) Motion.closeMenu(dropdownMenu);
        }
      });

      this.container.querySelector('#menu-search-in-chat')?.addEventListener('click', () => {
        Motion.closeMenu(dropdownMenu);
        this.toggleSearchHeader(true);
      });

      this.container.querySelector('#menu-pinned-messages')?.addEventListener('click', () => {
        Motion.closeMenu(dropdownMenu);
        this.openPinnedPanel();
      });

      this.container.querySelector('#menu-swap-perspective')?.addEventListener('click', () => {
        Motion.closeMenu(dropdownMenu);
        this.flipPerspective();
      });

      this.container.querySelector('#menu-jump-to-date')?.addEventListener('click', () => {
        Motion.closeMenu(dropdownMenu);
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
        Motion.closeMenu(dropdownMenu);
        this.openEditChatModal();
      });

      this.container.querySelector('#menu-chat-wallpaper')?.addEventListener('click', () => {
        Motion.closeMenu(dropdownMenu);
        this.router.navigate('#/wallpaper-picker?chatId=' + this.chatId);
      });

      this.container.querySelector('#menu-clear-chat')?.addEventListener('click', () => {
        Motion.closeMenu(dropdownMenu);
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
    const scrollBottomBtn = this.container.querySelector('#chat-scroll-bottom-btn');
    if (scrollBottomBtn) {
      scrollBottomBtn.addEventListener('click', () => {
        this.scroller?.scrollToBottom(true);
      });
    }

    // In-Chat Search bar events
    this.bindSearchEvents();

    // Sticker / Emoji left-icon button (swaps icon based on typing state)
    const stickerBtn = this.container.querySelector('#btn-open-stickers');
    if (stickerBtn) {
      stickerBtn.dataset.mode = 'sticker'; // 'sticker' | 'emoji'

      stickerBtn.addEventListener('click', () => {
        if (stickerBtn.dataset.mode === 'emoji') {
          // Open emoji picker
          if (!this.emojiPickerSheet) {
            this.emojiPickerSheet = new EmojiPickerSheet();
          }
          this.emojiPickerSheet.open(async (chosenEmoji) => {
            const textarea2 = this.container.querySelector('#chat-input-textarea');
            if (textarea2) {
              const start = textarea2.selectionStart;
              const end = textarea2.selectionEnd;
              const val = textarea2.value;
              textarea2.value = val.slice(0, start) + chosenEmoji + val.slice(end);
              textarea2.selectionStart = textarea2.selectionEnd = start + chosenEmoji.length;
              textarea2.dispatchEvent(new Event('input'));
              textarea2.focus();
            }
          });
        } else {
          if (!this.stickerDrawer) {
            this.stickerDrawer = new StickerDrawer({
              onSelectSticker: (blobOrUrl, name) => {
                this.sendStickerMessage(blobOrUrl, name);
              }
            });
          }
          this.stickerDrawer.open();
        }
      });
    }

    // Camera input & Gallery input
    const cameraInput = this.container.querySelector('#chat-camera-input');
    const galleryInput = this.container.querySelector('#chat-gallery-input');
    const cameraBtn = this.container.querySelector('#btn-camera-snap');

    if (cameraBtn && cameraInput) {
      cameraBtn.addEventListener('click', () => {
        cameraInput.click();
      });
      cameraInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.openMediaEditor(Array.from(e.target.files));
          cameraInput.value = '';
        }
      });
    }

    if (galleryInput) {
      galleryInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.openMediaEditor(Array.from(e.target.files));
          galleryInput.value = '';
        }
      });
    }

    // Input text & Send / Mic button behavior + 10-line auto-grow & drag resize
    const inputBar = this.container.querySelector('#chat-default-input-bar');
    const inputPill = this.container.querySelector('#chat-input-pill');
    const dragHandle = this.container.querySelector('#chat-input-drag-handle');
    const fsHeader = this.container.querySelector('#chat-input-fs-header');
    const fsBackBtn = this.container.querySelector('#btn-chat-input-fs-back');
    const textarea = this.container.querySelector('#chat-input-textarea');
    const sendBtn = this.container.querySelector('#btn-mic-send');

    // Left icon (sticker ↔ emoji) + right icon (mic ↔ send) swap on typing
    const leftBtn = this.container.querySelector('#btn-open-stickers');
    const _stickerIconHTML = leftBtn ? leftBtn.innerHTML : '';
    const _emojiIconHTML = Icons.emoji ? Icons.emoji('', 22) : _stickerIconHTML;

    let manualPillHeightPx = null;
    let isFullscreen = false;
    let isDraggingInput = false;

    const getViewportHeight = () => {
      const vvh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      return Math.max(240, Math.min(window.innerHeight || vvh, vvh || window.innerHeight));
    };

    const measureNaturalMetrics = () => {
      const style = window.getComputedStyle(textarea);
      let lineHeight = parseFloat(style.lineHeight);
      if (Number.isNaN(lineHeight) || style.lineHeight === 'normal') {
        const fontSize = parseFloat(style.fontSize) || 16;
        lineHeight = fontSize * 1.35;
      }
      const padTop = parseFloat(style.paddingTop) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;
      const oneLineHeight = Math.ceil(lineHeight + padTop + padBottom);
      const max10LinesHeight = Math.ceil(lineHeight * 10 + padTop + padBottom);
      const viewportCap = Math.max(oneLineHeight * 2, Math.floor(getViewportHeight() * 0.75) - 48);
      const maxAutoTextareaHeight = Math.min(max10LinesHeight, viewportCap);

      // Measure true wrapped content height even while manually resized or in fullscreen
      const prevHeight = textarea.style.height;
      const prevMinHeight = textarea.style.minHeight;
      const prevAlignSelf = textarea.style.alignSelf;
      textarea.style.alignSelf = 'flex-start';
      textarea.style.minHeight = '0px';
      textarea.style.height = '1px';
      const rawScrollHeight = textarea.scrollHeight;
      textarea.style.height = prevHeight;
      textarea.style.minHeight = prevMinHeight;
      textarea.style.alignSelf = prevAlignSelf;

      const clampedTextareaHeight = Math.max(
        oneLineHeight,
        Math.min(rawScrollHeight, maxAutoTextareaHeight)
      );
      const needsInternalScroll = rawScrollHeight > maxAutoTextareaHeight + 1;

      const handleVisible = dragHandle && dragHandle.style.display !== 'none';
      const handleHeight = handleVisible ? (dragHandle.offsetHeight || 14) : 0;
      const pillStyle = inputPill ? window.getComputedStyle(inputPill) : null;
      const pillPadV = pillStyle
        ? (parseFloat(pillStyle.paddingTop) || 0) + (parseFloat(pillStyle.paddingBottom) || 0)
        : 8;
      const basePillPadV = isFullscreen ? 8 : Math.max(8, pillPadV);
      const naturalPillHeight = Math.max(48, Math.ceil(clampedTextareaHeight + handleHeight + basePillPadV));

      return {
        clampedTextareaHeight,
        needsInternalScroll,
        naturalPillHeight
      };
    };

    const setFullscreenState = (nextFullscreen, notifyRouter = true) => {
      if (isFullscreen === nextFullscreen) return;
      isFullscreen = nextFullscreen;
      if (inputBar) {
        inputBar.classList.toggle('is-input-fullscreen', isFullscreen);
      }
      if (isFullscreen) {
        if (this.router && typeof this.router.pushOverlay === 'function') {
          this.router.pushOverlay('chat-input-fullscreen', () => {
            manualPillHeightPx = null;
            setFullscreenState(false, false);
            updateInputLayout();
          });
        }
      } else if (notifyRouter && this.router && typeof this.router.removeOverlay === 'function') {
        this.router.removeOverlay('chat-input-fullscreen');
      }
    };

    const updateInputLayout = () => {
      if (!textarea || !document.body.contains(textarea)) return;
      const hasRawText = textarea.value.length > 0;
      const hasSendableText = textarea.value.trim().length > 0;

      // Right button: mic ↔ send
      if (hasSendableText) {
        sendBtn.innerHTML = Icons.send('', 22);
        sendBtn.classList.add('is-send');
      } else {
        sendBtn.innerHTML = Icons.mic('mic-icon', 22);
        sendBtn.classList.remove('is-send');
      }

      // Left button: sticker ↔ emoji icon
      if (leftBtn) {
        leftBtn.innerHTML = hasSendableText ? _emojiIconHTML : _stickerIconHTML;
        leftBtn.dataset.mode = hasSendableText ? 'emoji' : 'sticker';
        leftBtn.setAttribute('aria-label', hasSendableText ? 'Emoji' : 'Stickers');
      }

      // Hide camera & reveal drag dash as soon as typing begins
      if (cameraBtn) {
        cameraBtn.style.display = hasRawText ? 'none' : '';
      }
      if (dragHandle) {
        dragHandle.style.display = (hasRawText || isFullscreen || isDraggingInput) ? 'flex' : 'none';
      }

      if (!hasRawText && !isDraggingInput) {
        manualPillHeightPx = null;
        if (isFullscreen) {
          setFullscreenState(false, true);
        }
      }

      const { clampedTextareaHeight, needsInternalScroll, naturalPillHeight } = measureNaturalMetrics();

      if (isDraggingInput) {
        return;
      }

      if (isFullscreen) {
        if (inputPill) {
          inputPill.classList.remove('is-manual-size');
          inputPill.style.height = '';
        }
        textarea.style.height = '';
        textarea.style.overflowY = 'auto';
        return;
      }

      if (manualPillHeightPx !== null) {
        if (naturalPillHeight >= manualPillHeightPx) {
          // Typed text reached manual height -> seamlessly return to auto-grow (up to 10 lines)
          manualPillHeightPx = null;
        } else {
          if (inputPill) {
            inputPill.classList.add('is-manual-size');
            inputPill.style.height = `${manualPillHeightPx}px`;
          }
          textarea.style.height = '';
          textarea.style.overflowY = 'auto';
          return;
        }
      }

      // Auto-grow up to 10 lines, then internal scroll
      if (inputPill) {
        inputPill.classList.remove('is-manual-size');
        inputPill.style.height = '';
      }
      if (!hasRawText) {
        textarea.style.height = '';
        textarea.style.overflowY = 'hidden';
      } else {
        textarea.style.height = `${clampedTextareaHeight}px`;
        textarea.style.overflowY = needsInternalScroll ? 'auto' : 'hidden';
      }
    };

    const startInputDrag = (e, fromFsHeader = false) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      if (fromFsHeader && e.target.closest('button')) return;
      if (!inputPill) return;

      const startY = e.clientY;
      const startPillHeight = inputPill.getBoundingClientRect().height;
      let dragActivated = !fromFsHeader;
      let latestPillHeight = startPillHeight;
      let latestRatio = startPillHeight / getViewportHeight();

      if (dragActivated) {
        e.preventDefault();
        isDraggingInput = true;
        inputBar?.classList.add('is-input-dragging');
        inputPill.classList.add('is-manual-size');
        inputPill.style.height = `${Math.round(startPillHeight)}px`;
        textarea.style.height = '';
        textarea.style.overflowY = 'auto';
      }

      const cleanupListeners = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        this._cleanupInputDrag = null;
      };

      const onPointerMove = (moveEvent) => {
        const dy = startY - moveEvent.clientY;
        if (!dragActivated) {
          if (Math.abs(dy) < 4) return;
          dragActivated = true;
          isDraggingInput = true;
          inputBar?.classList.add('is-input-dragging');
          inputPill.classList.add('is-manual-size');
          inputPill.style.height = `${Math.round(startPillHeight)}px`;
          textarea.style.height = '';
          textarea.style.overflowY = 'auto';
        }
        moveEvent.preventDefault();

        const vhPx = getViewportHeight();
        const { naturalPillHeight } = measureNaturalMetrics();
        const targetHeight = Math.max(naturalPillHeight, Math.min(vhPx, startPillHeight + dy));
        latestPillHeight = targetHeight;
        latestRatio = targetHeight / vhPx;

        setFullscreenState(latestRatio >= 0.8, true);

        inputPill.classList.add('is-manual-size');
        inputPill.style.height = `${Math.round(targetHeight)}px`;
      };

      const onPointerUp = () => {
        cleanupListeners();
        if (!dragActivated) return;

        isDraggingInput = false;
        inputBar?.classList.remove('is-input-dragging');

        const { naturalPillHeight } = measureNaturalMetrics();
        if (latestRatio >= 0.8) {
          manualPillHeightPx = null;
          setFullscreenState(true, true);
        } else {
          setFullscreenState(false, true);
          manualPillHeightPx = latestPillHeight <= naturalPillHeight + 4
            ? null
            : Math.round(latestPillHeight);
        }
        updateInputLayout();
      };

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      this._cleanupInputDrag = cleanupListeners;
    };

    if (dragHandle) {
      dragHandle.addEventListener('pointerdown', (e) => startInputDrag(e, false));
    }
    if (fsHeader) {
      fsHeader.addEventListener('pointerdown', (e) => startInputDrag(e, true));
    }
    if (fsBackBtn) {
      fsBackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        manualPillHeightPx = null;
        setFullscreenState(false, true);
        updateInputLayout();
      });
    }

    this._onInputResize = () => updateInputLayout();
    window.addEventListener('resize', this._onInputResize);
    window.visualViewport?.addEventListener('resize', this._onInputResize);

    textarea.addEventListener('input', updateInputLayout);

    sendBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (text) {
        this.sendNewMessage(text);
        textarea.value = '';
        manualPillHeightPx = null;
        setFullscreenState(false, true);
        updateInputLayout();
      }
    });

    // Voice Recorder Setup (Long Press, Swipe up to lock, Pause/Resume, Discard)
    this.setupVoiceRecording();
  }

  setupVoiceRecording() {
    const sendBtn = this.container.querySelector('#btn-mic-send');
    const textarea = this.container.querySelector('#chat-input-textarea');
    const normalBar = this.container.querySelector('#chat-default-input-bar');
    const holdingBar = this.container.querySelector('#chat-voice-holding-bar');
    const holdingTimer = this.container.querySelector('#voice-holding-timer');
    const holdingSlide = this.container.querySelector('#voice-holding-slide');
    const lockCapsule = this.container.querySelector('#voice-lock-capsule');
    const lockedBar = this.container.querySelector('#chat-voice-locked-bar');
    const lockedTimer = this.container.querySelector('#voice-locked-timer');
    const waveformRow = this.container.querySelector('#voice-locked-waveform');
    const previewRow = this.container.querySelector('#voice-locked-preview');
    const discardBtn = this.container.querySelector('#btn-voice-discard');
    const pauseResumeBtn = this.container.querySelector('#btn-voice-pause-resume');
    const lockedSendBtn = this.container.querySelector('#btn-voice-send');

    let startX = 0;
    let startY = 0;
    let isHolding = false;
    let isLocked = false;
    let isCancelled = false;

    this.voiceRecorder = new VoiceRecorder({
      onLocked: () => {
        isLocked = true;
        isHolding = false;
        normalBar.style.display = 'none';
        holdingBar.style.display = 'none';
        lockCapsule.style.display = 'none';
        lockedBar.style.display = 'flex';
        this.stopPreviewAudio();
        if (previewRow) previewRow.style.display = 'none';
        if (waveformRow) waveformRow.style.display = 'flex';
        pauseResumeBtn.innerHTML = '<span class="pause-bars">||</span> <span class="pause-label">Pause</span>';
      },
      onUpdateTimer: (sec) => {
        const formatted = VoiceRecorder.formatDuration(sec);
        if (holdingTimer) holdingTimer.textContent = formatted;
        if (lockedTimer) lockedTimer.textContent = formatted;
      },
      onSend: async (audioBlob, duration) => {
        this.resetVoiceUI();
        await this.sendVoiceNoteMessage(audioBlob, duration);
      },
      onDiscard: () => {
        this.resetVoiceUI();
      }
    });

    const onPointerDown = async (e) => {
      // If textarea has text, sendBtn acts as regular text send button
      if (sendBtn.classList.contains('is-send') || textarea.value.trim().length > 0) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      e.preventDefault();
      try {
        sendBtn.setPointerCapture(e.pointerId);
      } catch (err) { }

      startX = e.clientX;
      startY = e.clientY;
      isHolding = true;
      isLocked = false;
      isCancelled = false;

      // Switch UI immediately into holding recording state
      normalBar.style.display = 'none';
      holdingBar.style.display = 'flex';
      lockCapsule.style.display = 'flex';
      lockCapsule.classList.remove('active');
      holdingSlide.style.transform = '';
      holdingTimer.textContent = '0:00';
      sendBtn.classList.add('recording-active');

      const started = await this.voiceRecorder.start();
      if (!started) {
        this.resetVoiceUI();
        isHolding = false;
        try {
          sendBtn.releasePointerCapture(e.pointerId);
        } catch (err) { }
        return;
      }
    };

    const onPointerMove = async (e) => {
      if (!isHolding || isLocked || isCancelled || !this.voiceRecorder.isRecording) return;
      const currentX = e.clientX;
      const currentY = e.clientY;
      const deltaX = currentX - startX;
      const deltaY = startY - currentY; // Upward drag is positive

      // Slide left to cancel
      if (deltaX < 0) {
        const clampedTranslate = Math.max(-80, deltaX);
        holdingSlide.style.transform = `translateX(${clampedTranslate}px)`;

        // Cancel threshold: dragged left by 65px or more
        if (deltaX <= -65) {
          isCancelled = true;
          isHolding = false;
          try {
            sendBtn.releasePointerCapture(e.pointerId);
          } catch (err) { }
          await this.voiceRecorder.stop(false);
          this.resetVoiceUI();
          Toast.show('Recording cancelled');
          return;
        }
      } else {
        holdingSlide.style.transform = '';
      }

      // Slide up to lock
      if (deltaY > 0) {
        if (deltaY >= 35) {
          lockCapsule.classList.add('active');
        } else {
          lockCapsule.classList.remove('active');
        }

        // Lock threshold: dragged up by 48px or more
        if (deltaY >= 48) {
          isHolding = false;
          isLocked = true;
          try {
            sendBtn.releasePointerCapture(e.pointerId);
          } catch (err) { }
          this.voiceRecorder.lock();
          return;
        }
      } else {
        lockCapsule.classList.remove('active');
      }
    };

    const onPointerUp = async (e) => {
      if (!isHolding || isLocked || isCancelled) return;
      isHolding = false;

      try {
        sendBtn.releasePointerCapture(e.pointerId);
      } catch (err) { }

      if (this.voiceRecorder.isRecording) {
        const recordingDuration = (Date.now() - this.voiceRecorder.startTime) / 1000;
        if (recordingDuration >= 0.8) {
          await this.voiceRecorder.stop(true);
        } else {
          await this.voiceRecorder.stop(false);
          Toast.show('Hold to record, release to send');
        }
      }
      this.resetVoiceUI();
    };

    const onPointerCancel = async (e) => {
      if (!isHolding || isLocked) return;
      isHolding = false;
      try {
        sendBtn.releasePointerCapture(e.pointerId);
      } catch (err) { }
      await this.voiceRecorder.stop(false);
      this.resetVoiceUI();
    };

    sendBtn.addEventListener('pointerdown', onPointerDown);
    sendBtn.addEventListener('pointermove', onPointerMove);
    sendBtn.addEventListener('pointerup', onPointerUp);
    sendBtn.addEventListener('pointercancel', onPointerCancel);

    // Discard button in locked panel
    discardBtn.addEventListener('click', async () => {
      this.stopPreviewAudio();
      await this.voiceRecorder.stop(false);
      this.resetVoiceUI();
      Toast.show('Recording discarded');
    });

    // Pause / Resume button in locked panel
    pauseResumeBtn.addEventListener('click', async () => {
      if (this.voiceRecorder.isPaused) {
        // Resume recording
        this.stopPreviewAudio();
        this.voiceRecorder.resume();
        if (previewRow) previewRow.style.display = 'none';
        if (waveformRow) waveformRow.style.display = 'flex';
        pauseResumeBtn.innerHTML = '<span class="pause-bars">||</span> <span class="pause-label">Pause</span>';
      } else {
        // Pause recording & show playback preview
        this.voiceRecorder.pause();
        pauseResumeBtn.innerHTML = '<span class="pause-bars">▶</span> <span class="pause-label">Resume</span>';
        if (waveformRow) waveformRow.style.display = 'none';
        if (previewRow) previewRow.style.display = 'flex';
        await this.setupPreviewAudio();
      }
    });

    // Send button in locked panel
    lockedSendBtn.addEventListener('click', async () => {
      this.stopPreviewAudio();
      await this.voiceRecorder.stop(true);
      this.resetVoiceUI();
    });
  }

  async setupPreviewAudio() {
    this.stopPreviewAudio();
    const blob = this.voiceRecorder ? await this.voiceRecorder.getPreviewBlob() : null;
    if (!blob || blob.size === 0) return;

    try {
      const url = URL.createObjectURL(blob);
      this.previewAudio = new Audio(url);
      const totalSeconds = this.voiceRecorder.elapsedSeconds || 1;

      const playBtn = this.container.querySelector('#btn-voice-preview-play');
      const playIconSvg = this.container.querySelector('#icon-preview-play-svg');
      const progressBar = this.container.querySelector('#voice-preview-progress');
      const timeEl = this.container.querySelector('#voice-preview-time');

      if (timeEl) timeEl.textContent = VoiceRecorder.formatDuration(totalSeconds);
      if (progressBar) progressBar.style.width = '0%';
      if (playIconSvg) playIconSvg.innerHTML = '<path d="M8 5v14l11-7z"/>';

      this.previewAudio.ontimeupdate = () => {
        if (!this.previewAudio) return;
        const cur = this.previewAudio.currentTime;
        const dur = (isFinite(this.previewAudio.duration) && this.previewAudio.duration > 0)
          ? this.previewAudio.duration
          : totalSeconds;
        if (timeEl) timeEl.textContent = VoiceRecorder.formatDuration(Math.floor(cur));
        if (progressBar && dur > 0) {
          const pct = Math.min(100, (cur / dur) * 100);
          progressBar.style.width = `${pct}%`;
        }
      };

      this.previewAudio.onended = () => {
        if (playIconSvg) playIconSvg.innerHTML = '<path d="M8 5v14l11-7z"/>';
        if (progressBar) progressBar.style.width = '0%';
        if (timeEl) timeEl.textContent = VoiceRecorder.formatDuration(totalSeconds);
      };

      playBtn.onclick = () => {
        if (!this.previewAudio) return;
        if (this.previewAudio.paused) {
          this.previewAudio.play().catch(e => console.warn('[PreviewAudio] Play error:', e));
          if (playIconSvg) playIconSvg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        } else {
          this.previewAudio.pause();
          if (playIconSvg) playIconSvg.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
      };
    } catch (err) {
      console.warn('[ChatView] Preview audio setup error:', err);
    }
  }

  stopPreviewAudio() {
    if (this.previewAudio) {
      try {
        this.previewAudio.pause();
      } catch (e) { }
      this.previewAudio = null;
    }
  }

  resetVoiceUI() {
    this.stopPreviewAudio();
    const normalBar = this.container.querySelector('#chat-default-input-bar');
    const holdingBar = this.container.querySelector('#chat-voice-holding-bar');
    const lockedBar = this.container.querySelector('#chat-voice-locked-bar');
    const lockCapsule = this.container.querySelector('#voice-lock-capsule');
    const holdingSlide = this.container.querySelector('#voice-holding-slide');
    const holdingTimer = this.container.querySelector('#voice-holding-timer');
    const lockedTimer = this.container.querySelector('#voice-locked-timer');
    const sendBtn = this.container.querySelector('#btn-mic-send');

    if (normalBar) normalBar.style.display = 'flex';
    if (holdingBar) holdingBar.style.display = 'none';
    if (lockedBar) lockedBar.style.display = 'none';
    if (lockCapsule) {
      lockCapsule.style.display = 'none';
      lockCapsule.classList.remove('active');
    }
    if (holdingSlide) holdingSlide.style.transform = '';
    if (holdingTimer) holdingTimer.textContent = '0:00';
    if (lockedTimer) lockedTimer.textContent = '0:00';
    if (sendBtn) sendBtn.classList.remove('recording-active');
  }

  openMediaEditor(files) {
    const editor = new MediaEditorModal({
      recipientName: this.chat.name,
      onSend: async ({ files, caption, isHd }) => {
        await this.sendBatchMediaMessages(files, caption, isHd);
      }
    });
    editor.show(files);
  }

  // ---------- Reply feature ----------
  _escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async startReply(msg) {
    if (!msg || msg.isSystem || msg.isDeleted) return;
    const sender = msg.isOutgoing ? 'You' : (msg.sender || this.chat?.name || 'Contact');
    this.replyingTo = {
      id: msg.id,
      sender,
      text: msg.text || '',
      mediaType: msg.mediaType || null,
      mediaId: msg.mediaId || null,
      mediaName: msg.mediaName || null
    };
    await this.renderReplyBanner();
    this.container.querySelector('#chat-input-textarea')?.focus();
  }

  async renderReplyBanner() {
    const banner = this.container.querySelector('#chat-reply-banner');
    if (!banner) return;
    if (this.replyThumbUrl) {
      URL.revokeObjectURL(this.replyThumbUrl);
      this.replyThumbUrl = null;
    }
    const r = this.replyingTo;
    if (!r) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }

    let snippet = r.text;
    let iconHtml = '';
    if (r.mediaType === 'image') { iconHtml = Icons.gallery('', 13); snippet = r.text ? `Photo: ${r.text}` : 'Photo'; }
    else if (r.mediaType === 'video') { iconHtml = Icons.callVideo('', 13); snippet = r.text ? `Video: ${r.text}` : 'Video'; }
    else if (r.mediaType === 'audio') { iconHtml = Icons.mic('', 13); snippet = 'Voice message'; }
    else if (r.mediaType === 'sticker') { iconHtml = Icons.sticker('', 13); snippet = 'Sticker'; }
    else if (r.mediaType === 'pdf' || r.mediaType === 'document') { iconHtml = Icons.documentIcon('', 13); snippet = r.mediaName || 'Document'; }

    let thumbHtml = '';
    if (r.mediaId && ['image', 'video', 'sticker'].includes(r.mediaType)) {
      try {
        const item = await db.getMedia(r.mediaId);
        if (item && item.blob) {
          this.replyThumbUrl = URL.createObjectURL(item.blob);
          thumbHtml = r.mediaType === 'video'
            ? `<div class="reply-banner-thumb"><video src="${this.replyThumbUrl}"></video></div>`
            : `<div class="reply-banner-thumb"><img src="${this.replyThumbUrl}" alt="" /></div>`;
        }
      } catch (_) { }
    }

    banner.innerHTML = `
      <div class="reply-banner-content">
        <div class="reply-banner-bar"></div>
        <div class="reply-banner-texts">
          <div class="reply-banner-sender">${this._escHtml(r.sender)}</div>
          <div class="reply-banner-snippet" dir="auto">${iconHtml}${this._escHtml(snippet)}</div>
        </div>
        ${thumbHtml}
      </div>
      <button type="button" class="reply-banner-close-btn" id="btn-cancel-reply" aria-label="Cancel reply">${Icons.close('', 18)}</button>
    `;
    banner.style.display = 'flex';
    banner.querySelector('#btn-cancel-reply').addEventListener('click', () => this.clearReply());
  }

  clearReply() {
    this.replyingTo = null;
    this.renderReplyBanner();
  }

  applyReplyTo(msg) {
    if (this.replyingTo) {
      msg.replyTo = { ...this.replyingTo };
      this.clearReply();
    }
  }

  async sendNewMessage(text) {
    const currentMe = this.chat.meParticipant || this.chat.customMeName || 'Me';
    const newMsg = {
      id: db.generateUUID(),
      chatId: this.chatId,
      timestamp: Date.now(),
      sender: currentMe,
      isOutgoing: true,
      text: text,
      mediaId: null,
      mediaName: null,
      mediaType: null
    };

    this.applyReplyTo(newMsg);
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

  async sendBatchMediaMessages(files, caption = '', isHd = false) {
    if (!files || files.length === 0) return;

    const currentMe = this.chat.meParticipant || this.chat.customMeName || 'Me';
    const batchId = `batch_${Date.now()}`;
    const newMsgs = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mediaId = db.generateUUID();
      const isVid = file.type.startsWith('video/');
      const type = isVid ? 'video' : 'image';

      const mediaItem = {
        id: mediaId,
        chatId: this.chatId,
        filename: file.name,
        type: type,
        size: file.size,
        blob: file,
        isHd: isHd,
        timestamp: Date.now() + i
      };
      await db.saveMedia(mediaItem);

      const msg = {
        id: db.generateUUID(),
        chatId: this.chatId,
        timestamp: Date.now() + i,
        sender: currentMe,
        isOutgoing: true,
        text: (i === 0 && caption) ? caption : '',
        batchId: batchId,
        mediaId: mediaId,
        mediaName: file.name,
        mediaType: type
      };
      if (i === 0) this.applyReplyTo(msg);
      await db.saveMessage(msg);
      newMsgs.push(msg);
    }

    const lastFile = files[files.length - 1];
    await db.updateChat(this.chatId, {
      lastMessage: files.length > 1 ? `📷 ${files.length} photos` : `📷 ${lastFile.name}`,
      updatedAt: Date.now()
    });

    this.scroller.allMessages.push(...newMsgs);

    if (newMsgs.length > 1) {
      const albumRow = await this.scroller.createAlbumElement(newMsgs);
      this.container.querySelector('#chat-messages-wrap').appendChild(albumRow);
    } else {
      const msgEl = await this.scroller.createMessageElement(newMsgs[0]);
      this.container.querySelector('#chat-messages-wrap').appendChild(msgEl);
    }

    this.scroller.scrollToBottom(true);
  }

  async sendStickerMessage(blobOrUrl, name = 'Sticker') {
    let blob = blobOrUrl;
    if (typeof blobOrUrl === 'string') {
      try {
        const resp = await fetch(blobOrUrl);
        blob = await resp.blob();
      } catch (e) { }
    }

    const mediaId = db.generateUUID();
    const mediaItem = {
      id: mediaId,
      chatId: this.chatId,
      filename: `${name}.webp`,
      type: 'sticker',
      size: blob?.size || 1024,
      blob: blob,
      timestamp: Date.now()
    };
    await db.saveMedia(mediaItem);

    const currentMe = this.chat.meParticipant || this.chat.customMeName || 'Me';
    const newMsg = {
      id: db.generateUUID(),
      chatId: this.chatId,
      timestamp: Date.now(),
      sender: currentMe,
      isOutgoing: true,
      text: '',
      mediaId: mediaId,
      mediaName: `${name}.webp`,
      mediaType: 'sticker'
    };

    this.applyReplyTo(newMsg);
    await db.saveMessage(newMsg);
    await db.updateChat(this.chatId, {
      lastMessage: '💟 Sticker',
      updatedAt: Date.now()
    });

    this.scroller.allMessages.push(newMsg);
    const msgEl = await this.scroller.createMessageElement(newMsg);
    this.container.querySelector('#chat-messages-wrap').appendChild(msgEl);
    this.scroller.scrollToBottom(true);
  }

  generatePttFilename(extension = 'opus') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(Math.floor(1000 + Math.random() * 9000));
    return `PTT-${year}${month}${day}-WA${seq}.${extension}`;
  }

  async sendVoiceNoteMessage(audioBlob, duration) {
    if (!audioBlob || audioBlob.size === 0) {
      Toast.show('No audio recorded');
      return;
    }

    const mediaId = db.generateUUID();
    let ext = 'opus';
    if (audioBlob.type) {
      if (audioBlob.type.includes('mp4') || audioBlob.type.includes('aac')) ext = 'm4a';
      else if (audioBlob.type.includes('ogg')) ext = 'opus';
      else if (audioBlob.type.includes('webm')) ext = 'opus';
      else if (audioBlob.type.includes('wav')) ext = 'wav';
    }

    const pttFilename = this.generatePttFilename(ext);

    const mediaItem = {
      id: mediaId,
      chatId: this.chatId,
      filename: pttFilename,
      type: 'audio',
      mimeType: audioBlob.type || 'audio/ogg; codecs=opus',
      size: audioBlob.size,
      blob: audioBlob,
      duration: duration,
      timestamp: Date.now()
    };
    await db.saveMedia(mediaItem);

    const currentMe = this.chat.meParticipant || this.chat.customMeName || 'Me';
    const newMsg = {
      id: db.generateUUID(),
      chatId: this.chatId,
      timestamp: Date.now(),
      sender: currentMe,
      isOutgoing: true,
      text: '',
      mediaId: mediaId,
      mediaName: pttFilename,
      mediaType: 'audio',
      isVoiceNote: true,
      duration: duration
    };

    this.applyReplyTo(newMsg);
    await db.saveMessage(newMsg);
    await db.updateChat(this.chatId, {
      lastMessage: `🎤 Voice message (${VoiceRecorder.formatDuration(duration)})`,
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

    this.applyReplyTo(newMsg);
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
    const controller = new AbortController();
    const loading = showLoadingDialog({
      title: 'Swapping sender / receiver...',
      message: 'Please wait',
      cancelText: 'Cancel',
      onCancel: () => controller.abort()
    });

    // Give DOM a frame to paint the loading dialog before starting DB tasks
    await new Promise((r) => setTimeout(r, 60));

    try {
      const updatedChat = await db.swapChatPerspective(this.chatId, { signal: controller.signal });
      if (controller.signal.aborted || !updatedChat) {
        loading.close();
        Toast.show('Swap cancelled. No changes made.');
        return;
      }

      this.chat = updatedChat;

      // Update Header Name
      const titleEl = this.container.querySelector('.chat-header-title');
      if (titleEl) {
        titleEl.textContent = this.chat.name;
      }

      // Update Header Avatar
      const avatarWrap = this.container.querySelector('.chat-header-avatar');
      if (avatarWrap) {
        avatarWrap.innerHTML = this.chat.avatarBlob
          ? `<img src="${URL.createObjectURL(this.chat.avatarBlob)}" class="chat-avatar-img" alt="Avatar" />`
          : (this.chat.isGroup ? Icons.groupAvatar('', 38) : Icons.userAvatar('', 38));
      }

      // Refresh Virtual Scroller with updated chat
      this.scroller.chat = this.chat;
      await this.scroller.loadInitial();

      loading.close();
      Toast.show(`Perspective swapped with ${this.chat.name}`);
    } catch (err) {
      loading.close();
      if (controller.signal.aborted) {
        Toast.show('Swap cancelled. No changes made.');
      } else {
        console.error('Error swapping perspective:', err);
        Toast.show('Failed to swap perspective');
      }
    }
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
      await this.scroller.jumpToDate(targetMsg, dateString);
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

  _handleMessageLongPress(msg, rowEl, evt) {
    if (this.isSelectionMode) {
      this.toggleMessageSelection(msg.id, rowEl);
    } else {
      this.enterSelectionMode(msg.id, rowEl);
      this.reactionBar?.show(msg.id, rowEl, msg.reaction);
    }
  }

  // --- In-Place Message Inline Editing ---
  _startInlineEdit(msg) {
    this.exitSelectionMode();
    const rowEl = this.scroller?.findMessageElement(msg.id);
    if (!rowEl) return;

    const bubble = rowEl.querySelector('.msg-bubble');
    if (!bubble) return;

    const existingTextEl = bubble.querySelector('.bubble-text-content') || bubble.querySelector('.msg-text');
    const originalDisplay = existingTextEl ? existingTextEl.style.display : '';
    if (existingTextEl) existingTextEl.style.display = 'none';

    // Remove any previous inline edit box
    const oldBox = bubble.querySelector('.msg-inline-edit-box');
    if (oldBox) oldBox.remove();

    const editBox = document.createElement('div');
    editBox.className = 'msg-inline-edit-box';
    editBox.innerHTML = `
      <textarea class="msg-inline-edit-textarea" rows="2" dir="auto">${this.escapeHtml(msg.text || '')}</textarea>
      <div class="msg-inline-edit-actions">
        <button type="button" class="inline-edit-btn cancel" title="Cancel" aria-label="Cancel edit">${Icons.close('', 18)}</button>
        <button type="button" class="inline-edit-btn save" title="Save" aria-label="Save edit">${Icons.check('', 18)}</button>
      </div>
    `;

    bubble.appendChild(editBox);

    const textarea = editBox.querySelector('.msg-inline-edit-textarea');
    const cancelBtn = editBox.querySelector('.inline-edit-btn.cancel');
    const saveBtn = editBox.querySelector('.inline-edit-btn.save');

    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

    const cleanupEdit = () => {
      editBox.remove();
      if (existingTextEl) existingTextEl.style.display = originalDisplay;
    };

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cleanupEdit();
    });

    const doSave = async () => {
      const newText = textarea.value.trim();
      if (!newText) {
        Toast.show('Message cannot be empty');
        return;
      }
      if (newText === msg.text) {
        cleanupEdit();
        return;
      }

      await db.updateMessage(msg.id, { text: newText, isEdited: true });
      msg.text = newText;
      msg.isEdited = true;

      // Update scroller in-memory message
      const inMem = this.scroller?.allMessages.find((m) => String(m.id) === String(msg.id));
      if (inMem) {
        inMem.text = newText;
        inMem.isEdited = true;
      }

      cleanupEdit();
      if (existingTextEl) {
        existingTextEl.textContent = newText;
      }

      // Ensure (Edited) badge is shown in bubble meta
      const metaSpan = rowEl.querySelector('.msg-meta') || rowEl.querySelector('.album-caption-meta');
      if (metaSpan && !metaSpan.querySelector('.edited-tag')) {
        const tag = document.createElement('span');
        tag.className = 'edited-tag';
        tag.textContent = 'Edited';
        const timeEl = metaSpan.querySelector('.msg-time');
        if (timeEl) {
          metaSpan.insertBefore(tag, timeEl);
        } else {
          metaSpan.prepend(tag);
        }
      }

      Toast.show('Message edited');
    };

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      doSave();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSave();
      } else if (e.key === 'Escape') {
        cleanupEdit();
      }
    });
  }

  // --- Share Media Messages ---
  async _shareMessage(msg) {
    this.exitSelectionMode();
    try {
      let blob = null;
      if (msg.mediaId) {
        const mediaItem = await db.getMedia(msg.mediaId);
        if (mediaItem && mediaItem.blob) blob = mediaItem.blob;
      }

      // 1. Try Native System Share if browser supports sharing files
      if (navigator.share && blob) {
        const ext = msg.mediaType === 'image' ? 'jpg' : (msg.mediaType === 'video' ? 'mp4' : (msg.mediaType === 'audio' || msg.mediaType === 'voice' ? 'mp3' : 'bin'));
        const file = new File([blob], msg.mediaName || `shared_${msg.id}.${ext}`, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: msg.mediaName || 'Media',
              text: msg.text || ''
            });
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return; // User cancelled native share
            console.warn('[ChatView] Native share failed, opening share options modal:', shareErr);
          }
        }
      }

      // 2. Open dedicated Share Options Window with platform targets, preview & tools
      const modal = new ShareOptionsModal({ msg, blob });
      modal.open();
    } catch (err) {
      console.error('Share error:', err);
      Toast.show('Unable to open share options');
    }
  }

  // --- Message Multi-Selection System ---
  enterSelectionMode(initialMsgId, rowEl) {
    this.isSelectionMode = true;
    if (this.scroller) this.scroller.selectionMode = true;
    this.selectedMessageIds.clear();
    if (initialMsgId) {
      this.selectedMessageIds.add(initialMsgId);
    }
    if (window.router) {
      window.router.pushOverlay('chat-msg-selection', () => this.exitSelectionMode());
    }
    this.updateMessageSelectionBar();
    if (rowEl) rowEl.classList.add('is-msg-selected');
  }

  toggleMessageSelection(msgId, rowEl) {
    const row = rowEl || (this.scroller ? this.scroller.findMessageElement(msgId) : this.container.querySelector(`.msg-row[data-msg-id="${msgId}"]`));
    if (this.selectedMessageIds.has(msgId)) {
      this.selectedMessageIds.delete(msgId);
      if (row) row.classList.remove('is-msg-selected');
    } else {
      this.selectedMessageIds.add(msgId);
      if (row) row.classList.add('is-msg-selected');
    }

    if (this.selectedMessageIds.size === 0) {
      this.exitSelectionMode();
    } else {
      this.updateMessageSelectionBar();
    }
  }

  updateMessageSelectionBar() {
    if (this.selectedMessageIds.size === 0) {
      this.exitSelectionMode();
      return;
    }

    const defaultHeader = this.container.querySelector('#chat-default-header');
    const selectHeader = this.container.querySelector('#chat-selection-header');
    const countEl = this.container.querySelector('#chat-select-count');
    const toolsBar = this.container.querySelector('#selection-tools-bar');
    const overflowWrap = this.container.querySelector('#selection-overflow-wrap');
    const overflowMenu = this.container.querySelector('#selection-overflow-menu');

    if (!selectHeader || !toolsBar) return;

    if (defaultHeader) defaultHeader.style.display = 'none';
    selectHeader.style.display = 'flex';
    if (countEl) countEl.textContent = `${this.selectedMessageIds.size}`;
    if (overflowMenu) overflowMenu.style.display = 'none';

    // Retrieve selected message objects
    const allMsgs = this.scroller?.allMessages || [];
    const selectedMsgs = [];
    for (const id of this.selectedMessageIds) {
      const found = allMsgs.find((m) => String(m.id) === String(id));
      if (found) selectedMsgs.push(found);
    }

    const count = selectedMsgs.length;
    if (count === 0) return;

    const allStarred = selectedMsgs.every((m) => m.isStarred);
    const allPinned = selectedMsgs.every((m) => this.chatPins.some((p) => String(p.messageId) === String(m.id)));
    const isAllText = selectedMsgs.every((m) => m.text && !m.mediaId && !m.mediaType && !m.isDeleted);

    const tools = [];

    if (count === 1) {
      const msg = selectedMsgs[0];
      const isPinned = this.chatPins.some((p) => String(p.messageId) === String(msg.id));
      const canEdit = Boolean(msg.isOutgoing && msg.text && !msg.isDeleted && !msg.mediaId);

      // Single select tools arrangement:
      // 1. Reply
      tools.push({
        id: 'reply',
        label: 'Reply',
        icon: Icons.replyBold('', 20),
        action: () => {
          this.exitSelectionMode();
          this.startReply(msg);
        }
      });

      // 2. Edit (only for outgoing text messages)
      if (canEdit) {
        tools.push({
          id: 'edit',
          label: 'Edit',
          icon: Icons.edit('', 20),
          action: () => {
            this._startInlineEdit(msg);
          }
        });
      }

      // 3. Info
      tools.push({
        id: 'info',
        label: 'Info',
        icon: Icons.infoCircle('', 20),
        action: () => {
          this.exitSelectionMode();
          this.messageInfoSheet?.show(msg, isPinned);
        }
      });

      // 4. Delete
      tools.push({
        id: 'delete',
        label: 'Delete',
        icon: Icons.trash('', 20),
        danger: true,
        action: () => {
          this.deleteSelectedMessages();
        }
      });

      // 5. Forward
      tools.push({
        id: 'forward',
        label: 'Forward',
        icon: Icons.forwardBold('', 20),
        action: () => {
          this.forwardSelectedMessages();
        }
      });

      // 6. Star
      tools.push({
        id: 'star',
        label: msg.isStarred ? 'Unstar' : 'Star',
        icon: msg.isStarred ? Icons.unstar('', 20) : Icons.star('', 20),
        action: () => {
          this.starSelectedMessages();
        }
      });

      // 7. Copy (for text) OR Share (for media and files)
      if (msg.text && !msg.isDeleted) {
        tools.push({
          id: 'copy',
          label: 'Copy',
          icon: Icons.copy('', 20),
          action: () => {
            this.copySelectedMessages();
          }
        });
      } else if (msg.mediaId || msg.mediaType) {
        tools.push({
          id: 'share',
          label: 'Share',
          icon: Icons.share('', 20),
          action: () => {
            this._shareMessage(msg);
          }
        });
      }

      // 8. Pin
      tools.push({
        id: 'pin',
        label: isPinned ? 'Unpin' : 'Pin',
        icon: isPinned ? Icons.pinOff('', 20) : Icons.pin('', 20),
        action: () => {
          this.pinSelectedMessages();
        }
      });

    } else if (isAllText) {
      // Multiple select text-only: star all, delete, copy, forward, pin
      tools.push({
        id: 'star',
        label: allStarred ? 'Unstar all' : 'Star all',
        icon: allStarred ? Icons.unstar('', 20) : Icons.star('', 20),
        action: () => this.starSelectedMessages()
      });
      tools.push({
        id: 'delete',
        label: 'Delete',
        icon: Icons.trash('', 20),
        danger: true,
        action: () => this.deleteSelectedMessages()
      });
      tools.push({
        id: 'copy',
        label: 'Copy',
        icon: Icons.copy('', 20),
        action: () => this.copySelectedMessages()
      });
      tools.push({
        id: 'forward',
        label: 'Forward',
        icon: Icons.forwardBold('', 20),
        action: () => this.forwardSelectedMessages()
      });
      tools.push({
        id: 'pin',
        label: allPinned ? 'Unpin all' : 'Pin all',
        icon: allPinned ? Icons.pinOff('', 20) : Icons.pin('', 20),
        action: () => this.pinSelectedMessages()
      });

    } else {
      // Multiple select mixed types: star all, delete, forward, pin
      tools.push({
        id: 'star',
        label: allStarred ? 'Unstar all' : 'Star all',
        icon: allStarred ? Icons.unstar('', 20) : Icons.star('', 20),
        action: () => this.starSelectedMessages()
      });
      tools.push({
        id: 'delete',
        label: 'Delete',
        icon: Icons.trash('', 20),
        danger: true,
        action: () => this.deleteSelectedMessages()
      });
      tools.push({
        id: 'forward',
        label: 'Forward',
        icon: Icons.forwardBold('', 20),
        action: () => this.forwardSelectedMessages()
      });
      tools.push({
        id: 'pin',
        label: allPinned ? 'Unpin all' : 'Pin all',
        icon: allPinned ? Icons.pinOff('', 20) : Icons.pin('', 20),
        action: () => this.pinSelectedMessages()
      });
    }

    // Responsive tool measurement and layout
    const headerWidth = selectHeader.clientWidth || window.innerWidth;
    const leftWidth = 100; // width of [← back] [count] + gap
    const btnWidth = 44;   // width per tool icon button
    const availableWidth = Math.max(0, headerWidth - leftWidth - 12);

    toolsBar.innerHTML = '';
    overflowMenu.innerHTML = '';

    if (tools.length * btnWidth <= availableWidth) {
      // All tools fit directly in the toolbar
      if (overflowWrap) overflowWrap.style.display = 'none';
      tools.forEach((tool) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `selection-tool-btn ${tool.danger ? 'danger-tool' : ''}`;
        btn.title = tool.label;
        btn.setAttribute('aria-label', tool.label);
        btn.innerHTML = tool.icon;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          tool.action();
        });
        toolsBar.appendChild(btn);
      });
    } else {
      // Not all tools fit: leave space for 3-dots overflow button (44px)
      const maxVisible = Math.max(1, Math.floor((availableWidth - 44) / btnWidth));
      const visibleTools = tools.slice(0, maxVisible);
      const overflowTools = tools.slice(maxVisible);

      visibleTools.forEach((tool) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `selection-tool-btn ${tool.danger ? 'danger-tool' : ''}`;
        btn.title = tool.label;
        btn.setAttribute('aria-label', tool.label);
        btn.innerHTML = tool.icon;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          tool.action();
        });
        toolsBar.appendChild(btn);
      });

      overflowTools.forEach((tool) => {
        const item = document.createElement('div');
        item.className = `selection-overflow-item ${tool.danger ? 'danger-item' : ''}`;
        item.innerHTML = `
          <span class="selection-overflow-item-icon">${tool.icon}</span>
          <span>${tool.label}</span>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          overflowMenu.style.display = 'none';
          tool.action();
        });
        overflowMenu.appendChild(item);
      });

      if (overflowWrap) overflowWrap.style.display = 'flex';
    }
  }

  exitSelectionMode() {
    this.isSelectionMode = false;
    if (this.scroller) this.scroller.selectionMode = false;
    this.selectedMessageIds.clear();
    this.reactionBar?.hide();

    const defaultHeader = this.container.querySelector('#chat-default-header');
    const selectHeader = this.container.querySelector('#chat-selection-header');
    const overflowMenu = this.container.querySelector('#selection-overflow-menu');

    if (defaultHeader) defaultHeader.style.display = 'flex';
    if (selectHeader) selectHeader.style.display = 'none';
    if (overflowMenu) overflowMenu.style.display = 'none';

    this.container.querySelectorAll('.msg-row.is-msg-selected').forEach((r) => {
      r.classList.remove('is-msg-selected');
    });

    if (window.router) {
      window.router.removeOverlay('chat-msg-selection');
    }
  }

  async starSelectedMessages() {
    if (this.selectedMessageIds.size === 0) return;
    let allStarred = true;
    const msgsToUpdate = [];

    // Resolve selected IDs from the scroller's in-memory message list
    const allMsgs = this.scroller?.allMessages ?? [];
    for (const id of this.selectedMessageIds) {
      const m = allMsgs.find((msg) => String(msg.id) === String(id));
      if (m) {
        msgsToUpdate.push(m);
        if (!m.isStarred) allStarred = false;
      }
    }

    if (msgsToUpdate.length === 0) return;

    // If all selected messages are starred, unstar them all; otherwise star them all
    const targetState = !allStarred;
    const ids = msgsToUpdate.map((m) => m.id);
    await db.setMessagesStarred(ids, targetState);
    // Update in-memory references so the star badge reflects immediately
    for (const m of msgsToUpdate) {
      m.isStarred = targetState;
    }

    const count = msgsToUpdate.length;
    Toast.show(targetState ? `${count} message${count > 1 ? 's' : ''} starred` : `${count} message${count > 1 ? 's' : ''} unstarred`);
    this.exitSelectionMode();
    await this.scroller.loadInitial();
  }

  async copySelectedMessages() {
    if (this.selectedMessageIds.size === 0) return;
    const texts = [];
    const allMsgs = this.scroller?.allMessages ?? [];
    for (const id of this.selectedMessageIds) {
      const m = allMsgs.find((msg) => String(msg.id) === String(id));
      if (m && m.text) texts.push(m.text);
    }
    if (texts.length > 0) {
      await navigator.clipboard.writeText(texts.join('\n\n'));
      Toast.show(`${texts.length} messages copied to clipboard`);
    } else {
      Toast.show('No text in selected messages');
    }
    this.exitSelectionMode();
  }

  async forwardSelectedMessages() {
    if (this.selectedMessageIds.size === 0) return;
    const allMsgs = this.scroller?.allMessages ?? [];
    const msgsToForward = [];
    for (const id of this.selectedMessageIds) {
      const m = allMsgs.find((msg) => String(msg.id) === String(id));
      if (m) msgsToForward.push(m);
    }
    if (msgsToForward.length === 0) return;

    const picker = new ForwardPicker();
    const result = await picker.open(msgsToForward);
    if (result && result.chatIds && result.chatIds.length > 0) {
      await forwardMessagesToChats(msgsToForward, result.chatIds);
      const count = result.chatIds.length;
      Toast.show(`Forwarded to ${count} chat${count > 1 ? 's' : ''}`);
      this.exitSelectionMode();
      if (result.chatIds.includes(this.chatId)) {
        await this.scroller.loadInitial();
      }
    }
  }

  async toggleForwardSelectedMessages() {
    if (this.selectedMessageIds.size === 0) return;
    const allMsgs = this.scroller?.allMessages ?? [];
    const msgsToUpdate = [];
    let allForwarded = true;

    for (const id of this.selectedMessageIds) {
      const m = allMsgs.find((msg) => String(msg.id) === String(id));
      if (m) {
        msgsToUpdate.push(m);
        if (!m.isForwarded) allForwarded = false;
      }
    }

    if (msgsToUpdate.length === 0) return;

    const targetState = !allForwarded;
    for (const m of msgsToUpdate) {
      await db.updateMessage(m.id, { isForwarded: targetState });
      m.isForwarded = targetState;
    }

    const count = msgsToUpdate.length;
    Toast.show(targetState ? `${count} message${count > 1 ? 's' : ''} marked forwarded` : `${count} message${count > 1 ? 's' : ''} unforwarded`);
    this.exitSelectionMode();
    await this.scroller.loadInitial();
  }

  async deleteSelectedMessages() {
    const count = this.selectedMessageIds.size;
    if (count === 0) return;

    const confirmed = await showConfirm({
      title: `Delete ${count} message${count > 1 ? 's' : ''}?`,
      message: 'Do you want to delete the selected messages?',
      confirmText: 'Delete for me',
      cancelText: 'Cancel',
      isDanger: true,
      extraCheckbox: {
        id: 'chk-del-starred-msgs',
        label: 'Delete starred messages too',
        checked: false
      }
    });

    if (confirmed) {
      const chk = document.getElementById('chk-del-starred-msgs');
      const deleteStarred = chk ? chk.checked : false;
      await db.deleteMessagesBatch(Array.from(this.selectedMessageIds), !deleteStarred);
      Toast.show(`${count} messages deleted`);
      this.exitSelectionMode();
      this.scroller.loadInitial();
    }
  }

  selectAllMessages() {
    const allRows = this.container.querySelectorAll('.msg-row[data-msg-id]');
    allRows.forEach((r) => {
      const id = r.dataset.msgId;
      if (id) {
        this.selectedMessageIds.add(id);
        r.classList.add('is-msg-selected');
      }
    });
    this.updateMessageSelectionBar();
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
      await db.updateChat(this.chatId, { name: newName.trim(), updatedAt: Date.now() });
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

  // --- Message Pin System ---
  async loadAndRenderPins() {
    this.chatPins = await db.getPinsForChat(this.chatId);
    this.pinPriorityMode = await db.getPinPriorityMode(this.chatId);

    // Auto-expire check
    const now = Date.now();
    const activePins = this.chatPins.filter((p) => p.expiresAt === null || p.expiresAt > now);
    if (activePins.length !== this.chatPins.length) {
      this.chatPins = activePins;
      await db.savePinsForChat(this.chatId, activePins);
    }

    this.scroller?.setPinnedMessageIds(this.chatPins.map((p) => String(p.messageId)));
    this.renderPinnedBar();
  }

  renderPinnedBar() {
    const bar = this.container?.querySelector('#chat-pinned-bar');
    if (!bar) return;

    if (this.chatPins.length === 0 || this.pinnedBarDismissed) {
      bar.style.display = 'none';
      if (this.switcherInterval) {
        clearInterval(this.switcherInterval);
        this.switcherInterval = null;
      }
      return;
    }

    const priorityPin = this._getHighestPriorityPin();
    if (!priorityPin) {
      bar.style.display = 'none';
      return;
    }

    const snippetEl = bar.querySelector('#pinned-bar-snippet');
    const labelEl = bar.querySelector('#pinned-bar-label');

    if (snippetEl) {
      const text = priorityPin.text || (priorityPin.mediaType ? `[${priorityPin.mediaType}]` : 'Media message');
      snippetEl.textContent = text;
    }

    if (labelEl) {
      if (this.chatPins.length > 1) {
        labelEl.textContent = `Pinned message • ${this.chatPins.length} pinned`;
      } else {
        labelEl.textContent = 'Pinned message';
      }
    }

    bar.style.display = 'flex';

    // Switcher mode timer
    if (this.pinPriorityMode?.mode === 'switcher' && this.chatPins.length > 1) {
      if (!this.switcherInterval) {
        const secs = Math.max(1, this.pinPriorityMode.switcherSeconds || 10);
        this.switcherInterval = setInterval(() => {
          if (!this.container || this.chatPins.length <= 1) return;
          this.switcherIndex = (this.switcherIndex + 1) % this.chatPins.length;
          this._updatePinnedBarContentOnly();
        }, secs * 1000);
      }
    } else {
      if (this.switcherInterval) {
        clearInterval(this.switcherInterval);
        this.switcherInterval = null;
      }
    }
  }

  _updatePinnedBarContentOnly() {
    const bar = this.container?.querySelector('#chat-pinned-bar');
    if (!bar || this.chatPins.length === 0 || this.pinnedBarDismissed) return;
    const priorityPin = this._getHighestPriorityPin();
    if (!priorityPin) return;
    const snippetEl = bar.querySelector('#pinned-bar-snippet');
    if (snippetEl) {
      snippetEl.style.opacity = '0';
      setTimeout(() => {
        snippetEl.textContent = priorityPin.text || (priorityPin.mediaType ? `[${priorityPin.mediaType}]` : 'Media message');
        snippetEl.style.opacity = '1';
      }, 150);
    }
  }

  _getHighestPriorityPin() {
    if (!this.chatPins || this.chatPins.length === 0) return null;
    const mode = this.pinPriorityMode?.mode || 'last_added';
    const now = Date.now();
    let sorted = [...this.chatPins];

    if (mode === 'last_added') {
      sorted.sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
      return sorted[0];
    }

    if (mode === 'first_added') {
      sorted.sort((a, b) => (a.pinnedAt || 0) - (b.pinnedAt || 0));
      return sorted[0];
    }

    if (mode === 'about_to_end') {
      sorted.sort((a, b) => {
        if (a.expiresAt === null && b.expiresAt === null) return (b.pinnedAt || 0) - (a.pinnedAt || 0);
        if (a.expiresAt === null) return 1;
        if (b.expiresAt === null) return -1;
        return a.expiresAt - b.expiresAt;
      });
      return sorted[0];
    }

    if (mode === 'mixed') {
      const days = this.pinPriorityMode.mixedDays || 7;
      const thresholdMs = days * 86400000;
      sorted.sort((a, b) => {
        const aClose = a.expiresAt !== null && (a.expiresAt - now) <= thresholdMs;
        const bClose = b.expiresAt !== null && (b.expiresAt - now) <= thresholdMs;
        if (aClose && !bClose) return -1;
        if (!aClose && bClose) return 1;
        if (aClose && bClose) return a.expiresAt - b.expiresAt;
        return (b.pinnedAt || 0) - (a.pinnedAt || 0);
      });
      return sorted[0];
    }

    if (mode === 'switcher') {
      if (this.switcherIndex >= sorted.length) {
        this.switcherIndex = 0;
      }
      return sorted[this.switcherIndex];
    }

    return sorted[0];
  }

  async pinSelectedMessages() {
    if (this.selectedMessageIds.size === 0) return;
    const allMsgs = this.scroller?.allMessages ?? [];
    const msgsToPin = [];
    for (const id of this.selectedMessageIds) {
      const m = allMsgs.find((msg) => String(msg.id) === String(id));
      if (m) msgsToPin.push(m);
    }
    if (msgsToPin.length === 0) return;
    this.exitSelectionMode();
    await this.pinMessages(msgsToPin);
  }

  async pinMessages(msgs) {
    if (!msgs || msgs.length === 0) return;
    const result = await PinDurationPicker.open();
    if (!result) return; // cancelled

    const { expiresAt } = result;
    const now = Date.now();
    let updatedPins = [...this.chatPins];

    for (const msg of msgs) {
      // If already pinned, replace existing entry with new duration
      const existingIdx = updatedPins.findIndex((p) => String(p.messageId) === String(msg.id));
      if (existingIdx !== -1) {
        updatedPins.splice(existingIdx, 1);
      }

      updatedPins.push({
        id: db.generateUUID(),
        messageId: msg.id,
        chatId: this.chatId,
        pinnedAt: now,
        expiresAt,
        text: msg.text || null,
        sender: msg.sender || (msg.isOutgoing ? 'You' : this.chat.name),
        mediaType: msg.mediaType || null
      });
    }

    this.chatPins = updatedPins;
    this.pinnedBarDismissed = false; // re-show bar on new pin
    await db.savePinsForChat(this.chatId, updatedPins);
    this.scroller?.setPinnedMessageIds(this.chatPins.map((p) => String(p.messageId)));

    const count = msgs.length;
    Toast.show(`${count} message${count > 1 ? 's' : ''} pinned`);
    this.renderPinnedBar();
  }

  async unpinMessage(messageId) {
    this.chatPins = this.chatPins.filter((p) => String(p.messageId) !== String(messageId));
    await db.savePinsForChat(this.chatId, this.chatPins);
    this.scroller?.setPinnedMessageIds(this.chatPins.map((p) => String(p.messageId)));
    Toast.show('Message unpinned');
    this.renderPinnedBar();
  }

  openPinnedPanel() {
    const panel = new PinnedPanel({
      chatId: this.chatId,
      pins: this.chatPins,
      priorityMode: this.pinPriorityMode,
      onJumpToMessage: async (msgId) => {
        const found = await this.scroller.scrollToMessage(msgId);
        if (!found) Toast.show('Message not found');
      },
      onPinsChanged: async (updatedPins, updatedMode) => {
        this.chatPins = updatedPins;
        if (updatedMode) {
          this.pinPriorityMode = updatedMode;
          await db.savePinPriorityMode(this.chatId, updatedMode);
        }
        await db.savePinsForChat(this.chatId, updatedPins);
        this.scroller?.setPinnedMessageIds(this.chatPins.map((p) => String(p.messageId)));
        this.renderPinnedBar();
      }
    });
    panel.open();
  }

  cleanup() {
    this.exitSelectionMode();
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
    if (this._onInputResize) {
      window.removeEventListener('resize', this._onInputResize);
      window.visualViewport?.removeEventListener('resize', this._onInputResize);
      this._onInputResize = null;
    }
    if (this._cleanupInputDrag) {
      this._cleanupInputDrag();
      this._cleanupInputDrag = null;
    }
    this.router?.removeOverlay('chat-input-fullscreen');
    if (this.reactionBar) {
      this.reactionBar.destroy();
      this.reactionBar = null;
    }
    if (this.emojiPickerSheet) {
      this.emojiPickerSheet.destroy();
      this.emojiPickerSheet = null;
    }
    if (this.messageInfoSheet) {
      this.messageInfoSheet.destroy();
      this.messageInfoSheet = null;
    }
    if (this.stickerDrawer) {
      this.stickerDrawer.close(false);
      this.stickerDrawer = null;
    }
    if (this.switcherInterval) {
      clearInterval(this.switcherInterval);
      this.switcherInterval = null;
    }
    if (this.scroller) {
      this.scroller.cleanup();
    }
  }
}
