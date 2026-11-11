// Screen 1: Home View (Chats Tab)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { PinDialog } from '../components/pin-dialog.js';
import { Toast } from '../components/toast.js';
import { showConfirm } from '../components/custom-dialog.js';

export class HomeView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.activeFilter = 'All'; // 'All', 'Unread', 'Favourites', 'Groups', or custom list id
    this.selectedChatIds = new Set();
    this.isSelectionMode = false;
    this.selectedAreAllUnread = false;
    this.currentSearchQuery = '';
  }

  debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  async render(rootEl) {
    this.container = rootEl;
    this.selectedChatIds.clear();
    this.isSelectionMode = false;

    rootEl.innerHTML = `
      <div class="screen-view home-screen">
        <!-- Default App Bar -->
        <header class="wa-app-bar" id="home-default-bar">
          <div class="app-title">WhatsApp</div>
          <div class="app-bar-actions">
            <button class="app-bar-icon-btn" id="btn-open-gallery" title="Gallery">
              ${Icons.gallery('', 22)}
            </button>
          </div>
        </header>

        <!-- Selection Mode Action Bar (replaces app bar when chats are selected) -->
        <header class="wa-app-bar selection-bar" id="home-selection-bar" style="display:none;">
          <div class="selection-left">
            <button class="app-bar-icon-btn" id="btn-cancel-selection">${Icons.arrowBack('', 24)}</button>
            <span class="selection-count" id="selection-count-text">1</span>
          </div>
          <div class="app-bar-actions">
            <button class="app-bar-icon-btn" id="btn-pin-selected" title="Pin / Unpin">${Icons.pin('', 20)}</button>
            <button class="app-bar-icon-btn" id="btn-delete-selected" title="Delete">${Icons.trash('', 20)}</button>
            <button class="app-bar-icon-btn" id="btn-archive-selected" title="Archive">${Icons.archive('', 20)}</button>
            <button class="app-bar-icon-btn" id="btn-mark-unread" title="Mark as unread" aria-label="Mark as unread">${Icons.markAsUnread('', 20)}</button>
            <button class="app-bar-icon-btn" id="btn-fav-selected" title="Favourite">${Icons.star('', 20)}</button>
          </div>
        </header>

        <!-- Search Bar Pill -->
        <div class="home-search-wrap">
          <div class="home-search-pill">
            ${Icons.search('search-icon', 18)}
            <input type="text" id="home-search-input" placeholder="Search" />
            <button class="search-clear-btn" id="btn-clear-search" style="display:none;">${Icons.close('', 16)}</button>
          </div>
        </div>

        <!-- Filter Chips Bar -->
        <div class="filter-chips-scroller" id="filter-chips-bar">
          <!-- Populated dynamically -->
        </div>

        <!-- Chat List Container -->
        <div class="chat-list-scroller" id="chat-list-container">
          <!-- Populated dynamically -->
        </div>

        <!-- Floating Action Button (FAB) -->
        <button class="wa-fab" id="home-fab-import" title="Import WhatsApp Export">
          ${Icons.chatPlus('fab-icon', 26)}
        </button>

        <!-- Bottom Navigation Bar (3 Tabs Only - Material 3 Flat with Pill Indicator) -->
        <nav class="wa-bottom-nav">
          <a href="#/chats" class="nav-tab active">
            <div class="tab-icon-wrap">
              <span class="tab-pill-indicator"></span>
              ${Icons.chatsTab('', 22)}
            </div>
            <span class="tab-label">Chats</span>
          </a>
          <a href="#/calls" class="nav-tab">
            <div class="tab-icon-wrap">${Icons.callsTab('', 22)}</div>
            <span class="tab-label">Calls</span>
          </a>
          <a href="#/settings" class="nav-tab">
            <div class="tab-icon-wrap">${Icons.settingsTab('', 22)}</div>
            <span class="tab-label">Settings</span>
          </a>
        </nav>
      </div>
    `;

    this.bindEvents();
    await this.loadFilterChips();
    await this.loadChatList();
  }

  bindEvents() {
    // Gallery button
    this.container.querySelector('#btn-open-gallery').addEventListener('click', () => {
      this.router.navigate('#/gallery');
    });

    // FAB button -> trigger import modal
    this.container.querySelector('#home-fab-import').addEventListener('click', () => {
      if (window.app && window.app.showImportModal) {
        window.app.showImportModal();
      }
    });

    // Search input with 300ms debounce
    const searchInput = this.container.querySelector('#home-search-input');
    const clearBtn = this.container.querySelector('#btn-clear-search');
    const debouncedFilter = this.debounce((query) => {
      this.filterChats(query);
    }, 300);

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      this.currentSearchQuery = q;
      if (q.trim()) {
        clearBtn.style.display = 'block';
      } else {
        clearBtn.style.display = 'none';
      }
      debouncedFilter(q);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.currentSearchQuery = '';
      clearBtn.style.display = 'none';
      this.filterChats('');
    });

    // Selection bar actions
    this.container.querySelector('#btn-cancel-selection').addEventListener('click', () => this.exitSelectionMode());
    this.container.querySelector('#btn-pin-selected').addEventListener('click', () => this.togglePinSelected());
    this.container.querySelector('#btn-delete-selected').addEventListener('click', () => this.deleteSelected());
    this.container.querySelector('#btn-archive-selected').addEventListener('click', () => this.toggleArchiveSelected());
    this.container.querySelector('#btn-mark-unread').addEventListener('click', () => this.toggleSelectedUnread());
    this.container.querySelector('#btn-fav-selected').addEventListener('click', () => this.toggleFavSelected());

    // Bottom Navigation explicit routing (Task 2 - fallback when standalone)
    this.container.querySelectorAll('.wa-bottom-nav .nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (href) this.router.navigate(href);
      });
    });
  }

  async loadFilterChips() {
    const chipsBar = this.container.querySelector('#filter-chips-bar');
    const customFilters = await db.getFilters();

    const standardFilters = [
      { id: 'All', name: 'All' },
      { id: 'Unread', name: 'Unread' },
      { id: 'Favourites', name: 'Favourites' },
      { id: 'Groups', name: 'Groups' }
    ];

    chipsBar.innerHTML = '';

    standardFilters.forEach((f) => {
      const chip = document.createElement('button');
      chip.className = `filter-chip ${this.activeFilter === f.id ? 'active' : ''}`;
      chip.dataset.filterId = f.id;
      chip.textContent = f.name;
      chip.addEventListener('click', () => {
        this.activeFilter = f.id;
        this.updateActiveChip();
        this.loadChatList();
      });
      chipsBar.appendChild(chip);
    });

    // Add custom user filters
    customFilters.forEach((cf) => {
      const chip = document.createElement('button');
      chip.className = `filter-chip ${this.activeFilter === cf.id ? 'active' : ''}`;
      chip.dataset.filterId = cf.id;
      chip.textContent = cf.name;
      chip.addEventListener('click', () => {
        this.activeFilter = cf.id;
        this.updateActiveChip();
        this.loadChatList();
      });
      chipsBar.appendChild(chip);
    });

    // Last chip: "+" button to open New List screen
    const plusChip = document.createElement('button');
    plusChip.className = 'filter-chip chip-add-list';
    plusChip.title = 'New list';
    plusChip.innerHTML = `+`;
    plusChip.addEventListener('click', () => {
      this.router.navigate('#/new-list');
    });
    chipsBar.appendChild(plusChip);
  }

  updateActiveChip() {
    const chips = this.container.querySelectorAll('.filter-chip');
    chips.forEach((c) => {
      if (c.dataset.filterId === this.activeFilter) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  async loadChatList() {
    if (this.currentSearchQuery && this.currentSearchQuery.trim()) {
      return this.filterChats(this.currentSearchQuery);
    }
    const listEl = this.container.querySelector('#chat-list-container');
    const allChats = await db.getChats();

    // Check if any chat is locked or archived
    const hasLocked = allChats.some((c) => c.isLocked);
    const hasArchived = allChats.some((c) => c.isArchived);

    // Apply active filter
    let filteredChats = allChats.filter((c) => !c.isArchived && !c.isLocked);

    if (this.activeFilter === 'Unread') {
      filteredChats = filteredChats.filter((c) => (c.unreadCount > 0 || c.isMarkedUnread));
    } else if (this.activeFilter === 'Favourites') {
      filteredChats = filteredChats.filter((c) => c.isFavourite);
    } else if (this.activeFilter === 'Groups') {
      filteredChats = filteredChats.filter((c) => c.isGroup);
    } else if (this.activeFilter !== 'All') {
      // Custom filter
      const customFilter = (await db.getFilters()).find((f) => f.id === this.activeFilter);
      if (customFilter && customFilter.chatIds) {
        filteredChats = filteredChats.filter((c) => customFilter.chatIds.includes(c.id));
      }
    }

    // Sort: pinned first, then newest updatedAt
    filteredChats.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    listEl.innerHTML = '';

    // Locked Chats Row (if any locked chats exist)
    if (hasLocked) {
      const lockedRow = document.createElement('div');
      lockedRow.className = 'special-chat-row locked-row';
      lockedRow.innerHTML = `
        <div class="special-icon">${Icons.lock('', 22)}</div>
        <div class="special-content">
          <div class="special-title">Locked chats</div>
        </div>
      `;
      lockedRow.addEventListener('click', async () => {
        const unlocked = await PinDialog.promptUnlock();
        if (unlocked) {
          this.activeFilter = 'Locked';
          this.renderLockedChats(allChats.filter((c) => c.isLocked));
        }
      });
      listEl.appendChild(lockedRow);
    }

    // Archived Chats Row (if any archived chats exist)
    if (hasArchived) {
      const archivedCount = allChats.filter((c) => c.isArchived).length;
      const archivedRow = document.createElement('div');
      archivedRow.className = 'special-chat-row archived-row';
      archivedRow.innerHTML = `
        <div class="special-icon">${Icons.archive('', 22)}</div>
        <div class="special-content">
          <div class="special-title">Archived</div>
        </div>
        <div class="special-meta">${archivedCount}</div>
      `;
      archivedRow.addEventListener('click', () => {
        this.renderArchivedChats(allChats.filter((c) => c.isArchived));
      });
      listEl.appendChild(archivedRow);
    }

    if (filteredChats.length === 0) {
      const isFiltered = this.activeFilter !== 'All';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-chats-state';
      if (isFiltered) {
        emptyDiv.innerHTML = `
          <div class="empty-icon-circle">${Icons.search('', 32)}</div>
          <h3>No chats in ${this.activeFilter}</h3>
          <p>No conversations match the selected filter chip.</p>
        `;
      } else {
        emptyDiv.innerHTML = `
          <div class="empty-icon-circle">${Icons.chatsTab('', 34)}</div>
          <h3>No conversations yet</h3>
          <p>Tap below or use the green chat button to restore your WhatsApp chat archives.</p>
          <button type="button" class="empty-state-cta-btn" id="empty-btn-start-import">
            ${Icons.download('', 18)}
            <span>Restore Chats</span>
          </button>
        `;
        emptyDiv.querySelector('#empty-btn-start-import')?.addEventListener('click', () => {
          if (window.app && window.app.showImportModal) {
            window.app.showImportModal();
          }
        });
      }
      listEl.appendChild(emptyDiv);
      return;
    }

    filteredChats.forEach((chat) => {
      const item = this.createChatItemElement(chat);
      listEl.appendChild(item);
    });
  }

  createChatItemElement(chat) {
    const item = document.createElement('div');
    item.className = 'chat-list-item';
    item.dataset.chatId = chat.id;

    const lastMsg = chat.lastMessage || {};
    const timeFormatted = lastMsg.timestamp ? this.formatChatDate(lastMsg.timestamp) : '';

    let checkIcon = '';
    if (lastMsg.isOutgoing) {
      checkIcon = Icons.checks(true, 'list-check', 16);
    }

    let mediaPrefix = '';
    if (lastMsg.mediaType === 'image') mediaPrefix = `${Icons.gallery('', 14)} Photo`;
    else if (lastMsg.mediaType === 'video') mediaPrefix = `${Icons.callVideo('', 14)} Video`;
    else if (lastMsg.mediaType === 'audio') mediaPrefix = `${Icons.mic('', 14)} Voice note`;
    else if (lastMsg.mediaType === 'pdf') mediaPrefix = `${Icons.pdfIcon('', 14)} PDF`;
    else if (lastMsg.mediaType === 'document') mediaPrefix = `${Icons.documentIcon('', 14)} Document`;

    const previewText = mediaPrefix || (lastMsg.text ? lastMsg.text.replace(/\n/g, ' ') : 'No messages yet');

    const isUnread = Boolean(chat.unreadCount > 0 || chat.isMarkedUnread);

    item.innerHTML = `
      <div class="chat-avatar-wrap">
        ${chat.avatarBlob ? `<img src="${URL.createObjectURL(chat.avatarBlob)}" class="chat-avatar-img" />` : (chat.isGroup ? Icons.groupAvatar('', 50) : Icons.userAvatar('', 50))}
      </div>
      <div class="chat-main-wrap">
        <div class="chat-top-row">
          <span class="chat-title" dir="auto">${chat.name}</span>
          <span class="chat-time ${isUnread ? 'unread-time' : ''}">${timeFormatted}</span>
        </div>
        <div class="chat-bottom-row">
          <div class="chat-snippet" dir="auto">
            ${checkIcon}
            <span class="snippet-text">${previewText}</span>
          </div>
          <div class="chat-badges">
            ${chat.isPinned ? `<span class="pin-badge">${Icons.pin('', 14)}</span>` : ''}
            ${isUnread ? `<span class="unread-dot" aria-label="Unread"></span>` : ''}
          </div>
        </div>
      </div>
    `;

    // Long press detection for selection mode
    let pressTimer = null;
    item.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        this.enterSelectionMode(chat.id);
      }, 500);
    }, { passive: true });

    item.addEventListener('touchend', () => {
      if (pressTimer) clearTimeout(pressTimer);
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.enterSelectionMode(chat.id);
    });

    // Avatar click -> floating profile preview modal (Task 8)
    const avatarWrap = item.querySelector('.chat-avatar-wrap');
    if (avatarWrap) {
      avatarWrap.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        if (pressTimer) clearTimeout(pressTimer);
      }, { passive: true });
      avatarWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.isSelectionMode) {
          this.toggleItemSelection(chat.id);
        } else {
          this.showProfileModal(chat);
        }
      });
    }

    // Item click (navigates to chat only when tapping outside the avatar)
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.chat-avatar-wrap')) return;
      if (this.isSelectionMode) {
        this.toggleItemSelection(chat.id);
      } else {
        if (isUnread) {
          await db.updateChat(chat.id, { unreadCount: 0, isMarkedUnread: false });
        }
        this.router.navigate(`#/chat/${chat.id}`);
      }
    });

    return item;
  }

  // Floating Profile Photo Preview Modal (Task 8)
  showProfileModal(chat) {
    const existing = document.querySelector('.floating-profile-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay floating-profile-modal-overlay active';

    const avatarUrl = chat.avatarBlob ? URL.createObjectURL(chat.avatarBlob) : null;

    overlay.innerHTML = `
      <div class="floating-profile-card">
        <div class="floating-profile-header">
          <span class="floating-profile-name" dir="auto">${chat.name}</span>
        </div>
        <div class="floating-profile-img-wrap" id="btn-open-profile-photo" title="Open contact info">
          ${avatarUrl
            ? `<img src="${avatarUrl}" class="floating-profile-img" alt="${chat.name}" />`
            : (chat.isGroup ? Icons.groupAvatar('', 140) : Icons.userAvatar('', 140))}
        </div>
        <div class="floating-profile-actions">
          <button type="button" class="floating-action-btn" id="fp-btn-msg" title="Message">
            ${Icons.chatsTab('', 22)}
          </button>
          <button type="button" class="floating-action-btn" id="fp-btn-call" title="Voice Call">
            ${Icons.callVoice('', 22)}
          </button>
          <button type="button" class="floating-action-btn" id="fp-btn-video" title="Video Call">
            ${Icons.callVideo('', 22)}
          </button>
          <button type="button" class="floating-action-btn" id="fp-btn-info" title="Info">
            ${Icons.userAvatar('', 22)}
          </button>
        </div>
      </div>
    `;

    const close = () => {
      overlay.classList.remove('active');
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector('#fp-btn-msg').addEventListener('click', () => {
      close();
      this.router.navigate(`#/chat/${chat.id}`);
    });

    overlay.querySelector('#fp-btn-call').addEventListener('click', () => {
      close();
      Toast.show(`Calling ${chat.name}...`);
    });

    overlay.querySelector('#fp-btn-video').addEventListener('click', () => {
      close();
      Toast.show(`Video calling ${chat.name}...`);
    });

    overlay.querySelector('#fp-btn-info').addEventListener('click', () => {
      close();
      this.router.navigate(`#/chat/${chat.id}/info`);
    });

    overlay.querySelector('#btn-open-profile-photo').addEventListener('click', () => {
      close();
      this.router.navigate(`#/chat/${chat.id}/info`);
    });

    document.body.appendChild(overlay);
  }

  formatChatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }

  // --- Selection Mode ---
  enterSelectionMode(chatId) {
    this.isSelectionMode = true;
    if (typeof window.setPagerSwipeEnabled === 'function') {
      window.setPagerSwipeEnabled(false);
    }
    this.selectedChatIds.clear();
    this.selectedChatIds.add(chatId);
    if (window.router) {
      window.router.pushOverlay('selection-mode', () => this.exitSelectionMode(false));
    }
    this.updateSelectionBar();
  }

  toggleItemSelection(chatId) {
    if (this.selectedChatIds.has(chatId)) {
      this.selectedChatIds.delete(chatId);
    } else {
      this.selectedChatIds.add(chatId);
    }

    if (this.selectedChatIds.size === 0) {
      this.exitSelectionMode();
    } else {
      this.updateSelectionBar();
    }
  }

  async updateSelectionBar() {
    const defaultBar = this.container.querySelector('#home-default-bar');
    const selectBar = this.container.querySelector('#home-selection-bar');
    const countText = this.container.querySelector('#selection-count-text');

    defaultBar.style.display = 'none';
    selectBar.style.display = 'flex';
    countText.textContent = this.selectedChatIds.size;

    this.container.querySelectorAll('.chat-list-item').forEach((item) => {
      const id = item.dataset.chatId;
      if (this.selectedChatIds.has(id)) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    // Check if all selected chats are unread to toggle open vs closed envelope
    const markUnreadBtn = this.container.querySelector('#btn-mark-unread');
    if (markUnreadBtn && this.selectedChatIds.size > 0) {
      let allUnread = true;
      for (const id of this.selectedChatIds) {
        const chat = await db.getChat(id);
        const isUnread = Boolean(chat && (chat.unreadCount > 0 || chat.isMarkedUnread));
        if (!isUnread) {
          allUnread = false;
          break;
        }
      }

      this.selectedAreAllUnread = allUnread;
      if (allUnread) {
        markUnreadBtn.innerHTML = Icons.markAsRead('', 20);
        markUnreadBtn.title = 'Mark as read';
        markUnreadBtn.setAttribute('aria-label', 'Mark as read');
      } else {
        markUnreadBtn.innerHTML = Icons.markAsUnread('', 20);
        markUnreadBtn.title = 'Mark as unread';
        markUnreadBtn.setAttribute('aria-label', 'Mark as unread');
      }
    }
  }

  exitSelectionMode(notifyRouter = true) {
    if (notifyRouter && window.router) {
      window.router.removeOverlay('selection-mode');
    }
    this.isSelectionMode = false;
    if (typeof window.setPagerSwipeEnabled === 'function') {
      window.setPagerSwipeEnabled(true);
    }
    this.selectedChatIds.clear();

    const defaultBar = this.container.querySelector('#home-default-bar');
    const selectBar = this.container.querySelector('#home-selection-bar');

    defaultBar.style.display = 'flex';
    selectBar.style.display = 'none';

    this.container.querySelectorAll('.chat-list-item').forEach((item) => {
      item.classList.remove('selected');
    });
  }

  async togglePinSelected() {
    for (const id of this.selectedChatIds) {
      const chat = await db.getChat(id);
      if (chat) {
        await db.updateChat(id, { isPinned: !chat.isPinned });
      }
    }
    this.exitSelectionMode();
    this.loadChatList();
  }

  async toggleArchiveSelected() {
    for (const id of this.selectedChatIds) {
      const chat = await db.getChat(id);
      if (chat) {
        await db.updateChat(id, { isArchived: !chat.isArchived });
      }
    }
    this.exitSelectionMode();
    this.loadChatList();
  }

  async toggleSelectedUnread() {
    const shouldMarkUnread = !this.selectedAreAllUnread;
    for (const id of this.selectedChatIds) {
      const chat = await db.getChat(id);
      if (chat) {
        await db.updateChat(id, {
          unreadCount: shouldMarkUnread ? 1 : 0,
          isMarkedUnread: shouldMarkUnread
        });
      }
    }
    this.exitSelectionMode();
    this.loadChatList();
  }

  async toggleFavSelected() {
    for (const id of this.selectedChatIds) {
      const chat = await db.getChat(id);
      if (chat) {
        await db.updateChat(id, { isFavourite: !chat.isFavourite });
      }
    }
    Toast.show('Favourites updated');
    this.exitSelectionMode();
    this.loadChatList();
  }

  async deleteSelected() {
    const confirmed = await showConfirm({
      title: 'Delete selected chat(s)?',
      message: `Delete ${this.selectedChatIds.size} selected chat(s)? Messages and attachments will be deleted.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDanger: true
    });
    if (confirmed) {
      for (const id of this.selectedChatIds) {
        await db.deleteChat(id);
      }
      Toast.show('Chat(s) deleted');
      this.exitSelectionMode();
      this.loadChatList();
    }
  }

  // Live in-message & chat search
  async filterChats(query) {
    const listEl = this.container.querySelector('#chat-list-container');
    this.currentSearchQuery = query || '';
    if (!query || !query.trim()) {
      this.currentSearchQuery = '';
      this.loadChatList();
      return;
    }

    const q = query.toLowerCase().trim();
    const chats = await db.getChats();
    const nameMatches = chats.filter((c) => c.name.toLowerCase().includes(q));

    // Deep search in message contents
    const messageMatches = await db.searchMessages(q);
    const chatIdsWithMessageMatches = new Set(messageMatches.map((m) => m.chatId));

    listEl.innerHTML = '';

    // Render name matches
    if (nameMatches.length > 0) {
      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'search-results-divider';
      sectionHeader.textContent = 'CHATS';
      listEl.appendChild(sectionHeader);

      nameMatches.forEach((chat) => {
        listEl.appendChild(this.createChatItemElement(chat));
      });
    }

    // Render message snippet matches
    if (messageMatches.length > 0) {
      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'search-results-divider';
      sectionHeader.textContent = 'MESSAGES';
      listEl.appendChild(sectionHeader);

      messageMatches.slice(0, 30).forEach((msg) => {
        const item = document.createElement('div');
        item.className = 'search-message-result-item';
        const parentChat = chats.find((c) => c.id === msg.chatId);
        const chatName = parentChat ? parentChat.name : 'Chat';

        // Highlight matching query
        const textEscaped = msg.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const reg = new RegExp(`(${q})`, 'gi');
        const highlighted = textEscaped.replace(reg, '<mark class="search-highlight">$1</mark>');

        item.innerHTML = `
          <div class="search-result-chat-name">${chatName}</div>
          <div class="search-result-snippet" dir="auto">${highlighted}</div>
          <div class="search-result-time">${new Date(msg.timestamp).toLocaleDateString()}</div>
        `;

        item.addEventListener('click', () => {
          this.router.navigate(`#/chat/${msg.chatId}?msgId=${msg.id}`);
        });

        listEl.appendChild(item);
      });
    }

    if (nameMatches.length === 0 && messageMatches.length === 0) {
      listEl.innerHTML = `<div class="empty-chats-state"><p>No results found for "${query}"</p></div>`;
    }
  }

  renderLockedChats(lockedChats) {
    const listEl = this.container.querySelector('#chat-list-container');
    listEl.innerHTML = `
      <div class="view-header-back">
        <button class="app-bar-icon-btn" id="btn-back-to-all">${Icons.arrowBack('', 24)}</button>
        <h3>Locked chats</h3>
      </div>
    `;
    this.container.querySelector('#btn-back-to-all').addEventListener('click', () => {
      this.activeFilter = 'All';
      this.loadChatList();
    });
    lockedChats.forEach((c) => listEl.appendChild(this.createChatItemElement(c)));
  }

  renderArchivedChats(archivedChats) {
    const listEl = this.container.querySelector('#chat-list-container');
    listEl.innerHTML = `
      <div class="view-header-back">
        <button class="app-bar-icon-btn" id="btn-back-to-all">${Icons.arrowBack('', 24)}</button>
        <h3>Archived chats</h3>
      </div>
    `;
    this.container.querySelector('#btn-back-to-all').addEventListener('click', () => {
      this.loadChatList();
    });
    archivedChats.forEach((c) => listEl.appendChild(this.createChatItemElement(c)));
  }
}
