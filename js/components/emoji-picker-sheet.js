// Emoji Picker Bottom Sheet — full emoji grid with categories and search
// Uses DrawerResizer for drag-to-resize behavior (< 20% close, > 80% fullscreen)

import { DrawerResizer } from '../utils/drawer-resizer.js';
import { Icons } from '../icons.js';

const _supportedCache = new Map();
let _canvas = null;
let _ctx = null;
let _tofuData = null;

/**
 * Validates whether an emoji glyph renders properly on the user's platform/browser
 * (filters out missing Unicode glyphs, tofu boxes, or broken ZWJ sequences).
 */
export function isEmojiSupported(emoji) {
  if (!emoji) return false;
  if (_supportedCache.has(emoji)) return _supportedCache.get(emoji);
  if (typeof document === 'undefined') return true;

  try {
    if (!_canvas) {
      _canvas = document.createElement('canvas');
      _canvas.width = 16;
      _canvas.height = 16;
      _ctx = _canvas.getContext('2d', { willReadFrequently: true });
      if (!_ctx) return true;
      _ctx.textBaseline = 'top';
      _ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

      // Render reserved character to get platform's missing-glyph/tofu pixel pattern
      _ctx.clearRect(0, 0, 16, 16);
      _ctx.fillText('\u{1FFFF}', 0, 0);
      _tofuData = _ctx.getImageData(0, 0, 16, 16).data;
    }

    _ctx.clearRect(0, 0, 16, 16);
    _ctx.fillText(emoji, 0, 0);
    const data = _ctx.getImageData(0, 0, 16, 16).data;

    let hasPixels = false;
    let isTofu = true;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) hasPixels = true;
      if (
        data[i] !== _tofuData[i] ||
        data[i + 1] !== _tofuData[i + 1] ||
        data[i + 2] !== _tofuData[i + 2] ||
        data[i + 3] !== _tofuData[i + 3]
      ) {
        isTofu = false;
      }
    }

    let supported = hasPixels && !isTofu;

    // Check broken ZWJ sequence (renders as 2 separate glyphs side by side)
    if (supported && emoji.includes('\u200D')) {
      const fullWidth = _ctx.measureText(emoji).width;
      const firstPart = emoji.split('\u200D')[0];
      const partWidth = _ctx.measureText(firstPart).width;
      if (fullWidth > partWidth * 1.55) {
        supported = false;
      }
    }

    _supportedCache.set(emoji, supported);
    return supported;
  } catch (err) {
    return true;
  }
}

// ── Recent Emoji localStorage helpers ─────────────────────────────────────────
const RECENT_KEY = 'wa_emoji_recent';
const MAX_RECENT = 24;

function getRecentEmojis() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentEmoji(emoji) {
  let recents = getRecentEmojis().filter(e => e !== emoji);
  recents.unshift(emoji);
  if (recents.length > MAX_RECENT) recents = recents.slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recents)); } catch { /* ignore */ }
}

// ── Emoji data ────────────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖']
  },
  {
    name: 'People',
    emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦵', '🦶', '👂', '👃', '🧠', '👀', '👁', '👅', '👄', '💋', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '👩', '🧓', '👴', '👵', '👮', '🕵️', '💂', '👷', '🤴', '👸', '👳', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟']
  },
  {
    name: 'Nature',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🦆', '🐦', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🌸', '🌺', '🌻', '🌹', '🌷', '🌱', '🌲', '🌳', '🌴', '🎋', '🎍', '🍀', '🌿', '🍃', '🍂', '🍁', '🌾', '🌵', '🎄']
  },
  {
    name: 'Food',
    emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥮', '🍢', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥤', '☕', '🍵', '🧉', '🍺', '🍻', '🥂', '🍷', '🍸', '🍹', '🍾']
  },
  {
    name: 'Travel',
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🏍', '🛵', '🚲', '🛴', '🛹', '🚏', '🛣', '🛤', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '⛵', '🚤', '🛳', '⛴', '🚢', '✈️', '🛩', '🛫', '🛬', '💺', '🚁', '🚠', '🚡', '🚀', '🛸', '🛶', '🗺', '🧳', '🌋', '🏔', '⛰', '🏕', '🏖', '🏗', '🏘', '🏙', '🏚', '🏛', '🏟', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🗼', '🗽', '⛪', '🕌', '🕍', '⛩', '🕋', '⛲', '⛺', '🌁', '🌃', '🌄', '🌅', '🌆', '🌇', '🌉', '🗾', '🌌', '🌠', '🎆', '🎇']
  },
  {
    name: 'Activities',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🏐', '🥏', '🎾', '🏸', '🏒', '🏑', '🥍', '🏓', '🥊', '🥋', '🎽', '⛸', '🛷', '🎿', '🏂', '🏋️', '🤼', '🤸', '⛹️', '🤾', '🏌️', '🏄', '🏊', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🎗', '🎫', '🎟', '🎪', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🧩']
  },
  {
    name: 'Objects',
    emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🕹', '🗜', '💾', '💿', '📀', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒', '🛠', '⛏', '🔩', '⚙️', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '🛋', '🛏', '🚪', '🧸', '🖼', '🎁', '🎀', '🎊', '🎉', '🎈']
  },
  {
    name: 'Symbols',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️']
  }
];

// Category tab icon symbols (matches EMOJI_CATEGORIES order, plus '🕐' for Recent at index 0)
const CAT_SYMBOLS_BASE = ['😀', '👋', '🌿', '🍔', '✈️', '⚽', '💡', '❤️'];

export class EmojiPickerSheet {
  constructor({ onSelect } = {}) {
    this.onSelect = onSelect || (() => { });
    this.overlayEl = null;
    this.sheetEl = null;
    this.handleEl = null;
    this.fsHeaderEl = null;
    this.resizer = null;
    this._built = false;
    // DOM refs filled during build
    this._tabsEl = null;
    this._gridEl = null;
    this._recentTabBtn = null;
    this._recentSection = null;
    this._recentCatGrid = null;
    this._scrollObserver = null;
    this._tabButtons = [];      // ordered array of tab <button> elements (recent first if shown)
    this._categoryNames = [];   // ordered category names matching _tabButtons
  }

  // ── Build ────────────────────────────────────────────────────────────────

  _ensureBuilt() {
    if (this._built) return;
    this._built = true;

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'emoji-picker-overlay wa-sheet-overlay';
    this.overlayEl.style.display = 'none';

    this.sheetEl = document.createElement('div');
    this.sheetEl.className = 'emoji-picker-sheet wa-bottom-sheet';
    this.sheetEl.style.display = 'none';

    // Handle area (centered dash + title)
    this.handleEl = document.createElement('div');
    this.handleEl.className = 'emoji-picker-handle sheet-handle-area';
    this.handleEl.innerHTML = `
      <div class="sheet-dash"></div>
      <div class="emoji-picker-title">Pick reaction</div>
    `;
    this.sheetEl.appendChild(this.handleEl);

    // Fullscreen header (shown above 80%)
    this.fsHeaderEl = document.createElement('div');
    this.fsHeaderEl.className = 'emoji-picker-fs-header sheet-fullscreen-header';
    this.fsHeaderEl.style.display = 'none';
    this.fsHeaderEl.innerHTML = `
      <button type="button" class="app-bar-icon-btn fs-back-btn" aria-label="Back">${Icons.arrowBack('', 24)}</button>
      <span class="fs-header-title">React with emoji</span>
    `;
    this.fsHeaderEl.querySelector('.fs-back-btn').addEventListener('click', () => this.close());
    this.sheetEl.appendChild(this.fsHeaderEl);

    // Header with search
    const header = document.createElement('div');
    header.className = 'emoji-picker-header';
    header.innerHTML = `
      <input type="search" class="emoji-search" placeholder="Search emoji…" autocomplete="off" />
    `;
    this.sheetEl.appendChild(header);

    // Body: category tabs + grid
    const body = document.createElement('div');
    body.className = 'emoji-picker-body';

    // Category tabs container
    const tabs = document.createElement('div');
    tabs.className = 'emoji-category-tabs';
    this._tabsEl = tabs;

    // Emoji grid container (scrollable)
    const grid = document.createElement('div');
    grid.className = 'emoji-grid';
    this._gridEl = grid;

    // Build tabs and grid sections (recent + main categories)
    this._buildTabsAndGrid(tabs, grid);

    body.appendChild(tabs);
    body.appendChild(grid);
    this.sheetEl.appendChild(body);

    // Search functionality
    const searchInput = header.querySelector('.emoji-search');
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      this._filterEmojis(q);
    });

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
      overlayId: 'emoji-picker-sheet',
      defaultHeightVh: 60,
      minVh: 20,
      maxVh: 80,
      onClose: () => {
        this.overlayEl.style.display = 'none';
      }
    });
  }

  /**
   * Build (or rebuild) the tab buttons + grid sections.
   * Called once from _ensureBuilt() and again from _refreshRecent() if needed.
   */
  _buildTabsAndGrid(tabs, grid) {
    // Clear previous
    tabs.innerHTML = '';
    grid.innerHTML = '';
    this._tabButtons = [];
    this._categoryNames = [];
    this._recentTabBtn = null;
    this._recentSection = null;
    this._recentCatGrid = null;

    // ── Recent section (always rendered; shown/hidden dynamically) ──────────
    const recentTabBtn = document.createElement('button');
    recentTabBtn.type = 'button';
    recentTabBtn.className = 'emoji-cat-tab emoji-cat-tab-recent';
    recentTabBtn.textContent = '🕐';
    recentTabBtn.title = 'Recently used';
    recentTabBtn.addEventListener('click', () => {
      this._setActiveTab(0);
      this._scrollToCategory('__recent__');
    });
    tabs.appendChild(recentTabBtn);
    this._recentTabBtn = recentTabBtn;
    this._tabButtons.push(recentTabBtn);
    this._categoryNames.push('__recent__');

    // Recent grid section
    const recentSection = document.createElement('div');
    recentSection.className = 'emoji-category-section emoji-recent-section';
    recentSection.dataset.category = '__recent__';

    const recentTitle = document.createElement('div');
    recentTitle.className = 'emoji-category-title';
    recentTitle.textContent = 'Recently used';
    recentTitle.dataset.category = '__recent__';
    recentSection.appendChild(recentTitle);

    const recentCatGrid = document.createElement('div');
    recentCatGrid.className = 'emoji-category-grid';
    recentSection.appendChild(recentCatGrid);

    grid.appendChild(recentSection);
    this._recentSection = recentSection;
    this._recentCatGrid = recentCatGrid;

    // ── Main categories ─────────────────────────────────────────────────────
    EMOJI_CATEGORIES.forEach((cat, i) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'emoji-cat-tab';
      tab.textContent = CAT_SYMBOLS_BASE[i] || cat.name[0];
      tab.title = cat.name;
      const tabIndex = this._tabButtons.length; // index in _tabButtons
      tab.addEventListener('click', () => {
        this._setActiveTab(tabIndex);
        this._scrollToCategory(cat.name);
      });
      tabs.appendChild(tab);
      this._tabButtons.push(tab);
      this._categoryNames.push(cat.name);

      // Grid section wrapper
      const section = document.createElement('div');
      section.className = 'emoji-category-section';
      section.dataset.category = cat.name;

      const title = document.createElement('div');
      title.className = 'emoji-category-title';
      title.textContent = cat.name;
      title.dataset.category = cat.name;
      section.appendChild(title);

      const catGrid = document.createElement('div');
      catGrid.className = 'emoji-category-grid';
      cat.emojis.forEach((emoji) => {
        if (!isEmojiSupported(emoji)) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.setAttribute('aria-label', emoji);
        btn.addEventListener('click', () => {
          addRecentEmoji(emoji);
          if (this.onSelect) this.onSelect(emoji);
          this.close();
        });
        catGrid.appendChild(btn);
      });
      section.appendChild(catGrid);
      grid.appendChild(section);
    });

    // Initial state: update recent section and set active tab
    this._applyRecentEmojis();
    this._setActiveTab(0);

    // Setup IntersectionObserver for scroll sync (after DOM is in place)
    requestAnimationFrame(() => this._setupScrollSync());
  }

  // ── Recent emojis ────────────────────────────────────────────────────────

  /** Populate recent grid and show/hide the recent section based on localStorage */
  _applyRecentEmojis() {
    const recents = getRecentEmojis();
    const hasRecents = recents.length > 0;

    // Show/hide
    if (this._recentSection) {
      this._recentSection.style.display = hasRecents ? '' : 'none';
    }
    if (this._recentTabBtn) {
      this._recentTabBtn.style.display = hasRecents ? '' : 'none';
    }

    // Rebuild recent grid buttons
    if (this._recentCatGrid) {
      this._recentCatGrid.innerHTML = '';
      recents.forEach((emoji) => {
        if (!isEmojiSupported(emoji)) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.setAttribute('aria-label', emoji);
        btn.addEventListener('click', () => {
          addRecentEmoji(emoji);
          if (this.onSelect) this.onSelect(emoji);
          this.close();
        });
        this._recentCatGrid.appendChild(btn);
      });
    }

    // If we had the recent tab selected but now there are none, switch to first main cat
    if (!hasRecents && this._tabButtons.length > 1) {
      this._setActiveTab(1); // first main category
    }
  }

  // ── Tab active state ──────────────────────────────────────────────────────

  _setActiveTab(index) {
    this._tabButtons.forEach((t, i) => t.classList.toggle('active', i === index));
  }

  // ── Scroll sync ──────────────────────────────────────────────────────────

  _setupScrollSync() {
    const grid = this._gridEl;
    if (!grid) return;

    if (this._scrollListener) {
      grid.removeEventListener('scroll', this._scrollListener);
      this._scrollListener = null;
    }

    let rafId = null;
    this._scrollListener = () => {
      if (this._isClickScrolling) return;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        this._updateActiveTabFromScroll();
      });
    };

    grid.addEventListener('scroll', this._scrollListener, { passive: true });
  }

  _updateActiveTabFromScroll() {
    const grid = this._gridEl;
    if (!grid) return;

    // Check if at the very top (within 10px): select first visible category
    if (grid.scrollTop <= 10) {
      for (let i = 0; i < this._categoryNames.length; i++) {
        const catName = this._categoryNames[i];
        const sec = grid.querySelector(`.emoji-category-section[data-category="${catName}"]`);
        if (sec && sec.style.display !== 'none' && sec.offsetHeight > 0) {
          this._setActiveTab(i);
          return;
        }
      }
    }

    // Check if at or near bottom (within 25px): select last visible category
    if (grid.scrollHeight - grid.scrollTop - grid.clientHeight <= 25) {
      for (let i = this._categoryNames.length - 1; i >= 0; i--) {
        const catName = this._categoryNames[i];
        const sec = grid.querySelector(`.emoji-category-section[data-category="${catName}"]`);
        if (sec && sec.style.display !== 'none' && sec.offsetHeight > 0) {
          this._setActiveTab(i);
          return;
        }
      }
    }

    const gridRect = grid.getBoundingClientRect();
    const probeY = gridRect.top + 36;

    for (let i = 0; i < this._categoryNames.length; i++) {
      const catName = this._categoryNames[i];
      const sec = grid.querySelector(`.emoji-category-section[data-category="${catName}"]`);
      if (!sec || sec.style.display === 'none' || sec.offsetHeight === 0) continue;

      const rect = sec.getBoundingClientRect();
      if (rect.top <= probeY && rect.bottom > probeY) {
        this._setActiveTab(i);
        const tabBtn = this._tabButtons[i];
        if (tabBtn && this._tabsEl) {
          tabBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }
    }
  }

  // ── Scroll to category ────────────────────────────────────────────────────

  _scrollToCategory(categoryName) {
    const grid = this._gridEl;
    if (!grid) return;
    const secEl = grid.querySelector(`.emoji-category-section[data-category="${categoryName}"]`);
    if (secEl) {
      this._isClickScrolling = true;
      secEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        this._isClickScrolling = false;
      }, 450);
    }
  }

  // ── Search / filter ───────────────────────────────────────────────────────

  _filterEmojis(query) {
    const grid = this._gridEl;
    if (!grid) return;

    const catSections = grid.querySelectorAll('.emoji-category-section');

    if (!query) {
      // Restore all sections; re-apply recent visibility
      catSections.forEach(sec => {
        const isRecent = sec.dataset.category === '__recent__';
        const recents = getRecentEmojis();
        if (isRecent) {
          sec.style.display = recents.length > 0 ? '' : 'none';
        } else {
          sec.style.display = '';
        }
        sec.querySelectorAll('.emoji-btn').forEach(btn => btn.style.display = '');
      });
      // Show all tabs
      this._tabButtons.forEach(t => {
        const isRecent = t === this._recentTabBtn;
        t.style.display = isRecent ? (getRecentEmojis().length > 0 ? '' : 'none') : '';
      });
      return;
    }

    // Hide recent section during search
    if (this._recentSection) this._recentSection.style.display = 'none';
    if (this._recentTabBtn) this._recentTabBtn.style.display = 'none';

    catSections.forEach((sec, _) => {
      if (sec.dataset.category === '__recent__') return;
      let anyVisible = false;
      sec.querySelectorAll('.emoji-btn').forEach(btn => {
        const show = btn.textContent.includes(query) || (btn.getAttribute('aria-label') || '').toLowerCase().includes(query);
        btn.style.display = show ? '' : 'none';
        if (show) anyVisible = true;
      });
      sec.style.display = anyVisible ? '' : 'none';
    });
  }

  // ── Open / Close / Destroy ────────────────────────────────────────────────

  open(onSelect = null) {
    if (onSelect) this.onSelect = onSelect;
    this._ensureBuilt();
    // Refresh recent emojis in case user picked some since last open
    this._applyRecentEmojis();

    // Reset search field and scroll position
    const searchInput = this.sheetEl?.querySelector('.emoji-search');
    if (searchInput) {
      searchInput.value = '';
      this._filterEmojis('');
    }
    if (this._gridEl) {
      this._gridEl.scrollTop = 0;
    }

    this.overlayEl.style.display = 'block';
    this.resizer.open(60);
  }

  close() {
    if (this.resizer) this.resizer.close();
  }

  destroy() {
    if (this._scrollListener && this._gridEl) {
      this._gridEl.removeEventListener('scroll', this._scrollListener);
      this._scrollListener = null;
    }
    if (this.resizer) this.close();
    if (this.sheetEl && this.sheetEl.parentNode) this.sheetEl.parentNode.removeChild(this.sheetEl);
    if (this.overlayEl && this.overlayEl.parentNode) this.overlayEl.parentNode.removeChild(this.overlayEl);
  }
}
