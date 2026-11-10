// Screen 3: Media Gallery Screen with Multi-Toggle Filters (Photos, Videos, Documents, Links, Stickers)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { mediaLightbox } from '../components/lightbox.js';

export class GalleryView {
  constructor(router) {
    this.router = router;
    this.container = null;
    // By default, Photos and Videos filters are selected simultaneously
    this.activeTypes = new Set(['image', 'video']);
    this.filterChatId = 'all';
    this.chat = null;
    this.allMediaItems = [];
    this.allMessages = [];
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    if (params.chatId) {
      this.filterChatId = params.chatId;
      this.chat = await db.getChat(this.filterChatId);
    } else {
      this.filterChatId = 'all';
      this.chat = null;
    }

    const titleText = this.chat ? `${this.chat.name} - Media` : 'Media Gallery';

    rootEl.innerHTML = `
      <div class="screen-view gallery-screen">
        <header class="wa-app-bar">
          <button class="app-bar-icon-btn" id="btn-gallery-back" aria-label="Go back">${Icons.arrowBack('', 24)}</button>
          <div class="app-title">${titleText}</div>
        </header>

        <!-- Gallery Multi-Toggle Filter Controls (Removed "All" and "All Chats") -->
        <div class="gallery-controls-bar">
          <div class="gallery-type-chips">
            <button type="button" class="filter-chip ${this.activeTypes.has('image') ? 'active' : ''}" data-type="image">Photos</button>
            <button type="button" class="filter-chip ${this.activeTypes.has('video') ? 'active' : ''}" data-type="video">Videos</button>
            <button type="button" class="filter-chip ${this.activeTypes.has('document') ? 'active' : ''}" data-type="document">Documents</button>
            <button type="button" class="filter-chip ${this.activeTypes.has('link') ? 'active' : ''}" data-type="link">Links</button>
            <button type="button" class="filter-chip ${this.activeTypes.has('sticker') ? 'active' : ''}" data-type="sticker">Stickers</button>
          </div>
        </div>

        <!-- Gallery Content Container -->
        <div class="gallery-content-scroller" id="gallery-grid-container">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    // Back button navigation
    this.container.querySelector('#btn-gallery-back').addEventListener('click', () => {
      this.router.back();
    });

    // Multi-Toggle Filter Chips (active on press, deactivated on second press)
    this.container.querySelectorAll('.gallery-type-chips .filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (this.activeTypes.has(type)) {
          this.activeTypes.delete(type);
          btn.classList.remove('active');
        } else {
          this.activeTypes.add(type);
          btn.classList.add('active');
        }
        this.renderGrid();
      });
    });

    await this.loadMediaData();
    this.renderGrid();
  }

  async loadMediaData() {
    this.allMediaItems = await db.getAllMedia();
    const allChats = await db.getChats();
    const msgs = [];
    if (this.filterChatId && this.filterChatId !== 'all') {
      const chatMsgs = await db.getMessages(this.filterChatId);
      msgs.push(...chatMsgs);
    } else {
      for (const c of allChats) {
        const chatMsgs = await db.getMessages(c.id);
        msgs.push(...chatMsgs);
      }
    }
    this.allMessages = msgs;
  }

  renderGrid() {
    const gridContainer = this.container.querySelector('#gallery-grid-container');
    gridContainer.innerHTML = '';

    // If all filters are deactivated, show centered notice to activate a filter
    if (this.activeTypes.size === 0) {
      gridContainer.innerHTML = `
        <div class="empty-gallery-state">
          <div class="empty-icon-circle">${Icons.search('', 34)}</div>
          <h3>No filters active</h3>
          <p>Tap a filter button above to display photos, videos, documents, or links.</p>
        </div>
      `;
      return;
    }

    // Helper to identify stickers
    const isSticker = (m) =>
      m.type === 'sticker' ||
      m.mediaType === 'sticker' ||
      (m.filename && (/\.webp$/i.test(m.filename) || /stk-/i.test(m.filename) || /sticker/i.test(m.filename))) ||
      m.mimeType === 'image/webp';

    const msgMap = new Map();
    for (const m of this.allMessages) {
      if (m.mediaId) msgMap.set(m.mediaId, m);
    }

    // 1. Gather Visual items (Photos, Videos, Stickers)
    const visualItems = [];
    for (const m of this.allMediaItems) {
      if (this.filterChatId !== 'all' && m.chatId !== this.filterChatId) continue;

      const sticker = isSticker(m);
      const isImg = (m.mimeType?.startsWith('image/') || m.type === 'image') && !sticker;
      const isVid = m.mimeType?.startsWith('video/') || m.type === 'video';

      if (sticker && this.activeTypes.has('sticker')) {
        const parentMsg = msgMap.get(m.id) || {};
        visualItems.push({ type: 'sticker', media: m, msg: parentMsg, timestamp: parentMsg.timestamp || Date.now() });
      } else if (isImg && this.activeTypes.has('image')) {
        const parentMsg = msgMap.get(m.id) || {};
        visualItems.push({ type: 'image', media: m, msg: parentMsg, timestamp: parentMsg.timestamp || Date.now() });
      } else if (isVid && this.activeTypes.has('video')) {
        const parentMsg = msgMap.get(m.id) || {};
        visualItems.push({ type: 'video', media: m, msg: parentMsg, timestamp: parentMsg.timestamp || Date.now() });
      }
    }

    // 2. Gather Document items (PDFs and generic documents)
    const docItems = [];
    if (this.activeTypes.has('document')) {
      for (const m of this.allMediaItems) {
        if (this.filterChatId !== 'all' && m.chatId !== this.filterChatId) continue;
        const sticker = isSticker(m);
        const isImg = (m.mimeType?.startsWith('image/') || m.type === 'image') && !sticker;
        const isVid = m.mimeType?.startsWith('video/') || m.type === 'video';
        const isAudio = m.mimeType?.startsWith('audio/') || m.type === 'audio';

        if (!isImg && !isVid && !sticker && !isAudio) {
          const parentMsg = msgMap.get(m.id) || {};
          docItems.push({ type: 'document', media: m, msg: parentMsg, timestamp: parentMsg.timestamp || Date.now() });
        }
      }
    }

    // 3. Gather Links items from message text
    const linkItems = [];
    if (this.activeTypes.has('link')) {
      const urlRegex = /(https?:\/\/[^\s<]+)/gi;
      for (const msg of this.allMessages) {
        if (this.filterChatId !== 'all' && msg.chatId !== this.filterChatId) continue;
        if (!msg.text) continue;

        let match;
        while ((match = urlRegex.exec(msg.text)) !== null) {
          const rawUrl = match[1];
          let domain = '';
          try {
            domain = new URL(rawUrl).hostname.replace(/^www\./, '');
          } catch (e) {
            domain = rawUrl;
          }
          linkItems.push({
            type: 'link',
            url: rawUrl,
            domain,
            msg,
            timestamp: msg.timestamp || Date.now()
          });
        }
      }
    }

    const totalCount = visualItems.length + docItems.length + linkItems.length;
    if (totalCount === 0) {
      gridContainer.innerHTML = `
        <div class="empty-gallery-state">
          <div class="empty-icon-circle">${Icons.gallery('', 34)}</div>
          <h3>No media items</h3>
          <p>No items match the active filters.</p>
        </div>
      `;
      return;
    }

    // Group items by Month / Year
    const groups = new Map(); // "November 2026" -> { visuals: [], docs: [], links: [] }

    const addToGroup = (item, category) => {
      const date = new Date(item.timestamp);
      const groupKey = date.toLocaleDateString([], { month: 'long', year: 'numeric' });
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { visuals: [], docs: [], links: [] });
      }
      groups.get(groupKey)[category].push(item);
    };

    visualItems.forEach((v) => addToGroup(v, 'visuals'));
    docItems.forEach((d) => addToGroup(d, 'docs'));
    linkItems.forEach((l) => addToGroup(l, 'links'));

    // Render Month Sections
    for (const [groupTitle, groupData] of groups.entries()) {
      const section = document.createElement('div');
      section.className = 'gallery-month-section';

      const title = document.createElement('div');
      title.className = 'gallery-month-title';
      title.textContent = groupTitle;
      section.appendChild(title);

      // A. Render Visual Grid (Photos, Videos, Stickers)
      if (groupData.visuals.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'gallery-tiles-grid';

        groupData.visuals.forEach(({ media, msg, type }) => {
          const tile = document.createElement('div');
          tile.className = 'gallery-tile';
          const url = URL.createObjectURL(media.blob);

          if (type === 'video') {
            tile.innerHTML = `
              <video src="${url}" preload="metadata" class="tile-thumb"></video>
              <div class="tile-video-badge">${Icons.play('', 14)}</div>
            `;
          } else if (type === 'sticker') {
            tile.innerHTML = `<img src="${url}" alt="${media.filename}" loading="lazy" class="tile-thumb" style="object-fit:contain; background:transparent;" />`;
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
      }

      // B. Render Documents List
      if (groupData.docs.length > 0) {
        const docsList = document.createElement('div');
        docsList.className = 'gallery-docs-list';

        groupData.docs.forEach(({ media, msg }) => {
          const card = document.createElement('div');
          card.className = 'gallery-doc-card';
          const sizeStr = db.formatBytes(media.size || 0);
          const dateStr = new Date(msg.timestamp || Date.now()).toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
          });
          const isPdf = media.mimeType === 'application/pdf' || media.type === 'pdf';

          card.innerHTML = `
            <div class="gallery-doc-icon">
              ${isPdf ? Icons.pdfIcon('', 24) : Icons.documentIcon('', 22)}
            </div>
            <div class="gallery-doc-info">
              <div class="gallery-doc-title" title="${media.filename}">${media.filename || 'Document'}</div>
              <div class="gallery-doc-sub">${sizeStr} • ${dateStr}</div>
            </div>
            <div class="gallery-doc-action" title="Download">
              ${Icons.download('', 18)}
            </div>
          `;

          card.addEventListener('click', (e) => {
            const url = URL.createObjectURL(media.blob);
            if (e.target.closest('.gallery-doc-action')) {
              const a = document.createElement('a');
              a.href = url;
              a.download = media.filename || 'document';
              a.click();
            } else {
              window.open(url, '_blank');
            }
          });

          docsList.appendChild(card);
        });

        section.appendChild(docsList);
      }

      // C. Render Links List
      if (groupData.links.length > 0) {
        const linksList = document.createElement('div');
        linksList.className = 'gallery-links-list';

        groupData.links.forEach(({ url, domain, msg }) => {
          const card = document.createElement('div');
          card.className = 'gallery-link-card';
          const dateStr = new Date(msg.timestamp || Date.now()).toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
          });

          card.innerHTML = `
            <div class="gallery-link-icon">
              ${Icons.linkIcon('', 20)}
            </div>
            <div class="gallery-link-info">
              <div class="gallery-link-url" title="${url}">${url}</div>
              <div class="gallery-link-domain">${domain} • ${dateStr}</div>
            </div>
            <div class="gallery-link-action" title="Open link">
              ${Icons.externalLink('', 16)}
            </div>
          `;

          card.addEventListener('click', () => {
            window.open(url, '_blank', 'noopener,noreferrer');
          });

          linksList.appendChild(card);
        });

        section.appendChild(linksList);
      }

      gridContainer.appendChild(section);
    }
  }
}
