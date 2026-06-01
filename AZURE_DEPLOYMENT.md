# Azure Deployment: Static Web Apps + API Functions

| Layer | Azure service | Folder |
|--------|----------------|--------|
| Frontend | **Azure Static Web Apps** | `frontend/dist` |
| API | **Azure Functions** (linked) | `api/` |
| Sign-in | **Google button in app** → `POST /api/auth/google` | `frontend/.env.production` |

SWA URL (FCC): `https://ambitious-stone-0e23c2000.7.azurestaticapps.net`  
API calls: `https://ambitious-stone-0e23c2000.7.azurestaticapps.net/api/...`

---

## 1. Environment variables (Azure Portal)

**Static Web App → Settings → Environment variables → Production**

| Name | Purpose |
|------|---------|
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DB` | `fifaPrediction` |
| `JWT_SECRET` | Still required (local dev / legacy JWT fallback) |
| `JWT_EXPIRE` | `7d` |
| `GOOGLE_CLIENT_ID` | Same Web client as `VITE_GOOGLE_CLIENT_ID` in `frontend/.env.production` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://ambitious-stone-0e23c2000.7.azurestaticapps.net` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` |

Save, then redeploy or restart.

Template: `api/.env.example`

### Verify API

`https://ambitious-stone-0e23c2000.7.azurestaticapps.net/api/health` → `status: "ok"`, `mongo.ok: true`

---

## 2. Google sign-in (production)

Production uses the **Google button on `/login`** → `POST /api/auth/google` (JWT), same as local.

- `frontend/.env.production`: `VITE_USE_AZURE_AUTH=false` + `VITE_GOOGLE_CLIENT_ID`
- `staticwebapp.config.json` has **no** `auth` block (avoids Azure sending you to Microsoft/Hotmail)

In **Azure Portal → Authentication**, disable **Microsoft / Azure AD** if you only want Google.  
Optional: turn off **Custom authentication** entirely so Portal does not override the app.

---

## 3. Google Cloud Console

**Authorized JavaScript origins:**

```
https://ambitious-stone-0e23c2000.7.azurestaticapps.net
http://localhost:3000
```

**Important:** `frontend/.env.production` is **committed** and baked into every Azure build. It must use the same `VITE_GOOGLE_CLIENT_ID` as `api/.env` / Azure `GOOGLE_CLIENT_ID` (not an old project’s client).

Use your **FCC** OAuth client (e.g. “FCC fifa app”). No `/.auth/login/google/callback` needed for this flow.

---

## 4. Local development

| Mode | How |
|------|-----|
| **JWT + Google button** (default) | `frontend/.env` with `VITE_GOOGLE_CLIENT_ID`, no `VITE_USE_AZURE_AUTH` |

---

## 5. MongoDB Atlas

- Database: `fifaPrediction`
- **Network Access**: allow `0.0.0.0/0` for testing or Azure IPs

```bash
cd api && npm run seed:mongo
```

---

## 6. CI/CD

Workflow: `.github/workflows/azure-static-web-apps-ambitious-stone-0e23c2000.yml`  
Secret: `AZURE_STATIC_WEB_APPS_API_TOKEN_AMBITIOUS_STONE_0E23C2000`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Hotmail / Microsoft sign-in** instead of Google | Azure SWA custom Google failed → fell back to Microsoft. **Fix:** In Portal → Authentication, **turn off** Microsoft/Azure AD; use app Google login (this repo). On **Free** plan, custom Google often redirects to Microsoft — upgrade to **Standard** if you need `/.auth/login/google`. |
| Instant logout after login | Set `JWT_SECRET` in Azure env (same as local) |
| Google `origin_mismatch` | Add SWA URL under JavaScript origins in Google Console |
| Popup shows host URL not app name | OAuth consent screen app name + `azurestaticapps.net` authorized domain |
