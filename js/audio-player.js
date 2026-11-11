// WhatsApp Audio & Voice Note Player Engine with Waveform & Speed Controls
import { Icons } from './icons.js';

class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.currentCard = null;
    this.speeds = [1.0, 1.5, 2.0];
    this.speedIndex = 0;
  }

  stopCurrent() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch (e) {}
      if (this.currentCard) {
        this.updatePlayState(this.currentCard, false);
      }
      this.currentAudio = null;
      this.currentCard = null;
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Generate deterministic peaks for voice notes based on filename/string hash
  generateWaveformPeaks(seedString, count = 35) {
    let hash = 0;
    const str = String(seedString || 'voice_note');
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const peaks = [];
    for (let i = 0; i < count; i++) {
      const pseudo = Math.abs(Math.sin((hash + i * 37) * 0.1));
      peaks.push(Math.max(0.15, Math.min(0.95, pseudo)));
    }
    return peaks;
  }

  createVoiceNoteCard(mediaItem, audioUrl) {
    const card = document.createElement('div');
    card.className = 'wa-voice-card';

    const filename = mediaItem.filename || 'voice_note';
    const peaks = this.generateWaveformPeaks(filename);

    const knownDuration = (typeof mediaItem.duration === 'number' && mediaItem.duration > 0)
      ? mediaItem.duration
      : 0;

    let effectiveDuration = knownDuration;

    card.innerHTML = `
      <div class="voice-avatar-mic">
        <button class="voice-play-btn" aria-label="Play voice note">
          ${Icons.play('play-icon', 22)}
        </button>
      </div>
      <div class="voice-body">
        <div class="voice-waveform" role="slider" aria-label="Audio scrubber">
          ${peaks
            .map(
              (p, idx) =>
                `<div class="wave-bar" data-idx="${idx}" style="height: ${Math.round(p * 28 + 4)}px"></div>`
            )
            .join('')}
        </div>
        <div class="voice-footer">
          <span class="voice-duration">${this.formatTime(knownDuration)}</span>
          <button class="voice-speed-pill" title="Playback speed">1x</button>
        </div>
      </div>
      <audio src="${audioUrl}" preload="metadata" style="display:none;"></audio>
    `;

    const audio = card.querySelector('audio');
    const playBtn = card.querySelector('.voice-play-btn');
    const durationSpan = card.querySelector('.voice-duration');
    const speedPill = card.querySelector('.voice-speed-pill');
    const waveform = card.querySelector('.voice-waveform');
    const bars = card.querySelectorAll('.wave-bar');

    // Load duration when metadata is ready
    audio.addEventListener('loadedmetadata', () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        effectiveDuration = Math.round(audio.duration);
        durationSpan.textContent = this.formatTime(effectiveDuration);
      } else if (knownDuration > 0) {
        durationSpan.textContent = this.formatTime(knownDuration);
      }
    });

    audio.addEventListener('durationchange', () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        effectiveDuration = Math.round(audio.duration);
        durationSpan.textContent = this.formatTime(effectiveDuration);
      }
    });

    // Play/Pause button
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (audio.paused) {
        if (this.currentAudio && this.currentAudio !== audio) {
          this.stopCurrent();
        }
        audio.play().catch((err) => {
          console.warn('[AudioPlayer] Audio play failed:', err);
          this.updatePlayState(card, false);
        });
        this.currentAudio = audio;
        this.currentCard = card;
        this.updatePlayState(card, true);
      } else {
        audio.pause();
        this.updatePlayState(card, false);
      }
    });

    // Time update & waveform filling
    audio.addEventListener('timeupdate', () => {
      const cur = audio.currentTime;
      const total = (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : (effectiveDuration || 1);
      const progress = Math.min(1, Math.max(0, cur / total));
      const activeBarCount = Math.floor(progress * bars.length);
      bars.forEach((bar, idx) => {
        if (idx <= activeBarCount) {
          bar.classList.add('played');
        } else {
          bar.classList.remove('played');
        }
      });
      durationSpan.textContent = this.formatTime(Math.floor(cur));
    });

    // Audio ended
    audio.addEventListener('ended', () => {
      this.updatePlayState(card, false);
      durationSpan.textContent = this.formatTime(effectiveDuration || knownDuration);
      bars.forEach((bar) => bar.classList.remove('played'));
      this.currentAudio = null;
      this.currentCard = null;
    });

    // Speed toggle (1x -> 1.5x -> 2x)
    speedPill.addEventListener('click', (e) => {
      e.stopPropagation();
      this.speedIndex = (this.speedIndex + 1) % this.speeds.length;
      const speed = this.speeds[this.speedIndex];
      audio.playbackRate = speed;
      speedPill.textContent = `${speed}x`;
    });

    // Scrubbing on waveform click
    waveform.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = waveform.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const total = (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : effectiveDuration;
      if (total > 0) {
        audio.currentTime = ratio * total;
        durationSpan.textContent = this.formatTime(Math.floor(audio.currentTime));
      }
    });

    return card;
  }

  updatePlayState(card, isPlaying) {
    const playBtn = card.querySelector('.voice-play-btn');
    if (!playBtn) return;
    if (isPlaying) {
      playBtn.innerHTML = Icons.pause('pause-icon', 22);
      card.classList.add('is-playing');
    } else {
      playBtn.innerHTML = Icons.play('play-icon', 22);
      card.classList.remove('is-playing');
    }
  }
}

export const audioManager = new AudioManager();
