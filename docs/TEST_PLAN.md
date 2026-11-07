# Tilt — Test Plan & Results

Last run: 2026-11-07 · build 0.1.0

## 1. Strategy
| Layer | What it proves | Tooling | Where |
|---|---|---|---|
| Unit (pure core) | Determinism, solvability, physics invariants, economy/save rules, ad pacing | `node:test` | `tests/unit` |
| Simulation proof | An autopilot drives the **real physics** through generated levels | unit | `core.test.js` |
| E2E (browser) | Real production bundle: boot, play, UI flows, persistence, PWA offline, layout | Playwright + Chromium | `tests/e2e/run.cjs` |
| Manual device matrix | Gyro feel, haptics, audio unlock, thermals | humans | §4 |

## 2. Automated results
| Suite | Result |
|---|---|
| Unit | **31 / 31 pass** (≈ 1.3 s) |
| E2E | **23 / 23 pass** (≈ 2.5 min on CPU rasterizer) |
| Autopilot solvability | levels 1–120 + 30 daily seeds: 100 % solved; ≤ 15 falls in total across 120 levels |
| Structural validity | 300 seeds (250 journey + 50 daily): reachable goal, solution avoids holes, coins unique/valid, deterministic |

### Notable E2E coverage
boot & WebGL draw calls · keyboard play & timer start · autopilot win → stars/coins/save · reload persistence ·
paid hint (−15) · zero-coin hint → rewarded demo ad → free hint · daily clear / streak / no double payout ·
pause (button, Esc, restart, menu) · auto-pause on hidden tab · settings persist & reset-with-confirm ·
**gyro granted** (tilt vector, recalibrate) / **gyro denied** (fallback) · skip level (−40) · level select paging ·
pointer-drag stick · desktop layout (no horizontal scroll) · **320 px modal overflow audit** ·
ads-off mode (no ad UI; graceful 0-coin messaging) · GPU resource leak over 60 level loads · reduced-motion · **offline reload via service worker**.

### Bugs found by testing (and fixed)
| Found by | Bug | Fix |
|---|---|---|
| e2e click timeout | `#ui > *{pointer-events:auto}` made invisible HUD/coach layers swallow all touches → drag-to-roll impossible | removed rule |
| screenshot review | Layer class `coach` collided with inner `.coach` bubble style → dimmed screen | layers namespaced `L-*` |
| screenshot review | Win card content overflowed (content-sized grid track) | `minmax(0,1fr)` tracks |
| 320 px audit | Replay/Share/Menu buttons overflowed on very small phones | compact row buttons |
| build | esbuild can't down-level destructuring for `safari14` | target `safari15` |

## 3. Performance (measured)
| Metric | Budget | Measured |
|---|---|---|
| JS gzip | < 400 KB | **145 KB** |
| Draw calls / triangles | ≤ 40 | **24 / 3.1 k** |
| Physics cost | — | **1.8 µs/step** → 0.21 ms CPU per second of play |
| Level generation | — | **0.41 ms** avg |
| GPU memory over 60 level loads | no growth | bounded (leak test) |
| FPS | ≥ 55 on mid phone | 61 fps on a **CPU** rasterizer at Low/DPR 1; **not yet measured on real phones** |

Adaptive quality: if average frame time > 30 ms after warm-up, the game switches to Low once and tells the player.

## 4. Manual device matrix — **NOT YET RUN** (requires hardware)
Track results here; mark ✅/❌ with date + tester.

| Device / browser | Tilt feel | Permission flow | Audio unlock | Haptics | 60 fps | PWA install | Notes |
|---|---|---|---|---|---|---|---|
| iPhone (Safari 17+) | ⬜ | ⬜ (iOS prompt) | ⬜ | n/a (no vibrate API) | ⬜ | ⬜ Add to Home Screen | |
| iPhone (installed PWA) | ⬜ | ⬜ | ⬜ | n/a | ⬜ | — | |
| Android mid-range (Chrome) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| Android low-end 2 GB (Chrome) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (expect auto-Low) | ⬜ | |
| Android Firefox / Samsung Internet | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| iPad / Android tablet | ⬜ | ⬜ | ⬜ | | ⬜ | ⬜ | landscape axes |
| Desktop Chrome / Firefox / Safari | n/a | n/a | ⬜ | n/a | ⬜ | ⬜ | keyboard + mouse |

Things only a human can judge: is 22° full-tilt comfortable? is par-time too tight? does the marble feel weighty on ice?
Record tuning changes in DEVLOG and GAME_DESIGN.

## 5. Known gaps
* No real-device validation yet (§4). Gyro axes for landscape (90/180/270) are implemented from the spec but untested on hardware.
* E2E runs on a software GL renderer; visual regressions are caught by eyeballing `docs/screenshots`, not pixel diffs.
* Accessibility audited by construction (labels, focus, reduced motion, 44 px targets) and the 320 px overflow check — no screen-reader pass yet.
