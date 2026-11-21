// Voice Recording Controller: Real Microphone Capture, Swipe Up to Lock, Pause/Resume, Waveform & Discard
import { Toast } from './toast.js';

export class VoiceRecorder {
  constructor(options = {}) {
    this.onLocked = options.onLocked || (() => {});
    this.onUpdateTimer = options.onUpdateTimer || (() => {});
    this.onSend = options.onSend || (() => {});
    this.onDiscard = options.onDiscard || (() => {});

    this.mediaRecorder = null;
    this.audioStream = null;
    this.recordedSegments = [];
    this._currentSegmentChunks = [];
    this._pendingSegmentStop = null;
    this.startTime = 0;
    this.segmentStartTime = 0;
    this.accumulatedMs = 0;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.isRecording = false;
    this.isLocked = false;
    this.isPaused = false;
    this.hasStartedRecording = false;
  }

  getElapsedMs() {
    const activeSegmentMs = (!this.isPaused && this.segmentStartTime > 0)
      ? Math.max(0, Date.now() - this.segmentStartTime)
      : 0;
    return this.accumulatedMs + activeSegmentMs;
  }

  getElapsedSeconds() {
    return Math.floor(this.getElapsedMs() / 1000);
  }

  getSupportedMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/aac',
      ''
    ];
    for (const c of candidates) {
      if (!c) return '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
    return '';
  }

  _startSegmentRecorder() {
    if (!this.audioStream) throw new Error('Audio stream unavailable');
    this._currentSegmentChunks = [];
    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.audioStream, { mimeType })
      : new MediaRecorder(this.audioStream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this._currentSegmentChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(100);
    this.segmentStartTime = Date.now();
  }

  async _finishCurrentSegment() {
    if (this._pendingSegmentStop) {
      return this._pendingSegmentStop;
    }

    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') {
      if (this.segmentStartTime > 0) {
        this.accumulatedMs += Math.max(0, Date.now() - this.segmentStartTime);
        this.segmentStartTime = 0;
      }
      this.elapsedSeconds = this.getElapsedSeconds();
      return null;
    }

    const activeElapsed = this.segmentStartTime > 0
      ? Math.max(0, Date.now() - this.segmentStartTime)
      : 0;
    this.accumulatedMs += activeElapsed;
    this.segmentStartTime = 0;
    this.elapsedSeconds = this.getElapsedSeconds();

    const chunks = this._currentSegmentChunks;
    const mimeType = recorder.mimeType || 'audio/webm';

    this._pendingSegmentStop = new Promise((resolve) => {
      let resolved = false;
      const finalize = () => {
        if (resolved) return;
        resolved = true;
        this._pendingSegmentStop = null;
        this.mediaRecorder = null;
        this._currentSegmentChunks = [];
        if (chunks.length > 0) {
          const segBlob = new Blob(chunks, { type: mimeType });
          if (segBlob.size > 0) {
            this.recordedSegments.push(segBlob);
          }
        }
        resolve();
      };

      recorder.onstop = finalize;
      try {
        if (recorder.state === 'recording' && typeof recorder.requestData === 'function') {
          recorder.requestData();
        }
        recorder.stop();
      } catch (e) {
        console.warn('[VoiceRecorder] Error finishing segment:', e);
        finalize();
      }
    });

    return this._pendingSegmentStop;
  }

  async start() {
    this.recordedSegments = [];
    this._currentSegmentChunks = [];
    this._pendingSegmentStop = null;
    this.accumulatedMs = 0;
    this.segmentStartTime = 0;
    this.elapsedSeconds = 0;
    this.isRecording = false;
    this.isPaused = false;
    this.hasStartedRecording = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Toast.show('Audio recording is not supported in this browser');
      return false;
    }

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (err) {
      console.warn('[VoiceRecorder] getUserMedia failed or denied:', err);
      Toast.show('Microphone permission denied. Please allow microphone access in your browser settings');
      return false;
    }

    try {
      this.startTime = Date.now();
      this._startSegmentRecorder();
      this.isRecording = true;
      this.hasStartedRecording = true;
      this.startTimer();
      return true;
    } catch (recErr) {
      console.error('[VoiceRecorder] Failed to start MediaRecorder:', recErr);
      this.cleanupStream();
      Toast.show('Failed to start microphone recording');
      return false;
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && this.isRecording) {
        this.elapsedSeconds = this.getElapsedSeconds();
        this.onUpdateTimer(this.elapsedSeconds);
      }
    }, 250);
    this.elapsedSeconds = this.getElapsedSeconds();
    this.onUpdateTimer(this.elapsedSeconds);
  }

  async pause() {
    if (!this.isRecording || this.isPaused) return;
    this.isPaused = true;
    await this._finishCurrentSegment();
    this.onUpdateTimer(this.elapsedSeconds);
  }

  async resume() {
    if (!this.isRecording || !this.isPaused) return;
    if (this._pendingSegmentStop) {
      await this._pendingSegmentStop;
    }
    this.isPaused = false;
    try {
      this._startSegmentRecorder();
      this.onUpdateTimer(this.getElapsedSeconds());
    } catch (e) {
      console.warn('[VoiceRecorder] Error resuming segment recorder:', e);
    }
  }

  static encodeWavFromFloat32(samples, sampleRate = 48000) {
    const length = samples.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);       // PCM format chunk size
    view.setUint16(20, 1, true);        // Linear PCM
    view.setUint16(22, 1, true);        // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true);        // Block align
    view.setUint16(34, 16, true);       // 16-bit
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  async _buildContinuousBlob() {
    const fallbackDuration = Math.max(1, Math.round(this.getElapsedMs() / 1000));
    if (this.recordedSegments.length === 0) {
      return { blob: null, duration: 0 };
    }

    if (this.recordedSegments.length === 1) {
      return {
        blob: this.recordedSegments[0],
        duration: fallbackDuration
      };
    }

    // Multiple paused segments: decode & concatenate cleanly into continuous gap-free WAV
    const AudioCtx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
    if (!AudioCtx) {
      return {
        blob: new Blob(this.recordedSegments, { type: this.recordedSegments[0].type || 'audio/webm' }),
        duration: fallbackDuration
      };
    }

    let ctx = null;
    try {
      ctx = new AudioCtx();
      const decodedList = [];
      for (const segBlob of this.recordedSegments) {
        if (!segBlob || segBlob.size === 0) continue;
        const arr = await segBlob.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arr);
        decodedList.push(audioBuf);
      }

      if (decodedList.length === 0) {
        return { blob: null, duration: 0 };
      }

      const targetRate = decodedList[0].sampleRate || ctx.sampleRate || 48000;
      const monoSegments = [];
      let totalSamples = 0;

      for (const buf of decodedList) {
        let working = buf;
        if (buf.sampleRate !== targetRate && typeof OfflineAudioContext !== 'undefined') {
          const targetLen = Math.max(1, Math.round(buf.duration * targetRate));
          const offline = new OfflineAudioContext(1, targetLen, targetRate);
          const src = offline.createBufferSource();
          src.buffer = buf;
          src.connect(offline.destination);
          src.start(0);
          working = await offline.startRendering();
        }

        const chCount = working.numberOfChannels || 1;
        const len = working.length;
        const mono = new Float32Array(len);
        if (chCount === 1) {
          mono.set(working.getChannelData(0));
        } else {
          for (let c = 0; c < chCount; c++) {
            const chData = working.getChannelData(c);
            for (let i = 0; i < len; i++) {
              mono[i] += chData[i] / chCount;
            }
          }
        }
        monoSegments.push(mono);
        totalSamples += mono.length;
      }

      const merged = new Float32Array(totalSamples);
      let cursor = 0;
      for (const seg of monoSegments) {
        merged.set(seg, cursor);
        cursor += seg.length;
      }

      const wavBlob = VoiceRecorder.encodeWavFromFloat32(merged, targetRate);
      const exactDuration = Math.max(1, Math.round(merged.length / targetRate));
      return { blob: wavBlob, duration: exactDuration };
    } catch (stitchErr) {
      console.warn('[VoiceRecorder] Audio stitching fallback:', stitchErr);
      return {
        blob: new Blob(this.recordedSegments, { type: this.recordedSegments[0].type || 'audio/webm' }),
        duration: fallbackDuration
      };
    } finally {
      if (ctx && typeof ctx.close === 'function') {
        ctx.close().catch(() => {});
      }
    }
  }

  async getPreviewBlob() {
    if (!this.isPaused && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      await this.pause();
    } else if (this._pendingSegmentStop) {
      await this._pendingSegmentStop;
    }
    const { blob } = await this._buildContinuousBlob();
    return blob;
  }

  lock() {
    this.isLocked = true;
    this.onLocked();
  }

  async stop(shouldSend = true) {
    clearInterval(this.timerInterval);
    const wasRecording = this.isRecording;

    if (!wasRecording) {
      this.isLocked = false;
      this.isPaused = false;
      this.hasStartedRecording = false;
      return null;
    }

    await this._finishCurrentSegment();

    this.isRecording = false;
    this.isLocked = false;
    this.isPaused = false;
    this.hasStartedRecording = false;

    if (!shouldSend) {
      this.recordedSegments = [];
      this.cleanupStream();
      this.onDiscard();
      return null;
    }

    const { blob: finalBlob, duration } = await this._buildContinuousBlob();
    this.recordedSegments = [];
    this.cleanupStream();

    if (finalBlob && finalBlob.size > 0) {
      this.onSend(finalBlob, duration);
      return finalBlob;
    }

    Toast.show('No audio recorded');
    this.onDiscard();
    return null;
  }

  cleanupStream() {
    if (this.audioStream) {
      try {
        this.audioStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.audioStream = null;
    }
  }

  static formatDuration(sec) {
    if (isNaN(sec) || !isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
