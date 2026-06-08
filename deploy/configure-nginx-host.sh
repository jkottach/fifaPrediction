#!/usr/bin/env bash
# Set Nginx server_name from Elastic IP → sslip.io hostname (no custom domain).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fifaPrediction}"
cd "$APP_DIR"

host="$(bash deploy/hostname-from-ip.sh "${1:-}" | head -1)"
src="deploy/nginx/fifa.conf"
dest="/etc/nginx/conf.d/fifa.conf"

sed "s/YOUR_DOMAIN.com/${host}/g" "$src" | sudo tee "$dest" >/dev/null
sudo nginx -t
echo "Nginx configured for https://${host}"
echo "Next: bash deploy/deploy.sh && sudo certbot --nginx -d ${host}"
