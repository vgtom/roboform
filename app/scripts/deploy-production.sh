#!/usr/bin/env bash
# Deploy Wasp app to Fly (client + server), then run Prisma migrations on the server.
# Prerequisites: flyctl auth login, wasp CLI, app/ contains fly-client.toml + fly-server.toml
#
# Usage (from app/):
#   ./scripts/deploy-production.sh
#
# Client build uses .env.production for REACT_APP_API_URL (copy from .env.production.example if missing).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  cp .env.production.example .env.production
  echo "Created .env.production from .env.production.example — set REACT_APP_API_URL to your Fly server URL, then redeploy if needed."
fi

echo "==> wasp deploy fly deploy (client + server)"
wasp deploy fly deploy --fly-toml-dir "$APP_DIR"

echo "==> Prisma migrate deploy on Fly server"
"$SCRIPT_DIR/fly-migrate-production.sh"

echo "==> Done."
