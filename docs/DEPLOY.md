# Deploy: poll.vultusgo.in (same VPS as the counting site)

Everything below is copy-paste, run as **root** on the VPS. Replace only `YOUR_GITHUB_USER/YOUR_REPO`.

**This setup never touches the counting site.** It uses its own folder, Docker names and port:

| | Counting site | Poll day (this app) |
|---|---|---|
| Folder | `/root/Churu-Results` | `/root/churu-poll` |
| Compose project | `churu` | `churu-poll` |
| Containers | `churu-mysql-1`, `churu-app-1` | `churu-poll-db`, `churu-poll-app` |
| Network / volume | compose defaults | `churu_poll_net` / `churu_poll_db_data` |
| App port (localhost only) | 3100 | **3200** |
| nginx file | its own | `/etc/nginx/sites-available/churu-poll` |

Memory: MySQL is capped at 450 MB (128 MB buffer pool, performance_schema off) and the app at 320 MB.
Measured idle on a laptop: app ≈ 50 MB, MySQL ≈ 150 MB.

---

## 0. Before you start
```bash
docker compose version            # Docker + compose plugin present (already used by the counting site)
free -h                           # building needs ~1 GB free for a few minutes
ss -ltn | grep ':3200 ' || echo "port 3200 is free"
```
DNS: add an **A record** `poll` → the VPS IP (at the vultusgo.in DNS provider). Check: `dig +short poll.vultusgo.in`.

## 1. Read-only deploy key (a NEW key, only for this repo)
```bash
ssh-keygen -t ed25519 -N "" -C "churu-poll VPS deploy (read-only)" -f /root/.ssh/churu_poll_deploy
cat /root/.ssh/churu_poll_deploy.pub
```
On GitHub: **repo → Settings → Deploy keys → Add deploy key**. Title `VPS churu-poll`, paste the
`.pub` line, and **leave "Allow write access" unticked**. Then give the key its own host alias, so it
never mixes with the counting site's key:
```bash
cat >> /root/.ssh/config <<'EOF'

Host github-churu-poll
  HostName github.com
  User git
  IdentityFile /root/.ssh/churu_poll_deploy
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config
ssh -T github-churu-poll          # "Hi YOUR_GITHUB_USER/YOUR_REPO! You've successfully authenticated..."
```

## 2. Clone and the env file
```bash
git clone git@github-churu-poll:YOUR_GITHUB_USER/YOUR_REPO.git /root/churu-poll
cd /root/churu-poll
./deploy/make-env.sh poll.vultusgo.in      # writes .env.production (chmod 600) with fresh random secrets
nano .env.production                       # check POLL_DATE; every line is explained in .env.production.example
```
Keep a copy of `.env.production` somewhere safe (password manager).

## 3. Build and start
```bash
cd /root/churu-poll
export DC="docker compose -f docker-compose.prod.yml --env-file .env.production"
$DC up -d --build                          # first build: ~2-4 minutes
$DC ps                                     # churu-poll-db healthy, churu-poll-app up (healthy after ~30 s)
curl -s http://127.0.0.1:3200/api/health   # {"status":"ok","db":"ok"}
```

## 4. Database setup (in this order)
```bash
$DC exec app npm run migrate                                   # schema + least-privilege grants
$DC exec app npm run import:geography                          # DRY RUN: must print 13/231/39/1359/1248368 and "DRY RUN OK"
$DC exec app npm run import:geography -- --commit
$DC exec app npm run seed:steps                                # 16 default steps on POLL_DATE from .env.production
$DC exec -it app npm run admin:create -- --username admin --name "District Admin"
```
The last command asks you to type the admin password twice (hidden; 8+ characters with a letter and
a digit, not the username). Later the admin changes it in the app (**सेटिंग → मेरा खाता**). Change the poll date later in
the app (**सेटिंग → मतदान तिथि**): all step times move with it.
Step times are **not enforced** by default (any active step can be reported at any time, nothing is
late or behind). To enforce opening times and deadlines: **सेटिंग → समय सीमा लागू करें**.

Note: booth 69 of Rajgarh uses the **provisional** fix in `docs/fixes-official.json` (ZP ward 30,
`approved_by: PENDING`). Confirm it with the RO.

## 5. nginx and HTTPS
```bash
cp /root/churu-poll/deploy/nginx-poll.conf /etc/nginx/sites-available/churu-poll
ln -s /etc/nginx/sites-available/churu-poll /etc/nginx/sites-enabled/churu-poll
nginx -t && systemctl reload nginx
certbot --nginx -d poll.vultusgo.in        # choose "redirect" if asked; only this domain is changed
nginx -t && systemctl reload nginx
```

## 6. Verify
```bash
curl -sI https://poll.vultusgo.in/ | grep -iE '^HTTP|strict-transport|content-security'   # 200 + both headers
curl -s https://poll.vultusgo.in/api/health                                               # {"status":"ok","db":"ok"}
curl -sI https://chunav.YOUR-COUNTING-DOMAIN/ | head -1                                   # counting site still 200
docker stats --no-stream churu-poll-app churu-poll-db
```
Then in a phone browser: open https://poll.vultusgo.in, log in as `admin`, open **अधिकारी खाते**.

## 7. Demo for a presentation (optional, BEFORE real use only)
```bash
cd /root/churu-poll
sed -i 's/^DEMO_ALLOWED=.*/DEMO_ALLOWED=true/' .env.production
$DC up -d                                                     # the app picks up the new value
# in the app: सेटिंग → set the poll date to TODAY, then:
$DC exec app npm run demo:poll -- --officer-password Demo2026x   # ~150 booths; demo officers log in as demo-<booth> (e.g. demo-rtg-045)
```
**After the presentation, before real use (both steps are required):**
```bash
$DC exec app npm run demo:poll -- --reset                     # removes demo reports and issues
sed -i 's/^DEMO_ALLOWED=.*/DEMO_ALLOWED=false/' .env.production
$DC up -d                                                     # app restarts with DEMO_ALLOWED=false
```
Then set the real poll date again in **सेटिंग**. The ~150 demo officer accounts stay (with random
names). Correct them in **अधिकारी खाते** (नाम/मोबाइल, नया पासवर्ड) or disable them.

## 8. Backups
```bash
mkdir -p /root/backups/churu-poll
/root/churu-poll/deploy/backup.sh                              # one backup now
( crontab -l 2>/dev/null; echo '*/30 * * * * /root/churu-poll/deploy/backup.sh >> /root/backups/churu-poll/backup.log 2>&1' ) | crontab -
```
Restore (only into an empty or throw-away database; this overwrites tables):
```bash
gunzip -c /root/backups/churu-poll/churu_poll-YYYYmmdd-HHMM.sql.gz \
  | docker exec -i churu-poll-db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" churu_poll'
```

## 9. Updating later
```bash
cd /root/churu-poll
/root/churu-poll/deploy/backup.sh                              # always back up first
git pull
export DC="docker compose -f docker-compose.prod.yml --env-file .env.production"
$DC build app
$DC up -d                                                      # recreates only what changed
$DC exec app npm run migrate                                   # safe to run every time
$DC ps && curl -s http://127.0.0.1:3200/api/health
docker image prune -f                                          # frees old image layers
```

## If something is wrong
- `$DC logs --tail 100 app` / `$DC logs --tail 100 db`.
- `curl -s http://127.0.0.1:3200/api/health` works but the site doesn't: it's nginx, DNS or the
  certificate (`nginx -t`, `systemctl status nginx`, `certbot certificates`).
- Login works but you're logged out at once: `APP_ORIGIN` must be exactly `https://poll.vultusgo.in`,
  and nginx must send `X-Forwarded-Proto` (it's in `nginx-poll.conf`).
- Never run `docker compose down -v` here: `-v` deletes the database volume.
