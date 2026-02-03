# Backup and Restore Guide

This document provides comprehensive instructions for backing up and restoring the OpUtilityBot repository and its data.

## Table of Contents

1. [Automated Backups](#automated-backups)
2. [Manual Backups](#manual-backups)
3. [Database Backups](#database-backups)
4. [Restoring from Backup](#restoring-from-backup)

---

## Automated Backups

### GitHub Actions Automated Backup

The repository is configured with an automated backup system that runs weekly.

**Schedule:** Every Sunday at 00:00 UTC

**What's Included:**
- All source code files
- Configuration files (excluding `.env` with secrets)
- Documentation
- Scripts

**What's NOT Included:**
- `node_modules` directory (dependencies)
- `.env` file (contains secrets)
- `dist` folder (build artifacts)
- Database data (see Database Backups section)

### Accessing Automated Backups

1. Go to the [Releases](https://github.com/shinys129/OpUtilityBot/releases) page
2. Look for releases tagged with `backup-YYYY-MM-DD`
3. Download the `oputilitybot-backup-YYYY-MM-DD.tar.gz` file

### Triggering a Manual Backup via GitHub Actions

1. Go to the [Actions](https://github.com/shinys129/OpUtilityBot/actions) tab
2. Click on "Repository Backup" workflow
3. Click "Run workflow" button
4. Select the branch (usually `main`)
5. Click "Run workflow"
6. Wait for the workflow to complete
7. The backup will be available in Releases

---

## Manual Backups

### Full Repository Backup (Local)

If you have the repository cloned locally:

```bash
# Navigate to parent directory
cd /path/to/parent/directory

# Create backup archive
tar -czf oputilitybot-backup-$(date +%Y-%m-%d).tar.gz \
  --exclude='OpUtilityBot/.git' \
  --exclude='OpUtilityBot/node_modules' \
  --exclude='OpUtilityBot/dist' \
  --exclude='OpUtilityBot/.env' \
  OpUtilityBot/
```

### Backup Configuration Files

The `.env` file contains sensitive information and should be backed up securely:

```bash
# Backup .env to a secure location
cp .env .env.backup-$(date +%Y-%m-%d)

# Store in a secure password manager or encrypted storage
# DO NOT commit to version control
```

---

## Database Backups

### PostgreSQL Database Backup

The bot uses PostgreSQL for data storage. Regular database backups are crucial.

#### Using pg_dump

```bash
# Set your database credentials
export PGPASSWORD='your_password'

# Full database backup
pg_dump -h localhost -U your_username -d your_database \
  -F c -f oputilitybot-db-backup-$(date +%Y-%m-%d).dump

# Plain SQL backup (human-readable)
pg_dump -h localhost -U your_username -d your_database \
  -F p -f oputilitybot-db-backup-$(date +%Y-%m-%d).sql

# Unset password
unset PGPASSWORD
```

#### Automated Database Backup Script

Create a script `backup-database.sh`:

```bash
#!/bin/bash

# Load environment variables
source .env

# Set backup directory
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# Create backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/db-backup-$(date +%Y-%m-%d-%H%M%S).dump"

# Perform backup
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F c \
  -f "$BACKUP_FILE"

echo "Database backup created: $BACKUP_FILE"

# Optional: Keep only last 7 backups
find $BACKUP_DIR -name "db-backup-*.dump" -mtime +7 -delete
```

Make it executable:
```bash
chmod +x backup-database.sh
```

Run it:
```bash
./backup-database.sh
```

#### Automated Backup with Cron

Add to your crontab for daily backups at 2 AM:

```bash
# Edit crontab
crontab -e

# Add this line:
0 2 * * * cd /path/to/OpUtilityBot && ./backup-database.sh
```

---

## Restoring from Backup

### Restore Repository

```bash
# Extract backup archive
tar -xzf oputilitybot-backup-YYYY-MM-DD.tar.gz

# Navigate to directory
cd OpUtilityBot

# Install dependencies
npm install

# Copy environment example and configure
cp .env.example .env
# Edit .env with your actual credentials

# Build the application
npm run build
```

### Restore Database

#### From Custom Format (.dump)

```bash
# Set credentials
export PGPASSWORD='your_password'

# Restore database
pg_restore -h localhost -U your_username \
  -d your_database --clean --if-exists \
  oputilitybot-db-backup-YYYY-MM-DD.dump

# Unset password
unset PGPASSWORD
```

#### From SQL Format (.sql)

```bash
# Set credentials
export PGPASSWORD='your_password'

# Restore database
psql -h localhost -U your_username -d your_database \
  -f oputilitybot-db-backup-YYYY-MM-DD.sql

# Unset password
unset PGPASSWORD
```

### Complete Restore Procedure

1. **Restore Repository**
   ```bash
   tar -xzf oputilitybot-backup-YYYY-MM-DD.tar.gz
   cd OpUtilityBot
   npm install
   ```

2. **Restore Environment Configuration**
   ```bash
   # Restore your backed-up .env file
   cp /secure/location/.env.backup-YYYY-MM-DD .env
   ```

3. **Restore Database**
   ```bash
   export PGPASSWORD='your_password'
   pg_restore -h localhost -U your_username \
     -d your_database --clean --if-exists \
     db-backup-YYYY-MM-DD.dump
   unset PGPASSWORD
   ```

4. **Verify Database Schema**
   ```bash
   npm run db:push
   ```

5. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

---

## Best Practices

### Regular Backup Schedule

- **Code Repository:** Weekly automated backups via GitHub Actions
- **Database:** Daily automated backups (recommended)
- **Configuration:** After any significant changes to `.env`

### Backup Storage

- Store backups in multiple locations (GitHub Releases, local storage, cloud storage)
- Keep at least 30 days of database backups
- Encrypt backups containing sensitive data
- Test restores regularly to ensure backups are valid

### Security Considerations

- Never commit `.env` files to version control
- Store database backups securely with restricted access
- Rotate backup encryption keys regularly
- Audit who has access to backup files

### Monitoring

- Verify automated backups complete successfully
- Check backup file sizes for consistency
- Test restore procedures quarterly
- Document any restore issues and solutions

---

## Troubleshooting

### Backup Workflow Fails

1. Check GitHub Actions logs for specific errors
2. Verify repository permissions
3. Ensure GITHUB_TOKEN has proper permissions

### Database Backup Fails

1. Verify database credentials
2. Check disk space
3. Ensure pg_dump/pg_restore are installed
4. Verify network connectivity to database

### Restore Issues

1. Verify backup file integrity
2. Check PostgreSQL version compatibility
3. Ensure database exists and is accessible
4. Check for schema conflicts

---

## Additional Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Discord.js Guide](https://discordjs.guide/)

## Support

For issues or questions about backups, please open an issue in the repository.
