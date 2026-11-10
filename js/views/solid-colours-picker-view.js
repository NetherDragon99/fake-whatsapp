// Screen: Solid Colours Wallpaper Picker (3-Column Rounded Cards matching WhatsApp Reference)
import { Icons } from '../icons.js';
import { APP_COLOR_PALETTE } from '../config/palette.js';

export class SolidColoursPickerView {
  constructor(router) {
    this.router = router;
    this.container = null;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;

    const cardsHtml = APP_COLOR_PALETTE.map((color) => {
      return `
        <button type="button" class="solid-color-card" data-color="${color}" style="background-color: ${color};" aria-label="Solid color ${color}">
        </button>
      `;
    }).join('');

    rootEl.innerHTML = `
      <div class="screen-view solid-colours-screen">
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-solid-colours-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">Solid colours</div>
        </header>

        <div class="solid-colours-body">
          <div class="solid-colours-grid">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btn-solid-colours-back').addEventListener('click', () => {
      this.router.navigate('#/wallpaper-picker');
    });

    const cards = this.container.querySelectorAll('.solid-color-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const color = card.dataset.color;
        this.router.navigate(`#/theme-preview?wallpaper=color:${encodeURIComponent(color)}`);
      });
    });
  }
}
