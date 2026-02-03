# Quick Start: Repository Backup System

## 🎯 Overview

This repository now has a comprehensive backup system to protect your code and data.

## 🤖 Automated Backups

**Weekly automatic backups** are created every Sunday at midnight (UTC) via GitHub Actions.

### How to access automated backups:
1. Go to [Releases](https://github.com/shinys129/OpUtilityBot/releases)
2. Look for releases tagged `backup-YYYY-MM-DD`
3. Download the backup archive

### Manual trigger:
1. Go to [Actions](https://github.com/shinys129/OpUtilityBot/actions)
2. Click "Repository Backup" workflow
3. Click "Run workflow" → Select branch → "Run workflow"

## 💾 Database Backups

### Quick backup:
```bash
./script/backup-database.sh
```

This creates:
- `backups/db-backup-YYYY-MM-DD-HHMMSS.dump` (compressed custom format)
- `backups/db-backup-YYYY-MM-DD-HHMMSS.sql.gz` (compressed SQL)

### Quick restore:
```bash
./script/restore-database.sh
```

Follow the prompts to select and restore a backup.

## 📖 Full Documentation

See [BACKUP.md](BACKUP.md) for complete documentation including:
- Manual backup procedures
- Database backup/restore details
- Best practices
- Troubleshooting

## 🔧 Setup Requirements

1. **PostgreSQL client tools** (for database backups):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql-client
   
   # macOS
   brew install postgresql
   ```

2. **Environment variables** in `.env`:
   - `DB_HOST` (default: localhost)
   - `DB_PORT` (default: 5432)
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`

## 🎉 That's It!

Your repository is now protected with:
- ✅ Automated weekly backups
- ✅ Manual backup scripts
- ✅ Easy restore procedures
- ✅ Comprehensive documentation

For any issues, see [BACKUP.md](BACKUP.md) or open an issue.
