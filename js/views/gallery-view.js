// Screen 3: Global Media Gallery Screen
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { mediaLightbox } from '../components/lightbox.js';

export class GalleryView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.activeType = 'all'; // 'all', 'image', 'video'
    this.filterChatId = 'all';
    this.allMediaItems = [];
    this.allMessages = [];
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    if (params.chatId) {
      this.filterChatId = params.chatId;
    }
    const chats = await db.getChats();

    rootEl.innerHTML = `
      <div class="screen-view gallery-screen">
        <header class="wa-app-bar">
          <button class="app-bar-icon-btn" id="btn-gallery-back">${Icons.arrowBack('', 24)}</button>
          <div class="app-title">Media Gallery</div>
        </header>

        <!-- Gallery Filter Controls -->
        <div class="gallery-controls-bar">
          <div class="gallery-type-chips">
            <button class="filter-chip ${this.activeType === 'all' ? 'active' : ''}" data-type="all">All</button>
            <button class="filter-chip ${this.activeType === 'image' ? 'active' : ''}" data-type="image">Photos</button>
            <button class="filter-chip ${this.activeType === 'video' ? 'active' : ''}" data-type="video">Videos</button>
            <button class="filter-chip ${this.activeType === 'sticker' ? 'active' : ''}" data-type="sticker">Stickers</button>
          </div>
          <select id="gallery-chat-select" class="wa-select">
            <option value="all" ${this.filterChatId === 'all' ? 'selected' : ''}>All Chats</option>
            ${chats.map((c) => `<option value="${c.id}" ${this.filterChatId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>

        <!-- Gallery Grid -->
        <div class="gallery-content-scroller" id="gallery-grid-container">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    this.container.querySelector('#btn-gallery-back').addEventListener('click', () => {
      this.router.navigate('#/chats');
    });

    this.container.querySelectorAll('.gallery-type-chips .filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.gallery-type-chips .filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeType = btn.dataset.type;
        this.renderGrid();
      });
    });

    this.container.querySelector('#gallery-chat-select').addEventListener('change', (e) => {
      this.filterChatId = e.target.value;
      this.renderGrid();
    });

    await this.loadMediaData();
    this.renderGrid();
  }

  async loadMediaData() {
    this.allMediaItems = await db.getAllMedia();
    // Cache messages for fast lookup
    const allChats = await db.getChats();
    const msgs = [];
    for (const c of allChats) {
      const chatMsgs = await db.getMessages(c.id);
      msgs.push(...chatMsgs);
    }
    this.allMessages = msgs;
  }

  renderGrid() {
    const gridContainer = this.container.querySelector('#gallery-grid-container');
    gridContainer.innerHTML = '';

    // Filter media by type and chat with strict sticker separation (Task 5)
    let filtered = this.allMediaItems.filter((m) => {
      const isSticker = m.type === 'sticker' || m.mediaType === 'sticker' || (m.filename && (/\.webp$/i.test(m.filename) || /stk-/i.test(m.filename) || /sticker/i.test(m.filename))) || m.mimeType === 'image/webp';
      const isImg = m.mimeType.startsWith('image/') && !isSticker;
      const isVid = m.mimeType.startsWith('video/');

      if (this.activeType === 'all') {
        if (!isImg && !isVid) return false;
      } else if (this.activeType === 'image') {
        if (!isImg) return false;
      } else if (this.activeType === 'video') {
        if (!isVid) return false;
      } else if (this.activeType === 'sticker') {
        if (!isSticker) return false;
      }

      if (this.filterChatId !== 'all' && m.chatId !== this.filterChatId) return false;

      return true;
    });

    if (filtered.length === 0) {
      gridContainer.innerHTML = `
        <div class="empty-gallery-state">
          ${Icons.gallery('', 48)}
          <p>No photos or videos found.</p>
        </div>
      `;
      return;
    }

    // Group by Month / Year
    const groups = new Map(); // "November 2026" -> [items]
    const msgMap = new Map(); // mediaId -> message
    for (const m of this.allMessages) {
      if (m.mediaId) msgMap.set(m.mediaId, m);
    }

    filtered.forEach((m) => {
      const msg = msgMap.get(m.id) || {};
      const ts = msg.timestamp || Date.now();
      const date = new Date(ts);
      const groupKey = date.toLocaleDateString([], { month: 'long', year: 'numeric' });

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push({ media: m, msg });
    });

    // Render groups
    for (const [groupTitle, items] of groups.entries()) {
      const section = document.createElement('div');
      section.className = 'gallery-month-section';

      const title = document.createElement('div');
      title.className = 'gallery-month-title';
      title.textContent = groupTitle;
      section.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'gallery-tiles-grid';

      items.forEach(({ media, msg }) => {
        const tile = document.createElement('div');
        tile.className = 'gallery-tile';
        const url = URL.createObjectURL(media.blob);
        const isVideo = media.mimeType.startsWith('video/');

        if (isVideo) {
          tile.innerHTML = `
            <video src="${url}" preload="metadata" class="tile-thumb"></video>
            <div class="tile-video-badge">${Icons.play('', 14)}</div>
          `;
        } else {
          tile.innerHTML = `<img src="${url}" alt="${media.filename}" loading="lazy" class="tile-thumb" />`;
        }

        tile.addEventListener('click', () => {
          mediaLightbox.show(media, msg, (targetChatId, targetMsgId) => {
            this.router.navigate(`#/chat/${targetChatId}?msgId=${targetMsgId}`);
          });
        });

        grid.appendChild(tile);
      });

      section.appendChild(grid);
      gridContainer.appendChild(section);
    }
  }
}
