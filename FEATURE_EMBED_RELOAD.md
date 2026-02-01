# New Feature: Embed Reload/Refresh System

## Overview
This update adds robust embed reload and refresh functionality to prevent issues when embeds get missing or stuck in chat.

## The Problem
Previously, if the organization embed moved beyond the last 50 messages in chat, or if Discord had issues displaying it, users had no reliable way to:
- Find the embed
- Refresh its content
- Recreate it without losing reservation data

## The Solution

### 1. Database-Backed Message Tracking
The bot now stores the embed message ID in the database (`orgState` table), allowing it to:
- Directly fetch the embed message by ID (instant, no searching)
- Track which channel the embed is in
- Persist message location across bot restarts

### 2. New `/reloadorg` Command
**Purpose**: Force recreate the embed if it's completely stuck or missing

**How it works**:
1. Fetches all current reservation data from database
2. Creates a brand new embed message with all the data
3. Saves the new message ID to database
4. Confirms success to the user

**When to use**: 
- Embed is completely missing from chat
- Embed appears stuck or won't update
- After Discord outages or issues

**Example**:
```
User: /reloadorg
Bot: [Creates new embed with all current reservations]
Bot: ✅ Embed reloaded successfully! All reservation data has been preserved.
```

### 3. Improved `/refreshorg` Command
**Purpose**: Refresh the existing embed with latest data

**How it works** (now with smart fallback):
1. **First**: Try to fetch using stored message ID from database (fast, reliable)
2. **Fallback**: If stored ID fails, search last 50 messages for the embed
3. **Update**: Refresh the embed with current reservation/channel data
4. **Save**: Update the stored message ID if found via search

**When to use**:
- Want to update the embed with latest information
- Embed is visible but might be outdated
- After making changes via other commands

**Example**:
```
User: /refreshorg
Bot: ✅ Embed refreshed successfully! All data preserved.
```

### 4. Smart Message Finding
A new helper function `findOrgMessage()` provides consistent, reliable embed location:
- Tries database-stored ID first (instant)
- Falls back to message search if needed
- Auto-updates database when found via search
- Used throughout the codebase for consistency

## Visual Updates

The embed footer now displays:
```
Use /refreshorg to update • /reloadorg if stuck • /endorg to close
```

This reminds users of available options directly in the embed.

## Technical Details

### Database Schema
New table `orgState`:
```sql
CREATE TABLE org_state (
  id SERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
)
```

### Storage Methods Added
- `getOrgState()` - Retrieve current org message info
- `setOrgState(channelId, messageId)` - Store org message location
- `clearOrgState()` - Remove stored state (used by `/endorg`)

### Bot Updates
- New `/reloadorg` slash command
- Enhanced `/refreshorg` with database lookup
- `/startorg` saves message ID automatically
- `/endorg` clears message ID
- Helper function for consistent message finding

## User Benefits

1. **Reliability**: Embeds won't get "lost" anymore
2. **Recovery**: Easy to recreate embed without data loss
3. **Speed**: Faster refresh using direct message ID lookup
4. **Persistence**: Message tracking survives bot restarts
5. **Flexibility**: Two options (refresh vs reload) for different scenarios

## Migration

For existing installations:
1. Run `npm run db:push` to create the `orgState` table
2. Restart the bot
3. Existing embeds will be auto-tracked on next refresh
4. No data migration needed

See `MIGRATION_INSTRUCTIONS.md` for detailed steps.

## Command Summary

| Command | Purpose | Data Preserved | Creates New Message |
|---------|---------|----------------|-------------------|
| `/startorg` | Start new org round | No (fresh start) | Yes |
| `/refreshorg` | Update existing embed | Yes | No |
| `/reloadorg` | Recreate stuck embed | Yes | Yes |
| `/endorg` | Close org | No (clears all) | No (edits existing) |

## Example Scenarios

**Scenario 1: Embed scrolled out of view**
- User tries `/refreshorg`
- Bot finds it using stored message ID ✅
- Embed updates instantly

**Scenario 2: Embed completely missing**
- User tries `/refreshorg`
- Bot searches but can't find it
- Bot suggests using `/reloadorg`
- User runs `/reloadorg`
- Bot creates fresh embed with all data ✅

**Scenario 3: After Discord outage**
- Embed appears broken or stuck
- User runs `/reloadorg`
- Fresh embed replaces broken one ✅
- All reservations intact
