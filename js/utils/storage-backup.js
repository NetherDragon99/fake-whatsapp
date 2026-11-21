// Multi-Tier Persistent Storage & Disaster-Recovery Auto-Backup Engine
// Tier 1: Secondary IndexedDB (WhatsAppBackupDB)
// Tier 2: Origin Private File System (OPFS wa_disaster_recovery_backup.json)
// Tier 3: LocalStorage Emergency Snapshot (wa_emergency_backup_v1)

const BACKUP_DB_NAME = 'WhatsAppBackupDB';
const BACKUP_DB_VERSION = 1;
const LOCALSTORAGE_BACKUP_KEY = 'wa_emergency_backup_v1';
const LOCALSTORAGE_META_KEY = 'wa_backup_meta_v1';
const OPFS_FILENAME = 'wa_disaster_recovery_backup.json';

class StorageBackupManager {
  constructor() {
    this._backupDb = null;
    this._backupDbPromise = null;
    this._debounceTimer = null;
    this._isPersisted = false;
    this._lastBackupStats = null;
    this._isRestoring = false;
    this._isSaving = false;

    this._loadInitialMeta();
  }

  _loadInitialMeta() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LOCALSTORAGE_META_KEY);
        if (raw) {
          this._lastBackupStats = JSON.parse(raw);
        }
      }
    } catch (e) {
      // Ignore initial metadata parse errors
    }
  }

  // ── 1. Guaranteed Storage Persistence API ─────────────────────────────────
  async ensurePersistence() {
    if (typeof navigator === 'undefined' || !navigator.storage) {
      return false;
    }

    try {
      if (typeof navigator.storage.persisted === 'function') {
        const alreadyPersisted = await navigator.storage.persisted();
        if (alreadyPersisted) {
          this._isPersisted = true;
          return true;
        }
      }

      if (typeof navigator.storage.persist === 'function') {
        const granted = await navigator.storage.persist();
        this._isPersisted = Boolean(granted);
        console.log(`[StorageBackup] Persistent storage request result: ${granted ? 'GRANTED' : 'DENIED'}`);
        return this._isPersisted;
      }
    } catch (err) {
      console.warn('[StorageBackup] Error requesting storage persistence:', err);
    }
    return false;
  }

  async getPersistenceInfo() {
    let persisted = this._isPersisted;
    let quota = 0;
    let usage = 0;

    try {
      if (typeof navigator !== 'undefined' && navigator.storage) {
        if (typeof navigator.storage.persisted === 'function') {
          persisted = await navigator.storage.persisted();
          this._isPersisted = persisted;
        }
        if (typeof navigator.storage.estimate === 'function') {
          const est = await navigator.storage.estimate();
          quota = est.quota || 0;
          usage = est.usage || 0;
        }
      }
    } catch (e) {
      // Ignore estimation errors
    }

    const usagePercent = quota > 0 ? Math.round((usage / quota) * 100) : 0;
    return {
      isPersisted: persisted,
      quota,
      usage,
      usagePercent,
      formattedUsage: this.formatBytes(usage),
      formattedQuota: this.formatBytes(quota)
    };
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'kB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ── 2. Secondary IndexedDB Layer ──────────────────────────────────────────
  async getBackupDatabase() {
    if (this._backupDb) return this._backupDb;
    if (this._backupDbPromise) return this._backupDbPromise;

    if (typeof indexedDB === 'undefined') return null;

    this._backupDbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('snapshots')) {
            db.createObjectStore('snapshots', { keyPath: 'id' });
          }
        };

        request.onsuccess = (event) => {
          this._backupDb = event.target.result;
          this._backupDb.onversionchange = () => {
            this._backupDb.close();
            this._backupDb = null;
            this._backupDbPromise = null;
          };
          this._backupDb.onclose = () => {
            this._backupDb = null;
            this._backupDbPromise = null;
          };
          resolve(this._backupDb);
        };

        request.onerror = (event) => {
          this._backupDbPromise = null;
          reject(event.target.error);
        };

        request.onblocked = () => {
          console.warn('[StorageBackup] Backup database open was blocked');
        };
      } catch (err) {
        this._backupDbPromise = null;
        reject(err);
      }
    });

    try {
      return await this._backupDbPromise;
    } catch (e) {
      this._backupDbPromise = null;
      return null;
    }
  }

  async saveToSecondaryIdb(snapshot) {
    try {
      const db = await this.getBackupDatabase();
      if (!db) return false;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('snapshots', 'readwrite');
          const store = tx.objectStore('snapshots');
          store.put({ id: 'latest', ...snapshot });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    } catch (e) {
      return false;
    }
  }

  async readFromSecondaryIdb() {
    try {
      const db = await this.getBackupDatabase();
      if (!db) return null;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('snapshots', 'readonly');
          const store = tx.objectStore('snapshots');
          const req = store.get('latest');
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    } catch (e) {
      return null;
    }
  }

  // ── 3. Origin Private File System (OPFS) Layer ─────────────────────────────
  async saveToOpfs(snapshotJsonString) {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
      return false;
    }

    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(OPFS_FILENAME, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(snapshotJsonString);
      await writable.close();
      return true;
    } catch (err) {
      console.warn('[StorageBackup] OPFS write failed:', err);
      return false;
    }
  }

  async readFromOpfs() {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
      return null;
    }

    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(OPFS_FILENAME, { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  }

  // ── 4. LocalStorage Emergency Snapshot Layer ──────────────────────────────
  saveToLocalStorage(snapshot) {
    if (typeof localStorage === 'undefined') return false;

    try {
      // LocalStorage has a ~5MB quota. Prepare a compact representation.
      const compactMessages = (snapshot.messages || []).map((m) => {
        const item = {
          id: m.id,
          chatId: m.chatId,
          sender: m.sender,
          text: m.text,
          timestamp: m.timestamp,
          isOutgoing: m.isOutgoing,
          isSystem: m.isSystem
        };
        if (m.replyTo) item.replyTo = m.replyTo;
        if (m.isStarred) item.isStarred = true;
        if (m.seq !== undefined) item.seq = m.seq;
        if (m.mediaType) item.mediaType = m.mediaType;
        if (m.mediaName) item.mediaName = m.mediaName;
        if (m.mediaId) item.mediaId = m.mediaId;
        if (m.parentMessageId) item.parentMessageId = m.parentMessageId;
        if (m.nestedListStyle) item.nestedListStyle = m.nestedListStyle;
        if (m.nestedListNumber) item.nestedListNumber = m.nestedListNumber;
        if (m.callInfo) item.callInfo = m.callInfo;
        return item;
      });

      const payload = {
        version: snapshot.version || '2.3.10',
        timestamp: snapshot.timestamp || Date.now(),
        chats: snapshot.chats || [],
        messages: compactMessages,
        calls: snapshot.calls || [],
        filters: snapshot.filters || [],
        settings: snapshot.settings || []
      };

      const jsonStr = JSON.stringify(payload);
      localStorage.setItem(LOCALSTORAGE_BACKUP_KEY, jsonStr);

      const meta = {
        timestamp: payload.timestamp,
        chatCount: payload.chats.length,
        messageCount: payload.messages.length
      };
      localStorage.setItem(LOCALSTORAGE_META_KEY, JSON.stringify(meta));
      this._lastBackupStats = meta;
      return true;
    } catch (err) {
      console.warn('[StorageBackup] LocalStorage emergency save warning (likely quota):', err);
      try {
        // Fallback: save at least chats, settings, calls, filters and recent messages
        const recentMessages = (snapshot.messages || []).slice(-300);
        const minimalPayload = {
          version: snapshot.version || '2.3.10',
          timestamp: snapshot.timestamp || Date.now(),
          chats: snapshot.chats || [],
          messages: recentMessages,
          calls: snapshot.calls || [],
          filters: snapshot.filters || [],
          settings: snapshot.settings || []
        };
        localStorage.setItem(LOCALSTORAGE_BACKUP_KEY, JSON.stringify(minimalPayload));
        const meta = {
          timestamp: minimalPayload.timestamp,
          chatCount: minimalPayload.chats.length,
          messageCount: minimalPayload.messages.length
        };
        localStorage.setItem(LOCALSTORAGE_META_KEY, JSON.stringify(meta));
        this._lastBackupStats = meta;
        return true;
      } catch (innerErr) {
        return false;
      }
    }
  }

  readFromLocalStorage() {
    if (typeof localStorage === 'undefined') return null;

    try {
      const raw = localStorage.getItem(LOCALSTORAGE_BACKUP_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[StorageBackup] Failed reading LocalStorage emergency backup:', err);
      return null;
    }
  }

  // ── 5. Snapshot Engine ────────────────────────────────────────────────────
  async createSnapshot(dbInstance) {
    if (!dbInstance || this._isRestoring || this._isSaving) return null;
    this._isSaving = true;

    try {
      await dbInstance.init();

      const chats = await dbInstance.getChats();
      // If there are no chats, do not overwrite a valid non-empty backup with an empty one!
      if (chats.length === 0) {
        return null;
      }

      // Fetch all messages
      const messages = await new Promise((resolve) => {
        try {
          const tx = dbInstance.db.transaction('messages', 'readonly');
          const req = tx.objectStore('messages').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });

      // Fetch all calls
      const calls = await dbInstance.getCalls().catch(() => []);

      // Fetch all filters
      const filters = await dbInstance.getFilters().catch(() => []);

      // Fetch all settings
      const settings = await new Promise((resolve) => {
        try {
          const tx = dbInstance.db.transaction('settings', 'readonly');
          const req = tx.objectStore('settings').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });

      const snapshot = {
        version: '2.3.10',
        timestamp: Date.now(),
        chatCount: chats.length,
        messageCount: messages.length,
        chats,
        messages,
        calls,
        filters,
        settings
      };

      // 1. Save to Secondary IndexedDB
      await this.saveToSecondaryIdb(snapshot);

      // 2. Save to OPFS
      try {
        const jsonStr = JSON.stringify(snapshot);
        await this.saveToOpfs(jsonStr);
      } catch (opfsErr) {
        // Ignore OPFS errors
      }

      // 3. Save to LocalStorage Emergency Snapshot
      this.saveToLocalStorage(snapshot);

      this._lastBackupStats = {
        timestamp: snapshot.timestamp,
        chatCount: snapshot.chatCount,
        messageCount: snapshot.messageCount
      };

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wa:backup-updated', { detail: this._lastBackupStats }));
      }

      return snapshot;
    } catch (err) {
      console.warn('[StorageBackup] Error creating snapshot:', err);
      return null;
    } finally {
      this._isSaving = false;
    }
  }

  scheduleBackup(dbInstance, delayMs = 600) {
    if (this._isRestoring) return;
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.createSnapshot(dbInstance).catch(() => {});
    }, delayMs);
  }

  async forceBackup(dbInstance) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    return this.createSnapshot(dbInstance);
  }

  // ── 6. Disaster Recovery Auto-Restore ─────────────────────────────────────
  async getLatestAvailableSnapshot() {
    let bestSnapshot = null;

    // Check Secondary IndexedDB
    try {
      const idbSnap = await this.readFromSecondaryIdb();
      if (idbSnap && Array.isArray(idbSnap.chats) && idbSnap.chats.length > 0) {
        bestSnapshot = { ...idbSnap, source: 'secondary-idb' };
      }
    } catch (e) {}

    // Check OPFS
    try {
      const opfsSnap = await this.readFromOpfs();
      if (opfsSnap && Array.isArray(opfsSnap.chats) && opfsSnap.chats.length > 0) {
        if (!bestSnapshot || (opfsSnap.timestamp || 0) > (bestSnapshot.timestamp || 0)) {
          bestSnapshot = { ...opfsSnap, source: 'opfs' };
        }
      }
    } catch (e) {}

    // Check LocalStorage
    try {
      const lsSnap = this.readFromLocalStorage();
      if (lsSnap && Array.isArray(lsSnap.chats) && lsSnap.chats.length > 0) {
        if (!bestSnapshot || (lsSnap.timestamp || 0) > (bestSnapshot.timestamp || 0)) {
          bestSnapshot = { ...lsSnap, source: 'localstorage' };
        }
      }
    } catch (e) {}

    return bestSnapshot;
  }

  async checkAndAutoRestoreIfEmpty(dbInstance) {
    if (!dbInstance) return { restored: false };

    try {
      await dbInstance.init();
      const chats = await dbInstance.getChats();

      // If primary database already contains chats, do nothing
      if (chats && chats.length > 0) {
        return { restored: false, chatCount: chats.length };
      }

      console.warn('[StorageBackup] Primary database has 0 chats! Checking persistent backups for disaster recovery...');
      const snapshot = await this.getLatestAvailableSnapshot();

      if (!snapshot || !Array.isArray(snapshot.chats) || snapshot.chats.length === 0) {
        console.log('[StorageBackup] No previous backup found to restore.');
        return { restored: false, chatCount: 0 };
      }

      console.log(`[StorageBackup] Disaster recovery triggered! Restoring ${snapshot.chats.length} chats from ${snapshot.source} (saved at ${new Date(snapshot.timestamp).toLocaleString()})`);
      const restored = await this.applySnapshotToDatabase(dbInstance, snapshot);

      return {
        restored: Boolean(restored),
        count: snapshot.chats.length,
        messageCount: snapshot.messages ? snapshot.messages.length : 0,
        source: snapshot.source,
        timestamp: snapshot.timestamp
      };
    } catch (err) {
      console.error('[StorageBackup] Error in checkAndAutoRestoreIfEmpty:', err);
      return { restored: false, error: err.message };
    }
  }

  async restoreFromAutoBackup(dbInstance) {
    const snapshot = await this.getLatestAvailableSnapshot();
    if (!snapshot || !Array.isArray(snapshot.chats) || snapshot.chats.length === 0) {
      throw new Error('No persistent backup snapshot found on this device.');
    }
    await this.applySnapshotToDatabase(dbInstance, snapshot);
    return {
      count: snapshot.chats.length,
      messageCount: snapshot.messages ? snapshot.messages.length : 0,
      timestamp: snapshot.timestamp,
      source: snapshot.source
    };
  }

  async applySnapshotToDatabase(dbInstance, snapshot) {
    this._isRestoring = true;

    try {
      await dbInstance.init();
      const tx = dbInstance.db.transaction(['chats', 'messages', 'calls', 'filters', 'settings'], 'readwrite');

      const chatStore = tx.objectStore('chats');
      const msgStore = tx.objectStore('messages');
      const callStore = tx.objectStore('calls');
      const filterStore = tx.objectStore('filters');
      const setStore = tx.objectStore('settings');

      // Clear existing
      chatStore.clear();
      msgStore.clear();
      callStore.clear();
      filterStore.clear();
      setStore.clear();

      // Populate chats
      for (const c of snapshot.chats || []) {
        chatStore.put(c);
      }

      // Populate messages
      for (const m of snapshot.messages || []) {
        msgStore.put(m);
      }

      // Populate calls
      for (const call of snapshot.calls || []) {
        callStore.put(call);
      }

      // Populate filters
      for (const f of snapshot.filters || []) {
        filterStore.put(f);
      }

      // Populate settings
      for (const s of snapshot.settings || []) {
        setStore.put(s);
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });

      console.log('[StorageBackup] Database auto-restore completed successfully!');
      return true;
    } finally {
      this._isRestoring = false;
    }
  }

  getBackupStatus() {
    return {
      isPersisted: this._isPersisted,
      lastStats: this._lastBackupStats,
      hasBackup: Boolean(this._lastBackupStats && this._lastBackupStats.chatCount > 0)
    };
  }
}

export const storageBackup = new StorageBackupManager();
