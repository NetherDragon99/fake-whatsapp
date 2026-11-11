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
    this.audioChunks = [];
    this.startTime = 0;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.isRecording = false;
    this.isLocked = false;
    this.isPaused = false;
    this.hasStartedRecording = false;
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

  async start() {
    this.audioChunks = [];
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
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.audioStream, { mimeType })
        : new MediaRecorder(this.audioStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      // Deliver audio data every 100ms
      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.hasStartedRecording = true;
      this.startTime = Date.now();
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
      if (!this.isPaused) {
        this.elapsedSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
        this.onUpdateTimer(this.elapsedSeconds);
      }
    }, 500);
    this.onUpdateTimer(this.elapsedSeconds);
  }

  pause() {
    if (!this.isRecording || this.isPaused) return;
    this.isPaused = true;
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        if (typeof this.mediaRecorder.requestData === 'function') {
          this.mediaRecorder.requestData();
        }
        this.mediaRecorder.pause();
      } catch (e) {
        console.warn('[VoiceRecorder] Error pausing recorder:', e);
      }
    }
  }

  resume() {
    if (!this.isRecording || !this.isPaused) return;
    this.isPaused = false;
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      try {
        this.mediaRecorder.resume();
      } catch (e) {
        console.warn('[VoiceRecorder] Error resuming recorder:', e);
      }
    }
  }

  async getPreviewBlob() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        if (typeof this.mediaRecorder.requestData === 'function') {
          this.mediaRecorder.requestData();
        }
      } catch (e) {}
    }
    // Small microtask delay to allow ondataavailable to deliver buffered chunks
    await new Promise((r) => setTimeout(r, 60));

    if (!this.audioChunks || this.audioChunks.length === 0) {
      return null;
    }
    const mimeType = (this.mediaRecorder && this.mediaRecorder.mimeType) || 'audio/webm';
    return new Blob(this.audioChunks, { type: mimeType });
  }

  lock() {
    this.isLocked = true;
    this.onLocked();
  }

  async stop(shouldSend = true) {
    clearInterval(this.timerInterval);
    const duration = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
    const wasRecording = this.isRecording;

    this.isRecording = false;
    this.isLocked = false;
    this.isPaused = false;
    this.hasStartedRecording = false;

    if (!wasRecording) return null;

    if (!shouldSend) {
      this.cleanupStream();
      this.onDiscard();
      return null;
    }

    if (!this.mediaRecorder) {
      this.cleanupStream();
      this.onDiscard();
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const mimeType = (this.mediaRecorder && this.mediaRecorder.mimeType) || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanupStream();

        if (audioBlob.size > 0) {
          this.onSend(audioBlob, duration);
          resolve(audioBlob);
        } else {
          Toast.show('No audio recorded');
          this.onDiscard();
          resolve(null);
        }
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        } else {
          const mimeType = (this.mediaRecorder && this.mediaRecorder.mimeType) || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          this.cleanupStream();
          if (audioBlob.size > 0) {
            this.onSend(audioBlob, duration);
            resolve(audioBlob);
          } else {
            this.onDiscard();
            resolve(null);
          }
        }
      } catch (e) {
        console.error('[VoiceRecorder] Error stopping MediaRecorder:', e);
        this.cleanupStream();
        resolve(null);
      }
    });
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
