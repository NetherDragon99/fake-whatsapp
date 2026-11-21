/**
 * Canonical Rich Text Formatter, Progressive Long-Message Slicer, Interactive Checklists,
 * and Shortcut Reference Registry for WhatsApp Clone PWA.
 */

export const LONG_MESSAGE_INITIAL_CHARS = 450;
export const LONG_MESSAGE_INITIAL_LINES = 10;
export const LONG_MESSAGE_STEP_CHARS = 900;
export const LONG_MESSAGE_STEP_LINES = 18;

export const HIGHLIGHT_COLORS = {
  y: { name: 'yellow', label: 'Yellow', hex: '#fde047' },
  g: { name: 'green', label: 'Green', hex: '#4ade80' },
  b: { name: 'blue', label: 'Blue', hex: '#60a5fa' },
  p: { name: 'pink', label: 'Pink', hex: '#f472b6' },
  o: { name: 'orange', label: 'Orange', hex: '#fb923c' },
  v: { name: 'violet', label: 'Violet', hex: '#c084fc' }
};

export const FORMATTING_SHORTCUTS = [
  {
    id: 'bold',
    category: 'Text Emphasis',
    title: 'Bold (عريض)',
    shortcut: '*text*',
    toolbarLabel: 'B',
    iconName: 'bold',
    toolbarTip: 'Toolbar: Tap B button or wrap text with *asterisks*',
    description: 'Wrap text with single asterisks (non-space edges) to apply live bold formatting.',
    exampleMarkup: 'This is *bold text* inside a message'
  },
  {
    id: 'italic',
    category: 'Text Emphasis',
    title: 'Italic (مائل)',
    shortcut: '_text_',
    toolbarLabel: 'I',
    iconName: 'italic',
    toolbarTip: 'Toolbar: Tap I button or wrap text with _underscores_',
    description: 'Wrap text with underscores (non-space edges) for italic styling.',
    exampleMarkup: 'This is _italic text_ for emphasis'
  },
  {
    id: 'underline',
    category: 'Text Effects',
    title: 'Underline (خط سفلي)',
    shortcut: '++text++',
    toolbarLabel: 'U',
    iconName: 'underline',
    toolbarTip: 'Toolbar: Tap U button or wrap text with ++double plus++',
    description: 'Double plus marks apply underline without colliding with normal punctuation.',
    exampleMarkup: 'Please ++confirm this step++ before sending'
  },
  {
    id: 'strike',
    category: 'Text Emphasis',
    title: 'Strikethrough (مشطوب)',
    shortcut: '~text~',
    toolbarLabel: 'S',
    iconName: 'strike',
    toolbarTip: 'Toolbar: Tap S button or wrap text with ~tildes~',
    description: 'Wrap text with single tildes to strike it through.',
    exampleMarkup: 'Price is ~150~ 120 EGP'
  },
  {
    id: 'highlight-default',
    category: 'Highlights & Effects',
    title: 'Highlight (تظليل بلون)',
    shortcut: '==text== or ==g:text==',
    toolbarLabel: 'Highlight (6 colors)',
    iconName: 'highlight',
    toolbarTip: 'Toolbar: Tap Highlight button to pick from 6 colors, or use ==code:text==',
    description: 'Use ==text== for Yellow, or prefix y:, g:, b:, p:, o:, v: for Yellow, Green, Blue, Pink, Orange, Violet.',
    exampleMarkup: '==Important== · ==g:Approved== · ==b:Info== · ==p:Note== · ==o:Warn== · ==v:Idea=='
  },
  {
    id: 'spoiler',
    category: 'Highlights & Effects',
    title: 'Spoiler (نص مخفي)',
    shortcut: '||text||',
    toolbarLabel: 'Spoiler',
    iconName: 'spoilerEye',
    toolbarTip: 'Toolbar: Tap Spoiler eye button or wrap text with ||double pipes||',
    description: 'Blur sensitive text until tapped (tap preview below to test revealing).',
    exampleMarkup: 'Plot twist: ||Tap here to reveal secret||'
  },
  {
    id: 'sup-sub',
    category: 'Highlights & Effects',
    title: 'Superscript & Subscript',
    shortcut: '^^text^^  /  ,,text,,',
    toolbarLabel: 'x² / x₂',
    iconName: 'formatText',
    toolbarTip: 'Toolbar: Tap x² or x₂ button or use ^^superscript^^ and ,,subscript,,',
    description: 'Unique double carets or double commas raise or lower text cleanly.',
    exampleMarkup: 'E = mc^^2^^ and water is H,,2,,O'
  },
  {
    id: 'inline-code',
    category: 'Code & Quotes',
    title: 'Inline Code (كود)',
    shortcut: '`code`',
    toolbarLabel: 'Code',
    iconName: 'codeBlock',
    toolbarTip: 'Toolbar: Tap Code button or wrap code in `backticks`',
    description: 'Wrap monospace code snippets in backticks.',
    exampleMarkup: 'Run `npm run build` locally'
  },
  {
    id: 'code-block',
    category: 'Code & Quotes',
    title: 'Code Block (مربع كود)',
    shortcut: '``` + Enter',
    toolbarLabel: 'Code Block',
    iconName: 'codeBlock',
    toolbarTip: 'Toolbar: Tap { } code block button or type ``` and press Enter',
    description: 'Start a line with triple backticks for multi-line code blocks.',
    exampleMarkup: '```\nconst version = "2.3.8";\n```'
  },
  {
    id: 'headers',
    category: 'Structure & Lists',
    title: 'Headers H1 / H2 / H3 (عناوين)',
    shortcut: '#  /  ##  /  ###  + Space',
    toolbarLabel: 'H1 / H2 / H3',
    iconName: 'formatText',
    toolbarTip: 'Toolbar: Tap H button to choose H1, H2, or H3, or type #, ##, ### + Space',
    description: 'Type 1 to 3 hashes followed by Space at the start of a line.',
    exampleMarkup: '# Main Title\n## Section Header\n### Subheading'
  },
  {
    id: 'checklist',
    category: 'Structure & Lists',
    title: 'Interactive Checkboxes (مربعات اختيار)',
    shortcut: '[ ]  /  [x]  + Space',
    toolbarLabel: 'Checklist',
    iconName: 'checklist',
    toolbarTip: 'Toolbar: Tap Checklist button or type [ ] + Space (Tab to indent)',
    description: 'Create tappable checklists inside bubbles; tapping saves state without marking Edited.',
    exampleMarkup: '[x] Update engine\n[ ] Review final output\n  [ ] Nested sub-task (Tab)'
  },
  {
    id: 'lists-shapes',
    category: 'Structure & Lists',
    title: 'Unsorted Lists: 3 Shapes (نقطية وأسهم)',
    shortcut: '- (•)  /  -> (→)  /  ↳ (↳) + Space',
    toolbarLabel: '• / → / ↳',
    iconName: 'listBulleted',
    toolbarTip: 'Toolbar: Tap bullet button to pick shape (Thick Bullet •, Arrow →, Branch ↳)',
    description: 'Use - for thick bullet •, -> for arrow →, or ↳ / \\> for branch arrow ↳ (Tab to indent).',
    exampleMarkup: '- Thick bullet item\n  -> Nested arrow sub-item\n  ↳ Branch sub-point'
  },
  {
    id: 'lists-numbered',
    category: 'Structure & Lists',
    title: 'Multi-Tier Numbered Lists (قوائم مرقمة ذكية)',
    shortcut: '1. + Space (Tab to nest)',
    toolbarLabel: '1. 2. 3.',
    iconName: 'listNumbered',
    toolbarTip: 'Toolbar: Tap 1. 2. 3. button or type 1. + Space (Tab to indent nested level)',
    description: 'Nested sorted lists restart numbering cleanly for each branch with connecting guide lines.',
    exampleMarkup: '1. First primary step\n  1. Sub-step one\n  2. Sub-step two\n2. Second primary step'
  },
  {
    id: 'fold',
    category: 'Structure & Lists',
    title: 'Collapsible Block (صندوق قابل للطي والفرد)',
    shortcut: '>>> + Space  /  [fold:Title] + Enter',
    toolbarLabel: 'Fold / Details',
    iconName: 'collapseAll',
    toolbarTip: 'Toolbar: Tap Fold button, or type >>> + Space / [fold:Title] + Enter for a live collapsible block',
    description: 'Creates a tappable accordion box with title header that can be expanded and collapsed directly while composing and inside the chat.',
    exampleMarkup: '[fold:اضغط لعرض التفاصيل المخفية]\nهذا النص قابل للطي والفرد ويحتوي على:\n- بنود مفصلة\n- روابط ومعلومات إضافية\n[/fold]'
  },
  {
    id: 'blockquote',
    category: 'Code & Quotes',
    title: 'Blockquote (اقتباس)',
    shortcut: '>  + Space',
    toolbarLabel: 'Quote',
    iconName: 'quote',
    toolbarTip: 'Toolbar: Tap Quote button or type > + Space at start of line',
    description: 'Start a line with ">" followed by Space to quote a note inside the bubble.',
    exampleMarkup: '> Quoted statement inside this message'
  },
  {
    id: 'word-link',
    category: 'Links & Media',
    title: 'Word Hyperlink (رابط على كلمة)',
    shortcut: '[word](https://...)',
    toolbarLabel: 'Link',
    iconName: 'linkIcon',
    toolbarTip: 'Toolbar: Select word and tap Link button, or type [word](url)',
    description: 'Attach a clickable link directly onto any word or phrase.',
    exampleMarkup: 'Open [Documentation Portal](https://example.com) anytime'
  }
];

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate and normalize a URL to safe web/mail protocols only.
 */
export function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const decoded = rawUrl.trim().replace(/&amp;/g, '&');
  if (!decoded) return null;

  try {
    const parsed = new URL(decoded);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.href;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function escapeAttr(str) {
  return escapeHtml(str);
}

/**
 * Render inline rich formatting on an already HTML-escaped single line.
 */
export function renderInlineFormatting(escapedLine) {
  if (!escapedLine) return '';

  const tokens = [];
  const hold = (html) => {
    const idx = tokens.length;
    tokens.push(html);
    return `\uE000${idx}\uE001`;
  };

  let out = escapedLine;

  // 1. Protect inline code so symbols inside code stay untouched
  out = out.replace(/`([^`\n]+?)`/g, (_m, inner) => {
    return hold(`<code class="chat-inline-code">${inner}</code>`);
  });

  // 2. Protect explicit word hyperlinks: [label](url)
  out = out.replace(/\[([^\]\n]+?)\]\(([^\s)\n]+)\)/g, (full, rawLabel, rawHref) => {
    const safeUrl = sanitizeUrl(rawHref);
    if (!safeUrl) return full;
    const formattedLabel = renderInlineEmphasis(rawLabel);
    return hold(
      `<a href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer" class="chat-link chat-word-link">${formattedLabel}</a>`
    );
  });

  // 3. Protect bare URLs before _italic_ / *bold* matching
  out = out.replace(/(https?:\/\/[^\s<\uE000]+)/g, (full) => {
    const trailMatch = full.match(/([.,!?;:)\]]+)$/);
    const trail = trailMatch ? trailMatch[1] : '';
    const candidate = trail ? full.slice(0, -trail.length) : full;
    const safeUrl = sanitizeUrl(candidate);
    if (!safeUrl) return full;
    return hold(
      `<a href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer" class="chat-link">${candidate}</a>`
    ) + trail;
  });

  // 4. Apply highlight / underline / spoiler / sup / sub / WhatsApp styles
  out = renderInlineEmphasis(out);

  // 5. Restore protected placeholders
  out = out.replace(/\uE000(\d+)\uE001/g, (_m, idxStr) => tokens[Number(idxStr)] || '');

  return out;
}

function renderInlineEmphasis(escapedSegment) {
  if (!escapedSegment) return '';
  let out = escapedSegment;

  // Highlight: ==text== or ==g:text== (6 colors)
  out = out.replace(/==(?:([ygbpov]):)?([^\s=\n](?:[^=\n]*?[^\s=\n])?)==/g, (_m, colorCode, inner) => {
    const colorDef = HIGHLIGHT_COLORS[colorCode || 'y'] || HIGHLIGHT_COLORS.y;
    return `<mark class="wa-hl wa-hl-${colorDef.name}" data-hl-color="${colorCode || 'y'}">${inner}</mark>`;
  });

  // Underline: ++text++
  out = out.replace(/\+\+([^\s+\n](?:[^+\n]*?[^\s+\n])?)\+\+/g, '<u class="wa-underline">$1</u>');

  // Spoiler: ||text||
  out = out.replace(
    /\|\|([^\s|\n](?:[^|\n]*?[^\s|\n])?)\|\|/g,
    '<span class="wa-spoiler" role="button" tabindex="0" data-revealed="false" title="Tap to reveal">$1</span>'
  );

  // Superscript & Subscript: ^^text^^ / ,,text,,
  out = out.replace(/\^\^([^\s^\n](?:[^\^\n]*?[^\s^\n])?)\^\^/g, '<sup class="wa-sup">$1</sup>');
  out = out.replace(/,,([^\s,\n](?:[^,\n]*?[^\s,\n])?),,/g, '<sub class="wa-sub">$1</sub>');

  // WhatsApp Bold: *text* (non-space inner edges + lookahead allows *a* *b*)
  out = out.replace(/(^|[\s(\[{.,!?:;>])\*([^\s*\n](?:[^*\n]*?[^\s*\n])?)\*(?=$|[\s)\]}.,!?:;<])/g, '$1<strong>$2</strong>');

  // WhatsApp Italic: _text_
  out = out.replace(/(^|[\s(\[{.,!?:;>])_([^\s_\n](?:[^_\n]*?[^\s_\n])?)_(?=$|[\s)\]}.,!?:;<])/g, '$1<em>$2</em>');

  // WhatsApp Strikethrough: ~text~
  out = out.replace(/(^|[\s(\[{.,!?:;>])~([^\s~\n](?:[^~\n]*?[^\s~\n])?)~(?=$|[\s)\]}.,!?:;<])/g, '$1<del>$2</del>');

  return out;
}

/**
 * Render canonical message markup into sanitized, styled HTML.
 */
export function renderRichMessageHtml(text, options = {}) {
  if (!text) return '';
  const interactive = options.interactive !== false;
  const normalized = String(text).replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  const segments = [];
  const state = options._state || { checkIdx: 0 };
  const nestedOptions = options._state ? options : { ...options, _state: state };

  const pushTextLine = (htmlLine) => {
    const prev = segments[segments.length - 1];
    if (prev && prev.type === 'text') {
      prev.lines.push(htmlLine);
    } else {
      segments.push({ type: 'text', lines: [htmlLine] });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // 0. Collapsible block: [fold:Title] ... [/fold]
    const foldMatch = rawLine.match(/^(\s*)\[fold:([^\]\n]+)\](.*)$/);
    if (foldMatch) {
      const title = foldMatch[2].trim();
      const firstLineContent = foldMatch[3].trim();
      const foldLines = [];
      if (firstLineContent) {
        if (firstLineContent.includes('[/fold]')) {
          const innerOneLine = firstLineContent.replace('[/fold]', '').trim();
          const innerHtml = renderRichMessageHtml(innerOneLine, nestedOptions);
          segments.push({
            type: 'block',
            html:
              `<details class="wa-fold-block">` +
                `<summary class="wa-fold-summary">` +
                  `<span class="wa-fold-arrow" aria-hidden="true">▶</span>` +
                  `<span class="wa-fold-title" dir="auto">${renderInlineFormatting(escapeHtml(title))}</span>` +
                `</summary>` +
                `<div class="wa-fold-content" dir="auto">${innerHtml}</div>` +
              `</details>`
          });
          continue;
        }
        foldLines.push(firstLineContent);
      }
      let j = i + 1;
      while (j < lines.length && !lines[j].includes('[/fold]')) {
        foldLines.push(lines[j]);
        j++;
      }
      if (j < lines.length) {
        const lastLineContent = lines[j].replace('[/fold]', '').trim();
        if (lastLineContent) foldLines.push(lastLineContent);
        i = j;
      } else {
        i = lines.length - 1;
      }
      const innerHtml = renderRichMessageHtml(foldLines.join('\n'), nestedOptions);
      segments.push({
        type: 'block',
        html:
          `<details class="wa-fold-block">` +
            `<summary class="wa-fold-summary">` +
              `<span class="wa-fold-arrow" aria-hidden="true">▶</span>` +
              `<span class="wa-fold-title" dir="auto">${renderInlineFormatting(escapeHtml(title))}</span>` +
            `</summary>` +
            `<div class="wa-fold-content" dir="auto">${innerHtml}</div>` +
          `</details>`
      });
      continue;
    }

    // 1. Fenced code block ```
    if (/^\s*```/.test(rawLine)) {
      const codeLines = [];
      let j = i + 1;
      while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) {
        codeLines.push(lines[j]);
        j++;
      }
      if (j < lines.length) {
        i = j;
      } else {
        i = lines.length - 1;
      }
      segments.push({
        type: 'block',
        html: `<pre class="chat-code-block"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
      });
      continue;
    }

    // 2. Interactive checklists: [ ] item / [x] item (with optional indentation)
    const checkMatch = rawLine.match(/^(\s*)\[([ xX])\]\s+(.*)$/);
    if (checkMatch) {
      const indent = Math.min(3, Math.floor(checkMatch[1].replace(/\t/g, '  ').length / 2));
      const checked = checkMatch[2].toLowerCase() === 'x';
      const idx = state.checkIdx++;
      const innerHtml = renderInlineFormatting(escapeHtml(checkMatch[3]));
      segments.push({
        type: 'block',
        html:
          `<div class="wa-check-row" data-indent="${indent}">` +
            `<label class="wa-check-label">` +
              `<input type="checkbox" class="wa-check-input" data-check-idx="${idx}" ${checked ? 'checked' : ''} ${interactive ? '' : 'disabled'} />` +
              `<span class="wa-check-box" aria-hidden="true"></span>` +
              `<span class="wa-check-text${checked ? ' is-checked' : ''}">${innerHtml}</span>` +
            `</label>` +
          `</div>`
      });
      continue;
    }

    // 3. Headers: # / ## / ###
    const headerMatch = rawLine.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const innerHtml = renderInlineFormatting(escapeHtml(headerMatch[2]));
      segments.push({
        type: 'block',
        html: `<div class="wa-md-h${level}">${innerHtml}</div>`
      });
      continue;
    }

    // 4. Blockquote: > quote
    const quoteMatch = rawLine.match(/^\s*>\s?(.*)$/);
    if (quoteMatch && /^\s*>/.test(rawLine)) {
      const innerHtml = renderInlineFormatting(escapeHtml(quoteMatch[1]));
      segments.push({
        type: 'block',
        html: `<blockquote class="wa-md-quote">${innerHtml}</blockquote>`
      });
      continue;
    }

    // 5. Bulleted list: 3 shapes (- / * for bullet •, -> / => / → for arrow →, \> / |-> / ↳ for branch ↳)
    const ulMatch = rawLine.match(/^(\s*)(?:(->|=>|→)|(\\>|\|->|↳)|(?:-|\*))\s+(.*)$/);
    if (ulMatch) {
      const indent = Math.min(3, Math.floor(ulMatch[1].replace(/\t/g, '  ').length / 2));
      const shape = ulMatch[2] ? 'arrow' : (ulMatch[3] ? 'branch' : 'bullet');
      const glyph = shape === 'arrow' ? '→' : (shape === 'branch' ? '↳' : '•');
      const innerHtml = renderInlineFormatting(escapeHtml(ulMatch[4]));
      segments.push({
        type: 'block',
        html:
          `<div class="wa-list-row wa-list-ul wa-list-shape-${shape}" data-indent="${indent}">` +
            `<span class="wa-list-marker is-${shape}" aria-hidden="true">${glyph}</span>` +
            `<span class="wa-list-content">${innerHtml}</span>` +
          `</div>`
      });
      continue;
    }

    // 6. Numbered list: 1. item
    const olMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const indent = Math.min(3, Math.floor(olMatch[1].replace(/\t/g, '  ').length / 2));
      const innerHtml = renderInlineFormatting(escapeHtml(olMatch[3]));
      segments.push({
        type: 'block',
        html:
          `<div class="wa-list-row wa-list-ol" data-indent="${indent}">` +
            `<span class="wa-list-marker">${escapeHtml(olMatch[2])}.</span>` +
            `<span class="wa-list-content">${innerHtml}</span>` +
          `</div>`
      });
      continue;
    }

    // 7. Inline code blocks on single line ```code``` inside paragraph
    let lineHtml = escapeHtml(rawLine);
    lineHtml = lineHtml.replace(/```([^`\n]+?)```/g, '<pre class="chat-code-block"><code>$1</code></pre>');
    lineHtml = renderInlineFormatting(lineHtml);
    pushTextLine(lineHtml);
  }

  return segments
    .map((seg) => (seg.type === 'text' ? `<div class="wa-text-para">${seg.lines.join('<br>')}</div>` : seg.html))
    .join('');
}

/**
 * Strip rich markup syntax for clean plain-text snippets (chat list, reply quotes, tree titles).
 */
export function stripRichMarkup(text) {
  if (!text) return '';
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1')
    .replace(/`([^`\n]+?)`/g, '$1')
    .replace(/\[fold:([^\]\n]+)\]\n?/g, '$1: ')
    .replace(/\[\/fold\]/g, '')
    .replace(/\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '$1')
    .replace(/==(?:[ygbpov]:)?([^\s=\n](?:[^=\n]*?[^\s=\n])?)==/g, '$1')
    .replace(/\+\+([^\s+\n](?:[^+\n]*?[^\s+\n])?)\+\+/g, '$1')
    .replace(/\|\|([^\s|\n](?:[^|\n]*?[^\s|\n])?)\|\|/g, '$1')
    .replace(/\^\^([^\s^\n](?:[^\^\n]*?[^\s^\n])?)\^\^/g, '$1')
    .replace(/,,([^\s,\n](?:[^,\n]*?[^\s,\n])?),,/g, '$1')
    .replace(/(^|[\s(\[{.,!?:;>])\*([^\s*\n](?:[^*\n]*?[^\s*\n])?)\*(?=$|[\s)\]}.,!?:;<])/g, '$1$2')
    .replace(/(^|[\s(\[{.,!?:;>])_([^\s_\n](?:[^_\n]*?[^\s_\n])?)_(?=$|[\s)\]}.,!?:;<])/g, '$1$2')
    .replace(/(^|[\s(\[{.,!?:;>])~([^\s~\n](?:[^~\n]*?[^\s~\n])?)~(?=$|[\s)\]}.,!?:;<])/g, '$1$2')
    .replace(/^(\s*)\[[xX]\]\s+/gm, '$1☑ ')
    .replace(/^(\s*)\[\s?\]\s+/gm, '$1☐ ')
    .replace(/^(\s*)(?:->|=>|→|\\>|\|->|↳)\s+/gm, '$1→ ')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .trim();
}

/**
 * Toggle the N-th checklist item (zero-based) inside canonical markup text.
 * Leaves code blocks and all unrelated lines untouched.
 */
export function toggleCheckboxInMarkup(text, checkboxIndex) {
  if (!text || checkboxIndex < 0) return text;
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  let inCodeBlock = false;
  let seen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(\s*)\[([ xX])\](\s+.*)$/);
    if (match) {
      if (seen === checkboxIndex) {
        const nextMark = match[2].toLowerCase() === 'x' ? ' ' : 'x';
        lines[i] = `${match[1]}[${nextMark}]${match[3]}`;
        return lines.join('\n');
      }
      seen++;
    }
  }

  return text;
}

/**
 * Compute progressive truncation slice for long messages:
 * - Initial limit: ~450 chars or 10 lines
 * - Each `Show more`: +900 chars / +18 lines
 * - `Show full message`: shown only when remaining text exceeds one `Show more` step
 * - `Show less`: shown whenever expanded beyond step 0
 */
export function sliceMessageForDisplay(text, revealedSteps = 0, forceFull = false) {
  if (!text) {
    return {
      displayText: '',
      isCollapsible: false,
      isTruncated: false,
      needsMultipleMore: false,
      canCollapse: false
    };
  }

  const normalized = String(text).replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const isCollapsible =
    normalized.length > LONG_MESSAGE_INITIAL_CHARS ||
    lines.length > LONG_MESSAGE_INITIAL_LINES;

  if (!isCollapsible) {
    return {
      displayText: normalized,
      isCollapsible: false,
      isTruncated: false,
      needsMultipleMore: false,
      canCollapse: false
    };
  }

  if (forceFull) {
    return {
      displayText: normalized,
      isCollapsible: true,
      isTruncated: false,
      needsMultipleMore: false,
      canCollapse: true
    };
  }

  const steps = Math.max(0, Number(revealedSteps) || 0);
  const charBudget = LONG_MESSAGE_INITIAL_CHARS + steps * LONG_MESSAGE_STEP_CHARS;
  const lineBudget = LONG_MESSAGE_INITIAL_LINES + steps * LONG_MESSAGE_STEP_LINES;

  let lineCutIdx = normalized.length;
  if (lines.length > lineBudget) {
    let pos = 0;
    for (let i = 0; i < lineBudget; i++) {
      pos += lines[i].length + (i < lines.length - 1 ? 1 : 0);
    }
    lineCutIdx = pos;
  }

  const rawCut = Math.min(normalized.length, charBudget, lineCutIdx);
  if (rawCut >= normalized.length) {
    return {
      displayText: normalized,
      isCollapsible: true,
      isTruncated: false,
      needsMultipleMore: false,
      canCollapse: steps > 0
    };
  }

  // Prefer slicing cleanly at a nearby newline or space without splitting inline link tokens
  let safeCut = rawCut;
  const lookbackStart = Math.max(0, rawCut - 70);
  const windowSlice = normalized.slice(lookbackStart, rawCut);
  const lastNewline = windowSlice.lastIndexOf('\n');
  const lastSpace = Math.max(windowSlice.lastIndexOf(' '), windowSlice.lastIndexOf('\t'));

  if (lastNewline > 10) {
    safeCut = lookbackStart + lastNewline;
  } else if (lastSpace > 10) {
    safeCut = lookbackStart + lastSpace;
  }

  // Prevent slicing inside a `[label](url)` token if truncated right inside one
  const openBracket = normalized.lastIndexOf('[', safeCut);
  if (openBracket !== -1 && safeCut > openBracket) {
    const tailAfterBracket = normalized.slice(openBracket, Math.min(normalized.length, openBracket + 240));
    const linkMatch = tailAfterBracket.match(/^\[[^\]\n]+\]\([^\s)\n]+\)/);
    if (linkMatch && openBracket + linkMatch[0].length > safeCut && openBracket > 20) {
      safeCut = openBracket;
    }
  }

  let displaySlice = normalized.slice(0, safeCut).trimEnd();
  const fenceMatches = displaySlice.match(/^\s*```/gm);
  if (fenceMatches && fenceMatches.length % 2 === 1) {
    displaySlice += '\n```';
  }
  const foldOpens = (displaySlice.match(/^\s*\[fold:[^\]\n]+\]/gm) || []).length;
  const foldCloses = (displaySlice.match(/\[\/fold\]/g) || []).length;
  if (foldOpens > foldCloses) {
    displaySlice += '\n[/fold]'.repeat(foldOpens - foldCloses);
  }

  const remaining = normalized.slice(safeCut).trimStart();
  const remainingLines = remaining ? remaining.split('\n').length : 0;
  const needsMultipleMore =
    remaining.length > LONG_MESSAGE_STEP_CHARS ||
    remainingLines > LONG_MESSAGE_STEP_LINES;

  return {
    displayText: `${displaySlice}…`,
    isCollapsible: true,
    isTruncated: true,
    needsMultipleMore,
    canCollapse: steps > 0
  };
}
