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
        <footer class="chat-input-bar" id="chat-default-input-bar">
          <div class="input-pill">
            <button type="button" class="input-icon-btn" id="btn-open-stickers" aria-label="Stickers">${Icons.sticker('', 22)}</button>
            <textarea id="chat-input-textarea" placeholder="Message" rows="1" dir="auto"></textarea>
            <label class="input-icon-btn" id="btn-gallery-attach" title="Attach file or photo">
              ${Icons.paperclip('', 22)}
              <input type="file" id="chat-gallery-input" accept="image/*,video/*" multiple style="display:none;" />
            </label>
            <button type="button" class="input-icon-btn" id="btn-camera-snap" aria-label="Camera">${Icons.camera('', 22)}</button>
            <input type="file" id="chat-camera-input" accept="image/*" capture="environment" style="display:none;" />
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

    await this.bindEvents(outgoingTheme, targetMsgId, params);
  }

  async bindEvents(outgoingTheme, targetMsgId, params = {}) {
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
      this.router.back();
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

    // Sticker Drawer Button
    const stickerBtn = this.container.querySelector('#btn-open-stickers');
    if (stickerBtn) {
      stickerBtn.addEventListener('click', () => {
        new StickerDrawer({
          onSelectSticker: (blobOrUrl, name) => {
            this.sendStickerMessage(blobOrUrl, name);
          }
        }).open();
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
      } catch (err) {}

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
        } catch (err) {}
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
          } catch (err) {}
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
          } catch (err) {}
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
      } catch (err) {}

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
      } catch (err) {}
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
      } catch (e) {}
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
      } catch (e) {}
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
