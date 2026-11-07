// Versioned local save: parse -> migrate -> sanitize, with backup + in-memory fallback.
// Pure (storage is injected) so it is unit-testable in Node. See docs/TECH_DESIGN.md §8.
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'tilt.save';
export const BACKUP_KEY = 'tilt.save.bak';

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    coins: 30,
    level: 1,
    stars: {},
    best: {},
    daily: { last: null, streak: 0, bestStreak: 0, done: [] },
    settings: { sound: true, haptics: true, controls: 'auto', sensitivity: 1, quality: 'high', assist: false },
    flags: { tutorialSeen: false, motionAsked: false, noAds: false },
    stats: { plays: 0, clears: 0, falls: 0, playSec: 0, adsWatched: 0, hints: 0, skips: 0, dailyClears: 0 },
  };
}

const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d);
const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const isKey = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Upgrade any older shape to the current one. Returns null if `raw` is not an object. */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  let d = { ...raw };
  let v = Number.isInteger(d.version) ? d.version : 0;
  if (v < 1) {
    // v0 (pre-release prototype): flat { coins, level, sound }
    d = {
      version: 1, coins: d.coins, level: d.level,
      settings: { sound: d.sound },
    };
    v = 1;
  }
  // future: if (v < 2) { ...; v = 2 }
  if (v > SAVE_VERSION) return null; // saved by a newer build: do not guess
  d.version = SAVE_VERSION;
  return d;
}

/** Clamp/repair every field so the rest of the game can trust the shape. */
export function sanitize(d) {
  const def = defaultSave();
  const s = d.settings || {}, f = d.flags || {}, st = d.stats || {}, dl = d.daily || {};
  const stars = {}, best = {};
  for (const [k, v] of Object.entries(d.stars && typeof d.stars === 'object' ? d.stars : {})) {
    if (/^\d+$/.test(k) && v >= 1 && v <= 3) stars[k] = Math.floor(v);
  }
  for (const [k, v] of Object.entries(d.best && typeof d.best === 'object' ? d.best : {})) {
    if (/^\d+$/.test(k) && Number.isFinite(v) && v > 0 && v < 36000) best[k] = v;
  }
  return {
    version: SAVE_VERSION,
    coins: int(d.coins, 0, 10_000_000, def.coins),
    level: int(d.level, 1, 1_000_000, def.level),
    stars, best,
    daily: {
      last: isKey(dl.last) ? dl.last : null,
      streak: int(dl.streak, 0, 100_000, 0),
      bestStreak: int(dl.bestStreak, 0, 100_000, 0),
      done: Array.isArray(dl.done) ? dl.done.filter(isKey).slice(-60) : [],
    },
    settings: {
      sound: bool(s.sound, def.settings.sound),
      haptics: bool(s.haptics, def.settings.haptics),
      controls: oneOf(s.controls, ['auto', 'tilt', 'touch'], 'auto'),
      sensitivity: num(s.sensitivity, 0.6, 1.6, 1),
      quality: oneOf(s.quality, ['high', 'low'], 'high'),
      assist: bool(s.assist, false),
    },
    flags: {
      tutorialSeen: bool(f.tutorialSeen, false),
      motionAsked: bool(f.motionAsked, false),
      noAds: bool(f.noAds, false),
    },
    stats: Object.fromEntries(Object.keys(def.stats).map(k => [k, int(st[k], 0, 1e12, 0)])),
  };
}

/** Storage that lives only in memory (private mode / blocked storage). */
export class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

function parse(raw) {
  if (raw == null) return null;
  try { const m = migrate(JSON.parse(raw)); return m ? sanitize(m) : null; } catch { return null; }
}

export class SaveStore {
  constructor(storage) {
    this.persistent = true;
    this.storage = storage;
    if (!storage) { this.storage = new MemoryStorage(); this.persistent = false; }
    else {
      try { storage.setItem('tilt.probe', '1'); storage.removeItem('tilt.probe'); }
      catch { this.storage = new MemoryStorage(); this.persistent = false; }
    }
    this.state = this.load();
  }

  load() {
    let s = null, source = 'default';
    try { s = parse(this.storage.getItem(SAVE_KEY)); if (s) source = 'main'; } catch { /* ignore */ }
    if (!s) { try { s = parse(this.storage.getItem(BACKUP_KEY)); if (s) source = 'backup'; } catch { /* ignore */ } }
    this.loadedFrom = source;
    return s || defaultSave();
  }

  /** Persist current state: previous good value becomes the backup first. */
  save() {
    try {
      const prev = this.storage.getItem(SAVE_KEY);
      if (prev != null && parse(prev)) this.storage.setItem(BACKUP_KEY, prev);
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.state));
      return true;
    } catch { this.persistent = false; return false; }
  }

  reset() {
    this.state = defaultSave();
    try { this.storage.removeItem(SAVE_KEY); this.storage.removeItem(BACKUP_KEY); } catch { /* ignore */ }
    return this.state;
  }
}
