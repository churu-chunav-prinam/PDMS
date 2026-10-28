#!/bin/bash
# Writes .env.production from .env.production.example with fresh random secrets.
#   ./deploy/make-env.sh poll.vultusgo.in        (or http://localhost:3200 for a local check)
# Refuses to overwrite an existing .env.production. Secrets are letters/digits only (shell/SQL safe).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -e .env.production ]; then echo "make-env: .env.production already exists; not touching it" >&2; exit 1; fi
host="${1:?usage: make-env.sh <domain or full origin>}"
case "$host" in http://*|https://*) origin="$host" ;; *) origin="https://$host" ;; esac
rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
umask 077
sed -e "s|^APP_ORIGIN=.*|APP_ORIGIN=${origin}|" \
    -e "s|^SESSION_SECRET=.*|SESSION_SECRET=$(rand 48)|" \
    -e "s|^DB_APP_PASSWORD=.*|DB_APP_PASSWORD=$(rand 28)|" \
    -e "s|^DB_MIGRATION_PASSWORD=.*|DB_MIGRATION_PASSWORD=$(rand 28)|" \
    -e "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$(rand 28)|" \
    .env.production.example > .env.production
echo "make-env: wrote .env.production (chmod 600) for ${origin}"
