# OpNamingBot - Discord Pokemon Identifier Bot

## Overview
OpNamingBot is a Discord bot that identifies Pokemon spawns using machine learning. It monitors Discord channels for Pokemon spawn images and uses a TensorFlow/Keras model to identify them.

## Project Structure
- `OpNamingBot/` - Main bot directory
  - `main.py` - Bot entry point
  - `lib/` - Helper modules
    - `config.py` - Configuration handling
    - `TheOutNModule.py` - Pokemon identification logic
    - `hint_helper.py`, `catch_helper.py` - Game helpers
    - `spawn_embeds.py`, `cmd_embeds.py` - Discord embed builders
  - `data/` - ML model and classification data
    - `model.h5` - TensorFlow model
    - `classes.json` - Pokemon classification mapping

## Configuration
The bot requires a `DISCORD_TOKEN` secret to run. Optional environment variables:
- `RPING` / `RPINGCONFIRM` - Rare ping role ID
- `REGPING` / `REGPINGCONFIRM` - Regional ping role ID
- `STARCH` / `STARCHCONFIRM` - Starboard channel ID
- `CLOG` / `CLOGCONFIRM` - Catch log channel ID
- `SPAWNLOG` / `SPAWNLOGCONFIRM` - Spawn log channel ID

## Running the Bot
The bot runs via the "Discord Bot" workflow which executes `cd OpNamingBot && python main.py`.

## Dependencies
- Python 3.11
- discord.py
- TensorFlow 2.16.1
- Keras 3.3.3
- Pillow
- aiohttp
- numpy

## Recent Changes
- February 1, 2026: Major improvements
  - Fixed embed name extraction to properly handle Poketwo's generic spawn messages
  - Added learning system: `on.correct <wrong> -> <correct>` to teach the bot
  - Added form aliases for Rotom, Arceus, regional variants (Alolan, Galarian, Hisuian)
  - View learned corrections: `on.corrections`
  - Forget a correction: `on.forget <name>`
  - Changed type display to show underneath name: "Type: 🔥" format
  - Added rate limiting protection with 0.5s delays between messages
  - Types fetched from PokeAPI and cached for performance
- January 31, 2026: Added watchlist feature
  - `on.watch <pokemon>` - Add a Pokemon to watch
  - `on.unwatch <pokemon>` - Remove a Pokemon from watchlist
  - `on.watchlist` - View all watched Pokemon
  - When a watched Pokemon spawns, shows just the name (no embed)
- January 31, 2026: Initial Replit setup
  - Modified config.py to support environment variables
  - Set up workflow for running the bot
