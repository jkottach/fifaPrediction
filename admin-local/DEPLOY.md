# Deploy admin app on EC2 (same server as Kanhans prediction)

Runs on **port 5002** alongside the main app (API **5001**, frontend **3000**).

## 1. On EC2 — get code

```bash
cd ~/Kanhans_Fifa26   # or your clone path
git fetch origin
git checkout admin-local
git pull origin admin-local
```

## 2. Configure environment

```bash
cd admin-local
cp .env.example .env
nano .env
```

Set at minimum:

- `MONGODB_URI` — same as main API
- `ADMIN_PIN` — your PIN (default `12189`)
- `ADMIN_TENANTS` or `tenants.config.json` — same DBs as local

## 3. Build and start

```bash
npm install
npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 logs wc26-admin
```

Health check: `curl http://127.0.0.1:5002/health`

## 4. Nginx (subdomain recommended)

```bash
sudo cp deploy/nginx-admin.conf /etc/nginx/sites-available/wc26-admin
sudo ln -sf /etc/nginx/sites-available/wc26-admin /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d admin.wc26.kanhans.com
```

Open `https://admin.wc26.kanhans.com` and enter the PIN.

## 5. Updates after code changes

```bash
git pull origin admin-local
cd admin-local
npm install
npm run build
pm2 restart wc26-admin
```
