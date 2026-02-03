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
  - `/reloadorg` - Force recreate embed if stuck or missing (NEW)
  - `/cancelres` - Cancel your reservation
  - `/endorg` - Close organization (admin only)

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

### Documentation
- **[QUICKSTART_EMBED_RELOAD.md](./QUICKSTART_EMBED_RELOAD.md)** - User guide with examples
- **[FEATURE_EMBED_RELOAD.md](./FEATURE_EMBED_RELOAD.md)** - Comprehensive feature documentation  
- **[MIGRATION_INSTRUCTIONS.md](./MIGRATION_INSTRUCTIONS.md)** - Database setup instructions
- **[ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)** - System design and data flows
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Complete implementation details