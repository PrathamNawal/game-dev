# Pitfall catalog (each one cost real time on the Tilt build)

Format: **Symptom** → **Root cause** → **How to detect early** → **Fix**. Grouped by area. Table of contents:
1 CSS/UI · 2 Build & tooling · 3 Input & sensors · 4 Accessibility · 5 Performance · 6 Game design & calibration · 7 Monetization honesty · 8 PWA/hosting/deploy · 9 Process & tooling gotchas

---
## 1. CSS / UI

### 1.1 Invisible overlay swallows every touch  *(severity: game-breaking)*
- **Symptom:** Playwright `click` on the pause button times out with "`<div class="layer coach">` intercepts pointer events"; on a phone, drag-to-roll silently does nothing.
- **Cause:** layers are `position:absolute; inset:0; pointer-events:none`, but an earlier rule `#ui > * { pointer-events:auto }` has ID specificity and re-enabled them.
- **Detect:** the e2e test that clicks the HUD button *and* the canvas through the HUD (`solveRound` in the starter does real `mouse.click`s on the canvas).
- **Fix:** layer containers `pointer-events:none`; only buttons/cards/modals opt in (`.layer > * {pointer-events:auto}` then `.hud{pointer-events:none}` + `.hud button{auto}`). Never use ID selectors for pointer-events.

### 1.2 Layer/component class collision dims the screen
- **Symptom:** HUD looks washed out behind a big dark rounded rectangle.
- **Cause:** layer element got class `coach`; the inner bubble's `.coach{background;border;position}` also matched the layer.
- **Fix:** namespace layers `L-<name>` (`className = 'layer L-'+name`). Rule: container classes and component classes never share a name.

### 1.3 Grid card content overflows its card
- **Symptom:** value text and buttons cut off on the right of the win card.
- **Cause:** `display:grid` card has an implicit `auto` column sized to max-content; `width:min(100%,400px)` in a content-sized track is cyclic and resolves wide.
- **Fix:** `.modal{grid-template-columns:minmax(0,1fr)}`, `.card{width:100%;max-width:400px;min-width:0;grid-template-columns:minmax(0,1fr)}`.
- **Detect:** assert **every descendant's** `getBoundingClientRect()` is inside the card's rect at 320 px (the starter's layout test). Checking only the card passes while its children overflow.

### 1.4 Button rows overflow on 320 px phones
- **Fix:** `.row .btn{min-width:0;padding:0 8px;gap:6px;font-size:15px}`, icons 20 px, `white-space:nowrap` on labels; let an odd last grid button span the row (`:last-child:nth-child(odd){grid-column:1/-1}`).

### 1.5 Label wraps mid-text ("Skip" / "·")
- **Cause:** flex children shrink and the text node wraps at a space. **Fix:** `white-space:nowrap`; avoid decorative separators inside labels.

### 1.6 Screenshot looks broken (stars missing, modal shifted)
- **Cause:** shot taken mid CSS animation. **Fix:** wait ≥1.1 s in `shot()`; assert via DOM (`.star.on` count), use screenshots for human review only. Honour `prefers-reduced-motion` (animation-duration ≈ 0).

---
## 2. Build & tooling

### 2.1 esbuild: "Transforming destructuring to the configured target … is not supported yet"
- **Cause:** `target: ['es2020','safari14']` — esbuild refuses to down-level destructuring for Safari 14 (a known engine bug). **Fix:** `['es2020','safari15','chrome90']` (iOS 15+; also matches the DeviceOrientation permission era).

### 2.2 `node --test tests/unit/` → MODULE_NOT_FOUND
- **Cause:** Node 22 treats a directory arg as a module. **Fix:** `"test": "node --test \"tests/unit/*.test.js\""` (quoted glob).

### 2.3 Build script junk / gzip helpers
- Import `zlib` at the top; don't write `await import()` helper functions mid-file. Print `js KB (gz KB)` at the end of every build so budget drift is visible in every log.

### 2.4 Icons referenced in the manifest don't exist
- **Fix:** `npm run icons` (Playwright renders `icon.svg` → 192/512/maskable-512 (80 % safe zone)/apple-touch-180 (full bleed)); the scaffold script runs it. Maskable and apple-touch icons must be **full-bleed** (no transparent corners).

---
## 3. Input & sensors

### 3.1 iOS DeviceOrientation permission
- **Rules:** `DeviceOrientationEvent.requestPermission()` must run **synchronously inside a user gesture** — call it before the first `await` of the click handler. Anything but `'granted'` (including Chromium's `'prompt'`) → fall back to touch and show a short toast. Listen only after permission. Wait ~450 ms for a real event; if none → `'unsupported'`.
- **Always ship a fallback** (touch stick, keyboard) and a settings toggle (`auto | motion | touch`). A level must be completable with every scheme.
- **Test:** in e2e stub `DeviceOrientationEvent.requestPermission = async()=>'granted'` by default (quiet), override with `'denied'` for the fallback test, and dispatch synthetic `deviceorientation` events to assert the tilt vector (`+11°` → `(11−deadzone)/fullAngle`).

### 3.2 Neutral pose drift
- **Symptom/risk:** recalibrating on every respawn lets the "flat" pose creep toward extreme angles. **Fix:** recalibrate only on level start, resume, orientation change and the explicit button.

### 3.3 Orientation / landscape axes
- Map by `screen.orientation.angle` (0/90/180/270) and re-zero on `orientationchange`. Untested on hardware until a human tries it — say so.

### 3.4 Touch-action vs accessibility
- Don't disable zoom in the viewport meta (`user-scalable=no` fails axe). Put `touch-action:none` on the **canvas only**; `touch-action:manipulation` on the app root so menus can pinch-zoom but double-tap-zoom is off.

---
## 4. Accessibility (axe-core found all of these)
| axe rule | Cause | Fix |
|---|---|---|
| color-contrast | white on `#4a78f0` = 4.0:1 | darker accent `#3d63d8` (≈5.3:1) |
| aria-prohibited-attr | `aria-label` on a `div` with no role | `role="img"` + label; update label when state changes |
| region | no landmark | `<main id="app">` |
| meta-viewport | `user-scalable=no` | remove; see 3.4 |
Also: ≥44 px touch targets, focus the primary button when a dialog opens, `role="dialog" aria-modal`, `aria-live="off"` on fast timers, reduced-motion CSS.
**CSP interplay:** `script-src 'self'` blocks axe injection — use `bypassCSP:true` on that one context. Keep the strict CSP for everything else; assert zero console errors so violations fail tests.

---
## 5. Performance
- **Software GL (CI/headless) is ~5 fps at DPR 3 + shadows** → physics must be time-based, fixed-step (1/120), `dt` clamped (≤50 ms) and substeps capped (≤6): overload becomes slow-motion, never tunnelling/spiral-of-death.
- e2e uses Low quality + `deviceScaleFactor:1` + swiftshader flags; it's a *floor*, not a target. Never quote CPU-rasterizer fps as device fps.
- **Adaptive quality:** `QualityGovernor` (warm-up 30 frames, 90-frame window, >30 ms avg → Low once, toast). Skip when quality is pinned via URL/settings.
- **Budgets:** gz JS < 400 KB (three.js tree-shaken ≈ 130 KB), ≤40 draw calls (use InstancedMesh), cold start < 2 s. Measured on Tilt: 24 calls, 3.1 k tris, sim 1.8 µs/step.
- **GPU leaks:** dispose geometries/materials/textures on level change; e2e loads 60 levels and asserts `renderer.info.memory` stays bounded.
- Throttle HUD DOM writes (~12 Hz) and only touch `textContent` on change.

---
## 6. Game design & calibration
- **Holes/hazards that block the only route make levels unwinnable.** Place a hazard only if BFS start→goal still succeeds avoiding *all* hazards **and** the detour ≤ 3× shortest (else late levels become corridor-blockers).
- **Prove solvability with an autopilot through the real physics** (PD controller following the BFS path). 300 seeds structurally valid + 120 levels played headless. Print the autopilot's pace vs par to prove it truly drives.
- **Star/par thresholds from a perfect bot were too tight.** First-time explorers travel ≈1.5× the shortest route (+ falls). Calibrated: 3★ ≤ par×1.8, 2★ ≤ par×3.0. Re-tune from real play data.
- **Bots under-represent hazard danger** (they follow the safe route). Treat sims as a floor.
- **Anti-farming:** replays pay pickups but not the clear reward; daily pays once per date.
- Start the timer at the first deliberate input so players can orient.

---
## 7. Monetization honesty
- Never ship a fake "DEMO AD" to real players. Build switch `GAME_ADS=off|demo` (+ `?ads=` override). With ads off the UI must degrade honestly: no "watch ad" buttons; 0-coin hint/skip show a short explanation.
- Rewarded video only; interstitial every Nth clear, after a minimum session time and gap; never mid-gameplay; **no banners**; never gate content. Unit-test pacing with an injected clock.
- A real provider needs a publisher account, domain verification, consent (GDPR/CCPA) and a CSP amendment — list as 🔗 external, don't pretend.

---
## 8. PWA / hosting / deploy
- **Relative URLs everywhere** (`assets/…`, `start_url:"./index.html"`, SW `'./'`, register `'sw.js'`). Verify by serving `dist/` under `/games/x/` and running offline reload there.
- SW: cache-first precache of every built file, version = content hash, `skipWaiting` + `clients.claim`, ignore non-GET and cross-origin. Serve `sw.js` with `Cache-Control: no-cache`.
- **GitHub Pages:** `actions/configure-pages` with `enablement:true` fails with *"Resource not accessible by integration"* — the workflow token cannot create a Pages site. Only the repo owner can: Settings → Pages → Source → **GitHub Actions**. (The GitHub mobile app has no such setting — open the settings URL in a mobile browser with "Desktop site".) Then trigger `workflow_dispatch`. Pages environments may only deploy from the default branch → merge if refused.
- Use `[skip ci]` on commits that only document a manual step so you don't spawn a known-failing run.
- Device motion needs HTTPS (or localhost).

---
## 9. Process & tooling gotchas
- **`cd` persists** across Bash calls and changed the working dir mid-session → use absolute paths.
- The shell tool is `Bash` (capitalised); `bash` errors.
- Foreground `sleep` is blocked: poll with the API tools or a `Monitor` until-loop.
- The sandbox proxy may block `*.github.io`; verify deploys through the Actions API (job conclusions), not by curling the site.
- `gh` is for search only in some environments; use the GitHub MCP tools for Actions/PRs.
- Don't let the clone-and-copy workflow hide drift: after scaffolding, run the whole suite once before editing anything.
