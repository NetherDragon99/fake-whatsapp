// Screen 3: Media Gallery Screen with Multi-Toggle Filters & Windowed Virtual Batch Scroller
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { mediaLightbox } from '../components/lightbox.js';
import { Toast } from '../components/toast.js';
import { showConfirm } from '../components/custom-dialog.js';

export class GalleryView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.scrollerEl = null;
    this.gridContainer = null;

    // By default, Photos and Videos filters are selected simultaneously
    this.activeTypes = new Set(['image', 'video']);
    this.filterChatId = 'all';
    this.chat = null;
    this.allMediaItems = [];
    this.allMessages = [];
    this.filteredItems = [];

    // Windowed Virtual Batch Scroller Configuration
    this.CHUNK_SIZE = 36; // Multiples of 3 and 4 for 3-col mobile / 4-col desktop grids
    this.MAX_DOM_ITEMS = 108; // 3 chunks in memory
    this.visibleStartIndex = 0;
    this.visibleEndIndex = 0;
    this.isLoadingMore = false;
    this.lastScrollTop = 0;
    this.onScrollBound = this.handleScroll.bind(this);
    this.selectedMediaIds = new Set();
    this.isSelectionMode = false;
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
        <!-- Normal App Bar -->
        <header class="wa-app-bar" id="gallery-default-header">
          <button class="app-bar-icon-btn" id="btn-gallery-back" aria-label="Go back">${Icons.arrowBack('', 24)}</button>
          <div class="app-title">${titleText}</div>
          <div class="app-bar-actions">
            <button class="app-bar-icon-btn" id="btn-gallery-select-mode" title="Select files">${Icons.edit('', 20)}</button>
          </div>
        </header>

        <!-- Multi-Selection Bar -->
        <header class="wa-app-bar selection-bar" id="gallery-selection-bar" style="display:none;">
          <button class="app-bar-icon-btn" id="btn-cancel-gallery-select" aria-label="Cancel selection">${Icons.arrowBack('', 24)}</button>
          <div class="selection-count-title" id="gallery-select-count">1 selected</div>
          <div class="app-bar-actions">
            <button type="button" class="app-bar-text-btn" id="btn-gallery-select-all">Select All</button>
            <button type="button" class="app-bar-icon-btn" id="btn-gallery-download-selected" title="Download selected">${Icons.download('', 20)}</button>
            <button type="button" class="app-bar-icon-btn danger-icon" id="btn-gallery-delete-selected" title="Delete selected">${Icons.trash('', 22)}</button>
          </div>
        </header>

        <!-- Gallery Multi-Toggle Filter Controls -->
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

    this.scrollerEl = this.container.querySelector('#gallery-grid-container');
    this.gridContainer = this.scrollerEl;

    // Back button navigation
    this.container.querySelector('#btn-gallery-back').addEventListener('click', () => {
      this.router.back();
    });

    // Selection Mode Buttons
    this.container.querySelector('#btn-gallery-select-mode')?.addEventListener('click', () => {
      this.enterSelectionMode();
    });
    this.container.querySelector('#btn-cancel-gallery-select')?.addEventListener('click', () => {
      this.exitSelectionMode();
    });
    this.container.querySelector('#btn-gallery-select-all')?.addEventListener('click', () => {
      this.selectAllMedia();
    });
    this.container.querySelector('#btn-gallery-download-selected')?.addEventListener('click', () => {
      this.downloadSelectedMedia();
    });
    this.container.querySelector('#btn-gallery-delete-selected')?.addEventListener('click', () => {
      this.deleteSelectedMedia();
    });

    // Multi-Toggle Filter Chips
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
    // Independent IndexedDB query: loads directly from media and messages stores
    if (this.filterChatId && this.filterChatId !== 'all') {
      this.allMediaItems = await db.getMediaByChat(this.filterChatId);
      this.allMessages = await db.getMessages(this.filterChatId);
    } else {
      this.allMediaItems = await db.getAllMedia();
      const allChats = await db.getChats();
      const msgs = [];
      for (const c of allChats) {
        const chatMsgs = await db.getMessages(c.id);
        msgs.push(...chatMsgs);
      }
      this.allMessages = msgs;
    }
  }

  renderGrid() {
    if (!this.gridContainer) return;

    // Revoke any existing object URLs in DOM before re-rendering
    this.revokeActiveUrls();
    this.gridContainer.innerHTML = '';
    this.gridContainer.removeEventListener('scroll', this.onScrollBound);

    // If all filters are deactivated, show notice
    if (this.activeTypes.size === 0) {
      this.gridContainer.innerHTML = `
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

      const parentMsg = msgMap.get(m.id) || {};
      const itemTimestamp = m.timestamp || parentMsg.timestamp || Date.now();

      if (sticker && this.activeTypes.has('sticker')) {
        visualItems.push({ type: 'sticker', media: m, msg: parentMsg, timestamp: itemTimestamp });
      } else if (isImg && this.activeTypes.has('image')) {
        visualItems.push({ type: 'image', media: m, msg: parentMsg, timestamp: itemTimestamp });
      } else if (isVid && this.activeTypes.has('video')) {
        visualItems.push({ type: 'video', media: m, msg: parentMsg, timestamp: itemTimestamp });
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
          const itemTimestamp = m.timestamp || parentMsg.timestamp || Date.now();
          docItems.push({ type: 'document', media: m, msg: parentMsg, timestamp: itemTimestamp });
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

    // Combine all matching items into a single chronologically sorted array (newest first)
    this.filteredItems = [...visualItems, ...docItems, ...linkItems];
    this.filteredItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (this.filteredItems.length === 0) {
      this.gridContainer.innerHTML = `
        <div class="empty-gallery-state">
          <div class="empty-icon-circle">${Icons.gallery('', 34)}</div>
          <h3>No media items</h3>
          <p>No items match the active filters.</p>
        </div>
      `;
      return;
    }

    // Initialize Windowed Virtual Batch Scroller
    this.visibleStartIndex = 0;
    this.visibleEndIndex = Math.min(this.filteredItems.length, this.CHUNK_SIZE);
    this.lastScrollTop = 0;
    this.isLoadingMore = false;

    this.renderBatch(this.visibleStartIndex, this.visibleEndIndex, 'append');

    // Attach 40% Boundary Windowed Virtual Scroll Listener
    this.scrollerEl.addEventListener('scroll', this.onScrollBound, { passive: true });
  }

  handleScroll() {
    if (this.isLoadingMore || !this.scrollerEl || !this.gridContainer) return;

    const scrollHeight = this.scrollerEl.scrollHeight;
    const scrollTop = this.scrollerEl.scrollTop;
    const clientHeight = this.scrollerEl.clientHeight;
    const scrollBottomDist = scrollHeight - scrollTop - clientHeight;

    const scrollDir = scrollTop >= this.lastScrollTop ? 'down' : 'up';
    this.lastScrollTop = scrollTop;

    // 40% Threshold: downward scroll into bottom 40%
    if (scrollDir === 'down' && scrollBottomDist <= scrollHeight * 0.40 && this.visibleEndIndex < this.filteredItems.length) {
      this.loadNextBatch();
    }

    // 40% Threshold: upward scroll into top 40%
    if (scrollDir === 'up' && scrollTop <= scrollHeight * 0.40 && this.visibleStartIndex > 0) {
      this.loadPrevBatch();
    }
  }

  loadNextBatch() {
    if (this.isLoadingMore || this.visibleEndIndex >= this.filteredItems.length) return;
    this.isLoadingMore = true;

    const newStart = this.visibleEndIndex;
    const newEnd = Math.min(this.filteredItems.length, this.visibleEndIndex + this.CHUNK_SIZE);

    // Append batch to bottom
    this.renderBatch(newStart, newEnd, 'append');
    this.visibleEndIndex = newEnd;

    // Prune excess items from top if exceeding MAX_DOM_ITEMS
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_ITEMS) {
      const pruneCount = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_ITEMS;
      const prevScrollHeight = this.scrollerEl.scrollHeight;
      const prevScrollTop = this.scrollerEl.scrollTop;

      let pruned = 0;
      while (pruned < pruneCount) {
        const firstNode = this.gridContainer.querySelector('.gallery-item-node');
        if (!firstNode) break;

        // Revoke Object URL if applicable
        if (firstNode.dataset.objectUrl) {
          try { URL.revokeObjectURL(firstNode.dataset.objectUrl); } catch (e) {}
        }

        const parent = firstNode.parentElement;
        const monthSec = firstNode.closest('.gallery-month-section');
        firstNode.remove();
        pruned++;

        if (parent && !parent.firstElementChild && !parent.classList.contains('gallery-month-section')) {
          parent.remove();
        }
        if (monthSec && !monthSec.querySelector('.gallery-item-node')) {
          monthSec.remove();
        }
      }
      this.visibleStartIndex += pruned;

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

    // Prepend batch to top
    this.renderBatch(newStart, newEnd, 'prepend');
    this.visibleStartIndex = newStart;

    // Mathematical scroll lock: compensate for prepended elements above viewport
    const newScrollHeight = this.scrollerEl.scrollHeight;
    const heightDelta = newScrollHeight - prevScrollHeight;
    this.scrollerEl.scrollTop = prevScrollTop + heightDelta;

    // Prune excess items from bottom if exceeding MAX_DOM_ITEMS (zero effect on scrollTop)
    if (this.visibleEndIndex - this.visibleStartIndex > this.MAX_DOM_ITEMS) {
      const pruneCount = (this.visibleEndIndex - this.visibleStartIndex) - this.MAX_DOM_ITEMS;
      let pruned = 0;
      while (pruned < pruneCount) {
        const allNodes = this.gridContainer.querySelectorAll('.gallery-item-node');
        if (allNodes.length === 0) break;
        const lastNode = allNodes[allNodes.length - 1];

        if (lastNode.dataset.objectUrl) {
          try { URL.revokeObjectURL(lastNode.dataset.objectUrl); } catch (e) {}
        }

        const parent = lastNode.parentElement;
        const monthSec = lastNode.closest('.gallery-month-section');
        lastNode.remove();
        pruned++;

        if (parent && !parent.firstElementChild && !parent.classList.contains('gallery-month-section')) {
          parent.remove();
        }
        if (monthSec && !monthSec.querySelector('.gallery-item-node')) {
          monthSec.remove();
        }
      }
      this.visibleEndIndex -= pruned;
    }

    this.isLoadingMore = false;
  }

  renderBatch(start, end, mode = 'append') {
    if (start >= end) return;

    if (mode === 'append') {
      for (let i = start; i < end; i++) {
        const item = this.filteredItems[i];
        if (!item) continue;
        const date = new Date(item.timestamp);
        const monthKey = date.toLocaleDateString([], { month: 'long', year: 'numeric' });

        // Check if the last month section matches this monthKey
        let section = this.gridContainer.lastElementChild;
        if (!section || section.dataset.monthKey !== monthKey) {
          section = document.createElement('div');
          section.className = 'gallery-month-section';
          section.dataset.monthKey = monthKey;

          const title = document.createElement('div');
          title.className = 'gallery-month-title';
          title.textContent = monthKey;
          section.appendChild(title);

          this.gridContainer.appendChild(section);
        }

        this.appendItemToSection(item, section);
      }
    } else if (mode === 'prepend') {
      // Build temporary month sections for the prepended batch
      const tempContainer = document.createElement('div');
      for (let i = start; i < end; i++) {
        const item = this.filteredItems[i];
        if (!item) continue;
        const date = new Date(item.timestamp);
        const monthKey = date.toLocaleDateString([], { month: 'long', year: 'numeric' });

        let section = tempContainer.lastElementChild;
        if (!section || section.dataset.monthKey !== monthKey) {
          section = document.createElement('div');
          section.className = 'gallery-month-section';
          section.dataset.monthKey = monthKey;

          const title = document.createElement('div');
          title.className = 'gallery-month-title';
          title.textContent = monthKey;
          section.appendChild(title);

          tempContainer.appendChild(section);
        }

        this.appendItemToSection(item, section);
      }

      // Check if the last section of the prepended batch matches the first existing section
      const firstExistingSection = this.gridContainer.firstElementChild;
      const lastPrependedSection = tempContainer.lastElementChild;

      if (firstExistingSection && lastPrependedSection && firstExistingSection.dataset.monthKey === lastPrependedSection.dataset.monthKey) {
        // Merge last prepended section into first existing section
        this.mergeSections(lastPrependedSection, firstExistingSection);
        lastPrependedSection.remove();
      }

      // Prepend any remaining prepended sections before the first existing section
      while (tempContainer.lastElementChild) {
        this.gridContainer.insertBefore(tempContainer.lastElementChild, this.gridContainer.firstElementChild);
      }
    }
  }

  appendItemToSection(item, section) {
    if (item.type === 'image' || item.type === 'video' || item.type === 'sticker') {
      let grid = section.querySelector('.gallery-tiles-grid');
      if (!grid) {
        grid = document.createElement('div');
        grid.className = 'gallery-tiles-grid';
        section.appendChild(grid);
      }
      const tile = this.createVisualTile(item);
      grid.appendChild(tile);
    } else if (item.type === 'document') {
      let docsList = section.querySelector('.gallery-docs-list');
      if (!docsList) {
        docsList = document.createElement('div');
        docsList.className = 'gallery-docs-list';
        section.appendChild(docsList);
      }
      const docCard = this.createDocCard(item);
      docsList.appendChild(docCard);
    } else if (item.type === 'link') {
      let linksList = section.querySelector('.gallery-links-list');
      if (!linksList) {
        linksList = document.createElement('div');
        linksList.className = 'gallery-links-list';
        section.appendChild(linksList);
      }
      const linkCard = this.createLinkCard(item);
      linksList.appendChild(linkCard);
    }
  }

  mergeSections(fromSection, intoSection) {
    // Tiles Grid
    const fromGrid = fromSection.querySelector('.gallery-tiles-grid');
    if (fromGrid) {
      let intoGrid = intoSection.querySelector('.gallery-tiles-grid');
      if (!intoGrid) {
        intoGrid = document.createElement('div');
        intoGrid.className = 'gallery-tiles-grid';
        intoSection.insertBefore(intoGrid, intoSection.children[1] || null);
      }
      while (fromGrid.lastElementChild) {
        intoGrid.insertBefore(fromGrid.lastElementChild, intoGrid.firstElementChild);
      }
    }

    // Docs List
    const fromDocs = fromSection.querySelector('.gallery-docs-list');
    if (fromDocs) {
      let intoDocs = intoSection.querySelector('.gallery-docs-list');
      if (!intoDocs) {
        intoDocs = document.createElement('div');
        intoDocs.className = 'gallery-docs-list';
        intoSection.appendChild(intoDocs);
      }
      while (fromDocs.lastElementChild) {
        intoDocs.insertBefore(fromDocs.lastElementChild, intoDocs.firstElementChild);
      }
    }

    // Links List
    const fromLinks = fromSection.querySelector('.gallery-links-list');
    if (fromLinks) {
      let intoLinks = intoSection.querySelector('.gallery-links-list');
      if (!intoLinks) {
        intoLinks = document.createElement('div');
        intoLinks.className = 'gallery-links-list';
        intoSection.appendChild(intoLinks);
      }
      while (fromLinks.lastElementChild) {
        intoLinks.insertBefore(fromLinks.lastElementChild, intoLinks.firstElementChild);
      }
    }
  }

  createVisualTile(item) {
    const tile = document.createElement('div');
    tile.className = `gallery-tile gallery-item-node ${item.media?.id && this.selectedMediaIds.has(item.media.id) ? 'is-selected' : ''}`;
    if (item.media?.id) {
      tile.dataset.mediaId = item.media.id;
    }
    const url = URL.createObjectURL(item.media.blob);
    tile.dataset.objectUrl = url;

    const badgeHtml = `<div class="gallery-select-badge ${item.media?.id && this.selectedMediaIds.has(item.media.id) ? 'checked' : ''}">${Icons.check('', 14)}</div>`;

    if (item.type === 'video') {
      tile.innerHTML = `
        <video src="${url}" preload="metadata" class="tile-thumb"></video>
        <div class="tile-video-badge">${Icons.play('', 14)}</div>
        ${badgeHtml}
      `;
    } else if (item.type === 'sticker') {
      tile.innerHTML = `
        <img src="${url}" alt="${item.media.filename}" loading="lazy" class="tile-thumb" style="object-fit:contain; background:transparent;" />
        ${badgeHtml}
      `;
    } else {
      tile.innerHTML = `
        <img src="${url}" alt="${item.media.filename}" loading="lazy" class="tile-thumb" />
        ${badgeHtml}
      `;
    }

    let pressTimer = null;
    tile.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pressTimer = setTimeout(() => {
        if (item.media?.id) {
          this.enterSelectionMode(item.media.id, tile);
        }
      }, 450);
    });
    tile.addEventListener('pointerup', () => clearTimeout(pressTimer));
    tile.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    tile.addEventListener('pointercancel', () => clearTimeout(pressTimer));

    tile.addEventListener('click', () => {
      if (this.isSelectionMode) {
        if (item.media?.id) {
          this.toggleItemSelection(item.media.id, tile);
        }
        return;
      }
      mediaLightbox.show(item.media, item.msg, (targetChatId, targetMsgId) => {
        this.router.navigate(`#/chat/${targetChatId}?msgId=${targetMsgId}`);
      });
    });

    return tile;
  }

  createDocCard(item) {
    const card = document.createElement('div');
    card.className = `gallery-doc-card gallery-item-node ${item.media?.id && this.selectedMediaIds.has(item.media.id) ? 'is-selected' : ''}`;
    if (item.media?.id) {
      card.dataset.mediaId = item.media.id;
    }
    const url = URL.createObjectURL(item.media.blob);
    card.dataset.objectUrl = url;

    const sizeStr = db.formatBytes(item.media.size || 0);
    const dateStr = new Date(item.timestamp).toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });
    const isPdf = item.media.mimeType === 'application/pdf' || item.media.type === 'pdf';
    const badgeHtml = `<div class="gallery-select-badge ${item.media?.id && this.selectedMediaIds.has(item.media.id) ? 'checked' : ''}">${Icons.check('', 14)}</div>`;

    card.innerHTML = `
      <div class="gallery-doc-icon">
        ${isPdf ? Icons.pdfIcon('', 24) : Icons.documentIcon('', 22)}
      </div>
      <div class="gallery-doc-info">
        <div class="gallery-doc-title" title="${item.media.filename}">${item.media.filename || 'Document'}</div>
        <div class="gallery-doc-sub">${sizeStr} • ${dateStr}</div>
      </div>
      <div class="gallery-doc-action" title="Download">
        ${Icons.download('', 18)}
      </div>
      ${badgeHtml}
    `;

    let pressTimer = null;
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pressTimer = setTimeout(() => {
        if (item.media?.id) {
          this.enterSelectionMode(item.media.id, card);
        }
      }, 450);
    });
    card.addEventListener('pointerup', () => clearTimeout(pressTimer));
    card.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    card.addEventListener('pointercancel', () => clearTimeout(pressTimer));

    card.addEventListener('click', (e) => {
      if (this.isSelectionMode) {
        if (item.media?.id) {
          this.toggleItemSelection(item.media.id, card);
        }
        return;
      }
      if (e.target.closest('.gallery-doc-action')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = item.media.filename || 'document';
        a.click();
      } else {
        window.open(url, '_blank');
      }
    });

    return card;
  }

  createLinkCard(item) {
    const card = document.createElement('div');
    card.className = 'gallery-link-card gallery-item-node';
    const dateStr = new Date(item.timestamp).toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });

    card.innerHTML = `
      <div class="gallery-link-icon">
        ${Icons.linkIcon('', 20)}
      </div>
      <div class="gallery-link-info">
        <div class="gallery-link-url" title="${item.url}">${item.url}</div>
        <div class="gallery-link-domain">${item.domain} • ${dateStr}</div>
      </div>
      <div class="gallery-link-action" title="Open link">
        ${Icons.externalLink('', 16)}
      </div>
    `;

    card.addEventListener('click', () => {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    });

    return card;
  }

  revokeActiveUrls() {
    if (!this.gridContainer) return;
    this.gridContainer.querySelectorAll('.gallery-item-node').forEach((node) => {
      if (node.dataset.objectUrl) {
        try { URL.revokeObjectURL(node.dataset.objectUrl); } catch (e) {}
      }
    });
  }

  // --- Gallery Multi-Selection Methods ---
  enterSelectionMode(initialMediaId = null, element = null) {
    this.isSelectionMode = true;
    this.selectedMediaIds.clear();
    if (initialMediaId) {
      this.selectedMediaIds.add(initialMediaId);
      if (element) {
        element.classList.add('is-selected');
        const badge = element.querySelector('.gallery-select-badge');
        if (badge) badge.classList.add('checked');
      }
    }
    if (window.router) {
      window.router.pushOverlay('gallery-selection', () => this.exitSelectionMode());
    }
    this.updateSelectionBar();
  }

  toggleItemSelection(mediaId, element = null) {
    if (!element) {
      element = this.container.querySelector(`[data-media-id="${mediaId}"]`);
    }
    const badge = element?.querySelector('.gallery-select-badge');

    if (this.selectedMediaIds.has(mediaId)) {
      this.selectedMediaIds.delete(mediaId);
      if (element) element.classList.remove('is-selected');
      if (badge) badge.classList.remove('checked');
    } else {
      this.selectedMediaIds.add(mediaId);
      if (element) element.classList.add('is-selected');
      if (badge) badge.classList.add('checked');
    }

    if (this.selectedMediaIds.size === 0) {
      this.exitSelectionMode();
    } else {
      this.updateSelectionBar();
    }
  }

  updateSelectionBar() {
    const defaultBar = this.container.querySelector('#gallery-default-bar');
    const selectBar = this.container.querySelector('#gallery-selection-bar');
    const countEl = this.container.querySelector('#gallery-select-count');
    const selectAllBtn = this.container.querySelector('#btn-gallery-select-all');

    if (defaultBar) defaultBar.style.display = 'none';
    if (selectBar) selectBar.style.display = 'flex';

    let totalBytes = 0;
    for (const id of this.selectedMediaIds) {
      const it = this.filteredItems.find((x) => x.media?.id === id);
      if (it?.media?.size) totalBytes += it.media.size;
    }

    if (countEl) {
      countEl.textContent = `${this.selectedMediaIds.size} selected (${db.formatBytes(totalBytes)})`;
    }

    const selectableCount = this.filteredItems.filter((x) => x.media?.id).length;
    if (selectAllBtn) {
      selectAllBtn.textContent = this.selectedMediaIds.size === selectableCount ? 'Deselect All' : 'Select All';
    }
  }

  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selectedMediaIds.clear();
    const defaultBar = this.container.querySelector('#gallery-default-bar');
    const selectBar = this.container.querySelector('#gallery-selection-bar');

    if (defaultBar) defaultBar.style.display = 'flex';
    if (selectBar) selectBar.style.display = 'none';

    this.container.querySelectorAll('.gallery-tile.is-selected, .gallery-doc-card.is-selected').forEach((el) => {
      el.classList.remove('is-selected');
      const badge = el.querySelector('.gallery-select-badge');
      if (badge) badge.classList.remove('checked');
    });

    if (window.router) {
      window.router.removeOverlay('gallery-selection');
    }
  }

  selectAllMedia() {
    const selectable = this.filteredItems.filter((x) => x.media?.id);
    if (this.selectedMediaIds.size === selectable.length) {
      this.exitSelectionMode();
      return;
    }
    for (const it of selectable) {
      this.selectedMediaIds.add(it.media.id);
    }
    this.container.querySelectorAll('.gallery-tile, .gallery-doc-card').forEach((el) => {
      el.classList.add('is-selected');
      const badge = el.querySelector('.gallery-select-badge');
      if (badge) badge.classList.add('checked');
    });
    this.updateSelectionBar();
  }

  downloadSelectedMedia() {
    if (this.selectedMediaIds.size === 0) return;
    let count = 0;
    for (const id of this.selectedMediaIds) {
      const it = this.filteredItems.find((x) => x.media?.id === id);
      if (it?.media?.blob) {
        const url = URL.createObjectURL(it.media.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = it.media.filename || `media_${id}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        count++;
      }
    }
    Toast.show(`Downloading ${count} files...`);
    this.exitSelectionMode();
  }

  async deleteSelectedMedia() {
    const count = this.selectedMediaIds.size;
    if (count === 0) return;

    const confirmed = await showConfirm({
      title: `Delete ${count} item${count > 1 ? 's' : ''}?`,
      message: 'Do you want to delete the selected media from your chats and storage?',
      confirmText: 'Delete for me',
      cancelText: 'Cancel',
      isDanger: true
    });

    if (confirmed) {
      const ids = Array.from(this.selectedMediaIds);
      await db.deleteMediaBatch(ids);
      Toast.show(`${count} item${count > 1 ? 's' : ''} deleted`);
      this.exitSelectionMode();
      await this.loadMediaData();
      this.renderGrid();
    }
  }

  cleanup() {
    if (this.scrollerEl && this.onScrollBound) {
      this.scrollerEl.removeEventListener('scroll', this.onScrollBound);
    }
    this.revokeActiveUrls();
  }
}
