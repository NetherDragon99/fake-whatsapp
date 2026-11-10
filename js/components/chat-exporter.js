// Component: WhatsApp Chat Exporter (Text & Media Archive .zip Generator)
import { db } from '../db.js';
import { Toast } from './toast.js';

export class ChatExporter {
  static formatTimestamp(timestamp) {
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
  }

  static async generateChatLogText(chat, messages) {
    const lines = [];

    // Official WhatsApp encryption header
    const firstTs = messages.length > 0 ? messages[0].timestamp : Date.now();
    lines.push(`${this.formatTimestamp(firstTs)} - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`);

    for (const msg of messages) {
      const ts = this.formatTimestamp(msg.timestamp);
      const sender = msg.sender || (msg.isOutgoing ? (chat.meParticipant || 'You') : chat.name);

      if (msg.isSystem) {
        lines.push(`${ts} - ${msg.text}`);
      } else if (msg.mediaName) {
        if (msg.text && msg.text.trim()) {
          lines.push(`${ts} - ${sender}: ${msg.mediaName} (file attached)\n${msg.text.trim()}`);
        } else {
          lines.push(`${ts} - ${sender}: ${msg.mediaName} (file attached)`);
        }
      } else {
        lines.push(`${ts} - ${sender}: ${msg.text || ''}`);
      }
    }

    return lines.join('\n');
  }

  static triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  static async exportWithoutMedia(chatId) {
    Toast.show('Exporting chat without media...');
    await db.init();
    const chat = await db.getChat(chatId);
    if (!chat) return;

    const messages = await db.getMessages(chatId);
    const logText = await this.generateChatLogText(chat, messages);

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const cleanName = (chat.name || 'Chat').replace(/[<>:"/\\|?*]/g, '_');
    this.triggerDownload(blob, `WhatsApp Chat with ${cleanName}.txt`);
    Toast.show('Chat exported successfully');
  }

  static async exportWithMedia(chatId) {
    Toast.show('Exporting chat with media...');
    await db.init();
    const chat = await db.getChat(chatId);
    if (!chat) return;

    const messages = await db.getMessages(chatId);
    const logText = await this.generateChatLogText(chat, messages);

    if (typeof window.fflate === 'undefined') {
      console.warn('[ChatExporter] fflate library not available, exporting text only');
      return this.exportWithoutMedia(chatId);
    }

    const filesMap = {};
    filesMap['_chat.txt'] = window.fflate.strToU8(logText);

    // Collect all media blobs
    for (const msg of messages) {
      if (msg.mediaId) {
        try {
          const mediaItem = await db.getMedia(msg.mediaId);
          if (mediaItem && mediaItem.blob) {
            const arrayBuffer = await mediaItem.blob.arrayBuffer();
            const fileName = msg.mediaName || mediaItem.filename || `media_${msg.mediaId}`;
            filesMap[fileName] = new Uint8Array(arrayBuffer);
          }
        } catch (e) {
          console.warn('[ChatExporter] Error packing media item:', msg.mediaId, e);
        }
      }
    }

    window.fflate.zip(filesMap, { level: 6 }, (err, zipData) => {
      if (err) {
        console.error('[ChatExporter] Zip error:', err);
        Toast.show('Failed to create zip archive');
        return;
      }
      const zipBlob = new Blob([zipData], { type: 'application/zip' });
      const cleanName = (chat.name || 'Chat').replace(/[<>:"/\\|?*]/g, '_');
      this.triggerDownload(zipBlob, `WhatsApp Chat - ${cleanName}.zip`);
      Toast.show('Chat exported successfully');
    });
  }

  static showExportPrompt(chatId) {
    const existing = document.querySelector('.wa-export-dialog-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay wa-export-dialog-overlay active';
    overlay.innerHTML = `
      <div class="custom-dialog-card wa-export-dialog-card" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
        <h3 class="custom-dialog-title" id="export-dialog-title">Export chat</h3>
        <p class="custom-dialog-message">Including media will increase the size of the chat export.</p>
        <div class="wa-export-dialog-actions">
          <button type="button" class="wa-export-action-btn" id="btn-export-no-media">Without media</button>
          <button type="button" class="wa-export-action-btn btn-primary-export" id="btn-export-with-media">Include media</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector('#btn-export-no-media').addEventListener('click', () => {
      close();
      this.exportWithoutMedia(chatId);
    });

    overlay.querySelector('#btn-export-with-media').addEventListener('click', () => {
      close();
      this.exportWithMedia(chatId);
    });
  }
}

