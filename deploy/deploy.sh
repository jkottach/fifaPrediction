#!/usr/bin/env bash
# Pull latest code, build API + frontend, restart pm2 on EC2.
# Usage (from anywhere on the server):
#   ./deploy/deploy.sh
#   DEPLOY_BRANCH=dev ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:5001/api/health}"

cd "$ROOT"

echo "==> Pulling origin/$BRANCH"
git pull origin "$BRANCH"

echo "==> Building API"
cd "$ROOT/api"
npm ci
npm run build

echo "==> Building frontend"
cd "$ROOT/frontend"
npm ci
npm run build

echo "==> Restarting pm2"
cd "$ROOT"
if pm2 describe wc26-frontend &>/dev/null; then
  pm2 restart deploy/ecosystem.config.cjs
elif pm2 describe wc26-api &>/dev/null; then
  pm2 restart wc26-api
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo "==> Health check ($API_HEALTH_URL)"
if curl -sf "$API_HEALTH_URL" >/dev/null; then
  curl -s "$API_HEALTH_URL"
  echo
  echo "Deploy complete."
else
  echo "Warning: API health check failed. Run: pm2 logs wc26-api --lines 50" >&2
  exit 1
fi
