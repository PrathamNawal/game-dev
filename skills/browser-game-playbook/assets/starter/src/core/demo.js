// PLACEHOLDER GAME LOGIC — replace with your game's pure rules (see references/architecture.md).
// Keep this layer free of DOM / rendering so it stays unit-testable in Node and seed-deterministic.
import { Rng } from './rng.js';

export const levelParams = n => ({ seed: `__SLUG__:level:${Math.max(1, n | 0)}`, n, count: Math.min(3 + Math.floor(n / 2), 9), radius: Math.max(0.05, 0.09 - n * 0.002) });

/** Deterministic target list in normalized [0,1] coordinates (same seed -> same round). */
export function makeRound(params) {
  const rng = new Rng(params.seed), pts = [];
  while (pts.length < params.count) {
    const p = { x: 0.12 + rng.next() * 0.76, y: 0.2 + rng.next() * 0.6 };
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.25) pts.push(p);   // keep consecutive targets apart
  }
  return { params, targets: pts, par: params.count * 0.9 };
}

/** All values in the same unit (e.g. CSS px). 1.35x radius = generous hit area for fat fingers. */
export const isHit = (t, x, y, r) => Math.hypot(t.x - x, t.y - y) <= r * 1.35;

/** 3/2/1 stars from time vs par. Calibrate vs *first-time* players, not a perfect bot (see references/testing-and-calibration.md). */
export const starsFor = (time, par) => (time <= par * 1.8 ? 3 : time <= par * 3 ? 2 : 1);
