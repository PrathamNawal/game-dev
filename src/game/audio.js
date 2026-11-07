// WebAudio synth: zero audio assets (smaller download, works offline, no licensing).
// Context is created lazily on the first user gesture (browser autoplay policy).
export class GameAudio {
  constructor() { this.ctx = null; this.enabled = true; this.master = null; this.rollGain = null; this.rollFilter = null; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 0.7 : 0;
      this.master.connect(this.ctx.destination);
      this._buildRoll();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.02);
  }

  _buildRoll() {
    const c = this.ctx, len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 8; } // brown-ish noise
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    this.rollFilter = c.createBiquadFilter(); this.rollFilter.type = 'lowpass'; this.rollFilter.frequency.value = 300;
    this.rollGain = c.createGain(); this.rollGain.gain.value = 0;
    src.connect(this.rollFilter).connect(this.rollGain).connect(this.master); src.start();
  }

  /** Continuous rolling rumble: louder and brighter with speed. */
  setRolling(speed) {
    if (!this.ctx || !this.rollGain) return;
    const k = Math.min(1, speed / 6), t = this.ctx.currentTime;
    this.rollGain.gain.setTargetAtTime(Math.pow(k, 1.3) * 0.5, t, 0.05);
    this.rollFilter.frequency.setTargetAtTime(160 + k * 900, t, 0.05);
  }

  _tone(freq, dur, { type = 'sine', vol = 0.2, slideTo = null, delay = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, { vol = 0.2, freq = 1500, delay = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master); s.start(t);
  }

  hit(k = 0.5) { this._tone(180 + k * 120, 0.09, { type: 'triangle', vol: 0.12 + k * 0.25, slideTo: 90 }); this._noise(0.05, { vol: 0.05 + k * 0.15, freq: 2200 }); }
  coin(n = 1) { const b = 880 * Math.pow(1.122, Math.max(0, n - 1)); this._tone(b, 0.12, { type: 'square', vol: 0.07 }); this._tone(b * 1.5, 0.2, { type: 'square', vol: 0.06, delay: 0.07 }); }
  fall() { this._tone(520, 0.45, { type: 'sine', vol: 0.2, slideTo: 70 }); this._noise(0.3, { vol: 0.08, freq: 700, delay: 0.05 }); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.28, { type: 'triangle', vol: 0.16, delay: i * 0.09 })); }
  star(i = 0) { this._tone(660 * Math.pow(1.25, i), 0.18, { type: 'triangle', vol: 0.14 }); }
  click() { this._tone(520, 0.05, { type: 'triangle', vol: 0.08 }); }
  hint() { this._tone(740, 0.25, { type: 'sine', vol: 0.1, slideTo: 1100 }); }
  error() { this._tone(140, 0.18, { type: 'sawtooth', vol: 0.08 }); }
}
