// Re-run after changing physics/levels/scoring: simulates degraded "human-like" controllers (reaction delay + tremor).
// "Human-ish" controller: reaction delay + tilt noise + coarse input quantization.
import { World, CFG } from '../../src/core/physics.js';
import { Autopilot } from '../../src/core/autopilot.js';
import { levelForIndex } from '../../src/core/levels.js';
import { Rng } from '../../src/core/rng.js';
import { parTime, starsFor } from '../../src/core/scoring.js';
function play(level, { delayMs, noise, vmax, seed }) {
  const w = new World(level), ap = new Autopilot(level, { vmax }), rng = new Rng(seed);
  const buf = []; const delay = Math.round(delayMs / (CFG.DT * 1000));
  let nx = 0, ny = 0;
  while (w.time < 150 && w.status !== 'won') {
    if (w.status === 'fell') { w.respawn(); ap.replan(w); buf.length = 0; }
    const t = ap.tilt(w); buf.push(t); const d = buf.length > delay ? buf[buf.length - 1 - delay] : { x: 0, y: 0 };
    // slowly varying hand tremor (AR(1)) rather than white noise
    nx = nx * 0.99 + (rng.next() - 0.5) * noise * 0.2; ny = ny * 0.99 + (rng.next() - 0.5) * noise * 0.2;
    w.step(CFG.DT, { x: d.x + nx, y: d.y + ny });
  }
  return { won: w.status === 'won', time: w.time, falls: w.falls };
}
const profiles = { 'expert   (60ms, noise .1, v3.2)': { delayMs: 60, noise: 0.1, vmax: 3.2 },
  'average  (150ms, noise .3, v2.4)': { delayMs: 150, noise: 0.3, vmax: 2.4 },
  'casual   (250ms, noise .5, v1.8)': { delayMs: 250, noise: 0.5, vmax: 1.8 } };
for (const [name, p] of Object.entries(profiles)) {
  console.log(name);
  for (const range of [[1, 10], [11, 30], [31, 60], [61, 120]]) {
    let n = 0, won = 0, falls = 0, tr = 0, stars = 0;
    for (let lv = range[0]; lv <= range[1]; lv++) { const L = levelForIndex(lv); const r = play(L, { ...p, seed: lv * 7 }); n++; won += r.won; falls += r.falls; tr += r.time / parTime(L.pathLen); stars += starsFor(r.time, r.falls, L.pathLen); }
    console.log(`  L${range[0]}-${range[1]}: solved ${won}/${n}  falls/level ${(falls / n).toFixed(2)}  time/par ${(tr / n).toFixed(2)}  avg stars ${(stars / n).toFixed(2)}`);
  }
}
