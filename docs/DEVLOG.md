# Dev Log
Newest first. One entry per working session / milestone: what changed, what was learned, what's next.

## 2026-11-07 — M3 + M4: full game, platform & quality
- Built the complete loop: menu with live attract-mode board, HUD, pause, level select, win screen (animated stars, share), settings, daily challenge + streak, hints, skips, coin economy, versioned save with backup/migration, ad policy with provider adapter, WebAudio synth (no assets), haptics, wake-lock, PWA (manifest, icons, offline SW), adaptive quality, reduced-motion.
- Wrote a Playwright e2e suite (23 tests) against the **production** build. It earned its keep — found 4 real bugs that unit tests could never see:
  1. an over-specific CSS rule made invisible HUD layers swallow touches (drag-to-roll was dead);
  2. a layer/component class-name collision dimmed the HUD;
  3. win-card content overflowed (grid track sizing);
  4. buttons overflowed at 320 px (found only after strengthening the test to check *children*, not just the card).
  Lesson: assert on the thing users see (children inside bounds), and always *look* at screenshots.
- Added `TILT_ADS=off` (ADR-008) after realising a fake "DEMO AD" shouldn't ship to real players.
- Measured: 145 KB gz, 24 draw calls, physics 1.8 µs/step, level gen 0.4 ms, no GPU leak across 60 loads.
- Honest status: **everything automatable is green; nothing has run on a real phone.** The gyro mapping is verified against synthetic events and the design math only. Device matrix is in TEST_PLAN §4.
- Next: real-device pass → retune tilt sensitivity, par/stars, quality threshold; then pick an ad provider & hosting.

## 2026-11-07 — M2: playable prototype
- Added esbuild pipeline (`npm run build` → `dist/`, hashed assets, generated service worker), static server, three.js renderer (instanced floors/walls, holes, goal glow, coins, confetti, hint trail, trauma camera shake), input layer (gyro with iOS permission + calibration, touch stick, keyboard) and `Run` (fixed-step loop binding sim ↔ view ↔ input).
- Verified in headless Chromium at iPhone-13 viewport: renders correctly; autopilot completes level 12 **in the browser** (11.8 s, 0 falls); gyro mapping matches the design math (+11° → 0.43, clamp, deadzone); **24 draw calls / 3.1k tris**; 61 fps on a *CPU* rasterizer at low quality.
- Bundle: **133 KB gz JS** (budget 400 KB).
- Gotchas: esbuild can't down-level destructuring for `safari14` → target is `safari15`+ (iOS 15+). Chromium now exposes `DeviceOrientationEvent.requestPermission` and returns `"prompt"` outside a gesture → we treat anything but `"granted"` as denied and fall back to touch.
- Software GL at DPR 3 + shadows runs ~5 fps → game clock clamps dt to 50 ms (slow motion rather than tunnelling). Real GPUs are far faster; e2e uses `?q=low` + DPR 1.
- Next: M3 — app shell: menu, HUD, save, economy, ads policy, daily, hints/skips.

## 2026-11-07 — M1: core engine (headless)
- Built `src/core`: seeded RNG, maze (DFS + braid + BFS), level generator (ice/sticky patches, fair holes, coins), circle-vs-AABB physics at fixed 1/120 s, PD autopilot, scoring.
- Retired the biggest risk early: **an autopilot drives the real physics through levels 1–120 and 30 daily seeds with zero failures**, and 300 generated seeds pass structural validity (solution avoids holes, coins valid, deterministic).
- Autopilot pace ≈ 0.45 s/cell, i.e. ≈0.8× par. Loosened star thresholds to par×1.6 / ×2.6 so 3★ is reachable by skilled humans; re-tune after real playtests.
- Learned: hole candidates must be rejected when detour > 3× shortest path, otherwise late levels become corridor-blockers.
- Next: M2 — three.js renderer, input (gyro/touch/keyboard), build pipeline, first playable page.

## 2026-11-07 — M0: planning
- Researched the awesome-gamedev-agent-skills catalog (three.js, input-systems, procedural-gen, game-feel, save-systems, prototype-fast) and applied the indie-game-pm scorecard: Tilt = 18/21 GO.
- Decided: custom 2D physics + three.js presentation (ADR-001), esbuild (ADR-002), DOM UI (ADR-003), adapter-based ads with demo provider (ADR-005).
- Next: M1 core engine, test-first (solvability across 300 seeds is the key risk to retire early).
