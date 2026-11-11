// IndexedDB Storage Layer for WhatsApp Android Clone
const DB_NAME = 'WhatsAppCloneDB';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'uuid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Chats store
        if (!db.objectStoreNames.contains('chats')) {
          const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
          chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          chatStore.createIndex('isPinned', 'isPinned', { unique: false });
          chatStore.createIndex('isArchived', 'isArchived', { unique: false });
          chatStore.createIndex('isLocked', 'isLocked', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('chatId', 'chatId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
          msgStore.createIndex('chat_time', ['chatId', 'timestamp'], { unique: false });
        }

        // Media blobs store
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('chatId', 'chatId', { unique: false });
          mediaStore.createIndex('filename', 'filename', { unique: false });
        }

        // Calls history store
        if (!db.objectStoreNames.contains('calls')) {
          const callStore = db.createObjectStore('calls', { keyPath: 'id' });
          callStore.createIndex('chatId', 'chatId', { unique: false });
          callStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Custom filter lists store
        if (!db.objectStoreNames.contains('filters')) {
          db.createObjectStore('filters', { keyPath: 'id' });
        }

        // Settings key-value store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  // --- Chats CRUD ---
  async getChats() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('chats', 'readonly');
      const store = tx.objectStore('chats');
      const request = store.getAll();
      request.onsuccess = () => {
        const chats = request.result || [];
        chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(chats);
      };
      request.onerror = () => reject(tx.error);
    });
  }

  async getChat(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('chats', 'readonly');
      const store = tx.objectStore('chats');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(tx.error);
    });
  }

  async saveChat(chat) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('chats', 'readwrite');
      const store = tx.objectStore('chats');
      store.put(chat);
      tx.oncomplete = () => resolve(chat);
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateChat(id, updates) {
    await this.init();
    const chat = await this.getChat(id);
    if (!chat) return null;
    const updated = { ...chat, ...updates };
    return this.saveChat(updated);
  }

  async swapChatPerspective(chatId, { signal } = {}) {
    if (signal?.aborted) return null;
    await this.init();
    if (signal?.aborted) return null;

    const chat = await this.getChat(chatId);
    if (!chat || signal?.aborted) return null;

    const ownerName = await this.getSetting('ownerName', 'You');
    const userProfileAvatar = await this.getSetting('userProfileAvatar', null);

    const currentChatName = chat.name || 'Contact';
    const currentChatAvatar = chat.avatarBlob || null;
    let currentMeName = chat.meParticipant || ownerName || 'Me';

    let newChatName = currentMeName;
    let newMeName = currentChatName;

    if (chat.participantNames && chat.participantNames.length === 2) {
      const p1 = chat.participantNames[0];
      const p2 = chat.participantNames[1];
      if (currentChatName.trim().toLowerCase() === p1.trim().toLowerCase()) {
        newChatName = p2;
        newMeName = p1;
      } else if (currentChatName.trim().toLowerCase() === p2.trim().toLowerCase()) {
        newChatName = p1;
        newMeName = p2;
      }
    }

    if (signal?.aborted) return null;

    // Avatar swap between chat contact and user profile
    const newChatAvatar = userProfileAvatar;
    const newUserAvatar = currentChatAvatar;

    // Flip all messages
    const msgs = await this.getMessages(chatId);
    if (signal?.aborted) return null;

    // Yield in chunks to keep UI responsive and allow user to cancel
    const chunkSize = 150;
    for (let i = 0; i < msgs.length; i++) {
      if (signal?.aborted) return null;
      if (i > 0 && i % chunkSize === 0) {
        await new Promise((r) => setTimeout(r, 0));
        if (signal?.aborted) return null;
      }
      const m = msgs[i];
      if (!m.isSystem) {
        m.isOutgoing = !m.isOutgoing;
        if (m.sender === currentChatName) {
          m.sender = newChatName;
        } else if (m.sender === currentMeName) {
          m.sender = newMeName;
        }
      }
    }

    if (signal?.aborted) return null;

    await this.saveMessages(msgs);
    if (signal?.aborted) return null;

    // Flip calls
    try {
      const calls = await this.getCallsByChat(chatId);
      if (calls && calls.length > 0) {
        for (const c of calls) {
          c.contactName = newChatName;
        }
        await this.saveCallsBatch(calls);
      }
    } catch (callErr) {
      console.warn('[DB] Error updating calls during perspective swap:', callErr);
    }

    if (signal?.aborted) return null;

    // Update chat metadata
    chat.name = newChatName;
    chat.avatarBlob = newChatAvatar;
    chat.meParticipant = newMeName;
    chat.isOutgoingDefault = !(chat.isOutgoingDefault ?? true);
    if (chat.lastMessage && typeof chat.lastMessage === 'object') {
      chat.lastMessage.isOutgoing = !chat.lastMessage.isOutgoing;
    }
    await this.saveChat(chat);

    // Update owner settings
    await this.setSetting('ownerName', newMeName);
    await this.setSetting('userProfileAvatar', newUserAvatar);

    return chat;
  }

  async deleteChat(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['chats', 'messages', 'media', 'calls'], 'readwrite');
      
      // Delete chat record
      tx.objectStore('chats').delete(id);

      // Delete associated messages
      const msgStore = tx.objectStore('messages');
      const msgIndex = msgStore.index('chatId');
      const msgCursor = msgIndex.openCursor(IDBKeyRange.only(id));
      msgCursor.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete associated media
      const mediaStore = tx.objectStore('media');
      const mediaIndex = mediaStore.index('chatId');
      const mediaCursor = mediaIndex.openCursor(IDBKeyRange.only(id));
      mediaCursor.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete associated calls
      const callStore = tx.objectStore('calls');
      const callIndex = callStore.index('chatId');
      const callCursor = callIndex.openCursor(IDBKeyRange.only(id));
      callCursor.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Messages CRUD ---
  async getMessages(chatId, options = {}) {
    await this.init();
    const { limit = 0, beforeTimestamp = null, afterTimestamp = null } = options;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('chat_time');

      let range = null;
      if (beforeTimestamp !== null) {
        range = IDBKeyRange.bound([chatId, 0], [chatId, beforeTimestamp], false, true);
      } else if (afterTimestamp !== null) {
        range = IDBKeyRange.bound([chatId, afterTimestamp], [chatId, Infinity], true, false);
      } else {
        range = IDBKeyRange.bound([chatId, 0], [chatId, Infinity]);
      }

      const results = [];
      const cursorReq = index.openCursor(range, 'next');

      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          if (limit > 0 && results.length >= limit) {
            resolve(results);
            return;
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      cursorReq.onerror = () => reject(tx.error);
    });
  }

  async getMessageCount(chatId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('chatId');
      const req = index.count(IDBKeyRange.only(chatId));
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(tx.error);
    });
  }

  async saveMessage(msg) {
    return this.saveMessages([msg]);
  }

  async saveMessages(messages) {
    await this.init();
    if (!messages || messages.length === 0) return true;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');

      for (let i = 0; i < messages.length; i++) {
        store.put(messages[i]);
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateMessage(id, updates) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const msg = getReq.result;
        if (!msg) {
          resolve(null);
          return;
        }
        const updated = { ...msg, ...updates };
        store.put(updated);
        tx.oncomplete = () => resolve(updated);
      };
      getReq.onerror = () => reject(tx.error);
    });
  }

  async deleteMessage(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readwrite');
      tx.objectStore('messages').delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async searchMessages(query, chatId = null) {
    await this.init();
    if (!query || !query.trim()) return [];

    const lowerQuery = query.toLowerCase().trim();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      let req = null;

      if (chatId) {
        const index = store.index('chatId');
        req = index.openCursor(IDBKeyRange.only(chatId));
      } else {
        req = store.openCursor();
      }

      const matches = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const msg = cursor.value;
          if (msg.text && msg.text.toLowerCase().includes(lowerQuery)) {
            matches.push(msg);
          }
          if (matches.length >= 200) {
            resolve(matches);
            return;
          }
          cursor.continue();
        } else {
          resolve(matches);
        }
      };

      req.onerror = () => reject(tx.error);
    });
  }

  // --- Media Blobs CRUD ---
  async saveMedia(mediaItem) {
    await this.init();
    if (mediaItem && !mediaItem.timestamp) {
      mediaItem.timestamp = Date.now();
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readwrite');
      tx.objectStore('media').put(mediaItem);
      tx.oncomplete = () => resolve(mediaItem);
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveMediaBatch(items) {
    await this.init();
    if (!items || items.length === 0) return true;
    const now = Date.now();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      for (const item of items) {
        if (item && !item.timestamp) {
          item.timestamp = now;
        }
        store.put(item);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMedia(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readonly');
      const req = tx.objectStore('media').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(tx.error);
    });
  }

  async getMediaByChat(chatId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readonly');
      const index = tx.objectStore('media').index('chatId');
      const req = index.getAll(IDBKeyRange.only(chatId));
      req.onsuccess = () => {
        const media = req.result || [];
        media.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(media);
      };
      req.onerror = () => reject(tx.error);
    });
  }

  async getAllMedia() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readonly');
      const req = tx.objectStore('media').getAll();
      req.onsuccess = () => {
        const media = req.result || [];
        media.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(media);
      };
      req.onerror = () => reject(tx.error);
    });
  }

  // --- Calls CRUD ---
  async saveCall(callItem) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('calls', 'readwrite');
      tx.objectStore('calls').put(callItem);
      tx.oncomplete = () => resolve(callItem);
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveCallsBatch(calls) {
    await this.init();
    if (!calls || calls.length === 0) return true;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('calls', 'readwrite');
      const store = tx.objectStore('calls');
      for (const c of calls) {
        store.put(c);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCalls() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('calls', 'readonly');
      const req = tx.objectStore('calls').getAll();
      req.onsuccess = async () => {
        let calls = req.result || [];
        // If calls store is empty, scan messages for any callInfo records and backfill indexed calls
        if (calls.length === 0) {
          try {
            const allChats = await this.getChats();
            const backfilled = [];
            for (const chat of allChats) {
              const msgs = await this.getMessages(chat.id);
              for (const m of msgs) {
                if (m.callInfo && m.callInfo.isCall) {
                  backfilled.push({
                    id: 'call_' + m.timestamp + '_' + Math.random().toString(36).substr(2, 6),
                    chatId: chat.id,
                    contactName: chat.name,
                    timestamp: m.timestamp,
                    callType: m.callInfo.callType || 'voice',
                    direction: m.callInfo.direction || 'incoming',
                    isMissed: !!m.callInfo.isMissed,
                    messageId: m.id
                  });
                }
              }
            }
            if (backfilled.length > 0) {
              await this.saveCallsBatch(backfilled);
              calls = backfilled;
            }
          } catch (syncErr) {
            console.warn('[db.getCalls] Fallback sync check failed:', syncErr);
          }
        }
        calls.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(calls);
      };
      req.onerror = () => reject(tx.error);
    });
  }

  async getCallsByChat(chatId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('calls', 'readonly');
      const store = tx.objectStore('calls');
      const index = store.index('chatId');
      const req = index.getAll(IDBKeyRange.only(chatId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(tx.error);
    });
  }

  // --- Custom Filter Lists CRUD ---
  async getFilters() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('filters', 'readonly');
      const req = tx.objectStore('filters').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(tx.error);
    });
  }

  async saveFilter(filter) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('filters', 'readwrite');
      tx.objectStore('filters').put(filter);
      tx.oncomplete = () => resolve(filter);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteFilter(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('filters', 'readwrite');
      tx.objectStore('filters').delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Settings Key-Value Store ---
  async getSetting(key, defaultValue = null) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => {
        if (req.result && req.result.value !== undefined) {
          resolve(req.result.value);
        } else {
          resolve(defaultValue);
        }
      };
      req.onerror = () => reject(tx.error);
    });
  }

  async setSetting(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key, value });
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Storage & Diagnostics ---
  async getStorageUsage() {
    await this.init();
    let totalBytes = 0;
    let mediaCount = 0;
    let messageCount = 0;
    let chatCount = 0;

    const chats = await this.getChats();
    chatCount = chats.length;

    const allMedia = await this.getAllMedia();
    mediaCount = allMedia.length;
    for (const m of allMedia) {
      if (m.size) totalBytes += m.size;
      else if (m.blob && m.blob.size) totalBytes += m.blob.size;
    }

    // Estimate message text size
    return new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readonly');
      const req = tx.objectStore('messages').count();
      req.onsuccess = () => {
        messageCount = req.result || 0;
        totalBytes += messageCount * 128; // ~128 bytes per message estimate
        resolve({
          chatCount,
          messageCount,
          mediaCount,
          totalBytes,
          formattedSize: this.formatBytes(totalBytes)
        });
      };
      req.onerror = () => {
        resolve({ chatCount, messageCount, mediaCount, totalBytes, formattedSize: this.formatBytes(totalBytes) });
      };
    });
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'kB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // --- Advanced Granular Storage Breakdown & Multi-Select Clearance ---
  categorizeMediaRecord(m) {
    if (!m) return 'document';
    const type = m.type || '';
    const mime = m.mimeType || '';
    const filename = m.filename || '';

    if (type === 'sticker' || (mime === 'image/webp' && /stk|sticker/i.test(filename))) return 'sticker';
    if (type === 'image' || mime.startsWith('image/')) return 'photos';
    if (type === 'video' || mime.startsWith('video/')) return 'videos';
    if (type === 'audio' || mime.startsWith('audio/') || /\.(opus|ogg|m4a|aac|mp3|wav)$/i.test(filename)) return 'audio';
    if (type === 'pdf' || mime === 'application/pdf' || /\.pdf$/i.test(filename)) return 'documents';
    return 'documents';
  }

  async getChatDetailedStorage(chatId) {
    await this.init();
    const chatMedia = await this.getMediaByChat(chatId);
    const msgs = await this.getMessages(chatId);

    const categories = {
      photos: { count: 0, bytes: 0, items: [] },
      videos: { count: 0, bytes: 0, items: [] },
      audio: { count: 0, bytes: 0, items: [] },
      documents: { count: 0, bytes: 0, items: [] },
      messages: { count: 0, bytes: 0, items: [] }
    };

    let totalBytes = 0;
    let starredCount = 0;

    for (const med of chatMedia) {
      const cat = this.categorizeMediaRecord(med);
      const size = med.size || (med.blob && med.blob.size) || 0;
      totalBytes += size;

      if (cat === 'photos' || cat === 'sticker') {
        categories.photos.count++;
        categories.photos.bytes += size;
        categories.photos.items.push(med);
      } else if (cat === 'videos') {
        categories.videos.count++;
        categories.videos.bytes += size;
        categories.videos.items.push(med);
      } else if (cat === 'audio') {
        categories.audio.count++;
        categories.audio.bytes += size;
        categories.audio.items.push(med);
      } else {
        categories.documents.count++;
        categories.documents.bytes += size;
        categories.documents.items.push(med);
      }
    }

    for (const msg of msgs) {
      if (msg.isStarred) starredCount++;
      const msgBytes = (msg.text ? msg.text.length * 2 : 0) + 128;
      totalBytes += msgBytes;
      categories.messages.count++;
      categories.messages.bytes += msgBytes;
      categories.messages.items.push(msg);
    }

    return {
      totalBytes,
      formattedTotal: this.formatBytes(totalBytes),
      totalItems: chatMedia.length + msgs.length,
      photos: {
        count: categories.photos.count,
        bytes: categories.photos.bytes,
        formatted: this.formatBytes(categories.photos.bytes),
        items: categories.photos.items
      },
      videos: {
        count: categories.videos.count,
        bytes: categories.videos.bytes,
        formatted: this.formatBytes(categories.videos.bytes),
        items: categories.videos.items
      },
      audio: {
        count: categories.audio.count,
        bytes: categories.audio.bytes,
        formatted: this.formatBytes(categories.audio.bytes),
        items: categories.audio.items
      },
      documents: {
        count: categories.documents.count,
        bytes: categories.documents.bytes,
        formatted: this.formatBytes(categories.documents.bytes),
        items: categories.documents.items
      },
      messages: {
        count: categories.messages.count,
        bytes: categories.messages.bytes,
        formatted: this.formatBytes(categories.messages.bytes),
        items: categories.messages.items
      },
      starredCount,
      allMedia: chatMedia
    };
  }

  async getStorageUsageRanked() {
    await this.init();
    const chats = await this.getChats();
    const rankedChats = [];

    let globalTotalBytes = 0;
    let globalMediaBytes = 0;
    let globalMessageBytes = 0;
    let globalMessageCount = 0;
    let globalMediaCount = 0;

    for (const c of chats) {
      const stats = await this.getChatDetailedStorage(c.id);
      const mediaBytes = stats.photos.bytes + stats.videos.bytes + stats.audio.bytes + stats.documents.bytes;
      globalTotalBytes += stats.totalBytes;
      globalMediaBytes += mediaBytes;
      globalMessageBytes += stats.messages.bytes;
      globalMessageCount += stats.messages.count;
      globalMediaCount += stats.allMedia.length;

      rankedChats.push({
        chat: c,
        stats,
        totalBytes: stats.totalBytes,
        formattedTotal: stats.formattedTotal,
        mediaCount: stats.allMedia.length,
        messageCount: stats.messages.count
      });
    }

    rankedChats.sort((a, b) => b.totalBytes - a.totalBytes);

    return {
      global: {
        totalBytes: globalTotalBytes,
        mediaBytes: globalMediaBytes,
        messageBytes: globalMessageBytes,
        formattedTotal: this.formatBytes(globalTotalBytes),
        formattedMedia: this.formatBytes(globalMediaBytes),
        formattedMessages: this.formatBytes(globalMessageBytes),
        chatCount: chats.length,
        messageCount: globalMessageCount,
        mediaCount: globalMediaCount
      },
      chats: rankedChats
    };
  }

  async clearChatCategory(chatId, category, deleteStarred = false) {
    await this.init();
    const chatMedia = await this.getMediaByChat(chatId);
    const msgs = await this.getMessages(chatId);

    const mediaToDelete = [];
    const messagesToDelete = [];

    if (category === 'all') {
      for (const m of chatMedia) mediaToDelete.push(m.id);
      for (const msg of msgs) {
        if (!deleteStarred && msg.isStarred) continue;
        messagesToDelete.push(msg.id);
      }
    } else if (category === 'messages') {
      for (const msg of msgs) {
        if (!deleteStarred && msg.isStarred) continue;
        messagesToDelete.push(msg.id);
      }
    } else {
      for (const m of chatMedia) {
        const cat = this.categorizeMediaRecord(m);
        let matches = false;
        if (category === 'photos' && (cat === 'photos' || cat === 'sticker')) matches = true;
        else if (category === 'videos' && cat === 'videos') matches = true;
        else if (category === 'audio' && cat === 'audio') matches = true;
        else if (category === 'documents' && cat === 'documents') matches = true;

        if (matches) {
          mediaToDelete.push(m.id);
          const parentMsg = msgs.find((msg) => msg.mediaId === m.id);
          if (parentMsg && (deleteStarred || !parentMsg.isStarred)) {
            messagesToDelete.push(parentMsg.id);
          }
        }
      }
    }

    if (mediaToDelete.length > 0) {
      await this.deleteMediaBatch(mediaToDelete);
    }
    if (messagesToDelete.length > 0) {
      await this.deleteMessagesBatch(messagesToDelete, !deleteStarred);
    }

    const remainingMsgs = await this.getMessages(chatId);
    const lastMsg = remainingMsgs.length > 0 ? remainingMsgs[remainingMsgs.length - 1] : null;

    await this.updateChat(chatId, {
      lastMessage: lastMsg ? {
        text: lastMsg.text,
        timestamp: lastMsg.timestamp,
        isOutgoing: lastMsg.isOutgoing,
        mediaType: lastMsg.mediaType
      } : null
    });

    return true;
  }

  async deleteMediaBatch(mediaIds) {
    await this.init();
    if (!mediaIds || mediaIds.length === 0) return true;
    const idSet = new Set(mediaIds);

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      for (const id of idSet) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteMessagesBatch(messageIds, preserveStarred = true) {
    await this.init();
    if (!messageIds || messageIds.length === 0) return true;
    const idSet = new Set(messageIds);

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      for (const id of idSet) {
        if (preserveStarred) {
          const req = store.get(id);
          req.onsuccess = () => {
            if (req.result && !req.result.isStarred) {
              store.delete(id);
            }
          };
        } else {
          store.delete(id);
        }
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearChatsStorageBatch(chatIds, deleteStarred = false) {
    if (!chatIds || chatIds.length === 0) return true;
    for (const cid of chatIds) {
      await this.clearChatCategory(cid, 'all', deleteStarred);
    }
    return true;
  }

  // --- Full Backup Export & Restore ---
  async exportFullBackup() {
    await this.init();
    const chats = await this.getChats();
    const allMedia = await this.getAllMedia();
    const calls = await this.getCalls();
    const filters = await this.getFilters();

    // Fetch all messages
    const messages = await new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readonly');
      const req = tx.objectStore('messages').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    // Fetch all settings
    const settings = await new Promise((resolve) => {
      const tx = this.db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      chats,
      messages,
      calls,
      filters,
      settings,
      media: allMedia
    };
  }

  async restoreFullBackup(data) {
    await this.init();
    if (!data || !data.chats || !data.messages) {
      throw new Error('Invalid backup file structure.');
    }

    const tx = this.db.transaction(['chats', 'messages', 'media', 'calls', 'filters', 'settings'], 'readwrite');
    
    // Clear existing
    tx.objectStore('chats').clear();
    tx.objectStore('messages').clear();
    tx.objectStore('media').clear();
    tx.objectStore('calls').clear();
    tx.objectStore('filters').clear();
    tx.objectStore('settings').clear();

    // Populate
    const chatStore = tx.objectStore('chats');
    for (const c of data.chats) chatStore.put(c);

    const msgStore = tx.objectStore('messages');
    for (const m of data.messages) msgStore.put(m);

    if (data.media) {
      const mediaStore = tx.objectStore('media');
      for (const med of data.media) mediaStore.put(med);
    }

    if (data.calls) {
      const callStore = tx.objectStore('calls');
      for (const call of data.calls) callStore.put(call);
    }

    if (data.filters) {
      const filterStore = tx.objectStore('filters');
      for (const f of data.filters) filterStore.put(f);
    }

    if (data.settings) {
      const setStore = tx.objectStore('settings');
      for (const s of data.settings) setStore.put(s);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllData() {
    await this.init();
    const tx = this.db.transaction(['chats', 'messages', 'media', 'calls', 'filters', 'settings'], 'readwrite');
    tx.objectStore('chats').clear();
    tx.objectStore('messages').clear();
    tx.objectStore('media').clear();
    tx.objectStore('calls').clear();
    tx.objectStore('filters').clear();
    tx.objectStore('settings').clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const db = new Database();
