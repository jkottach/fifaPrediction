# Mandrake FIFA 26 Predictor

Match prediction app: submit scores, earn points, view leaderboards.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React, TypeScript, Vite, Tailwind — **Azure Static Web Apps** |
| API | Express, MongoDB — **Azure Functions** (linked to SWA at `/api`) |

## Project layout

```
frontend/     React app
api/          Express API + Azure Functions host
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

## Production

See **[AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)** for Static Web App settings, CI/CD, and troubleshooting.

Push to `dev` deploys via `.github/workflows/azure-static-web-apps-blue-plant-0ba785610.yml`.

## Environment

| Where | What |
|-------|------|
| Local API | `api/.env` — always loaded from `api/` (not shell cwd) |
| Local frontend | `frontend/.env` (copy from `frontend/.env.example`) |
| **Azure API** | Portal → Static Web App → **Environment variables** — see **[AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)** |
| **Azure frontend build** | `frontend/.env.production` (committed) |

Missing Azure API env vars cause `/api/leaderboard/top` → **500**.
