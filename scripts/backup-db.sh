#!/usr/bin/env bash
# Encrypted PostgreSQL backup.
#   BACKUP_PASSPHRASE=... scripts/backup-db.sh [output-dir]
# Local: dumps the docker-compose database. Production: set DATABASE_URL and
# have pg_dump on PATH; run daily from cron or your host's scheduler, and
# copy the file to storage separate from the database host.
set -euo pipefail

: "${BACKUP_PASSPHRASE:?Set BACKUP_PASSPHRASE (store it in your secrets manager)}"
out_dir="${1:-backups}"
mkdir -p "$out_dir"
file="$out_dir/breastscan-$(date -u +%Y%m%dT%H%M%SZ).dump.enc"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --format=custom --no-owner "$DATABASE_URL"
else
  docker compose exec -T postgres pg_dump -U breastscan --format=custom --no-owner breastscan
fi | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$file"

echo "Backup written: $file ($(wc -c <"$file") bytes)"
