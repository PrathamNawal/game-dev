# game-dev

A monorepo for all the games we build. Each game lives in its own top-level folder with its own
code, docs, tests and tooling; nothing is shared implicitly between games.

## Games
| Folder | Game | Description |
|---|---|---|
| [`tilt/`](tilt/) | **Tilt** | 3D marble maze for mobile & web (three.js PWA) |

## Shared
* [`skills/`](skills/) — reusable Claude skills (e.g. the browser-game playbook) that apply across games.
* `.github/workflows/` — CI/deploy, scoped per game via `working-directory` and path filters.

## Adding a new game
1. Create a new folder at the repo root: `<game-name>/` (lowercase, kebab-case).
2. Keep everything for that game inside it (`package.json`, `src/`, `docs/`, `tests/`, its own `README.md`).
3. Add a row to the table above.
4. Add CI for it: copy `.github/workflows/ci.yml`, set `working-directory`, `cache-dependency-path` and the `paths:` filter to the new folder.
