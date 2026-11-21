// SVG Icon definitions matching WhatsApp Android
export const Icons = {
  search: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>`,

  gallery: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>`,

  chatPlus: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 9h-4v4h-2v-4H7V9h4V5h2v4h4v2z"/>
    </svg>`,

  moreVert: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>`,

  arrowBack: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>`,

  checks: (isRead = true, cls = '', size = 16) => `
    <svg class="${cls} ${isRead ? 'read-receipt-blue' : 'receipt-grey'}" width="${size}" height="${size}" viewBox="0 0 16 15" fill="none">
      <path d="M15.01 3.316l-7.79 8.684-4.22-4.22 1.06-1.06 3.16 3.16 6.73-7.564 1.06 1z" fill="currentColor"/>
      <path d="M10.83 3.316l-7.79 8.684L.25 9.21l1.06-1.06 1.73 1.73 6.73-7.564 1.06 1z" fill="currentColor"/>
    </svg>`,

  singleCheck: (cls = '', size = 16) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 16 15" fill="currentColor">
      <path d="M15.01 3.316l-7.79 8.684-4.22-4.22 1.06-1.06 3.16 3.16 6.73-7.564 1.06 1z"/>
    </svg>`,

  clock: (cls = '', size = 14) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`,

  mic: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>`,

  send: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>`,

  paperclip: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>`,

  camera: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="3.2"/>
      <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    </svg>`,

  emoji: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>`,

  sticker: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9.5a2.5 2.5 0 0 0 2.5-2.5V8.5L15.5 3z"/>
      <path d="M15 3v5.5a.5.5 0 0 0 .5.5H21"/>
    </svg>`,

  exportChat: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
    </svg>`,

  download: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>`,

  play: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>`,

  pause: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>`,

  reply: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
    </svg>`,

  shareOut: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>`,

  forwardTag: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/>
      <polyline points="9 8 13 12 9 16" transform="translate(-1 0)"/>
    </svg>`,

  forwardTagOff: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/>
      <polyline points="9 8 13 12 9 16" transform="translate(-1 0)"/>
      <line x1="3" y1="21" x2="21" y2="3" stroke-width="2.5"/>
    </svg>`,

  replyBold: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 14 4 9 9 4"/>
      <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
    </svg>`,

  /** Forward arrow icon (exact horizontal mirror of replyBold) */
  forwardBold: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 14 20 9 15 4"/>
      <path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
    </svg>`,

  forward: (cls = '', size = 16) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8V4l8 8-8 8v-4H4V8h8z"/>
    </svg>`,

  unforward: (cls = '', size = 16) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8V4l8 8-8 8v-4H4V8h8z"/>
      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,

  pin: (cls = '', size = 18) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
    </svg>`,

  pinOff: (cls = '', size = 18) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
      <line x1="3" y1="21" x2="21" y2="3" stroke="var(--wa-surface, #121b22)" stroke-width="3.2" stroke-linecap="round"/>
      <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

  infoCircle: (cls = '', size = 16) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>`,

  archive: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/>
    </svg>`,

  lock: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>`,

  star: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`,

  unstar: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.19 21.19L2.81 2.81 1.39 4.22l4.89 4.89-.46 1.96 5.18 3.76.88 5.25 2.12-1.22 3.96 3.96 1.41-1.41zM12 17.77l-1.07.62-.48-2.89 2.84 2.06-.48.21zm2.34-6.42l-2.06-2.06.81-1.03L15.09 8.26l6.91 1.01-4.27 4.17.65 3.9-3.95-3.95.87-2.04zM12 2l3.09 6.26.17.35.38.05 4.62.67-3.34 3.26-.28.27.07.39.79 4.59-4.14-2.18-.34-.18-.34.18-1.52.8 1.95 1.95 2.05-1.08 5.18 2.73-1.18-5.88 4.7-4.58-6.19-.9L12 2z"/>
    </svg>`,

  starOutline: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`,

  callVoice: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.053 15.053 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1.01A11.36 11.36 0 0 1 8.5 3.92c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.54c0-.55-.45-1-.99-1z"/>
    </svg>`,

  callVideo: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>`,

  callMissed: (cls = '', size = 16) => `
    <svg class="${cls} call-missed-red" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 7L12 14.59 6.41 9H11V7H3v8h2v-4.59l7 7 9-9z"/>
    </svg>`,

  callIncoming: (cls = '', size = 16) => `
    <svg class="${cls} call-incoming-green" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 5.41L18.59 4 7 15.59V9H5v10h10v-2H8.41z"/>
    </svg>`,

  callOutgoing: (cls = '', size = 16) => `
    <svg class="${cls} call-outgoing-green" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z"/>
    </svg>`,

  chatsTab: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
    </svg>`,

  callsTab: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.053 15.053 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1.01A11.36 11.36 0 0 1 8.5 3.92c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.54c0-.55-.45-1-.99-1z"/>
    </svg>`,

  settingsTab: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>`,

  installApp: (cls = '', size = 22) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
      <polyline points="7 11 12 16 17 11"></polyline>
      <line x1="12" y1="4" x2="12" y2="16"></line>
    </svg>`,

  userAvatar: (cls = '', size = 48) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#6a7175"/>
      <circle cx="24" cy="18" r="8" fill="#cfd6db"/>
      <path d="M12 38c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="#cfd6db"/>
    </svg>`,

  groupAvatar: (cls = '', size = 48) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#6a7175"/>
      <circle cx="18" cy="18" r="6" fill="#cfd6db"/>
      <path d="M8 36c0-5 4-9 9-9s9 4 9 9" fill="#cfd6db"/>
      <circle cx="30" cy="19" r="5" fill="#aebac1"/>
      <path d="M25 36c0-4 3.5-7 7-7s7 3 7 7" fill="#aebac1"/>
    </svg>`,

  close: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`,

  trash: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>`,

  unread: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>`,

  markAsUnread: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>`,

  read: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zm-9.99 4L4 7.5 12 3l8 4.5-8 4.5z"/>
    </svg>`,

  markAsRead: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zm-9.99 4L4 7.5 12 3l8 4.5-8 4.5z"/>
    </svg>`,

  pdfIcon: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#f15c6d"/>
      <polyline points="14 2 14 8 20 8" fill="#d93e50"/>
      <text x="7" y="18" fill="white" font-size="7" font-weight="bold" font-family="sans-serif">PDF</text>
    </svg>`,

  documentIcon: (cls = '', size = 24) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>`,

  chevronDown: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>`,

  chevronLeft: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>`,

  chevronRight: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>`,

  calendar: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`,

  swap: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 3 21 8 16 13"></polyline>
      <line x1="21" y1="8" x2="9" y2="8"></line>
      <polyline points="8 21 3 16 8 11"></polyline>
      <line x1="3" y1="16" x2="15" y2="16"></line>
    </svg>`,

  linkIcon: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>`,

  externalLink: (cls = '', size = 18) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>`,

  /** Copy icon — two overlapping rectangles (Material style) */
  copy: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>`,

  /** Edit / pencil icon — used for multi-select mode toggle */
  edit: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>`,

  /** Check / checkmark icon — used for selection badges */
  check: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
    </svg>`,

  /** Share / export icon — used for sharing media messages */
  share: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
    </svg>`,

  /** Palette icon — used for Chat theme menu item */
  palette: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </svg>`,

  /** WhatsApp Circular Progress Spinner */
  spinner: (cls = '', size = 24) => `
    <svg class="wa-loading-spinner ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="2.5"/>
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.5"/>
    </svg>`,

  /** Retry circular icon */
  retry: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>`,

  /** Expand all / unfold vertical icon */
  expandAll: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/>
    </svg>`,

  /** Collapse all / fold vertical icon */
  collapseAll: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.41 18.59L8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10l4.59-4.59z"/>
    </svg>`,

  /** Multi-level tree / nested messages branch icon */
  treeBranch: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="6" cy="5" r="2"/>
      <circle cx="18" cy="11" r="2"/>
      <circle cx="18" cy="19" r="2"/>
      <path d="M6 7v12h10"/>
      <path d="M6 11h10"/>
    </svg>`,

  /** Bulleted list icon */
  listBulleted: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
    </svg>`,

  /** Numbered list icon */
  listNumbered: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
    </svg>`,

  /** Interactive checklist icon */
  checklist: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 7h-9v2h9V7zm0 8h-9v2h9v-2zM5.54 11L2 7.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 11zm0 8L2 15.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 19z"/>
    </svg>`,

  /** Features & Shortcuts guide book icon */
  bookGuide: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </svg>`,

  /** Rich format / expand composer toggle icon */
  formatText: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 4v3h5.5v12h3V7H19V4z"/>
    </svg>`,

  /** Undo icon */
  undo: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
    </svg>`,

  /** Redo icon */
  redo: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
    </svg>`,

  /** Clear formatting icon */
  clearFormat: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"/>
    </svg>`,

  /** Indent increase icon */
  indentIncrease: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/>
    </svg>`,

  /** Indent decrease icon */
  indentDecrease: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/>
    </svg>`,

  /** Spoiler hidden text eye icon */
  spoilerEye: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
    </svg>`,

  /** Highlight marker icon */
  highlight: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 14l3 3v5h6v-5l3-3V9H6v5zm5-12h2v3h-2V2zM3.5 5.88l1.41-1.41 2.12 2.12L5.62 8 3.5 5.88zm13.46.71l2.12-2.12 1.41 1.41L18.38 8l-1.42-1.41z"/>
    </svg>`,

  /** Code block icon */
  codeBlock: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
    </svg>`,

  /** Quote block icon */
  quote: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
    </svg>`,

  /** Note mode full-width card icon */
  noteMode: (cls = '', size = 20) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 8h10v2H7V8zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/>
    </svg>`
};
