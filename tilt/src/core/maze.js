// Grid maze: pure data + algorithms. No rendering, no randomness except via a passed Rng.
// A cell is a bitmask of WALLS that are present: N=1, E=2, S=4, W=8.

export const N = 1, E = 2, S = 4, W = 8;
export const DIRS = [
  { bit: N, dx: 0, dy: -1, opp: S },
  { bit: E, dx: 1, dy: 0, opp: W },
  { bit: S, dx: 0, dy: 1, opp: N },
  { bit: W, dx: -1, dy: 0, opp: E },
];

export function createGrid(w, h) {
  return { w, h, cells: new Uint8Array(w * h).fill(15) };
}

export const idxOf = (g, x, y) => y * g.w + x;
export const xOf = (g, i) => i % g.w;
export const yOf = (g, i) => (i / g.w) | 0;
export const inBounds = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h;

function removeWall(g, x, y, dir) {
  const nx = x + dir.dx, ny = y + dir.dy;
  g.cells[idxOf(g, x, y)] &= ~dir.bit;
  g.cells[idxOf(g, nx, ny)] &= ~dir.opp;
}

/** Perfect maze via iterative depth-first search (recursive backtracker). */
export function carve(g, rng, startX = 0, startY = 0) {
  const visited = new Uint8Array(g.w * g.h);
  const stack = [[startX, startY]];
  visited[idxOf(g, startX, startY)] = 1;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = [];
    for (const d of DIRS) {
      const nx = x + d.dx, ny = y + d.dy;
      if (inBounds(g, nx, ny) && !visited[idxOf(g, nx, ny)]) options.push(d);
    }
    if (!options.length) { stack.pop(); continue; }
    const d = rng.pick(options);
    removeWall(g, x, y, d);
    visited[idxOf(g, x + d.dx, y + d.dy)] = 1;
    stack.push([x + d.dx, y + d.dy]);
  }
  return g;
}

/** Open (wall-free) neighbour cell indices of cell i. */
export function openNeighbors(g, i) {
  const x = xOf(g, i), y = yOf(g, i), c = g.cells[i], out = [];
  for (const d of DIRS) {
    if (!(c & d.bit)) {
      const nx = x + d.dx, ny = y + d.dy;
      if (inBounds(g, nx, ny)) out.push(idxOf(g, nx, ny));
    }
  }
  return out;
}

export function openingCount(g, i) { return openNeighbors(g, i).length; }

/** Turn a fraction of dead-ends into loops by knocking a wall toward an in-bounds neighbour. */
export function braid(g, rng, factor) {
  if (factor <= 0) return g;
  const deadEnds = [];
  for (let i = 0; i < g.cells.length; i++) if (openingCount(g, i) === 1) deadEnds.push(i);
  rng.shuffle(deadEnds);
  for (const i of deadEnds) {
    if (!rng.chance(factor)) continue;
    if (openingCount(g, i) !== 1) continue; // may have been changed by a neighbour
    const x = xOf(g, i), y = yOf(g, i);
    const walls = DIRS.filter(d => (g.cells[i] & d.bit) && inBounds(g, x + d.dx, y + d.dy));
    if (walls.length) removeWall(g, x, y, rng.pick(walls));
  }
  return g;
}

/**
 * Breadth-first search from `from`. `blocked` is an optional Set/array-like of cell indices that
 * cannot be entered. Returns { dist, prev } as Int32Arrays (-1 = unreachable / no parent).
 */
export function bfs(g, from, blocked = null) {
  const n = g.w * g.h;
  const dist = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const isBlocked = blocked ? (i => blocked.has(i)) : (() => false);
  if (isBlocked(from)) return { dist, prev };
  const queue = [from];
  dist[from] = 0;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    for (const j of openNeighbors(g, i)) {
      if (dist[j] === -1 && !isBlocked(j)) {
        dist[j] = dist[i] + 1;
        prev[j] = i;
        queue.push(j);
      }
    }
  }
  return { dist, prev };
}

/** Path of cell indices from `from` to `to` (inclusive) using a BFS prev table; [] if unreachable. */
export function pathTo(prev, from, to) {
  const path = [];
  for (let i = to; i !== -1; i = prev[i]) {
    path.push(i);
    if (i === from) return path.reverse();
  }
  return [];
}

/** Index of the reachable cell with the greatest distance (ties -> lowest index). */
export function farthest(dist) {
  let best = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] > dist[best]) best = i;
  return best;
}
