// Settings Sub-Screen: Comprehensive Interactive Features & Unique Shortcuts Guide
import { Icons } from '../icons.js';
import { Toast } from '../components/toast.js';
import {
  FORMATTING_SHORTCUTS,
  escapeHtml,
  renderRichMessageHtml,
  toggleCheckboxInMarkup
} from '../utils/rich-text.js';

const APP_FEATURES_SECTIONS = [
  {
    id: 'nested-trees',
    title: 'Multi-Level Nested Messages (Tree)',
    keywords: 'nested tree parent child hierarchy branch sub-message drag drop',
    icon: Icons.treeBranch('', 20),
    bullets: [
      '<strong>Arbitrary Depth (A → B → C...):</strong> Select any message (even an already-nested one) and tap <b>Nest under...</b>, then tap its parent message.',
      '<strong>Quick Compose Child:</strong> Select a message and tap <b>Add nested message</b> to compose directly underneath it.',
      '<strong>Visual Tree Connectors & Sheet:</strong> Adjacent nested messages display connected tree lines &amp; arrows with continuous sibling branches and deep indentation. Tap <b>↳ Nested under</b> to jump to parent, or tap <b>N nested</b> badge to inspect, reorder with drag &amp; drop, or adjust depth levels (+/-).',
      '<strong>Independent &amp; Safe:</strong> Prevents self-nesting and cycles automatically, and never triggers an unwanted <i>Edited</i> tag.'
    ]
  },
  {
    id: 'message-lists',
    title: 'Numbered (1, 2, 3) & Bulleted (•) Message Lists',
    keywords: 'numbered bulleted list sort order sequence continue independent compose shapes arrow branch',
    icon: Icons.listNumbered('', 20),
    bullets: [
      '<strong>Standalone System:</strong> Select one or multiple messages and open <b>Numbered / Bulleted list...</b> to group them with simple <code>1, 2, 3...</code> numbers or <code>•</code> bullets — completely independent of nesting.',
      '<strong>Auto-Renumbering:</strong> Deleting or removing any item automatically renumbers all remaining items cleanly with zero gaps.',
      '<strong>Continue List:</strong> Choose <b>Continue list</b> on any message to keep sending new items directly into the same list.',
      '<strong>Freely Composable:</strong> Combine message lists with nested trees, replies, checklists, pins, link previews, and rich text without conflicts.'
    ]
  },
  {
    id: 'long-messages',
    title: 'Unlimited Messages & Progressive Collapse/Expand',
    keywords: 'long message show more full less expand collapse setting override',
    icon: Icons.expandAll('', 20),
    bullets: [
      '<strong>No Length Limit:</strong> Send and edit messages of any length without truncation.',
      '<strong>Progressive Controls:</strong> Long messages start around ~450 chars / 10 lines with <b>Show more</b> (+900 chars / +18 lines). <b>Show full message</b> appears only when more than one Show more tap remains; <b>Show less</b> folds back.',
      '<strong>Chat vs App Priority:</strong> Set app-wide default in <b>Settings → Chats</b>, or override per chat (Follow App / Always Expanded / Always Collapsed) inside <b>Contact Info → Long messages</b>.',
      '<strong>Quick Bulk Actions:</strong> Use <b>Expand all</b> / <b>Collapse all</b> in the chat 3-dot menu, or select specific long messages to Expand/Collapse them individually.'
    ]
  },
  {
    id: 'fullscreen-composer',
    title: 'Fullscreen WYSIWYG Composer & Link Previews',
    keywords: 'fullscreen composer toolbar formatting link preview edit youtube offline wysiwyg fold lists',
    icon: Icons.formatText('', 20),
    bullets: [
      '<strong>Live Formatting & Selection Scope:</strong> Shortcuts transform visually inside the editor. Selecting text formats only the selection; when caret is not selecting text, formatting toggles on the entire current line.',
      '<strong>3 List Shapes & Smart Numbering:</strong> Choose between Thick Bullet •, Arrow →, and Branch ↳ directly via typing shortcuts or toolbar popover. Sub-level numbered lists restart cleanly from 1 with guide lines.',
      '<strong>Collapsible Details:</strong> Insert <code>[fold:Title]...[/fold]</code> blocks to create interactive collapsible accordions inside bubbles.',
      '<strong>Smooth Fullscreen Transition:</strong> Tapping expand button or dragging handle opens fullscreen without closing on text taps; Undo/Redo/Clear stay on top while format toolbar docks seamlessly.'
    ]
  },
  {
    id: 'voice-and-tools',
    title: 'Voice Notes, Call Logs & Navigation Tools',
    keywords: 'voice recording pause resume duration waveform call empty parser scroll date jump',
    icon: Icons.mic('', 20),
    bullets: [
      '<strong>Accurate Voice Notes:</strong> Pausing stops the active timer and stitches resumed segments cleanly so sent duration and waveform never include pause gaps.',
      '<strong>WhatsApp Export Call Detection:</strong> Empty lines with timestamp and sender automatically resolve as Voice Calls (incoming/outgoing).',
      '<strong>Nearest-Date Jump & Reply Linking:</strong> Jump to any date from chat Search or menu (automatically lands on the closest day if exact date has no messages).'
    ]
  }
];

function getToolbarButtonPreview(item) {
  if (item.id === 'bold') return '<strong>B</strong>';
  if (item.id === 'italic') return '<em>I</em>';
  if (item.id === 'underline') return '<u>U</u>';
  if (item.id === 'strike') return '<del>S</del>';
  if (item.id === 'headers') return '<span class="fmt-txt-icon">H</span>';
  if (item.id === 'code-block') return '<span class="fmt-txt-icon">{ }</span>';
  if (item.id === 'sup-sub') return '<span class="fmt-txt-icon">x² / x₂</span>';
  if (item.id === 'lists-shapes') return '<span>• / → / ↳</span>';
  if (item.id === 'lists-numbered') return '<span>1. 2. 3.</span>';
  if (item.id === 'fold') return (Icons.collapseAll ? Icons.collapseAll('', 18) : '<span>Fold</span>');
  if (item.iconName && Icons[item.iconName]) {
    return Icons[item.iconName]('', 18);
  }
  return item.toolbarLabel || '';
}

export class GuideView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this._exampleTexts = new Map();
    this._activeTab = 'features';
  }

  async render(rootEl) {
    this.container = rootEl;
    this._exampleTexts.clear();

    rootEl.innerHTML = `
      <div class="screen-view guide-screen">
        <header class="wa-app-bar flat-app-bar guide-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-guide-back" aria-label="Back to settings">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">Features &amp; Shortcuts Guide</div>
        </header>

        <div class="guide-tabs-bar" role="tablist">
          <button type="button" class="guide-tab-btn is-active" data-tab="features" role="tab" aria-selected="true">
            المميزات (Features)
          </button>
          <button type="button" class="guide-tab-btn" data-tab="shortcuts" role="tab" aria-selected="false">
            اختصارات التنسيق (Shortcuts)
          </button>
        </div>

        <div class="guide-search-wrap">
          <div class="guide-search-pill">
            ${Icons.search('guide-search-icon', 18)}
            <input type="search" id="guide-search-input" placeholder="Search shortcuts, features, symbols..." dir="auto" />
          </div>
        </div>

        <div class="guide-pager-container" id="guide-pager-container">
          <div class="guide-pager-page" id="guide-page-features" data-page="features">
            <section class="guide-section" id="guide-features-section">
              <div class="guide-section-header">App Features &amp; Workflows</div>
              <div class="guide-cards-list" id="guide-features-list"></div>
            </section>
          </div>

          <div class="guide-pager-page" id="guide-page-shortcuts" data-page="shortcuts">
            <section class="guide-section" id="guide-shortcuts-section">
              <div class="guide-section-header">Live Formatting &amp; Unique Shortcuts</div>
              <p class="guide-section-desc">
                All shortcuts apply visually as you type inside the composer. Tap any shortcut chip to copy it, or test interactive spoilers, checkboxes &amp; collapsible accordions below.
              </p>
              <div class="guide-cards-list" id="guide-shortcuts-list"></div>
            </section>
          </div>
        </div>

        <div class="guide-empty-state" id="guide-empty-state" style="display: none;">
          No matching features or shortcuts found.
        </div>
      </div>
    `;

    this._renderLists('');
    this._bindEvents();
  }

  _renderLists(query = '') {
    const q = query.trim().toLowerCase();
    const shortcutsList = this.container.querySelector('#guide-shortcuts-list');
    const featuresList = this.container.querySelector('#guide-features-list');
    const emptyEl = this.container.querySelector('#guide-empty-state');

    const matchingShortcuts = FORMATTING_SHORTCUTS.filter((item) => {
      if (!q) return true;
      const hay = `${item.title} ${item.category} ${item.shortcut} ${item.toolbarLabel} ${item.description}`.toLowerCase();
      return hay.includes(q);
    });

    const matchingFeatures = APP_FEATURES_SECTIONS.filter((sec) => {
      if (!q) return true;
      const hay = `${sec.title} ${sec.keywords} ${sec.bullets.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });

    if (shortcutsList) {
      shortcutsList.innerHTML = '';
      for (const item of matchingShortcuts) {
        if (!this._exampleTexts.has(item.id)) {
          this._exampleTexts.set(item.id, item.exampleMarkup);
        }
        const curMarkup = this._exampleTexts.get(item.id);
        const card = document.createElement('div');
        card.className = 'guide-card';
        card.innerHTML = `
          <div class="guide-card-top">
            <div class="guide-card-titles">
              <span class="guide-card-category">${escapeHtml(item.category)}</span>
              <h3 class="guide-card-title" dir="auto">${escapeHtml(item.title)}</h3>
            </div>
            <div class="guide-toolbar-item-badge" title="${escapeHtml(item.toolbarTip || item.toolbarLabel)}">
              ${getToolbarButtonPreview(item)}
              <span>${escapeHtml(item.toolbarLabel)}</span>
            </div>
          </div>
          <div class="guide-shortcut-row">
            <button type="button" class="guide-shortcut-chip" data-copy-shortcut="${escapeHtml(item.shortcut)}" title="Copy shortcut">
              <code>${escapeHtml(item.shortcut)}</code>
              ${Icons.copy('guide-copy-icon', 13)}
            </button>
          </div>
          <p class="guide-card-desc">${escapeHtml(item.description)}</p>
          ${item.toolbarTip ? `<div class="guide-toolbar-tip-text">💡 ${escapeHtml(item.toolbarTip)}</div>` : ''}
          <div class="guide-live-preview-bubble" style="margin-top: 8px;">
            <div class="msg-text-body" dir="auto">${renderRichMessageHtml(curMarkup, { interactive: true })}</div>
          </div>
        `;

        card.querySelector('.guide-shortcut-chip')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard?.writeText(item.shortcut);
            Toast.show(`Copied: ${item.shortcut}`);
          } catch (_) {
            Toast.show(item.shortcut);
          }
        });

        this._bindInteractivePreview(card.querySelector('.guide-live-preview-bubble'), item.id);
        shortcutsList.appendChild(card);
      }
    }

    if (featuresList) {
      featuresList.innerHTML = '';
      for (const sec of matchingFeatures) {
        const card = document.createElement('div');
        card.className = 'guide-card guide-feature-card';
        card.innerHTML = `
          <div class="guide-feature-header">
            <span class="guide-feature-icon">${sec.icon}</span>
            <h3 class="guide-card-title">${escapeHtml(sec.title)}</h3>
          </div>
          <ul class="guide-feature-bullets">
            ${sec.bullets.map((b) => `<li>${b}</li>`).join('')}
          </ul>
        `;
        featuresList.appendChild(card);
      }
    }

    if (emptyEl) {
      emptyEl.style.display = (matchingShortcuts.length === 0 && matchingFeatures.length === 0) ? 'block' : 'none';
    }
  }

  _bindInteractivePreview(previewEl, itemId) {
    if (!previewEl) return;
    previewEl.querySelectorAll('.wa-spoiler').forEach((sp) => {
      sp.addEventListener('click', (e) => {
        e.stopPropagation();
        const revealed = sp.classList.toggle('is-revealed');
        sp.dataset.revealed = revealed ? 'true' : 'false';
      });
    });

    previewEl.querySelectorAll('.wa-check-input').forEach((cb) => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        const idx = Number(e.target.dataset.checkIdx);
        const cur = this._exampleTexts.get(itemId) || '';
        const next = toggleCheckboxInMarkup(cur, idx);
        this._exampleTexts.set(itemId, next);
        const textWrap = e.target.closest('.wa-check-label')?.querySelector('.wa-check-text');
        if (textWrap) textWrap.classList.toggle('is-checked', e.target.checked);
      });
    });

    previewEl.addEventListener('click', (e) => {
      if (e.target.closest('.wa-check-input') || e.target.closest('.wa-check-box') || e.target.closest('.wa-fold-summary')) {
        e.stopPropagation();
      }
    });
  }

  _switchTab(tabName) {
    this._activeTab = tabName;
    const tabBtns = this.container.querySelectorAll('.guide-tab-btn');
    tabBtns.forEach((btn) => {
      const isMatch = btn.dataset.tab === tabName;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    const pager = this.container.querySelector('#guide-pager-container');
    const targetPage = this.container.querySelector(`#guide-page-${tabName}`);
    if (pager && targetPage) {
      pager.scrollTo({
        left: targetPage.offsetLeft,
        behavior: 'smooth'
      });
    }
  }

  _bindEvents() {
    this.container.querySelector('#btn-guide-back')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.router.back();
    });

    const tabBtns = this.container.querySelectorAll('.guide-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this._switchTab(btn.dataset.tab);
      });
    });

    const pager = this.container.querySelector('#guide-pager-container');
    if (pager) {
      let scrollTimer = null;
      pager.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const width = pager.clientWidth || 1;
          const pageIndex = Math.round(pager.scrollLeft / width);
          const activeName = pageIndex === 1 ? 'shortcuts' : 'features';
          if (this._activeTab !== activeName) {
            this._activeTab = activeName;
            this.container.querySelectorAll('.guide-tab-btn').forEach((btn) => {
              const isMatch = btn.dataset.tab === activeName;
              btn.classList.toggle('is-active', isMatch);
              btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
            });
          }
        }, 60);
      }, { passive: true });
    }

    const searchInput = this.container.querySelector('#guide-search-input');
    searchInput?.addEventListener('input', () => {
      this._renderLists(searchInput.value);
    });
  }
}
