// Message Info Bottom Sheet — shows full details for a selected message
// Uses DrawerResizer for drag-to-resize behavior (< 20% close, > 80% fullscreen)

import { DrawerResizer } from '../utils/drawer-resizer.js';
import { Icons } from '../icons.js';

export class MessageInfoSheet {
  constructor() {
    this.overlayEl = null;
    this.sheetEl = null;
    this.handleEl = null;
    this.fsHeaderEl = null;
    this.resizer = null;
    this._built = false;
  }

  _ensureBuilt() {
    if (this._built) return;
    this._built = true;

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'msg-info-overlay wa-sheet-overlay';
    this.overlayEl.style.display = 'none';

    this.sheetEl = document.createElement('div');
    this.sheetEl.className = 'msg-info-sheet wa-bottom-sheet';
    this.sheetEl.style.display = 'none';

    // Handle area (centered dash + title)
    this.handleEl = document.createElement('div');
    this.handleEl.className = 'msg-info-handle sheet-handle-area';
    this.handleEl.innerHTML = `
      <div class="sheet-dash"></div>
      <div class="msg-info-sheet-title">Message info</div>
    `;
    this.sheetEl.appendChild(this.handleEl);

    // Fullscreen header (shown above 80%)
    this.fsHeaderEl = document.createElement('div');
    this.fsHeaderEl.className = 'msg-info-fs-header sheet-fullscreen-header';
    this.fsHeaderEl.style.display = 'none';
    this.fsHeaderEl.innerHTML = `
      <button type="button" class="app-bar-icon-btn fs-back-btn" aria-label="Back">${Icons.arrowBack('', 24)}</button>
      <span class="fs-header-title">Message info</span>
    `;
    this.fsHeaderEl.querySelector('.fs-back-btn').addEventListener('click', () => this.close());
    this.sheetEl.appendChild(this.fsHeaderEl);

    // Body
    const body = document.createElement('div');
    body.className = 'msg-info-body';
    this.sheetEl.appendChild(body);
    this._bodyEl = body;

    // Backdrop click to close
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) this.close();
    });

    document.body.appendChild(this.overlayEl);
    document.body.appendChild(this.sheetEl);

    this.resizer = new DrawerResizer({
      sheet: this.sheetEl,
      handle: this.handleEl,
      backdrop: this.overlayEl,
      fullscreenHeader: this.fsHeaderEl,
      overlayId: 'msg-info-sheet',
      mode: 'centered',
      defaultHeightVh: 40,
      minVh: 20,
      maxVh: 80,
      onClose: () => {
        this.overlayEl.style.display = 'none';
      }
    });
  }

  /**
   * @param {Object} msg - the message object
   * @param {boolean} [isPinned=false] - whether this message is currently pinned
   */
  show(msg, isPinned = false) {
    this._ensureBuilt();

    const body = this._bodyEl;
    body.innerHTML = '';

    // Message content preview bubble
    const previewWrap = document.createElement('div');
    previewWrap.className = 'msg-info-preview-wrap';

    const bubble = document.createElement('div');
    bubble.className = `msg-info-bubble ${msg.isOutgoing ? 'outgoing' : 'incoming'}`;

    if (msg.text && !msg.isDeleted) {
      const textEl = document.createElement('div');
      textEl.className = 'msg-info-text';
      textEl.textContent = msg.text;
      textEl.setAttribute('dir', 'auto');
      bubble.appendChild(textEl);
    } else if (msg.isDeleted) {
      const delEl = document.createElement('div');
      delEl.className = 'msg-info-deleted-text';
      delEl.textContent = 'This message was deleted';
      bubble.appendChild(delEl);
    } else if (msg.mediaName || msg.mediaType) {
      const mediaEl = document.createElement('div');
      mediaEl.className = 'msg-info-media-text';
      const typeLabel = msg.mediaType ? msg.mediaType.charAt(0).toUpperCase() + msg.mediaType.slice(1) : 'Media';
      mediaEl.textContent = `${typeLabel}${msg.mediaName ? ': ' + msg.mediaName : ''}`;
      bubble.appendChild(mediaEl);
    }

    if (msg.reaction) {
      const reactBadge = document.createElement('div');
      reactBadge.className = 'msg-info-reaction-pill';
      reactBadge.textContent = msg.reaction;
      bubble.appendChild(reactBadge);
    }

    previewWrap.appendChild(bubble);
    body.appendChild(previewWrap);

    // Metadata card
    const card = document.createElement('div');
    card.className = 'msg-info-card';

    const sentDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
    const formattedDate = sentDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const formattedTime = sentDate.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const rows = [
      {
        icon: Icons.checks('info-status-icon read', 18),
        title: 'Read',
        desc: `${formattedDate}, ${formattedTime}`
      },
      {
        icon: Icons.check('info-status-icon delivered', 18),
        title: 'Delivered',
        desc: `${formattedDate}, ${formattedTime}`
      }
    ];

    rows.forEach(r => {
      const rowEl = document.createElement('div');
      rowEl.className = 'msg-info-row';
      rowEl.innerHTML = `
        <div class="msg-info-row-icon">${r.icon}</div>
        <div class="msg-info-row-content">
          <div class="msg-info-row-title">${r.title}</div>
          <div class="msg-info-row-desc">${r.desc}</div>
        </div>
      `;
      card.appendChild(rowEl);
    });

    body.appendChild(card);

    // Status details card
    const statusCard = document.createElement('div');
    statusCard.className = 'msg-info-card';

    const statusItems = [
      {
        label: 'Starred',
        value: msg.isStarred ? 'Yes' : 'No',
        icon: Icons.star('', 16)
      },
      {
        label: 'Pinned',
        value: isPinned ? 'Yes' : 'No',
        icon: Icons.pin('', 16)
      },
      {
        label: 'Forwarded',
        value: msg.isForwarded ? 'Yes' : 'No',
        icon: Icons.forwardBold('', 16)
      },
      {
        label: 'Edited',
        value: msg.isEdited ? 'Yes' : 'No',
        icon: Icons.edit('', 16)
      },
      {
        label: 'Reaction',
        value: msg.reaction ? msg.reaction : 'None',
        icon: '😊'
      }
    ];

    statusItems.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'msg-info-status-row';
      itemEl.innerHTML = `
        <div class="msg-info-status-left">
          <span class="msg-info-status-icon">${typeof item.icon === 'string' && item.icon.startsWith('<') ? item.icon : item.icon}</span>
          <span class="msg-info-status-label">${item.label}</span>
        </div>
        <span class="msg-info-status-val ${item.value === 'Yes' ? 'highlight' : ''}">${item.value}</span>
      `;
      statusCard.appendChild(itemEl);
    });

    body.appendChild(statusCard);

    this.overlayEl.style.display = 'block';
    this.resizer.open(40);
  }

  close() {
    if (this.resizer) this.resizer.close();
  }

  destroy() {
    if (this.resizer) this.close();
    if (this.sheetEl && this.sheetEl.parentNode) this.sheetEl.parentNode.removeChild(this.sheetEl);
    if (this.overlayEl && this.overlayEl.parentNode) this.overlayEl.parentNode.removeChild(this.overlayEl);
  }
}
