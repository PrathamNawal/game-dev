// A PD controller that follows a cell path through the physics. Used by tests (solvability proof),
// the hint ghost and the menu attract mode. Pure and deterministic.
import { bfs, pathTo, idxOf } from './maze.js';
import { CFG } from './physics.js';

/** Safe path (cell indices) from the cell index `fromIdx` to the goal, avoiding holes. [] if none. */
export function computePath(level, fromIdx) {
  const grid = { w: level.w, h: level.h, cells: Uint8Array.from(level.cells) };
  const blocked = new Set(level.holes.map(h => idxOf(grid, h.x, h.y)));
  const goalI = idxOf(grid, level.goal.x, level.goal.y);
  const { prev } = bfs(grid, fromIdx, blocked);
  return pathTo(prev, fromIdx, goalI);
}

export class Autopilot {
  constructor(level, opts = {}) {
    this.level = level;
    this.vmax = opts.vmax ?? 3.2;
    this.gain = opts.gain ?? 7;
    this.path = level.solution.slice();
    this.i = 1;
  }

  /** Recompute the route from the marble's current cell (e.g. after a bounce, fall or hint). */
  replan(world) {
    this.path = computePath(this.level, world.cellIndex);
    this.i = Math.min(1, this.path.length - 1);
  }

  /** @returns {{x:number,y:number}} tilt in [-1,1] */
  tilt(world) {
    const { w } = this.level;
    if (this.i >= this.path.length) return { x: 0, y: 0 };
    // Skip waypoints we are already close to.
    while (this.i < this.path.length - 1) {
      const c = this.path[this.i];
      const dx = (c % w) + 0.5 - world.x, dy = ((c / w) | 0) + 0.5 - world.y;
      if (Math.hypot(dx, dy) < 0.3) this.i++; else break;
    }
    const c = this.path[this.i];
    const tx = (c % w) + 0.5, ty = ((c / w) | 0) + 0.5;
    const dx = tx - world.x, dy = ty - world.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    // Brake when the next leg turns a corner so we do not overshoot into a wall/hole.
    const next = this.path[Math.min(this.i + 1, this.path.length - 1)];
    const nx = (next % w) + 0.5 - tx, ny = ((next / w) | 0) + 0.5 - ty;
    const turning = (Math.abs(nx) > 0.5 && Math.abs(dy) > 0.5) || (Math.abs(ny) > 0.5 && Math.abs(dx) > 0.5);
    const cap = turning ? Math.min(this.vmax, 0.9 + dist * 2.4) : this.vmax;
    const speed = Math.min(cap, dist * 4.5);
    const dvx = (dx / dist) * speed - world.vx;
    const dvy = (dy / dist) * speed - world.vy;
    const ax = dvx * this.gain, ay = dvy * this.gain;
    return {
      x: Math.max(-1, Math.min(1, ax / CFG.MAX_ACCEL)),
      y: Math.max(-1, Math.min(1, ay / CFG.MAX_ACCEL)),
    };
  }
}

/** Run a level headless with the autopilot. Returns {status, time, falls, steps, coins}. */
export function simulate(level, { maxSeconds = 90, assist = false } = {}, WorldClass) {
  const world = new WorldClass(level, { assist });
  const ap = new Autopilot(level);
  let steps = 0;
  while (world.time < maxSeconds && world.status !== 'won') {
    if (world.status === 'fell') { world.respawn(); ap.replan(world); }
    world.step(CFG.DT, ap.tilt(world));
    steps++;
  }
  return { status: world.status, time: world.time, falls: world.falls, steps, coins: world.coinsTaken.size };
}
