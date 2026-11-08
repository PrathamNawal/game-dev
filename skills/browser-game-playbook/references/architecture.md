# Architecture & patterns (generalised from Tilt)

## Layout
```
src/core/    PURE logic. No DOM/three. rng · generation · rules/physics · scoring · economy · save
src/game/    renderer · input · run loop · audio · ads · perf · app shell (state machine)
src/ui/      DOM overlays (menu/HUD/pause/win/settings/levels/confirm/toast/ad) + CSS + inline SVG icons
public/      index.html (CSP, meta) · manifest · sw.js template · icons
scripts/     build.mjs · serve.mjs · make-icons.cjs · sim/*.mjs (calibration)
tests/       unit/*.test.js · e2e/run.cjs
docs/        PRD · ROADMAP · DECISIONS · TEST_PLAN · LAUNCH_CHECKLIST · DEVLOG
```
Rule: `core/` never imports `game/` or `ui/`. This is what makes the validity proof, autopilot and calibration sims possible.

## Seeded content (the content engine)
- `Rng(seed)`: string→hash (xmur3) → mulberry32. **Never** `Math.random()` in generation. Seeds: `game:level:N`, `game:daily:YYYY-MM-DD` (local date).
- Generate into plain JSON-able data; render separately. Validate before returning (reachable, hazards fair, items valid).
- Difficulty is a parameter table (`levelParams(n)`) documented in `GAME_DESIGN.md` — code and doc must agree.
- Daily: fixed preset difficulty, `prevDayKey()` DST-safe (noon), streak continues if `last === prevDay(today)`.

## Fixed-step simulation
```js
// accumulator in the run loop; dt clamped; substeps capped
acc += Math.min(dt, 0.05); let n = 0;
while (acc >= DT && n++ < 6) { world.step(DT, input); acc -= DT; }
if (n >= 6) acc = 0;     // drop backlog (slow-mo) instead of spiralling
```
Circle-vs-AABB walls with per-cell buckets, two relaxation passes for corners, restitution on the normal only, max speed ≪ wall thickness/DT (no tunnelling).

## Input layer (actions, not keys)
`Input.getTilt(dt)` returns one vector in [-1,1]²; sources: keyboard (ramped), touch stick (pointer events, 70 px full), gyro (permission flow, deadzone, low-pass, calibration, orientation mapping). Active source = what last produced input / user setting. Pointerdown ignores `[data-ui]` targets.

## Save
Versioned JSON → `migrate()` → `sanitize()` (clamp everything), backup key, in-memory fallback when storage throws. Persist on clear/hint/skip/setting + `pagehide`. Reset button behind a confirm.

## Economy
Coins earned by pickups + first-clear reward (+ daily); spent on hints/skips; free players always progress; ~1 free hint/day. Replays pay pickups only.

## Ads (adapter)
`AdProvider {init,isReady(kind),show(kind)→{completed}}`; `AdManager` policy with injected clock; `NullProvider` for `GAME_ADS=off`.

## UI kit (DOM overlays)
`UI` renders static template strings into `.layer.L-<name>`; behaviour via delegated `data-act` clicks to one action table — the UI never reaches into game state. Dialog = `role=dialog aria-modal`, primary button focused. `confirm()` returns a Promise; `showDemoAd()` is a demo only.

## Juice (game-feel skill)
Trauma-based camera shake (quadratic, decays), squash/pop on pickups, shrink-spin fall, confetti on win, stars stagger, haptics (`navigator.vibrate`, Android only), WebAudio synth SFX + rolling noise (no assets, offline, no licensing). Scale feedback to event importance; reduced-motion disables shake/confetti.

## three.js recipes
- One renderer, `loadLevel()` rebuilds a `content` group; track every created geometry/material/texture in `_own()` and dispose on rebuild.
- InstancedMesh for floor tiles/walls (≤40 draw calls). `setColorAt` for checker tints. Canvas textures for non-colour cues (ice stripes, sticky dots) so meaning isn't colour-only.
- Auto-fit camera: distance from FOV and aspect with HUD padding; lean the camera slightly for perspective.
- Shadows only on High; blob shadow on Low. `RoomEnvironment` + PMREM for cheap PBR reflections on High only.
- Pixel ratio cap 2 (High) / 1.25 (Low). `renderer.setAnimationLoop`.
- Prefer Canvas2D (see starter) when 3D isn't needed — the whole starter is 10 KB gz.

## Non-three starters
For puzzle/word/card games skip the renderer entirely: the DOM UI kit + `core/` is enough. For 2D action use Phaser (see `awesome-gamedev-agent-skills`) but keep `core/` rules pure so tests still run in Node.
