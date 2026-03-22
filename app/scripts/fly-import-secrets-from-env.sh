#!/usr/bin/env bash
# Import server env vars into Fly as secrets (dotenv format).
# Skips DATABASE_URL (Fly Postgres attaches this automatically — do not override with local dev URL).
#
# Usage (from app/):
#   ./scripts/fly-import-secrets-from-env.sh /path/to/production.env
# Or:
#   FLY_SERVER_APP=vinforms-app-server ./scripts/fly-import-secrets-from-env.sh .env.fly.server
#
# Create a file with ONLY production values (Lemon live keys, WASP_WEB_CLIENT_URL=https://vinforms.com, etc.).
set -euo pipefail
APP="${FLY_SERVER_APP:-vinforms-app-server}"
ENV_FILE="${1:?Usage: $0 <path-to-env-file>}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "File not found: $ENV_FILE" >&2
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Drop comments/empty lines; strip DATABASE_URL lines
grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | grep '=' | grep -vi '^DATABASE_URL=' >"$TMP" || true

if [[ ! -s "$TMP" ]]; then
  echo "No KEY=VALUE lines to import (after filtering)." >&2
  exit 1
fi

echo "Importing secrets into Fly app: $APP (excluding DATABASE_URL)"
flyctl secrets import -a "$APP" <"$TMP"
echo "Done. Redeploy the server if it was already running: wasp deploy fly deploy --fly-toml-dir \"\$(pwd)\""
