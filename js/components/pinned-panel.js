// Pinned Messages Resizable Bottom Sheet Panel
import { Icons } from '../icons.js';
import { DrawerResizer } from '../utils/drawer-resizer.js';
import { Toast } from './toast.js';
import { showConfirm } from './custom-dialog.js';

export class PinnedPanel {
  /**
   * @param {Object} options
   * @param {string} options.chatId
   * @param {Array} options.pins - Array of pinned message records
   * @param {Object} options.priorityMode - { mode, mixedDays, switcherSeconds }
   * @param {Function} options.onJumpToMessage - (messageId) => void
   * @param {Function} options.onPinsChanged - (updatedPins, updatedMode) => void
   * @param {Function} [options.onClose] - () => void
   */
  constructor(options) {
    this.chatId = options.chatId;
    this.pins = Array.isArray(options.pins) ? [...options.pins] : [];
    this.priorityMode = options.priorityMode || { mode: 'last_added', mixedDays: 7, switcherSeconds: 10 };
    this.onJumpToMessage = options.onJumpToMessage || (() => {});
    this.onPinsChanged = options.onPinsChanged || (() => {});
    this.onClose = options.onClose || (() => {});

    this.container = null;
    this.resizer = null;
    this.activeView = 'list'; // 'list' | 'settings'
    this.longPressTimer = null;
  }

  open() {
    this._buildDOM();
    document.body.appendChild(this.container);

    const sheet = this.container.querySelector('#pinned-panel-sheet');
    const handle = this.container.querySelector('#pinned-panel-handle');
    const backdrop = this.container.querySelector('#pinned-panel-backdrop');
    const fullscreenHeader = this.container.querySelector('#pinned-panel-fs-header');

    this.resizer = new DrawerResizer({
      sheet,
      handle,
      backdrop,
      fullscreenHeader,
      overlayId: 'pinned-messages-panel',
      defaultHeightVh: 50,
      minVh: 20,
      maxVh: 80,
      onClose: () => {
        this.destroy();
        this.onClose();
      }
    });

    this.resizer.open(50);
  }

  destroy() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.resizer = null;
  }

  _buildDOM() {
    this.container = document.createElement('div');
    this.container.className = 'pinned-panel-wrapper';

    this.container.innerHTML = `
      <div class="pinned-panel-backdrop" id="pinned-panel-backdrop"></div>
      <div class="pinned-panel-sheet" id="pinned-panel-sheet">
        
        <!-- Drag Handle Area (Dash stays visible in Fullscreen) -->
        <div class="pinned-panel-handle-area" id="pinned-panel-handle">
          <div class="pinned-panel-dash"></div>
          <div class="pinned-panel-header-bar">
            <div class="pinned-panel-header-spacer"></div>
            <div class="pinned-panel-header-center">
              <span class="pinned-panel-pin-icon">${Icons.pin('', 18)}</span>
              <h3 class="pinned-panel-heading" id="pinned-panel-heading-text">Pinned messages (${this.pins.length})</h3>
            </div>
            <div class="pinned-panel-header-actions">
              <button type="button" class="pinned-panel-gear-btn app-bar-icon-btn" id="btn-pinned-priority-gear" title="Display priority settings">
                ${Icons.settingsTab('', 20)}
              </button>
            </div>
          </div>
        </div>

        <!-- Fullscreen Header (only visible > 80% vh) -->
        <div class="pinned-panel-fullscreen-header" id="pinned-panel-fs-header" style="display: none;">
          <button type="button" class="sheet-fullscreen-back-btn app-bar-icon-btn" aria-label="Back">
            ${Icons.arrowBack('', 22)}
          </button>
          <span class="fs-header-title" id="pinned-panel-fs-title">Pinned messages</span>
          <div style="flex: 1;"></div>
          <button type="button" class="pinned-panel-gear-btn app-bar-icon-btn" id="btn-pinned-priority-gear-fs" title="Display priority settings">
            ${Icons.settingsTab('', 20)}
          </button>
        </div>

        <!-- Main Body: List View vs Priority Settings View -->
        <div class="pinned-panel-body" id="pinned-panel-body">
          <div class="pinned-panel-list-view" id="pinned-panel-list-view">
            <!-- Pin items rendered dynamically -->
          </div>

          <div class="pinned-panel-settings-view" id="pinned-panel-settings-view" style="display: none;">
            <!-- Settings rendered dynamically -->
          </div>
        </div>
      </div>
    `;

    this._renderListView();
    this._renderSettingsView();
    this._bindEvents();
  }

  _renderListView() {
    const listEl = this.container.querySelector('#pinned-panel-list-view');
    if (!listEl) return;

    if (this.pins.length === 0) {
      listEl.innerHTML = `
        <div class="pinned-panel-empty">
          <span class="pinned-empty-icon">${Icons.pinOff('', 36)}</span>
          <p>No pinned messages in this chat</p>
        </div>
      `;
      return;
    }

    // Render list ordered by pinnedAt descending (newest first in list)
    const sorted = [...this.pins].sort((a, b) => b.pinnedAt - a.pinnedAt);

    listEl.innerHTML = sorted.map((pin) => {
      const expiryText = this._formatExpiry(pin.expiresAt);
      const timeStr = new Date(pin.pinnedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const senderText = pin.sender ? escapeHtml(pin.sender) : 'Message';
      const snippet = pin.text ? escapeHtml(pin.text) : (pin.mediaType ? `[${pin.mediaType}]` : 'Media message');

      return `
        <div class="pinned-item-row" data-pin-id="${pin.id}" data-msg-id="${pin.messageId}">
          <div class="pinned-item-indicator"></div>
          <div class="pinned-item-content">
            <div class="pinned-item-top">
              <span class="pinned-item-sender">${senderText}</span>
              <span class="pinned-item-time">${timeStr}</span>
            </div>
            <div class="pinned-item-snippet">${snippet}</div>
            <div class="pinned-item-bottom">
              <span class="pinned-item-expiry ${pin.expiresAt === null ? 'permanent' : ''}">
                ${Icons.clock ? Icons.clock('', 13) : ''}
                <span>${expiryText}</span>
              </span>
              <button type="button" class="pinned-item-unpin-btn" data-pin-id="${pin.id}" title="Unpin message">
                ${Icons.pinOff('', 16)}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this._bindListRowEvents();
  }

  _formatExpiry(expiresAt) {
    if (expiresAt === null || expiresAt === undefined) {
      return 'Permanent';
    }
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.ceil(diff / 3600000);
    if (hours < 24) return `Expires in ${hours}h`;
    const days = Math.ceil(diff / 86400000);
    return `Expires in ${days} ${days === 1 ? 'day' : 'days'}`;
  }

  _renderSettingsView() {
    const settingsEl = this.container.querySelector('#pinned-panel-settings-view');
    if (!settingsEl) return;

    const currentMode = this.priorityMode.mode || 'last_added';
    const mixedDays = this.priorityMode.mixedDays || 7;
    const switcherSecs = this.priorityMode.switcherSeconds || 10;

    settingsEl.innerHTML = `
      <div class="pinned-settings-header">
        <button type="button" class="app-bar-icon-btn" id="btn-pinned-settings-back">
          ${Icons.arrowBack('', 20)}
        </button>
        <h4 class="pinned-settings-title">Pinned Bar Display Priority</h4>
      </div>

      <div class="pinned-settings-content">
        <div class="pinned-priority-radio-group">
          
          <!-- Last Added -->
          <label class="pinned-priority-option">
            <input type="radio" name="priority-mode" value="last_added" class="wa-radio" ${currentMode === 'last_added' ? 'checked' : ''} />
            <div class="pinned-priority-meta">
              <div class="pinned-priority-title">Last added <span class="priority-badge-default">(Default)</span></div>
              <div class="pinned-priority-desc">Always displays the most recently pinned message on the bar.</div>
            </div>
          </label>

          <!-- First Added -->
          <label class="pinned-priority-option">
            <input type="radio" name="priority-mode" value="first_added" class="wa-radio" ${currentMode === 'first_added' ? 'checked' : ''} />
            <div class="pinned-priority-meta">
              <div class="pinned-priority-title">First added</div>
              <div class="pinned-priority-desc">Always displays the earliest pinned message on the bar.</div>
            </div>
          </label>

          <!-- About to End -->
          <label class="pinned-priority-option">
            <input type="radio" name="priority-mode" value="about_to_end" class="wa-radio" ${currentMode === 'about_to_end' ? 'checked' : ''} />
            <div class="pinned-priority-meta">
              <div class="pinned-priority-title">About to end</div>
              <div class="pinned-priority-desc">Gives highest priority to the pinned message expiring soonest.</div>
            </div>
          </label>

          <!-- Mixed Mode -->
          <div class="pinned-priority-expandable-card ${currentMode === 'mixed' ? 'active' : ''}">
            <label class="pinned-priority-option">
              <input type="radio" name="priority-mode" value="mixed" class="wa-radio" ${currentMode === 'mixed' ? 'checked' : ''} />
              <div class="pinned-priority-meta">
                <div class="pinned-priority-title-row">
                  <span class="pinned-priority-title">Mixed</span>
                  <span class="pinned-info-icon" title="Mixed Priority" data-tooltip="mixed">
                    ${Icons.infoCircle('', 16)}
                  </span>
                </div>
                <div class="pinned-priority-desc">Prioritizes newest messages, but switches priority to messages expiring within threshold days.</div>
              </div>
            </label>
            <div class="pinned-priority-inline-config" id="config-mixed-days" style="${currentMode === 'mixed' ? '' : 'display: none;'}">
              <div class="priority-config-field">
                <label for="input-mixed-days">Threshold days:</label>
                <input type="number" id="input-mixed-days" min="1" max="365" value="${mixedDays}" class="priority-number-input" />
                <span class="config-unit">days</span>
              </div>
              <div class="priority-info-box">
                ${Icons.infoCircle('', 14)}
                <span>Give priority to the newest pin, except when a pin's remaining days matches or is less than this threshold, it takes top priority.</span>
              </div>
            </div>
          </div>

          <!-- Switcher Mode -->
          <div class="pinned-priority-expandable-card ${currentMode === 'switcher' ? 'active' : ''}">
            <label class="pinned-priority-option">
              <input type="radio" name="priority-mode" value="switcher" class="wa-radio" ${currentMode === 'switcher' ? 'checked' : ''} />
              <div class="pinned-priority-meta">
                <div class="pinned-priority-title-row">
                  <span class="pinned-priority-title">Switcher</span>
                  <span class="pinned-info-icon" title="Switcher Priority" data-tooltip="switcher">
                    ${Icons.infoCircle('', 16)}
                  </span>
                </div>
                <div class="pinned-priority-desc">Periodically cycles the bar display across all pinned messages.</div>
              </div>
            </label>
            <div class="pinned-priority-inline-config" id="config-switcher-secs" style="${currentMode === 'switcher' ? '' : 'display: none;'}">
              <div class="priority-config-field">
                <label for="input-switcher-secs">Switch interval:</label>
                <input type="number" id="input-switcher-secs" min="1" max="3600" value="${switcherSecs}" class="priority-number-input" />
                <span class="config-unit">seconds</span>
              </div>
              <div class="priority-info-box">
                ${Icons.infoCircle('', 14)}
                <span>Rotates the pinned bar to display the next pinned message every specified number of seconds.</span>
              </div>
            </div>
          </div>

        </div>

        <div class="pinned-settings-actions">
          <button type="button" class="dialog-btn dialog-btn-confirm" id="btn-save-pinned-priority">
            Save priority settings
          </button>
        </div>
      </div>
    `;

    this._bindSettingsEvents();
  }

  _bindEvents() {
    const gearBtn = this.container.querySelector('#btn-pinned-priority-gear');
    if (gearBtn) {
      gearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showView('settings');
      });
    }

    const gearFsBtn = this.container.querySelector('#btn-pinned-priority-gear-fs');
    if (gearFsBtn) {
      gearFsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showView('settings');
      });
    }
  }

  _showView(viewName) {
    this.activeView = viewName;
    const listEl = this.container.querySelector('#pinned-panel-list-view');
    const settingsEl = this.container.querySelector('#pinned-panel-settings-view');
    const headingEl = this.container.querySelector('#pinned-panel-heading-text');
    const fsTitleEl = this.container.querySelector('#pinned-panel-fs-title');
    const gearBtn = this.container.querySelector('#btn-pinned-priority-gear');
    const gearFsBtn = this.container.querySelector('#btn-pinned-priority-gear-fs');

    if (viewName === 'settings') {
      if (listEl) listEl.style.display = 'none';
      if (settingsEl) settingsEl.style.display = 'block';
      if (headingEl) headingEl.textContent = 'Display Priority';
      if (fsTitleEl) fsTitleEl.textContent = 'Display Priority';
      if (gearBtn) gearBtn.style.display = 'none';
      if (gearFsBtn) gearFsBtn.style.display = 'none';
    } else {
      if (listEl) listEl.style.display = 'block';
      if (settingsEl) settingsEl.style.display = 'none';
      if (headingEl) headingEl.textContent = `Pinned messages (${this.pins.length})`;
      if (fsTitleEl) fsTitleEl.textContent = `Pinned messages (${this.pins.length})`;
      if (gearBtn) gearBtn.style.display = 'flex';
      if (gearFsBtn) gearFsBtn.style.display = 'flex';
      this._renderListView();
    }
  }

  _bindListRowEvents() {
    const listEl = this.container.querySelector('#pinned-panel-list-view');
    if (!listEl) return;

    const rows = listEl.querySelectorAll('.pinned-item-row');
    rows.forEach((row) => {
      const pinId = row.getAttribute('data-pin-id');
      const msgId = row.getAttribute('data-msg-id');

      // Tapping row jumps to message in chat and closes panel
      row.addEventListener('click', (e) => {
        if (e.target.closest('.pinned-item-unpin-btn')) return;
        this.resizer.close();
        this.onJumpToMessage(msgId);
      });

      // Long-press detection to unpin
      let pressTimer = null;
      row.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        pressTimer = setTimeout(() => {
          this._confirmUnpin(pinId);
        }, 550);
      });

      const cancelPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };

      row.addEventListener('pointerup', cancelPress);
      row.addEventListener('pointerleave', cancelPress);
      row.addEventListener('pointercancel', cancelPress);

      // Explicit Unpin button
      const unpinBtn = row.querySelector('.pinned-item-unpin-btn');
      if (unpinBtn) {
        unpinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._confirmUnpin(pinId);
        });
      }
    });
  }

  _bindSettingsEvents() {
    const settingsEl = this.container.querySelector('#pinned-panel-settings-view');
    if (!settingsEl) return;

    const backBtn = settingsEl.querySelector('#btn-pinned-settings-back');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showView('list');
      });
    }

    const radios = settingsEl.querySelectorAll('input[name="priority-mode"]');
    const mixedConfig = settingsEl.querySelector('#config-mixed-days');
    const switcherConfig = settingsEl.querySelector('#config-switcher-secs');

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        const val = radio.value;
        if (mixedConfig) mixedConfig.style.display = val === 'mixed' ? 'block' : 'none';
        if (switcherConfig) switcherConfig.style.display = val === 'switcher' ? 'block' : 'none';

        settingsEl.querySelectorAll('.pinned-priority-expandable-card').forEach((card) => {
          card.classList.remove('active');
        });
        const parentCard = radio.closest('.pinned-priority-expandable-card');
        if (parentCard) parentCard.classList.add('active');
      });
    });

    // Tooltip icons
    settingsEl.querySelectorAll('.pinned-info-icon').forEach((icon) => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = icon.getAttribute('data-tooltip');
        if (type === 'mixed') {
          Toast.show('Mixed: Newest pins first, but pins expiring soon take top priority');
        } else if (type === 'switcher') {
          Toast.show('Switcher: Periodically switches between all pinned messages');
        }
      });
    });

    // Save button
    const saveBtn = settingsEl.querySelector('#btn-save-pinned-priority');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const selectedRadio = settingsEl.querySelector('input[name="priority-mode"]:checked');
        const mode = selectedRadio ? selectedRadio.value : 'last_added';
        const mixedDaysInput = settingsEl.querySelector('#input-mixed-days');
        const switcherSecsInput = settingsEl.querySelector('#input-switcher-secs');

        const mixedDays = mixedDaysInput ? Math.max(1, parseInt(mixedDaysInput.value, 10) || 7) : 7;
        const switcherSeconds = switcherSecsInput ? Math.max(1, parseInt(switcherSecsInput.value, 10) || 10) : 10;

        this.priorityMode = { mode, mixedDays, switcherSeconds };
        this.onPinsChanged(this.pins, this.priorityMode);
        Toast.show('Display priority updated');
        this._showView('list');
      });
    }
  }

  async _confirmUnpin(pinId) {
    const pin = this.pins.find((p) => p.id === pinId);
    if (!pin) return;

    const confirmed = await showConfirm({
      title: 'Unpin message?',
      message: 'Do you want to unpin this message from this chat?',
      confirmText: 'Unpin',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      this.pins = this.pins.filter((p) => p.id !== pinId);
      this.onPinsChanged(this.pins, this.priorityMode);
      Toast.show('Message unpinned');

      if (this.pins.length === 0) {
        this.resizer.close();
      } else {
        const headingEl = this.container.querySelector('#pinned-panel-heading-text');
        if (headingEl) headingEl.textContent = `Pinned messages (${this.pins.length})`;
        this._renderListView();
      }
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

