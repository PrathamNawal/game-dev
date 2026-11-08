# Deploy & launch

## GitHub Pages via Actions (what worked)
`.github/workflows/pages.yml` (in the starter): checkout → setup-node 22 → `npm ci` → `npm test` → `GAME_ADS=off npm run build` → gz budget check → `configure-pages@v5` → `upload-pages-artifact@v3 (path: dist)` → separate `deploy` job with `environment: github-pages` + `deploy-pages@v4`. Permissions: `contents: read, pages: write, id-token: write`. Triggers: push to `main`/`master` (+ your feature branch) and `workflow_dispatch`.

**One-time, owner-only step:** Settings → Pages → *Build and deployment → Source: **GitHub Actions***. The workflow token cannot do this (`Create Pages site failed: Resource not accessible by integration`), and no repo-scoped API tool can either. Don't put `enablement: true` in the workflow — it can't succeed and just produces a confusing failure.
- On a phone: the GitHub app has no Pages settings; open `https://github.com/<owner>/<repo>/settings/pages` in a mobile browser and choose **Desktop site**.
- Then trigger the run (`workflow_dispatch` on the branch — via the Actions API tool or the Actions tab) and read the **job conclusions** (build ✅ configure-pages ✅ upload ✅ deploy ✅). The sandbox may block `*.github.io`, so job conclusions are your evidence; tell the user you couldn't load the page yourself.
- If the environment rejects the branch ("not allowed to deploy"), Pages only deploys from the default branch → open a PR/merge to `main`.
- Live URL: `https://<owner>.github.io/<repo>/`. Allow 1–2 minutes of CDN lag.
- Use `[skip ci]` for docs-only commits that would otherwise start a run you know will fail.

## Sub-path hosting check (do once)
```bash
mkdir -p /tmp/site/games && cp -r dist /tmp/site/games/x && (cd /tmp/site && python3 -m http.server 4190 &)
# Playwright: load /games/x/, assert SW scope, manifest icons 200, offline reload works, zero 4xx.
```

## Ads strategy
Soft launch with `GAME_ADS=off`. Add a real provider (portal SDK/H5 Games Ads) only after: publisher account, domain verification, `ads.txt`, consent management (GDPR/CCPA), CSP amended, retention data (D1/D7) justifies it. Keep the adapter; swap the provider.

## Launch checklist
Copy `docs/LAUNCH_CHECKLIST.md` from the starter. Items marked 🔗 need accounts/hardware/decisions outside the repo — list them, don't fake them.

## Honest status template (final message)
```
Built: <what> — unit N/N, e2e M/M, axe 0, <size> KB gz, deployed via Actions (run <id> ✅).
Verified on: <software renderer / synthetic sensors / CI runners>.
NOT verified: real iPhone/Android feel, real ads, <anything else>.
Your one next step: <e.g., open <URL> on your phone and tell me how tilt feels>.
```

## Post-launch tuning loop
Collect: tilt/control feel, smoothness, first-level difficulty, where players stall (local telemetry counters → privacy-reviewed sink later). Re-run `scripts/sim` after any physics/level/scoring change and update `GAME_DESIGN.md` + `DEVLOG.md`.
