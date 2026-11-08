# __NAME__ — Product Requirements Document
| | |
|---|---|
| **Status** | Draft |
| **Owner** | __OWNER__ |
| **Last updated** | __DATE__ |

## 1. One-liner
__TAGLINE__

## 2. Core mechanic (one verb + one noun)
**<Verb> <noun>.** — If it takes three sentences to describe, simplify. Everything else is a modifier on this action.

## 3. Target player & context
Who, where, how long per session (aim 2–5 min), one-handed? Offline needed? Markets / low-end devices?

## 4. Goals / non-goals (v1.0)
**Goals:** …  **Non-goals:** … (be explicit — multiplayer/accounts/native wrappers/real ad SDK are usual non-goals)

## 5. Requirements (P0 must · P1 should · P2 nice)
| ID | Requirement | Pri |
|----|-------------|-----|
| G1 | Core loop playable end-to-end | P0 |
| G2 | Infinite/seeded content, validated solvable/valid | P0 |
| P1 | PWA offline (manifest + service worker + PNG icons) | P0 |
| P2 | Versioned save with backup + migration | P0 |
| C1 | Controls with a guaranteed fallback on every device | P0 |
| E1 | Rewarded-only ads, no banners, never gate content | P0 |
| A1 | axe-core clean; ≥44 px targets; reduced motion | P1 |

## 6. Success metrics
North Star: … · D1 ≥ 30 % · D7 ≥ 10 % · median session 3–6 min · crash rate < 0.5 %

## 7. Risks & mitigations
| Risk | L | I | Mitigation |
|---|---|---|---|
| Device-sensor/permission differences (iOS) | H | H | Explicit button on a user gesture + always-available fallback |
| Low-end GPU | M | H | Low quality mode + adaptive governor + perf budget |
| Unwinnable/invalid generated content | L | H | Solvability proof in unit tests across hundreds of seeds |
| Ad policy / revenue uncertainty | H | M | Provider adapter, `GAME_ADS=off` soft launch |

## 8. Scorecard (indie-game-pm) — Demand · Mechanic · Monetization · Content scalability · Solo feasibility · Offline · Retention (each 1–3; ≥17 GO)
