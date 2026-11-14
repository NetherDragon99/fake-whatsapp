// Smart Import Engine & Add Chat Modal with New Chat Creator and Archive Import
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { WhatsAppParser } from '../parser.js';
import { Toast } from './toast.js';
import { showAlert } from './custom-dialog.js';
import { openImageCropper } from './image-cropper.js';
import { assetUrl } from '../config/base-path.js';
import { DrawerResizer } from '../utils/drawer-resizer.js';

export class ImportModal {
  constructor(options = {}) {
    this.onComplete = options.onComplete || (() => { });
    this.overlay = null;
    this.resizer = null;
    this.parser = new WhatsAppParser();
    this.chatAvatarBlob = null;
    this.newChatAvatarBlob = null;
    this.pendingOverrideName = null;
    this.pendingOverrideAvatar = null;
    this.isAutoCreatingDemo = false;
    this.rawParseResult = null;
    this.extractedMediaFiles = new Map();
    this.existingChatId = null;
  }

  show() {
    this.close();

    this.overlay = document.createElement('div');
    this.overlay.className = 'wa-modal-overlay';

    this.overlay.innerHTML = `
      <div class="wa-modal-sheet" id="import-sheet">
        <div class="sheet-drag-handle-bar" id="import-sheet-handle">
          <div class="sheet-drag-handle"></div>
        </div>
        <!-- Fullscreen Header (active when dragged > 80%) -->
        <div class="sheet-fullscreen-header" id="import-fullscreen-header" style="display:none;">
          <button type="button" class="sheet-fullscreen-back-btn" id="btn-import-fullscreen-back" aria-label="Close">
            ${Icons.arrowBack('', 22)}
          </button>
          <div class="sheet-fullscreen-title" id="import-fullscreen-title">Add Chat</div>
        </div>
        <div class="sheet-header">
          <button class="sheet-close-btn">${Icons.close('', 22)}</button>
          <h2 class="sheet-title" id="import-sheet-title">Add Chat</h2>
        </div>

        <div class="sheet-body" id="import-body">
          <!-- Step 0: Menu Selection (Default view) -->
          <div class="import-step" id="step-menu-select">
            <div class="add-chat-menu-list">
              <button type="button" class="add-chat-menu-item" id="btn-menu-new-chat">
                <div class="menu-item-icon-circle green">
                  ${Icons.chatPlus('', 24)}
                </div>
                <div class="menu-item-text-group">
                  <div class="menu-item-title">New Private Chat</div>
                  <div class="menu-item-subtitle">Start a new conversation with custom name & photo</div>
                </div>
                <div class="menu-item-chevron">${Icons.chevronRight('', 18)}</div>
              </button>

              <button type="button" class="add-chat-menu-item" id="btn-menu-import-archive">
                <div class="menu-item-icon-circle teal">
                  ${Icons.archive('', 24)}
                </div>
                <div class="menu-item-text-group">
                  <div class="menu-item-title">Import Chat Archive</div>
                  <div class="menu-item-subtitle">Import an exported .zip or .txt WhatsApp chat</div>
                </div>
                <div class="menu-item-chevron">${Icons.chevronRight('', 18)}</div>
              </button>
            </div>
          </div>

          <!-- Step 1: Create New Chat Form -->
          <div class="import-step" id="step-new-chat" style="display:none;">
            <div class="new-chat-form-wrap">
              <button type="button" class="substep-back-btn" id="btn-back-to-menu-from-new">
                ${Icons.arrowBack('', 18)} <span>Back to options</span>
              </button>

              <!-- Profile Avatar Picker -->
              <div class="new-chat-avatar-section">
                <div class="new-chat-avatar-wrap" id="new-chat-avatar-wrap" title="Set profile photo">
                  <div class="new-chat-avatar-circle" id="new-chat-avatar-preview">
                    ${Icons.userAvatar('', 44)}
                  </div>
                  <label class="new-chat-avatar-badge" title="Upload photo">
                    <input type="file" id="new-chat-avatar-input" accept="image/*" style="display:none;" />
                    ${Icons.camera('', 16)}
                  </label>
                </div>
                <div class="new-chat-avatar-label">Add profile photo</div>
              </div>

              <!-- Contact Name Input -->
              <div class="new-chat-field-group">
                <label for="new-chat-name-input" class="field-label">Contact or Chat Name</label>
                <input type="text" id="new-chat-name-input" class="wa-text-input" placeholder="e.g. John Doe" dir="auto" />
              </div>

              <!-- Preload with Demo Data Option -->
              <div class="new-chat-demo-card">
                <label class="toggle-card-label" for="toggle-new-chat-demo">
                  <div class="toggle-card-texts">
                    <span class="toggle-card-title">Fill with default demo data</span>
                    <span class="toggle-card-desc">Pre-load conversation with realistic messages, photos, voice notes, and calls</span>
                  </div>
                  <input type="checkbox" id="toggle-new-chat-demo" class="wa-checkbox" />
                </label>
              </div>

              <!-- Submit Create Button -->
              <button type="button" class="sheet-primary-btn" id="btn-submit-create-chat">
                Create Chat
              </button>
            </div>
          </div>

          <!-- Step 2: File Selection (Import) -->
          <div class="import-step" id="step-file-select" style="display:none;">
            <button type="button" class="substep-back-btn" id="btn-back-to-menu-from-import">
              ${Icons.arrowBack('', 18)} <span>Back to options</span>
            </button>
            <div class="import-dropzone" id="import-dropzone">
              <div class="dropzone-icon">${Icons.archive('', 48)}</div>
              <h3>Select WhatsApp Export</h3>
              <p>Choose an exported <b>.zip</b> archive or a <b>.txt</b> chat file (with media).</p>
              <label class="file-picker-btn">
                <span>Browse Files</span>
                <input type="file" id="archive-file-input" accept=".zip,.txt" style="display:none;" />
              </label>
              <div class="support-hint">Supports Android & iOS exports in English & Arabic</div>
            </div>
          </div>

          <!-- Step 3: Unpacking & Progress -->
          <div class="import-step" id="step-progress" style="display:none;">
            <div class="progress-wrap">
              <div class="progress-spinner"></div>
              <div class="progress-status-title" id="progress-title">Unpacking archive...</div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" id="progress-fill" style="width: 10%;"></div>
              </div>
              <div class="progress-status-sub" id="progress-sub">Reading files into memory...</div>
            </div>
          </div>

          <!-- Step 4: Perspective & Setup Form -->
          <div class="import-step" id="step-setup" style="display:none;">
            <div class="setup-form-wrap">
              <h3 class="setup-section-title">Who is "Me" in this conversation?</h3>
              <p class="setup-desc">Select which participant represents you so your messages appear on the right with blue checkmarks.</p>
              
              <div class="participants-radio-list" id="participants-list"></div>

              <div class="toggle-row">
                <label class="toggle-label" for="toggle-self-chat">
                  <span>Message yourself (Self Chat)</span>
                  <input type="checkbox" id="toggle-self-chat" />
                </label>
              </div>

              <div class="toggle-row">
                <label class="toggle-label" for="toggle-group-chat">
                  <span>Group conversation</span>
                  <input type="checkbox" id="toggle-group-chat" />
                </label>
              </div>

              <!-- Chat Profile Photo Picker -->
              <div class="setup-avatar-section">
                <div class="setup-avatar-wrap" id="setup-chat-avatar-wrap" title="Change profile photo">
                  <div class="setup-avatar-circle" id="setup-avatar-preview">
                    ${Icons.userAvatar('', 36)}
                  </div>
                  <div class="setup-avatar-badge" title="Upload photo">
                    ${Icons.camera('', 14)}
                  </div>
                  <input type="file" id="setup-avatar-file-input" accept="image/*" style="display:none;" />
                </div>
                <div class="setup-avatar-info">
                  <span class="setup-avatar-label">Chat Profile Photo</span>
                  <span class="setup-avatar-sub">Tap to customize the contact or group picture</span>
                </div>
              </div>

              <div class="input-group">
                <label for="chat-display-name">Chat Name</label>
                <input type="text" id="chat-display-name" class="wa-text-input" placeholder="Enter contact or group name" />
              </div>

              <!-- Overlap Option if existing chat matches -->
              <div id="overlap-merge-box" class="overlap-box" style="display:none;">
                <h4>Existing conversation found</h4>
                <div class="radio-option">
                  <label>
                    <input type="radio" name="overlap-choice" value="merge" checked />
                    <span>Merge & Deduplicate into existing chat</span>
                  </label>
                </div>
                <div class="radio-option">
                  <label>
                    <input type="radio" name="overlap-choice" value="new" />
                    <span>Create as a new separate chat</span>
                  </label>
                </div>
              </div>

              <button class="sheet-primary-btn" id="btn-finish-import">
                Restore & Open Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Initialize Universal Resizable Drawer
    this.resizer = new DrawerResizer({
      sheet: this.overlay.querySelector('#import-sheet'),
      handle: this.overlay.querySelector('#import-sheet-handle'),
      backdrop: this.overlay,
      fullscreenHeader: this.overlay.querySelector('#import-fullscreen-header'),
      overlayId: 'import-sheet',
      defaultHeightVh: 75,
      minVh: 20,
      maxVh: 80,
      onClose: () => {
        this.chatAvatarBlob = null;
        this.newChatAvatarBlob = null;
        this.pendingOverrideName = null;
        this.pendingOverrideAvatar = null;
        this.isAutoCreatingDemo = false;
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
      }
    });

    this.resizer.open(75);

    // Close buttons (standard header & fullscreen header)
    this.overlay.querySelector('.sheet-close-btn').addEventListener('click', () => this.close());
    const fsBackBtn = this.overlay.querySelector('#btn-import-fullscreen-back');
    if (fsBackBtn) {
      fsBackBtn.addEventListener('click', () => this.close());
    }
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // --- Menu Selection Navigation ---
    const menuSelectStep = this.overlay.querySelector('#step-menu-select');
    const newChatStep = this.overlay.querySelector('#step-new-chat');
    const fileSelectStep = this.overlay.querySelector('#step-file-select');

    this.overlay.querySelector('#btn-menu-new-chat').addEventListener('click', () => {
      this.showStep('step-new-chat');
      this.setTitle('New Private Chat');
      setTimeout(() => {
        this.overlay.querySelector('#new-chat-name-input')?.focus();
      }, 100);
    });

    this.overlay.querySelector('#btn-menu-import-archive').addEventListener('click', () => {
      this.showStep('step-file-select');
      this.setTitle('Import Chat Archive');
    });

    this.overlay.querySelector('#btn-back-to-menu-from-new').addEventListener('click', () => {
      this.showStep('step-menu-select');
      this.setTitle('Add Chat');
    });

    this.overlay.querySelector('#btn-back-to-menu-from-import').addEventListener('click', () => {
      this.showStep('step-menu-select');
      this.setTitle('Add Chat');
    });

    // --- New Chat Form Events ---
    const newAvatarWrap = this.overlay.querySelector('#new-chat-avatar-wrap');
    const newAvatarInput = this.overlay.querySelector('#new-chat-avatar-input');
    const newAvatarPreview = this.overlay.querySelector('#new-chat-avatar-preview');

    newAvatarWrap.addEventListener('click', () => {
      newAvatarInput.click();
    });

    newAvatarInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        try {
          const cropped = await openImageCropper(file);
          if (cropped) {
            this.newChatAvatarBlob = cropped;
            newAvatarPreview.innerHTML = `<img src="${URL.createObjectURL(cropped)}" alt="Avatar" />`;
          }
        } catch (cropErr) {
          console.warn('Avatar cropping failed or cancelled:', cropErr);
        }
        newAvatarInput.value = '';
      }
    });

    this.overlay.querySelector('#btn-submit-create-chat').addEventListener('click', async () => {
      const nameInput = this.overlay.querySelector('#new-chat-name-input');
      const chatName = (nameInput.value || '').trim() || 'New Chat';
      const isDemo = this.overlay.querySelector('#toggle-new-chat-demo').checked;

      if (!isDemo) {
        await this.createEmptyChat(chatName, this.newChatAvatarBlob);
      } else {
        await this.createChatWithDemo(chatName, this.newChatAvatarBlob);
      }
    });

    // --- File Selection & Import Events ---
    const fileInput = this.overlay.querySelector('#archive-file-input');
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processSelectedFile(e.target.files[0]);
      }
    });

    // Drag and drop handling
    const dropzone = this.overlay.querySelector('#import-dropzone');
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-active'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processSelectedFile(e.dataTransfer.files[0]);
      }
    });
  }

  setTitle(title) {
    const sheetTitle = this.overlay?.querySelector('#import-sheet-title');
    const fsTitle = this.overlay?.querySelector('#import-fullscreen-title');
    if (sheetTitle) sheetTitle.textContent = title;
    if (fsTitle) fsTitle.textContent = title;
  }

  async createEmptyChat(name, avatarBlob) {
    const chatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const chatRecord = {
      id: chatId,
      name: name.trim() || 'New Chat',
      avatarBlob: avatarBlob || null,
      participantNames: [name.trim() || 'Contact', 'You'],
      meParticipant: 'You',
      isGroup: false,
      isSelfChat: false,
      isPinned: false,
      isArchived: false,
      isLocked: false,
      unreadCount: 0,
      lastMessage: null,
      customFilterIds: [],
      updatedAt: Date.now()
    };

    await db.saveChat(chatRecord);
    Toast.show(`Chat created: ${chatRecord.name}`);
    this.close();
    if (this.onComplete) {
      this.onComplete(chatId);
    }
  }

  async createChatWithDemo(name, avatarBlob) {
    this.pendingOverrideName = name;
    this.pendingOverrideAvatar = avatarBlob;
    this.isAutoCreatingDemo = true;
    this.showStep('step-progress');
    this.setTitle('Creating Chat...');
    this.updateProgress(15, 'Loading built-in demo archive...');

    try {
      const resp = await fetch(assetUrl('assets/demo_whatsapp_archive.zip'));
      const blob = await resp.blob();
      const file = new File([blob], 'demo_whatsapp_archive.zip', { type: 'application/zip' });
      await this.processSelectedFile(file);
    } catch (err) {
      console.error('Demo loading failed:', err);
      showAlert({ title: 'Error Loading Demo', message: 'Could not load demo archive: ' + err.message });
      this.showStep('step-new-chat');
      this.setTitle('New Private Chat');
    }
  }

  updateProgress(percent, title, sub = '') {
    const fill = this.overlay?.querySelector('#progress-fill');
    const titleEl = this.overlay?.querySelector('#progress-title');
    const subEl = this.overlay?.querySelector('#progress-sub');
    if (fill) fill.style.width = `${percent}%`;
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;
  }

  showStep(stepId) {
    this.overlay?.querySelectorAll('.import-step').forEach((s) => (s.style.display = 'none'));
    const target = this.overlay?.querySelector(`#${stepId}`);
    if (target) target.style.display = 'block';
  }

  async processSelectedFile(file) {
    this.showStep('step-progress');
    this.updateProgress(15, 'Unpacking archive...', file.name);

    let chatText = '';
    const mediaFiles = new Map(); // cleanBasename -> { filename, uint8Array, size }

    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        // Decompress using local fflate
        const unzipped = await new Promise((resolve, reject) => {
          if (typeof window.fflate === 'undefined') {
            reject(new Error('fflate library not loaded'));
            return;
          }
          window.fflate.unzip(uint8, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        this.updateProgress(45, 'Scanning chat log and media...');

        // Find the chat text file
        let chatFileKey = null;
        for (const filename of Object.keys(unzipped)) {
          const lower = filename.toLowerCase();
          if (lower.endsWith('.txt')) {
            if (lower.includes('_chat') || lower.includes('chat') || lower.includes('دردشة') || !chatFileKey) {
              chatFileKey = filename;
            }
          }
        }

        if (!chatFileKey) {
          throw new Error('No .txt chat export found inside this zip archive.');
        }

        // Decode chat text
        const decoder = new TextDecoder('utf-8');
        chatText = decoder.decode(unzipped[chatFileKey]);

        // Map media files by normalized base filename
        for (const [filename, fileData] of Object.entries(unzipped)) {
          if (filename === chatFileKey || filename.endsWith('/')) continue;
          const cleanName = this.parser.normalizeFilename(filename);
          mediaFiles.set(cleanName, {
            originalName: filename,
            cleanName,
            data: fileData,
            size: fileData.byteLength
          });
        }
      } else {
        // Direct .txt file
        chatText = await file.text();
      }

      this.updateProgress(65, 'Parsing messages & contacts...');
      const parseResult = this.parser.parseChatLog(chatText);

      if (parseResult.messages.length === 0) {
        throw new Error('No valid WhatsApp messages found in the selected file.');
      }

      // Auto-detect avatar/profile picture from archive media files
      let detectedAvatar = null;
      for (const [cleanName, fileItem] of mediaFiles.entries()) {
        const lower = cleanName.toLowerCase();
        if (/\.(jpg|jpeg|png|webp)$/i.test(lower)) {
          if (lower.includes('profile') || lower.includes('avatar') || lower.includes('contact') || lower.includes('user')) {
            detectedAvatar = fileItem;
            break;
          }
          if (!detectedAvatar && (lower === 'photo.jpg' || lower === 'photo.png' || lower === 'photo.webp')) {
            detectedAvatar = fileItem;
          }
        }
      }

      if (detectedAvatar) {
        let mime = 'image/jpeg';
        if (detectedAvatar.cleanName.endsWith('.png')) mime = 'image/png';
        if (detectedAvatar.cleanName.endsWith('.webp')) mime = 'image/webp';
        this.chatAvatarBlob = new Blob([detectedAvatar.data], { type: mime });
      } else {
        this.chatAvatarBlob = null;
      }

      this.rawParseResult = parseResult;
      this.extractedMediaFiles = mediaFiles;
      this.archiveFileName = file.name;

      this.showSetupStep(parseResult);
    } catch (err) {
      console.error('Import failed:', err);
      showAlert({ title: 'Import Failed', message: 'Import error: ' + (err.message || 'Failed to parse file') });
      this.showStep('step-file-select');
      this.setTitle('Import Chat Archive');
    }
  }

  async showSetupStep(parseResult) {
    if (this.isAutoCreatingDemo) {
      // Direct automatic import with user's chosen custom name and avatar
      await this.executeFinalImport();
      return;
    }

    this.showStep('step-setup');
    this.setTitle('Chat Setup');
    const participantsList = this.overlay.querySelector('#participants-list');
    participantsList.innerHTML = '';

    const participants = parseResult.participants;

    // Detect if any participant is named "Me", "You", or "أنا" or matches current user profile name
    let defaultMeIndex = 0;
    try {
      const savedOwnerName = await db.getSetting('userProfileName', '');
      if (participants.length === 2) {
        const meIdx = participants.findIndex((p) => {
          const lower = p.trim().toLowerCase();
          return lower === 'me' || lower === 'you' || lower === 'أنا' || (savedOwnerName && lower === savedOwnerName.toLowerCase());
        });
        if (meIdx !== -1) {
          defaultMeIndex = meIdx;
        }
      }
    } catch (e) {
      console.warn('Failed reading userProfileName setting:', e);
    }

    const nameInput = this.overlay.querySelector('#chat-display-name');
    const selfChatToggle = this.overlay.querySelector('#toggle-self-chat');
    const groupChatToggle = this.overlay.querySelector('#toggle-group-chat');

    if (participants.length === 1) {
      selfChatToggle.checked = true;
    }
    if (participants.length >= 3) {
      groupChatToggle.checked = true;
    }

    // Determine chat name: for 1-on-1, it is the OTHER participant
    const getChatNameForMeIndex = (meIdx) => {
      if (participants.length === 1) {
        return `${participants[0]} (You)`;
      } else if (participants.length === 2) {
        const otherIdx = meIdx === 0 ? 1 : 0;
        return participants[otherIdx];
      } else {
        return 'Group Chat';
      }
    };

    nameInput.value = getChatNameForMeIndex(defaultMeIndex);

    // Render participant radio buttons with defaultMeIndex checked
    participants.forEach((name, idx) => {
      const option = document.createElement('div');
      option.className = 'participant-radio-item';
      option.innerHTML = `
        <label>
          <input type="radio" name="me-selector" value="${name}" ${idx === defaultMeIndex ? 'checked' : ''} />
          <span class="participant-name">${name}</span>
        </label>
      `;
      participantsList.appendChild(option);
    });

    const checkOverlap = async (chatNameToTest) => {
      const existingChats = await db.getChats();
      const matchingChat = existingChats.find((c) => c.name.toLowerCase() === chatNameToTest.toLowerCase());
      const overlapBox = this.overlay.querySelector('#overlap-merge-box');
      if (matchingChat) {
        overlapBox.style.display = 'block';
        this.existingChatId = matchingChat.id;
      } else {
        overlapBox.style.display = 'none';
        this.existingChatId = null;
      }
    };

    await checkOverlap(nameInput.value);

    // When user changes who "Me" is in a 1-on-1 conversation, dynamically set chat name to the OTHER participant
    const radios = participantsList.querySelectorAll('input[name="me-selector"]');
    radios.forEach((r) => {
      r.addEventListener('change', async () => {
        if (participants.length === 2 && !groupChatToggle.checked) {
          const selectedIdx = participants.indexOf(r.value);
          if (selectedIdx !== -1) {
            const otherIdx = selectedIdx === 0 ? 1 : 0;
            nameInput.value = participants[otherIdx];
            await checkOverlap(nameInput.value);
          }
        }
      });
    });

    // Avatar preview management
    const updateAvatarPreview = () => {
      const preview = this.overlay.querySelector('#setup-avatar-preview');
      if (!preview) return;
      if (this.chatAvatarBlob) {
        preview.innerHTML = `<img src="${URL.createObjectURL(this.chatAvatarBlob)}" class="setup-avatar-img" alt="Avatar" />`;
      } else {
        preview.innerHTML = groupChatToggle.checked ? Icons.groupAvatar('', 36) : Icons.userAvatar('', 36);
      }
    };

    updateAvatarPreview();

    const avatarWrap = this.overlay.querySelector('#setup-chat-avatar-wrap');
    const avatarInput = this.overlay.querySelector('#setup-avatar-file-input');

    avatarWrap.onclick = () => {
      avatarInput.click();
    };

    avatarInput.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        try {
          const cropped = await openImageCropper(file);
          if (cropped) {
            this.chatAvatarBlob = cropped;
            updateAvatarPreview();
          }
        } catch (cropErr) {
          console.warn('Avatar cropping failed or cancelled:', cropErr);
        }
        avatarInput.value = '';
      }
    };

    groupChatToggle.addEventListener('change', () => {
      if (!this.chatAvatarBlob) {
        updateAvatarPreview();
      }
    });

    // Wire Finish Button
    this.overlay.querySelector('#btn-finish-import').onclick = () => {
      this.executeFinalImport();
    };
  }

  async executeFinalImport() {
    let meName = '';
    let isSelfChat = false;
    let isGroup = false;
    let chatName = 'WhatsApp Chat';
    let overlapChoice = 'new';

    if (this.isAutoCreatingDemo) {
      chatName = this.pendingOverrideName || (this.rawParseResult?.participants?.find(p => !/^(me|you|أنا|انا)$/i.test(p.trim())) || 'Steven Mario');
      meName = (this.rawParseResult && this.rawParseResult.participants)
        ? (this.rawParseResult.participants.find(p => /^(me|you|أنا|انا)$/i.test(p.trim())) ||
          this.rawParseResult.participants.find(p => p.toLowerCase() !== chatName.toLowerCase()) ||
          this.rawParseResult.participants[1] ||
          this.rawParseResult.participants[0])
        : 'You';
      isSelfChat = false;
      isGroup = false;
      overlapChoice = 'new';
    } else {
      const selectedMeRadio = this.overlay.querySelector('input[name="me-selector"]:checked');
      meName = selectedMeRadio ? selectedMeRadio.value : '';
      isSelfChat = this.overlay.querySelector('#toggle-self-chat').checked;
      isGroup = this.overlay.querySelector('#toggle-group-chat').checked;
      chatName = this.overlay.querySelector('#chat-display-name').value.trim() || 'WhatsApp Chat';
      overlapChoice = this.overlay.querySelector('input[name="overlap-choice"]:checked')?.value || 'new';
    }

    this.showStep('step-progress');
    this.updateProgress(75, 'Processing media & PDF previews...');

    const chatId = (overlapChoice === 'merge' && this.existingChatId) ? this.existingChatId : 'chat_' + Date.now();
    const mediaBatch = [];
    const mediaIdMap = new Map(); // cleanName -> mediaId
    const mediaDurationMap = new Map(); // cleanName -> duration seconds

    // Index message timestamps by normalized mediaName for authentic media dating
    const msgTimestampByMediaName = new Map();
    if (this.rawParseResult && this.rawParseResult.messages) {
      for (const m of this.rawParseResult.messages) {
        if (m.mediaName && m.timestamp) {
          const norm = this.parser.normalizeFilename(m.mediaName);
          if (!msgTimestampByMediaName.has(norm)) {
            msgTimestampByMediaName.set(norm, m.timestamp);
          }
        }
      }
    }

    // Process media files and PDF thumbnails in advance
    let processedCount = 0;
    const totalMedia = this.extractedMediaFiles.size;

    for (const [cleanName, fileItem] of this.extractedMediaFiles.entries()) {
      const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      mediaIdMap.set(cleanName, mediaId);
      const itemTimestamp = msgTimestampByMediaName.get(cleanName) || Date.now();

      const type = this.parser.categorizeMedia(cleanName);
      let mimeType = 'application/octet-stream';
      if (type === 'sticker') mimeType = 'image/webp';
      if (type === 'image') mimeType = 'image/jpeg';
      if (type === 'video') mimeType = 'video/mp4';
      if (type === 'pdf') mimeType = 'application/pdf';
      if (type === 'audio') {
        if (/\.(opus|ogg)$/i.test(cleanName)) mimeType = 'audio/ogg; codecs=opus';
        else if (/\.(m4a|aac)$/i.test(cleanName)) mimeType = 'audio/mp4';
        else if (/\.mp3$/i.test(cleanName)) mimeType = 'audio/mpeg';
        else if (/\.wav$/i.test(cleanName)) mimeType = 'audio/wav';
        else if (/\.webm$/i.test(cleanName)) mimeType = 'audio/webm';
        else mimeType = 'audio/ogg';
      }

      let audioDuration = 0;
      if (type === 'audio') {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            const decoded = await ctx.decodeAudioData(fileItem.data.buffer.slice(0));
            if (decoded && isFinite(decoded.duration)) {
              audioDuration = Math.max(1, Math.round(decoded.duration));
            }
            try { ctx.close(); } catch (e) { }
          }
        } catch (decErr) {
          audioDuration = 0;
        }
        mediaDurationMap.set(cleanName, audioDuration);
      }

      const blob = new Blob([fileItem.data], { type: mimeType });
      let thumbnailBlob = null;
      let pageCount = 0;

      // Generate PDF Thumbnail Page 1 if pdf.js is loaded
      if (type === 'pdf' && window.pdfjsLib) {
        try {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
          const loadingTask = window.pdfjsLib.getDocument({ data: fileItem.data });
          const pdfDoc = await loadingTask.promise;
          pageCount = pdfDoc.numPages;

          const page = await pdfDoc.getPage(1);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport: viewport }).promise;
          thumbnailBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
        } catch (pdfErr) {
          console.warn('[PDF.js fallback] Failed to render thumbnail for:', cleanName, pdfErr);
          thumbnailBlob = null;
        }
      }

      mediaBatch.push({
        id: mediaId,
        chatId,
        filename: cleanName,
        type,
        mimeType,
        blob,
        thumbnailBlob,
        size: fileItem.size,
        duration: audioDuration,
        pageCount,
        timestamp: itemTimestamp
      });

      processedCount++;
      if (totalMedia > 0) {
        const pct = 75 + Math.round((processedCount / totalMedia) * 15);
        this.updateProgress(pct, `Processing media (${processedCount}/${totalMedia})...`);
      }
    }

    this.updateProgress(90, 'Writing messages to database...');

    // Assign perspective and link media
    const messages = this.rawParseResult.messages.map((m) => {
      const isOutgoing = isSelfChat || (m.sender === meName);
      let linkedMediaId = null;
      let cleanMediaName = null;

      if (m.mediaName) {
        cleanMediaName = this.parser.normalizeFilename(m.mediaName);
        if (mediaIdMap.has(cleanMediaName)) {
          linkedMediaId = mediaIdMap.get(cleanMediaName);
        }
      }

      const isVoice = m.mediaType === 'audio' || (cleanMediaName && /\.(opus|ogg|m4a|aac|mp3|wav)$/i.test(cleanMediaName));
      const mediaDur = cleanMediaName ? (mediaDurationMap.get(cleanMediaName) || 0) : 0;

      return {
        ...m,
        chatId,
        isOutgoing,
        mediaId: linkedMediaId,
        isVoiceNote: isVoice,
        duration: m.duration || mediaDur || 0
      };
    });

    // Prepare Calls records
    const calls = this.rawParseResult.calls.map((c) => ({
      ...c,
      chatId,
      contactName: chatName
    }));

    // Save batch to IndexedDB
    await db.saveMediaBatch(mediaBatch);
    await db.saveMessages(messages);
    await db.saveCallsBatch(calls);

    // Save Chat metadata
    const lastMsg = messages[messages.length - 1] || null;
    const finalAvatar = this.pendingOverrideAvatar || this.chatAvatarBlob || null;
    const chatRecord = {
      id: chatId,
      name: chatName,
      avatarBlob: finalAvatar,
      participantNames: this.rawParseResult.participants,
      meParticipant: meName,
      isGroup,
      isSelfChat,
      isPinned: false,
      isArchived: false,
      isLocked: false,
      unreadCount: 0,
      lastMessage: lastMsg ? {
        text: lastMsg.text,
        timestamp: lastMsg.timestamp,
        isOutgoing: lastMsg.isOutgoing,
        mediaType: lastMsg.mediaType
      } : null,
      customFilterIds: [],
      updatedAt: Date.now()
    };

    await db.saveChat(chatRecord);

    this.updateProgress(100, 'Creation complete!');
    Toast.show(`Chat ready: ${chatName}`);

    setTimeout(() => {
      this.close();
      if (this.onComplete) {
        this.onComplete(chatId);
      }
    }, 400);
  }

  close() {
    this.chatAvatarBlob = null;
    this.newChatAvatarBlob = null;
    this.pendingOverrideName = null;
    this.pendingOverrideAvatar = null;
    this.isAutoCreatingDemo = false;
    if (this.resizer && this.resizer.isOpen) {
      this.resizer.close();
      return;
    }
    if (this.overlay) {
      const closingEl = this.overlay;
      closingEl.classList.add('closing');
      setTimeout(() => closingEl.remove(), 260);
      this.overlay = null;
    }
  }
}
