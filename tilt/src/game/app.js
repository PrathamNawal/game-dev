// App shell: save, settings, state machine (menu / playing / paused / won), economy, ads, daily.
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Run } from './run.js';
import { GameAudio } from './audio.js';
import { AdManager, DemoProvider, NullProvider } from './ads.js';
import { setHaptics, prefersReducedMotion } from './fx.js';
import { QualityGovernor } from './perf.js';
import { UI } from '../ui/ui.js';
import { SaveStore } from '../core/save.js';
import { levelForIndex, levelForDaily, dailyKey } from '../core/levels.js';
import { Autopilot } from '../core/autopilot.js';
import { starsFor, parTime } from '../core/scoring.js';
import { COST, spend, canAfford, earn, completeLevel, completeDaily, skipLevel, REWARD } from '../core/economy.js';

// Ads mode: build-time default (TILT_ADS=off npm run build) with a ?ads=off|demo URL override for testing.
const ADS_DEFAULT = typeof __ADS_MODE__ === 'string' ? __ADS_MODE__ : 'demo';
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const safeStorage = () => { try { return window.localStorage; } catch { return null; } };
const coarsePointer = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export class App {
  constructor({ canvas, root, stage, params = new URLSearchParams(location.search) }) {
    this.params = params;
    this.debug = params.has('debug') || params.has('auto');
    this.save = new SaveStore(safeStorage());
    const S = this.save.state;

    const q = params.get('q');
    this.renderer = new Renderer(canvas, { quality: q === 'low' || q === 'high' ? q : S.settings.quality });
    this.renderer.reducedMotion = prefersReducedMotion();
    this.input = new Input(stage);
    this.audio = new GameAudio();
    this.ui = new UI(root, this._actions());
    this.ads = new AdManager({
      provider: (params.get('ads') || ADS_DEFAULT) === 'off' ? new NullProvider() : new DemoProvider((kind, sec) => this.ui.showDemoAd(kind, sec)),
      getFlags: () => this.save.state.flags,
      onWatched: kind => { this.save.state.stats.adsWatched++; this.track(kind === 'rewarded' ? 'ad_rewarded' : 'ad_interstitial'); },
    });
    this.applySettings();

    this.mode = 'boot';            // boot | menu | playing | paused | won
    this.run = null; this.attract = null; this.current = null; this.lastWin = null;
    this.events = [];              // local telemetry ring buffer (no network)
    this.levelsPage = 0;
    this.hudAcc = 0; this.playSecAcc = 0;
    // Auto-downgrade graphics on slow devices (only when the player/URL hasn't pinned a quality).
    this.governor = (q === 'low' || q === 'high' || this.save.state.settings.quality === 'low') ? null : new QualityGovernor();
    this.installEvent = null;
    this.wakeLock = null;

    this.input.onPause = () => { if (this.mode === 'playing') this.pause(); else if (this.mode === 'paused') this.resume(); };
    this.input.onUserInput = () => { this.audio.unlock(); this._firstMotion(); };

    addEventListener('resize', () => this.renderer.resize());
    addEventListener('orientationchange', () => setTimeout(() => { this.renderer.resize(); this.input.recalibrate(); }, 300));
    addEventListener('pagehide', () => { try { this._persist(); } catch { /* ignore */ } });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.mode === 'playing') this.pause(); this.audio.setRolling?.(0); }
      else if (this.mode === 'playing' || this.mode === 'paused') this._acquireWake();
    });
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.installEvent = e; if (this.mode === 'menu') this.showMenu(); });
    addEventListener('appinstalled', () => { this.installEvent = null; this.track('install'); });
  }

  // ------------------------------------------------------------------ lifecycle
  start() {
    const lv = Number(this.params.get('level'));
    if (lv >= 1) this.beginJourney(lv); else this.showMenu();
    let last = performance.now();
    this.renderer.gl.setAnimationLoop(now => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      this._frame(dt);
    });
  }

  _frame(dt) {
    if (this.run && (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'won')) {
      this.run.update(dt);
      if (this.mode === 'playing') {
        if (this.governor && this.governor.push(dt) === 'downgrade') {
          this.governor = null; this.setSetting('quality', 'low'); this.track('auto_low_quality');
          this.ui.toast('Switched to Low graphics for smoother play');
        }
        this.playSecAcc += dt;
        this.hudAcc += dt;
        if (this.hudAcc > 0.08) {
          this.hudAcc = 0;
          this.ui.updateHud({ time: this.run.time, pips: this.run.coinsGot });
        }
        this.ui.updateStick(this.input.stick);
        const stuck = this.run.falls >= 3 || this.run.time > parTime(this.current.level.pathLen) * 3;
        this.ui.setHintPulse(stuck && this.run.started);
      }
    } else if (this.attract) {
      this.attract.update(dt);
      this.attractClock += dt;
      if (this.attractClock > 75) this._startAttract();
    }
    this.renderer.render();
  }

  applySettings() {
    const s = this.save.state.settings;
    this.audio.setEnabled(s.sound); setHaptics(s.haptics);
    this.input.sensitivity = s.sensitivity; this.input.controls = s.controls;
    if (this.renderer.quality !== s.quality && !this.params.get('q')) this.renderer.setQuality(s.quality);
    if (this.run) this.run.world.assist = s.assist;
  }

  track(name, props = {}) {
    this.events.push({ t: Date.now(), name, ...props });
    if (this.events.length > 200) this.events.shift();
    if (this.debug && typeof console !== 'undefined') console.debug('[track]', name, props);
  }

  _persist() { this.save.state.stats.playSec += Math.floor(this.playSecAcc); this.playSecAcc -= Math.floor(this.playSecAcc); this.save.save(); }

  // ------------------------------------------------------------------ menu / attract
  showMenu() {
    this.mode = 'menu';
    this.hideWake();
    this.run = null;
    if (!this.attract) this._startAttract();
    const S = this.save.state, today = dailyKey();
    this.ui.showMenu({
      level: S.level, coins: S.coins,
      daily: { done: S.daily.last === today, streak: S.daily.streak },
      canInstall: !!this.installEvent,
    });
  }

  _startAttract() {
    const S = this.save.state;
    const n = 4 + ((Date.now() / 60000 | 0) % 17) + (S.level % 7);
    const level = levelForIndex(n);
    const ap = new Autopilot(level, { vmax: 2.4 });
    const fake = { getTilt: () => (this.attract?.run.state === 'playing' ? ap.tilt(this.attract.run.world) : { x: 0, y: 0 }), recalibrate() {}, stick: { active: false } };
    this.attractClock = 0;
    const self = this;
    const run = new Run({ renderer: this.renderer, input: fake, level, on: {
      won() { setTimeout(() => { if (self.attract && self.mode === 'menu') self._startAttract(); }, 800); },
      fell() { /* autopilot replans after respawn through Run */ },
    } });
    // Replan after a respawn so the demo does not get stuck.
    const origUpdate = run.update.bind(run); let lastState = run.state;
    run.update = dt => { origUpdate(dt); if (lastState === 'falling' && run.state === 'playing') ap.replan(run.world); lastState = run.state; };
    this.attract = { run, update: dt => run.update(dt) };
  }

  // ------------------------------------------------------------------ gameplay
  async _ensureMotion() {
    const s = this.save.state.settings;
    if (s.controls === 'touch' || this.input.gyro.enabled || !coarsePointer() || typeof DeviceOrientationEvent === 'undefined') return;
    const r = await this.input.enableGyro();
    this.save.state.flags.motionAsked = true;
    if (r === 'granted') this.ui.toast('Tilt on — hold your phone comfortably');
    else if (r === 'denied') this.ui.toast('Motion blocked — drag anywhere to roll');
  }

  async beginJourney(n) { return this._begin({ kind: 'journey', n }); }
  async beginDaily() { return this._begin({ kind: 'daily', key: dailyKey() }); }

  async _begin(spec) {
    this.audio.unlock();
    const motion = this._ensureMotion();     // first await inside the user gesture
    this.attract = null;
    await motion;
    const level = spec.kind === 'daily' ? levelForDaily(spec.key) : levelForIndex(spec.n);
    this.current = { ...spec, level };
    this.mode = 'playing';
    const S = this.save.state;
    this.run = new Run({
      renderer: this.renderer, input: this.input, level, assist: S.settings.assist, audio: this.audio,
      on: {
        start: () => this._firstMotion(),
        fell: () => { S.stats.falls++; this.track('fall', { kind: spec.kind, n: spec.n }); this.ui.toast('Oops! +2s'); },
        won: r => this._onWon(r),
      },
    });
    if (this.params.has('auto')) {
      const ap = new Autopilot(level);
      let was = 'playing';
      this.input.getTilt = () => {
        if (this.run.state === 'falling') { was = 'falling'; return { x: 0, y: 0 }; }
        if (was === 'falling') { ap.replan(this.run.world); was = 'playing'; }
        return this.run.state === 'playing' ? ap.tilt(this.run.world) : { x: 0, y: 0 };
      };
    }
    this.input.recalibrate();
    this.ui.hideAll();
    this.ui.showHud({
      label: spec.kind === 'daily' ? `Daily ${spec.key.slice(5)}` : `Level ${spec.n}`,
      coins: S.coins, hintCost: COST.hint, showRecal: this.input.usingGyro,
    });
    this.ui.updateHud({ time: 0, pips: 0, coins: S.coins });
    this.tutorialShown = false;
    if (!S.flags.tutorialSeen && spec.kind === 'journey' && spec.n <= 2) {
      this.ui.showCoach(this.input.usingGyro ? 'Tilt your phone to roll the marble into the glowing ring'
        : coarsePointer() ? 'Drag anywhere to roll the marble into the glowing ring' : 'Use arrow keys / WASD (or drag) to roll into the glowing ring');
      this.tutorialShown = true;
    }
    S.stats.plays++;
    this.track('level_start', { kind: spec.kind, n: spec.n, key: spec.key });
    this._acquireWake();
    this._persist();
  }

  _firstMotion() {
    if (this.tutorialShown) { this.tutorialShown = false; this.ui.hideCoach(); this.save.state.flags.tutorialSeen = true; }
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused'; this.run.paused = true; this.audio.setRolling(0);
    this.ui.showPause({ skipCost: COST.skip, canSkip: this.current.kind === 'journey', showRecal: this.input.usingGyro });
  }
  resume() {
    if (this.mode !== 'paused') return;
    this.ui.hidePause(); this.ui.hideSettings();
    this.mode = 'playing'; this.run.paused = false; this.input.recalibrate();
  }
  restart() {
    const c = this.current; this.ui.hidePause(); this.ui.hideWin();
    return c.kind === 'daily' ? this.beginDaily() : this.beginJourney(c.n);
  }

  async _withPausedRun(fn) {
    const was = this.run && !this.run.paused; if (this.run) this.run.paused = true;
    try { return await fn(); } finally { if (this.run && was && this.mode === 'playing') this.run.paused = false; }
  }

  async useHint() {
    if (this.mode !== 'playing' && this.mode !== 'paused') return;
    const S = this.save.state;
    if (canAfford(S, COST.hint)) {
      spend(S, COST.hint); S.stats.hints++;
      this.run.showHint(4); this.audio.hint(); this.track('hint', { paid: true });
      this.ui.updateHud({ time: this.run.time, pips: this.run.coinsGot, coins: S.coins });
      this._persist();
      return;
    }
    if (this.mode === 'paused') return;
    if (!this.ads.rewardedAvailable()) { this.audio.error(); this.ui.toast(`Need ${COST.hint} coins — clear levels and grab coins to earn more`); return; }
    await this._withPausedRun(async () => {
      const ok = await this.ui.confirm({ title: 'Need a hint?', body: `You need ${COST.hint} coins. Watch a short video for a free hint?`, ok: 'Watch video', cancel: 'Not now' });
      if (!ok) return;
      if (await this.ads.rewarded()) { S.stats.hints++; this.run.showHint(4); this.audio.hint(); this.track('hint', { paid: false }); this._persist(); }
      else this.ui.toast('No reward earned');
    });
  }

  async skipLevel() {
    if (!this.current || this.current.kind !== 'journey') return;
    const S = this.save.state, n = this.current.n;
    const free = canAfford(S, COST.skip);
    if (!free && !this.ads.rewardedAvailable()) { this.audio.error(); this.ui.toast(`Skipping costs ${COST.skip} coins — you have ${S.coins}`); return; }
    const ok = await this.ui.confirm({
      title: 'Skip this level?', body: free ? `Costs ${COST.skip} coins. You can always come back to it.` : `You need ${COST.skip} coins. Watch a short video to skip instead?`,
      ok: free ? `Skip · ${COST.skip}` : 'Watch video', cancel: 'Keep trying',
    });
    if (!ok) return;
    if (free) spend(S, COST.skip);
    else if (!(await this.ads.rewarded())) { this.ui.toast('No reward earned'); return; }
    skipLevel(S, n); this.track('skip', { n, paid: free }); this._persist();
    this.ui.hidePause();
    await this.beginJourney(Math.max(n + 1, S.level));
  }

  _onWon(r) {
    const S = this.save.state, c = this.current, L = c.level;
    const stars = starsFor(r.time, r.falls, L.pathLen);
    let econ, title, nextLabel;
    if (c.kind === 'daily') {
      econ = completeDaily(S, { key: c.key, time: r.time, falls: r.falls, stars, pickups: r.coins });
      title = econ.already ? 'Daily cleared again!' : 'Daily cleared!'; nextLabel = 'Back to menu';
      this.track('daily_clear', { key: c.key, time: r.time, stars, streak: econ.streak });
    } else {
      const hadBest = S.best[String(c.n)] != null;
      econ = completeLevel(S, { n: c.n, time: r.time, falls: r.falls, stars, pickups: r.coins });
      econ.newBest = econ.newBest && hadBest;   // "Best!" only celebrates beating a previous time
      title = `Level ${c.n} cleared!`; nextLabel = `Next level`;
      this.track('level_clear', { n: c.n, time: r.time, stars, falls: r.falls });
    }
    this.ads.noteClear();
    this._persist();
    this.mode = 'won';
    this.lastWin = { ...r, stars, econ, title };
    this.ui.hideAll();
    this.ui.showWin({
      title, stars, time: r.time, falls: r.falls, total: econ.total, newBest: !!econ.newBest, streak: econ.streak, already: econ.already,
      nextLabel, canDouble: econ.total > 0 && this.ads.enabled && this.ads.rewardedAvailable(),
    });
    for (let i = 0; i < stars; i++) setTimeout(() => this.audio.star(i), 350 + i * 180);
  }

  async next() {
    const c = this.current;
    this.ui.hideWin();
    await this.ads.maybeInterstitial();
    if (c.kind === 'daily') return this.showMenu();
    return this.beginJourney(Math.min(c.n + 1, Math.max(this.save.state.level, c.n + 1)));
  }

  async doubleReward() {
    const S = this.save.state, w = this.lastWin;
    if (!w || w.doubled) return;
    if (await this.ads.rewarded()) {
      w.doubled = true; earn(S, w.econ.total); this._persist();
      this.ui.markDoubled(w.econ.total * 2); this.audio.coin(3); this.ui.toast(`+${w.econ.total} bonus coins!`);
    } else this.ui.toast('No reward earned');
  }

  async share() {
    const c = this.current, w = this.lastWin; if (!c || !w) return;
    const star = '★'.repeat(w.stars) + '☆'.repeat(3 - w.stars);
    const what = c.kind === 'daily' ? `Tilt Daily ${c.key}` : `Tilt level ${c.n}`;
    const text = `I cleared ${what} ${star} in ${w.time.toFixed(1)}s. Can you beat it?`;
    const url = location.origin + location.pathname;
    try {
      if (navigator.share) await navigator.share({ title: 'Tilt', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); this.ui.toast('Copied to clipboard'); }
    } catch { /* user cancelled */ }
  }

  // ------------------------------------------------------------------ settings & misc
  setSetting(key, value) {
    const S = this.save.state;
    S.settings[key] = value;
    this.applySettings(); this.save.save();
    if (key === 'controls' && this.mode === 'playing') this.ui.toast(value === 'touch' ? 'Touch controls: drag anywhere' : 'Tilt controls');
  }

  openSettings() {
    const S = this.save.state;
    this.ui.showSettings({
      settings: S.settings, version: VERSION, persistent: this.save.persistent,
      gyro: { canEnable: coarsePointer() && typeof DeviceOrientationEvent !== 'undefined', enabled: this.input.gyro.enabled && this.input.gyro.available },
    });
  }

  async enableMotion() {
    const r = await this.input.enableGyro();
    this.ui.toast(r === 'granted' ? 'Tilt enabled' : r === 'denied' ? 'Motion access denied by the browser' : 'No motion sensor found');
    this.openSettings();
  }

  async resetProgress() {
    const ok = await this.ui.confirm({ title: 'Reset all progress?', body: 'Levels, stars, coins and streaks will be erased on this device.', ok: 'Reset', cancel: 'Cancel', danger: true });
    if (!ok) return;
    this.save.reset(); this.applySettings(); this.ui.hideSettings(); this.ui.toast('Progress reset');
    if (this.mode === 'menu') this.showMenu(); else this.toMenu();
  }

  toMenu() {
    this.ui.hideAll(); this.audio.setRolling(0); this._persist(); this.run = null; this.attract = null;
    this.showMenu();
  }

  async install() {
    const e = this.installEvent; if (!e) return;
    e.prompt(); await e.userChoice.catch(() => {}); this.installEvent = null; this.showMenu();
  }

  async _acquireWake() {
    try { if ('wakeLock' in navigator && !this.wakeLock) { this.wakeLock = await navigator.wakeLock.request('screen'); this.wakeLock.addEventListener('release', () => { this.wakeLock = null; }); } } catch { /* denied */ }
  }
  hideWake() { try { this.wakeLock?.release(); } catch { /* noop */ } this.wakeLock = null; }

  // ------------------------------------------------------------------ UI action table
  _actions() {
    return {
      sfx: k => this.audio[k]?.(),
      play: () => { this.audio.unlock(); return this.beginJourney(this.save.state.level); },
      daily: () => { this.audio.unlock(); return this.beginDaily(); },
      levels: () => { this.levelsPage = Math.floor((this.save.state.level - 1) / 20); this._renderLevels(); },
      closeLevels: () => this.ui.hideLevels(),
      levelsPage: d => { this.levelsPage = Number(d.page); this._renderLevels(); },
      playLevel: d => { this.ui.hideLevels(); return this.beginJourney(Number(d.n)); },
      settings: () => this.openSettings(),
      closeSettings: () => this.ui.hideSettings(),
      setSetting: (k, v) => this.setSetting(k, v),
      enableMotion: () => this.enableMotion(),
      resetProgress: () => this.resetProgress(),
      install: () => this.install(),
      pause: () => this.pause(), resume: () => this.resume(), restart: () => this.restart(),
      hint: () => this.useHint(), skip: () => this.skipLevel(),
      recal: () => { this.input.recalibrate(); this.ui.toast('Calibrated — this pose is now flat'); },
      next: () => this.next(), replay: () => this.restart(), menu: () => this.toMenu(),
      double: () => this.doubleReward(), share: () => this.share(),
    };
  }

  _renderLevels() {
    const S = this.save.state;
    this.ui.showLevels({ unlocked: S.level, stars: S.stars, page: this.levelsPage, current: S.level });
  }
}
