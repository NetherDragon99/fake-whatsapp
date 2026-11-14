// Screen 5: Contact / Chat Info Screen with Collapsing Profile Animation
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { PinDialog } from '../components/pin-dialog.js';
import { mediaLightbox } from '../components/lightbox.js';
import { Toast } from '../components/toast.js';
import { showConfirm, showAlert, showPrompt, showLoadingDialog } from '../components/custom-dialog.js';
import { openImageCropper } from '../components/image-cropper.js';
import { ChatExporter } from '../components/chat-exporter.js';

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
    const starredCount = msgs.filter((m) => m.isStarred).length;

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
          <!-- Hero Section (Collapsible on scroll - Task 7 Avatar fix) -->
          <div class="contact-hero-card">
            <div class="hero-avatar-wrap" id="contact-hero-avatar">
              <div class="hero-avatar-circle">
                ${avatarUrl ? `<img src="${avatarUrl}" class="hero-avatar-img" alt="Avatar" />` : (this.chat.isGroup ? Icons.groupAvatar('', 120) : Icons.userAvatar('', 120))}
              </div>
              <label class="hero-avatar-edit-badge" title="Change photo">
                <input type="file" id="hero-avatar-input" accept="image/*" style="display:none;" />
                ${Icons.camera('', 18)}
              </label>
            </div>
            <h2 class="hero-contact-name" id="contact-hero-name" dir="auto">${this.chat.name}</h2>
            <div class="hero-contact-sub">${this.chat.isGroup ? 'Group conversation' : (this.chat.isSelfChat ? 'Message yourself' : 'Contact')}</div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Media, Links, and Docs Horizontal Strip with Dedicated Stickers Tab (Task 5) -->
          <div class="info-section-card">
            <div class="section-row-header" id="btn-view-all-media" style="cursor:pointer;" title="View all in gallery">
              <span class="section-title">Media, links, and docs</span>
              <span class="section-counter" id="info-media-total-count">${chatMedia.length} &gt;</span>
            </div>
            <div class="info-media-chips" style="display:flex; gap:8px; padding:4px 16px 8px 16px;">
              <button type="button" class="filter-chip active" id="chip-show-photos">Photos &amp; Videos</button>
              <button type="button" class="filter-chip" id="chip-show-stickers">Stickers</button>
            </div>
            <div class="media-horizontal-strip" id="info-media-strip">
              <!-- Populated dynamically -->
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Chat Management Actions (Migrated from 3-Dot Menu - Task 6 & Task 10) -->
          <div class="info-options-group">
            <div class="option-row clickable" id="row-search-in-chat">
              <span class="option-icon">${Icons.search('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Search in chat</div>
                <div class="option-subtitle">Find messages, media, or keywords in this conversation</div>
              </div>
            </div>

            <div class="option-row clickable" id="row-swap-perspective">
              <span class="option-icon">${Icons.swap('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Swap Sender / Receiver</div>
                <div class="option-subtitle">Flip incoming and outgoing sides for this chat</div>
              </div>
            </div>

            <div class="option-row clickable" id="row-jump-to-date">
              <span class="option-icon">${Icons.calendar('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Jump to Date</div>
                <div class="option-subtitle">Navigate to messages from a specific date</div>
              </div>
              <input type="date" id="info-date-picker" style="display:none;" />
            </div>

            <div class="option-row clickable" id="row-edit-chat-info">
              <span class="option-icon">${Icons.userAvatar('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Edit Chat Info</div>
                <div class="option-subtitle">Change contact or group name</div>
              </div>
            </div>

            <div class="option-row clickable" id="row-starred-messages">
              <span class="option-icon">${Icons.star('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Starred messages</div>
                <div class="option-subtitle">${starredCount > 0 ? `${starredCount} message${starredCount > 1 ? 's' : ''}` : 'None'}</div>
              </div>
            </div>

            <div class="option-row clickable" id="row-chat-wallpaper">
              <span class="option-icon">${Icons.gallery('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Wallpaper</div>
                <div class="option-subtitle">Change background theme and dimming</div>
              </div>
            </div>

            <div class="option-row clickable" id="row-manage-lists">
              <span class="option-icon">${Icons.archive('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Add to / Manage Lists</div>
                <div class="option-subtitle">Organize this chat into custom home tabs</div>
              </div>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Options & Toggles -->
          <div class="info-options-group">
            <!-- Row: Export chat (right on top of Manage storage) -->
            <div class="option-row clickable" id="row-export-chat">
              <span class="option-icon">${Icons.exportChat('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Export chat</div>
                <div class="option-subtitle">Save messages and media as WhatsApp archive</div>
              </div>
            </div>

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
      this.router.back();
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
          await db.updateChat(this.chatId, { avatarBlob: croppedBlob, updatedAt: Date.now() });
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

    // View all media in gallery
    this.container.querySelector('#btn-view-all-media').addEventListener('click', () => {
      this.router.navigate(`#/gallery?chatId=${this.chatId}`);
    });

    // Populate media horizontal strip with strict sticker separation (Task 5)
    const isSticker = (m) => m.type === 'sticker' || m.mediaType === 'sticker' || (m.filename && (/\.webp$/i.test(m.filename) || /stk-/i.test(m.filename) || /sticker/i.test(m.filename))) || m.mimeType === 'image/webp';
    const photosAndVideos = chatMedia.filter((m) => {
      const mime = m.mimeType || m.type || '';
      const isVisual = mime.startsWith('image/') || mime.startsWith('video/') || mime === 'image' || mime === 'video';
      return isVisual && !isSticker(m);
    });
    const stickerMedia = chatMedia.filter((m) => isSticker(m));

    const mediaStrip = this.container.querySelector('#info-media-strip');
    const chipPhotos = this.container.querySelector('#chip-show-photos');
    const chipStickers = this.container.querySelector('#chip-show-stickers');

    let currentStripCategory = 'photos';

    const renderStrip = () => {
      mediaStrip.innerHTML = '';
      const items = currentStripCategory === 'photos' ? photosAndVideos : stickerMedia;
      if (items.length === 0) {
        mediaStrip.innerHTML = `<div class="empty-media-hint">No ${currentStripCategory === 'photos' ? 'photos or videos' : 'stickers'} shared yet</div>`;
        return;
      }

      items.slice(0, 15).forEach((med) => {
        const thumb = document.createElement('div');
        thumb.className = 'strip-thumb-box';
        const url = URL.createObjectURL(med.blob);
        const mime = med.mimeType || med.type || '';

        if (currentStripCategory === 'stickers') {
          thumb.innerHTML = `<img src="${url}" class="strip-thumb-img" style="object-fit:contain; background:transparent;" alt="sticker" />`;
          thumb.addEventListener('click', () => {
            Toast.show('Sticker');
          });
        } else if (mime.startsWith('video/') || mime === 'video') {
          thumb.innerHTML = `
            <video src="${url}" preload="metadata" class="strip-thumb-img"></video>
            <div class="strip-video-icon">${Icons.play('', 14)}</div>
          `;
          thumb.addEventListener('click', () => {
            const parentMsg = msgs.find((m) => m.mediaId === med.id) || {};
            mediaLightbox.show(med, parentMsg, (targetChatId, targetMsgId) => {
              const mId = targetMsgId || parentMsg.id || med.id;
              this.router.navigate(`#/chat/${this.chatId}?msgId=${mId}`);
            });
          });
        } else {
          thumb.innerHTML = `<img src="${url}" class="strip-thumb-img" alt="media" />`;
          thumb.addEventListener('click', () => {
            const parentMsg = msgs.find((m) => m.mediaId === med.id) || {};
            mediaLightbox.show(med, parentMsg, (targetChatId, targetMsgId) => {
              const mId = targetMsgId || parentMsg.id || med.id;
              this.router.navigate(`#/chat/${this.chatId}?msgId=${mId}`);
            });
          });
        }

        mediaStrip.appendChild(thumb);
      });
    };

    chipPhotos.addEventListener('click', () => {
      chipPhotos.classList.add('active');
      chipStickers.classList.remove('active');
      currentStripCategory = 'photos';
      renderStrip();
    });

    chipStickers.addEventListener('click', () => {
      chipStickers.classList.add('active');
      chipPhotos.classList.remove('active');
      currentStripCategory = 'stickers';
      renderStrip();
    });

    renderStrip();

    // --- Chat Management Actions (Migrated from 3-Dot Menu - Task 6) ---
    // Search in chat
    this.container.querySelector('#row-search-in-chat').addEventListener('click', () => {
      this.router.navigate(`#/chat/${this.chatId}?search=1`);
    });

    // Swap Sender / Receiver
    this.container.querySelector('#row-swap-perspective').addEventListener('click', async () => {
      await this.flipPerspective(msgs);
    });

    // Jump to Date
    const datePicker = this.container.querySelector('#info-date-picker');
    this.container.querySelector('#row-jump-to-date').addEventListener('click', () => {
      datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
    });
    datePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        this.router.navigate(`#/chat/${this.chatId}?jumpDate=${e.target.value}`);
      }
    });

    // Edit Chat Info (Task 9)
    this.container.querySelector('#row-edit-chat-info').addEventListener('click', () => {
      this.openEditChatModal();
    });

    // Export Chat (Prompt: Without media vs Include media)
    const exportRow = this.container.querySelector('#row-export-chat');
    if (exportRow) {
      exportRow.addEventListener('click', () => {
        ChatExporter.showExportPrompt(this.chatId);
      });
    }

    const moreBtn = this.container.querySelector('#btn-info-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        ChatExporter.showExportPrompt(this.chatId);
      });
    }

    // Starred messages
    this.container.querySelector('#row-starred-messages')?.addEventListener('click', () => {
      this.router.navigate(`#/starred?chatId=${this.chatId}`);
    });

    // Wallpaper
    this.container.querySelector('#row-chat-wallpaper').addEventListener('click', () => {
      this.router.navigate(`#/wallpaper-picker?chatId=${this.chatId}`);
    });

    // Add to / Manage Lists (Task 10)
    this.container.querySelector('#row-manage-lists').addEventListener('click', () => {
      this.openManageListsModal();
    });

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

  // --- Migrated Actions Implementation ---
  async flipPerspective(msgs) {
    if (!msgs || msgs.length === 0) {
      msgs = await db.getMessages(this.chatId);
    }
    if (msgs.length === 0) {
      Toast.show('No messages in this chat');
      return;
    }

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

      loading.close();
      Toast.show(`Perspective swapped with ${updatedChat.name}!`);
      this.router.navigate(`#/chat/${this.chatId}`);
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

  async openEditChatModal() {
    const newName = await showPrompt({
      title: 'Edit Chat Info',
      message: 'Enter new contact or group name:',
      defaultValue: this.chat.name,
      placeholder: 'Name',
      confirmText: 'Save',
      cancelText: 'Cancel'
    });
    if (newName && newName.trim()) {
      const trimmed = newName.trim();
      await db.updateChat(this.chatId, { name: trimmed, updatedAt: Date.now() });
      this.chat.name = trimmed;
      const heroName = this.container.querySelector('#contact-hero-name');
      if (heroName) heroName.textContent = trimmed;
      const compactName = this.container.querySelector('.compact-header-name');
      if (compactName) compactName.textContent = trimmed;
      Toast.show('Chat name updated');
    }
  }

  async openManageListsModal() {
    const filters = await db.getFilters();
    if (filters.length === 0) {
      const wantCreate = await showConfirm({
        title: 'No custom lists',
        message: 'You have not created any custom lists yet. Would you like to create one now?',
        confirmText: 'Create list',
        cancelText: 'Cancel'
      });
      if (wantCreate) {
        const listName = await showPrompt({
          title: 'New List Name',
          message: 'Enter a name for your custom list (e.g., Work, Family):',
          placeholder: 'List name',
          confirmText: 'Create',
          cancelText: 'Cancel'
        });
        if (listName && listName.trim()) {
          const newList = {
            id: db.generateUUID(),
            name: listName.trim(),
            chatIds: [this.chatId]
          };
          await db.saveFilter(newList);
          Toast.show(`Added to "${newList.name}"`);
        }
      }
      return;
    }

    // Modal with checklist of custom lists
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay custom-dialog-overlay active';

    let listRowsHtml = filters.map((f) => {
      const isChecked = f.chatIds && f.chatIds.includes(this.chatId);
      return `
        <label class="list-select-item" style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer;">
          <input type="checkbox" class="wa-checkbox" data-filter-id="${f.id}" ${isChecked ? 'checked' : ''} />
          <span style="font-size:15px; color:var(--wa-text-primary); font-weight:500;">${f.name}</span>
        </label>
      `;
    }).join('');

    overlay.innerHTML = `
      <div class="custom-dialog-card" role="dialog" aria-modal="true">
        <h3 class="custom-dialog-title">Manage Lists</h3>
        <div class="custom-dialog-body" style="max-height:260px; overflow-y:auto; margin-top:8px;">
          ${listRowsHtml}
        </div>
        <div class="custom-dialog-actions" style="margin-top:16px;">
          <button type="button" class="dialog-btn dialog-btn-cancel">Cancel</button>
          <button type="button" class="dialog-btn dialog-btn-confirm">Save</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      overlay.classList.remove('active');
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('.dialog-btn-cancel').onclick = cleanup;
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };

    overlay.querySelector('.dialog-btn-confirm').onclick = async () => {
      const checkboxes = overlay.querySelectorAll('.wa-checkbox');
      for (const cb of checkboxes) {
        const filterId = cb.dataset.filterId;
        const targetFilter = filters.find((f) => f.id === filterId);
        if (targetFilter) {
          if (!targetFilter.chatIds) targetFilter.chatIds = [];
          if (cb.checked && !targetFilter.chatIds.includes(this.chatId)) {
            targetFilter.chatIds.push(this.chatId);
            await db.saveFilter(targetFilter);
          } else if (!cb.checked && targetFilter.chatIds.includes(this.chatId)) {
            targetFilter.chatIds = targetFilter.chatIds.filter((id) => id !== this.chatId);
            await db.saveFilter(targetFilter);
          }
        }
      }
      cleanup();
      Toast.show('Lists updated');
    };

    document.body.appendChild(overlay);
  }
}
