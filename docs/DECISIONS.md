# Architecture Decision Records

Format: Context → Decision → Consequences. Newest at the bottom. Status: Accepted unless noted.

## ADR-001 — Custom 2D physics, rendered in 3D (2026-11-07)
**Context.** A marble maze is planar. A 3D physics engine (cannon/rapier) adds 100–300 KB, nondeterminism and tuning pain.
**Decision.** Write a small circle-vs-AABB solver with fixed timestep; use three.js only for presentation.
**Consequences.** + tiny, deterministic, unit-testable headless, easy to autopilot. − must hand-tune feel; no marble-marble or ramps (not needed).

## ADR-002 — esbuild + vanilla JS modules, no framework (2026-11-07)
**Context.** Game UI is a handful of overlays; bundle size matters on low-end devices.
**Decision.** esbuild bundles `src/main.js`; DOM built with small helpers.
**Consequences.** + fastest builds, smallest output. − manual DOM updates; acceptable at this size.

## ADR-003 — DOM overlays for UI, not canvas UI (2026-11-07)
**Decision.** HUD/menus are HTML/CSS over the canvas.
**Consequences.** + crisp text, free accessibility, safe-area insets, easy theming. − must avoid layout thrash during play (HUD updates are throttled, text-only).

## ADR-004 — localStorage saves with backup, no backend (2026-11-07)
**Decision.** Versioned JSON in localStorage (+ `.bak`). In-memory fallback.
**Consequences.** + zero infra, offline. − device-local; cloud sync is a *Later* item that needs a backend decision.

## ADR-005 — Ad provider adapter with demo provider; real SDK deferred (2026-11-07)
**Context.** Web ad networks (e.g. Google H5 Games Ads, portal SDKs) require publisher approval, domain verification
and consent management we cannot do from the repo. Shipping a fake "revenue" would be dishonest.
**Decision.** Implement the full ad *policy* (rewarded-only primary, interstitial pacing, no banners) behind
`AdProvider { init, isReady(kind), show(kind) → Promise<{rewarded}> }`. Default provider is a clearly-labelled demo overlay.
**Consequences.** + All gameplay/economy flows are testable and ready. − **No revenue until a real provider is wired in** (tracked in ROADMAP *Next* and LAUNCH_CHECKLIST as *external*).

## ADR-006 — Tilt is the primary control, with guaranteed fallbacks (2026-11-07)
**Decision.** Gyro by default on touch devices that report motion events; touch-stick everywhere else; user can switch any time.
A level must be completable with every control scheme (physics identical; only the source of `tilt` differs).

## ADR-007 — Pinned three.js 0.170 (2026-11-07)
**Context.** The skill catalog documents r186; the installable version in this environment is 0.170.
**Decision.** Use only stable core APIs (WebGLRenderer, InstancedMesh, MeshStandardMaterial, shadows) that are identical across both.
**Consequences.** Upgrade is a version bump; no use of `Timer`/WebGPU features.

## ADR-008 — Ads mode is a build-time switch; `off` is the soft-launch default (2026-11-07)
**Context.** Until a real ad SDK is integrated (ADR-005), a visible "DEMO AD" would be odd for real players.
**Decision.** `TILT_ADS=off npm run build` bakes `__ADS_MODE__='off'` (a `NullProvider`); `?ads=off|demo` overrides at runtime for testing.
With ads off the UI degrades honestly: no "watch ad" buttons, and 0-coin hint/skip show a short explanation instead.
**Consequences.** + A clean, honest soft launch; economy still works (coins earned by play). − No ad revenue (expected until a provider exists).

## ADR-009 — Adaptive graphics quality (2026-11-07)
**Decision.** `QualityGovernor` samples frame times after a 30-frame warm-up; if the 90-frame average exceeds 30 ms on High it switches to Low once,
persists the choice and informs the player. Skipped when quality is pinned via URL or already Low.
**Consequences.** + Protects low-end phones (the target market) without a settings visit. − One visible quality change on slow devices; thresholds need real-device tuning.

## ADR-010 — Physics is fixed-step and time-based; frame dt is clamped (2026-11-07)
**Decision.** Simulation runs at 120 Hz with ≤ 6 substeps per frame and `dt ≤ 50 ms`; overload yields slow-motion, never tunnelling.
**Consequences.** + Determinism & safety; − on very slow devices game time runs slower than wall time (the governor mitigates).
