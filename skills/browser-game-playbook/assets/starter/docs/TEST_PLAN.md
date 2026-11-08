# __NAME__ — Test Plan & Results
## Strategy
| Layer | Proves | Tool |
|---|---|---|
| Unit (pure core) | determinism, validity/solvability, rules, save, economy, ads pacing | `node:test` |
| Simulation proof | an autopilot plays generated content through the real rules | unit |
| E2E (production build) | boot, real clicks through overlays, flows, persistence, offline, layout, axe | Playwright |
| Manual device matrix | feel, sensors, audio unlock, thermals | humans |

## Results (fill in each run)
| Suite | Result |
|---|---|
| Unit | |
| E2E | |
| axe-core | |
| Bundle gzip | budget < 400 KB |

## Bugs found by testing
| Found by | Bug | Fix |
|---|---|---|

## Manual device matrix — NOT YET RUN
| Device / browser | Controls feel | Permission flow | Audio unlock | Haptics | Smooth | PWA install |
|---|---|---|---|---|---|---|
| iPhone Safari | ⬜ | ⬜ | ⬜ | n/a | ⬜ | ⬜ |
| Android Chrome mid-range | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Android low-end | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Desktop | n/a | n/a | ⬜ | n/a | ⬜ | ⬜ |
