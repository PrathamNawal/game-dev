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
- 31 unit tests, 23 end-to-end tests, CI workflow.
### Known limitations
- Not yet validated on real phones (see docs/TEST_PLAN.md §4). Demo ad provider only; no real ad network.

## [Unreleased]
### Added
- Planning documents: PRD, game design, tech design, ADRs, roadmap.
- Core engine: seeded RNG, maze + level generation (holes, ice, sticky, coins), marble physics, autopilot, scoring.
- 17 unit tests incl. solvability proof across 300 seeds.
- three.js renderer, input (gyro/touch/keyboard), run loop, esbuild build, PWA shell files (manifest, service worker, icon).
