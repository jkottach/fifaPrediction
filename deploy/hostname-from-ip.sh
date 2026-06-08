#!/usr/bin/env bash
# Print a free hostname for an Elastic IP (no custom domain required).
# sslip.io resolves 54-123-45-67.sslip.io → 54.123.45.67 automatically.
#
# Usage:
#   bash deploy/hostname-from-ip.sh              # detect public IP
#   bash deploy/hostname-from-ip.sh 54.123.45.67 # explicit IP
set -euo pipefail

ip="${1:-}"
if [ -z "$ip" ]; then
  ip="$(curl -fsS --max-time 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)"
fi
if [ -z "$ip" ]; then
  ip="$(curl -fsS --max-time 5 https://checkip.amazonaws.com | tr -d '[:space:]')"
fi

if [ -z "$ip" ]; then
  echo "Could not detect public IP. Pass it as an argument." >&2
  exit 1
fi

host="${ip//./-}.sslip.io"
echo "$host"
echo ""
echo "Use these values:" >&2
echo "  Site URL:       https://${host}" >&2
echo "  FRONTEND_URL:   https://${host}" >&2
echo "  Google origin:  https://${host}" >&2
echo "  Certbot:        sudo certbot --nginx -d ${host}" >&2
