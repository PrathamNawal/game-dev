import './ui/styles.css';
import { UI } from './ui/ui.js';
import { SaveStore } from './core/save.js';
import { levelParams, makeRound, isHit, starsFor } from './core/demo.js';
import { GameAudio } from './game/audio.js';
import { AdManager, DemoProvider, NullProvider } from './game/ads.js';
import { setHaptics } from './game/fx.js';

// ---- Ads mode: build-time default (GAME_ADS=off npm run build) + ?ads=off|demo override. No banners, ever.
const ADS_DEFAULT = typeof __ADS_MODE__ === 'string' ? __ADS_MODE__ : 'demo';
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const params = new URLSearchParams(location.search);
const debug = params.has('debug');

const save = new SaveStore((() => { try { return localStorage; } catch { return null; } })());
const S = save.state;
const canvas = document.getElementById('c'), ctx2d = canvas.getContext('2d');
const audio = new GameAudio();
let ui; // assigned below
const ads = new AdManager({
  provider: (params.get('ads') || ADS_DEFAULT) === 'off' ? new NullProvider() : new DemoProvider((k, s) => ui.showDemoAd(k, s)),
  getFlags: () => S.flags,
  onWatched: () => { S.stats.adsWatched++; },
});

// ---- Game session state (replace with your game) ----
let mode = 'menu', cur = null, round = null, idx = 0, t0 = 0, now = 0, lastWin = null, levelsPage = 0;
const apply = () => { audio.setEnabled(S.settings.sound); setHaptics(S.settings.haptics); };
apply();

const fitCanvas = () => { const d = Math.min(devicePixelRatio || 1, 2); canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; };
addEventListener('resize', fitCanvas); fitCanvas();

function begin(spec) {
  audio.unlock();
  cur = spec; round = makeRound(spec.params); idx = 0; t0 = performance.now(); mode = 'playing';
  ui.hideAll(); ui.showHud({ label: spec.label, coins: S.coins, hintCost: 15, showRecal: false });
  S.stats.plays++; save.save();
}
const beginLevel = n => begin({ kind: 'journey', n, label: `Level ${n}`, params: levelParams(n) });

function win() {
  mode = 'won';
  const time = (performance.now() - t0) / 1000, stars = starsFor(time, round.par), n = cur.n;
  const first = !S.stars[n];
  if (stars > (S.stars[n] || 0)) S.stars[n] = stars;
  if (n >= S.level) S.level = n + 1;
  const total = first ? 2 + stars : 0; S.coins += total; S.stats.clears++; save.save();
  lastWin = { total, doubled: false };
  audio.win(); ui.hideAll();
  ui.showWin({ title: `Level ${n} cleared!`, stars, time, falls: 0, total, newBest: false, nextLabel: 'Next level', canDouble: total > 0 && ads.rewardedAvailable() });
}

canvas.addEventListener('pointerdown', e => {
  if (mode !== 'playing') return;
  // Hit-test in CSS pixels: normalized coordinates would distort on a non-square canvas.
  const r = canvas.getBoundingClientRect(), t = round.targets[idx];
  if (isHit({ x: t.x * r.width, y: t.y * r.height }, e.clientX - r.left, e.clientY - r.top, cur.params.radius * r.width)) {
    audio.coin(idx + 1); idx++; if (idx >= round.targets.length) win();
  } else audio.error();
});

function draw(ts) {
  now = ts / 1000;
  const w = canvas.width, h = canvas.height;
  ctx2d.fillStyle = '#0e1424'; ctx2d.fillRect(0, 0, w, h);
  if (round && (mode === 'playing' || mode === 'paused')) {
    const t = round.targets[Math.min(idx, round.targets.length - 1)], px = t.x * w, py = t.y * h, r = cur.params.radius * w;
    const pulse = 1 + Math.sin(now * 5) * 0.08;
    const g = ctx2d.createRadialGradient(px, py, 0, px, py, r * 2.6 * pulse);
    g.addColorStop(0, 'rgba(74,222,128,.85)'); g.addColorStop(1, 'rgba(74,222,128,0)');
    ctx2d.fillStyle = g; ctx2d.beginPath(); ctx2d.arc(px, py, r * 2.6 * pulse, 0, 7); ctx2d.fill();
    ctx2d.fillStyle = '#4ade80'; ctx2d.beginPath(); ctx2d.arc(px, py, r * pulse, 0, 7); ctx2d.fill();
    if (mode === 'playing') ui.updateHud({ time: (performance.now() - t0) / 1000, pips: Math.min(3, Math.floor((idx / round.targets.length) * 3)) });
  }
  requestAnimationFrame(draw);
}

// ---- UI wiring: one action table; the UI never reaches into game state directly ----
const actions = {
  sfx: k => audio[k]?.(),
  play: () => beginLevel(S.level),
  daily: () => begin({ kind: 'daily', n: 0, label: 'Daily', params: { ...levelParams(5), seed: `__SLUG__:daily:${new Date().toDateString()}` } }),
  levels: () => { levelsPage = Math.floor((S.level - 1) / 20); renderLevels(); },
  closeLevels: () => ui.hideLevels(),
  levelsPage: d => { levelsPage = Number(d.page); renderLevels(); },
  playLevel: d => { ui.hideLevels(); beginLevel(Number(d.n)); },
  settings: () => ui.showSettings({ settings: S.settings, version: VERSION, persistent: save.persistent, gyro: { canEnable: false, enabled: false } }),
  closeSettings: () => ui.hideSettings(),
  setSetting: (k, v) => { S.settings[k] = v; apply(); save.save(); },
  resetProgress: async () => { if (await ui.confirm({ title: 'Reset all progress?', body: 'This erases progress on this device.', ok: 'Reset', cancel: 'Cancel', danger: true })) { save.reset(); location.reload(); } },
  pause: () => { if (mode === 'playing') { mode = 'paused'; ui.showPause({ skipCost: 40, canSkip: false, showRecal: false }); } },
  resume: () => { if (mode === 'paused') { ui.hidePause(); mode = 'playing'; } },
  restart: () => { ui.hidePause(); ui.hideWin(); cur.kind === 'daily' ? actions.daily() : beginLevel(cur.n); },
  hint: () => ui.toast('Follow the glow'),
  next: async () => { ui.hideWin(); await ads.maybeInterstitial(); cur.kind === 'daily' ? toMenu() : beginLevel(Math.max(S.level, cur.n + 1)); },
  replay: () => actions.restart(),
  menu: () => toMenu(),
  double: async () => { if (await ads.rewarded()) { S.coins += lastWin.total; save.save(); ui.markDoubled(lastWin.total * 2); } else ui.toast('No reward earned'); },
  share: async () => { try { await navigator.share?.({ title: '__NAME__', text: 'Can you beat my score?', url: location.href }); } catch { /* cancelled */ } },
};
function renderLevels() { ui.showLevels({ unlocked: S.level, stars: S.stars, page: levelsPage, current: S.level }); }
function toMenu() { ui.hideAll(); mode = 'menu'; save.save(); ui.showMenu({ level: S.level, coins: S.coins, daily: { done: false, streak: 0 }, canInstall: false }); }
ui = new UI(document.getElementById('ui'), actions);

document.addEventListener('visibilitychange', () => { if (document.hidden) actions.pause(); });
addEventListener('pagehide', () => save.save());
toMenu(); requestAnimationFrame(draw);
if (debug) window.__game = { get mode() { return mode; }, get round() { return round; }, get idx() { return idx; }, save, S, actions, ui };

if (!__DEV__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
