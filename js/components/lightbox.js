// Full-screen Media Lightbox with "Show in Chat"
import { Icons } from '../icons.js';

class Lightbox {
  constructor() {
    this.overlay = null;
    this.currentUrl = null;
    this.onShowInChat = null;
  }

  show(mediaItem, msg, onShowInChat) {
    this.onShowInChat = onShowInChat;
    this.close(); // Close any existing

    this.overlay = document.createElement('div');
    this.overlay.className = 'wa-lightbox-overlay';

    let mediaContent = '';
    const isVideo = msg.mediaType === 'video';

    if (mediaItem && mediaItem.blob) {
      this.currentUrl = URL.createObjectURL(mediaItem.blob);
      if (isVideo) {
        mediaContent = `<video src="${this.currentUrl}" controls autoplay playsinline class="lightbox-media"></video>`;
      } else {
        mediaContent = `<img src="${this.currentUrl}" alt="${msg.mediaName || 'Photo'}" class="lightbox-media" />`;
      }
    } else {
      mediaContent = `<div class="lightbox-error">Media content unavailable</div>`;
    }

    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

    this.overlay.innerHTML = `
      <div class="lightbox-header">
        <button class="lightbox-back-btn" aria-label="Close">${Icons.arrowBack('', 24)}</button>
        <div class="lightbox-title-box">
          <div class="lightbox-sender">${msg.sender || 'Media'}</div>
          <div class="lightbox-time">${timeStr}</div>
        </div>
        <div class="lightbox-actions">
          <button class="lightbox-show-in-chat" title="Show in Chat">
            ${Icons.chatPlus('', 20)}
            <span>Show in Chat</span>
          </button>
          <button class="lightbox-download-btn" title="Download">${Icons.download('', 22)}</button>
        </div>
      </div>
      <div class="lightbox-body">
        ${mediaContent}
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Event listeners
    this.overlay.querySelector('.lightbox-back-btn').addEventListener('click', () => this.close());
    
    this.overlay.querySelector('.lightbox-download-btn').addEventListener('click', () => {
      if (this.currentUrl) {
        const a = document.createElement('a');
        a.href = this.currentUrl;
        a.download = msg.mediaName || (isVideo ? 'video.mp4' : 'photo.jpg');
        a.click();
      }
    });

    this.overlay.querySelector('.lightbox-show-in-chat').addEventListener('click', () => {
      const targetChatId = msg.chatId;
      const targetMsgId = msg.id;
      this.close();
      if (this.onShowInChat) {
        this.onShowInChat(targetChatId, targetMsgId);
      }
    });

    // History state push for Android hardware back button
    window.history.pushState({ modal: 'lightbox' }, '');
    window.addEventListener('popstate', this.handlePopState);
  }

  handlePopState = (e) => {
    if (this.overlay) {
      this.close(false); // already popped
    }
  };

  close(triggerBack = true) {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      if (this.currentUrl) {
        URL.revokeObjectURL(this.currentUrl);
        this.currentUrl = null;
      }
      window.removeEventListener('popstate', this.handlePopState);
      if (triggerBack && history.state && history.state.modal === 'lightbox') {
        history.back();
      }
    }
  }
}

export const mediaLightbox = new Lightbox();
