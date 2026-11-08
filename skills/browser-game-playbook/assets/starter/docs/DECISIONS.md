# Architecture Decision Records
Format: Context → Decision → Consequences. Newest at the bottom.

## ADR-001 — esbuild + vanilla modules, DOM overlays for UI
Small bundle, fast builds, crisp/accessible text, safe-area support. Updates must be throttled during play.

## ADR-002 — Pure `core/` (no DOM) + presentation layers
Headless unit tests, deterministic seeds, simulation-based validity proofs, easy future wrappers.

## ADR-003 — localStorage save, versioned, with backup; in-memory fallback
Zero infra and offline. Cloud sync is a later backend decision.

## ADR-004 — Ad provider adapter; `GAME_ADS=off|demo` build switch
Real SDKs need accounts/consent we can't do from the repo. Ship off until a real provider exists; never ship a fake "DEMO AD" to real players.

## ADR-005 — Adaptive graphics quality (QualityGovernor)
Drop to Low once if average frame time > 30 ms after warm-up; tell the player.

## ADR-006 — Fixed-step, time-based simulation; clamp frame dt
Overload yields slow-motion, never tunnelling or divergence.

## ADR-007 — Pages deploy via Actions; Pages must be enabled once by the repo owner
The workflow token cannot create the Pages site ("Resource not accessible by integration").
