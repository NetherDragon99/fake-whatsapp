// Screen: Chat Bubble Color Picker with 4-Column Circular Swatches (Matching WhatsApp Reference)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import {
  getBubblePaletteForCurrentTheme,
  resolveBubbleColorForTheme,
  isColorDark,
  applyOutgoingBubbleColor
} from '../config/palette.js';
import { Toast } from '../components/toast.js';

export class ChatBubblePickerView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.selectedColor = '#25d366';
    this.chatId = null;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.chatId = params.chatId || null;

    let rawColor = await db.getSetting('defaultBubbleColor', '#25d366');
    if (this.chatId) {
      const chat = await db.getChat(this.chatId);
      if (chat && chat.outgoingBubbleColor) {
        rawColor = chat.outgoingBubbleColor;
      }
    }
    this.selectedColor = resolveBubbleColorForTheme(rawColor);

    const palette = getBubblePaletteForCurrentTheme();
    const swatchesHtml = palette.map((color) => {
      const isSelected = color.toLowerCase() === this.selectedColor.toLowerCase();
      const dotColor = isColorDark(color) ? '#ffffff' : '#111b21';
      return `
        <button type="button" class="bubble-swatch-item ${isSelected ? 'selected' : ''}" data-color="${color}" aria-label="Select color ${color}">
          <span class="bubble-swatch-circle" style="background-color: ${color};">
            ${isSelected ? `<span class="swatch-indicator-dot" style="background-color: ${dotColor};"></span>` : ''}
          </span>
        </button>
      `;
    }).join('');

    rootEl.innerHTML = `
      <div class="screen-view chat-bubble-picker-screen">
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-bubble-picker-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">Chat bubble</div>
        </header>

        <div class="bubble-picker-body">
          <div class="bubble-swatches-grid">
            ${swatchesHtml}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btn-bubble-picker-back').addEventListener('click', () => {
      this.router.back();
    });

    const buttons = this.container.querySelectorAll('.bubble-swatch-item');
    buttons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const color = btn.dataset.color;
        this.selectedColor = color;
        if (this.chatId) {
          await db.updateChat(this.chatId, { outgoingBubbleColor: color });
        } else {
          await db.setSetting('defaultBubbleColor', color);
          applyOutgoingBubbleColor(color);
        }

        buttons.forEach((b) => {
          b.classList.remove('selected');
          const circle = b.querySelector('.bubble-swatch-circle');
          circle.innerHTML = '';
        });

        btn.classList.add('selected');
        const circle = btn.querySelector('.bubble-swatch-circle');
        const dotColor = isColorDark(color) ? '#ffffff' : '#111b21';
        circle.innerHTML = `<span class="swatch-indicator-dot" style="background-color: ${dotColor};"></span>`;

        Toast.show('Chat bubble color updated');
      });
    });
  }
}

