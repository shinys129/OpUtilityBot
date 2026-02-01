# Quick Start Guide: Embed Reload Feature

## Problem: Embed Missing or Stuck? 🔍

Your org embed can get lost or stuck in chat. Here's how to fix it!

## Solution: Two Commands ⚡

### 1. `/refreshorg` - Quick Update
**Use when**: Embed is visible but needs updating

```
What it does:
1. Looks up embed location in database (instant!)
2. Falls back to searching if needed
3. Updates embed with current data
4. All reservations preserved ✅
```

**Example**:
```
User: /refreshorg
Bot: ✅ Embed refreshed successfully! All data preserved.
```

---

### 2. `/reloadorg` - Force Recreate
**Use when**: Embed is stuck, broken, or completely missing

```
What it does:
1. Fetches all reservation data from database
2. Creates a brand NEW embed message
3. Displays all current reservations
4. All data preserved ✅
```

**Example**:
```
User: /reloadorg
Bot: [Creates fresh new embed]
Bot: ✅ Embed reloaded successfully! All reservation data has been preserved.
```

---

## When to Use Each Command

| Situation | Command | Why |
|-----------|---------|-----|
| Just want to update data | `/refreshorg` | Faster, updates existing embed |
| Embed won't update | `/reloadorg` | Creates fresh embed |
| Embed missing from chat | `/reloadorg` | Recreates it with all data |
| After Discord outage | `/reloadorg` | Fresh start, everything works |
| Regular updates | `/refreshorg` | Quick and efficient |

---

## Behind the Scenes 🔧

### How it stays reliable:
1. **Database Storage**: Message ID stored in database
2. **Smart Lookup**: Tries database first, then searches
3. **Auto-Recovery**: Updates database if found via search
4. **Fallback**: Always has a plan B

### Data Safety:
- ✅ All reservations stored in database
- ✅ Never lost when recreating embed
- ✅ Channel check progress preserved
- ✅ User information maintained

---

## Common Scenarios

### Scenario 1: Regular Update
```
Situation: Someone made a reservation, embed needs updating
Action: /refreshorg
Result: Embed updates in place, shows new reservation
```

### Scenario 2: Embed Scrolled Away
```
Situation: Lots of chat messages, embed is way up
Action: /refreshorg
Result: Bot finds it using database ID, updates it instantly
```

### Scenario 3: Embed Completely Missing
```
Situation: Embed nowhere to be found
Action: /refreshorg
Result: "❌ No active org embed found. Use /reloadorg to recreate it"
Action: /reloadorg
Result: Fresh embed created with all data intact ✅
```

### Scenario 4: Embed Looks Broken
```
Situation: Embed appears corrupted or frozen
Action: /reloadorg
Result: New working embed replaces the broken one
```

---

## Tips 💡

1. **Try `/refreshorg` first** - It's faster if the embed is still there
2. **Use `/reloadorg` as backup** - When refresh doesn't work
3. **Don't worry about data loss** - Everything is in the database
4. **Works across bot restarts** - Message tracking persists

---

## Admin Commands

Remember these related commands:
- `/startorg` - Start a new org round (clears old data)
- `/endorg` - Close current org (admin only)
- `/setchannels` - Register channels to categories (admin only)
- `/cancelres` - Cancel your own reservation

---

## For Developers

See detailed documentation:
- `FEATURE_EMBED_RELOAD.md` - Complete feature documentation
- `MIGRATION_INSTRUCTIONS.md` - Database migration steps
- Database schema includes new `orgState` table

---

## Need Help?

If embeds continue to have issues:
1. Try `/reloadorg` first
2. Check bot permissions (needs "Manage Messages")
3. Verify database connection is working
4. Contact bot administrator

---

## Version Info

Feature added: 2026-02-01
Commands: `/refreshorg` (improved), `/reloadorg` (new)
Database: Requires `orgState` table migration
