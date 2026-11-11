// Screen: Chat Storage Detail View (Settings -> Storage and Data -> Manage Storage -> Chat)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { Toast } from '../components/toast.js';
import { showConfirm } from '../components/custom-dialog.js';
import { mediaLightbox } from '../components/lightbox.js';

export class ChatStorageView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.chatId = null;
    this.chat = null;
    this.stats = null;
    this.selectedMediaIds = new Set();
    this.isSelectionMode = false;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.chatId = params.id;
    this.selectedMediaIds.clear();
    this.isSelectionMode = false;

    if (!this.chatId) {
      this.router.navigate('#/manage-storage');
      return;
    }

    await this.loadData();
    this.renderUI();
  }

  async loadData() {
    this.chat = await db.getChat(this.chatId);
    if (!this.chat) return;
    this.stats = await db.getChatDetailedStorage(this.chatId);
    this.msgs = await db.getMessages(this.chatId);
  }

  renderUI() {
    if (!this.container || !this.chat || !this.stats) {
      if (this.container) {
        this.container.innerHTML = `<div class="empty-state">Chat not found. <a href="#/manage-storage">Go back</a></div>`;
      }
      return;
    }

    const avatarUrl = this.chat.avatarBlob ? URL.createObjectURL(this.chat.avatarBlob) : null;
    const selectedBytes = this.getSelectedBytes();

    this.container.innerHTML = `
      <div class="screen-view chat-storage-screen">
        <!-- Normal Header -->
        <header class="wa-app-bar" id="chat-storage-app-bar" ${this.isSelectionMode ? 'style="display:none;"' : ''}>
          <button type="button" class="app-bar-icon-btn" id="btn-chat-storage-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="header-avatar-circle">
            ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar" />` : (this.chat.isGroup ? Icons.groupAvatar('', 36) : Icons.userAvatar('', 36))}
          </div>
          <div class="header-chat-info">
            <div class="app-title" dir="auto">${this.chat.name}</div>
            <div class="app-subtitle">${this.stats.formattedTotal}</div>
          </div>
        </header>

        <!-- Contextual Selection Header -->
        <header class="wa-app-bar selection-bar" id="chat-storage-selection-bar" ${!this.isSelectionMode ? 'style="display:none;"' : ''}>
          <button type="button" class="app-bar-icon-btn" id="btn-cancel-media-select" aria-label="Cancel">
            ${Icons.close('', 24)}
          </button>
          <div class="selection-count-title" id="media-select-count">
            ${this.selectedMediaIds.size} selected (${db.formatBytes(selectedBytes)})
          </div>
          <div class="app-bar-actions">
            <button type="button" class="app-bar-text-btn" id="btn-select-all-media">
              ${this.selectedMediaIds.size === this.stats.allMedia.length ? 'Deselect All' : 'Select All'}
            </button>
            <button type="button" class="app-bar-icon-btn danger-icon" id="btn-delete-selected-media" title="Delete selected files">
              ${Icons.trash('', 22)}
            </button>
          </div>
        </header>

        <div class="chat-storage-scroll-body" id="chat-storage-scroller">
          <!-- Total Storage & Quick Clear Card -->
          <div class="storage-summary-card">
            <div class="summary-meta">
              <span class="summary-size">${this.stats.formattedTotal}</span>
              <span class="summary-count">${this.stats.totalItems} total items (${this.stats.starredCount} starred)</span>
            </div>
            <button type="button" class="clear-all-cta-btn" id="btn-clear-all-chat-data">
              ${Icons.trash('', 16)}
              <span>Clear Entire Chat Storage</span>
            </button>
          </div>

          <!-- Category Breakdown Section -->
          <div class="storage-category-cards-wrap">
            <div class="category-section-title">Clear by Category</div>
            
            <div class="category-cards-grid">
              <!-- Photos -->
              <div class="category-stat-card ${this.stats.photos.count === 0 ? 'empty-cat' : ''}">
                <div class="cat-icon-badge photos">${Icons.camera('', 20)}</div>
                <div class="cat-info">
                  <div class="cat-name">Photos</div>
                  <div class="cat-sub">${this.stats.photos.count} items • ${this.stats.photos.formatted}</div>
                </div>
                ${this.stats.photos.count > 0 ? `
                  <button type="button" class="cat-clear-btn" data-category="photos">Clear</button>
                ` : '<span class="cat-zero">0 B</span>'}
              </div>

              <!-- Videos -->
              <div class="category-stat-card ${this.stats.videos.count === 0 ? 'empty-cat' : ''}">
                <div class="cat-icon-badge videos">${Icons.callVideo('', 20)}</div>
                <div class="cat-info">
                  <div class="cat-name">Videos</div>
                  <div class="cat-sub">${this.stats.videos.count} items • ${this.stats.videos.formatted}</div>
                </div>
                ${this.stats.videos.count > 0 ? `
                  <button type="button" class="cat-clear-btn" data-category="videos">Clear</button>
                ` : '<span class="cat-zero">0 B</span>'}
              </div>

              <!-- Voice Notes / Audio -->
              <div class="category-stat-card ${this.stats.audio.count === 0 ? 'empty-cat' : ''}">
                <div class="cat-icon-badge audio">${Icons.mic('', 20)}</div>
                <div class="cat-info">
                  <div class="cat-name">Voice Notes</div>
                  <div class="cat-sub">${this.stats.audio.count} items • ${this.stats.audio.formatted}</div>
                </div>
                ${this.stats.audio.count > 0 ? `
                  <button type="button" class="cat-clear-btn" data-category="audio">Clear</button>
                ` : '<span class="cat-zero">0 B</span>'}
              </div>

              <!-- Documents -->
              <div class="category-stat-card ${this.stats.documents.count === 0 ? 'empty-cat' : ''}">
                <div class="cat-icon-badge docs">${Icons.documentIcon('', 20)}</div>
                <div class="cat-info">
                  <div class="cat-name">Documents</div>
                  <div class="cat-sub">${this.stats.documents.count} items • ${this.stats.documents.formatted}</div>
                </div>
                ${this.stats.documents.count > 0 ? `
                  <button type="button" class="cat-clear-btn" data-category="documents">Clear</button>
                ` : '<span class="cat-zero">0 B</span>'}
              </div>

              <!-- Messages -->
              <div class="category-stat-card ${this.stats.messages.count === 0 ? 'empty-cat' : ''}">
                <div class="cat-icon-badge msgs">${Icons.chatsTab('', 20)}</div>
                <div class="cat-info">
                  <div class="cat-name">Text Messages</div>
                  <div class="cat-sub">${this.stats.messages.count} msgs • ${this.stats.messages.formatted}</div>
                </div>
                ${this.stats.messages.count > 0 ? `
                  <button type="button" class="cat-clear-btn" data-category="messages">Clear</button>
                ` : '<span class="cat-zero">0 B</span>'}
              </div>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Files Media Grid Section -->
          <div class="chat-storage-files-section">
            <div class="files-section-header">
              <div class="files-section-title">Media & Files (${this.stats.allMedia.length})</div>
              ${this.stats.allMedia.length > 0 ? `
                <button type="button" class="files-select-toggle-btn" id="btn-toggle-media-select">
                  ${this.isSelectionMode ? 'Cancel' : 'Select'}
                </button>
              ` : ''}
            </div>

            <div class="chat-storage-media-grid" id="chat-storage-media-grid">
              <!-- Populated dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderMediaGrid();
  }

  getSelectedBytes() {
    let bytes = 0;
    if (!this.stats || !this.stats.allMedia) return 0;
    for (const m of this.stats.allMedia) {
      if (this.selectedMediaIds.has(m.id)) {
        bytes += m.size || (m.blob && m.blob.size) || 0;
      }
    }
    return bytes;
  }

  renderMediaGrid() {
    const gridEl = this.container.querySelector('#chat-storage-media-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    if (!this.stats.allMedia || this.stats.allMedia.length === 0) {
      gridEl.innerHTML = `<div class="empty-media-hint" style="grid-column: 1/-1; padding: 24px; text-align: center; color: var(--wa-text-secondary);">No media files in this conversation</div>`;
      return;
    }

    this.stats.allMedia.forEach((med) => {
      const isSelected = this.selectedMediaIds.has(med.id);
      const tile = document.createElement('div');
      tile.className = `storage-media-tile ${isSelected ? 'selected' : ''}`;
      tile.dataset.mediaId = med.id;

      const url = URL.createObjectURL(med.blob);
      const cat = db.categorizeMediaRecord(med);
      const sizeStr = db.formatBytes(med.size || (med.blob && med.blob.size) || 0);

      let innerContent = '';
      if (cat === 'videos') {
        innerContent = `
          <video src="${url}" preload="metadata" class="tile-thumb"></video>
          <div class="tile-video-badge">${Icons.play('', 14)}</div>
        `;
      } else if (cat === 'photos' || cat === 'sticker') {
        innerContent = `<img src="${url}" alt="${med.filename}" loading="lazy" class="tile-thumb" ${cat === 'sticker' ? 'style="object-fit:contain; background:transparent;"' : ''} />`;
      } else if (cat === 'audio') {
        innerContent = `
          <div class="tile-audio-placeholder">
            ${Icons.mic('', 24)}
            <span>Voice Note</span>
          </div>
        `;
      } else {
        const isPdf = med.mimeType === 'application/pdf' || med.type === 'pdf';
        innerContent = `
          <div class="tile-doc-placeholder">
            ${isPdf ? Icons.pdfIcon('', 26) : Icons.documentIcon('', 24)}
            <span class="doc-tile-name">${med.filename || 'Doc'}</span>
          </div>
        `;
      }

      tile.innerHTML = `
        ${innerContent}
        <div class="tile-size-pill">${sizeStr}</div>
        <div class="tile-select-checkbox ${this.isSelectionMode ? 'visible' : ''}">
          <input type="checkbox" class="wa-checkbox" ${isSelected ? 'checked' : ''} />
        </div>
      `;

      // Long press triggers multi-select
      let pressTimer = null;
      let startX = 0;
      let startY = 0;

      const startLongPress = (e) => {
        startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        pressTimer = setTimeout(() => {
          if (!this.isSelectionMode) {
            this.setSelectionMode(true);
            this.toggleSelectMedia(med.id);
          }
        }, 400);
      };

      const cancelLongPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };

      tile.addEventListener('touchstart', startLongPress, { passive: true });
      tile.addEventListener('touchmove', (e) => {
        const curX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const curY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        if (Math.hypot(curX - startX, curY - startY) > 10) cancelLongPress();
      }, { passive: true });
      tile.addEventListener('touchend', cancelLongPress, { passive: true });
      tile.addEventListener('touchcancel', cancelLongPress, { passive: true });

      tile.addEventListener('mousedown', startLongPress);
      tile.addEventListener('mousemove', (e) => {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancelLongPress();
      });
      tile.addEventListener('mouseup', cancelLongPress);
      tile.addEventListener('mouseleave', cancelLongPress);

      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        cancelLongPress();
        if (!this.isSelectionMode) this.setSelectionMode(true);
        this.toggleSelectMedia(med.id);
      });

      tile.addEventListener('click', () => {
        if (this.isSelectionMode) {
          this.toggleSelectMedia(med.id);
        } else {
          // Open lightbox
          const parentMsg = (this.msgs || []).find((m) => m.mediaId === med.id) || {};
          mediaLightbox.show(med, parentMsg.id ? parentMsg : { chatId: this.chatId, id: med.id }, (targetChatId, targetMsgId) => {
            const mId = targetMsgId || parentMsg.id || med.id;
            this.router.navigate(`#/chat/${this.chatId}?msgId=${mId}`);
          });
        }
      });

      gridEl.appendChild(tile);
    });
  }

  setSelectionMode(active) {
    this.isSelectionMode = active;
    if (!active) {
      this.selectedMediaIds.clear();
    }
    const normalBar = this.container.querySelector('#chat-storage-app-bar');
    const selectBar = this.container.querySelector('#chat-storage-selection-bar');
    if (normalBar) normalBar.style.display = active ? 'none' : 'flex';
    if (selectBar) selectBar.style.display = active ? 'flex' : 'none';
    this.updateSelectionHeader();
    this.renderMediaGrid();
  }

  toggleSelectMedia(mediaId) {
    if (this.selectedMediaIds.has(mediaId)) {
      this.selectedMediaIds.delete(mediaId);
    } else {
      this.selectedMediaIds.add(mediaId);
    }
    this.updateSelectionHeader();
    this.renderMediaGrid();
  }

  updateSelectionHeader() {
    const title = this.container.querySelector('#media-select-count');
    const selectedBytes = this.getSelectedBytes();
    if (title) {
      title.textContent = `${this.selectedMediaIds.size} selected (${db.formatBytes(selectedBytes)})`;
    }
    const selectAllBtn = this.container.querySelector('#btn-select-all-media');
    if (selectAllBtn) {
      selectAllBtn.textContent = this.selectedMediaIds.size === this.stats.allMedia.length ? 'Deselect All' : 'Select All';
    }
  }

  bindEvents() {
    // Back navigation
    this.container.querySelector('#btn-chat-storage-back')?.addEventListener('click', () => {
      this.router.navigate('#/manage-storage');
    });

    // Toggle select mode
    this.container.querySelector('#btn-toggle-media-select')?.addEventListener('click', () => {
      this.setSelectionMode(!this.isSelectionMode);
    });

    // Cancel select mode
    this.container.querySelector('#btn-cancel-media-select')?.addEventListener('click', () => {
      this.setSelectionMode(false);
    });

    // Select All media
    this.container.querySelector('#btn-select-all-media')?.addEventListener('click', () => {
      if (this.selectedMediaIds.size === this.stats.allMedia.length) {
        this.selectedMediaIds.clear();
      } else {
        this.stats.allMedia.forEach((m) => this.selectedMediaIds.add(m.id));
      }
      this.updateSelectionHeader();
      this.renderMediaGrid();
    });

    // Delete selected individual media
    this.container.querySelector('#btn-delete-selected-media')?.addEventListener('click', async () => {
      if (this.selectedMediaIds.size === 0) return;
      const count = this.selectedMediaIds.size;
      const bytes = this.getSelectedBytes();

      const confirmed = await showConfirm({
        title: `Delete ${count} item${count > 1 ? 's' : ''}?`,
        message: `This will permanently delete the selected ${count} file${count > 1 ? 's' : ''} (${db.formatBytes(bytes)}) from storage.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        isDanger: true
      });

      if (confirmed) {
        const ids = Array.from(this.selectedMediaIds);
        await db.deleteMediaBatch(ids);
        Toast.show(`Deleted ${count} file${count > 1 ? 's' : ''}`);
        this.setSelectionMode(false);
        await this.loadData();
        this.renderUI();
      }
    });

    // Clear entire chat storage button
    this.container.querySelector('#btn-clear-all-chat-data')?.addEventListener('click', async () => {
      const confirmed = await showConfirm({
        title: 'Clear entire chat storage?',
        message: `Permanently delete all media and messages in "${this.chat.name}" (${this.stats.formattedTotal})? The contact will remain.`,
        confirmText: 'Clear All',
        cancelText: 'Cancel',
        isDanger: true,
        extraCheckbox: {
          id: 'checkbox-clear-starred-all',
          label: 'Delete starred messages too',
          checked: false
        }
      });

      if (confirmed) {
        const deleteStarred = Boolean(document.getElementById('checkbox-clear-starred-all')?.checked);
        await db.clearChatCategory(this.chatId, 'all', deleteStarred);
        Toast.show('Chat storage cleared');
        await this.loadData();
        this.renderUI();
      }
    });

    // Clear by category buttons
    this.container.querySelectorAll('.cat-clear-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const category = btn.dataset.category;
        const catData = this.stats[category] || { count: 0, formatted: '0 B' };
        const label = category === 'photos' ? 'Photos' :
                      category === 'videos' ? 'Videos' :
                      category === 'audio' ? 'Voice Notes' :
                      category === 'documents' ? 'Documents' : 'Text Messages';

        const confirmed = await showConfirm({
          title: `Clear ${label}?`,
          message: `Delete all ${catData.count} ${label.toLowerCase()} (${catData.formatted}) from this conversation?`,
          confirmText: `Clear ${label}`,
          cancelText: 'Cancel',
          isDanger: true,
          extraCheckbox: {
            id: 'checkbox-clear-cat-starred',
            label: 'Delete starred items too',
            checked: false
          }
        });

        if (confirmed) {
          const deleteStarred = Boolean(document.getElementById('checkbox-clear-cat-starred')?.checked);
          await db.clearChatCategory(this.chatId, category, deleteStarred);
          Toast.show(`Cleared ${label}`);
          await this.loadData();
          this.renderUI();
        }
      });
    });
  }

  cleanup() {
    this.selectedMediaIds.clear();
  }
}

