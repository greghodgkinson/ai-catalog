#!/usr/bin/env bash
set -euo pipefail

APP="prolifics-ai-catalog"
REGION="jnb"
VOLUME="catalog_data"

# ── Guards ────────────────────────────────────────────────────────────────────
if ! command -v flyctl &>/dev/null; then
  echo "ERROR: flyctl is not installed. Install it from https://fly.io/docs/flyctl/install/" >&2
  exit 1
fi

if ! flyctl auth whoami &>/dev/null; then
  echo "ERROR: Not authenticated with Fly.io. Run: flyctl auth login" >&2
  exit 1
fi

# ── Create app if it doesn't exist ───────────────────────────────────────────
if ! flyctl apps list | grep -q "^${APP}"; then
  echo "Creating Fly app: ${APP}"
  flyctl apps create "${APP}"
fi

# ── Create persistent volume if it doesn't exist ─────────────────────────────
if ! flyctl volumes list --app "${APP}" | grep -q "${VOLUME}"; then
  echo "Creating persistent volume: ${VOLUME} (1 GB) in ${REGION}"
  flyctl volumes create "${VOLUME}" --app "${APP}" --region "${REGION}" --size 1 --yes
fi

# ── Set secrets ───────────────────────────────────────────────────────────────
if [[ -n "${CATALOG_API_KEY:-}" ]]; then
  echo "Setting CATALOG_API_KEY secret"
  flyctl secrets set CATALOG_API_KEY="${CATALOG_API_KEY}" --app "${APP}"
else
  echo "WARN: CATALOG_API_KEY env var not set — catalog will accept unauthenticated pushes"
fi

# ── Deploy ────────────────────────────────────────────────────────────────────
echo "Deploying ${APP}…"
flyctl deploy --app "${APP}"

echo ""
echo "Deployed: https://${APP}.fly.dev"
