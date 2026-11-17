// Central Smart Background Task Manager for WhatsApp Clone
// Coordinates background media processing, calls indexing, and thumbnail rendering
// Guarantees non-blocking UI transitions and prioritizes active chat in real-time.

import { db } from '../db.js';

class BackgroundTaskManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.activeChatId = null;
    this.listeners = new Map();

    // Track pending items per chat
    // Map<chatId, Set<cleanName | mediaId>>
    this.pendingMediaByChat = new Map();
    // Map<chatId, string[]> ordered highest-priority mediaIds
    this.prioritizedMediaByChat = new Map();
    // Set<chatId>
    this.callsIndexingChats = new Set();

    // Stats for progress bar
    this.totalTasksInRun = 0;
    this.completedTasksInRun = 0;

    this.progressBarEl = null;
    this._progressHideTimeout = null;

    // Concurrency limit for background operations
    this.MAX_CONCURRENT = 2;
    this.currentlyRunning = 0;
  }

  // --- Event Emitter ---
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const handler of this.listeners.get(event)) {
        try {
          handler(data);
        } catch (err) {
          console.warn(`[BackgroundTaskManager] Listener error on event "${event}":`, err);
        }
      }
    }
  }

  // --- Active Chat & Priority Queue Management ---
  setActiveChat(chatId) {
    if (this.activeChatId === chatId) return;
    this.activeChatId = chatId;

    if (!chatId || this.queue.length === 0) return;
    this._reprioritizeQueue();
  }

  /**
   * Prioritize media items belonging to the currently rendered/visible batch
   * for `chatId`, then unrendered active-chat media newest-to-oldest, then active-chat calls.
   */
  prioritizeChatMedia(chatId, orderedPriorityMediaIds = []) {
    if (!chatId) return;

    const rankMap = new Map();
    if (Array.isArray(orderedPriorityMediaIds)) {
      orderedPriorityMediaIds.forEach((id) => {
        if (!id) return;
        const key = String(id);
        if (!rankMap.has(key)) {
          rankMap.set(key, rankMap.size);
        }
      });
    }

    this.prioritizedMediaByChat.set(chatId, rankMap);
    if (this.activeChatId !== chatId) {
      this.activeChatId = chatId;
    }

    if (this.queue.length > 0) {
      this._reprioritizeQueue();
    }
  }

  _reprioritizeQueue() {
    if (!this.activeChatId || this.queue.length === 0) return;

    const targetChatId = this.activeChatId;
    const rankMap = this.prioritizedMediaByChat.get(targetChatId) || null;
    const rankedMedia = [];
    const unrankedMedia = [];
    const activeCalls = [];
    const otherItems = [];

    for (const item of this.queue) {
      if (item.chatId !== targetChatId) {
        otherItems.push(item);
        continue;
      }

      if (item.type === 'calls') {
        activeCalls.push(item);
        continue;
      }

      if (rankMap && rankMap.size > 0) {
        const rankById = item.mediaId ? rankMap.get(String(item.mediaId)) : undefined;
        const rankByName = item.cleanName ? rankMap.get(String(item.cleanName)) : undefined;
        const rank = rankById !== undefined ? rankById : rankByName;
        if (rank !== undefined) {
          rankedMedia.push({ item, rank });
          continue;
        }
      }

      unrankedMedia.push(item);
    }

    if (rankedMedia.length > 1) {
      rankedMedia.sort((a, b) => a.rank - b.rank);
    }

    if (unrankedMedia.length > 1) {
      unrankedMedia.sort((a, b) => {
        const tsDiff = (b.itemTimestamp || 0) - (a.itemTimestamp || 0);
        if (tsDiff !== 0) return tsDiff;
        return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
      });
    }

    this.queue = [
      ...rankedMedia.map((entry) => entry.item),
      ...unrankedMedia,
      ...activeCalls,
      ...otherItems
    ];
  }

  // --- Enqueue Chat Media and Calls Processing ---
  enqueueChatMedia({
    chatId,
    chatName = 'WhatsApp Chat',
    extractedMediaFiles, // Map<cleanName, fileItem>
    mediaIdMap, // Map<cleanName, mediaId>
    mediaDurationMap = null,
    msgTimestampByMediaName = null,
    orderedMediaIds = null,
    calls = []
  }) {
    if (!this.pendingMediaByChat.has(chatId)) {
      this.pendingMediaByChat.set(chatId, new Set());
    }
    const chatPendingSet = this.pendingMediaByChat.get(chatId);

    const defaultOrderMap = new Map();
    if (Array.isArray(orderedMediaIds)) {
      orderedMediaIds.forEach((id) => {
        if (!id) return;
        const key = String(id);
        if (!defaultOrderMap.has(key)) {
          defaultOrderMap.set(key, defaultOrderMap.size);
        }
      });
    }

    const mediaTasks = [];
    const callTasks = [];

    // 1. Enqueue media items
    if (extractedMediaFiles && extractedMediaFiles.size > 0) {
      let fallbackOrder = 0;
      for (const [cleanName, fileItem] of extractedMediaFiles.entries()) {
        const mediaId = (mediaIdMap && mediaIdMap.get(cleanName))
          || ('media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

        chatPendingSet.add(cleanName);
        chatPendingSet.add(mediaId);

        const itemTimestamp = (msgTimestampByMediaName && msgTimestampByMediaName.get(cleanName)) || Date.now();
        const preDuration = (mediaDurationMap && mediaDurationMap.get(cleanName)) || 0;
        const orderIndex = defaultOrderMap.has(String(mediaId))
          ? defaultOrderMap.get(String(mediaId))
          : (defaultOrderMap.size + fallbackOrder++);

        mediaTasks.push({
          id: `task_${mediaId}`,
          type: 'media',
          chatId,
          chatName,
          mediaId,
          cleanName,
          fileItem,
          itemTimestamp,
          orderIndex,
          preDuration
        });
      }

      // Default background order: newest messages first (or explicit orderedMediaIds)
      mediaTasks.sort((a, b) => {
        if (defaultOrderMap.size > 0) {
          const aHas = defaultOrderMap.has(String(a.mediaId));
          const bHas = defaultOrderMap.has(String(b.mediaId));
          if (aHas || bHas) {
            return a.orderIndex - b.orderIndex;
          }
        }
        return (b.itemTimestamp || 0) - (a.itemTimestamp || 0);
      });
    }

    // 2. Enqueue calls indexing
    if (calls && calls.length > 0) {
      this.callsIndexingChats.add(chatId);
      this.emit('calls-indexing-start', { chatId, count: calls.length });

      callTasks.push({
        id: `task_calls_${chatId}_${Date.now()}`,
        type: 'calls',
        chatId,
        chatName,
        calls
      });
    }

    const newTasks = [...mediaTasks, ...callTasks];
    if (newTasks.length === 0) return;

    this.queue.push(...newTasks);
    if (this.activeChatId) {
      this._reprioritizeQueue();
    }

    this.totalTasksInRun += newTasks.length;
    this._updateProgressBar();

    this.emit('tasks-enqueued', { chatId, count: newTasks.length });
    this._startProcessing();
  }

  // --- Processing Loop ---
  _startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this._scheduleNext();
  }

  _scheduleNext() {
    const runner = () => {
      this._drainQueue();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(runner, { timeout: 60 });
    } else {
      setTimeout(runner, 16);
    }
  }

  async _drainQueue() {
    if (this.queue.length === 0 && this.currentlyRunning === 0) {
      this.isProcessing = false;
      this._onAllComplete();
      return;
    }

    while (this.queue.length > 0 && this.currentlyRunning < this.MAX_CONCURRENT) {
      const task = this.queue.shift();
      if (!task) break;

      this.currentlyRunning++;
      this._executeTask(task)
        .catch((err) => {
          console.warn('[BackgroundTaskManager] Task execution warning:', task.id, err);
        })
        .finally(() => {
          this.currentlyRunning--;
          this.completedTasksInRun++;
          this._updateProgressBar();
          this._scheduleNext();
        });
    }
  }

  async _executeTask(task) {
    if (task.type === 'media') {
      await this._processSingleMedia(task);
    } else if (task.type === 'calls') {
      await this._processCalls(task);
    }
  }

  async _processSingleMedia(task) {
    const { chatId, mediaId, cleanName, fileItem, itemTimestamp, preDuration } = task;

    try {
      // Determine media type
      let type = 'document';
      const lower = cleanName.toLowerCase();
      if (/\.webp$/i.test(lower) || lower.includes('sticker') || lower.includes('stk-')) type = 'sticker';
      else if (/\.(jpg|jpeg|png|gif|heic|bmp)$/i.test(lower)) type = 'image';
      else if (/\.(mp4|3gp|mov|mkv|webm)$/i.test(lower)) type = 'video';
      else if (/\.(opus|ogg|mp3|m4a|aac|wav)$/i.test(lower)) type = 'audio';
      else if (/\.pdf$/i.test(lower)) type = 'pdf';

      let mimeType = 'application/octet-stream';
      if (type === 'sticker') mimeType = 'image/webp';
      else if (type === 'image') mimeType = 'image/jpeg';
      else if (type === 'video') mimeType = 'video/mp4';
      else if (type === 'pdf') mimeType = 'application/pdf';
      else if (type === 'audio') {
        if (/\.(opus|ogg)$/i.test(cleanName)) mimeType = 'audio/ogg; codecs=opus';
        else if (/\.(m4a|aac)$/i.test(cleanName)) mimeType = 'audio/mp4';
        else if (/\.mp3$/i.test(cleanName)) mimeType = 'audio/mpeg';
        else if (/\.wav$/i.test(cleanName)) mimeType = 'audio/wav';
        else if (/\.webm$/i.test(cleanName)) mimeType = 'audio/webm';
        else mimeType = 'audio/ogg';
      }

      let audioDuration = preDuration || 0;
      if (type === 'audio' && !audioDuration) {
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
          console.warn('[BackgroundTaskManager] PDF thumb render error:', cleanName, pdfErr);
          thumbnailBlob = null;
        }
      }

      const mediaRecord = {
        id: mediaId,
        chatId,
        filename: cleanName,
        type,
        mimeType,
        blob,
        thumbnailBlob,
        size: fileItem.size || fileItem.data.byteLength,
        duration: audioDuration,
        pageCount,
        timestamp: itemTimestamp || Date.now()
      };

      await db.saveMedia(mediaRecord);

      // Clean up from pending set
      const pendingSet = this.pendingMediaByChat.get(chatId);
      if (pendingSet) {
        pendingSet.delete(cleanName);
        pendingSet.delete(mediaId);
        if (pendingSet.size === 0) {
          this.pendingMediaByChat.delete(chatId);
        }
      }

      // Notify UI in real-time
      this.emit('media-ready', {
        chatId,
        mediaId,
        cleanName,
        mediaRecord
      });
    } catch (err) {
      console.warn('[BackgroundTaskManager] Failed processing media item:', cleanName, err);
      // Remove from pending set to prevent infinite loading state
      const pendingSet = this.pendingMediaByChat.get(chatId);
      if (pendingSet) {
        pendingSet.delete(cleanName);
        pendingSet.delete(mediaId);
      }
      this.emit('media-error', { chatId, mediaId, cleanName, error: err.message });
    }
  }

  async _processCalls(task) {
    const { chatId, calls } = task;
    try {
      await db.saveCallsBatch(calls);
      this.callsIndexingChats.delete(chatId);
      this.emit('calls-ready', { chatId, count: calls.length });
    } catch (err) {
      console.error('[BackgroundTaskManager] Failed saving calls batch:', err);
      this.callsIndexingChats.delete(chatId);
    }
  }

  _onAllComplete() {
    this.emit('all-tasks-complete');
    this.totalTasksInRun = 0;
    this.completedTasksInRun = 0;
    this._updateProgressBar(true);
  }

  // --- Query Methods ---
  isMediaPending(chatId, mediaId = null, cleanName = null) {
    const pendingSet = this.pendingMediaByChat.get(chatId);
    if (!pendingSet) return false;
    if (mediaId && pendingSet.has(mediaId)) return true;
    if (cleanName && pendingSet.has(cleanName)) return true;
    return false;
  }

  isCallsIndexing(chatId = null) {
    if (chatId) return this.callsIndexingChats.has(chatId);
    return this.callsIndexingChats.size > 0;
  }

  isChatProcessing(chatId) {
    const hasMedia = this.pendingMediaByChat.has(chatId) && this.pendingMediaByChat.get(chatId).size > 0;
    const hasCalls = this.callsIndexingChats.has(chatId);
    return hasMedia || hasCalls;
  }

  hasPendingTasks() {
    return this.queue.length > 0 || this.currentlyRunning > 0;
  }

  // --- Discreet Top Progress Bar ---
  _ensureProgressBar() {
    if (this.progressBarEl && document.body.contains(this.progressBarEl)) {
      return this.progressBarEl;
    }
    let bar = document.getElementById('wa-global-progress-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'wa-global-progress-bar';
      bar.innerHTML = '<div class="wa-global-progress-fill"></div>';
      document.body.appendChild(bar);
    }
    this.progressBarEl = bar;
    return bar;
  }

  _updateProgressBar(isDone = false) {
    const bar = this._ensureProgressBar();
    if (!bar) return;

    clearTimeout(this._progressHideTimeout);

    const fill = bar.querySelector('.wa-global-progress-fill');
    if (!fill) return;

    if (isDone || this.totalTasksInRun === 0) {
      fill.style.width = '100%';
      this._progressHideTimeout = setTimeout(() => {
        bar.classList.remove('active');
        fill.style.width = '0%';
      }, 400);
      return;
    }

    bar.classList.add('active');
    const pct = Math.min(96, Math.max(8, Math.round((this.completedTasksInRun / this.totalTasksInRun) * 100)));
    fill.style.width = `${pct}%`;
  }
}

export const backgroundTasks = new BackgroundTaskManager();
if (typeof window !== 'undefined') {
  window.backgroundTasks = backgroundTasks;
}
