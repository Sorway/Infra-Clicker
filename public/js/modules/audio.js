export class AudioManager {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.context = null;
  }

  ensureContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  tone(frequency, duration = 0.06, type = 'sine', volume = 0.035, delay = 0) {
    if (!this.enabled) return;
    this.ensureContext();
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  click() {
    this.tone(620, 0.035, 'square', 0.018);
    this.tone(900, 0.04, 'sine', 0.012, 0.02);
  }

  purchase() {
    this.tone(420, 0.08, 'triangle', 0.04);
    this.tone(680, 0.1, 'triangle', 0.035, 0.06);
  }

  event(danger = true) {
    this.tone(danger ? 180 : 520, 0.22, danger ? 'sawtooth' : 'sine', 0.045);
    this.tone(danger ? 130 : 780, 0.25, 'triangle', 0.035, 0.15);
  }

  achievement() {
    [523, 659, 784].forEach((frequency, index) => this.tone(frequency, 0.16, 'sine', 0.03, index * 0.08));
  }

  prestige() {
    [220, 330, 440, 660, 880].forEach((frequency, index) => this.tone(frequency, 0.3, 'sine', 0.035, index * 0.1));
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}
