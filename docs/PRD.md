# Tilt — Product Requirements Document

| | |
|---|---|
| **Status** | Approved for build (v1.0 scope) |
| **Owner** | Pratham Nawal |
| **Last updated** | 2026-11-07 |
| **Related** | [GAME_DESIGN](GAME_DESIGN.md) · [TECH_DESIGN](TECH_DESIGN.md) · [ROADMAP](ROADMAP.md) · [DECISIONS](DECISIONS.md) |

## 1. One-liner
**Tilt your phone, roll the marble, reach the glow.** A 3D marble-maze that runs in any mobile or desktop
browser, works fully offline (PWA), and never runs out of levels.

## 2. Problem & opportunity
Casual players want a 2–5 minute, one-handed, no-account game they can open from a link. Most browser
marble-maze games are fixed level packs (finite), ship banner ads, or need a download. Our wedge:

* **Infinite, seeded content** — every level is generated from a seed (Revenue Rule 2: content engine).
* **Real tilt control** — gyroscope on phones; touch-stick / keyboard fallback everywhere else.
* **Offline-first PWA** — installable, no connectivity needed (Rule 6).
* **Fair monetization** — rewarded video only, never banners, never a content gate (Rule 1).

## 3. Target player
Primary: casual mobile-web players, 13+, playing alone in short breaks (commute, queue). Secondary:
desktop players who open a link (keyboard / mouse). Markets: global, with emphasis on emerging markets
→ low-end device performance and offline are non-negotiable.

## 4. Core mechanic (one verb + one noun)
**Roll marble.** Everything else (holes, ice, sticky tiles, coins, hints, daily) is a modifier on that one action.

## 5. Goals & non-goals
### Goals (v1.0)
1. Fun in the first 30 seconds with no tutorial text beyond one line.
2. Infinite deterministic levels with a smooth difficulty curve.
3. Daily Challenge + streak as the return mechanic.
4. 100% offline after first load; installable.
5. Runs at ≥ 55 fps on a mid-range phone; first load < 400 KB gzip JS.
6. Rewarded-ad + coin-economy plumbing complete (provider adapter; demo provider in repo).

### Non-goals (v1.0)
* Multiplayer, leaderboards, accounts, cloud save (needs backend; see Roadmap *Later*).
* Native store wrappers (Capacitor/TWA) — documented path, not built.
* Real ad-network SDK integration (needs publisher account + approval) — adapter is ready, see ADR-005.
* Skins / IAP storefront — cosmetic hooks only.

## 6. Requirements
Priority: **P0** must ship, **P1** should ship, **P2** nice.

### 6.1 Gameplay
| ID | Requirement | Pri |
|----|-------------|-----|
| G1 | Marble rolls under tilt acceleration with drag, wall collisions and restitution | P0 |
| G2 | Procedural maze per level index, deterministic from a seed, always solvable | P0 |
| G3 | Goal ring ends the level; timer; 1–3 stars from par time | P0 |
| G4 | Holes: marble falls → respawn at start (+2 s penalty) | P0 |
| G5 | Ice (low friction) and sticky (high friction) floor tiles from level 11/21 | P1 |
| G6 | 3 collectible coins per level | P1 |
| G7 | Daily Challenge: same maze for everyone that day; streak counter | P0 |
| G8 | Hint: shows the safe path for 4 s; costs coins | P1 |
| G9 | Skip level: costs coins or a rewarded ad | P1 |

### 6.2 Controls
| ID | Requirement | Pri |
|----|-------------|-----|
| C1 | Gyroscope tilt (DeviceOrientation) incl. iOS permission flow, recalibrate button | P0 |
| C2 | Touch virtual-stick fallback (drag anywhere) | P0 |
| C3 | Keyboard (arrows / WASD) | P0 |
| C4 | Sensitivity slider, deadzone, smoothing | P1 |
| C5 | Auto-pause on tab hidden; screen wake-lock while playing | P1 |

### 6.3 Economy & ads
| ID | Requirement | Pri |
|----|-------------|-----|
| E1 | Coins earned by pickups + level completion; spent on hints/skips | P0 |
| E2 | Rewarded video only (user-initiated): +coins, free hint, double level reward | P0 |
| E3 | Interstitial between levels only: ≥ 3 min into session, ≥ 3 min apart, every 4th level | P1 |
| E4 | **No banner ads. Ever.** No content is paywalled | P0 |
| E5 | Free player can always progress with zero ads (hints are optional) | P0 |

### 6.4 Platform
| ID | Requirement | Pri |
|----|-------------|-----|
| P1 | PWA: manifest, service worker, icons, offline | P0 |
| P2 | Versioned local save with backup + migration | P0 |
| P3 | Works in portrait mobile and landscape/desktop viewports | P0 |
| P4 | Settings: sound, haptics, controls, sensitivity, quality, assist mode, reset | P1 |
| P5 | Accessibility: reduced motion respected, ≥ 44 px targets, non-color cues for tile types, assist mode | P1 |

## 7. Success metrics
North Star: **Levels completed per daily active player.**

| Metric | Target (first 90 days live) |
|--------|-----------------------------|
| D1 retention | ≥ 30 % |
| D7 retention | ≥ 10 % |
| Median session | 3–6 min |
| Levels / DAU / day | ≥ 6 |
| Daily Challenge participation | ≥ 25 % of DAU |
| Rewarded-ad opt-in | ≥ 30 % of DAU |
| Crash/blank-screen rate | < 0.5 % |

Telemetry is privacy-first and **local-only in v1.0** (counters in the save file). See TECH_DESIGN §9.

## 8. Risks & mitigations
| Risk | L | I | Mitigation |
|------|---|---|-----------|
| iOS requires a user gesture to grant motion permission | H | H | Explicit "Enable tilt" button on first Play; touch fallback always available |
| Gyro axes/units differ across devices & orientation lock | M | H | Calibrate-on-start, recalibrate button, portrait-locked manifest, clamp/deadzone, manual test matrix |
| Low-end GPU can't hold 60 fps | M | H | Cap DPR, shadow toggle (Low quality), instancing, tiny geometry; perf budget in TEST_PLAN |
| Procedural mazes feel samey | M | M | World themes, braid factor curve, ice/sticky/holes layering, daily preset |
| Unwinnable levels | L | H | BFS solvability + autopilot-physics test across 300 seeds in CI |
| Ads policy / revenue uncertainty (web) | H | M | Provider adapter, mock default, ADR-005; do not depend on ad revenue for v1.0 success |
| Browsers evict localStorage | M | M | Backup key, graceful empty-state, no critical data loss (progress is cheap to rebuild) |
| Seasonal/trend trap (Rule 3) | L | M | Evergreen only; seasonal = cosmetic theme packs later |

## 9. Rules-of-thumb scorecard (indie-game-pm)
Demand 2 · Mechanic 3 · Monetization 3 · Content scalability 3 · Solo feasibility 2 · Offline 3 · Retention 2 → **18/21 GO**.
Weakest dimensions → addressed by Daily + streak (retention) and scope discipline (solo feasibility).

## 10. Release criteria (v1.0)
All P0 shipped, P1 ≥ 80 %, unit + e2e suites green, LAUNCH_CHECKLIST complete except items marked *external*.
