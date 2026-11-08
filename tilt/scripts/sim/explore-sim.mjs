// How much longer than the shortest path does a first-time explorer take? (DFS with random branch order, no map knowledge.)
import { levelForIndex } from '../../src/core/levels.js';
import { openNeighbors } from '../../src/core/maze.js';
import { Rng } from '../../src/core/rng.js';
function explore(L, rng) {
  const g = { w: L.w, h: L.h, cells: Uint8Array.from(L.cells) };
  const goal = L.goal.y * L.w + L.goal.x, start = L.start.y * L.w + L.start.x;
  const holes = new Set(L.holes.map(h => h.y * L.w + h.x));
  const seen = new Set([start]), stack = [start]; let steps = 0, falls = 0;
  while (stack.length) {
    const cur = stack[stack.length - 1]; if (cur === goal) break;
    const opts = openNeighbors(g, cur).filter(j => !seen.has(j));
    if (opts.length) { const j = rng.pick(opts); seen.add(j); steps++; if (holes.has(j)) { falls++; steps += 2 + 0; /* walks back from start: approximated */ continue; } stack.push(j); }
    else { stack.pop(); steps++; }
  }
  return { steps, falls };
}
const ratios = [], fallsArr = [];
for (let lv = 1; lv <= 120; lv++) {
  const L = levelForIndex(lv); const rs = [];
  for (let k = 0; k < 40; k++) { const r = explore(L, new Rng(`e${lv}:${k}`)); rs.push(r.steps / L.pathLen); fallsArr.push(r.falls); }
  rs.sort((a, b) => a - b); ratios.push({ lv, p25: rs[10], p50: rs[20], p75: rs[30] });
}
const avg = k => (ratios.reduce((s, r) => s + r[k], 0) / ratios.length).toFixed(2);
console.log('explorer cells travelled / shortest path  -> p25', avg('p25'), ' median', avg('p50'), ' p75', avg('p75'));
for (const [a, b] of [[1, 10], [11, 30], [31, 60], [61, 120]]) { const s = ratios.filter(r => r.lv >= a && r.lv <= b); console.log(` L${a}-${b}: p25 ${(s.reduce((x, r) => x + r.p25, 0) / s.length).toFixed(2)} p50 ${(s.reduce((x, r) => x + r.p50, 0) / s.length).toFixed(2)} p75 ${(s.reduce((x, r) => x + r.p75, 0) / s.length).toFixed(2)}`); }
console.log('avg hole falls per exploration:', (fallsArr.reduce((a, b) => a + b, 0) / fallsArr.length).toFixed(2));
