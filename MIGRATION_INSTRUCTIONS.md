# Database Migration Instructions

## New Feature: Embed Reload/Refresh

This update adds a new table `orgState` to track the current organization embed message for reliable retrieval.

### Migration Steps

1. **Set your DATABASE_URL environment variable** if not already set:
   ```bash
   export DATABASE_URL="your_postgresql_connection_string"
   ```

2. **Generate and apply the migration**:
   ```bash
   npm run db:push
   ```

   This will create the new `orgState` table with the following schema:
   ```sql
   CREATE TABLE org_state (
     id SERIAL PRIMARY KEY,
     channel_id TEXT NOT NULL,
     message_id TEXT NOT NULL,
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Restart your bot**:
   ```bash
   npm run dev     # for development
   # or
   npm start       # for production
   ```

### New Commands Available

- `/reloadorg` - Recreate the org embed if it gets stuck or missing in chat
- `/refreshorg` - (Improved) Now uses database-stored message ID for reliable refresh

### How It Works

- When you run `/startorg`, the embed message ID is automatically saved to the database
- `/refreshorg` first tries to use the stored message ID, then falls back to searching recent messages
- `/reloadorg` creates a completely fresh embed with all existing reservation data preserved
- The bot will maintain the message ID across restarts as long as the database persists

### Notes

- All existing reservation data is preserved
- Channel check mappings remain intact
- No data migration is needed for existing installations
