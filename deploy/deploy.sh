#!/usr/bin/env bash
# Pull latest code, build API + frontend, restart pm2 on EC2.
# Usage (from anywhere on the server):
#   ./deploy/deploy.sh                  # Kanhans prod → main
#   DEPLOY_BRANCH=diva ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:5001/api/health}"

cd "$ROOT"

echo "==> Pulling origin/$BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Building API"
cd "$ROOT/api"
npm ci
npm run build

echo "==> Building frontend"
cd "$ROOT/frontend"
npm ci
npm run build

echo "==> Restarting API (PM2)"
cd "$ROOT/api"
if pm2 describe fifa-api >/dev/null 2>&1; then
  pm2 restart fifa-api
elif pm2 describe wc26-api >/dev/null 2>&1; then
  pm2 restart wc26-api
elif [ -f ecosystem.config.cjs ]; then
  pm2 start ecosystem.config.cjs
else
  pm2 start dist/server.js --name fifa-api
fi
pm2 save

if command -v nginx >/dev/null 2>&1; then
  echo "==> Reloading Nginx"
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "==> Health check"
curl -sf "$API_HEALTH_URL" | head -c 500
echo
echo "Deploy complete: $(date -u +%Y-%m-%dT%H:%M:%SZ) (branch=$BRANCH)"
