# Testing & calibration recipes

## 1. Unit tests (pure core)
- **Determinism:** same seed → `deepEqual` level. **Validity:** for N≥200 seeds assert structure (reachable goal, no hazard on start/goal/solution, items unique/valid, counts ≤ requested).
- **Solvability proof:** an autopilot plays N levels through the *real* physics headless; assert 100 % solved and few falls. Print pace vs par for a few levels (`scripts/sim`) — it proves the sim actually drove, and gives star-threshold data.
- **Invariants:** marble never leaves board under constant tilt in 5 directions × 20 s; speed capped; no tilt → at rest; friction zones keep/lose speed relative to normal; coins collected once; goal ends level.
- **Save:** roundtrip, corrupt-main→backup→defaults, v0 migration, newer-version refusal, hostile values clamped, throwing storage → memory.
- **Economy:** first clear pays, replay pays pickups only, daily streak continue/reset/no double claim, month/leap boundaries for `prevDayKey`.
- **Ads:** injected clock; every-Nth + min session + min gap; rewarded pays only on completion; `off` inert; provider throw never blocks.
- **Perf governor:** downgrade only on sustained slowness, ignore warm-up and tab-switch spikes, decides once.

## 2. E2E on the production build (Playwright + Chromium)
Setup: `npm run build` then the runner starts `scripts/serve.mjs`. Flags `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`; mobile emulation `devices['iPhone 13']` with `deviceScaleFactor:1`; `?debug&ads=off&q=low` query; collect `pageerror` + `console.error` per page and assert zero (CSP violations show here).

Must-have cases (all in the starter): boot · **real click through the HUD** · win flow saves progress · reload persistence · pause (+ hidden-tab auto-pause) · settings persist · ads-off has no ad UI · **320 px children-inside-card audit** · **axe-core on every screen** · **offline reload via service worker**.
Game-specific additions from Tilt: keyboard moves marble & starts timer · gyro granted/denied/recalibrate (synthetic `deviceorientation` events from an init-script interval) · paid hint (−coins, path drawn) · zero-coin hint → rewarded ad → free hint · daily clear/streak/no double payout · skip · level-select paging · pointer-drag stick · desktop no-horizontal-scroll · reduced motion · **GPU leak**:
```js
for (let n = 1; n <= 60; n++) await page.evaluate(n => window.__tilt.beginJourney(n), n);   // via the real app path
// sample renderer.gl.info.memory.{geometries,textures} at 20/40/60 → must not grow
```
Drive the game with an **autopilot query param** (`?auto`) so e2e can win levels without brittle coordinates; expose `window.__game` only behind `?debug`.

## 3. axe-core
```js
const ctx = await browser.newContext({ ...dev, bypassCSP: true });          // ONLY for injecting axe
await page.addScriptTag({ content: fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8') });
const v = await page.evaluate(async () => (await axe.run(document,{runOnly:['wcag2a','wcag2aa','best-practice']})).violations);
```
Audit menu, settings, levels, HUD, win (and pause/ad/confirm if you changed them). Zero violations or the test fails.

## 4. Screenshots are for *looking*
Run `npm run e2e -- --shots` and open the PNGs. Check: nothing cut off, stars/animations finished (wait 1.1 s), toasts not covering the board, HUD legible. Commit the good ones to `docs/screenshots` for the README.

## 5. Performance numbers to record in TEST_PLAN
gz JS · draw calls/triangles (`renderer.info.render`) · sim µs/step (Node benchmark of 300 k steps) · level-gen ms · main-thread JS per frame (`run.update` ×600 in page) · GPU memory over 60 loads. State clearly that CPU-rasterizer fps is a floor and real-device fps is unmeasured.

## 6. Human-factors calibration (before choosing par/stars/difficulty)
1. **Route-knowing autopilot** → baseline pace (≈0.8× par on Tilt).
2. **Degraded controllers** (reaction delay 60/150/250 ms, AR(1) tremor 0.1/0.3/0.5, slower vmax): solved %, falls/level, time÷par, avg stars. See `assets/examples/human-sim.example.mjs`.
3. **First-time explorer** (DFS with random branch order, no map; hazard falls add penalty): cells travelled ÷ shortest path (Tilt: p25 1.3 / median 1.6 / p75 1.8; ≈2.6 hazard falls on hazard-heavy levels). See `explore-sim.example.mjs`.
4. Set thresholds so **3★ = a good first run (≈1.8× par)**, 2★ typical (≈3×), 1★ slow. Document the calibration in `GAME_DESIGN.md` and flag "re-tune from real play data".
5. Remember bots follow the safe route, so they under-state hazard danger. Never present sim results as human results.

## 7. The skeptic's checklist when everything is green
- Did the test print/assert a *number* proving it exercised the feature (win time, coins, hint dots count)?
- Did you open the screenshots? Did you check at 320 px and desktop?
- Did you test the failure path (permission denied, storage blocked, no ads, offline)?
- Is anything marked ✅ that only ran on a software renderer or synthetic events? Say so.
