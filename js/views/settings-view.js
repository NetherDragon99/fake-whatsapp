// Screen 7: Settings View with PWA Install App Action
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { PinDialog } from '../components/pin-dialog.js';
import { Toast } from '../components/toast.js';

export class SettingsView {
  constructor(router) {
    this.router = router;
    this.container = null;
  }

  async render(rootEl) {
    this.container = rootEl;
    const currentTheme = await db.getSetting('theme', 'slate');
    const ownerName = await db.getSetting('ownerName', 'You');
    const storageStats = await db.getStorageUsage();
    const appVersion = window.APP_VERSION || '0.0.0';

    // Standalone display mode check
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;

    rootEl.innerHTML = `
      <div class="screen-view settings-screen">
        <header class="wa-app-bar">
          <div class="app-title">Settings</div>
        </header>

        <div class="settings-scroll-body">
          <!-- Profile Card -->
          <div class="settings-profile-card" id="btn-edit-profile">
            <div class="settings-avatar-wrap">
              ${Icons.userAvatar('', 64)}
            </div>
            <div class="settings-profile-texts">
              <div class="profile-name" id="settings-owner-name">${ownerName}</div>
              <div class="profile-status">Available</div>
            </div>
          </div>

          <!-- PWA Native Install Button (Dynamically hidden in standalone mode) -->
          <div class="settings-pwa-install-row" id="row-pwa-install" style="${isStandalone ? 'display:none;' : ''}">
            <div class="install-icon-wrap">${Icons.installApp('install-icon', 24)}</div>
            <div class="install-texts">
              <div class="install-title">Install App</div>
              <div class="install-sub">Add to Home screen for quick offline access</div>
            </div>
            <button class="install-action-pill" id="btn-trigger-pwa-install">Install</button>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Appearance & Bubble Theme -->
          <div class="settings-section">
            <div class="settings-section-header">Appearance</div>
            <div class="settings-option-row" id="row-bubble-theme">
              <span class="settings-icon">${Icons.star('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Outgoing Bubble Color</div>
                <div class="setting-sub" id="theme-sub-text">${currentTheme === 'green' ? 'Classic Green (#005c4b)' : 'Slate-Blue (#1d3c4e)'}</div>
              </div>
              <button class="settings-action-btn" id="btn-switch-theme">Switch</button>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Chat Lock Security -->
          <div class="settings-section">
            <div class="settings-section-header">Privacy & Security</div>
            <div class="settings-option-row" id="row-manage-pin">
              <span class="settings-icon">${Icons.lock('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Chat Lock PIN</div>
                <div class="setting-sub">Set or reset 4-digit security PIN</div>
              </div>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Storage & Database Backup -->
          <div class="settings-section">
            <div class="settings-section-header">Storage and Data</div>
            <div class="settings-option-row">
              <span class="settings-icon">${Icons.download('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">App Storage Used</div>
                <div class="setting-sub">${storageStats.formattedSize} (${storageStats.chatCount} chats, ${storageStats.messageCount} messages)</div>
              </div>
            </div>

            <div class="settings-option-row clickable" id="row-export-backup">
              <span class="settings-icon">${Icons.archive('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Export Full Backup</div>
                <div class="setting-sub">Save all chats and media as a single backup archive</div>
              </div>
            </div>

            <div class="settings-option-row clickable" id="row-restore-backup">
              <span class="settings-icon">${Icons.forward('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Restore Backup</div>
                <div class="setting-sub">Import previously exported database archive</div>
              </div>
              <input type="file" id="backup-restore-input" accept=".zip,.json" style="display:none;" />
            </div>

            <div class="settings-option-row clickable danger-row" id="row-reset-database">
              <span class="settings-icon">${Icons.trash('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title danger-text">Clear All Restored Data</div>
                <div class="setting-sub">Permanently delete all chats, media, and settings</div>
              </div>
            </div>
          </div>

          <!-- App Version Footer -->
          <div class="settings-footer-version">
            <span>WhatsApp Clone for Android</span>
            <span class="version-number">Version ${appVersion}</span>
          </div>
        </div>

        <!-- Bottom Navigation Bar -->
        <nav class="wa-bottom-nav">
          <a href="#/chats" class="nav-tab">
            <div class="tab-icon-wrap">${Icons.chatsTab('', 22)}</div>
            <span class="tab-label">Chats</span>
          </a>
          <a href="#/calls" class="nav-tab">
            <div class="tab-icon-wrap">${Icons.callsTab('', 22)}</div>
            <span class="tab-label">Calls</span>
          </a>
          <a href="#/settings" class="nav-tab active">
            <div class="tab-icon-wrap">${Icons.settingsTab('', 22)}</div>
            <span class="tab-label">Settings</span>
          </a>
        </nav>
      </div>
    `;

    this.bindEvents(currentTheme, isStandalone);
  }

  bindEvents(currentTheme, isStandalone) {
    // PWA Native Install Action
    const installRow = this.container.querySelector('#row-pwa-install');
    const installBtn = this.container.querySelector('#btn-trigger-pwa-install');

    if (!isStandalone) {
      installBtn.addEventListener('click', async () => {
        if (window.deferredInstallPrompt) {
          window.deferredInstallPrompt.prompt();
          const { outcome } = await window.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            Toast.show('Installation accepted!');
            installRow.style.display = 'none';
          }
          window.deferredInstallPrompt = null;
        } else {
          Toast.show('Install prompt not available. You can add this page via your browser menu.');
        }
      });
    }

    // Switch Outgoing Bubble Theme
    const switchThemeBtn = this.container.querySelector('#btn-switch-theme');
    const themeSub = this.container.querySelector('#theme-sub-text');
    let themeState = currentTheme;

    switchThemeBtn.addEventListener('click', async () => {
      themeState = themeState === 'slate' ? 'green' : 'slate';
      await db.setSetting('theme', themeState);
      themeSub.textContent = themeState === 'green' ? 'Classic Green (#005c4b)' : 'Slate-Blue (#1d3c4e)';
      Toast.show(`Theme updated: ${themeState === 'green' ? 'Green' : 'Slate-Blue'}`);
    });

    // Edit Profile Name
    this.container.querySelector('#btn-edit-profile').addEventListener('click', async () => {
      const cur = await db.getSetting('ownerName', 'You');
      const updated = prompt('Enter your display name:', cur);
      if (updated && updated.trim()) {
        await db.setSetting('ownerName', updated.trim());
        this.container.querySelector('#settings-owner-name').textContent = updated.trim();
        Toast.show('Name updated');
      }
    });

    // Chat Lock PIN Setup / Reset
    this.container.querySelector('#row-manage-pin').addEventListener('click', async () => {
      const ok = await PinDialog.promptSetup();
      if (ok) Toast.show('PIN configured successfully');
    });

    // Export Full Backup
    this.container.querySelector('#row-export-backup').addEventListener('click', async () => {
      Toast.show('Packaging backup archive...');
      const data = await db.exportFullBackup();

      try {
        const jsonStr = JSON.stringify(data);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `whatsapp_backup_${Date.now()}.json`;
        a.click();
        Toast.show('Backup exported successfully');
      } catch (err) {
        alert('Export failed: ' + err.message);
      }
    });

    // Restore Backup
    const restoreInput = this.container.querySelector('#backup-restore-input');
    this.container.querySelector('#row-restore-backup').addEventListener('click', () => {
      restoreInput.click();
    });

    restoreInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          if (confirm('Restore this backup? This will replace current chats.')) {
            await db.restoreFullBackup(json);
            Toast.show('Backup restored successfully!');
            setTimeout(() => this.router.navigate('#/chats'), 500);
          }
        } catch (err) {
          alert('Invalid backup file: ' + err.message);
        }
      }
    });

    // Clear All Data
    this.container.querySelector('#row-reset-database').addEventListener('click', async () => {
      const confirmed = confirm('DANGER: Permanently delete all restored chats, media, and settings?');
      if (confirmed) {
        await db.clearAllData();
        Toast.show('All data cleared');
        setTimeout(() => this.router.navigate('#/chats'), 400);
      }
    });
  }
}
