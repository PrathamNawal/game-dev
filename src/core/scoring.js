// Par time, stars and coin rewards. Pure functions; numbers live in docs/GAME_DESIGN.md.
export const PAR_SEC_PER_CELL = 0.55;
export const FALL_PENALTY_SEC = 2;

export const parTime = pathLen => Math.max(6, pathLen * PAR_SEC_PER_CELL);

/** effective seconds = time + penalty per fall */
export const effectiveTime = (time, falls) => time + falls * FALL_PENALTY_SEC;

/** 3 stars: <= par*1.6 ; 2 stars: <= par*2.6 ; else 1 */
export function starsFor(time, falls, pathLen) {
  const par = parTime(pathLen);
  const t = effectiveTime(time, falls);
  if (t <= par * 1.6) return 3;
  if (t <= par * 2.6) return 2;
  return 1;
}

/** Coins awarded for clearing (pickups are counted separately as they are collected). */
export function clearReward({ stars, kind, streak = 0 }) {
  if (kind === 'daily') return 10 + Math.min(10, Math.max(0, streak));
  return 2 + stars;
}
