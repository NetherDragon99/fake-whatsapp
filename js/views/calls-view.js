// Screen 6: Calls History Tab with Windowed Virtual Batch Scroller & Independent Indexing
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { Toast } from '../components/toast.js';
import { showConfirm } from '../components/custom-dialog.js';

export class CallsView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.scrollerEl = null;
    this.itemsContainer = null;
    this.allCalls = [];
    this.visibleStartIndex = 0;
    this.visibleEndIndex = 0;
    this.CHUNK_SIZE = 30;
    this.MAX_DOM_ITEMS = 90;
    this.isLoadingMore = false;
    this.lastScrollTop = 0;
    this.onScrollBound = this.handleScroll.bind(this);
  }

  async render(rootEl) {
    this.container = rootEl;
    let calls = [];
    try {
      calls = await db.getCalls();
    } catch (err) {
      console.warn('[CallsView] Failed to fetch calls:', err);
    }

    if (!this.container) return;

    rootEl.innerHTML = `
      <div class="screen-view calls-screen">
        <header class="wa-app-bar">
          <div class="app-title">Calls</div>
          <div class="app-bar-actions">
            <button class="app-bar-icon-btn" id="btn-clear-calls" title="Clear call log">
              ${Icons.trash('', 20)}
            </button>
          </div>
        </header>

        <div class="calls-content-scroller" id="calls-list-wrap">
          <!-- Populated dynamically -->
        </div>

        <!-- Bottom Navigation Bar (Shown when rendered standalone) -->
        <nav class="wa-bottom-nav">
          <a href="#/chats" class="nav-tab">
            <div class="tab-icon-wrap">${Icons.chatsTab('', 22)}</div>
            <span class="tab-label">Chats</span>
          </a>
          <a href="#/calls" class="nav-tab active">
            <div class="tab-icon-wrap">
              <span class="tab-pill-indicator"></span>
              ${Icons.callsTab('', 22)}
            </div>
            <span class="tab-label">Calls</span>
          </a>
          <a href="#/settings" class="nav-tab">
            <div class="tab-icon-wrap">${Icons.settingsTab('', 22)}</div>
            <span class="tab-label">Settings</span>
          </a>
        </nav>
      </div>
    `;

    this.bindEvents(calls);
  }

  async refresh() {
    if (!this.container) return;
    try {
      const calls = await db.getCalls();
      this.bindEvents(calls);
    } catch (err) {
      console.warn('[CallsView] Error refreshing calls:', err);
    }
  }

  bindEvents(calls = []) {
    if (!this.container) return;
    this.allCalls = Array.isArray(calls) ? calls : [];

    const listWrap = this.container.querySelector('#calls-list-wrap');
    if (!listWrap) return;
    this.scrollerEl = listWrap;

    // Remove any previously bound scroll listener
    this.scrollerEl.removeEventListener('scroll', this.onScrollBound);

    // Clear calls button with safe null check
    const clearBtn = this.container.querySelector('#btn-clear-calls');
    if (clearBtn) {
      clearBtn.onclick = async () => {
        if (!this.allCalls || this.allCalls.length === 0) return;
        const confirmed = await showConfirm({
          title: 'Clear call log?',
          message: 'Do you want to clear your entire call history?',
          confirmText: 'Clear',
          cancelText: 'Cancel',
          isDanger: true
        });
        if (confirmed) {
          try {
            const tx = db.db.transaction('calls', 'readwrite');
            tx.objectStore('calls').clear();
            tx.oncomplete = () => {
              Toast.show('Call log cleared');
              this.refresh();
            };
          } catch (e) {
            console.error('[CallsView] Failed to clear call log:', e);
          }
        }
      };
    }

    listWrap.innerHTML = '';

    if (this.allCalls.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-calls-state">
          <div class="empty-icon-circle">${Icons.callVoice('', 34)}</div>
          <h3>No call records</h3>
          <p>Calls found inside imported WhatsApp exports will automatically populate here.</p>
          <button type="button" class="empty-state-cta-btn secondary" id="empty-btn-open-import">
            ${Icons.download('', 18)}
            <span>Import Chat Archive</span>
          </button>
        </div>
      `;
      listWrap.querySelector('#empty-btn-open-import')?.addEventListener('click', () => {
        if (window.app && window.app.showImportModal) {
          window.app.showImportModal();
        }
      });
      return;
    }

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'calls-section-title';
    sectionTitle.textContent = 'Recent';
    listWrap.appendChild(sectionTitle);

    this.itemsContainer = document.createElement('div');
    this.itemsContainer.className = 'calls-items-container';
    listWrap.appendChild(this.itemsContainer);

    // Initial Batch Loading
    this.visibleStartIndex = 0;
    this.visibleEndIndex = Math.min(this.allCalls.length, this.CHUNK_SIZE);
    this.lastScrollTop = 0;
    this.isLoadingMore = false;

    const initialFragment = this.createBatchFragment(this.visibleStartIndex, this.visibleEndIndex);
    this.itemsContainer.appendChild(initialFragment);

    // Attach 40% Boundary Windowed Virtual Scroll Listener
    this.scrollerEl.addEventListener('scroll', this.onScrollBound, { passive: true });

    // Bottom Navigation explicit routing (when rendered standalone)
    this.container.querySelectorAll('.wa-bottom-nav .nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (href) this.router.navigate(href);
      });
    });
  }

  handleScroll() {
    if (this.isLoadingMore || !this.scrollerEl || !this.itemsContainer) return;

    const scrollHeight = this.scrollerEl.scrollHeight;
    const scrollTop = this.scrollerEl.scrollTop;
    const clientHeight = this.scrollerEl.clientHeight;
    const scrollBottomDist = scrollHeight - scrollTop - clientHeight;

    const scrollDir = scrollTop >= this.lastScrollTop ? 'down' : 'up';
    this.lastScrollTop = scrollTop;

    // 40% Threshold: user scrolled into bottom 40% (downward scroll towards older calls)
    if (scrollDir === 'down' && scrollBottomDist <= scrollHeight * 0.40 && this.visibleEndIndex < this.allCalls.length) {
      this.loadNextBatch();
    }

    // 40% Threshold: user scrolled into top 40% (upward scroll towards newer calls)
    if (scrollDir === 'up' && scrollTop <= scrollHeight * 0.40 && this.visibleStartIndex > 0) {
      this.loadPrevBatch();
    }
  }

  loadNextBatch() {
    if (this.isLoadingMore || this.visibleEndIndex >= this.allCalls.length) return;
    this.isLoadingMore = true;

    const newStart = this.visibleEndIndex;
    const newEnd = Math.min(this.allCalls.length, this.visibleEndIndex + this.CHUNK_SIZE);

    // Append older calls to the bottom
    const fragment = this.createBatchFragment(newStart, newEnd);
    this.itemsContainer.appendChild(fragment);
    this.visibleEndIndex = newEnd;

    // Prune excess from top if exceeding MAX_DOM_ITEMS
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_ITEMS) {
      const pruneCount = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_ITEMS;
      const prevScrollHeight = this.scrollerEl.scrollHeight;
      const prevScrollTop = this.scrollerEl.scrollTop;

      let removed = 0;
      while (this.itemsContainer.firstElementChild && removed < pruneCount) {
        this.itemsContainer.firstElementChild.remove();
        removed++;
      }
      this.visibleStartIndex += removed;

      // Mathematical scroll lock: compensate for removed elements above viewport
      const afterScrollHeight = this.scrollerEl.scrollHeight;
      const removedHeight = prevScrollHeight - afterScrollHeight;
      if (removedHeight > 0) {
        this.scrollerEl.scrollTop = Math.max(0, prevScrollTop - removedHeight);
      }
    }

    this.isLoadingMore = false;
  }

  loadPrevBatch() {
    if (this.isLoadingMore || this.visibleStartIndex <= 0) return;
    this.isLoadingMore = true;

    const prevScrollHeight = this.scrollerEl.scrollHeight;
    const prevScrollTop = this.scrollerEl.scrollTop;

    const newStart = Math.max(0, this.visibleStartIndex - this.CHUNK_SIZE);
    const newEnd = this.visibleStartIndex;

    // Prepend newer calls to the top
    const fragment = this.createBatchFragment(newStart, newEnd);
    this.itemsContainer.insertBefore(fragment, this.itemsContainer.firstElementChild);
    this.visibleStartIndex = newStart;

    // Mathematical scroll lock: compensate for prepended elements above viewport
    const newScrollHeight = this.scrollerEl.scrollHeight;
    const heightDelta = newScrollHeight - prevScrollHeight;
    this.scrollerEl.scrollTop = prevScrollTop + heightDelta;

    // Prune excess from bottom if exceeding MAX_DOM_ITEMS (zero effect on scrollTop)
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_ITEMS) {
      const pruneCount = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_ITEMS;
      let removed = 0;
      while (this.itemsContainer.lastElementChild && removed < pruneCount) {
        this.itemsContainer.lastElementChild.remove();
        removed++;
      }
      this.visibleEndIndex -= removed;
    }

    this.isLoadingMore = false;
  }

  createBatchFragment(start, end) {
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const c = this.allCalls[i];
      if (!c) continue;
      const itemEl = this.createCallItemElement(c);
      fragment.appendChild(itemEl);
    }
    return fragment;
  }

  createCallItemElement(c) {
    const item = document.createElement('div');
    item.className = 'call-list-item';

    let arrowIcon = Icons.callOutgoing('', 16);
    if (c.isMissed) {
      arrowIcon = Icons.callMissed('', 16);
    } else if (c.direction === 'incoming') {
      arrowIcon = Icons.callIncoming('', 16);
    }

    const isVideo = c.callType === 'video';
    const callTypeIcon = isVideo ? Icons.callVideo('', 20) : Icons.callVoice('', 20);

    const timeFormatted = new Date(c.timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    item.innerHTML = `
      <div class="call-avatar-wrap">
        ${Icons.userAvatar('', 48)}
      </div>
      <div class="call-main-wrap">
        <div class="call-name ${c.isMissed ? 'call-missed-name' : ''}" dir="auto">${c.contactName || 'Contact'}</div>
        <div class="call-meta-row">
          ${arrowIcon}
          <span class="call-time">${timeFormatted}</span>
        </div>
      </div>
      <div class="call-action-icon">${callTypeIcon}</div>
    `;

    item.addEventListener('click', () => {
      if (c.chatId) {
        this.router.navigate(`#/chat/${c.chatId}?msgId=${c.messageId || ''}`);
      }
    });

    return item;
  }

  cleanup() {
    if (this.scrollerEl && this.onScrollBound) {
      this.scrollerEl.removeEventListener('scroll', this.onScrollBound);
    }
  }
}
