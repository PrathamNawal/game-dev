import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng, hashString } from '../../src/core/rng.js';
import { createGrid, carve, bfs, braid, openNeighbors } from '../../src/core/maze.js';
import { levelParams, dailyParams, generateLevel, levelForIndex, dailyKey, FLOOR } from '../../src/core/levels.js';
import { World, CFG } from '../../src/core/physics.js';
import { simulate, computePath } from '../../src/core/autopilot.js';
import { starsFor, parTime, clearReward } from '../../src/core/scoring.js';

test('rng: deterministic and well distributed', () => {
  const a = new Rng('x'), b = new Rng('x'), c = new Rng('y');
  const sa = Array.from({ length: 5 }, () => a.next()), sb = Array.from({ length: 5 }, () => b.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, Array.from({ length: 5 }, () => c.next()));
  assert.equal(hashString('abc'), hashString('abc'));
  const r = new Rng(1); let sum = 0; for (let i = 0; i < 10000; i++) sum += r.next();
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02);
  assert.deepEqual(new Rng(3).shuffle([1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
});

test('maze: carve makes a spanning tree (all reachable, n-1 passages)', () => {
  const g = createGrid(7, 9); carve(g, new Rng('m'));
  const { dist } = bfs(g, 0);
  assert.ok(dist.every(d => d >= 0));
  let edges = 0; for (let i = 0; i < g.cells.length; i++) edges += openNeighbors(g, i).length;
  assert.equal(edges / 2, g.w * g.h - 1);
});

test('maze: braid adds loops but keeps connectivity', () => {
  const g = createGrid(8, 8); const rng = new Rng('b'); carve(g, rng); braid(g, rng, 1);
  let edges = 0; for (let i = 0; i < g.cells.length; i++) edges += openNeighbors(g, i).length;
  assert.ok(edges / 2 > g.w * g.h - 1);
  assert.ok(bfs(g, 0).dist.every(d => d >= 0));
});

test('levels: parameters follow the documented curve', () => {
  const p1 = levelParams(1), p30 = levelParams(30), p500 = levelParams(500);
  assert.deepEqual([p1.w, p1.h, p1.holes, p1.ice, p1.sticky], [4, 6, 0, 0, 0]);
  assert.ok(p30.holes > 0 && p30.ice > 0 && p30.sticky > 0);
  assert.ok(p500.w <= 9 && p500.h <= 13 && p500.holes <= 14 && p500.braid >= 0.05);
  assert.equal(dailyKey(new Date(2026, 10, 7)), '2026-11-07');
});

test('levels: deterministic from seed', () => {
  assert.deepEqual(levelForIndex(17), levelForIndex(17));
  assert.notDeepEqual(levelForIndex(17).cells, levelForIndex(18).cells);
});

test('levels: 300 seeds are structurally valid and solvable', () => {
  const specs = [];
  for (let n = 1; n <= 250; n++) specs.push(levelParams(n));
  for (let d = 1; d <= 50; d++) specs.push(dailyParams(`2026-12-${String(d).padStart(2, '0')}`));
  for (const p of specs) {
    const L = generateLevel(p);
    const at = o => o.y * L.w + o.x;
    assert.equal(L.cells.length, L.w * L.h);
    assert.ok(L.solution.length >= 2 && L.solution[0] === at(L.start) && L.solution.at(-1) === at(L.goal), p.seed);
    const holeSet = new Set(L.holes.map(at));
    assert.ok(!holeSet.has(at(L.start)) && !holeSet.has(at(L.goal)), p.seed);
    assert.ok(L.solution.every(i => !holeSet.has(i)), `solution crosses a hole: ${p.seed}`);
    assert.equal(L.coins.length, p.coins);
    assert.equal(new Set(L.coins.map(at)).size, p.coins);
    assert.ok(L.coins.every(c => !holeSet.has(at(c)) && at(c) !== at(L.goal) && at(c) !== at(L.start)));
    assert.ok(L.holes.length <= p.holes);
    assert.equal(L.holes.filter(h => L.floor[at(h)] !== FLOOR.NORMAL).length, 0);
  }
});

test('levels: hole count ramps (not silently reduced to zero)', () => {
  assert.ok(levelForIndex(40).holes.length >= 5, `got ${levelForIndex(40).holes.length}`);
  assert.equal(levelForIndex(2).holes.length, 0);
});

test('physics: marble stays inside the board under constant tilt', () => {
  const L = levelForIndex(5);
  for (const t of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }]) {
    const w = new World(L);
    for (let i = 0; i < 120 * 20; i++) {
      w.step(CFG.DT, t);
      if (w.status !== 'playing') w.respawn();
      assert.ok(w.x > 0 && w.y > 0 && w.x < L.w && w.y < L.h, `escaped with tilt ${JSON.stringify(t)} at step ${i}`);
    }
  }
});

test('physics: speed is capped; assist mode is slower', () => {
  const L = levelForIndex(1);
  const a = new World(L), b = new World(L, { assist: true });
  for (let i = 0; i < 600; i++) { a.step(CFG.DT, { x: 0, y: -1 }); b.step(CFG.DT, { x: 0, y: -1 }); }
  assert.ok(a.speed <= CFG.MAX_SPEED + 1e-9);
  assert.ok(b.speed <= CFG.MAX_SPEED_ASSIST + 1e-9);
});

test('physics: no tilt -> at rest; wall impacts emit hit events', () => {
  const L = levelForIndex(1);
  const w = new World(L);
  for (let i = 0; i < 240; i++) w.step(CFG.DT, { x: 0, y: 0 });
  assert.equal(w.speed, 0);
  let hits = 0;
  for (let i = 0; i < 1200; i++) for (const e of w.step(CFG.DT, { x: -1, y: 0 })) if (e.type === 'hit') hits++;
  assert.ok(hits >= 1);
});

test('physics: ice keeps speed longer; sticky bleeds speed faster', () => {
  const mk = type => ({
    w: 9, h: 3,
    cells: [...Array(27)].map((_, i) => {
      const x = i % 9, y = (i / 9) | 0; let c = 0;
      if (y === 0) c |= 1; if (y === 2) c |= 4; if (x === 0) c |= 8; if (x === 8) c |= 2; return c;
    }),
    floor: new Array(27).fill(type), start: { x: 0, y: 1 }, goal: { x: 8, y: 2 }, holes: [], coins: [], solution: [], pathLen: 0, params: {},
  });
  const run = type => {
    const w = new World(mk(type));
    for (let i = 0; i < 40; i++) w.step(CFG.DT, { x: 1, y: 0 });
    const v0 = w.speed;
    for (let i = 0; i < 60; i++) w.step(CFG.DT, { x: 0, y: 0 });
    return w.speed / v0;
  };
  const n = run(FLOOR.NORMAL), ice = run(FLOOR.ICE), st = run(FLOOR.STICKY);
  assert.ok(ice > n, `ice ${ice} > normal ${n}`);
  assert.ok(st < n, `sticky ${st} < normal ${n}`);
});

test('physics: holes make the marble fall; respawn resets position', () => {
  const L = levelForIndex(12);
  const w = new World(L);
  const h = L.holes[0];
  w.x = h.x + 0.5 + 0.1; w.y = h.y + 0.5;
  const ev = w.step(CFG.DT, { x: 0, y: 0 });
  assert.ok(ev.some(e => e.type === 'fell'));
  assert.equal(w.status, 'fell'); assert.equal(w.falls, 1);
  w.respawn();
  assert.equal(w.status, 'playing');
  assert.deepEqual([w.x, w.y], [L.start.x + 0.5, L.start.y + 0.5]);
});

test('physics: coins are collected once; goal ends the level', () => {
  const L = levelForIndex(3);
  const w = new World(L);
  w.x = L.coins[0].x + 0.5; w.y = L.coins[0].y + 0.5;
  let got = 0;
  for (let i = 0; i < 3; i++) for (const e of w.step(CFG.DT, { x: 0, y: 0 })) if (e.type === 'coin') got++;
  assert.equal(got, 1); assert.equal(w.coinsTaken.size, 1);
  w.x = L.goal.x + 0.5; w.y = L.goal.y + 0.5;
  assert.ok(w.step(CFG.DT, { x: 0, y: 0 }).some(e => e.type === 'won'));
  assert.equal(w.status, 'won');
});

test('AUTOPILOT: solves levels 1..120 through the real physics (solvability proof)', () => {
  const failures = []; let totalFalls = 0;
  for (let n = 1; n <= 120; n++) {
    const r = simulate(levelForIndex(n), { maxSeconds: 120 }, World);
    totalFalls += r.falls;
    if (r.status !== 'won') failures.push(`${n}:${r.status}@${r.time.toFixed(1)}`);
  }
  assert.deepEqual(failures, [], `unsolved: ${failures.join(' ')}`);
  assert.ok(totalFalls <= 15, `autopilot fell ${totalFalls} times`);
});

test('AUTOPILOT: solves 30 daily seeds incl. ice/sticky/holes', () => {
  const failures = [];
  for (let d = 1; d <= 30; d++) {
    const key = `2027-01-${String(d).padStart(2, '0')}`;
    const r = simulate(generateLevel(dailyParams(key)), { maxSeconds: 120 }, World);
    if (r.status !== 'won') failures.push(`${key}:${r.status}`);
  }
  assert.deepEqual(failures, []);
});

test('hint path: computePath from any open cell reaches the goal avoiding holes', () => {
  const L = levelForIndex(25);
  const holes = new Set(L.holes.map(h => h.y * L.w + h.x));
  let checked = 0;
  for (let i = 0; i < L.w * L.h; i++) {
    if (holes.has(i)) continue;
    const p = computePath(L, i);
    if (p.length) { checked++; assert.ok(p.every(c => !holes.has(c))); assert.equal(p.at(-1), L.goal.y * L.w + L.goal.x); }
  }
  assert.ok(checked > L.w * L.h * 0.6);
});

test('scoring: stars, par and rewards', () => {
  const par = parTime(20);
  assert.equal(starsFor(par, 0, 20), 3);
  assert.equal(starsFor(par * 1.8 + 0.1, 0, 20), 2);
  assert.equal(starsFor(par * 3.2, 0, 20), 1);
  assert.equal(starsFor(par * 1.7, 1, 20), 2);
  assert.equal(clearReward({ stars: 3, kind: 'journey' }), 5);
  assert.equal(clearReward({ stars: 1, kind: 'daily', streak: 3 }), 13);
  assert.equal(clearReward({ stars: 1, kind: 'daily', streak: 99 }), 20);
});
