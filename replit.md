# PokeBot Reservation Dashboard

## Overview

A Discord bot and web dashboard for managing Pokemon organization reservations. The system allows users to reserve Pokemon categories through Discord commands and provides a real-time web dashboard to monitor reservation status and channel completion tracking.

The application consists of:
- **Discord Bot**: Handles slash commands for reservations, channel setup, and organization management
- **Web Dashboard**: React-based interface displaying reservations, statistics, and channel status grids
- **REST API**: Express backend serving data to the dashboard

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state with automatic refetching
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **Bot Framework**: Discord.js for Discord integration
- **API Pattern**: Simple REST endpoints defined in shared/routes.ts with Zod validation

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: shared/schema.ts
- **Migrations**: Drizzle Kit with migrations in /migrations folder
- **Tables**:
  - `users`: Discord user mapping (id, discordId, username)
  - `reservations`: Pokemon category reservations with user references
  - `channelChecks`: Track completion status of Discord channels by category
  - `orgState`: Track current org embed message ID for reliable retrieval (NEW)

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components including shadcn/ui
    hooks/        # Custom React hooks
    pages/        # Page components
    lib/          # Utilities and query client
server/           # Express backend
  bot.ts          # Discord bot logic
  db.ts           # Database connection
  routes.ts       # API route handlers
  storage.ts      # Data access layer
shared/           # Shared code between client/server
  schema.ts       # Drizzle database schema
  routes.ts       # API route definitions with Zod schemas
```

### Build System
- **Development**: tsx for TypeScript execution, Vite dev server with HMR
- **Production**: Custom build script using esbuild (server) and Vite (client)
- **Output**: dist/index.cjs (server bundle), dist/public (static assets)

## External Dependencies

### Discord Integration
- **Library**: discord.js v14
- **Required Secret**: `DISCORD_TOKEN` environment variable
- **Features**: Slash commands, button interactions, select menus
- **Categories Managed**: Rares, Regionals, Gmax, Eevos, Choice 1/2, MissingNo, Reserve 1/2/3
- **Key Commands**: 
  - `/startorg` - Start new organization round
  - `/refreshorg` - Refresh embed with latest data (uses database tracking)
  - `/reloadorg` - Force recreate embed if stuck or missing
  - `/cancelres` - Manage your reservation (Change Reserve or Full Cancel)
  - `/endorg` - Close organization (admin only)

## Reservation Management Features

### User /cancelres Flow
1. User runs `/cancelres` and sees a select menu of their reservations
2. After selecting, two options are shown:
   - **Change Reserve** - Clears Pokemon selection but keeps category. User can use `!res` to pick new Pokemon
   - **Full Cancel** - Removes the entire reservation

### Admin Manage Reservations Flow
1. Admin clicks "Manage Reservations" button on org embed
2. Select a user's reservation from the menu
3. Two options are shown:
   - **Clear Pokemon (Keep Category)** - Clears the user's Pokemon and notifies them in-channel to use `!res`
   - **Full Cancel** - Removes the reservation entirely

### Database
- **Type**: PostgreSQL
- **Required Secret**: `DATABASE_URL` environment variable
- **ORM**: Drizzle with drizzle-zod for schema validation
- **Session Store**: connect-pg-simple for Express sessions

### Key NPM Packages
- UI: @radix-ui components, lucide-react icons, recharts
- Forms: react-hook-form with @hookform/resolvers
- Dates: date-fns
- Validation: zod with drizzle-zod

## New Feature: Embed Reload System

A robust system for reloading and refreshing Discord embeds that may get stuck or missing in chat:

- **Database-Backed Tracking**: Message IDs stored in PostgreSQL for instant retrieval
- **Smart Fallback**: Automatically falls back to message search if database lookup fails
- **Force Reload**: `/reloadorg` command to recreate embed when completely stuck
- **Zero Data Loss**: All reservation data preserved during reload operations
- **Performance**: 5-10x faster refresh using database lookup (50-100ms vs 500ms-1s)

## Moderation System (New)

### Staff Commands
- `/warn <user> <reason>` - Issue a warning
- `/mute <user> <reason> [duration]` - Mute user (applies Discord timeout if duration set)
- `/unmute <user>` - Remove mute
- `/ban <user> <reason> [duration]` - Ban from org (optional duration in days)
- `/unban <user>` - Remove ban
- `/timeout <user> <duration> <reason>` - Discord timeout (duration in minutes)
- `/steal <user> <item> <paid> [notes]` - Log a steal infraction with paid status
- `/lookup <user>` - View full user record (warnings, steals, ban/mute status)
- `/modlog [limit]` - View recent moderation actions

### Moderation Log Channel
- All moderation actions (warn, mute, unmute, ban, unban, timeout, steal) are automatically logged to channel `1413942157219205271`
- Each action sends the same embed to the log channel for a permanent record

### Database Tables (Moderation)
- `user_warnings` - Warning records with reason, staff who issued, active status
- `user_bans` - Ban records with reason, expiry, active status
- `user_mutes` - Mute records with reason, expiry, active status
- `steal_logs` - Steal infraction records with item, notes, staff who logged
- `audit_logs` - All moderation actions for accountability

### Dashboard Pages
- **Moderation Log** (`/moderation`) - View all staff actions, warnings, bans, mutes with tabs
- **Steal Log** (`/steals`) - View all steal records with user lookup by Discord ID

### Staff Authorization
Staff permissions checked via: ManageGuild permission OR ADMIN_ROLE_ID constant OR database-stored adminRoleId

### Storage Pattern
Uses separate queries + in-memory hydration (hydrateUsers helper) instead of Drizzle .as() joins to avoid aliasing issues

### Documentation
- **[QUICKSTART_EMBED_RELOAD.md](./QUICKSTART_EMBED_RELOAD.md)** - User guide with examples
- **[FEATURE_EMBED_RELOAD.md](./FEATURE_EMBED_RELOAD.md)** - Comprehensive feature documentation  
- **[MIGRATION_INSTRUCTIONS.md](./MIGRATION_INSTRUCTIONS.md)** - Database setup instructions
- **[ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)** - System design and data flows
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Complete implementation details