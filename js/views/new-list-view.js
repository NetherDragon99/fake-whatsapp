// Screen 2: "New list" Custom Filter Screen
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { Toast } from '../components/toast.js';
import { showAlert } from '../components/custom-dialog.js';

export class NewListView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.selectedChatIds = new Set();
  }

  async render(rootEl) {
    this.container = rootEl;
    this.selectedChatIds.clear();
    const allChats = await db.getChats();

    rootEl.innerHTML = `
      <div class="screen-view new-list-screen">
        <header class="wa-app-bar sheet-style-header">
          <button class="app-bar-icon-btn" id="btn-close-list">${Icons.close('', 22)}</button>
          <div class="app-title center-title">New list</div>
          <button class="app-bar-text-btn" id="btn-save-list">Create</button>
        </header>

        <div class="new-list-body">
          <div class="input-card-wrap">
            <label class="green-floating-label">List name</label>
            <div class="list-input-box">
              <input type="text" id="list-name-input" placeholder="Example: Work, Friends" autofocus />
              <span class="input-emoji-icon">${Icons.emoji('', 22)}</span>
            </div>
            <div class="list-helper-text">
              Any list you create becomes a filter at the top of your Chats tab.
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Customization Rows -->
          <div class="list-options-group">
            <div class="option-row">
              <span class="option-icon">${Icons.star('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Theme</div>
                <div class="option-subtitle">Default</div>
              </div>
            </div>

            <div class="option-row">
              <span class="option-icon">${Icons.calendar('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Focus schedule</div>
                <div class="option-subtitle">None</div>
              </div>
            </div>

            <div class="option-row">
              <span class="option-icon">${Icons.mic('', 20)}</span>
              <div class="option-texts">
                <div class="option-title">Notification tone</div>
                <div class="option-subtitle">Default</div>
              </div>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Chat Selector Section -->
          <div class="chat-selector-section">
            <div class="selector-header">Select chats for this list (${allChats.length} available)</div>
            <div class="selector-chat-list" id="selector-chat-list">
              <!-- Populated dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Populate chat selector
    const selectorList = this.container.querySelector('#selector-chat-list');
    if (allChats.length === 0) {
      selectorList.innerHTML = `<div class="empty-hint">No chats available to add. Restore some chats first!</div>`;
    } else {
      allChats.forEach((c) => {
        const item = document.createElement('div');
        item.className = 'selector-chat-row';
        item.dataset.chatId = c.id;
        item.innerHTML = `
          <div class="selector-avatar">
            ${c.isGroup ? Icons.groupAvatar('', 40) : Icons.userAvatar('', 40)}
          </div>
          <div class="selector-name" dir="auto">${c.name}</div>
          <input type="checkbox" class="wa-checkbox" data-id="${c.id}" />
        `;

        item.addEventListener('click', (e) => {
          const cb = item.querySelector('.wa-checkbox');
          if (e.target !== cb) cb.checked = !cb.checked;
          if (cb.checked) {
            this.selectedChatIds.add(c.id);
            item.classList.add('selected');
          } else {
            this.selectedChatIds.delete(c.id);
            item.classList.remove('selected');
          }
        });

        selectorList.appendChild(item);
      });
    }

    // Bind Close & Save
    this.container.querySelector('#btn-close-list').addEventListener('click', () => {
      this.router.back();
    });

    this.container.querySelector('#btn-save-list').addEventListener('click', async () => {
      const name = this.container.querySelector('#list-name-input').value.trim();
      if (!name) {
        await showAlert({ title: 'Name Required', message: 'Please enter a name for this list.' });
        return;
      }

      const newFilter = {
        id: 'filter_' + Date.now(),
        name,
        icon: 'star',
        chatIds: Array.from(this.selectedChatIds)
      };

      await db.saveFilter(newFilter);
      Toast.show(`List "${name}" created!`);
      this.router.navigate('#/chats');
    });
  }
}
