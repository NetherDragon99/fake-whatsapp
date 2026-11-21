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
    this._onUpdateStateEvent = null;
    this._onCacheStatusEvent = null;
  }

  async render(rootEl) {
    this.container = rootEl;
    try {
      let ownerName = 'You';
      let userAvatarBlob = null;
      let storageStats = { formattedSize: '0 B', chatCount: 0, messageCount: 0 };
      let defaultExpandLongMessages = false;
      let defaultNoteMode = false;
      let persistenceInfo = { isPersisted: false };
      let backupStatus = { hasBackup: false, lastStats: null };
      const appVersion = window.APP_VERSION || '2.3.10';
      const cacheStatus = window.__waCacheStatus || null;
      const updateState = (window.app && typeof window.app.getUpdateState === 'function')
        ? window.app.getUpdateState()
        : { updateReady: Boolean(window.app?.updateReady), pendingUpdateVersion: window.app?.pendingUpdateVersion || null, updateDownloading: false, progress: { completed: 0, total: 0 } };
      const cacheSubText = cacheStatus
        ? (cacheStatus.complete
          ? `v${appVersion} • All ${cacheStatus.cached}/${cacheStatus.total} files & media cached offline`
          : `v${appVersion} • ${cacheStatus.cached}/${cacheStatus.total} files cached offline`)
        : `v${appVersion} • Tap to check for updates & sync offline media`;

      try {
        ownerName = await db.getSetting('ownerName', 'You');
        userAvatarBlob = await db.getSetting('userProfileAvatar', null);
        storageStats = await db.getStorageUsage();
        defaultExpandLongMessages = await db.getSetting('defaultExpandLongMessages', false);
        defaultNoteMode = await db.getSetting('defaultNoteMode', false);
        persistenceInfo = await db.getPersistenceInfo().catch(() => ({ isPersisted: false }));
        backupStatus = db.getBackupStatus();
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

          <!-- Chats Behavior & Interactive Guide -->
          <div class="settings-section">
            <div class="settings-section-header">Chats &amp; Guide</div>
            <div class="settings-option-row" id="row-default-expand-long">
              <span class="settings-icon">${Icons.expandAll('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Expand long messages automatically</div>
                <div class="setting-sub">Default for all chats unless overridden per chat</div>
              </div>
              <label class="switch-wrap">
                <input type="checkbox" id="cb-default-expand-long" ${defaultExpandLongMessages ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="settings-option-row" id="row-default-note-mode">
              <span class="settings-icon">${Icons.noteMode('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Note mode (full-width blocks)</div>
                <div class="setting-sub">Default for all chats unless overridden per chat</div>
              </div>
              <label class="switch-wrap">
                <input type="checkbox" id="cb-default-note-mode" ${defaultNoteMode ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="settings-option-row clickable" id="row-features-guide">
              <span class="settings-icon">${Icons.bookGuide('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Features &amp; Shortcuts Guide</div>
                <div class="setting-sub">Live examples for formatting symbols, trees &amp; lists</div>
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
            <div class="settings-option-row clickable" id="row-manage-storage">
              <span class="settings-icon">${Icons.download('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">App Storage Used</div>
                <div class="setting-sub">${storageStats.formattedSize} (${storageStats.chatCount} chats, ${storageStats.messageCount} messages)</div>
              </div>
              <div class="settings-chevron">${Icons.chevronRight('', 18)}</div>
            </div>

            <div class="settings-option-row clickable" id="row-toggle-persist">
              <span class="settings-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                </svg>
              </span>
              <div class="settings-texts">
                <div class="setting-title">Storage Persistence Protection</div>
                <div class="setting-sub" id="settings-persist-status-sub">${persistenceInfo.isPersisted ? 'Active • Protected against browser eviction & updates' : 'Standard • Tap to enable permanent storage protection'}</div>
              </div>
            </div>

            <div class="settings-option-row clickable" id="row-force-backup">
              <span class="settings-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                </svg>
              </span>
              <div class="settings-texts">
                <div class="setting-title">Back Up Now (Permanent Snapshot)</div>
                <div class="setting-sub" id="settings-autobackup-sub">${backupStatus.lastStats ? `Mirror active • ${backupStatus.lastStats.chatCount} chats & ${backupStatus.lastStats.messageCount} msgs backed up` : 'Mirror active • Save latest chats to secondary storage'}</div>
              </div>
            </div>

            <div class="settings-option-row clickable" id="row-restore-autobackup">
              <span class="settings-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                </svg>
              </span>
              <div class="settings-texts">
                <div class="setting-title">Restore from Persistent Auto-Backup</div>
                <div class="setting-sub">Auto-recover conversations if ever lost or wiped</div>
              </div>
            </div>

            <div class="settings-option-row clickable" id="row-export-backup">
              <span class="settings-icon">${Icons.archive('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Export Full Backup (.json)</div>
                <div class="setting-sub">Save all chats and media as a standalone backup file</div>
              </div>
            </div>

            <div class="settings-option-row clickable" id="row-restore-backup">
              <span class="settings-icon">${Icons.forward('', 20)}</span>
              <div class="settings-texts">
                <div class="setting-title">Restore Backup File (.json)</div>
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

          <div class="thick-section-divider"></div>

          <!-- App Updates & Offline Sync -->
          <div class="settings-section">
            <div class="settings-section-header">App Updates</div>
            <div class="settings-update-ready-card" id="settings-update-ready-card" style="${updateState.updateReady ? '' : 'display:none;'}">
              <div class="update-ready-texts">
                <div class="update-ready-title" id="settings-update-ready-title">Update Ready${updateState.pendingUpdateVersion ? ` (v${updateState.pendingUpdateVersion})` : ''}</div>
                <div class="update-ready-sub">Downloaded in background — restart to apply</div>
              </div>
              <button type="button" class="settings-restart-update-btn" id="btn-restart-to-update">Restart to Update</button>
            </div>
            <div class="settings-option-row clickable" id="row-check-updates">
              <span class="settings-icon">
                <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor">
                  <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
                </svg>
              </span>
              <div class="settings-texts">
                <div class="setting-title">Check for Updates &amp; Offline Sync</div>
                <div class="setting-sub" id="settings-update-status-sub">${cacheSubText}</div>
              </div>
              <div class="settings-chevron">
                ${Icons.chevronRight('', 18)}
              </div>
            </div>
          </div>

          <!-- App Version Footer -->
          <div class="settings-footer-version">
            <span>WhatsApp Clone By Steven</span>
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
              <span class="nav-update-dot ${updateState.updateReady ? 'visible' : ''}" id="settings-standalone-update-dot" aria-hidden="true"></span>
            </div>
            <span class="tab-label">Settings</span>
          </a>
        </nav>
      </div>
    `;

      this.bindEvents(isStandalone);
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

    // Global Long Messages Auto-Expand Toggle
    const expandCb = this.container.querySelector('#cb-default-expand-long');
    if (expandCb) {
      expandCb.addEventListener('change', async () => {
        await db.setSetting('defaultExpandLongMessages', expandCb.checked);
        Toast.show(expandCb.checked ? 'Long messages auto-expand enabled' : 'Long messages collapse by default');
      });
    }

    // Global Note Mode Toggle
    const noteModeCb = this.container.querySelector('#cb-default-note-mode');
    if (noteModeCb) {
      noteModeCb.addEventListener('change', async () => {
        await db.setSetting('defaultNoteMode', noteModeCb.checked);
        Toast.show(noteModeCb.checked ? 'Note mode enabled globally' : 'Note mode disabled by default');
      });
    }

    // Features & Shortcuts Guide Navigation
    this.container.querySelector('#row-features-guide')?.addEventListener('click', () => {
      this.router.navigate('#/settings/guide');
    });

    // Chat Lock PIN Setup / Reset
    this.container.querySelector('#row-manage-pin').addEventListener('click', async () => {
      const ok = await PinDialog.promptSetup();
      if (ok) Toast.show('PIN configured successfully');
    });

    // Manage Storage Navigation
    this.container.querySelector('#row-manage-storage')?.addEventListener('click', () => {
      this.router.navigate('#/manage-storage');
    });

    // Toggle / Request Persistent Storage Protection
    this.container.querySelector('#row-toggle-persist')?.addEventListener('click', async () => {
      Toast.show('Checking persistent storage...');
      const granted = await db.ensurePersistence();
      const sub = this.container.querySelector('#settings-persist-status-sub');
      if (sub) {
        sub.textContent = granted
          ? 'Active • Protected against browser eviction & updates'
          : 'Standard • Permission not granted by browser';
      }
      Toast.show(granted ? 'Storage persistence active & protected!' : 'Storage is standard (not granted by browser)');
    });

    // Trigger Immediate Backup Snapshot
    this.container.querySelector('#row-force-backup')?.addEventListener('click', async () => {
      Toast.show('Creating permanent backup...');
      try {
        const snap = await db.forceBackup();
        if (snap) {
          const sub = this.container.querySelector('#settings-autobackup-sub');
          if (sub) {
            sub.textContent = `Mirror active • ${snap.chatCount} chats & ${snap.messageCount} msgs backed up just now`;
          }
          Toast.show(`Backed up ${snap.chatCount} chats & ${snap.messageCount} messages across all tiers!`);
        } else {
          Toast.show('No conversations to back up yet.');
        }
      } catch (err) {
        await showAlert({ title: 'Backup Failed', message: err.message || 'Could not save backup.' });
      }
    });

    // Restore from Persistent Auto-Backup
    this.container.querySelector('#row-restore-autobackup')?.addEventListener('click', async () => {
      try {
        const confirmed = await showConfirm({
          title: 'Restore from Auto-Backup',
          message: 'Restore conversations and settings from your persistent auto-backup mirror?',
          confirmText: 'Restore',
          cancelText: 'Cancel'
        });
        if (confirmed) {
          Toast.show('Restoring from auto-backup...');
          const result = await db.restoreFromAutoBackup();
          Toast.show(`Restored ${result.count} conversations successfully!`);
          setTimeout(() => this.router.navigate('#/chats'), 400);
        }
      } catch (err) {
        await showAlert({ title: 'Restore Failed', message: err.message || 'No auto-backup found to restore.' });
      }
    });

    // Real-time Backup Status Update Listener
    this._onBackupUpdatedEvent = (e) => {
      const stats = e.detail;
      const sub = this.container?.querySelector('#settings-autobackup-sub');
      if (sub && stats) {
        sub.textContent = `Mirror active • ${stats.chatCount} chats & ${stats.messageCount} msgs backed up just now`;
      }
    };
    window.addEventListener('wa:backup-updated', this._onBackupUpdatedEvent);

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

    // Check for Updates, Background Download Progress & Restart to Update
    const appVersion = window.APP_VERSION || '2.3.10';
    const updateRow = this.container.querySelector('#row-check-updates');
    const updateSubEl = this.container.querySelector('#settings-update-status-sub');
    const updateReadyCard = this.container.querySelector('#settings-update-ready-card');
    const updateReadyTitle = this.container.querySelector('#settings-update-ready-title');
    const restartBtn = this.container.querySelector('#btn-restart-to-update');
    const standaloneDot = this.container.querySelector('#settings-standalone-update-dot');

    const refreshCacheLabel = (status) => {
      if (!updateSubEl || !status || !this.container.contains(updateSubEl)) return;
      if (window.app?.updateDownloading) return;
      if (window.app?.updateReady) {
        const verLabel = window.app.pendingUpdateVersion ? `v${window.app.pendingUpdateVersion}` : 'New version';
        updateSubEl.textContent = `v${appVersion} • ${verLabel} ready — tap Restart to Update`;
        return;
      }
      updateSubEl.textContent = status.complete
        ? `v${appVersion} • All ${status.cached}/${status.total} files & media cached offline`
        : `v${appVersion} • ${status.cached}/${status.total} files cached offline`;
    };

    const syncUpdateUI = (state) => {
      if (!state) return;
      if (updateReadyCard) {
        updateReadyCard.style.display = state.updateReady ? 'flex' : 'none';
      }
      if (updateReadyTitle) {
        updateReadyTitle.textContent = state.pendingUpdateVersion
          ? `Update Ready (v${state.pendingUpdateVersion})`
          : 'Update Ready';
      }
      if (standaloneDot) {
        standaloneDot.classList.toggle('visible', Boolean(state.updateReady));
      }
      if (updateSubEl && this.container.contains(updateSubEl)) {
        if (state.updateReady) {
          const verLabel = state.pendingUpdateVersion ? `v${state.pendingUpdateVersion}` : 'New version';
          updateSubEl.textContent = `v${appVersion} • ${verLabel} ready — tap Restart to Update`;
        } else if (state.updateDownloading) {
          const total = state.progress?.total || 0;
          const completed = state.progress?.completed || 0;
          const pct = total > 0 ? Math.min(99, Math.round((completed / total) * 100)) : 0;
          updateSubEl.textContent = total > 0
            ? `v${appVersion} • Downloading update in background... (${pct}%)`
            : `v${appVersion} • Downloading update in background...`;
        } else if (window.__waCacheStatus) {
          refreshCacheLabel(window.__waCacheStatus);
        }
      }
    };

    if (window.app && typeof window.app.getUpdateState === 'function') {
      syncUpdateUI(window.app.getUpdateState());
    }
    if (window.app && typeof window.app.getCacheStatus === 'function') {
      window.app.getCacheStatus().then(refreshCacheLabel).catch(() => { });
    }

    this._onCacheStatusEvent = (e) => {
      if (!this.container || !document.body.contains(this.container)) {
        this.cleanup();
        return;
      }
      refreshCacheLabel(e.detail);
    };
    this._onUpdateStateEvent = (e) => {
      if (!this.container || !document.body.contains(this.container)) {
        this.cleanup();
        return;
      }
      syncUpdateUI(e.detail);
    };
    window.addEventListener('wa:cache-status', this._onCacheStatusEvent);
    window.addEventListener('wa:update-state', this._onUpdateStateEvent);
    window.addEventListener('app-update-state-change', this._onUpdateStateEvent);

    restartBtn?.addEventListener('click', async () => {
      if (!window.app || typeof window.app.applyPendingUpdate !== 'function') return;
      restartBtn.disabled = true;
      restartBtn.textContent = 'Restarting...';
      await window.app.applyPendingUpdate();
    });

    updateRow?.addEventListener('click', async () => {
      if (!window.app || typeof window.app.checkForUpdates !== 'function') {
        Toast.show('Updater not available in this context');
        return;
      }
      if (updateSubEl && !window.app.updateReady) {
        updateSubEl.textContent = `v${appVersion} • Checking for updates in background...`;
      }
      await window.app.checkForUpdates({ manual: true, syncMissing: true });
      syncUpdateUI(window.app.getUpdateState?.());
      const latest = await window.app.getCacheStatus().catch(() => null);
      if (latest) {
        refreshCacheLabel(latest);
      } else if (updateSubEl && !window.app.updateReady && !window.app.updateDownloading) {
        updateSubEl.textContent = `v${appVersion} • Tap to check for updates & sync offline media`;
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

    // Bottom Navigation explicit routing (Task 2 - fallback when standalone)
    this.container.querySelectorAll('.wa-bottom-nav .nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (href) this.router.navigate(href);
      });
    });
  }

  cleanup() {
    if (this._onBackupUpdatedEvent) {
      window.removeEventListener('wa:backup-updated', this._onBackupUpdatedEvent);
      this._onBackupUpdatedEvent = null;
    }
    if (this._onCacheStatusEvent) {
      window.removeEventListener('wa:cache-status', this._onCacheStatusEvent);
      this._onCacheStatusEvent = null;
    }
    if (this._onUpdateStateEvent) {
      window.removeEventListener('wa:update-state', this._onUpdateStateEvent);
      window.removeEventListener('app-update-state-change', this._onUpdateStateEvent);
      this._onUpdateStateEvent = null;
    }
  }
}
