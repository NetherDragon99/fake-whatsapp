// Screen 5: Contact / Chat Info Screen with Collapsing Profile Animation
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { PinDialog } from '../components/pin-dialog.js';
import { mediaLightbox } from '../components/lightbox.js';
import { Toast } from '../components/toast.js';
import { showConfirm } from '../components/custom-dialog.js';
import { openImageCropper } from '../components/image-cropper.js';

export class ContactInfoView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.chatId = null;
    this.chat = null;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.chatId = params.id;
    this.chat = await db.getChat(this.chatId);

    if (!this.chat) {
      rootEl.innerHTML = `<div class="empty-state">Chat not found. <a href="#/chats">Go back</a></div>`;
      return;
    }

    const chatMedia = await db.getMediaByChat(this.chatId);
    const msgs = await db.getMessages(this.chatId);

    // Calculate chat storage
    let chatBytes = 0;
    for (const m of chatMedia) {
      chatBytes += m.size || 0;
    }
    chatBytes += msgs.length * 128;
    const formattedStorage = db.formatBytes(chatBytes);

    const avatarUrl = this.chat.avatarBlob ? URL.createObjectURL(this.chat.avatarBlob) : null;

    rootEl.innerHTML = `
      <div class="screen-view contact-info-screen">
        <!-- Sticky Collapsible App Bar (Material 3 flat) -->
        <header class="wa-app-bar sheet-style-header flat-app-bar" id="contact-info-header">
          <button type="button" class="app-bar-icon-btn" id="btn-info-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          
          <!-- Compact header profile revealed on scroll (Step 6 / Reference 6,7,8) -->
          <div class="contact-header-compact-info" id="contact-header-compact" style="opacity: 0; transform: translateY(10px); pointer-events: none;">
            <div class="compact-header-avatar">
              ${avatarUrl ? `<img src="${avatarUrl}" class="compact-avatar-img" alt="Avatar" />` : (this.chat.isGroup ? Icons.groupAvatar('', 34) : Icons.userAvatar('', 34))}
            </div>
            <span class="compact-header-name" dir="auto">${this.chat.name}</span>
          </div>

          <div class="app-bar-actions">
            <button type="button" class="app-bar-icon-btn" id="btn-info-more" aria-label="More options">${Icons.moreVert('', 22)}</button>
          </div>
        </header>

        <div class="contact-info-scroll-body" id="contact-scroll-body">
          <!-- Hero Section (Collapsible on scroll) -->
          <div class="contact-hero-card">
            <div class="hero-avatar-wrap" id="contact-hero-avatar">
              ${avatarUrl ? `<img src="${avatarUrl}" class="hero-avatar-img" alt="Avatar" />` : (this.chat.isGroup ? Icons.groupAvatar('', 120) : Icons.userAvatar('', 120))}
              <label class="hero-avatar-edit-badge" title="Change photo">
                <input type="file" id="hero-avatar-input" accept="image/*" style="display:none;" />
                ${Icons.camera('', 18)}
              </label>
            </div>
            <h2 class="hero-contact-name" id="contact-hero-name" dir="auto">${this.chat.name}</h2>
            <div class="hero-contact-sub">${this.chat.isGroup ? 'Group conversation' : (this.chat.isSelfChat ? 'Message yourself' : 'Contact')}</div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Media, Links, and Docs Horizontal Strip -->
          <div class="info-section-card">
            <div class="section-row-header" id="btn-view-all-media">
              <span class="section-title">Media, links, and docs</span>
              <span class="section-counter">${chatMedia.length} &gt;</span>
            </div>
            <div class="media-horizontal-strip" id="info-media-strip">
              <!-- Populated dynamically -->
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Options & Toggles -->
          <div class="info-options-group">
            <div class="option-row">
              <span class="option-icon">${Icons.download('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Manage storage</div>
                <div class="option-subtitle">${formattedStorage}</div>
              </div>
            </div>

            <div class="option-row" id="row-toggle-lock">
              <span class="option-icon">${Icons.lock('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Chat lock</div>
                <div class="option-subtitle">Lock and hide this chat on this device</div>
              </div>
              <label class="switch-wrap">
                <input type="checkbox" id="cb-chat-lock" ${this.chat.isLocked ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="option-row" id="row-toggle-fav">
              <span class="option-icon">${Icons.star('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Add to Favourites</div>
                <div class="option-subtitle">${this.chat.isFavourite ? 'Added' : 'Add to quick filters'}</div>
              </div>
              <label class="switch-wrap">
                <input type="checkbox" id="cb-chat-fav" ${this.chat.isFavourite ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Danger Actions (Using Custom Dialogs) -->
          <div class="info-danger-group">
            <button type="button" class="danger-btn-row" id="btn-clear-chat-history">
              <span class="danger-icon">${Icons.close('', 20)}</span>
              <span>Clear chat</span>
            </button>
            <button type="button" class="danger-btn-row" id="btn-delete-entire-chat">
              <span class="danger-icon">${Icons.trash('', 20)}</span>
              <span>Delete chat</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(chatMedia, msgs);
  }

  bindEvents(chatMedia, msgs) {
    // Back button
    this.container.querySelector('#btn-info-back').addEventListener('click', () => {
      this.router.navigate(`#/chat/${this.chatId}`);
    });

    // Profile Picture Scroll Animation (Header) - Sequence 1, 2, 3 (Step 6 / Reference 6,7,8)
    const scrollBody = this.container.querySelector('#contact-scroll-body');
    const heroAvatar = this.container.querySelector('#contact-hero-avatar');
    const heroName = this.container.querySelector('#contact-hero-name');
    const compactHeader = this.container.querySelector('#contact-header-compact');

    let scrollTicking = false;
    scrollBody.addEventListener('scroll', () => {
      if (!scrollTicking) {
        window.requestAnimationFrame(() => {
          const scrollTop = scrollBody.scrollTop;
          const threshold = 130;
          const progress = Math.min(1, Math.max(0, scrollTop / threshold));

          // Subtle shrink and fade of hero avatar
          if (heroAvatar) {
            heroAvatar.style.transform = `scale(${1 - progress * 0.45}) translateY(${-progress * 25}px)`;
            heroAvatar.style.opacity = `${1 - progress * 0.85}`;
          }
          if (heroName) {
            heroName.style.opacity = `${1 - progress * 0.9}`;
          }

          // Slide and reveal compact profile in sticky header
          if (compactHeader) {
            compactHeader.style.opacity = `${progress}`;
            compactHeader.style.transform = `translateY(${(1 - progress) * 10}px)`;
            compactHeader.style.pointerEvents = progress > 0.6 ? 'auto' : 'none';
          }

          scrollTicking = false;
        });
        scrollTicking = true;
      }
    }, { passive: true });

    // Avatar upload with Crop & Scale Modal
    const avatarInput = this.container.querySelector('#hero-avatar-input');
    avatarInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const croppedBlob = await openImageCropper(file);
        if (croppedBlob) {
          await db.updateChat(this.chatId, { avatarBlob: croppedBlob });
          this.chat.avatarBlob = croppedBlob;
          const url = URL.createObjectURL(croppedBlob);
          const heroImg = this.container.querySelector('.hero-avatar-wrap img');
          if (heroImg) heroImg.src = url;
          const compactImg = this.container.querySelector('.compact-avatar-img');
          if (compactImg) compactImg.src = url;
          Toast.show('Avatar updated');
        }
      }
    });

    // Populate media horizontal strip
    const mediaStrip = this.container.querySelector('#info-media-strip');
    const visualMedia = chatMedia.filter((m) => {
      const mime = m.mimeType || m.type || '';
      return mime.startsWith('image/') || mime.startsWith('video/') || mime === 'image' || mime === 'video';
    });

    if (visualMedia.length === 0) {
      mediaStrip.innerHTML = `<div class="empty-media-hint">No media shared yet</div>`;
    } else {
      visualMedia.slice(0, 10).forEach((med) => {
        const thumb = document.createElement('div');
        thumb.className = 'strip-thumb-box';
        const url = URL.createObjectURL(med.blob);

        const mime = med.mimeType || med.type || '';
        if (mime.startsWith('video/') || mime === 'video') {
          thumb.innerHTML = `
            <video src="${url}" preload="metadata" class="strip-thumb-img"></video>
            <div class="strip-video-icon">${Icons.play('', 14)}</div>
          `;
        } else {
          thumb.innerHTML = `<img src="${url}" class="strip-thumb-img" alt="media" />`;
        }

        thumb.addEventListener('click', () => {
          const parentMsg = msgs.find((m) => m.mediaId === med.id) || {};
          mediaLightbox.show(med, parentMsg, () => {
            this.router.navigate(`#/chat/${this.chatId}`);
          });
        });

        mediaStrip.appendChild(thumb);
      });
    }

    // Chat Lock Toggle
    const lockCb = this.container.querySelector('#cb-chat-lock');
    lockCb.addEventListener('change', async () => {
      if (lockCb.checked) {
        const pinSet = await PinDialog.promptSetup();
        if (pinSet) {
          await db.updateChat(this.chatId, { isLocked: true });
          Toast.show('Chat locked and protected with PIN');
        } else {
          lockCb.checked = false;
        }
      } else {
        const unlocked = await PinDialog.promptUnlock();
        if (unlocked) {
          await db.updateChat(this.chatId, { isLocked: false });
          Toast.show('Chat unlocked');
        } else {
          lockCb.checked = true;
        }
      }
    });

    // Favourites Toggle
    const favCb = this.container.querySelector('#cb-chat-fav');
    favCb.addEventListener('change', async () => {
      await db.updateChat(this.chatId, { isFavourite: favCb.checked });
      Toast.show(favCb.checked ? 'Added to Favourites' : 'Removed from Favourites');
    });

    // Clear Chat (Custom confirmation dialog)
    this.container.querySelector('#btn-clear-chat-history').addEventListener('click', async () => {
      const confirmed = await showConfirm({
        title: 'Clear conversation?',
        message: 'Clear all messages in this conversation? Media files will remain in your gallery.',
        confirmText: 'Clear messages',
        cancelText: 'Cancel',
        isDanger: true
      });
      if (confirmed) {
        for (const m of msgs) await db.deleteMessage(m.id);
        await db.updateChat(this.chatId, { lastMessage: null, updatedAt: Date.now() });
        Toast.show('Messages cleared');
        this.router.navigate(`#/chat/${this.chatId}`);
      }
    });

    // Delete Chat (Custom confirmation dialog)
    this.container.querySelector('#btn-delete-entire-chat').addEventListener('click', async () => {
      const confirmed = await showConfirm({
        title: 'Delete chat?',
        message: `Delete entire conversation with "${this.chat.name}"? This cannot be undone.`,
        confirmText: 'Delete chat',
        cancelText: 'Cancel',
        isDanger: true
      });
      if (confirmed) {
        await db.deleteChat(this.chatId);
        Toast.show('Conversation deleted');
        this.router.navigate('#/chats');
      }
    });
  }
}
