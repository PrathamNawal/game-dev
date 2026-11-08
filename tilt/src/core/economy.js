// Coin ledger + progression rules. Operates on the save `state` object in place. Pure.
import { prevDayKey } from './levels.js';
import { clearReward } from './scoring.js';

export const COST = { hint: 15, skip: 40 };
export const REWARD = { rewardedAd: 15 };

export const canAfford = (state, cost) => state.coins >= cost;

export function earn(state, n) { state.coins = Math.min(10_000_000, state.coins + Math.max(0, Math.floor(n))); return state.coins; }

export function spend(state, cost) {
  if (!canAfford(state, cost)) return false;
  state.coins -= cost;
  return true;
}

/** Record a journey-level clear. Returns {reward, pickups, total, newBest, newStars, unlockedNext}. */
export function completeLevel(state, { n, time, falls, stars, pickups }) {
  const key = String(n);
  const reward = clearReward({ stars, kind: 'journey' });
  const prevStars = state.stars[key] || 0;
  const prevBest = state.best[key];
  const newBest = prevBest == null || time < prevBest;
  if (stars > prevStars) state.stars[key] = stars;
  if (newBest) state.best[key] = Math.round(time * 100) / 100;
  const unlockedNext = n >= state.level;
  if (unlockedNext) state.level = n + 1;
  // Replays pay pickups but not the clear reward again (prevents coin farming of level 1).
  const firstClear = prevStars === 0;
  const paid = firstClear ? reward : 0;
  earn(state, paid + pickups);
  state.stats.clears++; state.stats.falls += falls;
  return { reward: paid, pickups, total: paid + pickups, newBest, newStars: stars > prevStars, unlockedNext, firstClear };
}

/** Record a daily clear; handles streak continuation / reset. */
export function completeDaily(state, { key, time, falls, stars, pickups }) {
  const d = state.daily;
  if (d.last === key) return { already: true, reward: 0, pickups: 0, total: 0, streak: d.streak, stars };
  d.streak = d.last === prevDayKey(key) ? d.streak + 1 : 1;
  d.bestStreak = Math.max(d.bestStreak, d.streak);
  d.last = key;
  d.done = [...d.done, key].slice(-60);
  const reward = clearReward({ stars, kind: 'daily', streak: d.streak });
  earn(state, reward + pickups);
  state.stats.clears++; state.stats.dailyClears++; state.stats.falls += falls;
  return { already: false, reward, pickups, total: reward + pickups, streak: d.streak, stars };
}

/** True when the streak is still alive today (cleared yesterday or today). */
export function streakAlive(state, todayKey) {
  const d = state.daily;
  return d.last === todayKey || d.last === prevDayKey(todayKey);
}

/** Skip the given journey level (unlocks the next, no stars). */
export function skipLevel(state, n) {
  if (n >= state.level) state.level = n + 1;
  state.stats.skips++;
}
