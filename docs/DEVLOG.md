# Dev Log
Newest first. One entry per working session / milestone: what changed, what was learned, what's next.

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
