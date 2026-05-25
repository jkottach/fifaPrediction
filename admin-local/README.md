# Local admin app (separate from main app)

Self-contained: **own UI + own API server**. Does not modify or call the main Kanhans API (`api/` on port 5001).

This folder is gitignored.

## Setup

1. Copy env from the main API:

```bash
cd admin-local
cp .env.example .env
# Edit .env — use the same MONGODB_URI and MONGODB_DB as api/.env
```

2. Install and run (starts API on **5002** and UI on **3001**):

```bash
npm install
npm run dev
```

3. Open **http://localhost:3001**

You do **not** need the main API running. Only MongoDB credentials in `.env`.

## What it does

- `GET /api/matches` — list matches from MongoDB
- `POST /api/local-admin/finalize-match` — set final score, mark completed, recalculate prediction points and `totalPoints`
- `GET /api/leaderboard/top` — preview top players after scoring

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Admin API + Vite UI together |
| `npm run dev:server` | API only (port 5002) |
| `npm run dev:client` | UI only (proxies `/api` to 5002) |
