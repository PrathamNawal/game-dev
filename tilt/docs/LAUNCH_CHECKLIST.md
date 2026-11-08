# Tilt — Launch Checklist
Based on the indie-game-pm pre-launch checklist, adapted for a web/PWA release.
✅ done · ⬜ todo · 🔗 external (needs an account / hardware / decision outside the repo)

## Mechanic
- ✅ Core loop completable in < 3 min (par ≈ 6–45 s per level)
- ⬜ 🔗 Fun after 5 min for a cold player (needs 3–5 playtesters)
- ✅ Smooth difficulty curve (parametrised; autopilot clears 1–120)
- ✅ Progress saves automatically (after every clear, hint, skip, setting)
- ✅ 100 % offline (service worker; e2e proves offline reload + play)

## Content
- ✅ Infinite levels (procedural, deterministic, validated across 300 seeds) — exceeds the 100-level launch / 500-level target
- ✅ No duplicate/unsolvable content (solvability proof)
- ⬜ Additional themes/hazards for variety beyond level ~100 (Roadmap *Next*)

## Monetization
- ✅ Zero banner ads (none exist in code)
- ✅ Rewarded video flow, interstitial pacing (every 4th clear, ≥3 min session, ≥3 min gap), all unit-tested
- ✅ Free player can progress without ads; coin economy balanced for ~1 hint/day free
- ✅ `TILT_ADS=off` build for an ad-free soft launch (ADR-008)
- ⬜ 🔗 **Real ad provider** (H5 Games Ads / portal SDK): publisher account, domain verification, `ads.txt`
- ⬜ 🔗 **Consent management (GDPR/CCPA)** — required before any real ad SDK loads
- ⬜ Ad-removal purchase (Roadmap *Next*)

## Store / distribution
- ✅ Web manifest, icons (192/512/maskable/apple-touch), theme colors, offline shell
- ⬜ 🔗 Hosting + HTTPS domain (required for device motion)
- ⬜ 🔗 Privacy policy URL (no data collected today; still required for ads/stores)
- ⬜ Real screenshots/promo art (docs/screenshots are CPU-rendered; re-shoot on a phone)
- ⬜ 🔗 Play Store listing via TWA/Capacitor wrapper (optional channel; Roadmap *Later*)
- ⬜ Title/description keywords: "marble maze", "tilt", "labyrinth", "offline"

## Technical
- ✅ Bundle 145 KB gz (< 400 KB), 24 draw calls, no GPU leak
- ✅ Adaptive Low quality for slow devices
- ✅ Safe-area insets, portrait + landscape + desktop layouts, 320 px audit
- ✅ Reduced-motion respected; focus management in dialogs; ≥44 px targets; axe-core clean on all screens
- ✅ Works from a sub-path or domain root (relative URLs; verified)
- ✅ CSP locked to same-origin (will need amending for a real ad SDK)
- ⬜ 🔗 Real-device matrix (docs/TEST_PLAN.md §4) — iOS Safari + Android Chrome minimum
- ⬜ Crash/error telemetry sink (Roadmap *Next*; today errors are only in the console)

## Go / no-go
Ship a **soft launch** (hosted PWA built with `TILT_ADS=off`) as soon as the
device matrix passes on one iPhone and one Android phone. Real ads + consent come *after* retention data (D1/D7) justifies them.
