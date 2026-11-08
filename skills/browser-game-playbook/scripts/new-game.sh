#!/usr/bin/env bash
# Scaffold a new browser game from the starter and prove it works (unit + build + optional e2e).
# Usage: new-game.sh <target-dir> "<Game Name>" "<tagline>" [owner]
set -euo pipefail
DIR="${1:?target dir}"; NAME="${2:?game name}"; TAG="${3:-Play in your browser.}"; OWNER="${4:-$(git config user.name 2>/dev/null || echo owner)}"
SRC="$(cd "$(dirname "$0")/../assets/starter" && pwd)"
SLUG="$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')"
UPPER="$(echo "$NAME" | tr '[:lower:]' '[:upper:]')"
DATE="$(date +%F)"
[ -e "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ] && { echo "refusing: $DIR is not empty" >&2; exit 1; }
mkdir -p "$DIR"; cp -R "$SRC/." "$DIR/"
cd "$DIR"
# placeholder substitution (| delimiter; values are escaped for sed)
esc() { printf '%s' "$1" | sed 's/[\\|&]/\\&/g'; }
find . -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.json' -o -name '*.md' -o -name '*.html' -o -name '*.yml' -o -name '*.webmanifest' -o -name '*.svg' \) -not -path './node_modules/*' -print0 |
  xargs -0 sed -i "s|__NAME_UPPER__|$(esc "$UPPER")|g; s|__NAME__|$(esc "$NAME")|g; s|__SLUG__|$(esc "$SLUG")|g; s|__TAGLINE__|$(esc "$TAG")|g; s|__TIP__|Tap to play.|g; s|__OWNER__|$(esc "$OWNER")|g; s|__DATE__|$DATE|g"
echo "installing…"; npm install --no-audit --no-fund >/dev/null
if node -e "require('playwright')" 2>/dev/null; then node scripts/make-icons.cjs >/dev/null && echo "icons generated"; else echo "WARN: playwright not found — run 'npm run icons' once it is installed (manifest needs the PNG icons)"; fi
npm test 2>&1 | grep -E "^# (pass|fail)"
npm run build 2>&1 | tail -1
if [ -d public/icons ] && [ -f public/icons/icon-192.png ] && node -e "require('playwright')" 2>/dev/null; then npm run e2e 2>&1 | tail -3; fi
git init -q 2>/dev/null || true
echo "✔ $NAME scaffolded in $DIR  (slug: $SLUG)"
