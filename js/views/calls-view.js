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
    const calls = await db.getCalls();

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

        <!-- Bottom Navigation Bar -->
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

  bindEvents(calls) {
    const listWrap = this.container.querySelector('#calls-list-wrap');

    // Clear calls
    this.container.querySelector('#btn-clear-calls').addEventListener('click', async () => {
      if (calls.length === 0) return;
      const confirmed = await showConfirm({
        title: 'Clear call log?',
        message: 'Do you want to clear your entire call history?',
        confirmText: 'Clear',
        cancelText: 'Cancel',
        isDanger: true
      });
      if (confirmed) {
        const tx = db.db.transaction('calls', 'readwrite');
        tx.objectStore('calls').clear();
        tx.oncomplete = () => {
          Toast.show('Call log cleared');
          this.render(this.container);
        };
      }
    });

    if (calls.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-calls-state">
          ${Icons.callVoice('', 48)}
          <h3>No call records</h3>
          <p>Calls found inside imported WhatsApp exports will automatically populate here.</p>
        </div>
      `;
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

    // Bottom Navigation explicit routing (Task 2)
    this.container.querySelectorAll('.wa-bottom-nav .nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (href) this.router.navigate(href);
      });
    });

    // Swipe navigation between main tabs (Task 11):
    // Swiping left goes to #/settings, swiping right goes to #/chats
    let touchStartX = 0;
    let touchStartY = 0;
    const screenEl = this.container.querySelector('.calls-screen');
    if (screenEl) {
      screenEl.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      screenEl.addEventListener('touchend', (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > 75 && Math.abs(deltaX) > 1.8 * Math.abs(deltaY)) {
          if (deltaX < 0) {
            this.router.navigate('#/settings');
          } else {
            this.router.navigate('#/chats');
          }
        }
      }, { passive: true });
    }
  }
}
