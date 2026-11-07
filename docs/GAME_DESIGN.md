# Tilt — Game Design & Tuning Reference

Source of truth for numbers. If code and this doc disagree, fix the one that is wrong and note it in the DEVLOG.

## Units
1 cell = 1.0 world unit. Board lies in the XZ plane (x = right, z = down-screen). Marble radius 0.28.
Wall thickness 0.12 (centered on cell edges).

## Controls → tilt vector
Input layer outputs `tilt = (x, y)` each in `[-1, 1]` (x right, y toward player/screen-down).

| Source | Mapping |
|--------|---------|
| Gyro | `gamma`→x, `beta`→y relative to calibration pose; ±22° = full tilt; 1.5° deadzone; low-pass α = 0.25 |
| Touch | virtual stick anchored at touch-down; 70 px drag = full tilt |
| Keyboard | arrows/WASD → ±1 with 0.12 s ramp |
Sensitivity multiplier (settings): 0.6–1.6, default 1.0.

## Physics (fixed step 1/120 s)
| Constant | Value | Notes |
|----------|-------|-------|
| `MAX_ACCEL` | 11 u/s² | at tilt = 1 |
| `DRAG` | 1.4 /s | `v *= 1 − DRAG·dt·friction` |
| `MAX_SPEED` | 7.5 u/s | assist mode 5.0 |
| `RESTITUTION` | 0.35 | wall bounce |
| Ice friction | ×0.12 | |
| Sticky friction | ×3.2, accel ×0.8 | |
| Hole radius | 0.30 | fall when `dist < 0.30` (hole "pulls" within 0.46) |
| Goal radius | 0.32 | win when `dist < 0.32` |
| Coin radius | 0.22 | pickup when `dist < 0.22 + 0.28` |

## Level generation (`levels.js`)
Seed = `hash("tilt:level:" + n)`; daily = `hash("tilt:daily:" + YYYY-MM-DD local)`.

| Param | Formula |
|-------|---------|
| width `w` | `clamp(4 + ⌊(n−1)/4⌋, 4, 9)` |
| height `h` | `clamp(round(w·1.45), 6, 13)` |
| holes | `n<3 ? 0 : min(⌊(n−2)/2⌋+1, 14)` (reduced if reachability would break) |
| ice patches | `n<11 ? 0 : min(⌊(n−8)/4⌋, 6)` |
| sticky patches | `n<21 ? 0 : min(⌊(n−18)/5⌋, 5)` |
| braid (loop) factor | `max(0.05, 0.35 − n·0.005)` |
| coins | 3 (placed in dead-ends / off-path cells first) |
| world (theme) | `⌊(n−1)/10⌋ mod 6` — palette only |
Daily preset: `w=7, h=10, holes=5, ice=2, sticky=1, braid=0.12`.

Start = bottom-left-ish corner cell; goal = farthest cell from start by BFS (guarantees a long path).

## Stars & par
`par = shortestPathLength · 0.55 s` (path length in cells). `effective = time + 2·falls`.
3★ ≤ par · 1.8, 2★ ≤ par · 3.0, else 1★.

**Calibration (simulated, 2026-11-07).** Route-knowing autopilot ≈ 0.8× par. A first-time *explorer* (DFS, no map) travels ≈ 1.5× the shortest path (p25 1.3 / p75 1.8) and takes ≈ 2.6 hole falls on hole-heavy levels (+2 s each) → a *perfectly controlled* first run lands ≈ 1.4–1.8× par; humans add control error. Thresholds therefore make 3★ reachable on a good first run, 2★ typical, 1★ slow. **Re-tune from real play data.**

## Economy
| Item | Value |
|------|-------|
| Starting coins | 30 |
| Pickup coin | +1 each (3 / level) |
| Level clear | +2 base, +1 per star |
| Daily clear | +10, +1 per streak day (cap +10) |
| Hint | −15 coins, shows path 4 s |
| Skip level | −40 coins, or watch rewarded ad |
| Rewarded ad | +15 coins, or free hint, or ×2 level reward |
| Interstitial | every 4th clear, ≥ 180 s session, ≥ 180 s since last ad |

A daily-playing free player earns roughly 20–30 coins/day → ≈ 1–2 hints/day without ever watching an ad
(meets the "1 hint per day free" guideline).

## Feel (juice) tiers
| Event | Tier | Feedback |
|-------|------|----------|
| Wall tap (speed < 2) | none | soft click only |
| Wall hit (speed ≥ 2) | small | click, 4 ms vibrate, 0.1 trauma |
| Coin | small | ping, pop scale, +1 float |
| Fall | medium | whoosh, marble shrink-spin, 25 ms vibrate |
| Win | large | arpeggio, confetti, marble sinks, stars stagger in |
Reduced-motion: no shake, no confetti, instant transitions.

## As-built tuning notes
* Autopilot (vmax 3.2 u/s) clears levels at ≈0.45 s/cell; par = 0.55 s/cell. Star thresholds are par×1.8 / ×3.0 — **to be re-tuned from real human play**.
* Replays pay coin pickups but not the clear reward (anti-farming). Daily pays once per day.
* Hint trail shows the BFS-safe path from the marble's *current* cell for 4 s.
* Attract mode (menu background) uses the same autopilot at a calm 2.4 u/s.
