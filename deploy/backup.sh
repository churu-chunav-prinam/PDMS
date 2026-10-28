#!/bin/bash
# Backup of the churu_poll database (consistent snapshot, triggers included), kept 14 days.
#   /root/churu-poll/deploy/backup.sh            -> /root/backups/churu-poll/churu_poll-YYYYmmdd-HHMM.sql.gz
# Cron (every 30 min on poll day):  */30 * * * * /root/churu-poll/deploy/backup.sh >> /root/backups/churu-poll/backup.log 2>&1
set -euo pipefail
dir=/root/backups/churu-poll
mkdir -p "$dir" && chmod 700 "$dir"
file="$dir/churu_poll-$(date +%Y%m%d-%H%M).sql.gz"
docker exec churu-poll-db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --hex-blob churu_poll' \
  | gzip > "$file.tmp"
mv "$file.tmp" "$file"
find "$dir" -name 'churu_poll-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') backup ok: $file ($(du -h "$file" | cut -f1))"
