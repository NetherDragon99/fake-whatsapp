// Screen 7: Settings View with Material 3 UI, Appearance Navigation & Profile Cropper
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { PinDialog } from '../components/pin-dialog.js';
import { Toast } from '../components/toast.js';
import { openImageCropper } from '../components/image-cropper.js';
import { showConfirm, showAlert, showPrompt } from '../components/custom-dialog.js';

export class SettingsView {
  constructor(router) {
    this.router = router;
    this.container = null;
  }

  async render(rootEl) {
    this.container = rootEl;
    try {
      let ownerName = 'You';
      let userAvatarBlob = null;
      let storageStats = { formattedSize: '0 B', chatCount: 0, messageCount: 0 };
      const appVersion = window.APP_VERSION || '0.0.4';

      try {
        ownerName = await db.getSetting('ownerName', 'You');
        userAvatarBlob = await db.getSetting('userProfileAvatar', null);
        storageStats = await db.getStorageUsage();
      } catch (err) {
        console.warn('[SettingsView] Error loading settings data:', err);
      }

    // Standalone display mode check
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;

    const avatarHtml = userAvatarBlob
      ? `<img src="${URL.createObjectURL(userAvatarBlob)}" class="profile-avatar-img" alt="Profile" />`
      : Icons.userAvatar('', 64);

    rootEl.innerHTML = `
      <div class="screen-view settings-screen">
        <header class="wa-app-bar flat-app-bar">
          <div class="app-title">Settings</div>
        </header>

        <div class="settings-scroll-body">
          <!-- Profile Card with Crop & Edit -->
          <div class="settings-profile-card">
            <div class="settings-avatar-wrap" id="btn-change-avatar" title="Change profile photo">
              <div class="avatar-circle-wrap" id="settings-avatar-container">
                ${avatarHtml}
              </div>
              <div class="avatar-camera-badge">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#ffffff">
                  <path d="M12 12c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-1.5c0-2.33-4.67-3.5-7-3.5zM20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                </svg>
              </div>
              <input type="file" id="profile-file-input" accept="image/*" style="display:none;" />
            </div>
            
            <div class="settings-profile-texts" id="btn-edit-name" title="Click to edit name">
              <div class="profile-name-row">
                <span class="profile-name" id="settings-owner-name" dir="auto">${ownerName}</span>
                <span class="edit-pencil-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </span>
              </div>
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
            <button type="button" class="install-action-pill" id="btn-trigger-pwa-install">Install</button>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Appearance Row (Material 3 Re-architected) -->
          <div class="settings-section">
            <div class="settings-option-row clickable" id="row-appearance">
              <span class="settings-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.28 19.64 10.59 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
                </svg>
              </span>
              <div class="settings-texts">
                <div class="setting-title">Appearance</div>
                <div class="setting-sub">Chat theme, app icon, app theme</div>
              </div>
              <div class="settings-chevron">
                ${Icons.chevronRight('', 18)}
              </div>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Chat Lock Security -->
          <div class="settings-section">
            <div class="settings-section-header">Privacy & Security</div>
            <div class="settings-option-row clickable" id="row-manage-pin">
              <span class="settings-icon">${Icons.lock('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Chat Lock PIN</div>
                <div class="setting-sub">Set or reset 4-digit security PIN</div>
              </div>
              <div class="settings-chevron">
                ${Icons.chevronRight('', 18)}
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
            <span class="version-number">v${appVersion}</span>
          </div>
        </div>

        <!-- Bottom Navigation Bar (Material 3 with active pill indicator) -->
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
            <div class="tab-icon-wrap">
              <span class="tab-pill-indicator"></span>
              ${Icons.settingsTab('', 22)}
            </div>
            <span class="tab-label">Settings</span>
          </a>
        </nav>
      </div>
    `;

    this.bindEvents(isStandalone);
  }

  bindEvents(isStandalone) {
    // Profile Picture Crop & Edit
    const avatarContainer = this.container.querySelector('#btn-change-avatar');
    const profileFileInput = this.container.querySelector('#profile-file-input');

    avatarContainer.addEventListener('click', () => {
      profileFileInput.click();
    });

    profileFileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const croppedBlob = await openImageCropper(file);
        if (croppedBlob) {
          await db.setSetting('userProfileAvatar', croppedBlob);
          const avatarWrap = this.container.querySelector('#settings-avatar-container');
          avatarWrap.innerHTML = `<img src="${URL.createObjectURL(croppedBlob)}" class="profile-avatar-img" alt="Profile" />`;
          Toast.show('Profile photo updated');
        }
      }
    });

    // Edit Profile Name with Custom In-App Prompt
    this.container.querySelector('#btn-edit-name').addEventListener('click', async () => {
      const cur = await db.getSetting('ownerName', 'You');
      const updated = await showPrompt({
        title: 'Enter your name',
        message: 'This name will be visible as "You" in chats and settings.',
        defaultValue: cur,
        placeholder: 'Your name',
        confirmText: 'Save',
        cancelText: 'Cancel'
      });
      if (updated !== null && updated.trim()) {
        const trimmed = updated.trim();
        await db.setSetting('ownerName', trimmed);
        this.container.querySelector('#settings-owner-name').textContent = trimmed;
        Toast.show('Name updated');
      }
    });

    // PWA Native Install Action
    const installRow = this.container.querySelector('#row-pwa-install');
    const installBtn = this.container.querySelector('#btn-trigger-pwa-install');

    if (!isStandalone && installBtn) {
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

    // Appearance Navigation
    this.container.querySelector('#row-appearance').addEventListener('click', () => {
      this.router.navigate('#/settings/appearance');
    });

    // Chat Lock PIN Setup / Reset
    this.container.querySelector('#row-manage-pin').addEventListener('click', async () => {
      const ok = await PinDialog.promptSetup();
      if (ok) Toast.show('PIN configured successfully');
    });

    // Export Full Backup
    this.container.querySelector('#row-export-backup').addEventListener('click', async () => {
      Toast.show('Packaging backup archive...');
      try {
        const data = await db.exportFullBackup();
        const jsonStr = JSON.stringify(data);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `whatsapp_backup_${Date.now()}.json`;
        a.click();
        Toast.show('Backup exported successfully');
      } catch (err) {
        await showAlert({ title: 'Export Failed', message: err.message || 'Could not export backup.' });
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
          const confirmed = await showConfirm({
            title: 'Restore Backup',
            message: 'Restore this backup? This will replace current chats.',
            confirmText: 'Restore',
            cancelText: 'Cancel'
          });
          if (confirmed) {
            await db.restoreFullBackup(json);
            Toast.show('Backup restored successfully!');
            setTimeout(() => this.router.navigate('#/chats'), 500);
          }
        } catch (err) {
          await showAlert({ title: 'Invalid Backup', message: err.message || 'Failed to read backup file.' });
        }
      }
    });

    // Clear All Data
    this.container.querySelector('#row-reset-database').addEventListener('click', async () => {
      const confirmed = await showConfirm({
        title: 'Clear All Restored Data',
        message: 'DANGER: This will permanently delete all restored chats, media, and settings from this device.',
        confirmText: 'Delete All',
        cancelText: 'Cancel',
        isDanger: true
      });
      if (confirmed) {
        await db.clearAllData();
        Toast.show('All data cleared');
        setTimeout(() => this.router.navigate('#/chats'), 400);
      }
    });

    // Bottom Navigation explicit routing (Task 2)
    this.container.querySelectorAll('.wa-bottom-nav .nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (href) this.router.navigate(href);
      });
    });

    // Swipe navigation between main tabs (Task 11): Settings -> swipe right goes to Calls
    let touchStartX = 0;
    let touchStartY = 0;
    const screenEl = this.container.querySelector('.settings-screen');
    if (screenEl) {
      screenEl.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      screenEl.addEventListener('touchend', (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (deltaX > 75 && Math.abs(deltaX) > 1.8 * Math.abs(deltaY)) {
          this.router.navigate('#/calls');
        }
      }, { passive: true });
    }
  } catch (err) {
    console.error('[SettingsView] Error rendering settings view:', err);
    rootEl.innerHTML = `
      <div class="screen-view settings-screen">
        <header class="wa-app-bar flat-app-bar">
          <div class="app-title">Settings</div>
        </header>
        <div style="padding: 32px 16px; text-align: center;">
          <p style="color: var(--wa-text-secondary); margin-bottom: 16px;">Failed to load settings: ${err.message || 'Unknown error'}</p>
          <button type="button" class="btn-chat-primary" onclick="window.location.hash='#/chats'" style="padding: 10px 24px; border-radius: 20px; border: none; background: var(--app-accent, #25d366); color: #0b141a; font-weight: 600; cursor: pointer;">
            Return to Chats
          </button>
        </div>
      </div>
    `;
  }
}
