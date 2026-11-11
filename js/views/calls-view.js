// Screen 6: Calls History Tab
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { Toast } from '../components/toast.js';
import { showConfirm } from '../components/custom-dialog.js';

export class CallsView {
  constructor(router) {
    this.router = router;
    this.container = null;
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
    const listWrap = this.container.querySelector('#calls-list-wrap');
    if (!listWrap) return;

    // Clear calls button with safe null check
    const clearBtn = this.container.querySelector('#btn-clear-calls');
    if (clearBtn) {
      clearBtn.onclick = async () => {
        if (!calls || calls.length === 0) return;
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

    if (!calls || calls.length === 0) {
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

    calls.forEach((c) => {
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

      listWrap.appendChild(item);
    });

    // Bottom Navigation explicit routing (when rendered standalone)
    this.container.querySelectorAll('.wa-bottom-nav .nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (href) this.router.navigate(href);
      });
    });
  }
}
