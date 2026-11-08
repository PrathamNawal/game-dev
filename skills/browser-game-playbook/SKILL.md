---
name: browser-game-playbook
description: Build, test and ship a mobile/web browser game fast (three.js, Canvas, PWA, offline, GitHub Pages) without re-hitting the bugs that cost hours on the first build. Scaffolds a working starter (build, service worker, icons, save, ads policy, UI kit, e2e + axe harness, CI, Pages deploy, docs) and encodes a pitfall catalog plus a calibrate-before-you-ship process. Make sure to use this skill whenever the user wants to make, prototype, plan, test, polish or deploy any browser, HTML5, PWA, tilt/touch or casual mobile-web game — including "build me a game like Tilt", "game idea to playable", "deploy my game to GitHub Pages", "why can't I tap/drag on my game", "make it work offline", or "is my game accessible/fast" — even if they never say "playbook".
---

# Browser Game Playbook

Distilled from building *Tilt* (a 3D marble maze PWA: 31 unit + 24 e2e tests, 145 KB gz, deployed to Pages) in one
session. The goal is to **skip the discovery cost**: reuse the proven scaffold, and apply the checks that would have
caught each bug the moment it was introduced instead of after the fact.

> Related skills: `indie-game-pm` (what to build: scorecard, monetization, content rules) and
> `awesome-gamedev-agent-skills` (engine specifics: three.js, Phaser, input-systems, game-feel, save-systems).
> This skill is the **how to build and verify** layer on top of them.

## The workflow (do these in order — each step retires the next-biggest risk)

0. **Pick the game with data, not vibes.** Score the idea (`indie-game-pm`: 7 dimensions, ≥17/21 = GO). One verb + one noun,
   solo-playable, offline, infinite/seeded content, educational angle if possible. Write the PRD *before* code.
1. **Scaffold.** `bash <skill>/scripts/new-game.sh <dir> "<Name>" "<tagline>"` — copies `assets/starter/`, fills names, installs,
   generates icons, runs unit + build + e2e. If it isn't green out of the box, stop and fix that first. Everything below
   builds on a green baseline.
2. **Plan in files, not in your head.** Fill `docs/PRD.md`, `ROADMAP.md`, `DECISIONS.md` (ADRs). Commit + push. Maintain
   `DEVLOG.md`, `CHANGELOG.md`, `TEST_PLAN.md` at every milestone — docs written later are fiction.
3. **Core first, headless.** Replace `src/core/demo.js` with pure game rules (no DOM/rendering): seeded RNG, generation,
   physics/rules, scoring, economy. Then write the **validity proof** (below) *before* any rendering. See `references/architecture.md`.
4. **Playable prototype in a real browser.** Renderer + input + win/lose. Take screenshots with Playwright and **look at them**.
5. **Full loop.** Menu, HUD, pause, settings, save, economy, ads policy, daily/streak, hints/skips (`src/ui/ui.js` already has these screens).
6. **Platform & feel.** Audio (synth, no assets), haptics, PWA offline, reduced motion, adaptive quality.
7. **Verify like a skeptic.** e2e on the *production build* with real clicks, axe-core, 320 px overflow audit, offline reload,
   sub-path hosting, GPU-leak check, perf numbers, human-factors simulation. See `references/testing-and-calibration.md`.
8. **Deploy.** Pages workflow + the one owner-only toggle. See `references/deploy-and-launch.md`.
9. **Be honest about what's unverified** (real devices, real ads). Put it in `TEST_PLAN.md` and tell the user plainly.

Commit + push at each milestone; each commit message says what was *measured*, not just what changed.

## The five habits that prevent most bugs
1. **Pure core, thin shell.** Anything that can be tested in Node, is. A solvability/validity proof across hundreds of seeds
   (an autopilot playing through the real rules) retires the scariest content risk in minutes.
2. **Test the production bundle through the user's eyes.** Unit tests could never see our four worst bugs (touch-swallowing
   overlay, class collision, grid overflow, 320 px overflow). Real `page.mouse.click` through overlays, children-inside-bounds
   checks, axe, and *looking at screenshots* found them.
3. **A test that passes first time is a hypothesis.** When green came too easily, we checked the autopilot timing, printed
   stats, and read screenshots. Do the same: print a number that proves the test exercised the thing.
4. **Calibrate against a *first-time* player, not a perfect bot.** Perfect-route bots under-state difficulty and mis-set
   star/par thresholds. Simulate an explorer and a laggy/noisy controller (`references/testing-and-calibration.md`).
5. **Never fake the ending.** No "DEMO AD" for real players (`GAME_ADS=off`), no claiming device validation you didn't do,
   no claiming a deploy before you've seen the run succeed.

## Pitfalls — read `references/pitfalls.md` before writing code in these areas
Quick index (symptom → one-line prevention; the file has cause, detection and the exact fix):

| Area | Gotcha | Prevention |
|---|---|---|
| CSS overlays | Invisible HUD layer swallows all touches | Layers are `pointer-events:none`; only interactive children opt in. No ID selectors that out-rank it. e2e must `mouse.click` the canvas **through** the HUD. |
| CSS naming | Layer class `coach` collided with inner `.coach` → whole screen dimmed | Namespace layer classes `L-<name>`. |
| CSS grid | Card content overflowed (content-sized track) | `grid-template-columns:minmax(0,1fr)` on `.modal` and `.card`; assert every child's rect is inside the card at 320 px. |
| Buttons | Row of 3 buttons overflowed at 320 px | `.row .btn{min-width:0;padding:0 8px;font-size:15px}`; `white-space:nowrap` on labels. |
| Build | esbuild can't down-level destructuring for `safari14` | `target:['es2020','safari15','chrome90']`. |
| Node tests | `node --test tests/unit/` fails on Node 22 | Quote a glob: `node --test "tests/unit/*.test.js"`. |
| Motion sensors | iOS needs permission from a **user gesture**; Chromium returns `'prompt'` otherwise | Call `requestPermission()` synchronously in the click handler (before any `await`); treat non-`'granted'` as denied → touch fallback; stub `'granted'` in e2e. |
| Motion sensors | Re-zeroing neutral pose at respawn lets the neutral drift | Recalibrate only on level start / resume / rotation / explicit button. |
| a11y | `aria-label` on role-less div; no landmark; 4.0:1 contrast; zoom disabled | `role="img"` + label, `<main>`, ≥4.5:1, don't block zoom (use `touch-action:none` on the **canvas only**). Run axe in e2e. |
| a11y/CSP | axe injection blocked by CSP | `bypassCSP:true` **only** on the audit context. CSP violations otherwise surface as console errors — assert zero. |
| Screenshots | Captured mid-animation, looked broken | Wait ≥1.1 s before shooting; assert on DOM, use shots for human review. |
| Perf | Software GL ran ~5 fps → "slow-motion" game clock | e2e at Low quality + DPR 1; clamp frame dt; fixed-step sim; adaptive quality governor. |
| Difficulty | Stars set from a perfect bot were unreachable | Simulate a first-time explorer; target 3★ = good first run, 2★ typical. |
| Ads | Fake demo ad would ship to players | `GAME_ADS=off` build switch; UI degrades honestly (no ad buttons, clear messages). |
| PWA | Manifest listed PNG icons that didn't exist | `npm run icons` (Playwright renders SVG→PNG incl. maskable + apple-touch); e2e covers offline reload. |
| Hosting | Absolute URLs break on Pages sub-paths | All URLs relative; SW scope `./`; verify under `/games/x/`. |
| Pages | Workflow token can't create the Pages site | Owner enables Settings→Pages→Source: **GitHub Actions** once (mobile app can't — use browser "Desktop site"), then `workflow_dispatch`. Default-branch/environment rules may require merging. |
| Shell | `cd` persisted so relative paths broke | Use absolute paths; the tool name is `Bash`. |
| Wait loops | Foreground `sleep` is blocked | Poll via the API tools or a `Monitor` until-loop; don't chain sleeps. |

## Deliverables checklist (what "done" means)
- [ ] `npm test` green (validity proof included) · [ ] `npm run build` within budget (gz JS < 400 KB) · [ ] `npm run e2e` green (real clicks, axe, 320 px, offline)
- [ ] Screenshots reviewed by a human-readable eye (you *looked*) · [ ] perf numbers recorded in `TEST_PLAN.md`
- [ ] Docs current: PRD, ROADMAP, DECISIONS, TEST_PLAN, LAUNCH_CHECKLIST, DEVLOG, CHANGELOG
- [ ] Deployed via Actions with ads off; live URL given; **real-device matrix listed as not run** unless the user ran it
- [ ] Final message: what's verified, what isn't, the single next step for the user

## Bundled resources
- `assets/starter/` — the runnable scaffold (see its README). Run via `scripts/new-game.sh`.
- `references/pitfalls.md` — full catalog: symptom, root cause, detection, fix, for every issue hit.
- `references/architecture.md` — module layout and patterns (seeded gen, fixed-step physics, input layer, save, economy, ads, UI kit, juice, three.js recipes).
- `references/testing-and-calibration.md` — unit/e2e/axe/perf/leak recipes and the human-factors simulation method.
- `references/deploy-and-launch.md` — Pages/Actions, sub-path, PWA, ads-off, launch checklist and honest-status template.
