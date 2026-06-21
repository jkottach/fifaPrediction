# Deploy admin app on EC2 (same server as Kanhans prediction)

Main prediction app repo: **`/home/ec2-user/fifaPrediction`** (branch `main`)

Admin app lives on branch **`admin-local`** — use a **git worktree** so you do not switch the main repo away from `main`.

Admin runs on **port 5002** alongside wc26 (API **5001**, frontend **3000**).

Public URL: **https://admin.kanhans.com**

---

## 0. One-time: add admin worktree (on EC2)

```bash
cd /home/ec2-user/fifaPrediction
git fetch origin admin-local
git worktree add /home/ec2-user/fifaPrediction-admin admin-local
```

Admin code path: **`/home/ec2-user/fifaPrediction-admin/admin-local`**

> Do **not** run `git checkout admin-local` inside `fifaPrediction` — that removes `api/` and `frontend/` from that folder.

---

## 1. GoDaddy DNS

| Type | Name | Value |
|------|------|--------|
| A | `admin` | Same EC2 public IP as `wc26.kanhans.com` |

---

## 2. Configure environment

```bash
cd /home/ec2-user/fifaPrediction-admin/admin-local
cp .env.example .env
nano .env
```

**`.env`** — minimum:

```bash
MONGODB_URI=<copy from /home/ec2-user/fifaPrediction/api/.env>
ADMIN_PORT=5002
ADMIN_PIN=12189
```

**`tenants.config.json`** — not in git (like `.env`). Copy once from the example:

```bash
cp tenants.config.example.json tenants.config.json
nano tenants.config.json   # adjust dbName / url per app if needed
```

| File | Purpose |
|------|---------|
| `.env` | MongoDB connection string + PIN |
| `tenants.config.json` | List of apps + `dbName` per app (local file, gitignored) |
| `tenants.config.example.json` | Production template (tracked) |
| `tenants.config.dev.json` | Local dev template (tracked) |

---

## 3. Build and start (pm2)

```bash
cd /home/ec2-user/fifaPrediction-admin/admin-local
npm install
npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 status
```

Health check:

```bash
curl http://127.0.0.1:5002/health
```

---

## 4. Nginx + HTTPS

```bash
cd /home/ec2-user/fifaPrediction-admin/admin-local
sudo cp deploy/nginx-admin.conf /etc/nginx/sites-available/kanhans-admin
sudo ln -sf /etc/nginx/sites-available/kanhans-admin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d admin.kanhans.com
```

Open **https://admin.kanhans.com** → enter PIN.

---

## 5. Updates after code changes

```bash
cd /home/ec2-user/fifaPrediction-admin
git pull origin admin-local
cd admin-local
test -f tenants.config.json || cp tenants.config.example.json tenants.config.json
npm install
npm run build
pm2 restart wc26-admin
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 502 Bad Gateway | `pm2 logs wc26-admin` — is port 5002 up? |
| Invalid PIN | Check `ADMIN_PIN` in `.env`, `pm2 restart wc26-admin` |
| Only one app / “local” DB in UI | `tenants.config.json` still has dev config — run `cp tenants.config.example.json tenants.config.json` then `pm2 restart wc26-admin` |
| No tenants in UI | Check `tenants.config.json` exists and has a non-empty `tenants` array |
| DB errors | Same `MONGODB_URI` as main API; Atlas IP allowlist includes EC2 |

---

## Port map (same EC2)

| URL | Internal port |
|-----|----------------|
| wc26.kanhans.com | 3000 + 5001 |
| admin.kanhans.com | 5002 |

Nginx routes by domain name; GoDaddy only needs the same IP for both.
