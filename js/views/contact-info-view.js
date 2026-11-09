// Screen 5: Contact / Chat Info Screen
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { PinDialog } from '../components/pin-dialog.js';
import { mediaLightbox } from '../components/lightbox.js';
import { Toast } from '../components/toast.js';

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

    rootEl.innerHTML = `
      <div class="screen-view contact-info-screen">
        <header class="wa-app-bar sheet-style-header">
          <button class="app-bar-icon-btn" id="btn-info-back">${Icons.arrowBack('', 24)}</button>
          <div class="app-title">Chat info</div>
        </header>

        <div class="contact-info-scroll-body">
          <!-- Hero Section -->
          <div class="contact-hero-card">
            <div class="hero-avatar-wrap">
              ${this.chat.avatarBlob ? `<img src="${URL.createObjectURL(this.chat.avatarBlob)}" class="hero-avatar-img" />` : (this.chat.isGroup ? Icons.groupAvatar('', 120) : Icons.userAvatar('', 120))}
              <label class="hero-avatar-edit-badge" title="Change photo">
                <input type="file" id="hero-avatar-input" accept="image/*" style="display:none;" />
                ${Icons.camera('', 18)}
              </label>
            </div>
            <h2 class="hero-contact-name" dir="auto">${this.chat.name}</h2>
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

          <!-- Danger Actions -->
          <div class="info-danger-group">
            <button class="danger-btn-row" id="btn-clear-chat-history">
              <span class="danger-icon">${Icons.close('', 20)}</span>
              <span>Clear chat</span>
            </button>
            <button class="danger-btn-row" id="btn-delete-entire-chat">
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

    // Avatar upload
    const avatarInput = this.container.querySelector('#hero-avatar-input');
    avatarInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        await db.updateChat(this.chatId, { avatarBlob: file });
        this.chat.avatarBlob = file;
        this.container.querySelector('.hero-avatar-wrap img').src = URL.createObjectURL(file);
        Toast.show('Avatar updated');
      }
    });

    // Populate media horizontal strip
    const mediaStrip = this.container.querySelector('#info-media-strip');
    const visualMedia = chatMedia.filter((m) => m.mimeType.startsWith('image/') || m.mimeType.startsWith('video/'));

    if (visualMedia.length === 0) {
      mediaStrip.innerHTML = `<div class="empty-media-hint">No media shared yet</div>`;
    } else {
      visualMedia.slice(0, 10).forEach((med) => {
        const thumb = document.createElement('div');
        thumb.className = 'strip-thumb-box';
        const url = URL.createObjectURL(med.blob);

        if (med.mimeType.startsWith('video/')) {
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
        // Prompt for 4-digit PIN setup/verification
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

    // Clear Chat
    this.container.querySelector('#btn-clear-chat-history').addEventListener('click', async () => {
      if (confirm('Clear all messages in this conversation?')) {
        for (const m of msgs) await db.deleteMessage(m.id);
        await db.updateChat(this.chatId, { lastMessage: null, updatedAt: Date.now() });
        Toast.show('Messages cleared');
        this.router.navigate(`#/chat/${this.chatId}`);
      }
    });

    // Delete Chat
    this.container.querySelector('#btn-delete-entire-chat').addEventListener('click', async () => {
      if (confirm(`Delete entire conversation with "${this.chat.name}"? This cannot be undone.`)) {
        await db.deleteChat(this.chatId);
        Toast.show('Conversation deleted');
        this.router.navigate('#/chats');
      }
    });
  }
}
