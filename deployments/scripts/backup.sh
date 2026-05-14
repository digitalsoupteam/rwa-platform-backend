#!/bin/bash

# Configuration
BACKUP_DIR="./infrastructure/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
RETENTION_DAYS=30

echo "--------------------------------------------------"
echo "💾 Starting full backup: $TIMESTAMP"
echo "--------------------------------------------------"

# 1. Create backup directory
mkdir -p "$BACKUP_PATH"

# 2. Backup MongoDB
echo "Backing up MongoDB..."
docker exec mongodb mongodump --archive --gzip > "$BACKUP_PATH/mongodb_dump.archive.gz"

# 3. Backup SQLite databases and Secrets
echo "Backing up Configs, Secrets and SQLite DBs..."
mkdir -p "$BACKUP_PATH/files"
cp -r ./infrastructure/docker/authelia/config/*.sqlite3 "$BACKUP_PATH/files/" 2>/dev/null
cp -r ./infrastructure/docker/authelia/secrets "$BACKUP_PATH/files/"
cp -r ./infrastructure/docker/lldap/data "$BACKUP_PATH/files/lldap_data"
cp -r ./infrastructure/docker/nginx/ssl "$BACKUP_PATH/files/nginx_ssl"
cp ./infrastructure/docker/nginx/.htpasswd "$BACKUP_PATH/files/" 2>/dev/null

# 4. Create final archive
echo "Creating archive..."
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"

# 5. Cleanup temporary folder
rm -rf "$BACKUP_PATH"

# 6. Delete backups older than 30 days
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "--------------------------------------------------"
echo "✅ Backup completed: $BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
echo "--------------------------------------------------"
