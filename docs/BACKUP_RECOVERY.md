# Stellar Music Backend — Database Backup & Disaster Recovery Specification

## 1. Backup Strategy Overview

The `stellar-music-backend` stores off-chain metadata, split proposals, and settlement history in **PostgreSQL 16**. To protect against hardware failure, corruption, or catastrophic data loss, a robust backup and Point-In-Time-Recovery (PITR) strategy is enforced.

---

## 2. Recovery Objectives

- **Recovery Point Objective (RPO)**: $< 5\text{ minutes}$ (Maximum tolerable data loss).
- **Recovery Time Objective (RTO)**: $< 15\text{ minutes}$ (Maximum tolerable downtime to restore service).

---

## 3. Automated Backup Procedures

### Daily Full Snapshot (`pg_dump`)
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/stellar_music"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
FILENAME="${BACKUP_DIR}/stellar_music_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
pg_dump -U postgres -d stellar_music --no-owner --clean | gzip > "$FILENAME"
echo "Backup created at: $FILENAME"

# Retain last 30 daily snapshots
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -delete
```

### Point-in-Time Recovery (WAL Archiving)
In production, Postgres Write-Ahead Logs (WAL) are shipped to encrypted off-site object storage (AWS S3 / Google Cloud Storage) every 60 seconds, enabling transaction rollback to any exact second prior to an incident.

---

## 4. Restoration Runbook

```bash
# 1. Stop backend service
docker compose stop api

# 2. Restore database from compressed dump
gunzip -c /var/backups/stellar_music/stellar_music_backup_latest.sql.gz | psql -U postgres -d stellar_music

# 3. Re-sync state from Stellar Testnet Horizon ledgers
npx tsx scripts/sync-ledgers.ts

# 4. Restart backend service
docker compose start api
```
