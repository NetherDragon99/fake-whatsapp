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
    keywords: 'nested tree parent child hierarchy branch sub-message',
    icon: Icons.treeBranch('', 20),
    bullets: [
      '<strong>Arbitrary Depth (A → B → C...):</strong> Select any message (even an already-nested one) and tap <b>Nest under...</b>, then tap its parent message.',
      '<strong>Quick Compose Child:</strong> Select a message and tap <b>Add nested message</b> to compose directly underneath it.',
      '<strong>Visual Tree Connectors & Sheet:</strong> Adjacent nested messages display connected tree lines &amp; arrows. Tap <b>↳ Nested under</b> to jump to the parent, or tap the <b>N nested</b> badge to inspect and manage the entire multi-level tree.',
      '<strong>Independent &amp; Safe:</strong> Prevents self-nesting and cycles automatically, and never triggers an unwanted <i>Edited</i> tag.'
    ]
  },
  {
    id: 'message-lists',
    title: 'Numbered (1, 2, 3) & Bulleted (•) Message Lists',
    keywords: 'numbered bulleted list sort order sequence continue independent compose',
    icon: Icons.listNumbered('', 20),
    bullets: [
      '<strong>Standalone System:</strong> Select one or multiple messages and open <b>Numbered / Bulleted list...</b> to group them with simple <code>1, 2, 3...</code> numbers or <code>•</code> bullets — completely independent of nesting.',
      '<strong>Auto-Renumbering:</strong> Deleting or removing any item automatically renumbers all remaining items cleanly with zero gaps.',
      '<strong>Continue List:</strong> Choose <b>Continue list</b> on any message to keep sending new items directly into the same list.',
      '<strong>Freely Composable:</strong> Combine message lists with nested trees, replies, checklists, pins, link previews, and rich text without conflicts (numbered nested items always display simple numbers).'
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
    keywords: 'fullscreen composer toolbar formatting link preview edit youtube offline wysiwyg',
    icon: Icons.formatText('', 20),
    bullets: [
      '<strong>Live Formatting:</strong> Shortcuts transform visually inside the editor immediately without leaving raw symbols behind.',
      '<strong>Smooth Fullscreen Transition:</strong> Drag upward from the composer handle or tap the format/expand button. The editor spans 100% full width while Undo/Redo/Clear appear on top and the scrollable formatting toolbar docks seamlessly between Emoji, Attach, Camera, and Send.',
      '<strong>Hybrid Embedded Link Previews:</strong> URLs show instant offline cards (with automatic YouTube thumbnails) and enrich online when connected, with <b>Edit (✏️)</b> &amp; <b>Dismiss (×)</b> buttons before sending (shown at top in normal view and bottom in fullscreen).'
    ]
  },
  {
    id: 'voice-and-tools',
    title: 'Voice Pause/Resume, Message Info & Navigation Tools',
    keywords: 'voice recording pause resume duration waveform message info scroll date jump reply link',
    icon: Icons.mic('', 20),
    bullets: [
      '<strong>Accurate Pause/Resume Voice Notes:</strong> Pausing stops the active timer and stitches resumed segments cleanly so sent duration and playback waveform never include pause gaps.',
      '<strong>Scrollable Message Info:</strong> Long previews stay height-capped with a <b>Show full preview</b> toggle inside a single smoothly scrollable sheet.',
      '<strong>Nearest-Date Jump & Reply Linking:</strong> Jump to any date from chat Search or menu (automatically lands on the closest day if exact date has no messages), and link/unlink reply quotes on imported messages without forcing <i>Edited</i>.'
    ]
  }
];

export class GuideView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this._exampleTexts = new Map();
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

        <div class="guide-search-wrap">
          <div class="guide-search-pill">
            ${Icons.search('guide-search-icon', 18)}
            <input type="search" id="guide-search-input" placeholder="Search shortcuts, features, symbols..." dir="auto" />
          </div>
        </div>

        <div class="guide-content" id="guide-content-scroll">
          <section class="guide-section" id="guide-shortcuts-section">
            <div class="guide-section-header">Live Formatting &amp; Unique Shortcuts</div>
            <p class="guide-section-desc">
              All shortcuts apply visually as you type inside the composer without leaving raw symbols behind. Tap any shortcut chip to copy it, or test interactive spoilers &amp; checkboxes below.
            </p>
            <div class="guide-cards-list" id="guide-shortcuts-list"></div>
          </section>

          <section class="guide-section" id="guide-features-section">
            <div class="guide-section-header">App Features &amp; Workflows</div>
            <div class="guide-cards-list" id="guide-features-list"></div>
          </section>

          <div class="guide-empty-state" id="guide-empty-state" style="display: none;">
            No matching features or shortcuts found.
          </div>
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
    const shortcutsSec = this.container.querySelector('#guide-shortcuts-section');
    const featuresSec = this.container.querySelector('#guide-features-section');
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
            <span class="guide-toolbar-pill">${escapeHtml(item.toolbarLabel)}</span>
          </div>
          <div class="guide-shortcut-row">
            <button type="button" class="guide-shortcut-chip" data-copy-shortcut="${escapeHtml(item.shortcut)}" title="Copy shortcut">
              <code>${escapeHtml(item.shortcut)}</code>
              ${Icons.copy('guide-copy-icon', 13)}
            </button>
          </div>
          <p class="guide-card-desc">${escapeHtml(item.description)}</p>
          <div class="guide-live-preview-bubble">
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

    if (shortcutsSec) shortcutsSec.style.display = matchingShortcuts.length > 0 ? '' : 'none';
    if (featuresSec) featuresSec.style.display = matchingFeatures.length > 0 ? '' : 'none';
    if (emptyEl) {
      emptyEl.style.display = (matchingShortcuts.length === 0 && matchingFeatures.length === 0) ? 'block' : 'none';
    }
  }

  _bindInteractivePreview(previewEl, itemId) {
    if (!previewEl) return;
    previewEl.querySelectorAll('.wa-spoiler').forEach((sp) => {
      sp.addEventListener('click', () => {
        const revealed = sp.classList.toggle('is-revealed');
        sp.dataset.revealed = revealed ? 'true' : 'false';
      });
    });
    previewEl.querySelectorAll('.wa-check-input').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.checkIdx);
        const cur = this._exampleTexts.get(itemId) || '';
        const next = toggleCheckboxInMarkup(cur, idx);
        this._exampleTexts.set(itemId, next);
        const textWrap = e.target.closest('.wa-check-label')?.querySelector('.wa-check-text');
        if (textWrap) textWrap.classList.toggle('is-checked', e.target.checked);
      });
    });
  }

  _bindEvents() {
    this.container.querySelector('#btn-guide-back')?.addEventListener('click', () => {
      this.router.goBack();
    });

    const searchInput = this.container.querySelector('#guide-search-input');
    searchInput?.addEventListener('input', () => {
      this._renderLists(searchInput.value);
    });
  }
}
