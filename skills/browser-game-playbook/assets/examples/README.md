# Worked examples from the Tilt build (reference only — not wired into the starter)
| File | Shows |
|---|---|
| `physics.example.js` | fixed-step circle-vs-AABB marble physics with per-cell buckets, friction zones, hazards, events |
| `autopilot.example.js` | PD path follower + `simulate()` used as the solvability proof and hint trail |
| `input-gyro-touch-keyboard.example.js` | one tilt vector from gyro (iOS permission, deadzone, calibration, orientation), touch stick, keyboard |
| `human-sim.example.mjs` | degraded-controller simulation (reaction delay + tremor) for difficulty calibration |
| `explore-sim.example.mjs` | first-time-explorer (DFS, no map) cost vs shortest path → sets par/star thresholds |
Imports reference Tilt's file layout; adapt paths when copying.
