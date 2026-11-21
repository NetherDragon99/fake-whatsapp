/**
 * Real-Time WYSIWYG Rich Composer (contenteditable)
 * - Auto-applies WhatsApp and custom unique shortcuts immediately without showing raw markup symbols
 * - Supports interactive checklist editing, nested lists (Tab / Shift+Tab), headers H1-H3,
 *   6 highlight colors, underline, spoiler, superscript/subscript, code, blockquotes, and word hyperlinks
 * - Serializes cleanly to canonical markup for unlimited-length storage, search, and editing
 */
import { HIGHLIGHT_COLORS, escapeHtml, sanitizeUrl } from '../utils/rich-text.js';

export class RichComposer {
  constructor(editorEl, { onChange = () => {}, onSelectionChange = () => {}, onSubmit = null } = {}) {
    this.el = editorEl;
    this.onChange = onChange;
    this.onSelectionChange = onSelectionChange;
    this.onSubmit = onSubmit;

    this._isComposing = false;
    this._suppressInput = false;
    this._savedRange = null;
    this._lastBulletType = 'bullet';
    this._undoStack = [''];
    this._undoIdx = 0;
    this._maxHistory = 60;

    this._bindEvents();
    this._ensureAtLeastOneBlock();
  }

  _bindEvents() {
    this._onCompositionStart = () => { this._isComposing = true; };
    this._onCompositionEnd = () => {
      this._isComposing = false;
      this._handleInput();
    };
    this._onInput = () => {
      if (this._suppressInput || this._isComposing) return;
      this._handleInput();
    };
    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onPaste = (e) => this._handlePaste(e);
    this._onClick = (e) => {
      const toggle = e.target.closest?.('.rc-check-toggle');
      if (toggle && this.el.contains(toggle)) {
        e.preventDefault();
        e.stopPropagation();
        const block = toggle.closest('.rc-block[data-block="check"]');
        if (block) {
          const isChecked = block.dataset.checked === 'true';
          block.dataset.checked = isChecked ? 'false' : 'true';
          this._pushHistory();
          this.onChange(this.getValue());
        }
        return;
      }
      const foldToggle = e.target.closest?.('.rc-fold-toggle');
      if (foldToggle && this.el.contains(foldToggle)) {
        e.preventDefault();
        e.stopPropagation();
        const foldEl = foldToggle.closest('.rc-block[data-block="fold"]');
        if (foldEl) {
          const nextOpen = foldEl.dataset.open !== 'false' ? 'false' : 'true';
          foldEl.dataset.open = nextOpen;
          foldToggle.textContent = nextOpen === 'true' ? '▼' : '▶';
        }
        return;
      }
      const foldRemove = e.target.closest?.('.rc-fold-remove');
      if (foldRemove && this.el.contains(foldRemove)) {
        e.preventDefault();
        e.stopPropagation();
        const foldEl = foldRemove.closest('.rc-block[data-block="fold"]');
        if (foldEl) {
          this._unwrapFoldBlock(foldEl);
        }
        return;
      }
      this._saveSelection();
      this.onSelectionChange(this.getActiveFormats());
    };
    this._onKeyUp = () => {
      this._saveSelection();
      this.onSelectionChange(this.getActiveFormats());
    };
    this._onBlur = () => {
      this._saveSelection();
    };

    this.el.addEventListener('compositionstart', this._onCompositionStart);
    this.el.addEventListener('compositionend', this._onCompositionEnd);
    this.el.addEventListener('input', this._onInput);
    this.el.addEventListener('keydown', this._onKeyDown);
    this.el.addEventListener('paste', this._onPaste);
    this.el.addEventListener('click', this._onClick);
    this.el.addEventListener('keyup', this._onKeyUp);
    this.el.addEventListener('blur', this._onBlur);
  }

  destroy() {
    if (!this.el) return;
    this.el.removeEventListener('compositionstart', this._onCompositionStart);
    this.el.removeEventListener('compositionend', this._onCompositionEnd);
    this.el.removeEventListener('input', this._onInput);
    this.el.removeEventListener('keydown', this._onKeyDown);
    this.el.removeEventListener('paste', this._onPaste);
    this.el.removeEventListener('click', this._onClick);
    this.el.removeEventListener('keyup', this._onKeyUp);
    this.el.removeEventListener('blur', this._onBlur);
  }

  focus() {
    this.el?.focus();
  }

  isEmpty() {
    return this.getValue().length === 0;
  }

  clear() {
    this.setValue('');
  }

  // --- Selection Helpers ---
  _saveSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (this.el.contains(range.commonAncestorContainer)) {
      this._savedRange = range.cloneRange();
    }
  }

  restoreSelection() {
    const sel = window.getSelection();
    if (!sel) return;
    if (this._savedRange && this.el.contains(this._savedRange.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(this._savedRange);
    } else {
      this.focus();
      const targetBody = this._getBlockBodyEl(this.el.lastElementChild) || this.el;
      if (targetBody) {
        this._placeCaretAtEnd(targetBody);
      }
    }
  }

  _normalizeBlockContainer(containerEl) {
    if (!containerEl) return;
    if (!containerEl.firstChild) {
      const p = document.createElement('div');
      p.className = 'rc-block rc-p';
      p.dataset.block = 'p';
      p.appendChild(document.createElement('br'));
      containerEl.appendChild(p);
      return;
    }
    const children = Array.from(containerEl.childNodes);
    for (const node of children) {
      if (node.nodeType === 3 || (node.nodeType === 1 && !node.classList?.contains('rc-block'))) {
        if (node.nodeType === 1 && node.tagName === 'DIV' && !node.dataset?.block) {
          node.className = 'rc-block rc-p';
          node.dataset.block = 'p';
        } else {
          const p = document.createElement('div');
          p.className = 'rc-block rc-p';
          p.dataset.block = 'p';
          node.parentNode.insertBefore(p, node);
          p.appendChild(node);
        }
      }
    }
  }

  _ensureAtLeastOneBlock() {
    if (!this.el) return;
    this._normalizeBlockContainer(this.el);
    this.el.querySelectorAll?.('.rc-fold-body').forEach((bodyEl) => {
      this._normalizeBlockContainer(bodyEl);
    });
    this._syncEmptyState();
    this._syncOrderedNumbers();
  }

  _syncEmptyState() {
    const val = this.getValue();
    const hasFold = Boolean(this.el.querySelector?.('.rc-fold'));
    this.el.classList.toggle('is-empty', val.length === 0 && !hasFold);
  }

  _syncOrderedNumbersInContainer(containerEl) {
    if (!containerEl) return;
    const counters = new Map();
    const blocks = Array.from(containerEl.querySelectorAll(':scope > .rc-block'));
    for (const blk of blocks) {
      if (blk.dataset.block === 'ol') {
        const indent = Number(blk.dataset.indent || 0);
        for (const k of Array.from(counters.keys())) {
          if (k > indent) counters.delete(k);
        }
        const nextNum = (counters.get(indent) || 0) + 1;
        counters.set(indent, nextNum);
        blk.dataset.olNum = String(nextNum);
        const badge = blk.querySelector(':scope > .rc-ol-marker');
        if (badge) badge.textContent = `${nextNum}.`;
      } else if (blk.dataset.block !== 'ul' && blk.dataset.block !== 'check') {
        counters.clear();
      }
    }
  }

  _syncOrderedNumbers() {
    if (!this.el) return;
    this._syncOrderedNumbersInContainer(this.el);
    this.el.querySelectorAll?.('.rc-fold-body').forEach((bodyEl) => {
      this._syncOrderedNumbersInContainer(bodyEl);
    });
  }

  _getBlockElement(node) {
    let cur = node;
    while (cur && cur !== this.el) {
      if (cur.nodeType === 1 && cur.classList?.contains('rc-block')) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }

  _getEnclosingFold(node) {
    let cur = node;
    while (cur && cur !== this.el) {
      if (cur.nodeType === 1 && cur.classList?.contains('rc-fold')) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }

  _getFoldTitleEl(node) {
    let cur = node;
    while (cur && cur !== this.el) {
      if (cur.nodeType === 1 && cur.classList?.contains('rc-fold-title')) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }

  _getBlockBodyEl(blockEl) {
    if (!blockEl) return null;
    if (blockEl.dataset.block === 'check' || blockEl.dataset.block === 'ol' || blockEl.dataset.block === 'ul') {
      return blockEl.querySelector(':scope > .rc-item-body') || blockEl;
    }
    if (blockEl.dataset.block === 'fold') {
      return blockEl.querySelector(':scope > .rc-fold-body') || blockEl;
    }
    return blockEl;
  }

  _makeBlockEl(type, options = {}) {
    const indent = Math.max(0, Math.min(3, Number(options.indent) || 0));
    if (type === 'codeblock') {
      const pre = document.createElement('pre');
      pre.className = 'rc-block rc-codeblock';
      pre.dataset.block = 'codeblock';
      if (options.text !== undefined) {
        pre.textContent = options.text;
      }
      if (!pre.firstChild) pre.appendChild(document.createElement('br'));
      return pre;
    }

    if (type === 'fold') {
      const div = document.createElement('div');
      div.className = 'rc-block rc-fold';
      div.dataset.block = 'fold';
      const isOpen = options.open !== false;
      div.dataset.open = isOpen ? 'true' : 'false';

      const header = document.createElement('div');
      header.className = 'rc-fold-header';

      const toggle = document.createElement('span');
      toggle.className = 'rc-fold-toggle';
      toggle.setAttribute('contenteditable', 'false');
      toggle.setAttribute('role', 'button');
      toggle.title = 'Toggle fold preview';
      toggle.textContent = isOpen ? '▼' : '▶';

      const titleEl = document.createElement('div');
      titleEl.className = 'rc-fold-title';
      titleEl.dataset.placeholder = 'عنوان القسم القابل للطي...';
      titleEl.setAttribute('dir', 'auto');
      this._populateInlineNodes(titleEl, options.title || '');

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'rc-fold-remove';
      removeBtn.setAttribute('contenteditable', 'false');
      removeBtn.title = 'Remove fold block';
      removeBtn.setAttribute('aria-label', 'Remove fold block');
      removeBtn.textContent = '×';

      header.appendChild(toggle);
      header.appendChild(titleEl);
      header.appendChild(removeBtn);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'rc-fold-body';
      bodyEl.setAttribute('dir', 'auto');
      this._renderMarkupToContainer(bodyEl, options.bodyMarkup || '');

      div.appendChild(header);
      div.appendChild(bodyEl);
      return div;
    }

    const div = document.createElement('div');
    div.className = `rc-block rc-${type}`;
    div.dataset.block = type;
    if (type === 'ul' || type === 'ol' || type === 'check') {
      div.dataset.indent = String(indent);
    }
    if (type === 'check') {
      div.dataset.checked = options.checked ? 'true' : 'false';
      const box = document.createElement('span');
      box.className = 'rc-check-toggle';
      box.setAttribute('contenteditable', 'false');
      const body = document.createElement('span');
      body.className = 'rc-item-body';
      body.appendChild(document.createElement('br'));
      div.appendChild(box);
      div.appendChild(body);
    } else if (type === 'ul' || type === 'ol') {
      const marker = document.createElement('span');
      marker.setAttribute('contenteditable', 'false');
      if (type === 'ol') {
        marker.className = 'rc-ol-marker';
        marker.textContent = '1.';
      } else {
        const shape = options.bulletType || 'bullet';
        div.dataset.bulletType = shape;
        marker.className = `rc-ul-marker is-${shape}`;
        marker.textContent = shape === 'arrow' ? '→' : (shape === 'branch' ? '↳' : '•');
      }
      const body = document.createElement('span');
      body.className = 'rc-item-body';
      body.appendChild(document.createElement('br'));
      div.appendChild(marker);
      div.appendChild(body);
    } else {
      div.appendChild(document.createElement('br'));
    }
    return div;
  }

  _placeCaretAtEnd(node) {
    const sel = window.getSelection();
    if (!sel || !node) return;
    const range = document.createRange();
    if (node.nodeType === 3) {
      range.setStart(node, node.nodeValue.length);
    } else {
      const last = node.lastChild;
      if (last && last.nodeType === 1 && last.tagName === 'BR') {
        if (node.childNodes.length === 1) {
          range.setStart(node, 0);
        } else {
          range.setStartBefore(last);
        }
      } else {
        range.selectNodeContents(node);
        range.collapse(false);
      }
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    this._saveSelection();
  }

  _placeCaretAtStart(node) {
    const sel = window.getSelection();
    if (!sel || !node) return;
    const range = document.createRange();
    range.setStart(node, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    this._saveSelection();
  }

  // --- Canonical Serialization (DOM -> Markup) ---
  _serializeBlockContainer(containerEl) {
    if (!containerEl) return '';
    const blocks = Array.from(containerEl.childNodes);
    const outLines = [];
    const olCounters = new Map();

    for (const node of blocks) {
      if (node.nodeType === 3) {
        const txt = node.nodeValue.replace(/\u200B/g, '').replace(/\u00A0/g, ' ');
        if (txt) outLines.push(txt);
        continue;
      }
      if (node.nodeType !== 1) continue;

      const blockType = node.dataset?.block || (node.tagName === 'PRE' ? 'codeblock' : 'p');
      if (blockType === 'codeblock') {
        olCounters.clear();
        const rawCode = (node.innerText || node.textContent || '').replace(/\u200B/g, '').replace(/\u00A0/g, ' ').replace(/\n+$/, '');
        outLines.push(`\`\`\`\n${rawCode}\n\`\`\``);
        continue;
      }

      if (blockType === 'fold') {
        olCounters.clear();
        const titleEl = node.querySelector(':scope > .rc-fold-header > .rc-fold-title');
        const bodyEl = node.querySelector(':scope > .rc-fold-body');
        const rawTitle = this._serializeChildren(titleEl)
          .replace(/\u200B/g, '')
          .replace(/\u00A0/g, ' ')
          .replace(/[\r\n]+/g, ' ')
          .replace(/\]/g, '')
          .trim();
        const bodyStr = this._serializeBlockContainer(bodyEl);
        if (!rawTitle && !bodyStr) continue;
        const finalTitle = rawTitle || 'اضغط لعرض التفاصيل';
        outLines.push(bodyStr ? `[fold:${finalTitle}]\n${bodyStr}\n[/fold]` : `[fold:${finalTitle}][/fold]`);
        continue;
      }

      const body = this._getBlockBodyEl(node);
      const inlineStr = this._serializeChildren(body).replace(/\u200B/g, '').replace(/\u00A0/g, ' ').replace(/\n+$/, '');
      const indent = Number(node.dataset?.indent || 0);
      const pad = '  '.repeat(Math.max(0, indent));

      if (blockType === 'h1') {
        olCounters.clear();
        outLines.push(`# ${inlineStr}`);
      } else if (blockType === 'h2') {
        olCounters.clear();
        outLines.push(`## ${inlineStr}`);
      } else if (blockType === 'h3') {
        olCounters.clear();
        outLines.push(`### ${inlineStr}`);
      } else if (blockType === 'quote') {
        olCounters.clear();
        outLines.push(`> ${inlineStr}`);
      } else if (blockType === 'ul') {
        const shape = node.dataset?.bulletType || 'bullet';
        const prefix = shape === 'arrow' ? '-> ' : (shape === 'branch' ? '↳ ' : '- ');
        outLines.push(`${pad}${prefix}${inlineStr}`);
      } else if (blockType === 'ol') {
        for (const k of Array.from(olCounters.keys())) {
          if (k > indent) olCounters.delete(k);
        }
        const num = (olCounters.get(indent) || 0) + 1;
        olCounters.set(indent, num);
        outLines.push(`${pad}${num}. ${inlineStr}`);
      } else if (blockType === 'check') {
        const checked = node.dataset?.checked === 'true';
        outLines.push(`${pad}[${checked ? 'x' : ' '}] ${inlineStr}`);
      } else {
        olCounters.clear();
        outLines.push(inlineStr);
      }
    }

    const joined = outLines.join('\n').replace(/\u200B/g, '').replace(/\u00A0/g, ' ');
    return joined.replace(/\n+$/, '');
  }

  getValue() {
    if (!this.el) return '';
    return this._serializeBlockContainer(this.el);
  }

  _serializeChildren(parent) {
    if (!parent) return '';
    let result = '';
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === 3) {
        result += child.nodeValue.replace(/\u200B/g, '').replace(/\u00A0/g, ' ');
      } else if (child.nodeType === 1) {
        if (child.tagName === 'BR') continue;
        if (child.getAttribute('contenteditable') === 'false') continue;

        const inner = this._serializeChildren(child);
        if (!inner) continue;

        const tag = child.tagName;
        if (tag === 'STRONG' || tag === 'B') {
          result += `*${inner}*`;
        } else if (tag === 'EM' || tag === 'I') {
          result += `_${inner}_`;
        } else if (tag === 'DEL' || tag === 'S' || tag === 'STRIKE') {
          result += `~${inner}~`;
        } else if (tag === 'U' || child.dataset?.fmt === 'underline') {
          result += `++${inner}++`;
        } else if (tag === 'CODE') {
          result += `\`${inner}\``;
        } else if (tag === 'MARK') {
          const code = child.dataset?.hlColor || 'y';
          result += code === 'y' ? `==${inner}==` : `==${code}:${inner}==`;
        } else if (child.dataset?.fmt === 'spoiler' || child.classList?.contains('wa-spoiler')) {
          result += `||${inner}||`;
        } else if (tag === 'SUP') {
          result += `^^${inner}^^`;
        } else if (tag === 'SUB') {
          result += `,,${inner},,`;
        } else if (tag === 'A') {
          const href = child.dataset?.href || child.getAttribute('href') || '';
          const safe = sanitizeUrl(href);
          result += safe ? `[${inner}](${safe})` : inner;
        } else {
          result += inner;
        }
      }
    }
    return result;
  }

  // --- Canonical Hydrator (Markup -> Live WYSIWYG DOM) ---
  _renderMarkupToContainer(containerEl, markup = '') {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    const raw = String(markup || '').replace(/\r\n?/g, '\n');
    if (!raw) {
      this._normalizeBlockContainer(containerEl);
      return;
    }

    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const foldMatch = line.match(/^(\s*)\[fold:([^\]\n]+)\](.*)$/);
      if (foldMatch && containerEl === this.el) {
        const title = foldMatch[2].trim();
        const firstRest = foldMatch[3].trim();
        const foldLines = [];
        if (firstRest) {
          if (firstRest.includes('[/fold]')) {
            const oneLineBody = firstRest.replace('[/fold]', '').trim();
            const blk = this._makeBlockEl('fold', { title, bodyMarkup: oneLineBody, open: true });
            containerEl.appendChild(blk);
            continue;
          }
          foldLines.push(firstRest);
        }
        let j = i + 1;
        while (j < lines.length && !lines[j].includes('[/fold]')) {
          foldLines.push(lines[j]);
          j++;
        }
        if (j < lines.length) {
          const lastRest = lines[j].replace('[/fold]', '').trim();
          if (lastRest) foldLines.push(lastRest);
          i = j;
        } else {
          i = lines.length - 1;
        }
        const blk = this._makeBlockEl('fold', { title, bodyMarkup: foldLines.join('\n'), open: true });
        containerEl.appendChild(blk);
        continue;
      }

      if (/^\s*```/.test(line)) {
        const codeLines = [];
        let j = i + 1;
        while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) {
          codeLines.push(lines[j]);
          j++;
        }
        i = j < lines.length ? j : lines.length - 1;
        const blk = this._makeBlockEl('codeblock', { text: codeLines.join('\n') });
        containerEl.appendChild(blk);
        continue;
      }

      const checkMatch = line.match(/^(\s*)\[([ xX])\]\s+(.*)$/);
      if (checkMatch) {
        const indent = Math.min(3, Math.floor(checkMatch[1].replace(/\t/g, '  ').length / 2));
        const blk = this._makeBlockEl('check', {
          indent,
          checked: checkMatch[2].toLowerCase() === 'x'
        });
        this._populateInlineNodes(this._getBlockBodyEl(blk), checkMatch[3]);
        containerEl.appendChild(blk);
        continue;
      }

      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headerMatch) {
        const type = `h${headerMatch[1].length}`;
        const blk = this._makeBlockEl(type);
        this._populateInlineNodes(blk, headerMatch[2]);
        containerEl.appendChild(blk);
        continue;
      }

      const quoteMatch = line.match(/^\s*>\s?(.*)$/);
      if (quoteMatch && /^\s*>/.test(line)) {
        const blk = this._makeBlockEl('quote');
        this._populateInlineNodes(blk, quoteMatch[1]);
        containerEl.appendChild(blk);
        continue;
      }

      const ulMatch = line.match(/^(\s*)(?:(->|=>|→)|(\\>|\|->|↳)|(?:-|\*))\s+(.*)$/);
      if (ulMatch) {
        const indent = Math.min(3, Math.floor(ulMatch[1].replace(/\t/g, '  ').length / 2));
        const shape = ulMatch[2] ? 'arrow' : (ulMatch[3] ? 'branch' : 'bullet');
        const blk = this._makeBlockEl('ul', { indent, bulletType: shape });
        this._populateInlineNodes(this._getBlockBodyEl(blk), ulMatch[4]);
        containerEl.appendChild(blk);
        continue;
      }

      const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (olMatch) {
        const indent = Math.min(3, Math.floor(olMatch[1].replace(/\t/g, '  ').length / 2));
        const blk = this._makeBlockEl('ol', { indent });
        this._populateInlineNodes(this._getBlockBodyEl(blk), olMatch[3]);
        containerEl.appendChild(blk);
        continue;
      }

      const blk = this._makeBlockEl('p');
      this._populateInlineNodes(blk, line);
      containerEl.appendChild(blk);
    }

    this._normalizeBlockContainer(containerEl);
  }

  setValue(markup = '') {
    if (!this.el) return;
    this._suppressInput = true;
    try {
      this._renderMarkupToContainer(this.el, markup);
      this._ensureAtLeastOneBlock();
      this._resetHistory(this.getValue());
    } finally {
      this._suppressInput = false;
      this.onChange(this.getValue());
    }
  }

  _populateInlineNodes(container, rawInline) {
    container.innerHTML = '';
    if (!rawInline) {
      container.appendChild(document.createElement('br'));
      return;
    }

    const fragment = this._parseInlineFragment(rawInline);
    if (!fragment.firstChild) {
      container.appendChild(document.createElement('br'));
    } else {
      container.appendChild(fragment);
    }
  }

  _parseInlineFragment(rawStr) {
    const frag = document.createDocumentFragment();
    if (!rawStr) return frag;

    const pattern = /(`[^`\n]+?`|\[[^\]\n]+?\]\((?:https?:\/\/|mailto:)[^\s)\n]+\)|==(?:[ygbpov]:)?[^\s=\n](?:[^=\n]*?[^\s=\n])?==|\+\+[^\s+\n](?:[^+\n]*?[^\s+\n])?\+\+|\|\|[^\s|\n](?:[^|\n]*?[^\s|\n])?\|\||\^\^[^\s^\n](?:[^\^\n]*?[^\s^\n])?\^\^|,,[^\s,\n](?:[^,\n]*?[^\s,\n])?,,|\*[^\s*\n](?:[^*\n]*?[^\s*\n])?\*|_[^\s_\n](?:[^_\n]*?[^\s_\n])?_|~[^\s~\n](?:[^~\n]*?[^\s~\n])?~)/;

    let remaining = rawStr;
    while (remaining.length > 0) {
      const m = remaining.match(pattern);
      if (!m) {
        frag.appendChild(document.createTextNode(remaining));
        break;
      }

      const idx = m.index;
      // Check word-boundary for single-char markers (* _ ~)
      const token = m[0];
      if ((token.startsWith('*') || token.startsWith('_') || token.startsWith('~')) && idx > 0) {
        const prevCh = remaining[idx - 1];
        if (!/[\s(\[{.,!?:;>*_~+=|]/.test(prevCh)) {
          frag.appendChild(document.createTextNode(remaining.slice(0, idx + 1)));
          remaining = remaining.slice(idx + 1);
          continue;
        }
      }

      if (idx > 0) {
        frag.appendChild(document.createTextNode(remaining.slice(0, idx)));
      }

      const el = this._tokenToElement(token);
      if (el) {
        frag.appendChild(el);
      } else {
        frag.appendChild(document.createTextNode(token));
      }

      remaining = remaining.slice(idx + token.length);
    }

    return frag;
  }

  _tokenToElement(token) {
    if (token.startsWith('`') && token.endsWith('`')) {
      const code = document.createElement('code');
      code.className = 'chat-inline-code';
      code.textContent = token.slice(1, -1);
      return code;
    }

    if (token.startsWith('[')) {
      const lm = token.match(/^\[([^\]\n]+?)\]\(([^\s)\n]+)\)$/);
      if (lm) {
        const safe = sanitizeUrl(lm[2]);
        if (safe) {
          const a = document.createElement('a');
          a.className = 'chat-link chat-word-link';
          a.href = safe;
          a.dataset.href = safe;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.appendChild(this._parseInlineFragment(lm[1]));
          return a;
        }
      }
      return null;
    }

    if (token.startsWith('==') && token.endsWith('==')) {
      const inner = token.slice(2, -2);
      const cm = inner.match(/^([ygbpov]):(.*)$/);
      const colorCode = cm ? cm[1] : 'y';
      const body = cm ? cm[2] : inner;
      const colorDef = HIGHLIGHT_COLORS[colorCode] || HIGHLIGHT_COLORS.y;
      const mark = document.createElement('mark');
      mark.className = `wa-hl wa-hl-${colorDef.name}`;
      mark.dataset.hlColor = colorCode;
      mark.appendChild(this._parseInlineFragment(body));
      return mark;
    }

    if (token.startsWith('++') && token.endsWith('++')) {
      const u = document.createElement('u');
      u.className = 'wa-underline';
      u.appendChild(this._parseInlineFragment(token.slice(2, -2)));
      return u;
    }

    if (token.startsWith('||') && token.endsWith('||')) {
      const span = document.createElement('span');
      span.className = 'wa-spoiler rc-spoiler-edit';
      span.dataset.fmt = 'spoiler';
      span.appendChild(this._parseInlineFragment(token.slice(2, -2)));
      return span;
    }

    if (token.startsWith('^^') && token.endsWith('^^')) {
      const sup = document.createElement('sup');
      sup.className = 'wa-sup';
      sup.appendChild(this._parseInlineFragment(token.slice(2, -2)));
      return sup;
    }

    if (token.startsWith(',,') && token.endsWith(',,')) {
      const sub = document.createElement('sub');
      sub.className = 'wa-sub';
      sub.appendChild(this._parseInlineFragment(token.slice(2, -2)));
      return sub;
    }

    if (token.startsWith('*') && token.endsWith('*')) {
      const strong = document.createElement('strong');
      strong.appendChild(this._parseInlineFragment(token.slice(1, -1)));
      return strong;
    }

    if (token.startsWith('_') && token.endsWith('_')) {
      const em = document.createElement('em');
      em.appendChild(this._parseInlineFragment(token.slice(1, -1)));
      return em;
    }

    if (token.startsWith('~') && token.endsWith('~')) {
      const del = document.createElement('del');
      del.appendChild(this._parseInlineFragment(token.slice(1, -1)));
      return del;
    }

    return null;
  }

  // --- Live Shortcut Auto-Conversion ---
  _handleInput() {
    this._ensureAtLeastOneBlock();
    this._tryAutoFormatAtCaret();
    this._ensureAtLeastOneBlock();
    this._pushHistory();
    this._saveSelection();
    const val = this.getValue();
    this.onChange(val);
    this.onSelectionChange(this.getActiveFormats());
  }

  _tryAutoFormatAtCaret() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (!node || node.nodeType !== 3 || !this.el.contains(node)) return;

    const blockEl = this._getBlockElement(node);
    if (!blockEl || blockEl.dataset.block === 'codeblock') return;

    // Skip if caret is inside inline code
    if (node.parentNode?.closest?.('code')) return;

    const foldTitleEl = this._getFoldTitleEl(node);
    const insideFold = Boolean(this._getEnclosingFold(node));
    const bodyEl = foldTitleEl || this._getBlockBodyEl(blockEl);
    const text = node.nodeValue || '';
    const offset = range.startOffset;

    // 1. Block prefix shortcuts when typing in a plain block (skip inside fold title)
    if (!foldTitleEl && blockEl.dataset.block === 'p' && bodyEl.firstChild === node) {
      const prefix = text.slice(0, offset);

      // Live Fold shortcuts: >>> + Space OR [fold:Title] + Space (top-level only)
      if (!insideFold) {
        const foldShortcutMatch =
          prefix.match(/^(>>>)[ \u00A0]$/) ||
          prefix.match(/^\[fold:([^\]\n]+)\][ \u00A0]$/);
        if (foldShortcutMatch) {
          const isBracketForm = foldShortcutMatch[0].startsWith('[');
          const restInNode = text.slice(offset);
          const foldTitle = isBracketForm ? foldShortcutMatch[1].trim() : restInNode.trim();
          const foldBodyMarkup = isBracketForm ? restInNode : '';
          const foldEl = this._makeBlockEl('fold', {
            title: foldTitle,
            bodyMarkup: foldBodyMarkup,
            open: true
          });
          blockEl.replaceWith(foldEl);
          if (!foldEl.nextElementSibling) {
            foldEl.after(this._makeBlockEl('p'));
          }
          if (isBracketForm) {
            const firstBodyBlk = foldEl.querySelector(':scope > .rc-fold-body > .rc-block') || foldEl;
            const target = this._getBlockBodyEl(firstBodyBlk);
            this._placeCaretAtStart(target.firstChild || target);
          } else {
            const tEl = foldEl.querySelector(':scope > .rc-fold-header > .rc-fold-title');
            this._placeCaretAtStart(tEl?.firstChild || tEl);
          }
          this._syncOrderedNumbers();
          return;
        }
      }

      const blockMatch =
        prefix.match(/^(#{1,3})[ \u00A0]$/) ||
        prefix.match(/^(\[[ \u00A0]?\]|\[[xX]\])[ \u00A0]$/) ||
        prefix.match(/^([-*]|->|=>|→|↳|\\>|\|->)[ \u00A0]$/) ||
        prefix.match(/^(\d+\.)[ \u00A0]$/) ||
        prefix.match(/^(>)[ \u00A0]$/) ||
        prefix.match(/^(```)$/);

      if (blockMatch) {
        const trigger = blockMatch[1];
        const restInNode = text.slice(offset);
        const remainingNodes = Array.from(bodyEl.childNodes).slice(1);

        let newBlockType = 'p';
        let opts = {};
        if (trigger === '#') newBlockType = 'h1';
        else if (trigger === '##') newBlockType = 'h2';
        else if (trigger === '###') newBlockType = 'h3';
        else if (trigger === '>') newBlockType = 'quote';
        else if (trigger === '-' || trigger === '*') {
          newBlockType = 'ul';
          opts.bulletType = 'bullet';
          this._lastBulletType = 'bullet';
        } else if (trigger === '->' || trigger === '=>' || trigger === '→') {
          newBlockType = 'ul';
          opts.bulletType = 'arrow';
          this._lastBulletType = 'arrow';
        } else if (trigger === '↳' || trigger === '\\>' || trigger === '|->') {
          newBlockType = 'ul';
          opts.bulletType = 'branch';
          this._lastBulletType = 'branch';
        } else if (/^\d+\.$/.test(trigger)) newBlockType = 'ol';
        else if (/^\[[ \u00A0xX]?\]$/.test(trigger)) {
          newBlockType = 'check';
          opts.checked = trigger.toLowerCase() === '[x]';
        } else if (trigger === '```') {
          newBlockType = 'codeblock';
        }

        const newBlock = this._makeBlockEl(newBlockType, opts);
        const targetBody = this._getBlockBodyEl(newBlock);
        targetBody.innerHTML = '';

        const firstTextNode = document.createTextNode(restInNode || '');
        if (newBlockType === 'codeblock') {
          targetBody.textContent = restInNode || '';
          blockEl.replaceWith(newBlock);
          this._placeCaretAtStart(targetBody.firstChild || targetBody);
          return;
        }

        targetBody.appendChild(firstTextNode);
        for (const extra of remainingNodes) {
          if (extra.nodeType === 1 && extra.tagName === 'BR') continue;
          targetBody.appendChild(extra);
        }
        if (!firstTextNode.nodeValue && targetBody.childNodes.length === 1) {
          targetBody.appendChild(document.createElement('br'));
        }

        blockEl.replaceWith(newBlock);
        this._syncOrderedNumbers();
        this._placeCaretAtStart(firstTextNode);
        return;
      }
    }

    // 2. Inline paired shortcuts up to caret
    const before = text.slice(0, offset);
    const after = text.slice(offset);

    const inlineRules = [
      {
        regex: /\[([^\]\n]+?)\]\(((?:https?:\/\/|mailto:)[^\s)\n]+)\)$/,
        build: (m) => {
          const safe = sanitizeUrl(m[2]);
          if (!safe) return null;
          const a = document.createElement('a');
          a.className = 'chat-link chat-word-link';
          a.href = safe;
          a.dataset.href = safe;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = m[1];
          return { el: a, keepPrefix: '' };
        }
      },
      {
        regex: /==(?:([ygbpov]):)?([^\s=\n](?:[^=\n]*?[^\s=\n])?)==$/,
        build: (m) => {
          const code = m[1] || 'y';
          const colorDef = HIGHLIGHT_COLORS[code] || HIGHLIGHT_COLORS.y;
          const mark = document.createElement('mark');
          mark.className = `wa-hl wa-hl-${colorDef.name}`;
          mark.dataset.hlColor = code;
          mark.textContent = m[2];
          return { el: mark, keepPrefix: '' };
        }
      },
      {
        regex: /\+\+([^\s+\n](?:[^+\n]*?[^\s+\n])?)\+\+$/,
        build: (m) => {
          const u = document.createElement('u');
          u.className = 'wa-underline';
          u.textContent = m[1];
          return { el: u, keepPrefix: '' };
        }
      },
      {
        regex: /\|\|([^\s|\n](?:[^|\n]*?[^\s|\n])?)\|\|$/,
        build: (m) => {
          const span = document.createElement('span');
          span.className = 'wa-spoiler rc-spoiler-edit';
          span.dataset.fmt = 'spoiler';
          span.textContent = m[1];
          return { el: span, keepPrefix: '' };
        }
      },
      {
        regex: /\^\^([^\s^\n](?:[^\^\n]*?[^\s^\n])?)\^\^$/,
        build: (m) => {
          const sup = document.createElement('sup');
          sup.className = 'wa-sup';
          sup.textContent = m[1];
          return { el: sup, keepPrefix: '' };
        }
      },
      {
        regex: /,,([^\s,\n](?:[^,\n]*?[^\s,\n])?),,$/,
        build: (m) => {
          const sub = document.createElement('sub');
          sub.className = 'wa-sub';
          sub.textContent = m[1];
          return { el: sub, keepPrefix: '' };
        }
      },
      {
        regex: /`([^`\n]+?)`$/,
        build: (m) => {
          const code = document.createElement('code');
          code.className = 'chat-inline-code';
          code.textContent = m[1];
          return { el: code, keepPrefix: '' };
        }
      },
      {
        regex: /(^|[\s(\[{.,!?:;>])\*([^\s*\n](?:[^*\n]*?[^\s*\n])?)\*$/,
        build: (m) => {
          const strong = document.createElement('strong');
          strong.textContent = m[2];
          return { el: strong, keepPrefix: m[1] || '' };
        }
      },
      {
        regex: /(^|[\s(\[{.,!?:;>])_([^\s_\n](?:[^_\n]*?[^\s_\n])?)_$/,
        build: (m) => {
          const em = document.createElement('em');
          em.textContent = m[2];
          return { el: em, keepPrefix: m[1] || '' };
        }
      },
      {
        regex: /(^|[\s(\[{.,!?:;>])~([^\s~\n](?:[^~\n]*?[^\s~\n])?)~$/,
        build: (m) => {
          const del = document.createElement('del');
          del.textContent = m[2];
          return { el: del, keepPrefix: m[1] || '' };
        }
      }
    ];

    for (const rule of inlineRules) {
      const m = before.match(rule.regex);
      if (!m) continue;
      const built = rule.build(m);
      if (!built) continue;

      const leadLen = before.length - m[0].length;
      const beforeLeadText = before.slice(0, leadLen) + built.keepPrefix;
      const parent = node.parentNode;

      const frag = document.createDocumentFragment();
      if (beforeLeadText) {
        frag.appendChild(document.createTextNode(beforeLeadText));
      }
      frag.appendChild(built.el);

      const exitNode = document.createTextNode(after ? after : '\u200B');
      frag.appendChild(exitNode);

      parent.replaceChild(frag, node);

      const newRange = document.createRange();
      newRange.setStart(exitNode, after ? 0 : 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return;
    }
  }

  // --- Keyboard Behavior (Lists, Checklists, Headings, Indent, Undo/Redo) ---
  _handleKeyDown(e) {
    // Ctrl/Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        this.redo();
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        this.toggleInline('bold');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        this.toggleInline('italic');
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        this.toggleInline('underline');
        return;
      }
    }

    const sel = window.getSelection();
    const anchorNode = (sel && sel.rangeCount) ? sel.getRangeAt(0).startContainer : null;
    const blockEl = anchorNode ? this._getBlockElement(anchorNode) : null;
    const enclosingFold = anchorNode ? this._getEnclosingFold(anchorNode) : null;
    const foldTitleEl = anchorNode ? this._getFoldTitleEl(anchorNode) : null;

    // Tab / Shift+Tab indents lists and checklists
    if (e.key === 'Tab' && blockEl) {
      const bType = blockEl.dataset?.block;
      if (bType === 'ul' || bType === 'ol' || bType === 'check') {
        e.preventDefault();
        this.indent(e.shiftKey ? -1 : 1);
        return;
      }
    }

    // Enter handling for custom blocks & live Fold blocks
    if (e.key === 'Enter' && !e.shiftKey && blockEl) {
      const bType = blockEl.dataset?.block;
      if (bType === 'codeblock') {
        return; // Allow newlines natively inside code block
      }

      // Enter inside fold title moves caret cleanly into fold body
      if (foldTitleEl && enclosingFold) {
        e.preventDefault();
        enclosingFold.dataset.open = 'true';
        const toggleGlyph = enclosingFold.querySelector(':scope > .rc-fold-header > .rc-fold-toggle');
        if (toggleGlyph) toggleGlyph.textContent = '▼';
        const foldBody = enclosingFold.querySelector(':scope > .rc-fold-body');
        this._normalizeBlockContainer(foldBody);
        const firstBlk = foldBody?.firstElementChild;
        const firstTarget = this._getBlockBodyEl(firstBlk) || foldBody;
        this._placeCaretAtStart(firstTarget?.firstChild || firstTarget);
        this.onSelectionChange(this.getActiveFormats());
        return;
      }

      // Enter on a raw `[fold:Title]` line converts immediately into a live Fold card
      if (!enclosingFold && bType === 'p') {
        const plainLine = this._serializeChildren(blockEl).replace(/\u200B/g, '').replace(/\u00A0/g, ' ').trim();
        const rawFoldLine = plainLine.match(/^\[fold:([^\]\n]+)\]$/);
        if (rawFoldLine) {
          e.preventDefault();
          const foldEl = this._makeBlockEl('fold', { title: rawFoldLine[1].trim(), open: true });
          blockEl.replaceWith(foldEl);
          if (!foldEl.nextElementSibling) {
            foldEl.after(this._makeBlockEl('p'));
          }
          const firstBlk = foldEl.querySelector(':scope > .rc-fold-body > .rc-block') || foldEl;
          const target = this._getBlockBodyEl(firstBlk);
          this._placeCaretAtStart(target.firstChild || target);
          this._syncOrderedNumbers();
          this._pushHistory();
          this.onChange(this.getValue());
          this.onSelectionChange(this.getActiveFormats());
          return;
        }
      }

      // Enter on a `.rc-p` paragraph inside `.rc-fold-body` keeps paragraphs cleanly scoped or exits after trailing blank line
      if (enclosingFold && bType === 'p' && blockEl.parentNode?.classList?.contains('rc-fold-body')) {
        e.preventDefault();
        const foldBody = blockEl.parentNode;
        const cleanText = this._serializeChildren(blockEl).replace(/\u200B/g, '').trim();
        if (!cleanText && foldBody.children.length > 1 && blockEl === foldBody.lastElementChild) {
          blockEl.remove();
          let outsideP = enclosingFold.nextElementSibling;
          const isOutsideEmptyP = outsideP && outsideP.dataset?.block === 'p' && !this._serializeChildren(outsideP).replace(/\u200B/g, '').trim();
          if (!isOutsideEmptyP) {
            outsideP = this._makeBlockEl('p');
            enclosingFold.after(outsideP);
          }
          this._placeCaretAtStart(outsideP.firstChild || outsideP);
          this._pushHistory();
          this.onChange(this.getValue());
          this.onSelectionChange(this.getActiveFormats());
          return;
        }

        let tailFrag = null;
        if (sel && sel.rangeCount) {
          const curRange = sel.getRangeAt(0);
          if (!curRange.collapsed && blockEl.contains(curRange.commonAncestorContainer)) {
            curRange.deleteContents();
          }
          if (blockEl.contains(curRange.endContainer)) {
            const tailRange = document.createRange();
            tailRange.selectNodeContents(blockEl);
            tailRange.setStart(curRange.endContainer, curRange.endOffset);
            tailFrag = tailRange.extractContents();
          }
        }
        const hasBodyContent = Array.from(blockEl.childNodes).some((n) =>
          (n.nodeType === 1 && n.tagName !== 'BR') ||
          (n.nodeType === 3 && n.nodeValue.replace(/\u200B/g, '').length > 0)
        );
        if (!hasBodyContent) {
          blockEl.innerHTML = '';
          blockEl.appendChild(document.createElement('br'));
        }
        const nextP = this._makeBlockEl('p');
        const hasTailContent = Boolean(
          tailFrag &&
          Array.from(tailFrag.childNodes).some((n) =>
            (n.nodeType === 1 && n.tagName !== 'BR') ||
            (n.nodeType === 3 && n.nodeValue.replace(/\u200B/g, '').length > 0)
          )
        );
        if (hasTailContent) {
          Array.from(tailFrag.childNodes).forEach((n) => {
            if (n.nodeType === 1 && n.tagName === 'BR') n.remove();
          });
          nextP.innerHTML = '';
          nextP.appendChild(tailFrag);
        }
        blockEl.after(nextP);
        this._placeCaretAtStart(nextP.firstChild || nextP);
        this._pushHistory();
        this.onChange(this.getValue());
        this.onSelectionChange(this.getActiveFormats());
        return;
      }

      if (bType === 'ul' || bType === 'ol' || bType === 'check' || bType === 'h1' || bType === 'h2' || bType === 'h3' || bType === 'quote') {
        e.preventDefault();
        const body = this._getBlockBodyEl(blockEl);
        const cleanText = this._serializeChildren(body).replace(/\u200B/g, '').trim();

        // Empty list/quote item exits back to normal paragraph
        if (!cleanText && (bType === 'ul' || bType === 'ol' || bType === 'check' || bType === 'quote')) {
          const p = this._makeBlockEl('p');
          blockEl.replaceWith(p);
          this._syncOrderedNumbers();
          this._placeCaretAtStart(p);
          this._pushHistory();
          this.onChange(this.getValue());
          this.onSelectionChange(this.getActiveFormats());
          return;
        }

        let tailFrag = null;
        if (sel && sel.rangeCount) {
          const curRange = sel.getRangeAt(0);
          if (!curRange.collapsed && body.contains(curRange.commonAncestorContainer)) {
            curRange.deleteContents();
          }
          if (body.contains(curRange.endContainer)) {
            const tailRange = document.createRange();
            tailRange.selectNodeContents(body);
            tailRange.setStart(curRange.endContainer, curRange.endOffset);
            tailFrag = tailRange.extractContents();
          }
        }

        const hasBodyContent = Array.from(body.childNodes).some((n) =>
          (n.nodeType === 1 && n.tagName !== 'BR') ||
          (n.nodeType === 3 && n.nodeValue.replace(/\u200B/g, '').length > 0)
        );
        if (!hasBodyContent) {
          body.innerHTML = '';
          body.appendChild(document.createElement('br'));
        }

        const nextType = (bType === 'ul' || bType === 'ol' || bType === 'check') ? bType : 'p';
        const indent = Number(blockEl.dataset.indent || 0);
        const bulletType = bType === 'ul' ? (blockEl.dataset.bulletType || this._lastBulletType || 'bullet') : undefined;
        const nextBlock = this._makeBlockEl(nextType, { indent, checked: false, bulletType });
        const nextBody = this._getBlockBodyEl(nextBlock);

        const hasTailContent = Boolean(
          tailFrag &&
          Array.from(tailFrag.childNodes).some((n) =>
            (n.nodeType === 1 && n.tagName !== 'BR') ||
            (n.nodeType === 3 && n.nodeValue.replace(/\u200B/g, '').length > 0)
          )
        );
        if (hasTailContent) {
          Array.from(tailFrag.childNodes).forEach((n) => {
            if (n.nodeType === 1 && n.tagName === 'BR') n.remove();
          });
          nextBody.innerHTML = '';
          nextBody.appendChild(tailFrag);
        }

        blockEl.after(nextBlock);
        this._syncOrderedNumbers();
        this._placeCaretAtStart(nextBody);
        this._pushHistory();
        this.onChange(this.getValue());
        this.onSelectionChange(this.getActiveFormats());
        return;
      }
    }

    // Backspace inside fold title / first fold body block or offset 0 of a formatted block
    if (e.key === 'Backspace' && sel && sel.rangeCount && sel.isCollapsed && blockEl) {
      const range = sel.getRangeAt(0);
      if (foldTitleEl && enclosingFold && this._isCaretAtStartOf(range, foldTitleEl)) {
        const bodyContent = this._serializeBlockContainer(enclosingFold.querySelector(':scope > .rc-fold-body')).trim();
        if (!bodyContent) {
          e.preventDefault();
          this._unwrapFoldBlock(enclosingFold);
        }
        return;
      }

      if (enclosingFold && blockEl.parentNode?.classList?.contains('rc-fold-body') && blockEl === blockEl.parentNode.firstElementChild) {
        const innerBody = this._getBlockBodyEl(blockEl);
        if (blockEl.dataset?.block === 'p' && this._isCaretAtStartOf(range, innerBody)) {
          e.preventDefault();
          const titleTarget = enclosingFold.querySelector(':scope > .rc-fold-header > .rc-fold-title');
          if (titleTarget) this._placeCaretAtEnd(titleTarget);
          this.onSelectionChange(this.getActiveFormats());
          return;
        }
      }

      const bType = blockEl.dataset?.block;
      if (bType && bType !== 'p' && bType !== 'fold') {
        const body = this._getBlockBodyEl(blockEl);
        const atStart = this._isCaretAtStartOf(range, body);
        if (atStart) {
          e.preventDefault();
          const curIndent = Number(blockEl.dataset.indent || 0);
          if ((bType === 'ul' || bType === 'ol' || bType === 'check') && curIndent > 0) {
            blockEl.dataset.indent = String(curIndent - 1);
            this._syncOrderedNumbers();
          } else {
            const p = this._makeBlockEl('p');
            p.innerHTML = '';
            while (body.firstChild) {
              const ch = body.firstChild;
              if (ch.nodeType === 1 && ch.getAttribute('contenteditable') === 'false') {
                ch.remove();
              } else {
                p.appendChild(ch);
              }
            }
            if (!p.firstChild) p.appendChild(document.createElement('br'));
            blockEl.replaceWith(p);
            this._syncOrderedNumbers();
            this._placeCaretAtStart(p.firstChild || p);
          }
          this._pushHistory();
          this.onChange(this.getValue());
          this.onSelectionChange(this.getActiveFormats());
        }
      }
    }
  }

  _isCaretAtStartOf(range, container) {
    if (!container || !container.contains(range.startContainer)) return false;
    const probe = document.createRange();
    probe.selectNodeContents(container);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().replace(/\u200B/g, '').length === 0;
  }

  _handlePaste(e) {
    e.preventDefault();
    const plain = e.clipboardData?.getData('text/plain') || '';
    if (!plain) return;
    this.insertText(plain);
  }

  insertText(text) {
    if (!text) return;
    this.restoreSelection();
    const normalized = String(text).replace(/\r\n?/g, '\n');

    if (normalized.includes('\n')) {
      // Multi-line paste/insert hydrates cleanly using canonical markup if formatted lines exist
      const beforeVal = this.getValue();
      if (!beforeVal) {
        this.setValue(normalized);
        return;
      }
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(normalized);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    this._handleInput();
  }

  // --- Toolbar Commands ---
  _createInlineTag(type, param = null) {
    if (type === 'bold') return document.createElement('strong');
    if (type === 'italic') return document.createElement('em');
    if (type === 'strike') return document.createElement('del');
    if (type === 'underline') {
      const el = document.createElement('u');
      el.className = 'wa-underline';
      return el;
    }
    if (type === 'code') {
      const el = document.createElement('code');
      el.className = 'chat-inline-code';
      return el;
    }
    if (type === 'spoiler') {
      const el = document.createElement('span');
      el.className = 'wa-spoiler rc-spoiler-edit';
      el.dataset.fmt = 'spoiler';
      return el;
    }
    if (type === 'sup') {
      const el = document.createElement('sup');
      el.className = 'wa-sup';
      return el;
    }
    if (type === 'sub') {
      const el = document.createElement('sub');
      el.className = 'wa-sub';
      return el;
    }
    if (type === 'highlight') {
      const code = param && HIGHLIGHT_COLORS[param] ? param : 'y';
      const colorDef = HIGHLIGHT_COLORS[code];
      const el = document.createElement('mark');
      el.className = `wa-hl wa-hl-${colorDef.name}`;
      el.dataset.hlColor = code;
      return el;
    }
    return null;
  }

  _matchesInlineType(el, type) {
    if (!el || el.nodeType !== 1) return false;
    const t = el.tagName;
    if (type === 'bold') return t === 'STRONG' || t === 'B';
    if (type === 'italic') return t === 'EM' || t === 'I';
    if (type === 'strike') return t === 'DEL' || t === 'S';
    if (type === 'underline') return t === 'U' || el.dataset?.fmt === 'underline';
    if (type === 'code') return t === 'CODE';
    if (type === 'spoiler') return el.dataset?.fmt === 'spoiler' || el.classList?.contains('wa-spoiler');
    if (type === 'sup') return t === 'SUP';
    if (type === 'sub') return t === 'SUB';
    if (type === 'highlight') return t === 'MARK';
    return false;
  }

  toggleInline(type, param = null) {
    this.restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!this.el.contains(range.commonAncestorContainer)) return;

    // 1. Check if caret/selection is already inside matching inline tag -> unwrap or update color
    let ancestor = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentNode;
    let existingTag = null;
    while (ancestor && ancestor !== this.el) {
      if (this._matchesInlineType(ancestor, type)) {
        existingTag = ancestor;
        break;
      }
      ancestor = ancestor.parentNode;
    }

    if (existingTag) {
      if (type === 'highlight' && param) {
        if (param === 'none') {
          this._unwrapElement(existingTag);
        } else if (existingTag.dataset.hlColor !== param) {
          const colorDef = HIGHLIGHT_COLORS[param] || HIGHLIGHT_COLORS.y;
          existingTag.className = `wa-hl wa-hl-${colorDef.name}`;
          existingTag.dataset.hlColor = param;
        } else {
          this._unwrapElement(existingTag);
        }
      } else {
        this._unwrapElement(existingTag);
      }
      this._pushHistory();
      this.onChange(this.getValue());
      this.onSelectionChange(this.getActiveFormats());
      return;
    }

    if (type === 'highlight' && param === 'none') return;

    // 2. Wrap selected text (or entire line/block if collapsed)
    const wrapper = this._createInlineTag(type, param);
    if (!wrapper) return;

    if (range.collapsed) {
      const foldTitleEl = this._getFoldTitleEl(range.startContainer);
      const blockEl = this._getBlockElement(range.startContainer);
      const bodyEl = foldTitleEl || (blockEl?.dataset?.block === 'fold' ? null : this._getBlockBodyEl(blockEl));
      const textLen = (bodyEl?.textContent || '').replace(/\u200B/g, '').trim().length;
      if (bodyEl && textLen > 0) {
        range.selectNodeContents(bodyEl);
        if (bodyEl.lastChild && bodyEl.lastChild.nodeName === 'BR') {
          range.setEndBefore(bodyEl.lastChild);
        }
        const contents = range.extractContents();
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
        const r = document.createRange();
        r.selectNodeContents(wrapper);
        sel.removeAllRanges();
        sel.addRange(r);
      } else {
        const innerText = document.createTextNode('text');
        wrapper.appendChild(innerText);
        range.insertNode(wrapper);
        const trail = document.createTextNode('\u200B');
        wrapper.after(trail);
        const r = document.createRange();
        r.selectNodeContents(wrapper);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    } else {
      const contents = range.extractContents();
      wrapper.appendChild(contents);
      range.insertNode(wrapper);
      const r = document.createRange();
      r.selectNodeContents(wrapper);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    this._pushHistory();
    this.onChange(this.getValue());
    this.onSelectionChange(this.getActiveFormats());
  }

  _unwrapElement(el) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
  }

  _unwrapFoldBlock(foldEl) {
    if (!foldEl || !foldEl.parentNode) return;
    const titleEl = foldEl.querySelector(':scope > .rc-fold-header > .rc-fold-title');
    const bodyEl = foldEl.querySelector(':scope > .rc-fold-body');
    const rawTitle = titleEl
      ? this._serializeChildren(titleEl).replace(/\u200B/g, '').replace(/\u00A0/g, ' ').trim()
      : '';

    const parent = foldEl.parentNode;
    let firstInserted = null;

    if (rawTitle) {
      const tp = this._makeBlockEl('p');
      this._populateInlineNodes(tp, rawTitle);
      parent.insertBefore(tp, foldEl);
      if (!firstInserted) firstInserted = tp;
    }

    if (bodyEl) {
      const bodyBlocks = Array.from(bodyEl.querySelectorAll(':scope > .rc-block'));
      for (const blk of bodyBlocks) {
        const blkText = this._serializeBlockContainer({ childNodes: [blk] }).trim();
        if (!blkText && (rawTitle || bodyBlocks.length > 1)) continue;
        parent.insertBefore(blk, foldEl);
        if (!firstInserted) firstInserted = blk;
      }
    }

    if (!firstInserted) {
      firstInserted = this._makeBlockEl('p');
      parent.insertBefore(firstInserted, foldEl);
    }

    foldEl.remove();
    this._ensureAtLeastOneBlock();
    const targetBody = this._getBlockBodyEl(firstInserted);
    this._placeCaretAtStart(targetBody?.firstChild || targetBody);
    this._pushHistory();
    this.onChange(this.getValue());
    this.onSelectionChange(this.getActiveFormats());
  }

  toggleBlock(blockType, options = {}) {
    this.restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const startNode = sel.getRangeAt(0).startContainer;
    if (this._getFoldTitleEl(startNode)) return;
    const blockEl = this._getBlockElement(startNode) || this.el.firstElementChild;
    if (!blockEl || blockEl.dataset?.block === 'fold') return;

    const currentType = blockEl.dataset?.block || 'p';
    const currentShape = blockEl.dataset?.bulletType || 'bullet';
    let nextType = currentType;
    let bulletType = options.bulletType || this._lastBulletType || 'bullet';

    if (blockType === 'ul') {
      if (options.bulletType) this._lastBulletType = options.bulletType;
      if (currentType === 'ul' && (!options.bulletType || currentShape === options.bulletType)) {
        nextType = 'p';
      } else {
        nextType = 'ul';
      }
    } else {
      nextType = currentType === blockType ? 'p' : blockType;
    }

    const indent = (nextType === 'ul' || nextType === 'ol' || nextType === 'check')
      ? Number(blockEl.dataset?.indent || 0)
      : 0;

    const oldBody = this._getBlockBodyEl(blockEl);
    const replacement = this._makeBlockEl(nextType, { indent, checked: false, bulletType });
    const newBody = this._getBlockBodyEl(replacement);
    newBody.innerHTML = '';

    if (nextType === 'codeblock') {
      newBody.textContent = this._serializeChildren(oldBody).replace(/\u200B/g, '');
    } else {
      while (oldBody.firstChild) {
        const ch = oldBody.firstChild;
        if (ch.nodeType === 1 && ch.getAttribute('contenteditable') === 'false') {
          ch.remove();
        } else {
          newBody.appendChild(ch);
        }
      }
      if (!newBody.firstChild) newBody.appendChild(document.createElement('br'));
    }

    blockEl.replaceWith(replacement);
    this._syncOrderedNumbers();
    this._placeCaretAtEnd(newBody);
    this._pushHistory();
    this.onChange(this.getValue());
    this.onSelectionChange(this.getActiveFormats());
  }

  indent(delta = 1) {
    this.restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const blockEl = this._getBlockElement(sel.getRangeAt(0).startContainer);
    if (!blockEl || blockEl.dataset?.block === 'fold') return;
    const bType = blockEl.dataset?.block;
    if (bType !== 'ul' && bType !== 'ol' && bType !== 'check') {
      if (delta > 0) this.toggleBlock('ul', { bulletType: this._lastBulletType });
      return;
    }
    const cur = Number(blockEl.dataset.indent || 0);
    const next = Math.max(0, Math.min(3, cur + delta));
    blockEl.dataset.indent = String(next);
    this._syncOrderedNumbers();
    this._pushHistory();
    this.onChange(this.getValue());
    this.onSelectionChange(this.getActiveFormats());
  }

  getSelectedText() {
    this.restoreSelection();
    const sel = window.getSelection();
    return sel ? sel.toString().replace(/\u200B/g, '').trim() : '';
  }

  insertWordLink(label, rawUrl) {
    const safeUrl = sanitizeUrl(rawUrl);
    if (!safeUrl) return false;
    const visibleLabel = (label || '').trim() || safeUrl;

    this.restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!this.el.contains(range.commonAncestorContainer)) return false;

    range.deleteContents();
    const a = document.createElement('a');
    a.className = 'chat-link chat-word-link';
    a.href = safeUrl;
    a.dataset.href = safeUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = visibleLabel;
    range.insertNode(a);

    const trail = document.createTextNode('\u200B ');
    a.after(trail);
    const nextRange = document.createRange();
    nextRange.setStart(trail, trail.nodeValue.length);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);

    this._ensureAtLeastOneBlock();
    this._pushHistory();
    this.onChange(this.getValue());
    this.onSelectionChange(this.getActiveFormats());
    return true;
  }

  insertFoldBlock(title = '') {
    this.restoreSelection();
    const sel = window.getSelection();
    const range = (sel && sel.rangeCount) ? sel.getRangeAt(0) : null;
    const anchorNode = range ? range.startContainer : null;
    const existingFold = anchorNode ? this._getEnclosingFold(anchorNode) : null;

    if (existingFold) {
      const existingTitleEl = existingFold.querySelector(':scope > .rc-fold-header > .rc-fold-title');
      const existingBodyEl = existingFold.querySelector(':scope > .rc-fold-body');
      const hasContent = Boolean(
        this._serializeChildren(existingTitleEl).replace(/\u200B/g, '').trim() ||
        this._serializeBlockContainer(existingBodyEl).trim()
      );
      if (!hasContent) {
        this._unwrapFoldBlock(existingFold);
        return;
      }
    }

    let initialBodyMarkup = '';
    let anchorBlock = anchorNode ? this._getBlockElement(anchorNode) : null;
    if (existingFold) anchorBlock = existingFold;

    if (range && !range.collapsed && this.el.contains(range.commonAncestorContainer)) {
      const selected = range.toString().replace(/\u200B/g, '').trim();
      if (selected) {
        initialBodyMarkup = selected;
        range.deleteContents();
      }
    } else if (anchorBlock && anchorBlock.dataset?.block === 'p' && !existingFold) {
      const currentLine = this._serializeChildren(anchorBlock).replace(/\u200B/g, '').trim();
      if (currentLine) {
        initialBodyMarkup = currentLine;
      }
    }

    const foldEl = this._makeBlockEl('fold', {
      title: (title || '').trim(),
      bodyMarkup: initialBodyMarkup,
      open: true
    });

    if (anchorBlock && this.el.contains(anchorBlock)) {
      const anchorIsEmptyP = anchorBlock.dataset?.block === 'p' &&
        !this._serializeChildren(anchorBlock).replace(/\u200B/g, '').trim();
      if (anchorIsEmptyP || (!existingFold && anchorBlock.dataset?.block === 'p' && initialBodyMarkup)) {
        anchorBlock.replaceWith(foldEl);
      } else {
        anchorBlock.after(foldEl);
      }
    } else {
      this.el.appendChild(foldEl);
    }

    // Always keep a tappable trailing paragraph below a bottom fold so user can type outside
    if (!foldEl.nextElementSibling) {
      foldEl.after(this._makeBlockEl('p'));
    }

    if ((title || '').trim()) {
      const firstBlk = foldEl.querySelector(':scope > .rc-fold-body > .rc-block') || foldEl;
      const bodyTarget = this._getBlockBodyEl(firstBlk);
      this._placeCaretAtStart(bodyTarget?.firstChild || bodyTarget);
    } else {
      const titleEl = foldEl.querySelector(':scope > .rc-fold-header > .rc-fold-title');
      this._placeCaretAtStart(titleEl?.firstChild || titleEl);
    }

    this._ensureAtLeastOneBlock();
    this._pushHistory();
    this.onChange(this.getValue());
    this.onSelectionChange(this.getActiveFormats());
  }

  clearFormatting() {
    this.restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (range.collapsed) {
      const foldTitleEl = this._getFoldTitleEl(range.startContainer);
      if (foldTitleEl) {
        const plain = (foldTitleEl.textContent || '').replace(/\u200B/g, '');
        foldTitleEl.innerHTML = '';
        foldTitleEl.appendChild(plain ? document.createTextNode(plain) : document.createElement('br'));
        this._placeCaretAtEnd(foldTitleEl);
      } else {
        // Clear formatting on current block/whole line
        const blockEl = this._getBlockElement(range.startContainer);
        if (blockEl && blockEl.dataset?.block !== 'fold') {
          const plain = (this._getBlockBodyEl(blockEl).textContent || '').replace(/\u200B/g, '');
          const p = this._makeBlockEl('p');
          p.innerHTML = '';
          p.appendChild(plain ? document.createTextNode(plain) : document.createElement('br'));
          blockEl.replaceWith(p);
          this._placeCaretAtEnd(p);
        }
      }
    } else {
      const plain = range.toString().replace(/\u200B/g, '');
      range.deleteContents();
      const tn = document.createTextNode(plain);
      range.insertNode(tn);
      range.setStartAfter(tn);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    this._syncOrderedNumbers();
    this._pushHistory();
    this.onChange(this.getValue());
    this.onSelectionChange(this.getActiveFormats());
  }

  getActiveFormats() {
    const active = {
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      code: false,
      highlight: false,
      hlColor: null,
      spoiler: false,
      sup: false,
      sub: false,
      block: 'p'
    };

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return active;
    let node = sel.getRangeAt(0).startContainer;
    if (!this.el.contains(node)) return active;

    while (node && node !== this.el) {
      if (node.nodeType === 1) {
        if (node.classList?.contains('rc-block')) {
          active.block = node.dataset?.block || 'p';
          break;
        }
        if (this._matchesInlineType(node, 'bold')) active.bold = true;
        if (this._matchesInlineType(node, 'italic')) active.italic = true;
        if (this._matchesInlineType(node, 'underline')) active.underline = true;
        if (this._matchesInlineType(node, 'strike')) active.strike = true;
        if (this._matchesInlineType(node, 'code')) active.code = true;
        if (this._matchesInlineType(node, 'spoiler')) active.spoiler = true;
        if (this._matchesInlineType(node, 'sup')) active.sup = true;
        if (this._matchesInlineType(node, 'sub')) active.sub = true;
        if (node.tagName === 'MARK') {
          active.highlight = true;
          active.hlColor = node.dataset?.hlColor || 'y';
        }
      }
      node = node.parentNode;
    }

    return active;
  }

  // --- Undo / Redo Snapshot Stack ---
  _resetHistory(initialVal = '') {
    this._undoStack = [initialVal];
    this._undoIdx = 0;
  }

  _pushHistory() {
    const cur = this.getValue();
    this._syncEmptyState();
    if (this._undoStack[this._undoIdx] === cur) return;
    this._undoStack = this._undoStack.slice(0, this._undoIdx + 1);
    this._undoStack.push(cur);
    if (this._undoStack.length > this._maxHistory) {
      this._undoStack.shift();
    }
    this._undoIdx = this._undoStack.length - 1;
  }

  canUndo() { return this._undoIdx > 0; }
  canRedo() { return this._undoIdx < this._undoStack.length - 1; }

  undo() {
    if (!this.canUndo()) return;
    this._undoIdx--;
    const val = this._undoStack[this._undoIdx];
    this._applySnapshot(val);
  }

  redo() {
    if (!this.canRedo()) return;
    this._undoIdx++;
    const val = this._undoStack[this._undoIdx];
    this._applySnapshot(val);
  }

  _applySnapshot(val) {
    this._suppressInput = true;
    try {
      this._renderMarkupToContainer(this.el, val || '');
      this._ensureAtLeastOneBlock();
      this._placeCaretAtEnd(this.el.lastElementChild || this.el);
      this._syncEmptyState();
    } finally {
      this._suppressInput = false;
      this.onChange(this.getValue());
      this.onSelectionChange(this.getActiveFormats());
    }
  }
}
