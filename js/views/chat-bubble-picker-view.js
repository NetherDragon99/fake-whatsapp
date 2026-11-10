// Screen: Chat Bubble Color Picker with 4-Column Circular Swatches (Matching WhatsApp Reference)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { APP_COLOR_PALETTE, applyOutgoingBubbleColor } from '../config/palette.js';
import { Toast } from '../components/toast.js';

export class ChatBubblePickerView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.selectedColor = '#25d366';
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.selectedColor = await db.getSetting('defaultBubbleColor', '#25d366');

    const swatchesHtml = APP_COLOR_PALETTE.map((color) => {
      const isSelected = color.toLowerCase() === this.selectedColor.toLowerCase();
      return `
        <button type="button" class="bubble-swatch-item ${isSelected ? 'selected' : ''}" data-color="${color}" aria-label="Select color ${color}">
          <span class="bubble-swatch-circle" style="background-color: ${color};">
            ${isSelected ? `<span class="swatch-indicator-dot"></span>` : ''}
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
      this.router.navigate('#/chat-theme');
    });

    const buttons = this.container.querySelectorAll('.bubble-swatch-item');
    buttons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const color = btn.dataset.color;
        this.selectedColor = color;
        await db.setSetting('defaultBubbleColor', color);
        applyOutgoingBubbleColor(color);

        buttons.forEach((b) => {
          b.classList.remove('selected');
          const circle = b.querySelector('.bubble-swatch-circle');
          circle.innerHTML = '';
        });

        btn.classList.add('selected');
        const circle = btn.querySelector('.bubble-swatch-circle');
        circle.innerHTML = `<span class="swatch-indicator-dot"></span>`;

        Toast.show('Chat bubble color updated');
      });
    });
  }
}

