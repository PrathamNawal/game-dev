// Level parameters + deterministic generation. Output is plain JSON-able data.
import { Rng } from './rng.js';
import { createGrid, carve, braid, bfs, pathTo, farthest, openNeighbors, openingCount, idxOf, xOf, yOf } from './maze.js';

export const FLOOR = { NORMAL: 0, ICE: 1, STICKY: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Difficulty/theme parameters for journey level n (1-based). See docs/GAME_DESIGN.md. */
export function levelParams(n) {
  n = Math.max(1, Math.floor(n));
  const w = clamp(4 + Math.floor((n - 1) / 4), 4, 9);
  const h = clamp(Math.round(w * 1.45), 6, 13);
  return {
    seed: `tilt:level:${n}`,
    kind: 'journey',
    n,
    w, h,
    holes: n < 3 ? 0 : Math.min(Math.floor((n - 2) / 2) + 1, 14),
    ice: n < 11 ? 0 : Math.min(Math.floor((n - 8) / 4), 6),
    sticky: n < 21 ? 0 : Math.min(Math.floor((n - 18) / 5), 5),
    braid: Math.max(0.05, 0.35 - n * 0.005),
    coins: 3,
    world: Math.floor((n - 1) / 10) % 6,
  };
}

/** Local-date key YYYY-MM-DD (players expect "today" in their own timezone). */
export function dailyKey(date = new Date()) {
  const p = v => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Previous calendar day key for a YYYY-MM-DD key (local calendar arithmetic, DST-safe via noon). */
export function prevDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dailyKey(new Date(y, m - 1, d - 1, 12));
}

export function dailyParams(key = dailyKey()) {
  return {
    seed: `tilt:daily:${key}`,
    kind: 'daily',
    key,
    n: 0,
    w: 7, h: 10,
    holes: 5, ice: 2, sticky: 1,
    braid: 0.12,
    coins: 3,
    world: parseInt(key.slice(-2), 10) % 6,
  };
}

export const levelForIndex = n => generateLevel(levelParams(n));
export const levelForDaily = key => generateLevel(dailyParams(key));

/** Grow `count` random-walk patches of `len` 2..4 cells for a floor type. */
function paintPatches(grid, rng, floor, type, count, forbidden) {
  for (let p = 0; p < count; p++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const s = rng.int(grid.cells.length);
      if (forbidden.has(s) || floor[s] !== FLOOR.NORMAL) continue;
      const len = rng.range(2, 4);
      let cur = s;
      floor[cur] = type;
      for (let k = 1; k < len; k++) {
        const opts = openNeighbors(grid, cur).filter(j => !forbidden.has(j) && floor[j] === FLOOR.NORMAL);
        if (!opts.length) break;
        cur = rng.pick(opts);
        floor[cur] = type;
      }
      break;
    }
  }
}

/** @returns {{params, w, h, cells:number[], floor:number[], start:{x,y}, goal:{x,y}, holes:{x,y}[], coins:{x,y}[], solution:number[], pathLen:number}} */
export function generateLevel(params) {
  const { w, h } = params;
  const rng = new Rng(params.seed);
  const grid = createGrid(w, h);
  carve(grid, rng, rng.int(w), rng.int(h));
  braid(grid, rng, params.braid);

  const startI = idxOf(grid, 0, h - 1);
  const base = bfs(grid, startI);
  const goalI = farthest(base.dist);
  const forbidden = new Set([startI, goalI]);

  // Floor patches
  const floor = new Array(w * h).fill(FLOOR.NORMAL);
  paintPatches(grid, rng, floor, FLOOR.ICE, params.ice, forbidden);
  paintPatches(grid, rng, floor, FLOOR.STICKY, params.sticky, forbidden);

  // Holes: only where a fair alternative route survives.
  const manhattan = (a, b) => Math.abs(xOf(grid, a) - xOf(grid, b)) + Math.abs(yOf(grid, a) - yOf(grid, b));
  const holeSet = new Set();
  const candidates = [];
  for (let i = 0; i < w * h; i++) {
    if (forbidden.has(i) || floor[i] !== FLOOR.NORMAL) continue;
    if (manhattan(i, startI) < 2 || manhattan(i, goalI) < 2) continue;
    candidates.push(i);
  }
  rng.shuffle(candidates);
  const maxLen = base.dist[goalI] * 3 + 4;
  for (const c of candidates) {
    if (holeSet.size >= params.holes) break;
    holeSet.add(c);
    const r = bfs(grid, startI, holeSet);
    if (r.dist[goalI] === -1 || r.dist[goalI] > maxLen) holeSet.delete(c);
  }

  const final = bfs(grid, startI, holeSet);
  const solution = pathTo(final.prev, startI, goalI);

  // Coins: dead-ends first, then other cells off the hole set.
  const onPath = new Set(solution);
  const pool = [];
  for (let i = 0; i < w * h; i++) if (!forbidden.has(i) && !holeSet.has(i)) pool.push(i);
  rng.shuffle(pool);
  pool.sort((a, b) => {
    const score = i => (openingCount(grid, i) === 1 ? 2 : 0) + (onPath.has(i) ? 0 : 1);
    return score(b) - score(a);
  });
  const coinCells = pool.slice(0, params.coins);

  const toXY = i => ({ x: xOf(grid, i), y: yOf(grid, i) });
  return {
    params,
    w, h,
    cells: Array.from(grid.cells),
    floor,
    start: toXY(startI),
    goal: toXY(goalI),
    holes: [...holeSet].map(toXY),
    coins: coinCells.map(toXY),
    solution,
    pathLen: solution.length - 1,
  };
}
