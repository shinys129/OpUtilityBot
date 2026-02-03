import sys
import asyncio
import time
import discord
from discord.ext import commands

sys.path.append('lib')
from config import get_config, TKN, clogconfirm
from TheOutNModule import outnmodule, identifycmd
import hint_helper
import catch_helper
import cmd_embeds
import collection  # renamed module (was watchlist)
import form_aliases

version = 'v8'

# Rate limiting protection
_last_send_time = 0
_send_lock = asyncio.Lock()
MIN_SEND_DELAY = 0.5  # Minimum delay between messages in seconds

# config
get_config()

# bot setup
intents = discord.Intents.all()
intents.message_content = True
intents.members = True
bot = commands.Bot(command_prefix='on.', intents=intents)
bot.remove_command('help')

# The spawn bot ID your code checks for
SPAWN_BOT_ID = 716390085896962058


async def _safe_send(channel, content=None, embed=None):
  """Send to a channel with rate limiting protection."""
  global _last_send_time
  if channel is None:
    print("safe_send: channel is None, skipping send")
    return None
  
  async with _send_lock:
    # Calculate delay needed to avoid rate limiting
    current_time = time.time()
    elapsed = current_time - _last_send_time
    if elapsed < MIN_SEND_DELAY:
      await asyncio.sleep(MIN_SEND_DELAY - elapsed)
    
    try:
      result = await channel.send(content=content, embed=embed)
      _last_send_time = time.time()
      return result
    except discord.Forbidden:
      print(f"Forbidden: missing access to send in channel {getattr(channel, 'id', None)}")
    except discord.HTTPException as e:
      print(f"HTTPException when sending message to {getattr(channel, 'id', None)}: {e}")
      # If rate limited, wait longer next time
      if e.status == 429:
        await asyncio.sleep(1.0)
    except Exception as e:
      print(f"Unexpected error when sending message: {e}")
  return None


@bot.event
async def on_ready():
  print(f"{'='*40}")
  print(f"{'The OutN Project':^40}")
  print(f"{'='*40}")
  print(f"{'Version:':<10} {version}")
  print(f"{'GitHub:':<10} {'https://github.com/Pranjal-SB/OutN'}")
  print()
  print(f"{'Logged in as':<10} {bot.user.name}#{bot.user.discriminator}")
  print(f"{'Bot User ID:':<10} {bot.user.id}")
  print(f"{'='*40}")
  # debug: report whether collection.handle_command is available
  try:
    print(f"collection.handle_command available: {hasattr(collection, 'handle_command')}")
  except Exception:
    pass
  await bot.change_presence(status=discord.Status.online, activity=discord.Game("Pokémon"))


@bot.event
async def on_message(message):
  # Ignore DMs
  if message.guild is None:
    return

  # Avoid processing other bots' messages except the spawn bot we rely on
  # Also avoid processing our own messages (prevents loops)
  if message.author.bot and message.author.id != SPAWN_BOT_ID:
    return
  if message.author.id == bot.user.id:
    return

  # If message is from the spawn bot, handle embed spawn flow first
  if message.author.id == SPAWN_BOT_ID:
    if len(message.embeds) > 0:
      embed = message.embeds[0]
      if embed and getattr(embed, "title", None) and "appeared!" in embed.title and getattr(embed, "image", None):
        url = embed.image.url
        try:
          await outnmodule(bot, message, url)
        except Exception as e:
          print("Error in outnmodule:", e)
        return

    # spawn-bot may also post hints / other content handled below
    if 'The pokémon is ' in message.content:
      for i in hint_helper.solve(message.content):
        try:
          await hint_helper.hint_embed(i, message)
        except Exception as e:
          print("Error sending hint embed:", e)
      return

    if 'Congratulations' in message.content and clogconfirm in 'Yy':
      try:
        await catch_helper.catch_identifier(bot, message)
      except Exception as e:
        print("Error in catch_identifier:", e)
      return

  # Non-spawn-bot flows
  if 'The pokémon is ' in message.content:
    for i in hint_helper.solve(message.content):
      try:
        await hint_helper.hint_embed(i, message)
      except Exception as e:
        print("Error sending hint embed:", e)
    return

  # Bot correction commands (teach the bot when it makes mistakes)
  content = message.content or ""
  lstripped = content.lstrip()
  lower_lstripped = lstripped.lower()
  
  # Handle correction commands: on.correct <wrong> -> <correct>
  if lower_lstripped.startswith('on.correct ') or lower_lstripped.startswith('on.teach '):
    parts = content.split(None, 1)
    if len(parts) > 1:
      correction_text = parts[1]
      # Parse "wrong -> correct" or "wrong = correct" format
      if '->' in correction_text:
        wrong, correct = correction_text.split('->', 1)
      elif '=' in correction_text:
        wrong, correct = correction_text.split('=', 1)
      else:
        await _safe_send(message.channel, "Use format: `on.correct <wrong name> -> <correct name>`\nExample: `on.correct heat rotom -> rotom-heat`")
        return
      wrong = wrong.strip().lower()
      correct = correct.strip().lower()
      if wrong and correct:
        form_aliases.add_correction(wrong, correct)
        await _safe_send(message.channel, f"Learned: **{wrong}** should be **{correct}**")
      else:
        await _safe_send(message.channel, "Please provide both wrong and correct names.")
    else:
      await _safe_send(message.channel, "Use format: `on.correct <wrong name> -> <correct name>`")
    return
  
  # List all corrections
  if lower_lstripped.startswith('on.corrections') or lower_lstripped.startswith('on.learned'):
    corrections = form_aliases.get_all_corrections()
    if corrections:
      lines = [f"**{wrong}** -> **{correct}**" for wrong, correct in corrections.items()]
      await _safe_send(message.channel, "**Learned Corrections:**\n" + "\n".join(lines[:20]))
    else:
      await _safe_send(message.channel, "No corrections learned yet. Use `on.correct <wrong> -> <correct>` to teach me!")
    return
  
  # Remove a correction
  if lower_lstripped.startswith('on.uncorrect ') or lower_lstripped.startswith('on.forget '):
    parts = content.split(None, 1)
    if len(parts) > 1:
      wrong = parts[1].strip().lower()
      if form_aliases.remove_correction(wrong):
        await _safe_send(message.channel, f"Forgot correction for **{wrong}**")
      else:
        await _safe_send(message.channel, f"No correction found for **{wrong}**")
    else:
      await _safe_send(message.channel, "Use format: `on.forget <name>`")
    return

  # Short-hand "o!" commands: convert to full "on." commands and delegate
  if lower_lstripped.startswith('o!'):
    # parse token and rest
    parts = lstripped.split(None, 1)
    token = parts[0].lower()  # e.g., "o!add"
    rest = parts[1] if len(parts) > 1 else ""
    # mapping: shorthand -> on.* equivalent
    mapping = {
      'o!add': 'on.watch',
      'o!a': 'on.watch',
      'o!watch': 'on.watch',
      'o!w': 'on.watch',
      'o!remove': 'on.unwatch',
      'o!rem': 'on.unwatch',
      'o!rm': 'on.unwatch',
      'o!unwatch': 'on.unwatch',
      'o!uw': 'on.unwatch',
      'o!sh': 'on.shiny',
      'o!shiny': 'on.shiny',
      'o!list': 'on.watchlist',
      'o!wl': 'on.watchlist',
      'o!commands': 'on.commands',
      'o!help': 'on.commands',
    }
    target = mapping.get(token)
    if target:
      new_content = f"{target} {rest}".strip()
      try:
        # delegate to collection handler with override
        if hasattr(collection, 'handle_command'):
          await collection.handle_command(bot, message, content_override=new_content)
          return
        elif hasattr(collection, 'process_command'):
          # fallback: if process_command expects a message, we can't easily override content,
          # so rewrite message.content by creating a proxy object (simple approach: call identify/help)
          await _safe_send(message.channel, "Short-hand commands are enabled but collection module has no handle_command().")
          return
      except Exception as e:
        print("Error delegating shorthand command to collection:", e)
        return
    # unknown shorthand, fall through to legacy handling (below) so user sees usage/help

  # Legacy "on." / "on!" commands: delegate any message that starts with "on." or "on!"
  ls = content.lstrip()
  lsl = ls.lower()
  if lsl.startswith('on.') or lsl.startswith('on!'):
    # debug log (show if dot or bang used)
    prefix = 'on.' if lsl.startswith('on.') else 'on!'
    print(f"[main.on_message] Delegating legacy '{prefix}' message to collection handler. Author={message.author.id} Guild={message.guild.id} Content={content!r}")
    try:
      # Prefer a dedicated handler if the collection module exposes one
      if hasattr(collection, 'handle_command'):
        await collection.handle_command(bot, message)
        return
      elif hasattr(collection, 'process_command'):
        result = collection.process_command(message)
        if hasattr(result, '__await__'):
          await result
        return
      else:
        # fallback: provide legacy help / identify behaviors so users get feedback
        msg = content
        msg_lower = msg.lower()
        chnl = message.channel

        # help (legacy)
        if 'help' in msg_lower:
          try:
            await cmd_embeds.help_embed(chnl)
          except Exception as e:
            print("Error sending help embed:", e)
          return

        # identify (legacy)
        if 'identify' in msg_lower:
          if message.attachments:
            url = message.attachments[0].url
            try:
              await identifycmd(message, url)
            except Exception as e:
              print("Error running identifycmd:", e)
            return
          else:
            parts = msg.split()
            url = None
            for p in parts:
              if p.startswith('http://') or p.startswith('https://'):
                url = p
                break
            if url:
              try:
                await identifycmd(message, url)
              except Exception as e:
                print("Error running identifycmd on text URL:", e)
            return

        await _safe_send(chnl, "Legacy command received, but collection handler is not available.")
        return
    except Exception as e:
      # log and swallow so we don't fall through to process_commands
      print("Error delegating legacy command to collection handler:", e)
      return

  # Allow other command processors (if you also use commands extension)
  try:
    await bot.process_commands(message)
  except Exception as e:
    # ignore CommandNotFound logs routing to legacy parser; only print other errors
    import discord.ext.commands as _cmd_mod
    if isinstance(e, _cmd_mod.CommandNotFound):
      return
    print("Error in process_commands:", e)


bot.run(TKN)