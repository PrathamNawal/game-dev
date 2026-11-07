import './ui/styles.css';
import { Renderer } from './game/renderer.js';
import { Input } from './game/input.js';
import { Run } from './game/run.js';
import { levelForIndex } from './core/levels.js';
import { Autopilot } from './core/autopilot.js';

// M2 prototype entry: boots straight into a level (?level=N). Replaced by the full app shell in M3.
const canvas = document.getElementById('c');
const qParam = new URLSearchParams(location.search).get('q');
const renderer = new Renderer(canvas, { quality: qParam === 'low' ? 'low' : 'high' });
const input = new Input(document.getElementById('app'));
const n = Number(new URLSearchParams(location.search).get('level')) || 1;
let run = new Run({ renderer, input, level: levelForIndex(n), on: { won: r => console.log('won', r) } });
const params = new URLSearchParams(location.search);
if (params.has('auto')) { // demo / test hook: let the autopilot steer
  const ap = new Autopilot(run.level);
  input.getTilt = () => { if (run.state === 'playing' && run.world.status === 'playing') return ap.tilt(run.world); return { x: 0, y: 0 }; };
}
window.__tilt = { renderer, input, get run() { return run; }, levelForIndex, Run };

addEventListener('resize', () => renderer.resize());
let last = performance.now();
renderer.gl.setAnimationLoop(now => {
  const dt = (now - last) / 1000; last = now;
  run.update(dt);
  renderer.render();
});
