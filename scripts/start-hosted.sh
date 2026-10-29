#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-}}"
if [ -z "$APP_URL" ] || [ -z "${DATABASE_URL:-}" ]; then
  echo "Configure DATABASE_URL and APP_URL (or the host-provided RENDER_EXTERNAL_URL)." >&2
  exit 1
fi
npm run db:migrate
npx --no-install tsx scripts/bootstrap-hosted.ts
# Bootstrap credentials are not needed by the web process.
unset OWNER_EMAIL OWNER_PASSWORD
exec npm start
