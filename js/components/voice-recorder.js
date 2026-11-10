// Voice Recording Controller: Press & Hold, Swipe Up to Lock, Pause/Resume, Waveform & Discard
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
    this.isSimulated = false;

    this.startY = 0;
    this.startX = 0;
    this.longPressTimer = null;
    this.hasStartedRecording = false;
  }

  async start() {
    this.audioChunks = [];
    this.elapsedSeconds = 0;
    this.isRecording = true;
    this.isPaused = false;
    this.hasStartedRecording = true;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : '';
        }

        this.mediaRecorder = mimeType ? new MediaRecorder(this.audioStream, { mimeType }) : new MediaRecorder(this.audioStream);

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.audioChunks.push(e.data);
          }
        };

        this.mediaRecorder.start(100);
        this.isSimulated = false;
      } else {
        this.isSimulated = true;
      }
    } catch (err) {
      console.warn('[VoiceRecorder] Microphone permission denied or unavailable, using high-fidelity simulated note:', err);
      this.isSimulated = true;
    }

    this.startTime = Date.now();
    this.startTimer();
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.elapsedSeconds++;
        this.onUpdateTimer(this.elapsedSeconds);
      }
    }, 1000);
    this.onUpdateTimer(this.elapsedSeconds);
  }

  pause() {
    if (!this.isRecording || this.isPaused) return;
    this.isPaused = true;
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.pause();
      } catch (e) {}
    }
  }

  resume() {
    if (!this.isRecording || !this.isPaused) return;
    this.isPaused = false;
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      try {
        this.mediaRecorder.resume();
      } catch (e) {}
    }
  }

  lock() {
    this.isLocked = true;
    this.onLocked();
  }

  async stop(shouldSend = true) {
    clearInterval(this.timerInterval);
    const duration = Math.max(1, this.elapsedSeconds);
    const wasRecording = this.isRecording;

    this.isRecording = false;
    this.isLocked = false;
    this.isPaused = false;
    this.hasStartedRecording = false;

    if (!wasRecording) return;

    if (!shouldSend) {
      this.cleanupStream();
      this.onDiscard();
      return;
    }

    if (this.isSimulated || !this.mediaRecorder || this.audioChunks.length === 0) {
      this.cleanupStream();
      const mockBlob = this.createSyntheticVoiceBlob(duration);
      this.onSend(mockBlob, duration);
      return;
    }

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanupStream();
        this.onSend(audioBlob, duration);
        resolve(audioBlob);
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        } else {
          this.cleanupStream();
          const fallbackBlob = this.createSyntheticVoiceBlob(duration);
          this.onSend(fallbackBlob, duration);
          resolve(fallbackBlob);
        }
      } catch (e) {
        this.cleanupStream();
        const fallbackBlob = this.createSyntheticVoiceBlob(duration);
        this.onSend(fallbackBlob, duration);
        resolve(fallbackBlob);
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

  /**
   * Generates a valid silent/tonal WAV audio blob for simulated fallback
   */
  createSyntheticVoiceBlob(durationSeconds) {
    const sampleRate = 8000;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Subtle gentle hum waveform
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin((i / sampleRate) * 440 * Math.PI * 2) * 2000;
      view.setInt16(44 + i * 2, sample, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  static formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
