# Changelog
All notable changes. Format: [Keep a Changelog](https://keepachangelog.com), semver.

## [0.1.0] — 2026-11-07 (first complete build)
### Added
- Complete game loop: menu (live attract mode), HUD, pause, level select, win screen with stars & share, settings.
- Daily Challenge with streaks; hints (coins or rewarded ad); skips; coin economy.
- Versioned local save with backup and migration; works when storage is blocked.
- Ad policy (rewarded-first, paced interstitials, **no banners**) behind a provider adapter; `TILT_ADS=off` build.
- WebAudio synthesized sound, haptics, screen wake-lock, reduced-motion support, adaptive graphics quality.
- PWA: manifest, PNG/maskable icons, offline service worker.
- 31 unit tests, 24 end-to-end tests (incl. axe-core accessibility audit), CI workflow, difficulty-calibration simulations (`npm run sim`).
### Changed (late 0.1.0)
- Star thresholds recalibrated to par×1.8 / ×3.0 from a first-time-explorer simulation.
- Accessibility fixes from axe-core; pinch-zoom allowed outside the game canvas.
- Tilt neutral is no longer re-zeroed on respawn.
### Known limitations
- Not yet validated on real phones (see docs/TEST_PLAN.md §4). Demo ad provider only; no real ad network.

## [Unreleased]
### Added
- Planning documents: PRD, game design, tech design, ADRs, roadmap.
- Core engine: seeded RNG, maze + level generation (holes, ice, sticky, coins), marble physics, autopilot, scoring.
- 17 unit tests incl. solvability proof across 300 seeds.
- three.js renderer, input (gyro/touch/keyboard), run loop, esbuild build, PWA shell files (manifest, service worker, icon).
