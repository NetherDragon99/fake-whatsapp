// Floating Reaction Bar — appears near long-pressed message
// Shows 6 quick-reaction emojis + a + button to open the full emoji picker

export class ReactionBar {
  constructor({ onReact, onOpenPicker } = {}) {
    this.onReact = onReact || (() => {});
    this.onOpenPicker = onOpenPicker || (() => {});
    this.currentMsgId = null;
    this.currentReaction = null;
    this.barEl = null;
    this.backdropEl = null;
    this._escHandler = null;
    this._buildDOM();
  }

  _buildDOM() {
    // Backdrop (invisible, intercepts outside clicks)
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'floating-reaction-backdrop';
    this.backdropEl.addEventListener('click', () => this.hide());

    // Bar
    this.barEl = document.createElement('div');
    this.barEl.className = 'floating-reaction-bar';
    this.barEl.setAttribute('role', 'toolbar');
    this.barEl.setAttribute('aria-label', 'React to message');

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    emojis.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reaction-emoji-btn';
      btn.dataset.emoji = emoji;
      btn.textContent = emoji;
      btn.setAttribute('aria-label', `React with ${emoji}`);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newReaction = this.currentReaction === emoji ? null : emoji;
        this.onReact(this.currentMsgId, newReaction);
        this.hide();
      });
      this.barEl.appendChild(btn);
    });

    // + button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'reaction-emoji-btn reaction-add-btn';
    addBtn.textContent = '+';
    addBtn.setAttribute('aria-label', 'More emojis');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const msgId = this.currentMsgId;
      this.hide(true);
      this.onOpenPicker(msgId);
    });
    this.barEl.appendChild(addBtn);

    document.body.appendChild(this.backdropEl);
    document.body.appendChild(this.barEl);

    // Start hidden
    this.backdropEl.style.display = 'none';
    this.barEl.style.display = 'none';
  }

  /**
   * Show the reaction bar near rowEl.
   * @param {string|number} msgId
   * @param {HTMLElement} rowEl  - the .msg-row element
   * @param {string|null} [currentReaction] - existing emoji reaction
   */
  show(msgId, rowEl, currentReaction = null) {
    this.currentMsgId = msgId;
    this.currentReaction = currentReaction;

    // Highlight current reaction button if matched
    this.barEl.querySelectorAll('.reaction-emoji-btn').forEach((btn) => {
      if (btn.dataset.emoji && btn.dataset.emoji === currentReaction) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    const target = rowEl.querySelector('.msg-bubble') || rowEl;
    const rect = target.getBoundingClientRect();
    const barHeight = 52;
    const margin = 10;
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;

    // Determine position: if the bubble top is in lower 45% -> show ABOVE, else BELOW
    const showAbove = rect.top > viewH * 0.45;

    // Approximate width of reaction bar
    const barWidth = 300;

    let left = rect.left;
    if (rect.right > viewW * 0.5) {
      // Outgoing message bubble on right: align toward right edge of bubble
      left = rect.right - barWidth;
    }
    if (left + barWidth > viewW - 12) left = viewW - barWidth - 12;
    if (left < 12) left = 12;

    let top = showAbove ? (rect.top - barHeight - margin) : (rect.bottom + margin);
    top = Math.max(12, Math.min(viewH - barHeight - 12, top));

    this.barEl.style.left = `${Math.round(left)}px`;
    this.barEl.style.top = `${Math.round(top)}px`;

    this.backdropEl.style.display = 'block';
    this.barEl.style.display = 'flex';

    // Animate in
    this.barEl.classList.remove('reaction-bar-visible');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.barEl.classList.add('reaction-bar-visible');
      });
    });

    // Escape key dismissal
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this._escHandler);
  }

  hide(immediate = false) {
    this.barEl.classList.remove('reaction-bar-visible');
    if (immediate) {
      this.barEl.style.display = 'none';
      this.backdropEl.style.display = 'none';
    } else {
      setTimeout(() => {
        if (!this.barEl.classList.contains('reaction-bar-visible')) {
          this.barEl.style.display = 'none';
          this.backdropEl.style.display = 'none';
        }
      }, 150);
    }

    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    this.currentMsgId = null;
    this.currentReaction = null;
  }

  destroy() {
    this.hide();
    if (this.barEl && this.barEl.parentNode) this.barEl.parentNode.removeChild(this.barEl);
    if (this.backdropEl && this.backdropEl.parentNode) this.backdropEl.parentNode.removeChild(this.backdropEl);
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
  }
}
