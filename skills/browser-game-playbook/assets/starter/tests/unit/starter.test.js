import test from 'node:test';
import assert from 'node:assert/strict';
import { levelParams, makeRound, isHit, starsFor } from '../../src/core/demo.js';
import { SaveStore, MemoryStorage, defaultSave, migrate, sanitize } from '../../src/core/save.js';
import { AdManager, DemoProvider, NullProvider, AD_POLICY } from '../../src/game/ads.js';
import { QualityGovernor } from '../../src/game/perf.js';

// Pattern: every generated level must be (a) deterministic from its seed and (b) validated structurally.
test('rounds are deterministic and structurally valid across many seeds', () => {
  for (let n = 1; n <= 200; n++) {
    const a = makeRound(levelParams(n)), b = makeRound(levelParams(n));
    assert.deepEqual(a, b, `level ${n} not deterministic`);
    assert.equal(a.targets.length, a.params.count);
    for (const t of a.targets) assert.ok(t.x >= 0 && t.x <= 1 && t.y >= 0 && t.y <= 1);
  }
});

test('hit test and stars', () => {
  assert.ok(isHit({ x: 10, y: 10 }, 12, 10, 5)); assert.ok(!isHit({ x: 10, y: 10 }, 40, 10, 5));
  assert.equal(starsFor(1, 10), 3); assert.equal(starsFor(25, 10), 2); assert.equal(starsFor(40, 10), 1);
});

// Pattern: save system — roundtrip, corruption fallback, hostile values, blocked storage.
test('save: roundtrip, backup fallback, sanitize, blocked storage', () => {
  const st = new MemoryStorage(), a = new SaveStore(st);
  a.state.coins = 77; a.save(); a.state.coins = 88; a.save();
  assert.equal(new SaveStore(st).state.coins, 88);
  st.setItem('__SLUG__.save', '{broken'); assert.equal(new SaveStore(st).state.coins, 77);
  assert.equal(sanitize(migrate({ version: 1, coins: -5, level: 'x', stars: { 1: 9 } })).coins, 0);
  assert.equal(migrate({ version: 99 }), null);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() {} };
  assert.equal(new SaveStore(broken).persistent, false);
  assert.deepEqual(new SaveStore(new MemoryStorage()).state, defaultSave());
});

// Pattern: ad pacing with an injected clock.
test('ads: paced interstitials, rewarded-on-completion only, off-mode inert', async () => {
  let t = 1e6; const provider = new DemoProvider(async () => true);
  const ads = new AdManager({ provider, getFlags: () => ({ noAds: false }), now: () => t });
  for (let i = 0; i < 4; i++) ads.noteClear();
  assert.equal(await ads.maybeInterstitial(), false, 'too early in session');
  t += AD_POLICY.minSessionMs; assert.equal(await ads.maybeInterstitial(), true);
  const off = new AdManager({ provider: new NullProvider(), getFlags: () => ({ noAds: false }) });
  assert.equal(await off.rewarded(), false); assert.equal(off.rewardedAvailable(), false);
});

test('perf governor downgrades only on sustained slowness', () => {
  const g = new QualityGovernor(); let r = null;
  for (let i = 0; i < 200 && !r; i++) r = g.push(i < 30 ? 0.2 : 0.045);
  assert.equal(r, 'downgrade');
  const f = new QualityGovernor(); r = null; for (let i = 0; i < 300; i++) r = f.push(0.0167) || r; assert.equal(r, null);
});
