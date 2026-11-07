# Tilt — Roadmap & Status

Legend: ✅ done · 🟡 in progress · ⬜ planned · 🚫 explicitly not building

## Milestones (v1.0)
| # | Milestone | Exit criteria | Status |
|---|-----------|---------------|--------|
| M0 | Plan & docs | PRD, design, tech design, ADRs, roadmap committed | ✅ |
| M1 | Core engine (headless) | rng, maze, levels, physics, autopilot + unit tests green (300 seeds solvable) | ✅ |
| M2 | Playable prototype | three.js board + marble, keyboard/touch/gyro, win/fall in browser | ✅ |
| M3 | Full game loop | menu, HUD, levels, daily, stars, coins, hints, skips, save | ✅ |
| M4 | Feel & platform | audio, haptics, juice, PWA/offline, settings, a11y | ✅ |
| M5 | Quality & release | e2e on mobile viewports, perf pass, docs, launch checklist | 🟡 automated ✅ · real-device matrix ⬜ (needs hardware) |

## Now (v1.0)
Everything in PRD §6 P0/P1.

## Next (v1.1 – v1.3), ordered by expected impact
0. **Real-device validation** (iOS Safari + Android Chrome) — tune tilt feel/par from real play. *Blocks soft launch.*
1. **Real rewarded-ad provider** (portal/H5 SDK) + consent banner. *External dependency: publisher account.*
2. Share card (screenshot of stars/time + deep link to the Daily seed).
2b. Android **Back** button → pause/menu (History API) instead of leaving the app.
3. Ad-removal purchase ($1.99–$2.99) via Payment Request / store wrapper.
4. Themes/skins (cosmetic, purely visual) — seasonal themes live here, never as a standalone app (Rule 3).
5. Privacy-reviewed analytics sink.

## Later
* TWA/Capacitor wrapper for Play Store (Rule: portfolio presence), 2nd game cross-promo ("More games").
* Cloud save + friends' daily leaderboard (needs backend decision).
* New hazard types: moving gates, magnets, teleporters.
* Level editor + seed sharing.

## 🚫 Not building (and why)
* Banner ads — lower eCPM and drive 1★ reviews (Rule 1).
* Content gates/energy timers — hurt ratings (IAP rules).
* Story mode / multi-game bundle — breadth before depth (Anti-pattern 6).
* Real-time multiplayer — needs a group/backend; solo-first (Rule 7).

## Changelog
See [CHANGELOG.md](../CHANGELOG.md). Daily engineering log: [DEVLOG.md](DEVLOG.md).
