# Local admin app (separate from main app)

Self-contained: **own UI + own API server**. Does not modify or call the main Kanhans API (`api/` on port 5001).

## Setup

1. Copy env from the main API:

```bash
cd admin-local
cp .env.example .env
# Edit .env — set MONGODB_URI (usually one cluster for all apps)
```

2. Configure prediction apps (databases):

```bash
cp tenants.config.example.json tenants.config.json
# Edit dbName for Kanhans, FCC, Mandrake, DIWA, etc. if needed
```

Each tenant uses the same `MONGODB_URI` and a different `dbName` (same collections in each DB).

3. Install and run (starts API on **5002** and UI on **3001**):

```bash
npm install
npm run dev
```

4. Open **http://localhost:3001** — pick an app at the top, then finalize match scores.

You do **not** need the main API running. Only MongoDB credentials in `.env`.

## Multi-app / multi-database

| Config | Purpose |
|--------|---------|
| `tenants.config.json` | List of apps: `id`, `label`, `dbName` (optional `uri` per tenant) |
| `ADMIN_TENANTS` env | Alternative: `id:dbName:Label` comma-separated |
| `X-Tenant-Id` header | API selects DB (UI sets this automatically) |

## What it does

- `GET /api/tenants` — list configured apps
- `GET /api/matches` — list matches for selected tenant
- `POST /api/local-admin/finalize-match` — set final score, mark completed, recalculate match prediction points
- `GET /api/tournament/setup` — group-stage teams + saved official tournament results
- `POST /api/local-admin/tournament-results` — save official bracket results and recalculate every user’s `tournamentPrediction.points` and `totalPoints` (match + tournament)
- `GET /api/leaderboard/top` — preview top players for the selected tenant

Tournament points (same as main app): group winner +3, semifinalist +5, finalist +8, champion +15.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Admin API + Vite UI together |
| `npm run dev:server` | API only (port 5002) |
| `npm run dev:client` | UI only (proxies `/api` to 5002) |
