#!/bin/bash

# Database Backup Script for OpUtilityBot
# This script creates a backup of the PostgreSQL database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}OpUtilityBot Database Backup Script${NC}"
echo "===================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with your database credentials"
    exit 1
fi

# Load environment variables from .env
export $(grep -v '^#' .env | xargs)

# Set default values if not provided
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

# Check required variables
if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo -e "${RED}Error: Missing required database credentials${NC}"
    echo "Please ensure DB_USER and DB_NAME are set in .env"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup filename with timestamp
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db-backup-$TIMESTAMP.dump"
BACKUP_SQL="$BACKUP_DIR/db-backup-$TIMESTAMP.sql"

echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump not found${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

echo -e "${YELLOW}Creating database backup...${NC}"

# Perform backup in custom format (compressed, recommended for large databases)
if PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F c \
    -f "$BACKUP_FILE"; then
    
    echo -e "${GREEN}✓ Custom format backup created: $BACKUP_FILE${NC}"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "  Size: $SIZE"
else
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi

# Also create a plain SQL backup for easy inspection
echo -e "${YELLOW}Creating SQL backup...${NC}"

if PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F p \
    -f "$BACKUP_SQL"; then
    
    echo -e "${GREEN}✓ SQL format backup created: $BACKUP_SQL${NC}"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_SQL" | cut -f1)
    echo "  Size: $SIZE"
else
    echo -e "${YELLOW}⚠ SQL backup failed (custom backup still available)${NC}"
fi

# Optional: Compress SQL backup
if [ -f "$BACKUP_SQL" ]; then
    echo -e "${YELLOW}Compressing SQL backup...${NC}"
    gzip "$BACKUP_SQL"
    echo -e "${GREEN}✓ Compressed to: $BACKUP_SQL.gz${NC}"
fi

echo ""
echo -e "${GREEN}Backup completed successfully!${NC}"
echo ""

# Optional: Clean up old backups (keep last 7 days)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
echo -e "${YELLOW}Cleaning up backups older than $RETENTION_DAYS days...${NC}"

DELETED_COUNT=$(find "$BACKUP_DIR" -name "db-backup-*.dump" -mtime +$RETENTION_DAYS -delete -print | wc -l)
find "$BACKUP_DIR" -name "db-backup-*.sql.gz" -mtime +$RETENTION_DAYS -delete

if [ "$DELETED_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Deleted $DELETED_COUNT old backup(s)${NC}"
else
    echo "  No old backups to delete"
fi

echo ""
echo "Backup Summary:"
echo "---------------"
echo "Latest backups in $BACKUP_DIR:"
ls -lht "$BACKUP_DIR"/db-backup-* 2>/dev/null | head -5

echo ""
echo -e "${GREEN}Done!${NC}"
