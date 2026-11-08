// Adaptive quality: if the device cannot hold ~30 fps on High, drop to Low once and tell the player.
// Pure decision logic so it is unit-testable; app.js feeds it frame deltas during real play.
export class QualityGovernor {
  /** @param {{warmup?:number, window?:number, maxAvgMs?:number}} o */
  constructor({ warmup = 30, window = 90, maxAvgMs = 30 } = {}) {
    this.warmup = warmup; this.window = window; this.maxAvgMs = maxAvgMs;
    this.n = 0; this.sum = 0; this.done = false;
  }
  /** Feed one frame delta (seconds). Returns 'downgrade' once if the average is too slow, else null. */
  push(dt) {
    if (this.done) return null;
    this.n++;
    if (this.n <= this.warmup) return null;      // ignore shader compile / first-frame hitches
    if (dt > 0.25) return null;                   // tab switches / debugger pauses are not slowness
    this.sum += dt * 1000;
    if (this.n - this.warmup >= this.window) {
      this.done = true;
      return this.sum / this.window > this.maxAvgMs ? 'downgrade' : null;
    }
    return null;
  }
}
