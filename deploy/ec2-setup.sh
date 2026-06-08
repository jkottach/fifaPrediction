#!/usr/bin/env bash
# One-time EC2 bootstrap for Amazon Linux 2023.
# Run as a user with sudo (not root): bash deploy/ec2-setup.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fifaPrediction}"
REPO_URL="${REPO_URL:-https://github.com/jkottach/fifaPrediction.git}"
BRANCH="${BRANCH:-mandrake}"

echo "==> Installing system packages..."
sudo dnf update -y
sudo dnf install -y nginx git

echo "==> Installing Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v
npm -v

echo "==> Installing PM2..."
sudo npm install -g pm2

echo "==> Installing Certbot (Let's Encrypt)..."
sudo dnf install -y certbot python3-certbot-nginx

echo "==> Preparing app directory: $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER:$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo ""
echo "Setup complete. Next steps:"
echo "  1. Create $APP_DIR/api/.env (copy from api/.env.example)"
echo "  2. Set frontend/.env.production (VITE_GOOGLE_CLIENT_ID, VITE_API_URL=/api)"
echo "  3. Hostname: bash deploy/hostname-from-ip.sh   (no domain → sslip.io)"
echo "     Then:    bash deploy/configure-nginx-host.sh"
echo "     Or edit deploy/nginx/fifa.conf and sudo cp to /etc/nginx/conf.d/fifa.conf"
echo "  4. sudo nginx -t && sudo systemctl enable nginx && sudo systemctl start nginx"
echo "  5. sudo certbot --nginx -d <hostname-from-step-3>"
echo "  7. bash deploy/deploy.sh"
echo "  8. pm2 startup  (run the command PM2 prints, then pm2 save)"
