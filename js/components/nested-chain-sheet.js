/**
 * Multi-Level Nested Tree Sheet (System A — Independent of List Numbering)
 * Displays the complete hierarchical tree of nested messages from root ancestor down to all depths,
 * allowing instant jump, adding nested children under any level, or unlinking a branch.
 */
import { DrawerResizer } from '../utils/drawer-resizer.js';
import { Icons } from '../icons.js';
import { escapeHtml, stripRichMarkup } from '../utils/rich-text.js';

export class NestedChainSheet {
  constructor() {
    this.overlayEl = null;
    this.sheetEl = null;
    this.handleEl = null;
    this.fsHeaderEl = null;
    this.bodyEl = null;
    this.resizer = null;
    this._built = false;
  }

  _ensureBuilt() {
    if (this._built) return;
    this._built = true;

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'nested-tree-overlay wa-sheet-overlay';
    this.overlayEl.style.display = 'none';

    this.sheetEl = document.createElement('div');
    this.sheetEl.className = 'nested-tree-sheet wa-bottom-sheet';
    this.sheetEl.style.display = 'none';

    this.handleEl = document.createElement('div');
    this.handleEl.className = 'sheet-handle-area';
    this.handleEl.innerHTML = `
      <div class="sheet-dash"></div>
      <div class="nested-tree-title" id="nested-tree-title">Nested Message Tree</div>
    `;
    this.sheetEl.appendChild(this.handleEl);

    this.fsHeaderEl = document.createElement('div');
    this.fsHeaderEl.className = 'sheet-fullscreen-header';
    this.fsHeaderEl.style.display = 'none';
    this.fsHeaderEl.innerHTML = `
      <button type="button" class="app-bar-icon-btn sheet-fullscreen-back-btn" aria-label="Back">${Icons.arrowBack('', 24)}</button>
      <span class="fs-header-title">Nested Message Tree</span>
    `;
    this.sheetEl.appendChild(this.fsHeaderEl);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'nested-tree-body';
    this.sheetEl.appendChild(this.bodyEl);

    document.body.appendChild(this.overlayEl);
    document.body.appendChild(this.sheetEl);

    this.resizer = new DrawerResizer({
      sheet: this.sheetEl,
      handle: this.handleEl,
      backdrop: this.overlayEl,
      fullscreenHeader: this.fsHeaderEl,
      overlayId: 'nested-tree-sheet',
      mode: 'bottom',
      defaultHeightVh: 55,
      minVh: 20,
      maxVh: 80,
      onClose: () => {
        this.overlayEl.style.display = 'none';
      }
    });
  }

  _findTopAncestor(startMsg, msgById) {
    let cur = startMsg;
    const visited = new Set();
    while (cur && cur.nestedParent && cur.nestedParent.id) {
      const curId = String(cur.id);
      if (visited.has(curId)) break;
      visited.add(curId);
      const parent = msgById.get(String(cur.nestedParent.id));
      if (!parent) break;
      cur = parent;
    }
    return cur;
  }

  _getMessageSnippet(msg) {
    if (!msg) return '';
    if (msg.isDeleted) return 'This message was deleted';
    const clean = stripRichMarkup(msg.text || '');
    if (clean) return clean.slice(0, 110);
    if (msg.mediaName) return msg.mediaName;
    if (msg.mediaType) return `[${msg.mediaType}]`;
    return 'Message';
  }

  _formatTime(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (_) {
      return '';
    }
  }

  open({
    rootMsg,
    focusMsg = null,
    allMessages = [],
    nestedChildrenByParentId = new Map(),
    listPositionByMsgId = new Map(),
    onJumpToMessage = () => {},
    onAddNestedChild = () => {},
    onUnlinkNested = async () => {}
  }) {
    if (!rootMsg) return;
    this._ensureBuilt();

    const msgById = new Map(allMessages.map((m) => [String(m.id), m]));
    const topAncestor = this._findTopAncestor(rootMsg, msgById);
    const focusId = focusMsg ? String(focusMsg.id) : String(rootMsg.id);

    const renderBody = () => {
      this.bodyEl.innerHTML = '';
      const visited = new Set();
      let renderedCount = 0;

      const listEl = document.createElement('div');
      listEl.className = 'nested-tree-list';

      const appendNode = (msg, depth) => {
        const idStr = String(msg.id);
        if (visited.has(idStr)) return;
        visited.add(idStr);
        renderedCount++;

        const row = document.createElement('div');
        row.className = `nested-tree-node${idStr === focusId ? ' is-focused' : ''}`;
        row.style.setProperty('--tree-depth', String(Math.min(6, depth)));

        const senderName = msg.isOutgoing ? 'You' : (msg.sender || 'Contact');
        const listInfo = listPositionByMsgId.get(idStr);
        const listBadgeHtml = listInfo
          ? `<span class="nested-tree-list-badge">${listInfo.style === 'ordered' ? `${listInfo.index}` : '•'}</span>`
          : '';
        const depthTag = depth > 0 ? `<span class="nested-tree-depth-tag">L${depth}</span>` : '<span class="nested-tree-root-tag">Root</span>';

        row.innerHTML = `
          <div class="nested-tree-branch-guide">${depth > 0 ? '└─' : ''}</div>
          <div class="nested-tree-card" role="button" tabindex="0">
            <div class="nested-tree-card-top">
              <div class="nested-tree-sender-group">
                ${listBadgeHtml}
                <span class="nested-tree-sender">${escapeHtml(senderName)}</span>
                ${depthTag}
              </div>
              <span class="nested-tree-time">${escapeHtml(this._formatTime(msg.timestamp))}</span>
            </div>
            <div class="nested-tree-snippet" dir="auto">${escapeHtml(this._getMessageSnippet(msg))}</div>
          </div>
          <div class="nested-tree-actions">
            <button type="button" class="nested-tree-btn add-child" title="Add nested message under this">${Icons.treeBranch('', 16)}</button>
            ${depth > 0 ? `<button type="button" class="nested-tree-btn unlink-child" title="Unnest this message">${Icons.close('', 16)}</button>` : ''}
          </div>
        `;

        row.querySelector('.nested-tree-card')?.addEventListener('click', () => {
          this.close();
          onJumpToMessage(msg.id);
        });

        row.querySelector('.add-child')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.close();
          onAddNestedChild(msg);
        });

        row.querySelector('.unlink-child')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await onUnlinkNested(msg);
          renderBody();
        });

        listEl.appendChild(row);

        const children = nestedChildrenByParentId.get(idStr) || [];
        for (const child of children) {
          appendNode(child, depth + 1);
        }
      };

      appendNode(topAncestor, 0);

      const titleEl = this.sheetEl.querySelector('#nested-tree-title');
      if (titleEl) {
        titleEl.textContent = `Nested Message Tree (${renderedCount})`;
      }

      if (renderedCount <= 1) {
        const emptyHint = document.createElement('div');
        emptyHint.className = 'nested-tree-empty-hint';
        emptyHint.textContent = 'No remaining nested messages in this tree.';
        listEl.appendChild(emptyHint);
      }

      this.bodyEl.appendChild(listEl);
    };

    renderBody();
    this.overlayEl.style.display = 'block';
    this.resizer.open(55);
  }

  close() {
    if (this.resizer) this.resizer.close();
  }

  destroy() {
    if (this.resizer) this.close();
    if (this.sheetEl?.parentNode) this.sheetEl.parentNode.removeChild(this.sheetEl);
    if (this.overlayEl?.parentNode) this.overlayEl.parentNode.removeChild(this.overlayEl);
  }
}
