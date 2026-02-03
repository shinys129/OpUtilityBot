#!/bin/bash

# Database Restore Script for OpUtilityBot
# This script restores a PostgreSQL database from a backup

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}OpUtilityBot Database Restore Script${NC}"
echo "====================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with your database credentials"
    exit 1
fi

# Load environment variables from .env safely
set -a
source .env
set +a

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

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Backup directory not found: $BACKUP_DIR${NC}"
    exit 1
fi

echo "Available backups:"
echo "------------------"
ls -lt "$BACKUP_DIR"/db-backup-*.dump 2>/dev/null || echo "No .dump backups found"
echo ""

# Get backup file from argument or prompt
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
else
    echo -e "${YELLOW}Enter the path to the backup file:${NC}"
    echo "(e.g., $BACKUP_DIR/db-backup-2026-02-03-120000.dump)"
    read -r BACKUP_FILE
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Restore Configuration:${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_FILE"
echo ""

# Warning prompt
echo -e "${YELLOW}⚠ WARNING: This will replace all data in the '$DB_NAME' database!${NC}"
echo -e "${YELLOW}⚠ Make sure you have a current backup before proceeding.${NC}"
echo ""
echo -e "${YELLOW}Do you want to continue? (yes/no):${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo ""
echo -e "${YELLOW}Checking database connection...${NC}"

# Test database connection
if ! PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "SELECT 1" > /dev/null 2>&1; then
    
    echo -e "${RED}Error: Cannot connect to database${NC}"
    echo "Please check your database credentials and ensure PostgreSQL is running"
    exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}"

# Check if pg_restore is available
if ! command -v pg_restore &> /dev/null; then
    echo -e "${RED}Error: pg_restore not found${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Determine backup file type
if [[ "$BACKUP_FILE" == *.sql ]]; then
    echo -e "${YELLOW}Restoring from SQL backup...${NC}"
    
    if PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$BACKUP_FILE"; then
        
        echo -e "${GREEN}✓ Database restored successfully!${NC}"
    else
        echo -e "${RED}✗ Restore failed${NC}"
        exit 1
    fi
    
elif [[ "$BACKUP_FILE" == *.sql.gz ]]; then
    echo -e "${YELLOW}Decompressing and restoring from SQL backup...${NC}"
    
    if gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME"; then
        
        echo -e "${GREEN}✓ Database restored successfully!${NC}"
    else
        echo -e "${RED}✗ Restore failed${NC}"
        exit 1
    fi
    
else
    # Assume custom format (.dump)
    echo -e "${YELLOW}Restoring from custom format backup...${NC}"
    
    if PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        "$BACKUP_FILE"; then
        
        echo -e "${GREEN}✓ Database restored successfully!${NC}"
    else
        echo -e "${RED}✗ Restore failed${NC}"
        echo ""
        echo "If you see errors about objects already existing, this is normal."
        echo "The --clean flag attempts to drop existing objects first."
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}Verifying database...${NC}"

# Count tables
TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")

echo -e "${GREEN}✓ Found $TABLE_COUNT table(s) in the database${NC}"

echo ""
echo -e "${GREEN}Restore completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify your application configuration (.env)"
echo "2. Run database migrations if needed: npm run db:push"
echo "3. Start the application: npm start"
echo ""
