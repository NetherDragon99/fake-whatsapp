// Screen: Manage Storage View (Settings -> Storage and Data -> Manage Storage)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { Toast } from '../components/toast.js';
import { showConfirm } from '../components/custom-dialog.js';

export class ManageStorageView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.storageData = null;
    this.selectedChatIds = new Set();
    this.isSelectionMode = false;
    this.searchQuery = '';
    this.longPressTimers = new Map();
  }

  async render(rootEl) {
    this.container = rootEl;
    this.selectedChatIds.clear();
    this.isSelectionMode = false;
    this.searchQuery = '';

    await this.loadData();
    this.renderUI();
  }

  async loadData() {
    try {
      this.storageData = await db.getStorageUsageRanked();
    } catch (e) {
      console.error('[ManageStorageView] Failed loading storage stats:', e);
      this.storageData = {
        global: {
          totalBytes: 0,
          mediaBytes: 0,
          messageBytes: 0,
          formattedTotal: '0 B',
          formattedMedia: '0 B',
          formattedMessages: '0 B',
          chatCount: 0,
          messageCount: 0,
          mediaCount: 0
        },
        chats: []
      };
    }
  }

  renderUI() {
    if (!this.container) return;

    const g = this.storageData.global;
    // Calculate storage bar percentages
    const totalEst = Math.max(g.totalBytes, 1024 * 1024 * 50); // min 50MB scale baseline
    const mediaPct = Math.min(90, Math.max(2, (g.mediaBytes / totalEst) * 100));
    const msgPct = Math.min(90 - mediaPct, Math.max(1, (g.messageBytes / totalEst) * 100));

    this.container.innerHTML = `
      <div class="screen-view manage-storage-screen">
        <!-- Normal App Bar -->
        <header class="wa-app-bar" id="storage-app-bar" ${this.isSelectionMode ? 'style="display:none;"' : ''}>
          <button type="button" class="app-bar-icon-btn" id="btn-storage-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">Manage storage</div>
          <div class="app-bar-actions">
            <button type="button" class="app-bar-icon-btn" id="btn-toggle-select-mode" title="Select chats">
              ${Icons.edit('', 20)}
            </button>
          </div>
        </header>

        <!-- Contextual Selection Bar -->
        <header class="wa-app-bar selection-bar" id="storage-selection-bar" ${!this.isSelectionMode ? 'style="display:none;"' : ''}>
          <button type="button" class="app-bar-icon-btn" id="btn-cancel-select" aria-label="Cancel selection">
            ${Icons.close('', 24)}
          </button>
          <div class="selection-count-title" id="storage-select-count">
            ${this.selectedChatIds.size} selected
          </div>
          <div class="app-bar-actions">
            <button type="button" class="app-bar-text-btn" id="btn-select-all-chats">
              ${this.selectedChatIds.size === this.storageData.chats.length ? 'Deselect All' : 'Select All'}
            </button>
            <button type="button" class="app-bar-icon-btn danger-icon" id="btn-bulk-delete-chats" title="Clear selected chats">
              ${Icons.trash('', 22)}
            </button>
          </div>
        </header>

        <div class="manage-storage-scroll-body" id="manage-storage-scroller">
          <!-- Overview Storage Bar Card -->
          <div class="storage-overview-card">
            <div class="storage-header-row">
              <div class="storage-total-num">${g.formattedTotal}</div>
              <div class="storage-total-label">Used by Fake WhatsApp</div>
            </div>

            <!-- Proportional Bar -->
            <div class="storage-progress-bar">
              <div class="storage-bar-segment media-seg" style="width: ${mediaPct}%;"></div>
              <div class="storage-bar-segment msgs-seg" style="width: ${msgPct}%;"></div>
            </div>

            <!-- Legend -->
            <div class="storage-legend-row">
              <div class="legend-item">
                <span class="legend-dot green"></span>
                <span class="legend-label">Media: ${g.formattedMedia}</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot cyan"></span>
                <span class="legend-label">Messages: ${g.formattedMessages}</span>
              </div>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Chats Storage Section -->
          <div class="storage-chats-section">
            <div class="storage-section-header">
              <div class="storage-section-title">Chats (${this.storageData.chats.length})</div>
              <div class="storage-search-box">
                <input type="text" id="storage-search-input" class="storage-search-field" placeholder="Search chats..." value="${this.searchQuery}" />
              </div>
            </div>

            <div class="storage-chats-list" id="storage-chats-list">
              <!-- Populated dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderChatsList();
  }

  renderChatsList() {
    const listEl = this.container.querySelector('#storage-chats-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const query = this.searchQuery.toLowerCase().trim();
    const filteredChats = this.storageData.chats.filter((item) => {
      if (!query) return true;
      return (item.chat.name || '').toLowerCase().includes(query);
    });

    if (filteredChats.length === 0) {
      listEl.innerHTML = `
        <div class="empty-storage-state">
          <p>No chats found</p>
        </div>
      `;
      return;
    }

    filteredChats.forEach((item) => {
      const c = item.chat;
      const isSelected = this.selectedChatIds.has(c.id);

      const row = document.createElement('div');
      row.className = `storage-chat-row ${isSelected ? 'selected' : ''}`;
      row.dataset.chatId = c.id;

      const avatarUrl = c.avatarBlob ? URL.createObjectURL(c.avatarBlob) : null;

      row.innerHTML = `
        ${this.isSelectionMode ? `
          <div class="storage-row-checkbox">
            <input type="checkbox" class="wa-checkbox" ${isSelected ? 'checked' : ''} />
          </div>
        ` : ''}
        <div class="storage-chat-avatar">
          ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar" />` : (c.isGroup ? Icons.groupAvatar('', 44) : Icons.userAvatar('', 44))}
        </div>
        <div class="storage-chat-meta">
          <div class="storage-chat-name" dir="auto">${c.name || 'Chat'}</div>
          <div class="storage-chat-sub">${item.mediaCount} media • ${item.messageCount} messages</div>
        </div>
        <div class="storage-chat-size">${item.formattedTotal}</div>
        ${!this.isSelectionMode ? `<div class="storage-chat-chevron">${Icons.chevronRight('', 18)}</div>` : ''}
      `;

      // Touch / Click handling: Long press enters multi-select, click toggles or navigates
      let pressTimer = null;
      let startX = 0;
      let startY = 0;

      const startLongPress = (e) => {
        startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        pressTimer = setTimeout(() => {
          if (!this.isSelectionMode) {
            this.setSelectionMode(true);
            this.toggleSelectChat(c.id);
          }
        }, 450);
      };

      const cancelLongPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };

      row.addEventListener('touchstart', startLongPress, { passive: true });
      row.addEventListener('touchmove', (e) => {
        const curX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const curY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        if (Math.hypot(curX - startX, curY - startY) > 10) cancelLongPress();
      }, { passive: true });
      row.addEventListener('touchend', cancelLongPress, { passive: true });
      row.addEventListener('touchcancel', cancelLongPress, { passive: true });

      row.addEventListener('mousedown', startLongPress);
      row.addEventListener('mousemove', (e) => {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancelLongPress();
      });
      row.addEventListener('mouseup', cancelLongPress);
      row.addEventListener('mouseleave', cancelLongPress);

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        cancelLongPress();
        if (!this.isSelectionMode) {
          this.setSelectionMode(true);
        }
        this.toggleSelectChat(c.id);
      });

      row.addEventListener('click', (e) => {
        if (this.isSelectionMode) {
          this.toggleSelectChat(c.id);
        } else {
          // Navigate to individual chat storage breakdown
          this.router.navigate(`#/manage-storage/${c.id}`);
        }
      });

      listEl.appendChild(row);
    });
  }

  setSelectionMode(active) {
    this.isSelectionMode = active;
    if (!active) {
      this.selectedChatIds.clear();
    }
    const normalBar = this.container.querySelector('#storage-app-bar');
    const selectBar = this.container.querySelector('#storage-selection-bar');
    if (normalBar) normalBar.style.display = active ? 'none' : 'flex';
    if (selectBar) selectBar.style.display = active ? 'flex' : 'none';
    this.updateSelectionCount();
    this.renderChatsList();
  }

  toggleSelectChat(chatId) {
    if (this.selectedChatIds.has(chatId)) {
      this.selectedChatIds.delete(chatId);
    } else {
      this.selectedChatIds.add(chatId);
    }
    this.updateSelectionCount();
    this.renderChatsList();
  }

  updateSelectionCount() {
    const title = this.container.querySelector('#storage-select-count');
    if (title) title.textContent = `${this.selectedChatIds.size} selected`;
    const selectAllBtn = this.container.querySelector('#btn-select-all-chats');
    if (selectAllBtn) {
      selectAllBtn.textContent = this.selectedChatIds.size === this.storageData.chats.length ? 'Deselect All' : 'Select All';
    }
  }

  bindEvents() {
    // Back navigation
    this.container.querySelector('#btn-storage-back')?.addEventListener('click', () => {
      this.router.navigate('#/settings');
    });

    // Enter selection mode via button
    this.container.querySelector('#btn-toggle-select-mode')?.addEventListener('click', () => {
      this.setSelectionMode(true);
    });

    // Cancel selection mode
    this.container.querySelector('#btn-cancel-select')?.addEventListener('click', () => {
      this.setSelectionMode(false);
    });

    // Select / Deselect All
    this.container.querySelector('#btn-select-all-chats')?.addEventListener('click', () => {
      if (this.selectedChatIds.size === this.storageData.chats.length) {
        this.selectedChatIds.clear();
      } else {
        this.storageData.chats.forEach((c) => this.selectedChatIds.add(c.chat.id));
      }
      this.updateSelectionCount();
      this.renderChatsList();
    });

    // Search input
    const searchInput = this.container.querySelector('#storage-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderChatsList();
      });
    }

    // Bulk Delete selected chats storage
    this.container.querySelector('#btn-bulk-delete-chats')?.addEventListener('click', async () => {
      if (this.selectedChatIds.size === 0) return;

      const count = this.selectedChatIds.size;
      const confirmed = await showConfirm({
        title: `Clear storage for ${count} chat${count > 1 ? 's' : ''}?`,
        message: `This will delete all media and messages in the selected ${count} conversation${count > 1 ? 's' : ''}. The chat contacts will remain.`,
        confirmText: 'Clear Storage',
        cancelText: 'Cancel',
        isDanger: true,
        extraCheckbox: {
          id: 'checkbox-delete-starred-bulk',
          label: 'Delete starred messages too',
          checked: false
        }
      });

      if (confirmed) {
        const deleteStarred = Boolean(document.getElementById('checkbox-delete-starred-bulk')?.checked);
        const chatIds = Array.from(this.selectedChatIds);

        await db.clearChatsStorageBatch(chatIds, deleteStarred);
        Toast.show(`Cleared storage for ${count} chat${count > 1 ? 's' : ''}`);

        this.setSelectionMode(false);
        await this.loadData();
        this.renderUI();
      }
    });
  }

  cleanup() {
    this.longPressTimers.forEach((t) => clearTimeout(t));
    this.longPressTimers.clear();
  }
}
