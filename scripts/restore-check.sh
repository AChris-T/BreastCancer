#!/usr/bin/env bash
# Proves a backup can be restored, without touching the live database:
# decrypts it into a fresh scratch database and counts rows.
#   BACKUP_PASSPHRASE=... scripts/restore-check.sh backups/<file>.dump.enc
set -euo pipefail

: "${BACKUP_PASSPHRASE:?Set BACKUP_PASSPHRASE}"
file="${1:?Usage: restore-check.sh <backup.dump.enc>}"
db="breastscan_restore_check_$(date -u +%Y%m%d%H%M%S)"
psql=(docker compose exec -T postgres psql -U breastscan -v ON_ERROR_STOP=1)

"${psql[@]}" -d postgres -c "CREATE DATABASE $db" >/dev/null
trap '"${psql[@]}" -d postgres -c "DROP DATABASE IF EXISTS $db" >/dev/null' EXIT

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file" |
  docker compose exec -T postgres pg_restore -U breastscan --no-owner -d "$db"

"${psql[@]}" -d "$db" -At -c \
  'SELECT $$users=$$ || count(*) FROM "User" UNION ALL SELECT $$scans=$$ || count(*) FROM "Scan" UNION ALL SELECT $$analyses=$$ || count(*) FROM "Analysis"'
echo "Restore check passed ($db dropped afterwards)"
