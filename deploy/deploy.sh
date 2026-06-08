#!/usr/bin/env bash
# Pull latest code, build frontend + API, restart PM2 and reload Nginx.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fifaPrediction}"
BRANCH="${BRANCH:-diva}"

cd "$APP_DIR"

echo "==> Pulling $BRANCH..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Building API..."
cd "$APP_DIR/api"
npm ci
npm run build

echo "==> Building frontend..."
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> Restarting API (PM2)..."
cd "$APP_DIR/api"
if pm2 describe fifa-api >/dev/null 2>&1; then
  pm2 restart fifa-api
elif [ -f ecosystem.config.cjs ]; then
  pm2 start ecosystem.config.cjs
else
  echo "WARN: ecosystem.config.cjs missing — use branch 'diva' or: pm2 start dist/server.js --name fifa-api" >&2
  pm2 start dist/server.js --name fifa-api
fi
pm2 save

echo "==> Reloading Nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "Deploy complete: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
