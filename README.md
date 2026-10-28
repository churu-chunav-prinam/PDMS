# Churu Poll Day Monitoring

Phone-first web app for polling day in Churu: polling officers report each step of their booth,
the district control room watches every booth.

## Setup (development)
```bash
cp backend/.env.example backend/.env           # fill in passwords and keys
docker compose up -d                           # MySQL 8.4 on 127.0.0.1:3308 (own container/volume)
cd backend && npm install && npm run migrate && npm run migrate:test
npm run import:geography                       # dry run; then add --commit
npm run seed:steps                             # default steps on POLL_DATE
npm run admin:create -- --username admin --name "District Admin"   # prints the password once
npm run dev                                    # API on :3200
cd ../frontend && npm install && npm run dev   # app on http://localhost:5174
```
Data: `docs/polling-stations.xlsx` (sheet `Sheet1_withvoters`), `docs/ps-master.json` (PS code +
Hindi name; codes are used in usernames like RTG-045), `docs/fixes-official.json` (approved fixes
for conflicting booths; every entry needs reason, approved_by, approved_on).

## Checks
`cd backend && npm test && npm run lint && npm run typecheck`; `cd frontend && npm run build`.

## Production
See [docs/DEPLOY.md](docs/DEPLOY.md): Docker (`docker-compose.prod.yml`, project `churu-poll`, app on
127.0.0.1:3200), host nginx (`deploy/nginx-poll.conf`), certbot, backups (`deploy/backup.sh`).
Dev-only layout check: `cd frontend && npm run check:ui` (needs both dev servers and `npm run demo:poll`).
