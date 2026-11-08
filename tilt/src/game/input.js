// Input layer: sources (gyro / touch stick / keyboard) -> one tilt vector in [-1,1]^2.
// Gameplay never reads raw keys or sensors (input-systems skill: actions, not devices).

const GYRO_FULL_DEG = 22;     // degrees of device tilt = full tilt
const GYRO_DEADZONE_DEG = 1.5;
const STICK_FULL_PX = 70;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Input {
  /** @param {HTMLElement} surface element that receives pointer input (the stage) */
  constructor(surface) {
    this.surface = surface;
    this.sensitivity = 1;
    this.controls = 'auto';          // 'auto' | 'tilt' | 'touch'
    this.keys = new Set();
    this.keyVec = { x: 0, y: 0 };
    this.stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.gyro = { enabled: false, available: false, sample: null, neutral: null, smooth: { x: 0, y: 0 } };
    this.onPause = null;
    this.onUserInput = null;
    this._bind();
  }

  _bind() {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        this.keys.add(k); e.preventDefault(); this.onUserInput?.();
      } else if (k === 'escape' || k === 'p') this.onPause?.();
      else if (k === 'r') this.recalibrate();
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { this.keys.clear(); this.stick.active = false; });

    const s = this.surface;
    s.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-ui]')) return;
      if (this.usingGyro) return; // tilt mode ignores accidental touches
      this.stick = { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      try { s.setPointerCapture(e.pointerId); } catch { /* noop */ }
      this.onUserInput?.();
    });
    s.addEventListener('pointermove', e => {
      if (!this.stick.active || e.pointerId !== this.stick.id) return;
      let dx = (e.clientX - this.stick.ox) / STICK_FULL_PX, dy = (e.clientY - this.stick.oy) / STICK_FULL_PX;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      this.stick.x = dx; this.stick.y = dy;
    });
    const end = e => { if (this.stick.active && e.pointerId === this.stick.id) this.stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 }; };
    s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end);
    s.addEventListener('contextmenu', e => e.preventDefault());
  }

  /** True when device tilt is the active control scheme. */
  get usingGyro() {
    if (this.controls === 'touch') return false;
    return this.gyro.enabled && this.gyro.available;
  }

  /** Must be called from a user gesture (iOS). Resolves to 'granted' | 'denied' | 'unsupported'. */
  async enableGyro() {
    if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') return 'denied';
      }
    } catch { return 'denied'; }
    if (!this._gyroBound) {
      this._gyroBound = true;
      addEventListener('deviceorientation', e => {
        if (e.beta == null || e.gamma == null) return;
        this.gyro.available = true;
        this.gyro.sample = { beta: e.beta, gamma: e.gamma };
      });
    }
    this.gyro.enabled = true;
    // Give the sensor a moment to prove it actually reports data.
    await new Promise(r => setTimeout(r, 450));
    return this.gyro.available ? 'granted' : 'unsupported';
  }

  _gyroAxes() {
    const g = this.gyro.sample; if (!g) return null;
    const a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
    switch (((a % 360) + 360) % 360) {
      case 90: return { x: g.beta, y: -g.gamma };
      case 180: return { x: -g.gamma, y: -g.beta };
      case 270: return { x: -g.beta, y: g.gamma };
      default: return { x: g.gamma, y: g.beta };
    }
  }

  /** Treat the current device pose as "flat". */
  recalibrate() {
    const ax = this._gyroAxes();
    if (ax) this.gyro.neutral = ax;
    this.gyro.smooth.x = this.gyro.smooth.y = 0;
  }

  /** Current control vector. Call once per frame. */
  getTilt(dt) {
    // Keyboard (ramped)
    const kx = (this.keys.has('arrowright') || this.keys.has('d') ? 1 : 0) - (this.keys.has('arrowleft') || this.keys.has('a') ? 1 : 0);
    const ky = (this.keys.has('arrowdown') || this.keys.has('s') ? 1 : 0) - (this.keys.has('arrowup') || this.keys.has('w') ? 1 : 0);
    const kk = 1 - Math.exp(-dt * 14);
    this.keyVec.x += (kx - this.keyVec.x) * kk; this.keyVec.y += (ky - this.keyVec.y) * kk;
    if (Math.abs(this.keyVec.x) > 0.02 || Math.abs(this.keyVec.y) > 0.02) return this._scale(this.keyVec.x, this.keyVec.y);

    if (this.stick.active && !this.usingGyro) return this._scale(this.stick.x, this.stick.y);

    if (this.usingGyro) {
      const ax = this._gyroAxes();
      if (ax) {
        if (!this.gyro.neutral) this.gyro.neutral = ax;
        let dx = ax.x - this.gyro.neutral.x, dy = ax.y - this.gyro.neutral.y;
        const m = Math.hypot(dx, dy);
        if (m < GYRO_DEADZONE_DEG) { dx = dy = 0; }
        else { const f = (m - GYRO_DEADZONE_DEG) / m; dx *= f; dy *= f; }
        const tx = clamp(dx / GYRO_FULL_DEG, -1, 1), ty = clamp(dy / GYRO_FULL_DEG, -1, 1);
        const a = 1 - Math.exp(-dt * 18);
        this.gyro.smooth.x += (tx - this.gyro.smooth.x) * a; this.gyro.smooth.y += (ty - this.gyro.smooth.y) * a;
        return this._scale(this.gyro.smooth.x, this.gyro.smooth.y);
      }
    }
    return { x: 0, y: 0 };
  }

  _scale(x, y) {
    const s = this.sensitivity;
    return { x: clamp(x * s, -1, 1), y: clamp(y * s, -1, 1) };
  }
}
