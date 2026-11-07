# Tilt — Technical Design

## 1. Stack
| Concern | Choice | Why |
|---------|--------|-----|
| Rendering | three.js (npm, bundled) | 3D marble + shadows; bundled so the PWA is offline without a CDN |
| Physics | Custom 2D circle-vs-wall solver | Marble maze is a 2D problem; deterministic, tiny, testable (ADR-001) |
| Build | esbuild (single script) | Fast, no framework, tiny output (ADR-002) |
| UI | Plain DOM overlays + CSS | Zero runtime cost; crisp text; accessible (ADR-003) |
| Persistence | localStorage, versioned + backup | No backend (ADR-004) |
| Offline | Service worker, cache-first shell | PWA |
| Tests | `node:test` (unit), Playwright (e2e) | |

## 2. Layout
```
src/
  core/            # PURE logic — no DOM, no three.js. Fully unit-tested in Node.
    rng.js         # string hash + mulberry32 seeded RNG
    maze.js        # grid, DFS carve, braid, BFS, path, farthest cell
    levels.js      # level index / daily date → params → generated level
    physics.js     # World: marble state + step(dt, tilt) → events
    autopilot.js   # PD path-follower (tests, hint demo, attract mode)
    scoring.js     # par / stars / coin rewards
    economy.js     # coin ledger rules (earn/spend/hint/skip)
    save.js        # versioned save, migrations, backup, storage adapter
  game/            # Browser-side systems
    renderer.js    # three.js scene for a level, per-frame sync from World
    input.js       # actions → tilt vector (gyro / touch / keyboard)
    audio.js       # WebAudio synth sfx + rolling loop
    ads.js         # provider adapter + policy (mock provider)
    fx.js          # shake (trauma), confetti, haptics
    game.js        # state machine + loop wiring everything
  ui/
    ui.js          # DOM overlays: menu, HUD, pause, win, settings
    styles.css
  main.js          # boot
public/            # index.html, manifest, sw template, icons
scripts/           # build.mjs, serve.mjs, make-icons.cjs
tests/             # unit/*.test.js, e2e/*.cjs
docs/
```
Rule: `core/` never imports from `game/` or `ui/`. This keeps the simulation testable headless and
leaves the door open to a Capacitor/native or server-validated-score future.

## 3. Simulation
`World` owns marble `{x,y,vx,vy}`, the `Level`, and event flags. `step(dt, tilt)` runs a **fixed 1/120 s
substep** (accumulator in `game.js`, max 5 substeps/frame to avoid spiral of death).

Per substep:
1. `a = tilt · MAX_ACCEL · cellAccelScale`.
2. `v += a·dt`; `v *= max(0, 1 − DRAG·dt·cellFriction)`; clamp |v| to MAX_SPEED.
3. `p += v·dt`.
4. Collide with wall rectangles from the cell(s) around the marble: closest point on AABB → push out
   along the normal, reflect the normal velocity by `−(1+e)`, emit `hit{impact}`.
5. Boundary walls are real walls (the maze outer border), so no special case.
6. Hole check → `fell`; goal check → `won`; coin check → `coin(i)`.

Walls are stored as AABBs in a per-cell bucket (`cellWalls[cy*w+cx]` → indices) so collision is O(few).
Tunnelling: max speed 7.5 u/s × 1/120 s = 0.0625 u/step ≪ wall half-thickness + radius → safe.

## 4. Procedural generation
1. `rng = mulberry32(hash(seed))`.
2. Iterative DFS carve on `w×h` grid → perfect maze (tree).
3. **Braid**: for a fraction of dead-ends, knock a wall to a neighbor → loops (alternate routes).
4. `start` = fixed corner; `goal` = BFS-farthest cell.
5. Floor patches (ice/sticky): random walks of 2–4 cells, never on start/goal.
6. Holes: sample candidate cells; accept only if BFS start→goal avoiding **all** holes still succeeds
   **and** the detour is ≤ 3× shortest length (keeps holes meaningful but fair).
7. Coins: dead-end / off-solution cells first.
8. Output is plain JSON-able data (`Level`), which makes saving seeds / sharing trivial.

Validation (unit tests, 300 seeds): reachable goal, no hole on start/goal/coin, determinism (same seed → deepEqual),
autopilot reaches the goal through the physics.

## 5. Rendering
* Orthogonal board geometry built once per level: base plate, floor tiles (instanced, per-type color),
  walls (InstancedMesh boxes), holes (dark discs + rim), goal (emissive torus + pulse light), coins.
* The **board group rotates** up to ±10° to visualize tilt (purely visual; physics uses the tilt vector).
* One directional light with a 1024² shadow map (disabled in Low quality) + hemisphere light.
* Camera: perspective FOV 38°, auto-fit so the whole board is visible for any aspect (portrait or landscape).
* DPR capped at 2 (1.5 on Low). Geometry is merged/instanced: < 40 draw calls.
* Disposal on level change (geometries/materials) to avoid leaks.

## 6. Input
Actions-not-keys (input-systems skill): `Input` exposes `getTilt()`, edge events `onPause`, `onRecalibrate`.
Sources are pluggable, the active one is the one that most recently produced non-zero input or the
user-selected mode.
* **Gyro**: `deviceorientation`; iOS 13+ requires `DeviceOrientationEvent.requestPermission()` from a user gesture.
  Calibration: first stable sample after level start (and on demand) becomes the neutral pose. Screen orientation
  angle (`screen.orientation.angle`) rotates the axes for landscape.
* **Touch**: pointer events on the canvas, virtual stick.
* **Keyboard**: key state + ramp.

## 7. Game state machine
`BOOT → MENU → (PLAYING ⇄ PAUSED) → WON → (PLAYING next | MENU)`; `FALLING` is a short sub-state inside PLAYING
(input ignored while the fall animation plays).
Tab hidden → PAUSED. Wake-lock requested on PLAYING.

## 8. Save schema (v1)
```jsonc
{
  "version": 1,
  "coins": 30,
  "level": 1,                 // next level to play (highest unlocked)
  "stars": { "1": 3 },        // best stars by level
  "best":  { "1": 12.4 },     // best time (s) by level
  "daily": { "last": "2026-11-07", "streak": 3, "bestStreak": 5, "done": ["2026-11-05", ...] },
  "settings": { "sound": true, "haptics": true, "controls": "auto", "sensitivity": 1, "quality": "high", "assist": false },
  "flags": { "tutorialSeen": false, "motionAsked": false },
  "stats": { "plays": 0, "clears": 0, "falls": 0, "playSec": 0, "adsWatched": 0, "hints": 0, "skips": 0 }
}
```
Write path: serialize → `tilt.save` (previous value copied to `tilt.save.bak` first). Read path: parse → migrate →
validate/clamp; on failure fall back to `.bak`, then defaults. Storage failure (private mode) → in-memory only.

## 9. Telemetry (v1.0: local-only)
Counters live in `stats`. A `track(event, props)` stub exists (no network) so a privacy-reviewed analytics
sink can be added without touching gameplay code. Events: `level_start`, `level_clear`, `fall`, `hint`,
`skip`, `ad_rewarded`, `ad_interstitial`, `daily_clear`, `install`.

## 10. Performance budget
| Item | Budget |
|------|--------|
| JS (gz) | < 400 KB (three.js tree-shaken ≈ 150–180 KB gz) |
| Total first load | < 600 KB |
| Frame (mid phone) | ≤ 16 ms, ≤ 40 draw calls |
| Cold start → interactive | < 2 s on 4G |
| Memory | < 150 MB |

## 11. Security & privacy
No network calls, no third-party scripts, no cookies, no PII. CSP in `index.html`: `default-src 'self'`
(+ `'unsafe-inline'` style only if needed). Ad provider, when real, is the only planned third-party and
will require a consent flow (documented in LAUNCH_CHECKLIST).
