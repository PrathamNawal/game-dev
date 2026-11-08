# __NAME__
__TAGLINE__

```bash
npm install
npm run dev            # build (dev) + serve on http://localhost:8080
npm test               # unit tests
npm run build && npm run e2e   # browser tests against the production build (needs playwright + Chromium)
GAME_ADS=off npm run build     # ad-free build (recommended until a real provider is integrated)
```
Debug URLs: `?debug` (exposes `window.__game`) · `?ads=off|demo`.

Docs: [PRD](docs/PRD.md) · [Roadmap](docs/ROADMAP.md) · [Decisions](docs/DECISIONS.md) · [Test plan](docs/TEST_PLAN.md) · [Launch checklist](docs/LAUNCH_CHECKLIST.md) · [Dev log](docs/DEVLOG.md)

**Deploy:** push to `main` → `.github/workflows/pages.yml`. One-time: repo Settings → Pages → Source: GitHub Actions (owner only; use "Desktop site" on a phone).
