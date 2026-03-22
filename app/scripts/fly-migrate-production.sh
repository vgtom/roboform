#!/usr/bin/env bash
# Run Prisma migrations against the Fly production DB (same as server startup).
# Requires: flyctl auth login, app name matches fly-server.toml
set -euo pipefail
APP="${FLY_SERVER_APP:-vinforms-app-server}"
exec flyctl ssh console -a "$APP" -C "sh -c 'cd /app/.wasp/build/server && npm run db-migrate-prod'"
