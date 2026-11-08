import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, MemoryStorage, defaultSave, migrate, sanitize, SAVE_KEY, BACKUP_KEY, SAVE_VERSION } from '../../src/core/save.js';
import { completeLevel, completeDaily, skipLevel, spend, earn, canAfford, COST, streakAlive } from '../../src/core/economy.js';
import { prevDayKey, dailyKey } from '../../src/core/levels.js';
import { AdManager, DemoProvider, AD_POLICY } from '../../src/game/ads.js';

test('save: defaults, roundtrip through storage', () => {
  const st = new MemoryStorage();
  const a = new SaveStore(st);
  assert.equal(a.loadedFrom, 'default');
  a.state.coins = 77; a.state.level = 9; a.state.stars['3'] = 2; assert.ok(a.save());
  const b = new SaveStore(st);
  assert.equal(b.loadedFrom, 'main');
  assert.equal(b.state.coins, 77); assert.equal(b.state.level, 9); assert.equal(b.state.stars['3'], 2);
});

test('save: corrupted main falls back to backup, then defaults', () => {
  const st = new MemoryStorage();
  const a = new SaveStore(st);
  a.state.coins = 11; a.save();
  a.state.coins = 22; a.save();      // backup now holds coins=11
  st.setItem(SAVE_KEY, '{not json');
  const b = new SaveStore(st);
  assert.equal(b.loadedFrom, 'backup'); assert.equal(b.state.coins, 11);
  st.setItem(BACKUP_KEY, 'garbage');
  const c = new SaveStore(st);
  assert.equal(c.loadedFrom, 'default'); assert.deepEqual(c.state, defaultSave());
});

test('save: migrates v0 prototype shape; refuses newer versions', () => {
  const m = migrate({ coins: 50, level: 4, sound: false });
  assert.equal(m.version, SAVE_VERSION);
  const s = sanitize(m);
  assert.equal(s.coins, 50); assert.equal(s.level, 4); assert.equal(s.settings.sound, false);
  assert.equal(migrate({ version: 99, coins: 1 }), null);
  assert.equal(migrate([]), null); assert.equal(migrate('x'), null);
});

test('save: sanitize clamps hostile / garbage values', () => {
  const s = sanitize({ coins: -5, level: 'x', stars: { 1: 9, 2: 2, z: 3 }, best: { 1: -1, 2: 12.5 },
    settings: { sensitivity: 99, controls: 'xxx', quality: 'ultra' }, daily: { last: 'nope', streak: -3, done: ['2026-01-01', 5] } });
  assert.equal(s.coins, 0); assert.equal(s.level, 1);
  assert.deepEqual(s.stars, { 2: 2 }); assert.deepEqual(s.best, { 2: 12.5 });
  assert.equal(s.settings.sensitivity, 1.6); assert.equal(s.settings.controls, 'auto'); assert.equal(s.settings.quality, 'high');
  assert.equal(s.daily.last, null); assert.equal(s.daily.streak, 0); assert.deepEqual(s.daily.done, ['2026-01-01']);
});

test('save: unavailable storage degrades to memory without throwing', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('x'); } };
  const s = new SaveStore(broken);
  assert.equal(s.persistent, false);
  s.state.coins = 5; assert.ok(s.save());
  assert.equal(new SaveStore(null).persistent, false);
});

test('economy: spend/earn, hint & skip costs', () => {
  const s = defaultSave();
  assert.ok(canAfford(s, COST.hint)); assert.ok(spend(s, COST.hint)); assert.equal(s.coins, 15);
  assert.equal(spend(s, COST.skip), false); assert.equal(s.coins, 15);
  earn(s, 30.9); assert.equal(s.coins, 45);
  earn(s, -10); assert.equal(s.coins, 45);
  skipLevel(s, 1); assert.equal(s.level, 2); assert.equal(s.stats.skips, 1);
  skipLevel(s, 1); assert.equal(s.level, 2);
});

test('economy: first clear pays reward + pickups; replay pays pickups only', () => {
  const s = defaultSave();
  const r1 = completeLevel(s, { n: 1, time: 10, falls: 0, stars: 3, pickups: 2 });
  assert.equal(r1.reward, 5); assert.equal(r1.total, 7); assert.equal(s.coins, 37);
  assert.equal(s.level, 2); assert.equal(s.stars['1'], 3); assert.equal(s.best['1'], 10);
  const r2 = completeLevel(s, { n: 1, time: 8, falls: 1, stars: 3, pickups: 1 });
  assert.equal(r2.reward, 0); assert.equal(r2.total, 1); assert.ok(r2.newBest); assert.equal(s.best['1'], 8);
  const r3 = completeLevel(s, { n: 1, time: 30, falls: 0, stars: 1, pickups: 0 });
  assert.equal(s.stars['1'], 3); assert.equal(r3.newBest, false); assert.equal(s.level, 2);
});

test('economy: daily streak continues, resets, and cannot be claimed twice', () => {
  const s = defaultSave();
  const run = key => completeDaily(s, { key, time: 20, falls: 0, stars: 2, pickups: 1 });
  assert.equal(run('2026-11-05').streak, 1);
  assert.equal(run('2026-11-06').streak, 2);
  const again = run('2026-11-06'); assert.ok(again.already); assert.equal(again.total, 0); assert.equal(s.daily.streak, 2);
  const r = run('2026-11-07'); assert.equal(r.streak, 3); assert.equal(r.reward, 13);
  assert.equal(run('2026-11-10').streak, 1);               // gap -> reset
  assert.equal(s.daily.bestStreak, 3);
  assert.ok(streakAlive(s, '2026-11-11')); assert.ok(!streakAlive(s, '2026-11-13'));
});

test('dates: prevDayKey handles month/year/leap boundaries', () => {
  assert.equal(prevDayKey('2026-03-01'), '2026-02-28');
  assert.equal(prevDayKey('2028-03-01'), '2028-02-29');
  assert.equal(prevDayKey('2027-01-01'), '2026-12-31');
  assert.equal(dailyKey(new Date(2026, 0, 5)), '2026-01-05');
});

const mkAds = (over = {}) => {
  let t = 1_000_000; const shown = [];
  const provider = new DemoProvider(async kind => { shown.push(kind); return over.complete ?? true; });
  const flags = { noAds: false, ...(over.flags || {}) };
  const ads = new AdManager({ provider, getFlags: () => flags, now: () => t, onWatched: () => shown.push('watched') });
  return { ads, advance: ms => { t += ms; }, shown, flags };
};

test('ads: interstitial only every 4th clear, after 3 min session, 3 min apart', async () => {
  const { ads, advance, shown } = mkAds();
  for (let i = 0; i < 4; i++) ads.noteClear();
  assert.equal(await ads.maybeInterstitial(), false, 'too early in the session');
  advance(AD_POLICY.minSessionMs);
  assert.equal(await ads.maybeInterstitial(), true);
  assert.deepEqual(shown.filter(x => x === 'interstitial'), ['interstitial']);
  for (let i = 0; i < 4; i++) ads.noteClear();           // 8th clear, but only just showed one
  assert.equal(await ads.maybeInterstitial(), false);
  advance(AD_POLICY.minGapMs);
  assert.equal(await ads.maybeInterstitial(), true);
  ads.noteClear();                                       // 9th clear: not a multiple of 4
  advance(AD_POLICY.minGapMs);
  assert.equal(await ads.maybeInterstitial(), false);
});

test('ads: rewarded pays only on completion; noAds disables interstitials', async () => {
  const a = mkAds({ complete: true });
  assert.equal(await a.ads.rewarded(), true); assert.ok(a.shown.includes('watched'));
  const b = mkAds({ complete: false });
  assert.equal(await b.ads.rewarded(), false); assert.ok(!b.shown.includes('watched'));
  const c = mkAds({ flags: { noAds: true } });
  for (let i = 0; i < 4; i++) c.ads.noteClear(); c.advance(1e9);
  assert.equal(await c.ads.maybeInterstitial(), false);
});

test('ads: provider failure never throws or blocks', async () => {
  const provider = { isReady: () => true, show: async () => { throw new Error('sdk down'); } };
  const ads = new AdManager({ provider, getFlags: () => ({ noAds: false }) });
  assert.equal(await ads.rewarded(), false);
  assert.equal(ads.busy, false);
});

import { QualityGovernor } from '../../src/game/perf.js';
test('perf: governor downgrades only on sustained slowness, ignoring warmup and spikes', () => {
  const slow = new QualityGovernor(); let r = null;
  for (let i = 0; i < 200 && !r; i++) r = slow.push(i < 30 ? 0.2 : 0.045);   // 45 ms frames after warmup
  assert.equal(r, 'downgrade');
  const fast = new QualityGovernor(); r = null;
  for (let i = 0; i < 300; i++) r = fast.push(i < 10 ? 0.2 : 0.0167) || r;
  assert.equal(r, null);
  const spiky = new QualityGovernor(); r = null;
  for (let i = 0; i < 300; i++) r = spiky.push(i % 50 === 0 ? 3 : 0.016) || r;   // tab-switch style spikes are ignored
  assert.equal(r, null);
  assert.equal(slow.push(0.5), null, 'only decides once');
});

import { NullProvider } from '../../src/game/ads.js';
test('ads: "off" mode never shows anything and never pays', async () => {
  const ads = new AdManager({ provider: new NullProvider(), getFlags: () => ({ noAds: false }) });
  assert.equal(ads.rewardedAvailable(), false);
  assert.equal(await ads.rewarded(), false);
  for (let i = 0; i < 8; i++) ads.noteClear();
  assert.equal(ads.canShowInterstitial(), false);
  assert.equal(await ads.maybeInterstitial(), false);
});
