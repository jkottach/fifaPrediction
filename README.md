# Mandrake FIFA 26 Predictor

Match prediction app: submit scores, earn points, view leaderboards.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React, TypeScript, Vite, Tailwind — **Nginx** (static) |
| API | Express, MongoDB — **PM2** on EC2 |
| Production | **AWS EC2** (Amazon Linux) + **HTTPS** (Let's Encrypt) |

## Project layout

```
frontend/     React app
api/          Express API (PM2 in production)
deploy/       Nginx config, EC2 setup, deploy scripts
```

## Local development

```bash
# API
cd api
cp .env.example .env   # set MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID
npm install
npm run dev            # http://localhost:5001

# Frontend (proxies /api → :5001)
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:3000
```

### Seed data

```bash
cd api
npm run seed:mongo
```

MongoDB collections: `users`, `teams`, `matches`.

## Production (AWS EC2)

See **[AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md)** for EC2 setup, Nginx, HTTPS, PM2, and Google OAuth.

No custom domain? Use your Elastic IP with free **sslip.io** (`54-123-45-67.sslip.io`) — see AWS_DEPLOYMENT.md section 1b.

Quick deploy on the server:

```bash
bash deploy/deploy.sh
```

## Environment

| Where | What |
|-------|------|
| Local API | `api/.env` — always loaded from `api/` (not shell cwd) |
| Local frontend | `frontend/.env` (copy from `frontend/.env.example`) |
| **EC2 API** | `/opt/fifaPrediction/api/.env` (secrets, not in git) |
| **EC2 frontend build** | `frontend/.env.production` (`VITE_GOOGLE_CLIENT_ID`, `VITE_API_URL=/api`) |

Missing API env vars cause `/api/leaderboard/top` → **500**.
