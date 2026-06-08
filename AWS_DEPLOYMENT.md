# AWS Deployment: EC2 (Amazon Linux) + Nginx + PM2

| Layer | Service | Folder |
|--------|---------|--------|
| Frontend | **Nginx** (static) | `frontend/dist` |
| API | **Express** via **PM2** | `api/` → `dist/server.js` |
| Sign-in | Google button → `POST /api/auth/google` (JWT) | `frontend/.env.production` |
| HTTPS | **Let's Encrypt** (Certbot) | Required for Google OAuth |

Production URL examples:
- **With domain:** `https://predictions.example.com`
- **No domain:** `https://54-123-45-67.sslip.io` (free hostname from Elastic IP — see section 1b)

API: `https://<your-host>/api/...`

---

## 1. AWS prerequisites

### EC2 instance

- **AMI:** Amazon Linux 2023
- **Type:** `t3.small` (2 vCPU, 2 GB RAM) or larger
- **Key pair:** for SSH access

### Security group (inbound)

| Port | Source | Purpose |
|------|--------|---------|
| 22 | Your IP only | SSH |
| 80 | 0.0.0.0/0 | HTTP (Certbot + redirect to HTTPS) |
| 443 | 0.0.0.0/0 | HTTPS |

### Elastic IP

Allocate and associate an **Elastic IP** with the instance so the public IP does not change on reboot.

### DNS (if you have a domain)

Create an **A record** pointing your domain to the Elastic IP, e.g.:

```
predictions.example.com  →  54.x.x.x
```

### 1b. No custom domain? Use sslip.io (free)

Google OAuth needs **HTTPS + a hostname** — a bare IP like `http://54.x.x.x` will **not** work for sign-in.

Use **[sslip.io](https://sslip.io)** with your Elastic IP (no registration, no DNS setup):

| Elastic IP | Free hostname |
|------------|----------------|
| `54.123.45.67` | `54-123-45-67.sslip.io` |

Replace dots with dashes, append `.sslip.io`. It resolves to your IP automatically.

On the EC2 instance:

```bash
cd /opt/fifaPrediction
bash deploy/hostname-from-ip.sh
# prints e.g. 54-123-45-67.sslip.io and the URLs to use

bash deploy/configure-nginx-host.sh
# writes /etc/nginx/conf.d/fifa.conf with that hostname
```

Then set in **`api/.env`**:

```
FRONTEND_URL=https://54-123-45-67.sslip.io
```

And in **Google Cloud Console** → Authorized JavaScript origins:

```
https://54-123-45-67.sslip.io
```

HTTPS cert:

```bash
sudo certbot --nginx -d 54-123-45-67.sslip.io
```

**Note:** If you change the Elastic IP, the hostname changes — update Nginx, `FRONTEND_URL`, Google origins, and re-run Certbot.

**Later:** a cheap domain (~$12/year on Route 53 or any registrar) gives a cleaner URL; swap the hostname in Nginx, `.env`, and Google Console.

---

## 2. One-time server setup

SSH into the instance:

```bash
git clone https://github.com/jkottach/fifaPrediction.git /opt/fifaPrediction
cd /opt/fifaPrediction
git checkout mandrake
bash deploy/ec2-setup.sh
```

Or clone manually after `ec2-setup.sh` installs packages.

---

## 3. Environment variables

### API — `/opt/fifaPrediction/api/.env`

Copy from `api/.env.example`. **Never commit this file.**

| Name | Purpose |
|------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB` | Database name (e.g. Mandrake DB) |
| `JWT_SECRET` | Long random secret |
| `JWT_EXPIRE` | `7d` |
| `GOOGLE_CLIENT_ID` | Same Web client as `VITE_GOOGLE_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud client secret |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://your-domain.com` (must match live URL) |
| `PORT` | `5001` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` |

### Frontend build — `frontend/.env.production`

```env
VITE_API_URL=/api
VITE_USE_AZURE_AUTH=false
VITE_GOOGLE_CLIENT_ID=<same Web client ID as GOOGLE_CLIENT_ID>
```

Rebuild frontend after any `VITE_*` change (`npm run build` in `frontend/`).

---

## 4. Nginx + HTTPS

**No domain:** run `bash deploy/configure-nginx-host.sh` (section 1b), then skip step 1 below.

**Custom domain:** edit `deploy/nginx/fifa.conf` — replace `YOUR_DOMAIN.com` with your domain.

1. Install site config (if not already done by `configure-nginx-host.sh`):

```bash
sudo cp /opt/fifaPrediction/deploy/nginx/fifa.conf /etc/nginx/conf.d/fifa.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

3. Build app and start API (see section 5) so `/` and `/api/health` respond on HTTP.
4. Obtain SSL certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

Certbot adds HTTPS and HTTP→HTTPS redirect. Renewal is automatic via systemd timer.

### Verify

- `https://your-domain.com` → React app
- `https://your-domain.com/api/health` → `status: "ok"`, `mongo.ok: true`

---

## 5. API with PM2

```bash
cd /opt/fifaPrediction/api
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # run the sudo command PM2 prints, then pm2 save again
```

Express uses `trust proxy` for correct client IPs behind Nginx.

---

## 6. Deploy updates (git pull)

```bash
cd /opt/fifaPrediction
bash deploy/deploy.sh
```

This pulls `mandrake`, builds API + frontend, restarts PM2, and reloads Nginx.

Override branch or path:

```bash
BRANCH=mandrake APP_DIR=/opt/fifaPrediction bash deploy/deploy.sh
```

---

## 7. Google OAuth (HTTPS required)

**Google Cloud Console** → Credentials → **Web application** client:

**Authorized JavaScript origins:**

```
https://your-domain.com
http://localhost:3000
```

- `GOOGLE_CLIENT_ID` in `api/.env` must match `VITE_GOOGLE_CLIENT_ID` in the production frontend build.
- Remove old `*.azurestaticapps.net` origins after Azure cutover.
- Add `your-domain.com` under OAuth consent screen **Authorized domains** if prompted.

---

## 8. MongoDB Atlas

**Network Access:** add the EC2 **Elastic IP** (or `0.0.0.0/0` for testing only).

Seed data (once):

```bash
cd /opt/fifaPrediction/api
npm run seed:mongo
```

---

## 9. Cutover from Azure

1. Deploy and test on EC2 (health + Google login on HTTPS).
2. Update DNS to point to Elastic IP.
3. Update Google OAuth origins and MongoDB allowlist.
4. Smoke test: login, dashboard, match predictions, leaderboard, tournament picks.
5. Decommission Azure Static Web App after 24–48 hours stable.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Google `origin_mismatch` | Add `https://your-domain.com` to JavaScript origins; rebuild frontend if client ID changed |
| `/api/health` 503, `mongo.ok: false` | Check `MONGODB_URI`, `MONGODB_DB`, Atlas IP allowlist |
| 502 on `/api/*` | `pm2 status` — restart `fifa-api`; check `api/.env` |
| SPA routes 404 | Nginx `try_files` → `/index.html` (see `deploy/nginx/fifa.conf`) |
| Instant logout | Set `JWT_SECRET` in `api/.env` |
| Certbot fails | Hostname must resolve to this server (sslip.io auto-resolves); port 80 open |
| No domain | Use `54-x-x-x.sslip.io` from `deploy/hostname-from-ip.sh` — not raw IP |

---

## Legacy Azure deployment

See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for the previous Static Web Apps setup (deprecated for Mandrake production).
