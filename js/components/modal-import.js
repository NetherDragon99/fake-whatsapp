// Smart Import Engine & Interactive Perspective Setup Modal
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { WhatsAppParser } from '../parser.js';
import { Toast } from './toast.js';
import { showAlert } from './custom-dialog.js';
import { assetUrl } from '../config/base-path.js';

export class ImportModal {
  constructor(options = {}) {
    this.onComplete = options.onComplete || (() => {});
    this.overlay = null;
    this.parser = new WhatsAppParser();
  }

  show() {
    this.close();

    this.overlay = document.createElement('div');
    this.overlay.className = 'wa-modal-overlay';

    this.overlay.innerHTML = `
      <div class="wa-modal-sheet" id="import-sheet">
        <div class="sheet-drag-handle"></div>
        <div class="sheet-header">
          <button class="sheet-close-btn">${Icons.close('', 22)}</button>
          <h2 class="sheet-title">Import WhatsApp Archive</h2>
        </div>

        <div class="sheet-body" id="import-body">
          <!-- Step 1: File Selection -->
          <div class="import-step" id="step-file-select">
            <div class="import-dropzone" id="import-dropzone">
              <div class="dropzone-icon">${Icons.archive('', 48)}</div>
              <h3>Select WhatsApp Export</h3>
              <p>Choose an exported <b>.zip</b> archive or a <b>.txt</b> chat file (with media).</p>
              <label class="file-picker-btn">
                <span>Browse Files</span>
                <input type="file" id="archive-file-input" accept=".zip,.txt" style="display:none;" />
              </label>
              <button type="button" class="demo-archive-btn" id="btn-load-demo-archive">
                Try with Built-in Demo Archive
              </button>
              <div class="support-hint">Supports Android & iOS exports in English & Arabic</div>
            </div>
          </div>

          <!-- Step 2: Unpacking & Progress -->
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

          <!-- Step 3: Perspective & Setup Form -->
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

    // Close button
    this.overlay.querySelector('.sheet-close-btn').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    const fileInput = this.overlay.querySelector('#archive-file-input');
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processSelectedFile(e.target.files[0]);
      }
    });

    const demoBtn = this.overlay.querySelector('#btn-load-demo-archive');
    if (demoBtn) {
      demoBtn.addEventListener('click', async () => {
        try {
          const resp = await fetch(assetUrl('assets/demo_whatsapp_archive.zip'));
          const blob = await resp.blob();
          const file = new File([blob], 'demo_whatsapp_archive.zip', { type: 'application/zip' });
          this.processSelectedFile(file);
        } catch (err) {
          showAlert({ title: 'Error Loading Demo', message: 'Could not load demo archive: ' + err.message });
        }
      });
    }

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

  updateProgress(percent, title, sub = '') {
    const fill = this.overlay.querySelector('#progress-fill');
    const titleEl = this.overlay.querySelector('#progress-title');
    const subEl = this.overlay.querySelector('#progress-sub');
    if (fill) fill.style.width = `${percent}%`;
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;
  }

  showStep(stepId) {
    this.overlay.querySelectorAll('.import-step').forEach((s) => (s.style.display = 'none'));
    const target = this.overlay.querySelector(`#${stepId}`);
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

      this.rawParseResult = parseResult;
      this.extractedMediaFiles = mediaFiles;
      this.archiveFileName = file.name;

      this.showSetupStep(parseResult);
    } catch (err) {
      console.error('Import failed:', err);
      showAlert({ title: 'Import Failed', message: 'Import error: ' + (err.message || 'Failed to parse file') });
      this.showStep('step-file-select');
    }
  }

  async showSetupStep(parseResult) {
    this.showStep('step-setup');
    const participantsList = this.overlay.querySelector('#participants-list');
    participantsList.innerHTML = '';

    const participants = parseResult.participants;
    let defaultMe = participants[0] || 'Me';

    // Auto-detect chat name from archive or participants
    let autoChatName = '';
    if (participants.length === 1) {
      autoChatName = `${participants[0]} (You)`;
    } else if (participants.length === 2) {
      autoChatName = participants[1]; // default other person
    } else {
      autoChatName = 'Group Chat';
    }

    const nameInput = this.overlay.querySelector('#chat-display-name');
    nameInput.value = autoChatName;

    const selfChatToggle = this.overlay.querySelector('#toggle-self-chat');
    const groupChatToggle = this.overlay.querySelector('#toggle-group-chat');

    if (participants.length === 1) {
      selfChatToggle.checked = true;
    }
    if (participants.length >= 3) {
      groupChatToggle.checked = true;
    }

    // Render participant radio buttons
    participants.forEach((name, idx) => {
      const option = document.createElement('div');
      option.className = 'participant-radio-item';
      option.innerHTML = `
        <label>
          <input type="radio" name="me-selector" value="${name}" ${idx === 0 ? 'checked' : ''} />
          <span class="participant-name">${name}</span>
        </label>
      `;
      participantsList.appendChild(option);
    });

    // Check if a chat with this name already exists in db
    const existingChats = await db.getChats();
    const matchingChat = existingChats.find((c) => c.name.toLowerCase() === autoChatName.toLowerCase());
    const overlapBox = this.overlay.querySelector('#overlap-merge-box');
    if (matchingChat) {
      overlapBox.style.display = 'block';
      this.existingChatId = matchingChat.id;
    } else {
      overlapBox.style.display = 'none';
      this.existingChatId = null;
    }

    // Wire Finish Button
    const finishBtn = this.overlay.querySelector('#btn-finish-import');
    finishBtn.onclick = () => this.executeFinalImport();
  }

  async executeFinalImport() {
    const selectedMeRadio = this.overlay.querySelector('input[name="me-selector"]:checked');
    const meName = selectedMeRadio ? selectedMeRadio.value : '';
    const isSelfChat = this.overlay.querySelector('#toggle-self-chat').checked;
    const isGroup = this.overlay.querySelector('#toggle-group-chat').checked;
    const chatName = this.overlay.querySelector('#chat-display-name').value.trim() || 'WhatsApp Chat';

    const overlapChoice = this.overlay.querySelector('input[name="overlap-choice"]:checked')?.value || 'new';

    this.showStep('step-progress');
    this.updateProgress(75, 'Processing media & PDF previews...');

    const chatId = (overlapChoice === 'merge' && this.existingChatId) ? this.existingChatId : 'chat_' + Date.now();
    const mediaBatch = [];
    const mediaIdMap = new Map(); // cleanName -> mediaId

    // Process media files and PDF thumbnails in advance
    let processedCount = 0;
    const totalMedia = this.extractedMediaFiles.size;

    for (const [cleanName, fileItem] of this.extractedMediaFiles.entries()) {
      const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      mediaIdMap.set(cleanName, mediaId);

      const type = this.parser.categorizeMedia(cleanName);
      let mimeType = 'application/octet-stream';
      if (type === 'image') mimeType = 'image/jpeg';
      if (type === 'video') mimeType = 'video/mp4';
      if (type === 'audio') mimeType = 'audio/ogg';
      if (type === 'pdf') mimeType = 'application/pdf';

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
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          await page.render({ canvasContext: ctx, viewport }).promise;

          thumbnailBlob = await new Promise((res) => canvas.toBlob(res, 'image/png', 0.85));
        } catch (pdfErr) {
          console.warn('[PDF.js fallback] Failed to render thumbnail for:', cleanName, pdfErr);
          thumbnailBlob = null;
        }
      }

      mediaBatch.push({
        id: mediaId,
        chatId,
        filename: cleanName,
        mimeType,
        blob,
        thumbnailBlob,
        size: fileItem.size,
        pageCount
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

      if (m.mediaName) {
        const clean = this.parser.normalizeFilename(m.mediaName);
        if (mediaIdMap.has(clean)) {
          linkedMediaId = mediaIdMap.get(clean);
        }
      }

      return {
        ...m,
        chatId,
        isOutgoing,
        mediaId: linkedMediaId
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
    const chatRecord = {
      id: chatId,
      name: chatName,
      avatarBlob: null,
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
      updatedAt: lastMsg ? lastMsg.timestamp : Date.now()
    };

    await db.saveChat(chatRecord);

    this.updateProgress(100, 'Restoration complete!');
    Toast.show(`Chat restored: ${chatName}`);

    setTimeout(() => {
      this.close();
      if (this.onComplete) {
        this.onComplete(chatId);
      }
    }, 400);
  }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
