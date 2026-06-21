# EC2 deployment (wc26.kanhans.com)

Run the **Express API** and **static frontend** on one EC2 instance behind nginx.  
No Azure Static Web Apps or Azure Functions required.

| Layer | On EC2 |
|-------|--------|
| Frontend | `frontend/dist` served by nginx |
| API | `node api/dist/server.js` on port **5001** (use pm2) |
| Sign-in | Google button → `POST /api/auth/google` → JWT in localStorage |

---

## 1. API environment (`api/.env` on the server)

```env
PORT=5001
NODE_ENV=production

MONGODB_URI=mongodb+srv://...
MONGODB_DB=wc26Prod

JWT_SECRET=<long-random-secret-same-for-all-instances>
JWT_EXPIRE=7d

GOOGLE_CLIENT_ID=<same as VITE_GOOGLE_CLIENT_ID in frontend build>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

FRONTEND_URL=https://wc26.kanhans.com

TOURNAMENT_PREDICTION_DEADLINE=2026-06-18T23:59:59.000Z

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

**After changing `JWT_SECRET`**, every user must sign in again (old tokens return `Invalid token`).

---

## 2. Pull and deploy on the server

From the repo root (e.g. `~/fifaPrediction` or `/var/www/wc26`):

```bash
chmod +x deploy/deploy.sh   # once, after first clone
./deploy/deploy.sh
```

This pulls `main`, runs `npm ci` + build for API and frontend, restarts pm2 (`wc26-api` + `wc26-frontend` if both exist, otherwise `wc26-api` only), and checks `/api/health`.

Optional: deploy a different branch with `DEPLOY_BRANCH=dev ./deploy/deploy.sh`.

### Manual build (same steps as the script)

```bash
cd /var/www/wc26   # or your clone path

# API
cd api
npm ci
npm run build

# Frontend (uses frontend/.env.production — VITE_API_URL=/api)
cd ../frontend
npm ci
npm run build
```

`frontend/.env.production` should keep:

```env
VITE_API_URL=/api
VITE_USE_AZURE_AUTH=false
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Same-origin `/api` works because nginx proxies to Node.

**Do not use `npm run dev` on EC2 for real users** — Vite hot-reload reconnects when you switch browser tabs and causes a full page refresh. Use the production build below.

---

## 3. Run API + frontend with pm2

**Option A — both apps in pm2** (frontend on port 3000 via `vite preview`):

```bash
cd ~/fifaPrediction

cd api && npm ci && npm run build
cd ../frontend && npm ci && npm run build

cd ..
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

Use nginx config `deploy/nginx-wc26-pm2.conf` (proxies `/` → 3000, `/api` → 5001).

**Option B — API only in pm2, nginx serves static `frontend/dist`** (lighter, recommended):

```bash
cd api && npm run build
pm2 start dist/server.js --name wc26-api
```

Use `deploy/nginx-wc26.conf` (serves `frontend/dist` directly).

Verify on the **EC2 instance** (must return JSON, not 502):

```bash
curl -s http://127.0.0.1:5001/api/health
```

Then verify through nginx:

```bash
curl -s https://wc26.kanhans.com/api/health
```

---

## 4. nginx

Copy `deploy/nginx-wc26.conf`, set `root` to your `frontend/dist` path, enable the site, reload nginx.

**Important:** the config forwards `Authorization`, `X-Access-Token`, and `Cookie`. Without these, `/api/predictions` returns **Invalid token** even when the user is logged in.

Verify on EC2:

```bash
sudo grep -E "Authorization|X-Access-Token" /etc/nginx/sites-enabled/*
```

Compare `JWT_SECRET` length (no hidden spaces/newlines):

```bash
grep JWT_SECRET /var/www/wc26/api/.env | wc -c   # adjust path
```

TLS:

```bash
sudo certbot --nginx -d wc26.kanhans.com
```

---

## 5. Google Cloud Console

**Authorized JavaScript origins:**

```
https://wc26.kanhans.com
http://localhost:3000
```

`GOOGLE_CLIENT_ID` in `api/.env` must match `VITE_GOOGLE_CLIENT_ID` in the frontend build.

---

## 6. MongoDB Atlas

- Database: `wc26Prod` (or your `MONGODB_DB`)
- **Network Access**: allow the EC2 instance public IP (or `0.0.0.0/0` for testing)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **`Invalid token` on `/api/predictions`** (same `JWT_SECRET`) | Usually a **stale `auth_token` cookie** or **nginx not forwarding** `Authorization` / `X-Access-Token`. Fix nginx headers (below), sign out, clear site cookies, sign in again. Opening `/api/predictions` in the browser tab alone will only send the cookie — test from the app or with `curl -H "Authorization: Bearer …"`. |
| Login works, predictions 401 | nginx missing `proxy_set_header Authorization` / `X-Access-Token` |
| Google `origin_mismatch` | Add `https://wc26.kanhans.com` to OAuth JavaScript origins |
| **502 Bad Gateway** on `/api/*` | API not running on port 5001. On EC2: `pm2 status`, `pm2 logs wc26-api --lines 50`, `curl http://127.0.0.1:5001/api/health`. Usually fix: `cd api && npm run build && pm2 restart wc26-api` |
| API 502 | pm2 not running, `npm run build` failed, or MongoDB connection error on startup |
| Empty matches | `MONGODB_DB` must be `wc26Prod` (not empty `kanhans_fifa26`) |
| CORS errors | Set `FRONTEND_URL=https://wc26.kanhans.com`; API uses `cors({ origin: true, credentials: true })` |

---

## DNS

Point `wc26.kanhans.com` A record to the EC2 elastic IP. Remove or disable old Azure Static Web App binding if you no longer use it.
