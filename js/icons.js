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

  forward: (cls = '', size = 16) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8V4l8 8-8 8v-4H4V8h8z"/>
    </svg>`,

  pin: (cls = '', size = 18) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
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
      <circle cx="12" cy="12" r="8"/>
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
    </svg>`
};
