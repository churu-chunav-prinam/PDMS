# Demo deploy: Render (free) + Aiven MySQL (free)

One Render web service runs the API and serves the built frontend. Data lives only in Aiven MySQL
(sessions too); uploads are handled in memory. Render free has no shell, so all setup scripts run
from your laptop against Aiven. Render free sleeps after ~15 min idle; the first visit then takes
up to ~1 min and the app shows "सर्वर शुरू हो रहा है, कृपया 1 मिनट रुकें…".

## 1. Aiven MySQL

1. console.aiven.io → Create service → **MySQL** → plan **Free**. Pick the region closest to India
   if offered. Create and wait until it is **Running**.
2. Service → Overview → Connection information: copy **Host**, **Port**, **User** (`avnadmin`) and
   **Password**. Download the **CA certificate** (`ca.pem`).

## 2. Laptop setup (from the repo, Node 24)

```bash
cd backend
npm ci
cp .env.aiven.example .env.aiven          # gitignored; fill in host, port, passwords, APP_ORIGIN
cp ~/Downloads/ca.pem aiven-ca.pem        # *.pem is gitignored; DB_SSL_CA=./aiven-ca.pem
openssl rand -base64 24 | tr -d '/+='     # run twice: DB_APP_PASSWORD, and (doubled) SESSION_SECRET

ENV_FILE=.env.aiven npm run db:init                          # database + app user + trigger check
ENV_FILE=.env.aiven npm run migrate                          # tables + least-privilege grants
ENV_FILE=.env.aiven npm run import:geography                 # dry run: read the report
ENV_FILE=.env.aiven npm run import:geography -- --commit
ENV_FILE=.env.aiven npm run seed:steps
ENV_FILE=.env.aiven npm run admin:create
ENV_FILE=.env.aiven npm run demo:poll                        # optional; needs DEMO_ALLOWED=true
```

**If `db:init` fails**, it says which fallback to use. Nothing is weakened unless you set it:

- App user refused → in `.env.aiven` AND on Render: `DB_APP_USER=avnadmin`,
  `DB_APP_PASSWORD=<avnadmin password>`, `DB_FALLBACK_ADMIN_AS_APP_USER=true`.
- CREATE TRIGGER refused → `DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS=true` in both places.

Re-run `db:init`, then continue. After any schema change in a new release, run
`ENV_FILE=.env.aiven npm run migrate` from the laptop BEFORE deploying it on Render. The server prints a WARNING line for each active fallback at startup.

## 3. Render

1. dashboard.render.com → **New → Blueprint** → connect GitHub `churu-chunav-prinam/PDMS`
   (branch `main`). Render reads `render.yaml` (free plan, Node, Singapore).
   Alternatively **New → Web Service** from the same repo with:
   Build `npm --prefix backend ci --include=dev && npm --prefix frontend ci --include=dev && npm run build`,
   Start `npm start`, Health check path `/api/health`,
   Instance type Free, and the variables below.
2. Environment variables (`PORT` is set by Render; do not add it). The avnadmin password is NOT
   stored on Render: migrations run only from the laptop (step 2):

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` (Secure cookies, HSTS) |
| `APP_ORIGIN` | your Render URL, e.g. `https://pdms-xxxx.onrender.com` (no trailing slash) |
| `SESSION_SECRET` | 32+ random chars (Blueprint generates it) |
| `SESSION_IDLE_MINUTES` | `60` |
| `SESSION_ABSOLUTE_HOURS` | `20` |
| `TRUST_PROXY` | `1` (Render's proxy) |
| `POLL_DATE` | poll day `YYYY-MM-DD`, same as `.env.aiven` |
| `FRONTEND_DIST` | `../frontend/dist` |
| `LOGIN_RATE_LIMIT_PER_15MIN` | `300` |
| `DEMO_ALLOWED` | `false` (only demo:poll on the laptop reads it) |
| `DB_HOST` | Aiven host |
| `DB_PORT` | Aiven port |
| `DB_NAME` | `churu_poll` |
| `DB_APP_USER` | `churu_poll_app` (or `avnadmin` with the fallback) |
| `DB_APP_PASSWORD` | the app user password from `.env.aiven` |
| `DB_SSL_CA` | full text of `ca.pem`, pasted including the BEGIN/END lines |
| `DB_FALLBACK_ADMIN_AS_APP_USER` | `false` (see step 2) |
| `DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS` | `false` (see step 2) |

3. First deploy: create/apply. When the URL is known, set `APP_ORIGIN` to it (and in `.env.aiven`),
   then **Manual Deploy → Deploy latest commit**.

## 4. Checks

- `https://<your-app>.onrender.com/api/health` → `{"status":"ok","db":"ok"}`.
- Render logs: `Server listening on port 10000 (production)`, and **no**
  `WARNING: DB_FALLBACK…` lines (unless you chose a fallback).
- Open the URL, log in as the admin created with `admin:create`; the session survives a redeploy.
- Before real use: `ENV_FILE=.env.aiven npm run demo:poll -- --reset`, then `DEMO_ALLOWED=false`.
