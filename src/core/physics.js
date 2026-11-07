// Marble simulation: pure, deterministic, DOM-free. Units: 1 cell = 1.0 world unit.
import { FLOOR } from './levels.js';

export const CFG = {
  DT: 1 / 120,
  MAX_ACCEL: 11,
  DRAG: 1.4,
  MAX_SPEED: 7.5,
  MAX_SPEED_ASSIST: 5.0,
  RESTITUTION: 0.35,
  RADIUS: 0.28,
  WALL_T: 0.12,
  ICE_FRICTION: 0.12,
  STICKY_FRICTION: 3.2,
  STICKY_ACCEL: 0.8,
  HOLE_R: 0.30,
  HOLE_PULL_R: 0.46,
  HOLE_PULL: 14,
  GOAL_R: 0.32,
  COIN_PICK: 0.22 + 0.28,
  HIT_MIN_IMPACT: 0.6,
};

const N = 1, E = 2, S = 4, W = 8;

/** Build wall AABBs {x0,y0,x1,y1} from a level's cell bitmasks (shared edges emitted once). */
export function buildWalls(level) {
  const { w, h, cells } = level;
  const t = CFG.WALL_T / 2;
  const walls = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = cells[y * w + x];
      if (c & N) walls.push({ x0: x - t, y0: y - t, x1: x + 1 + t, y1: y + t });
      if (c & W) walls.push({ x0: x - t, y0: y - t, x1: x + t, y1: y + 1 + t });
      if ((c & S) && y === h - 1) walls.push({ x0: x - t, y0: y + 1 - t, x1: x + 1 + t, y1: y + 1 + t });
      if ((c & E) && x === w - 1) walls.push({ x0: x + 1 - t, y0: y - t, x1: x + 1 + t, y1: y + 1 + t });
    }
  }
  return walls;
}

export class World {
  /** @param {object} level  @param {{assist?:boolean}} [opts] */
  constructor(level, opts = {}) {
    this.level = level;
    this.assist = !!opts.assist;
    this.walls = buildWalls(level);
    // Per-cell wall buckets (walls whose bbox overlaps the cell).
    this.buckets = Array.from({ length: level.w * level.h }, () => []);
    this.walls.forEach((wl, k) => {
      const cx0 = Math.max(0, Math.floor(wl.x0)), cx1 = Math.min(level.w - 1, Math.floor(wl.x1));
      const cy0 = Math.max(0, Math.floor(wl.y0)), cy1 = Math.min(level.h - 1, Math.floor(wl.y1));
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.buckets[cy * level.w + cx].push(k);
    });
    this.events = [];
    this.falls = 0;
    this.reset();
  }

  reset() {
    const { start } = this.level;
    this.x = start.x + 0.5;
    this.y = start.y + 0.5;
    this.vx = 0; this.vy = 0;
    this.time = 0;
    this.status = 'playing'; // 'playing' | 'fell' | 'won'
    this.falls = 0;
    this.coinsTaken = new Set();
    this.events.length = 0;
  }

  /** Respawn after a fall (keeps coins collected and fall count). */
  respawn() {
    const { start } = this.level;
    this.x = start.x + 0.5; this.y = start.y + 0.5;
    this.vx = 0; this.vy = 0;
    this.status = 'playing';
  }

  get speed() { return Math.hypot(this.vx, this.vy); }
  get cellIndex() {
    const cx = Math.min(this.level.w - 1, Math.max(0, Math.floor(this.x)));
    const cy = Math.min(this.level.h - 1, Math.max(0, Math.floor(this.y)));
    return cy * this.level.w + cx;
  }

  /**
   * Advance one fixed step. `tilt` = {x,y} each in [-1,1].
   * Returns the (reused) events array: {type:'hit',impact} | {type:'coin',index} | {type:'fell'} | {type:'won'}.
   */
  step(dt, tilt) {
    const ev = this.events;
    ev.length = 0;
    if (this.status !== 'playing') return ev;
    const L = this.level;
    this.time += dt;

    const floorType = L.floor[this.cellIndex];
    let friction = 1, accelScale = 1;
    if (floorType === FLOOR.ICE) friction = CFG.ICE_FRICTION;
    else if (floorType === FLOOR.STICKY) { friction = CFG.STICKY_FRICTION; accelScale = CFG.STICKY_ACCEL; }

    // Clamp the tilt vector to the unit disc.
    let tx = tilt.x || 0, ty = tilt.y || 0;
    const tm = Math.hypot(tx, ty);
    if (tm > 1) { tx /= tm; ty /= tm; }

    let ax = tx * CFG.MAX_ACCEL * accelScale;
    let ay = ty * CFG.MAX_ACCEL * accelScale;

    // Holes pull the marble in once it is over the rim.
    for (const hole of L.holes) {
      const dx = hole.x + 0.5 - this.x, dy = hole.y + 0.5 - this.y;
      const d = Math.hypot(dx, dy);
      if (d < CFG.HOLE_PULL_R && d > 1e-6) {
        const k = CFG.HOLE_PULL * (1 - d / CFG.HOLE_PULL_R);
        ax += (dx / d) * k; ay += (dy / d) * k;
      }
    }

    this.vx += ax * dt; this.vy += ay * dt;
    const damp = Math.max(0, 1 - CFG.DRAG * dt * friction);
    this.vx *= damp; this.vy *= damp;
    const max = this.assist ? CFG.MAX_SPEED_ASSIST : CFG.MAX_SPEED;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > max) { this.vx *= max / sp; this.vy *= max / sp; }

    this.x += this.vx * dt; this.y += this.vy * dt;
    this._collide(ev);

    for (const hole of L.holes) {
      if (Math.hypot(hole.x + 0.5 - this.x, hole.y + 0.5 - this.y) < CFG.HOLE_R) {
        this.status = 'fell'; this.falls++;
        ev.push({ type: 'fell' });
        return ev;
      }
    }
    for (let i = 0; i < L.coins.length; i++) {
      if (this.coinsTaken.has(i)) continue;
      const c = L.coins[i];
      if (Math.hypot(c.x + 0.5 - this.x, c.y + 0.5 - this.y) < CFG.COIN_PICK) {
        this.coinsTaken.add(i);
        ev.push({ type: 'coin', index: i });
      }
    }
    if (Math.hypot(L.goal.x + 0.5 - this.x, L.goal.y + 0.5 - this.y) < CFG.GOAL_R) {
      this.status = 'won';
      ev.push({ type: 'won' });
    }
    return ev;
  }

  _collide(ev) {
    const L = this.level, R = CFG.RADIUS;
    let maxImpact = 0;
    // Two relaxation passes handle corners where two walls touch the marble at once.
    for (let pass = 0; pass < 2; pass++) {
      const cx = Math.min(L.w - 1, Math.max(0, Math.floor(this.x)));
      const cy = Math.min(L.h - 1, Math.max(0, Math.floor(this.y)));
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bx = cx + ox, by = cy + oy;
          if (bx < 0 || by < 0 || bx >= L.w || by >= L.h) continue;
          for (const k of this.buckets[by * L.w + bx]) {
            const wl = this.walls[k];
            const px = Math.max(wl.x0, Math.min(this.x, wl.x1));
            const py = Math.max(wl.y0, Math.min(this.y, wl.y1));
            const dx = this.x - px, dy = this.y - py;
            const d2 = dx * dx + dy * dy;
            if (d2 >= R * R) continue;
            let nx, ny, pen;
            if (d2 > 1e-12) {
              const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = R - d;
            } else {
              // Centre inside the rect: push out along the shallowest axis.
              const l = this.x - wl.x0, r = wl.x1 - this.x, t = this.y - wl.y0, b = wl.y1 - this.y;
              const m = Math.min(l, r, t, b);
              nx = ny = 0;
              if (m === l) nx = -1; else if (m === r) nx = 1; else if (m === t) ny = -1; else ny = 1;
              pen = m + R;
            }
            this.x += nx * pen; this.y += ny * pen;
            const vn = this.vx * nx + this.vy * ny;
            if (vn < 0) {
              this.vx -= (1 + CFG.RESTITUTION) * vn * nx;
              this.vy -= (1 + CFG.RESTITUTION) * vn * ny;
              if (-vn > maxImpact) maxImpact = -vn;
            }
          }
        }
      }
    }
    if (maxImpact >= CFG.HIT_MIN_IMPACT) ev.push({ type: 'hit', impact: maxImpact });
  }
}
