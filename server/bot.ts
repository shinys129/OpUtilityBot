import { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Interaction, Message, TextChannel, StringSelectMenuBuilder, PermissionFlagsBits, type Collection, type Snowflake } from "discord.js";
import type { Message as DiscordMessage } from "discord.js";
import { storage } from "./storage";

// Admin Role ID that can use admin commands
const ADMIN_ROLE_ID = '1402994392608018553';

// Constants for Category Configuration
const CATEGORIES = {
  RARES: { name: 'Rares', range: '1-23' },
  REGIONALS: { name: 'Regionals', range: '24-43' },
  GMAX: { name: 'Gmax', range: '44-59' },
  EEVOS: { name: 'Eevos', range: '60-67' },
  CHOICE1: { name: 'Choice 1', range: '68-74' },
  CHOICE2: { name: 'Choice 2', range: '75-81' },
  MISSINGNO: { name: 'MissingNo', range: '82-88' },
  RESERVE1: { name: 'Reserve 1', range: '89-92' },
  RESERVE2: { name: 'Reserve 2', range: '93-96' },
  RESERVE3: { name: 'Reserve 3', range: '97-100' },
  BOOSTER: { name: 'Server Booster Reserves', range: 'N/A' },
  STAFF: { name: 'Staff Reserve', range: 'N/A' },
};

let client: Client | null = null;
let boosterUnlocked = false;

export async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.log("Skipping Discord Bot start: DISCORD_TOKEN not found.");
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    registerSlashCommands();
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
      }
    } catch (error) {
      console.error("Interaction error:", error);
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    await handleMessage(message);
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("Failed to login to Discord:", error);
  }
}

async function registerSlashCommands() {
  if (client?.application) {
     await client.application.commands.create({
       name: 'startorg',
       description: 'Start the org process and show category buttons.',
     });

     await client.application.commands.create({
       name: 'refreshorg',
       description: 'Refresh the org embed without losing any data.',
     });

     await client.application.commands.create({
       name: 'reloadorg',
       description: 'Recreate the org embed if it gets stuck or missing.',
     });

     await client.application.commands.create({
       name: 'cancelres',
       description: 'Cancel your reservation.',
     });

     await client.application.commands.create({
       name: 'endorg',
       description: 'Close org and clear all reservations (admin only).',
     });

     // /setchannels category (string choice) channels (string: comma-separated mentions or ids)
     await client.application.commands.create({
       name: 'setchannels',
       description: 'Register channels to a category (admin only).',
       options: [
         {
           name: 'category',
           description: 'Category (e.g. Rares, Gmax, etc.)',
           type: 3, // STRING
           required: true,
           choices: Object.values(CATEGORIES).map(c => ({ name: c.name, value: c.name })),
         },
         {
           name: 'channels',
           description: 'Comma-separated channel mentions or IDs.',
           type: 3, // STRING
           required: true,
         },
       ],
     });

     // /showchannels optionally filtered by category
     await client.application.commands.create({
       name: 'showchannels',
       description: 'Show registered channels for categories (admin only).',
       options: [
         {
           name: 'category',
           description: 'Optional category to filter.',
           type: 3, // STRING
           required: false,
           choices: Object.values(CATEGORIES).map(c => ({ name: c.name, value: c.name })),
         },
       ],
     });

     await client.application.commands.create({
       name: 'lock',
       description: 'Lock the current channel (revoke send messages permission from @everyone).',
     });

     await client.application.commands.create({
       name: 'unlock',
       description: 'Unlock the current channel (restore send messages permission for @everyone).',
     });

     await client.application.commands.create({
       name: 'orglock',
       description: 'Send organization message and lock the channel.',
     });

     await client.application.commands.create({
       name: 'ir',
       description: 'Send incense resumed message.',
     });

     await client.application.commands.create({
       name: 'ip',
       description: 'Send incense paused message.',
     });

     await client.application.commands.create({
       name: 'setadminrole',
       description: 'Set a role that has permission to use org commands (admin only).',
       options: [
         {
           name: 'role',
           description: 'The role to allow.',
           type: 8, // ROLE
           required: true,
         },
       ],
     });

     await client.application.commands.create({
       name: 'warn',
       description: 'Warn a user (staff only).',
       options: [
         { name: 'user', description: 'The user to warn.', type: 6, required: true },
         { name: 'reason', description: 'Reason for the warning.', type: 3, required: true },
       ],
     });

     await client.application.commands.create({
       name: 'mute',
       description: 'Mute a user (staff only).',
       options: [
         { name: 'user', description: 'The user to mute.', type: 6, required: true },
         { name: 'reason', description: 'Reason for the mute.', type: 3, required: true },
         { name: 'duration', description: 'Duration in minutes (leave empty for indefinite).', type: 4, required: false },
       ],
     });

     await client.application.commands.create({
       name: 'unmute',
       description: 'Unmute a user (staff only).',
       options: [
         { name: 'user', description: 'The user to unmute.', type: 6, required: true },
       ],
     });

     await client.application.commands.create({
       name: 'ban',
       description: 'Ban a user from org reservations (staff only).',
       options: [
         { name: 'user', description: 'The user to ban.', type: 6, required: true },
         { name: 'reason', description: 'Reason for the ban.', type: 3, required: true },
         { name: 'duration', description: 'Duration in days (leave empty for permanent).', type: 4, required: false },
       ],
     });

     await client.application.commands.create({
       name: 'unban',
       description: 'Unban a user from org reservations (staff only).',
       options: [
         { name: 'user', description: 'The user to unban.', type: 6, required: true },
       ],
     });

     await client.application.commands.create({
       name: 'steal',
       description: 'Log a steal against a user (staff only).',
       options: [
         { name: 'user', description: 'The user who stole.', type: 6, required: true },
         { name: 'item', description: 'What was stolen.', type: 3, required: true },
         { name: 'paid', description: 'Did they pay for it?', type: 5, required: true },
         { name: 'notes', description: 'Additional notes.', type: 3, required: false },
       ],
     });

     await client.application.commands.create({
       name: 'lookup',
       description: 'Look up a user\'s moderation history and steals (staff only).',
       options: [
         { name: 'user', description: 'The user to look up.', type: 6, required: true },
       ],
     });

     await client.application.commands.create({
       name: 'modlog',
       description: 'View recent moderation actions (staff only).',
       options: [
         { name: 'limit', description: 'Number of entries to show (default 10).', type: 4, required: false },
       ],
     });

     // Also register per-guild for instant availability
     try {
       const appCommands = await client.application.commands.fetch();
       const commandData = appCommands.map(cmd => cmd.toJSON()) as any[];
       client.guilds.cache.forEach(async (guild) => {
         try {
           await guild.commands.set(commandData);
           console.log(`Synced commands to guild: ${guild.name}`);
         } catch (e) {
           console.error(`Failed to sync commands to guild ${guild.name}:`, e);
         }
       });
     } catch (e) {
       console.error("Failed to sync guild commands:", e);
     }
  }
}

// Helper function to build category buttons with locking (disable if claimed by someone else)
async function buildCategoryButtons(reservations: any[]): Promise<ActionRowBuilder<ButtonBuilder>[]> {
  const claimedCategories = new Map<string, string[]>();
  for (const r of reservations) {
    const key = r.category.toLowerCase().replace(/\s+/g, '');
    const current = claimedCategories.get(key) || [];
    current.push(r.user.username);
    claimedCategories.set(key, current);
  }

  const isLocked = (catKey: string) => {
    const owners = claimedCategories.get(catKey.toLowerCase()) || [];
    if (catKey.toLowerCase() === 'regionals') return owners.length >= 3;
    if (catKey.toLowerCase().startsWith('reserve')) {
      // For reserves, it's only locked if there are 2 pokemon reserved (allows split)
      const res = reservations.find(r => r.category.toLowerCase().replace(/\s+/g, '') === catKey.toLowerCase());
      return !!(res && res.pokemon1 && res.pokemon2);
    }
    // MissingNo locks after 1 person claims (no split), but they can reserve 2 Pokemon
    if (catKey.toLowerCase() === 'missingno') {
      return owners.length >= 1;
    }
    if (catKey.toLowerCase() === 'booster') {
      if (!boosterUnlocked) return true;
      const categoryReservations = reservations.filter(r => r.category === 'Server Booster Reserves');
      return categoryReservations.length >= 2;
    }
    if (catKey.toLowerCase() === 'staff') {
      // Staff Reserve - only 1 staff member can claim, they get up to 2 Pokemon
      const categoryReservations = reservations.filter(r => r.category === 'Staff Reserve');
      return categoryReservations.length >= 1;
    }
    return owners.length >= 1;
  };

  const gmaxRes = reservations.find(r => r.category === 'Gmax');
  const eevosRes = reservations.find(r => r.category === 'Eevos');
  let firstGmaxEevos: string | null = null;
  if (gmaxRes && eevosRes) {
    const gmaxTime = gmaxRes.createdAt ? new Date(gmaxRes.createdAt).getTime() : Infinity;
    const eevosTime = eevosRes.createdAt ? new Date(eevosRes.createdAt).getTime() : Infinity;
    firstGmaxEevos = gmaxTime <= eevosTime ? 'gmax' : 'eevos';
  } else if (gmaxRes) {
    firstGmaxEevos = 'gmax';
  } else if (eevosRes) {
    firstGmaxEevos = 'eevos';
  }

  const getLabel = (catKey: string, baseName: string, range: string) => {
    const owners = claimedCategories.get(catKey.toLowerCase()) || [];

    if (catKey.toLowerCase() === 'booster') {
      if (!boosterUnlocked) {
        return `${baseName} - LOCKED`;
      }
      const categoryReservations = reservations.filter(r => r.category === 'Server Booster Reserves');
      if (categoryReservations.length >= 2) {
        return `${baseName} - SPLIT TAKEN`;
      }
      if (categoryReservations.length === 1) {
        return `${baseName} - SPLIT`;
      }
      return baseName;
    }
    
    if (catKey.toLowerCase() === 'staff') {
      const categoryReservations = reservations.filter(r => r.category === 'Staff Reserve');
      if (categoryReservations.length >= 1) {
        return `${baseName} - ${categoryReservations[0].user.username}`;
      }
      return baseName;
    }

    const clockPrefix = (catKey.toLowerCase() === 'gmax' || catKey.toLowerCase() === 'eevos') && 
      firstGmaxEevos === catKey.toLowerCase() && owners.length > 0 ? '\u{1F552} ' : '';

    if (owners.length === 0) return `${baseName} (${range})`;
    if (catKey.toLowerCase() === 'regionals') return `${baseName} (${range}) [${owners.length}/3]`;
    if (catKey.toLowerCase().startsWith('reserve')) {
      const categoryReservations = reservations.filter(r => r.category.toLowerCase().replace(/\s+/g, '') === catKey.toLowerCase());
      // If 2 people have claimed (split taken)
      if (categoryReservations.length >= 2) {
        return `${baseName} (${range}) - SPLIT TAKEN`;
      }
      // If 1 person has claimed with only 1 pokemon (split available)
      const res = categoryReservations[0];
      if (res && res.pokemon1 && !res.pokemon2) {
        return `${baseName} (${range}) - SPLIT`;
      }
      // If 1 person has claimed with both pokemon (fully claimed)
      if (res && res.pokemon1 && res.pokemon2) {
        return `${baseName} (${range}) - ${owners[0]}`;
      }
      return `${baseName} (${range}) - ${owners[0]}`;
    }
    return `${clockPrefix}${baseName} (${range}) - ${owners[0]}`;
  };

  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('cat_rares')
        .setLabel(getLabel('rares', 'Rares', '1-23'))
        .setStyle(isLocked('rares') ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isLocked('rares')),
      new ButtonBuilder()
        .setCustomId('cat_regionals')
        .setLabel(getLabel('regionals', 'Regionals', '24-43'))
        .setStyle(isLocked('regionals') ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isLocked('regionals')),
      new ButtonBuilder()
        .setCustomId('cat_gmax')
        .setLabel(getLabel('gmax', 'Gmax', '44-59'))
        .setStyle(isLocked('gmax') ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isLocked('gmax')),
      new ButtonBuilder()
        .setCustomId('cat_eevos')
        .setLabel(getLabel('eevos', 'Eevos', '60-67'))
        .setStyle(isLocked('eevos') ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isLocked('eevos')),
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('cat_choice1')
        .setLabel(getLabel('choice1', 'Choice 1', '68-74'))
        .setStyle(isLocked('choice1') ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isLocked('choice1')),
      new ButtonBuilder()
        .setCustomId('cat_choice2')
        .setLabel(getLabel('choice2', 'Choice 2', '75-81'))
        .setStyle(isLocked('choice2') ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isLocked('choice2')),
      new ButtonBuilder()
        .setCustomId('cat_missingno')
        .setLabel(getLabel('missingno', 'MissingNo', '82-88'))
        .setStyle(isLocked('missingno') ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isLocked('missingno')),
    );

  const row3 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('cat_reserve1')
        .setLabel(getLabel('reserve1', 'Reserve 1', '89-92'))
        .setStyle(isLocked('reserve1') ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isLocked('reserve1')),
      new ButtonBuilder()
        .setCustomId('cat_reserve2')
        .setLabel(getLabel('reserve2', 'Reserve 2', '93-96'))
        .setStyle(isLocked('reserve2') ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isLocked('reserve2')),
      new ButtonBuilder()
        .setCustomId('cat_reserve3')
        .setLabel(getLabel('reserve3', 'Reserve 3', '97-100'))
        .setStyle(isLocked('reserve3') ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isLocked('reserve3')),
    );

  const boosterRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('cat_booster')
        .setLabel(getLabel('booster', 'Server Booster Reserves', 'N/A'))
        .setStyle(isLocked('booster') ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isLocked('booster')),
      new ButtonBuilder()
        .setCustomId('cat_staff')
        .setLabel(getLabel('staff', 'Staff Reserve', 'N/A'))
        .setStyle(isLocked('staff') ? ButtonStyle.Secondary : ButtonStyle.Danger)
        .setDisabled(isLocked('staff')),
    );

  const adminRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder().setCustomId('admin_manage').setLabel('Manage Reservations').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('staff_announce_buy').setLabel('Announce Buy').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('staff_unlock_booster').setLabel(boosterUnlocked ? 'Booster Res Unlocked' : 'Unlock Booster Res').setStyle(boosterUnlocked ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(boosterUnlocked),
    );

  return [row1, row2, row3, boosterRow, adminRow];
}

// Helper function to find the org message, trying stored ID first, then searching
async function findOrgMessage(channel: TextChannel): Promise<DiscordMessage | null> {
  // First try to get from stored state
  const orgState = await storage.getOrgState();
  if (orgState && orgState.channelId === channel.id) {
    try {
      const message = await channel.messages.fetch(orgState.messageId);
      if (message && message.author.id === client?.user?.id && message.embeds.length > 0) {
        return message;
      }
    } catch (e) {
      console.log("Stored org message not found, falling back to search");
    }
  }

  // Fall back to searching recent messages
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const orgMessage = messages.find((m: DiscordMessage) => 
      m.author.id === client?.user?.id && 
      m.embeds.length > 0 && 
      m.embeds[0].title && 
      (m.embeds[0].title.includes('Operation Incense') || m.embeds[0].title.includes('Buyers Org'))
    );
    
    // If found via search, update the stored state
    if (orgMessage) {
      await storage.setOrgState(channel.id, orgMessage.id);
    }
    
    return orgMessage || null;
  } catch (e) {
    console.error("Failed to search for org message:", e);
    return null;
  }
}

async function updateOrgEmbed(channel: TextChannel, messageId: string) {
  const reservations = await storage.getReservations();
  const checks = await storage.getChannelChecks();

  const totalReservations = reservations.length;
  const totalCategories = Object.keys(CATEGORIES).filter(k => k !== 'BOOSTER' && k !== 'STAFF').length;
  const filledCategories = new Set(reservations.filter(r => r.category !== 'Server Booster Reserves' && r.category !== 'Staff Reserve').map(r => r.category)).size;

  const embed = new EmbedBuilder()
    .setTitle('⚡ Operation Incense Buyers Org')
    .setDescription(
      `**Organization Status**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 **${filledCategories}/${totalCategories}** categories filled\n` +
      `👥 **${totalReservations}** active reservations\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Click a category button below to claim it.\nUse \`/cancelres\` to release your slot.`
    )
    .setColor(0xBA00C4)
    .setThumbnail('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png')
    .setFooter({ text: 'Use /refreshorg to update • /reloadorg if stuck • /endorg to close' })
    .setTimestamp();

  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const catReservations = reservations.filter(r => r.category === cat.name);
    const catChecks = checks.filter(c => c.category === cat.name);

    const total = catChecks.length;
    const completed = catChecks.filter(c => c.isComplete).length;

    const isDone = total > 0 && completed === total;
    const isClaimed = catReservations.length > 0;
    
    let statusEmoji = '⬜';
    if (isDone) statusEmoji = '✅';
    else if (isClaimed) statusEmoji = '🟡';

    let fieldValue: string;
    if (catReservations.length > 0) {
      fieldValue = catReservations.map(r => {
        const parts = [`┃ 👤 **${r.user.username}**`];
        if (r.subCategory) parts.push(`\`${r.subCategory}\``);
        
        const isReserve = cat.name.startsWith('Reserve');
        const pokemon = [r.pokemon1, r.pokemon2, r.additionalPokemon].filter(Boolean);
        
        if (pokemon.length > 0) {
          parts.push(`\n┃ 🎯 ${pokemon.join(' • ')}`);
        }
        
        // Only show split available for Reserve categories (not MissingNo)
        if (isReserve && r.pokemon1 && !r.pokemon2) {
          parts.push(`\n┃ 💎 *Split available*`);
        }
        
        return parts.join(' ');
      }).join('\n');
      // Show split available for Server Booster Reserves if only 1 person has claimed
      if (cat.name === 'Server Booster Reserves' && catReservations.length === 1) {
        fieldValue += `\n┃ 💎 *Split available for boosters*`;
      }
    } else {
      fieldValue = '┃ *Available - click button to claim*';
    }

    const progressBar = total > 0 ? ` [${completed}/${total}]` : '';

    embed.addFields({
      name: `${statusEmoji} ${cat.name} (${cat.range})${progressBar}`,
      value: fieldValue,
      inline: true
    });
  }

  try {
    const message = await channel.messages.fetch(messageId);
    const buttons = await buildCategoryButtons(reservations);
    await message.edit({ embeds: [embed], components: buttons });
  } catch (error) {
    console.error("Failed to update embed:", error);
  }
}

async function handleSlashCommand(interaction: any) {
  if (interaction.commandName === 'setadminrole') {
    if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You need 'Manage Server' permissions to use this command.", ephemeral: true });
      return;
    }
    const role = interaction.options.getRole('role');
    await storage.setAdminRole(role.id);
    await interaction.reply({ content: `✅ Admin role set to <@&${role.id}>.`, ephemeral: true });
    return;
  }

  const userId = interaction.user.id;
  const user = await storage.getOrCreateUser(userId, interaction.user.username);

  if (interaction.commandName === 'startorg') {
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "This command only works in text channels.", ephemeral: true });
      return;
    }

    // Check admin permission
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        isAdmin = true;
      } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {
      console.error("Error checking permissions:", e);
    }

    if (!isAdmin) {
      await interaction.reply({ content: "You do not have permission to start an organization.", ephemeral: true });
      return;
    }

    const reservations = await storage.getReservations();
    const checks = await storage.getChannelChecks();
    
    const totalReservations = reservations.length;
    const totalCategories = Object.keys(CATEGORIES).filter(k => k !== 'BOOSTER' && k !== 'STAFF').length;
    const filledCategories = new Set(reservations.filter(r => r.category !== 'Server Booster Reserves' && r.category !== 'Staff Reserve').map(r => r.category)).size;

    const embed = new EmbedBuilder()
      .setTitle('⚡ Operation Incense Buyers Org')
      .setDescription(
        `**Organization Status**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 **${filledCategories}/${totalCategories}** categories filled\n` +
        `👥 **${totalReservations}** active reservations\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Click a category button below to claim it.\nUse \`/cancelres\` to release your slot.`
      )
      .setColor(0xBA00C4)
      .setThumbnail('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png')
      .setFooter({ text: 'Use /refreshorg to update • /reloadorg if stuck • /endorg to close' })
      .setTimestamp();

    for (const [key, cat] of Object.entries(CATEGORIES)) {
      const catReservations = reservations.filter(r => r.category === cat.name);
      const catChecks = checks.filter(c => c.category === cat.name);

      const total = catChecks.length;
      const completed = catChecks.filter(c => c.isComplete).length;

      const isDone = total > 0 && completed === total;
      const isClaimed = catReservations.length > 0;
      
      let statusEmoji = '⬜';
      if (isDone) statusEmoji = '✅';
      else if (isClaimed) statusEmoji = '🟡';

      let fieldValue: string;
      if (catReservations.length > 0) {
        fieldValue = catReservations.map(r => {
          const parts = [`┃ 👤 **${r.user.username}**`];
          if (r.subCategory) parts.push(`\`${r.subCategory}\``);
          const pokemon = [r.pokemon1, r.pokemon2, r.additionalPokemon].filter(Boolean);
          if (pokemon.length > 0) {
            parts.push(`\n┃ 🎯 ${pokemon.join(' • ')}`);
          }
          return parts.join(' ');
        }).join('\n');
        // Show split available for Server Booster Reserves if only 1 person has claimed
        if (cat.name === 'Server Booster Reserves' && catReservations.length === 1) {
          fieldValue += `\n┃ 💎 *Split available for boosters*`;
        }
      } else {
        fieldValue = '┃ *Available - click button to claim*';
      }

      const progressBar = total > 0 ? ` [${completed}/${total}]` : '';

      embed.addFields({
        name: `${statusEmoji} ${cat.name} (${cat.range})${progressBar}`,
        value: fieldValue,
        inline: true
      });
    }

    boosterUnlocked = false;

    const buttons = await buildCategoryButtons(reservations);
    const message = await interaction.reply({ embeds: [embed], components: buttons, fetchReply: true });

    if (interaction.channel instanceof TextChannel) {
      await storage.setOrgState(interaction.channel.id, message.id);
    }
  }

  if (interaction.commandName === 'refreshorg') {
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "This command only works in text channels.", ephemeral: true });
      return;
    }

    // Check admin permission
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        isAdmin = true;
      } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {
      console.error("Error checking permissions:", e);
    }

    if (!isAdmin) {
      await interaction.reply({ content: "You do not have permission to refresh the organization.", ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const orgMessage = await findOrgMessage(interaction.channel);
      if (!orgMessage) {
        await interaction.editReply({ content: "❌ No active org embed found in this channel. Use `/reloadorg` to recreate it or `/startorg` to create a new one." });
        return;
      }

      await updateOrgEmbed(interaction.channel, orgMessage.id);
      // Update stored message ID
      await storage.setOrgState(interaction.channel.id, orgMessage.id);
      await interaction.editReply({ content: "✅ Embed refreshed successfully! All data preserved." });
    } catch (error) {
      console.error("Failed to refresh embed:", error);
      await interaction.editReply({ content: "Failed to refresh embed. Please try again." });
    }
  }

  // New: /reloadorg - recreate the org embed if it's stuck or missing
  if (interaction.commandName === 'reloadorg') {
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "This command only works in text channels.", ephemeral: true });
      return;
    }

    // Check admin permission
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        isAdmin = true;
      } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {
      console.error("Error checking permissions:", e);
    }

    if (!isAdmin) {
      await interaction.reply({ content: "You do not have permission to reload the organization.", ephemeral: true });
      return;
    }

    try {
      // Get current reservations
      const reservations = await storage.getReservations();
      const checks = await storage.getChannelChecks();
      
      const totalReservations = reservations.length;
      const totalCategories = Object.keys(CATEGORIES).filter(k => k !== 'BOOSTER' && k !== 'STAFF').length;
      const filledCategories = new Set(reservations.filter(r => r.category !== 'Server Booster Reserves' && r.category !== 'Staff Reserve').map(r => r.category)).size;

      // Build the full embed with all reservation data
      const embed = new EmbedBuilder()
        .setTitle('⚡ Operation Incense Buyers Org')
        .setDescription(
          `**Organization Status**\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📊 **${filledCategories}/${totalCategories}** categories filled\n` +
          `👥 **${totalReservations}** active reservations\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Click a category button below to claim it.\nUse \`/cancelres\` to release your slot.`
        )
        .setColor(0xBA00C4)
        .setThumbnail('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png')
        .setFooter({ text: 'Use /refreshorg to update • /reloadorg if stuck • /endorg to close' })
        .setTimestamp();

      // Add fields for each category with reservation info
      for (const [key, cat] of Object.entries(CATEGORIES)) {
        const catReservations = reservations.filter(r => r.category === cat.name);
        const catChecks = checks.filter(c => c.category === cat.name);

        const total = catChecks.length;
        const completed = catChecks.filter(c => c.isComplete).length;

        const isDone = total > 0 && completed === total;
        const isClaimed = catReservations.length > 0;
        
        let statusEmoji = '⬜';
        if (isDone) statusEmoji = '✅';
        else if (isClaimed) statusEmoji = '🟡';

        let fieldValue: string;
        if (catReservations.length > 0) {
          fieldValue = catReservations.map(r => {
            const parts = [`┃ 👤 **${r.user.username}**`];
            if (r.subCategory) parts.push(`\`${r.subCategory}\``);
            const pokemon = [r.pokemon1, r.pokemon2, r.additionalPokemon].filter(Boolean);
            if (pokemon.length > 0) {
              parts.push(`\n┃ 🎯 ${pokemon.join(' • ')}`);
            }
            return parts.join(' ');
          }).join('\n');
          // Show split available for Server Booster Reserves if only 1 person has claimed
          if (cat.name === 'Server Booster Reserves' && catReservations.length === 1) {
            fieldValue += `\n┃ 💎 *Split available for boosters*`;
          }
        } else {
          fieldValue = '┃ *Available - click button to claim*';
        }

        const progressBar = total > 0 ? ` [${completed}/${total}]` : '';

        embed.addFields({
          name: `${statusEmoji} ${cat.name} (${cat.range})${progressBar}`,
          value: fieldValue,
          inline: true
        });
      }

      const buttons = await buildCategoryButtons(reservations);

      // Send new embed with full data
      const message = await interaction.reply({ embeds: [embed], components: buttons, fetchReply: true });
      
      // Save the new message ID
      try {
        await storage.setOrgState(interaction.channel.id, message.id);
      } catch (storageError) {
        console.error("Failed to save org state:", storageError);
        // Continue anyway - the embed was created successfully
      }
      
      // Send a follow-up message to confirm
      try {
        await interaction.followUp({ content: "✅ Embed reloaded successfully! All reservation data has been preserved.", ephemeral: true });
      } catch (followUpError) {
        console.error("Failed to send follow-up:", followUpError);
        // The embed was created successfully, so we don't need to show an error to the user
      }
    } catch (error) {
      console.error("Failed to reload embed:", error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "Failed to reload embed. Please try again or use `/startorg`.", ephemeral: true });
        } else {
          await interaction.reply({ content: "Failed to reload embed. Please try again or use `/startorg`.", ephemeral: true });
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // New: /cancelres - show options to change reserve or fully cancel
  if (interaction.commandName === 'cancelres') {
    const discordId = interaction.user.id;
    const user = await storage.getUserByDiscordId(discordId);
    if (!user) {
      await interaction.reply({ content: "You have no reservations to manage.", ephemeral: true });
      return;
    }

    // Get all reservations for this user
    const allReservations = await storage.getReservations();
    const userReservations = allReservations.filter(r => r.userId === user.id);
    
    if (userReservations.length === 0) {
      await interaction.reply({ content: "No active reservation found.", ephemeral: true });
      return;
    }

    // Build options for each reservation with change/cancel buttons
    const options = userReservations.map(r => {
      const pokemonList = [r.pokemon1, r.pokemon2, r.additionalPokemon].filter(Boolean).join(', ');
      return {
        label: `${r.category}${r.subCategory ? ` (${r.subCategory})` : ''}`,
        description: pokemonList || 'No pokemon reserved',
        value: String(r.id),
      };
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId('user_manage_select')
      .setPlaceholder('Select a reservation to manage')
      .addOptions(options)
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ 
      content: "Select a reservation to manage. You can change your Pokemon selection or fully cancel it:", 
      components: [row], 
      ephemeral: true 
    });
  }

  // New: /endorg - admin only: close the embed and clear reservations/checks
  if (interaction.commandName === 'endorg') {
    console.log("[endorg] Command received");
    
    // Authorization: either ManageGuild permission, hardcoded admin role, or role set in database
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();

    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        isAdmin = true;
      } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {
      console.log("[endorg] Error checking admin:", e);
    }

    console.log("[endorg] isAdmin:", isAdmin);

    if (!isAdmin) {
      await interaction.reply({ content: "You do not have permission to end the organization.", ephemeral: true });
      return;
    }

    // Defer reply immediately to prevent timeout
    try {
      console.log("[endorg] Deferring reply...");
      await interaction.deferReply({ ephemeral: true });
      console.log("[endorg] Reply deferred successfully");
    } catch (deferErr) {
      console.error("[endorg] Failed to defer reply:", deferErr);
      return;
    }

    // Find the org message BEFORE clearing data
    let orgMessage: DiscordMessage | null = null;
    try {
      if (interaction.channel instanceof TextChannel) {
        console.log("[endorg] Finding org message...");
        orgMessage = await findOrgMessage(interaction.channel);
        console.log("[endorg] Org message found:", !!orgMessage);
      }
    } catch (findErr) {
      console.error("[endorg] Error finding org message:", findErr);
    }

    // Role removal logic
    const reservations = await storage.getReservations();
    const roleId = "1468236218331562024";
    const guild = interaction.guild;

    if (guild) {
      console.log(`[endorg] Removing roles from ${reservations.length} users...`);
      for (const res of reservations) {
        try {
          const member = await guild.members.fetch(res.user.discordId).catch(() => null);
          if (member && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            console.log(`[endorg] Removed role from ${res.user.username}`);
          }
        } catch (error) {
          console.error(`[endorg] Failed to remove role from ${res.user.username}:`, error);
        }
      }
    }

    // Clear reservations and channel checks (reset isComplete but preserve mappings)
    boosterUnlocked = false;
    try {
      console.log("[endorg] Clearing data...");
      await storage.clearReservations();
      await storage.clearChannelChecks();
      await storage.clearOrgState();
      console.log("[endorg] Data cleared successfully");
    } catch (err) {
      console.error("[endorg] Failed to clear reservations/checks:", err);
    }

    // Close the embed if found
    if (orgMessage) {
      try {
        console.log("[endorg] Editing org message to closed state...");
        const closedEmbed = new EmbedBuilder()
          .setTitle('Operation Incense Buyers Org — CLOSED')
          .setDescription('This organization round has been closed. Use /startorg to begin a fresh round.')
          .setColor(0x808080)
          .setTimestamp();

        await orgMessage.edit({ embeds: [closedEmbed], components: [] });
        console.log("[endorg] Org message edited, sending reply...");
        await interaction.editReply({ content: "✅ Organization closed and reservations cleared. Use /startorg to begin a fresh round." });
        console.log("[endorg] Complete with embed closed");
      } catch (err) {
        console.error("[endorg] Failed to edit org message:", err);
        await interaction.editReply({ content: "Data cleared but failed to close the embed. You may need to delete it manually." });
      }
    } else {
      console.log("[endorg] No org message found, sending reply...");
      await interaction.editReply({ content: "Data cleared. No org embed was found to close." });
      console.log("[endorg] Complete without embed");
    }
    return;
  }

  // New: /setchannels - admin only: register channels for a category
  if (interaction.commandName === 'setchannels') {
    // Authorization: either ManageGuild permission or role id set in ADMIN_ROLE_ID
    let isAdmin = false;
    const adminRoleId = process.env.ADMIN_ROLE_ID;

    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && adminRoleId && member.roles && member.roles.cache && member.roles.cache.has(adminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {
      // ignore and treat as not admin
    }

    if (!isAdmin) {
      await interaction.reply({ content: "You do not have permission to set channels.", ephemeral: true });
      return;
    }

    const category = interaction.options.getString('category', true);
    const channelsRaw = interaction.options.getString('channels', true);

    // Extract channel IDs from mentions like <#123..> or raw numbers separated by commas/spaces
    const ids: string[] = Array.from(new Set((channelsRaw.match(/\d{17,19}/g) || []).map((s: string) => s.trim())));

    if (ids.length === 0) {
      await interaction.reply({ content: "No channel IDs found in the channels parameter. Provide channel mentions or channel IDs separated by commas.", ephemeral: true });
      return;
    }

    try {
      await storage.setCategoryChannels(category, ids);
      await interaction.reply({ content: `Registered ${ids.length} channels for category ${category}.`, ephemeral: true });

      // Try to update any org embed in this channel to show progress
      if (interaction.channel instanceof TextChannel) {
        const messages = await interaction.channel.messages.fetch({ limit: 50 });
        const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Operation Incense') || m.embeds[0].title.includes('Buyers Org')));
        if (orgMessage) {
          await updateOrgEmbed(interaction.channel, orgMessage.id);
        }
      }
    } catch (err) {
      console.error("Failed to set category channels:", err);
      await interaction.reply({ content: "Failed to register channels. Try again later.", ephemeral: true });
    }
  }

  // New: /showchannels - admin only: display current mappings (optionally filtered by category)
  if (interaction.commandName === 'showchannels') {
    // Authorization: either ManageGuild permission or role id set in ADMIN_ROLE_ID
    let isAdmin = false;
    const adminRoleId = process.env.ADMIN_ROLE_ID;

    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && adminRoleId && member.roles && member.roles.cache && member.roles.cache.has(adminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {
      // ignore and treat as not admin
    }

    if (!isAdmin) {
      await interaction.reply({ content: "You do not have permission to view channel mappings.", ephemeral: true });
      return;
    }

    const categoryFilter = interaction.options.getString('category', false);

    try {
      const checks = await storage.getChannelChecks();

      // If a category filter is provided, show only that category
      if (categoryFilter) {
        const catChecks = checks.filter(c => c.category === categoryFilter);
        if (catChecks.length === 0) {
          await interaction.reply({ content: `No channels registered for category "${categoryFilter}".`, ephemeral: true });
          return;
        }

        const lines = catChecks.map(c => {
          const status = c.isComplete ? '✅' : '❌';
          // show channel mention if possible
          return `${status} <#${c.channelId}> (\`${c.channelId}\`)`;
        });

        await interaction.reply({ content: `Channels for **${categoryFilter}**:\n${lines.join('\n')}`, ephemeral: true });
        return;
      }

      // No filter: group by category
      const byCategory = checks.reduce<Record<string, typeof checks>>((acc, curr) => {
        (acc[curr.category] ||= []).push(curr);
        return acc;
      }, {});

      if (Object.keys(byCategory).length === 0) {
        await interaction.reply({ content: "No channel mappings registered.", ephemeral: true });
        return;
      }

      const chunks: string[] = [];
      for (const [cat, rows] of Object.entries(byCategory)) {
        const total = rows.length;
        const completed = rows.filter(r => r.isComplete).length;
        const header = `**${cat}** — ${completed}/${total} channels`;
        const lines = rows.map(r => `${r.isComplete ? '✅' : '❌'} <#${r.channelId}> (\`${r.channelId}\`)`);
        chunks.push(`${header}\n${lines.join('\n')}`);
      }

      await interaction.reply({ content: chunks.join('\n\n'), ephemeral: true });
    } catch (err) {
      console.error("Failed to show channel mappings:", err);
      await interaction.reply({ content: "Failed to retrieve channel mappings. Try again later.", ephemeral: true });
    }
  }

  // /lock - Revoke SEND_MESSAGES permission from @everyone role (admin role can still send)
  if (interaction.commandName === 'lock') {
    
    // Check if user has ManageChannels permission or has the exempt role
    let hasPermission = false;
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        hasPermission = true;
      }
      // Also allow exempt role to use the command
      if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        hasPermission = true;
      }
    } catch (e) {
      console.error("Error checking permissions:", e);
    }

    if (!hasPermission) {
      await interaction.reply({ content: "❌ You do not have permission to lock this channel.", ephemeral: true });
      return;
    }

    // Check if the command is used in a text channel
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "❌ This command can only be used in text channels.", ephemeral: true });
      return;
    }

    try {
      // Get the @everyone role
      const everyoneRole = interaction.guild.roles.everyone;
      
      // Revoke SEND_MESSAGES permission for @everyone
      await interaction.channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false
      });
      
      // Allow exempt role to still send messages
      const exemptRole = interaction.guild.roles.cache.get(ADMIN_ROLE_ID);
      if (exemptRole) {
        await interaction.channel.permissionOverwrites.edit(exemptRole, {
          SendMessages: true
        });
      }

      await interaction.reply({ content: "🔒 **This channel has been locked!**", ephemeral: false });
      await interaction.channel.send("This channel is now locked. Please refrain from sending messages until it is unlocked.");
    } catch (err) {
      console.error("Failed to lock channel:", err);
      await interaction.reply({ content: "❌ Failed to lock the channel. Please try again or check bot permissions.", ephemeral: true });
    }
  }

  // /unlock - Restore SEND_MESSAGES permission for @everyone role
  if (interaction.commandName === 'unlock') {
    
    // Check if user has ManageChannels permission or has the exempt role
    let hasPermission = false;
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        hasPermission = true;
      }
      // Also allow exempt role to use the command
      if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        hasPermission = true;
      }
    } catch (e) {
      console.error("Error checking permissions:", e);
    }

    if (!hasPermission) {
      await interaction.reply({ content: "❌ You do not have permission to unlock this channel.", ephemeral: true });
      return;
    }

    // Check if the command is used in a text channel
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "❌ This command can only be used in text channels.", ephemeral: true });
      return;
    }

    try {
      // Get the @everyone role
      const everyoneRole = interaction.guild.roles.everyone;
      
      // Allow SEND_MESSAGES permission for @everyone
      await interaction.channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: true
      });
      
      // Remove the exempt role override (no longer needed when unlocked)
      const exemptRole = interaction.guild.roles.cache.get(ADMIN_ROLE_ID);
      if (exemptRole) {
        const existingOverwrite = interaction.channel.permissionOverwrites.cache.get(ADMIN_ROLE_ID);
        if (existingOverwrite) {
          await existingOverwrite.delete();
        }
      }

      await interaction.reply({ content: "🔓 **This channel has been unlocked!**", ephemeral: false });
    } catch (err) {
      console.error("Failed to unlock channel:", err);
      await interaction.reply({ content: "❌ Failed to unlock the channel. Please try again or check bot permissions.", ephemeral: true });
    }
  }

  // /orglock - Send organization message and lock the channel
  if (interaction.commandName === 'orglock') {
    
    // Check if user has ManageChannels permission or has the exempt role
    let hasPermission = false;
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        hasPermission = true;
      }
      // Also allow exempt role to use the command
      if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        hasPermission = true;
      }
    } catch (e) {
      console.error("Error checking permissions:", e);
    }

    if (!hasPermission) {
      await interaction.reply({ content: "❌ You do not have permission to use orglock.", ephemeral: true });
      return;
    }

    // Check if the command is used in a text channel
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "❌ This command can only be used in text channels.", ephemeral: true });
      return;
    }

    try {
      // Send the organization message first
      const orgMessage = "**A ROUND IS CURRENTLY BEING ORGANIZED.** Please take unnecessary chatter to <#1405221498037469335> and run commands in <#1405195433378054175> . THANK YOU!\n\nThis channel has been momentarily locked so that the organiser may catch up on the reserves thank you for your patience!";
      
      await interaction.reply({ content: orgMessage, ephemeral: false });

      // Then lock the channel
      const everyoneRole = interaction.guild.roles.everyone;
      await interaction.channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false
      });
      
      // Allow exempt role to still send messages
      const exemptRole = interaction.guild.roles.cache.get(ADMIN_ROLE_ID);
      if (exemptRole) {
        await interaction.channel.permissionOverwrites.edit(exemptRole, {
          SendMessages: true
        });
      }

      console.log("Channel locked successfully with orglock command");
    } catch (err) {
      console.error("Failed to execute orglock command:", err);
      await interaction.reply({ content: "❌ Failed to execute orglock command. Please try again or check bot permissions.", ephemeral: true });
    }
  }

  // /ir - Send incense resumed message
  if (interaction.commandName === 'ir') {
    try {
      const resumedMessage = "**The Incense has now been resumed!**\n\n:sparkles: Good luck to you all and time to light up the starboard! :sparkles:\n<@&1413910154457645106>";
      
      // Try to mention the role with allowed mentions
      await interaction.reply({ 
        content: resumedMessage, 
        ephemeral: false,
        allowedMentions: { 
          roles: ['1413910154457645106'] 
        }
      });
      console.log("Incense resumed message sent successfully");
    } catch (err) {
      console.error("Failed to send incense resumed message:", err);
      // Try without role mention as fallback
      try {
        const fallbackMessage = "**The Incense has now been resumed!**\n\n:sparkles: Good luck to you all and time to light up the starboard! :gmaxLappy: :sparkles:\n\n*Role mention failed - please ping the role manually if needed*";
        await interaction.reply({ content: fallbackMessage, ephemeral: false });
      } catch (fallbackErr) {
        console.error("Failed to send fallback message:", fallbackErr);
        await interaction.reply({ content: "❌ Failed to send message. Please try again.", ephemeral: true });
      }
    }
  }

  // /ip - Send incense paused message
  if (interaction.commandName === 'ip') {
    try {
      const pausedMessage = "**The Incense has now been paused! :heart_hands:**\n\nWe have temproarily Paused! Please take a moment to grab yourself a snack and something to drink before we get started up again!\n\nWe will be resuming shortly keep an eye out for a ping :heart:\n\n<@&1413910154457645106>";
      
      // Try to mention the role with allowed mentions
      await interaction.reply({ 
        content: pausedMessage, 
        ephemeral: false,
        allowedMentions: { 
          roles: ['1413910154457645106'] 
        }
      });
      console.log("Incense paused message sent successfully");
    } catch (err) {
      console.error("Failed to send incense paused message:", err);
      // Try without role mention as fallback
      try {
        const fallbackMessage = "**The Incense has now been paused! :heart_hands:**\n\nWe have temproarily Paused! Please take a moment to grab yourself a snack and something to drink before we get started up again!\n\nWe will be resuming shortly keep an eye out for a ping :heart:\n\n*Role mention failed - please ping the role manually if needed*";
        await interaction.reply({ content: fallbackMessage, ephemeral: false });
      } catch (fallbackErr) {
        console.error("Failed to send fallback message:", fallbackErr);
        await interaction.reply({ content: "❌ Failed to send message. Please try again.", ephemeral: true });
      }
    }
  }

  // ===== MODERATION COMMANDS =====

  const moderationCommands = ['warn', 'mute', 'unmute', 'ban', 'unban', 'steal', 'lookup', 'modlog'];
  if (moderationCommands.includes(interaction.commandName)) {
    let isStaff = false;
    const dbAdminRoleId = await storage.getAdminRole();
    try {
      const member = interaction.member;
      if (member?.permissions?.has?.(PermissionFlagsBits.ManageGuild)) isStaff = true;
      else if (member?.roles?.cache?.has(ADMIN_ROLE_ID)) isStaff = true;
      else if (dbAdminRoleId && member?.roles?.cache?.has(dbAdminRoleId)) isStaff = true;
    } catch (e) {}

    if (!isStaff) {
      const noPermEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Permission Denied')
        .setDescription('You do not have permission to use this command.')
        .setTimestamp();
      await interaction.reply({ embeds: [noPermEmbed], ephemeral: true });
      return;
    }

    const staffUser = await storage.getOrCreateUser(interaction.user.id, interaction.user.username);

    if (interaction.commandName === 'warn') {
      const targetDiscordUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      const targetUser = await storage.getOrCreateUser(targetDiscordUser.id, targetDiscordUser.username);

      await storage.warnUser(targetUser.id, reason, staffUser.id);
      await storage.createAuditLog(staffUser.id, 'warn', targetUser.id, { reason });

      const warnings = await storage.getUserWarnings(targetUser.id);
      const activeCount = warnings.filter(w => w.isActive).length;

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('Warning Issued')
        .setThumbnail(targetDiscordUser.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: 'User', value: `<@${targetDiscordUser.id}>`, inline: true },
          { name: 'Warned By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Active Warnings', value: `${activeCount}`, inline: true },
          { name: 'Reason', value: reason },
        )
        .setFooter({ text: `User ID: ${targetDiscordUser.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'mute') {
      const targetDiscordUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      const durationMinutes = interaction.options.getInteger('duration');
      const targetUser = await storage.getOrCreateUser(targetDiscordUser.id, targetDiscordUser.username);

      const expiresAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : undefined;

      await storage.muteUser(targetUser.id, reason, staffUser.id, expiresAt);
      await storage.createAuditLog(staffUser.id, 'mute', targetUser.id, { reason, durationMinutes });

      try {
        const guild = interaction.guild;
        if (guild && durationMinutes) {
          const member = await guild.members.fetch(targetDiscordUser.id);
          await member.timeout(durationMinutes * 60 * 1000, reason);
        }
      } catch (e) {
        console.error("Failed to apply Discord timeout:", e);
      }

      const durationText = durationMinutes ? `${durationMinutes} minutes` : 'Indefinite';
      const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('User Muted')
        .setThumbnail(targetDiscordUser.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: 'User', value: `<@${targetDiscordUser.id}>`, inline: true },
          { name: 'Muted By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Duration', value: durationText, inline: true },
          { name: 'Reason', value: reason },
        )
        .setFooter({ text: `User ID: ${targetDiscordUser.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'unmute') {
      const targetDiscordUser = interaction.options.getUser('user');
      const targetUser = await storage.getUserByDiscordId(targetDiscordUser.id);

      if (!targetUser) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('User not found in the system.')], ephemeral: true });
        return;
      }

      const isMuted = await storage.isUserMuted(targetUser.id);
      if (!isMuted) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('This user is not currently muted.')], ephemeral: true });
        return;
      }

      await storage.unmuteUser(targetUser.id);
      await storage.createAuditLog(staffUser.id, 'unmute', targetUser.id, {});

      try {
        const guild = interaction.guild;
        if (guild) {
          const member = await guild.members.fetch(targetDiscordUser.id);
          await member.timeout(null);
        }
      } catch (e) {
        console.error("Failed to remove Discord timeout:", e);
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('User Unmuted')
        .setThumbnail(targetDiscordUser.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: 'User', value: `<@${targetDiscordUser.id}>`, inline: true },
          { name: 'Unmuted By', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setFooter({ text: `User ID: ${targetDiscordUser.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ban') {
      const targetDiscordUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      const durationDays = interaction.options.getInteger('duration');
      const targetUser = await storage.getOrCreateUser(targetDiscordUser.id, targetDiscordUser.username);

      const alreadyBanned = await storage.isUserBanned(targetUser.id);
      if (alreadyBanned) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('This user is already banned.')], ephemeral: true });
        return;
      }

      const expiresAt = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : undefined;

      await storage.banUser(targetUser.id, reason, staffUser.id, expiresAt);
      await storage.createAuditLog(staffUser.id, 'ban', targetUser.id, { reason, durationDays });

      const durationText = durationDays ? `${durationDays} days` : 'Permanent';
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('User Banned from Org')
        .setThumbnail(targetDiscordUser.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: 'User', value: `<@${targetDiscordUser.id}>`, inline: true },
          { name: 'Banned By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Duration', value: durationText, inline: true },
          { name: 'Reason', value: reason },
        )
        .setFooter({ text: `User ID: ${targetDiscordUser.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'unban') {
      const targetDiscordUser = interaction.options.getUser('user');
      const targetUser = await storage.getUserByDiscordId(targetDiscordUser.id);

      if (!targetUser) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('User not found in the system.')], ephemeral: true });
        return;
      }

      const isBanned = await storage.isUserBanned(targetUser.id);
      if (!isBanned) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('This user is not currently banned.')], ephemeral: true });
        return;
      }

      await storage.unbanUser(targetUser.id);
      await storage.createAuditLog(staffUser.id, 'unban', targetUser.id, {});

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('User Unbanned')
        .setThumbnail(targetDiscordUser.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: 'User', value: `<@${targetDiscordUser.id}>`, inline: true },
          { name: 'Unbanned By', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setFooter({ text: `User ID: ${targetDiscordUser.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'steal') {
      const targetDiscordUser = interaction.options.getUser('user');
      const item = interaction.options.getString('item');
      const paid = interaction.options.getBoolean('paid') ?? false;
      const notes = interaction.options.getString('notes');
      const targetUser = await storage.getOrCreateUser(targetDiscordUser.id, targetDiscordUser.username);

      await storage.addSteal(targetUser.id, staffUser.id, item, paid, notes || undefined);
      await storage.createAuditLog(staffUser.id, 'steal_logged', targetUser.id, { item, paid, notes });

      const allSteals = await storage.getUserSteals(targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('Steal Logged')
        .setThumbnail(targetDiscordUser.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: 'User', value: `<@${targetDiscordUser.id}>`, inline: true },
          { name: 'Logged By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Total Steals', value: `${allSteals.length}`, inline: true },
          { name: 'Item', value: item, inline: true },
          { name: 'Paid', value: paid ? 'Yes' : 'No', inline: true },
        );
      if (notes) embed.addFields({ name: 'Notes', value: notes });
      embed.setFooter({ text: `User ID: ${targetDiscordUser.id}` }).setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'lookup') {
      const targetDiscordUser = interaction.options.getUser('user');
      const targetUser = await storage.getUserByDiscordId(targetDiscordUser.id);

      if (!targetUser) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`No records found for <@${targetDiscordUser.id}>.`)], ephemeral: true });
        return;
      }

      const warnings = await storage.getUserWarnings(targetUser.id);
      const isBanned = await storage.isUserBanned(targetUser.id);
      const isMuted = await storage.isUserMuted(targetUser.id);
      const steals = await storage.getUserSteals(targetUser.id);

      const statusText = isBanned ? 'BANNED' : isMuted ? 'MUTED' : 'Active';
      const statusColor = isBanned ? 0xED4245 : isMuted ? 0xE67E22 : 0x57F287;

      const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(`User Lookup: ${targetUser.username}`)
        .setThumbnail(targetDiscordUser.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: 'Status', value: statusText, inline: true },
          { name: 'Active Warnings', value: `${warnings.filter(w => w.isActive).length}`, inline: true },
          { name: 'Total Steals', value: `${steals.length}`, inline: true },
        );

      if (warnings.length > 0) {
        let warnText = '';
        for (const w of warnings.slice(0, 5)) {
          const date = w.warnedAt ? `<t:${Math.floor(new Date(w.warnedAt).getTime() / 1000)}:d>` : 'Unknown';
          warnText += `${w.isActive ? '**[Active]**' : '[Cleared]'} ${date} - ${w.reason} (by ${w.warnedByUser.username})\n`;
        }
        if (warnings.length > 5) warnText += `*...and ${warnings.length - 5} more*\n`;
        embed.addFields({ name: `Warnings (${warnings.length})`, value: warnText });
      }

      if (steals.length > 0) {
        let stealText = '';
        for (const s of steals.slice(0, 5)) {
          const date = s.createdAt ? `<t:${Math.floor(new Date(s.createdAt).getTime() / 1000)}:d>` : 'Unknown';
          const paidTag = s.paid ? '[Paid]' : '**[Not Paid]**';
          stealText += `${paidTag} ${date} - ${s.item}${s.notes ? ` (${s.notes})` : ''} - by ${s.staffUser.username}\n`;
        }
        if (steals.length > 5) stealText += `*...and ${steals.length - 5} more*\n`;
        embed.addFields({ name: `Steal History (${steals.length})`, value: stealText });
      }

      if (warnings.length === 0 && steals.length === 0) {
        embed.addFields({ name: 'Record', value: 'Clean - no warnings or steals on file.' });
      }

      embed.setFooter({ text: `User ID: ${targetDiscordUser.id}` }).setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === 'modlog') {
      const limit = interaction.options.getInteger('limit') || 10;
      const logs = await storage.getAuditLogs(Math.min(limit, 25));

      if (logs.length === 0) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription('No moderation actions recorded yet.')], ephemeral: true });
        return;
      }

      const actionIcons: Record<string, string> = {
        warn: 'Warning',
        mute: 'Mute',
        unmute: 'Unmute',
        ban: 'Ban',
        unban: 'Unban',
        steal_logged: 'Steal Logged',
      };

      let logText = '';
      for (const log of logs) {
        const date = log.createdAt ? `<t:${Math.floor(new Date(log.createdAt).getTime() / 1000)}:R>` : 'Unknown';
        const target = log.targetUser ? `<@${log.targetUser.discordId}>` : 'N/A';
        const details = log.details as any;
        const reason = details?.reason ? ` - ${details.reason}` : '';
        const actionName = actionIcons[log.action] || log.action.toUpperCase();
        logText += `**${actionName}** on ${target} by ${log.admin.username} ${date}${reason}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Recent Moderation Actions')
        .setDescription(logText)
        .setFooter({ text: `Showing ${logs.length} entries` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    return;
  }

}

async function handleButton(interaction: any) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Sync user to DB
  let user = await storage.getUserByDiscordId(userId);
  if (!user) {
    user = await storage.createUser({ discordId: userId, username });
  }

  // --- New: handle Gmax pick buttons ---
  if (customId.startsWith('gmax_pick_')) {
    const raw = customId.replace('gmax_pick_', '').toLowerCase();
    const map: Record<string, string> = {
      'urshifu': 'Urshifu',
      'melmetal': 'Melmetal',
      'eternatus': 'Eternatus',
    };
    const choice = map[raw];
    if (!choice) {
      await interaction.reply({ content: 'Unknown Gigantamax choice.', ephemeral: true });
      return;
    }

    const reservation = await storage.getReservationByUser(user.id);
    if (!reservation || reservation.category !== 'Gmax') {
      await interaction.reply({ content: 'No active Gmax reservation found to set this choice.', ephemeral: true });
      return;
    }

    await storage.updateReservation(reservation.id, { additionalPokemon: choice });
    await interaction.reply({ content: `Set your Gigantamax Rare choice to ${choice}. **You may now use !res to select your additional reserve**.`, ephemeral: true });

    // update embed if present
    if (interaction.channel instanceof TextChannel) {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
      if (orgMessage) {
        await updateOrgEmbed(interaction.channel, orgMessage.id);
      }
    }
    return;
  }

  // --- New: handle Galarian bird pick buttons ---
  if (customId.startsWith('galarian_bird_')) {
    const raw = customId.replace('galarian_bird_', '').toLowerCase();
    const map: Record<string, string> = {
      'articuno': 'Galarian Articuno',
      'zapdos': 'Galarian Zapdos',
      'moltres': 'Galarian Moltres',
    };
    const choice = map[raw];
    if (!choice) {
      await interaction.reply({ content: 'Unknown Galarian bird choice.', ephemeral: true });
      return;
    }

    const reservation = await storage.getReservationByUser(user.id);
    if (!reservation || reservation.category !== 'Regionals') {
      console.log("Galarian bird check failed:", { hasReservation: !!reservation, category: reservation?.category, subCategory: reservation?.subCategory });
      await interaction.reply({ content: 'No active Regional reservation found to set this choice.', ephemeral: true });
      return;
    }

    await storage.updateReservation(reservation.id, { additionalPokemon: choice });
    // Only Standard Regional gets extra reserve via !res
    if (reservation.subCategory === 'standard') {
      await interaction.reply({ content: `Set your Galarian bird choice to ${choice}. **You may now use !res to select your additional reserve**.`, ephemeral: true });
    } else {
      // Galarian sub-category - no extra reserve
      await interaction.reply({ content: `Set your Galarian bird choice to ${choice}.`, ephemeral: true });
    }

    // update embed if present
    if (interaction.channel instanceof TextChannel) {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
      if (orgMessage) {
        await updateOrgEmbed(interaction.channel, orgMessage.id);
      }
    }
    return;
  }

  // Admin manage button
  if (customId === 'admin_manage') {
    // Authorization: either ManageGuild permission, hardcoded admin role, or role set in database
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();

    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        isAdmin = true;
      } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {
      // ignore and treat as not admin
    }

    if (!isAdmin) {
      await interaction.reply({ content: "You do not have permission to manage reservations.", ephemeral: true });
      return;
    }

    // Build select menu with current reservations (limit to 25 options)
    const reservations = await storage.getReservations();
    const options = reservations.slice(0, 25).map(r => ({
      label: `${r.user.username} — ${r.category}`,
      description: r.pokemon1 ? `${r.pokemon1}${r.pokemon2 ? `, ${r.pokemon2}` : ''}` : 'No pokemon listed',
      value: String(r.id),
    }));

    if (options.length === 0) {
      await interaction.reply({ content: "No reservations available to manage.", ephemeral: true });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('admin_cancel_select')
      .setPlaceholder('Select reservation to cancel')
      .addOptions(options)
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({ content: "Select a reservation to cancel:", components: [row], ephemeral: true });
    return;
  }

  // Staff: Announce Buy button
  if (customId === 'staff_announce_buy') {
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        isAdmin = true;
      } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {}

    if (!isAdmin) {
      await interaction.reply({ content: "Only staff can use this button.", ephemeral: true });
      return;
    }

    if (interaction.channel instanceof TextChannel) {
      await interaction.channel.send({
        content: `Thank you <@&1468236218331562024> all slots have been filled and you can start buying your channels!`,
        allowedMentions: { roles: ['1468236218331562024'] }
      });
      await interaction.reply({ content: "Buy announcement sent.", ephemeral: true });
    } else {
      await interaction.reply({ content: "This can only be used in a text channel.", ephemeral: true });
    }
    return;
  }

  // Staff: Unlock Booster Reserves button
  if (customId === 'staff_unlock_booster') {
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
        isAdmin = true;
      } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
        isAdmin = true;
      }
    } catch (e) {}

    if (!isAdmin) {
      await interaction.reply({ content: "Only staff can use this button.", ephemeral: true });
      return;
    }

    boosterUnlocked = true;
    await interaction.reply({ content: "Server Booster Reserves have been unlocked. Users can now claim them.", ephemeral: true });

    if (interaction.channel instanceof TextChannel && interaction.message) {
      await updateOrgEmbed(interaction.channel, interaction.message.id);
    }
    return;
  }

  // Handle Category Selection
  if (customId.startsWith('cat_')) {
    const categoryKey = customId.replace('cat_', '').toUpperCase();
    const categoryName = CATEGORIES[categoryKey as keyof typeof CATEGORIES]?.name || categoryKey;
    const range = CATEGORIES[categoryKey as keyof typeof CATEGORIES]?.range || '';

    // Check if category is already claimed by someone else
    const existingReservations = await storage.getReservations();

    // Block user from claiming a new category if they have an incomplete reservation that requires !res
    const categoriesRequiringRes = ['Rares', 'Eevos', 'Reserve 1', 'Reserve 2', 'Reserve 3', 'MissingNo', 'Choice 1', 'Choice 2', 'Staff Reserve', 'Server Booster Reserves'];
    const userExistingReservations = existingReservations.filter(r => r.user.discordId === userId);
    for (const userRes of userExistingReservations) {
      let needsRes = false;

      if (categoriesRequiringRes.includes(userRes.category)) {
        // Check if they still need to use !res (pokemon1 not set)
        if (!userRes.pokemon1) {
          needsRes = true;
        }
      } else if (userRes.category === 'Gmax') {
        // Gmax needs: pick Gmax rare (additionalPokemon) then !res for additional reserve (pokemon1)
        if (!userRes.additionalPokemon || !userRes.pokemon1) {
          needsRes = true;
        }
      } else if (userRes.category === 'Regionals' && (userRes.subCategory === 'standard' || userRes.subCategory === 'none')) {
        // Standard Regional needs: pick Galarian bird (additionalPokemon) then !res for additional reserve (pokemon1)
        if (!userRes.additionalPokemon || !userRes.pokemon1) {
          needsRes = true;
        }
      }

      if (needsRes) {
        // Build a helpful message based on what step they're missing
        let stepMessage = 'adding your Pokemon using **!res**';
        if ((userRes.category === 'Gmax' && !userRes.additionalPokemon)) {
          stepMessage = 'picking your Gigantamax Rare and then using **!res** for your additional reserve';
        } else if (userRes.category === 'Regionals' && !userRes.additionalPokemon) {
          stepMessage = 'picking your Galarian bird and then using **!res** for your additional reserve';
        }

        await interaction.reply({ content: `You must complete your reservation for **${userRes.category}${userRes.subCategory && userRes.subCategory !== 'none' ? ` (${userRes.subCategory})` : ''}** by ${stepMessage} before selecting another category.`, ephemeral: true });
        return;
      }
    }
    
    // Special handling for Regionals - allow multiple subcategories but not Standard Regional with others
    if (categoryName === 'Regionals') {
      const regionalReservations = existingReservations.filter(r => r.category === 'Regionals');
      
      // Check if Standard Regional exists and holder has used !res (picked a Galarian bird)
      const standardHolder = regionalReservations.find(r => r.subCategory === 'standard' || r.subCategory === 'none');
      const hasStandardRegional = !!standardHolder;
      const standardHasReserved = standardHolder && standardHolder.additionalPokemon;
      
      // Check if any sub-category holder has used !res (has pokemon1 set OR additionalPokemon for galarian bird)
      const subCategoryReservations = regionalReservations.filter(r => 
        r.subCategory && r.subCategory !== 'standard' && r.subCategory !== 'none'
      );
      const anySubCategoryHasReserved = subCategoryReservations.some(r => r.pokemon1 || r.additionalPokemon);
      
      // Check if user already has a Regional reservation
      const userRegionalRes = regionalReservations.find(r => r.user.discordId === userId);
      if (userRegionalRes) {
        await interaction.reply({ content: `You already have a Regional reservation (${userRegionalRes.subCategory || 'pending'}). Use /cancelres to release it first.`, ephemeral: true });
        return;
      }
      
      // Check which subcategories are taken (only count confirmed ones with subCategory set)
      const confirmedRegionals = regionalReservations.filter(r => r.subCategory);
      const takenSubcategories = confirmedRegionals.map(r => r.subCategory?.toLowerCase()).filter(Boolean);
      const allThreeTaken = takenSubcategories.includes('galarian') && 
                            takenSubcategories.includes('alolan') && 
                            takenSubcategories.includes('hisuian');
      
      // Block if all 3 subcategories are taken
      if (allThreeTaken) {
        await interaction.reply({ content: `All Regional subcategories are taken. Someone must use /cancelres first.`, ephemeral: true });
        return;
      }
      
      // If Standard Regional is picked, block all sub-categories
      if (hasStandardRegional) {
        await interaction.reply({ content: `Standard Regional has been picked so the sub-categories (Galarian, Alolan, Hisuian) are not available.`, ephemeral: true });
        return;
      }
      
      // Build subcategory buttons
      const buttons: ButtonBuilder[] = [];
      
      // Show sub-categories if not already taken (only when Standard Regional is NOT selected)
      if (!takenSubcategories.includes('galarian')) {
        buttons.push(new ButtonBuilder().setCustomId('sub_galarian').setLabel('Galarian').setStyle(ButtonStyle.Primary));
      }
      if (!takenSubcategories.includes('alolan')) {
        buttons.push(new ButtonBuilder().setCustomId('sub_alolan').setLabel('Alolan').setStyle(ButtonStyle.Primary));
      }
      if (!takenSubcategories.includes('hisuian')) {
        buttons.push(new ButtonBuilder().setCustomId('sub_hisuian').setLabel('Hisuian').setStyle(ButtonStyle.Primary));
      }
      
      // Show Standard Regional if:
      // - No sub-category has used !res yet (anySubCategoryHasReserved = false)
      // - No Standard Regional already exists
      // - No sub-categories exist at all (sub-categories being selected blocks Standard)
      if (!hasStandardRegional && !anySubCategoryHasReserved && subCategoryReservations.length === 0) {
        buttons.push(new ButtonBuilder().setCustomId('sub_none').setLabel('Standard Regional').setStyle(ButtonStyle.Secondary));
      }
      
      // If no buttons available, all are taken
      if (buttons.length === 0) {
        await interaction.reply({ content: `All Regional subcategories are taken. Someone must use /cancelres first.`, ephemeral: true });
        return;
      }
      
      // Create new reservation (we already checked user doesn't have one earlier)
      await storage.createReservation({
        userId: user.id,
        category: categoryName,
        channelRange: range,
      });
      
      const subRow = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
      await interaction.reply({ content: `You selected ${categoryName}. Choose a sub-category:`, components: [subRow], ephemeral: true });
    } else {
      // For all other categories (including Gmax and Reserves)
      const categoryReservations = existingReservations.filter(r => r.category === categoryName);
      
      // Special logic for Staff Reserve: only staff role can claim, up to 2 Pokemon
      if (categoryName === 'Staff Reserve') {
        const member = await interaction.guild?.members.fetch(userId);
        if (!member?.roles.cache.has(ADMIN_ROLE_ID)) {
          await interaction.reply({ content: `Only staff members can claim this category.`, ephemeral: true });
          return;
        }
        
        // Check if already claimed
        if (categoryReservations.length >= 1) {
          const alreadyClaimedByUser = categoryReservations.find(r => r.user.discordId === userId);
          if (alreadyClaimedByUser) {
            await interaction.reply({ content: `You already have a Staff Reserve. Use !res (Pokemon Pokemon) to reserve up to 2 Pokemon.`, ephemeral: true });
          } else {
            await interaction.reply({ content: `Staff Reserve is already claimed by ${categoryReservations[0].user.username}.`, ephemeral: true });
          }
          return;
        }
        
        // Create reservation
        await storage.createReservation({
          userId: user.id,
          category: categoryName,
          channelRange: range,
        });
        
        await interaction.reply({ content: `You claimed Staff Reserve. Use !res (Pokemon Pokemon) to reserve up to 2 Pokemon.`, ephemeral: true });
        
        if (interaction.channel instanceof TextChannel && interaction.message) {
          await updateOrgEmbed(interaction.channel, interaction.message.id);
        }
        return;
      }
      
      // Special logic for Server Booster Reserves: require booster role, must be unlocked by staff
      if (categoryName === 'Server Booster Reserves') {
        if (!boosterUnlocked) {
          await interaction.reply({ content: `Server Booster Reserves are currently locked. A staff member must unlock them first.`, ephemeral: true });
          return;
        }

        const BOOSTER_ROLE_ID = '1405333965933383772';
        const member = await interaction.guild?.members.fetch(userId);
        const isStaff = member?.roles.cache.has(ADMIN_ROLE_ID);
        
        if (!member?.roles.cache.has(BOOSTER_ROLE_ID) && !isStaff) {
          await interaction.reply({ content: `You must have the Server Booster role to claim this category.`, ephemeral: true });
          return;
        }
        
        // Check if already claimed by 2 people
        if (categoryReservations.length >= 2) {
          const alreadyClaimedByUser = categoryReservations.find(r => r.user.discordId === userId);
          if (alreadyClaimedByUser) {
            await interaction.reply({ content: `You already have a Server Booster reservation. Use !res to reserve your Pokemon.`, ephemeral: true });
          } else {
            await interaction.reply({ content: `Server Booster Reserves is already fully claimed (Split taken).`, ephemeral: true });
          }
          return;
        }
        
        // Check if user already has a reservation
        const userReservation = categoryReservations.find(r => r.user.discordId === userId);
        if (userReservation) {
          await interaction.reply({ content: `You already have a Server Booster reservation. Use !res to reserve your Pokemon.`, ephemeral: true });
          return;
        }
        
        // Create reservation - staff can have 2 Pokemon, others only 1
        await storage.createReservation({
          userId: user.id,
          category: categoryName,
          channelRange: range,
        });
        
        if (isStaff) {
          await interaction.reply({ content: `You claimed Server Booster Reserves as staff. Use !res (Pokemon Pokemon) to reserve up to 2 Pokemon. One more booster can also claim this category.`, ephemeral: true });
        } else if (categoryReservations.length === 0) {
          await interaction.reply({ content: `You claimed Server Booster Reserves. Use !res (Pokemon) to reserve your Pokemon. One more booster can also claim this category.`, ephemeral: true });
        } else {
          await interaction.reply({ content: `You claimed the split for Server Booster Reserves. Use !res (Pokemon) to reserve your Pokemon.`, ephemeral: true });
        }
        
        if (interaction.channel instanceof TextChannel && interaction.message) {
          await updateOrgEmbed(interaction.channel, interaction.message.id);
        }
        return;
      }
      
      // Special logic for reserves: allow someone else to claim if split is available
      if (categoryName.startsWith('Reserve') && categoryReservations.length > 0) {
        const existing = categoryReservations[0];
        if (existing.pokemon1 && !existing.pokemon2) {
          // Person who already has it can't claim again as a new reservation
          if (existing.user.discordId === userId) {
            await interaction.reply({ content: `You already have this reservation. **Use !res to add your second pokemon**.`, ephemeral: true });
            return;
          }
          
          // Check if someone else already claimed the split
          if (categoryReservations.length >= 2) {
             const alreadyClaimedByUser = categoryReservations.find(r => r.user.discordId === userId);
             if (alreadyClaimedByUser) {
               await interaction.reply({ content: `You already have a split reservation for ${categoryName}. **Use !res to reserve**.`, ephemeral: true });
             } else {
               await interaction.reply({ content: `${categoryName} is already fully claimed (Split taken).`, ephemeral: true });
             }
             return;
          }

          // Someone else can claim the split (they only get 1 Pokemon since original took 1)
          await storage.createReservation({
            userId: user.id,
            category: categoryName,
            channelRange: range,
          });
          await interaction.reply({ content: `You claimed the split for ${categoryName}. **Use !res (Pokemon) to reserve your 1 Pokemon**.`, ephemeral: true });
          if (interaction.channel instanceof TextChannel && interaction.message) {
            await updateOrgEmbed(interaction.channel, interaction.message.id);
          }
          return;
        }
      }

      const existingClaim = categoryReservations[0];
      if (existingClaim) {
        if (existingClaim.user.discordId === userId) {
          await interaction.reply({ content: `You already have a reservation for ${categoryName}. Use /cancelres to release it first.`, ephemeral: true });
        } else {
          await interaction.reply({ content: `${categoryName} is already claimed by ${existingClaim.user.username}. They must use /cancelres first.`, ephemeral: true });
        }
        return;
      }
      
      // Create reservation
      await storage.createReservation({
        userId: user.id,
        category: categoryName,
        channelRange: range,
      });

      // Assign temporary role
      const roleId = "1468236218331562024";
      try {
        const member = await interaction.guild?.members.fetch(userId);
        if (member && !member.roles.cache.has(roleId)) {
          await member.roles.add(roleId);
          console.log(`Assigned temporary role to ${username}`);
        }
      } catch (error) {
        console.error(`Failed to assign role to ${username}:`, error);
      }
      
      if (customId === 'cat_gmax') {
        // Show Gigantamax Rare choice buttons immediately
        const gmaxRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder().setCustomId('gmax_pick_urshifu').setLabel('Urshifu').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('gmax_pick_melmetal').setLabel('Melmetal').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('gmax_pick_eternatus').setLabel('Eternatus').setStyle(ButtonStyle.Primary),
          );
        await interaction.reply({ 
          content: `You selected ${categoryName}. Please pick your Gigantamax Rare below:`, 
          components: [gmaxRow], 
          ephemeral: true 
        });
      } else if (customId === 'cat_missingno') {
        await interaction.reply({ content: `You selected ${categoryName}. **Use !res (Pokemon Pokemon) to reserve your 2 Pokemon**.`, ephemeral: true });
      } else if (customId === 'cat_choice1' || customId === 'cat_choice2') {
        await interaction.reply({ content: `You selected ${categoryName}. **Use !res (GroupName) for a group or !res (Pokemon Pokemon) for 2 individual Pokemon with multiple forms**.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `You selected ${categoryName}. **Use !res (Pokemon) to reserve**.`, ephemeral: true });
      }
    }

    // Update the main embed
    if (interaction.channel instanceof TextChannel && interaction.message) {
      await updateOrgEmbed(interaction.channel, interaction.message.id);
    }
    return;
  }

  // Handle Sub-category
  if (customId.startsWith('sub_')) {
    const sub = customId.replace('sub_', '');
    
    // Get all reservations and find user's REGIONAL reservation specifically (not just most recent)
    const allReservations = await storage.getReservations();
    const regionalReservations = allReservations.filter(r => r.category === 'Regionals');
    const userRegionalReservation = regionalReservations.find(r => r.user.discordId === interaction.user.id && !r.subCategory);
    
    if (!userRegionalReservation) {
      await interaction.reply({ content: "No pending Regional reservation found. Please click the Regionals category button first.", ephemeral: true });
      return;
    }
    
    // Check if the selected sub-category is already taken
    const takenSubcategories = regionalReservations
      .filter(r => r.subCategory)
      .map(r => r.subCategory?.toLowerCase())
      .filter(Boolean);
    
    if (sub !== 'none' && takenSubcategories.includes(sub.toLowerCase())) {
      await interaction.reply({ content: `The ${sub} subcategory is already taken. Please choose a different one.`, ephemeral: true });
      return;
    }
    
    // Check if Standard Regional exists - blocks ALL sub-categories
    const standardHolder = regionalReservations.find(r => r.subCategory === 'standard' || r.subCategory === 'none');
    if (standardHolder && sub !== 'none') {
      await interaction.reply({ content: `Standard Regional has been picked so the sub-categories (Galarian, Alolan, Hisuian) are not available.`, ephemeral: true });
      return;
    }
    
    // Check if Standard Regional is being blocked by an existing sub-category reservation that has used !res
    if (sub === 'none') {
      const subCategoryWithRes = regionalReservations.filter(r => 
        r.subCategory && r.subCategory !== 'standard' && r.subCategory !== 'none'
      );
      // Check both pokemon1 AND additionalPokemon (for galarian bird selection)
      const anySubCategoryHasReserved = subCategoryWithRes.some(r => r.pokemon1 || r.additionalPokemon);
      
      if (anySubCategoryHasReserved) {
        await interaction.reply({ content: `Standard Regionals are unavailable as somebody has already reserved a Sub Category.`, ephemeral: true });
        return;
      }
      
      // Also check if Standard is already taken
      if (takenSubcategories.includes('standard')) {
        await interaction.reply({ content: `Standard Regional is already taken.`, ephemeral: true });
        return;
      }
    }
    
    // Set 'standard' for Standard Regional so we can detect it (not null)
    await storage.updateReservation(userRegionalReservation.id, { subCategory: sub === 'none' ? 'standard' : sub });
    
    // If Galarian, just confirm the selection - NO extra reserve
    if (sub === 'galarian') {
      const birdRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder().setCustomId('galarian_bird_articuno').setLabel('Galarian Articuno').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('galarian_bird_zapdos').setLabel('Galarian Zapdos').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('galarian_bird_moltres').setLabel('Galarian Moltres').setStyle(ButtonStyle.Primary),
        );
      await interaction.reply({ content: `Updated to Galarian Regionals. Please pick which Galarian bird you want:`, components: [birdRow], ephemeral: true });
    } else if (sub === 'none') {
      // Standard Regional - show Galarian bird options AND gets extra reserve via !res after
      const birdRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder().setCustomId('galarian_bird_articuno').setLabel('Galarian Articuno').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('galarian_bird_zapdos').setLabel('Galarian Zapdos').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('galarian_bird_moltres').setLabel('Galarian Moltres').setStyle(ButtonStyle.Primary),
        );
      await interaction.reply({ content: `Updated to Standard Regional. Please pick a Galarian bird below. After picking, you may use !res to select your additional reserve.`, components: [birdRow], ephemeral: true });
    } else {
      // For Alolan and Hisuian - NO extra reserve slot available
      await interaction.reply({ content: `Updated sub-category to ${sub}. Note: Alolan and Hisuian subcategories do not receive a separate reserve slot.`, ephemeral: true });
    }

    // Update the main embed if we can find it
    if (interaction.channel instanceof TextChannel && interaction.message) {
      await updateOrgEmbed(interaction.channel, interaction.message.id);
    }
    return;
  }
  
  // Handle user change reserve button (from /cancelres)
  if (customId.startsWith('user_change_reserve_')) {
    const id = parseInt(customId.replace('user_change_reserve_', ''), 10);
    const reservations = await storage.getReservations();
    const reservation = reservations.find(r => r.id === id);
    
    if (!reservation) {
      await interaction.reply({ content: "Reservation not found.", ephemeral: true });
      return;
    }
    
    // Verify ownership
    const userId = interaction.user.id;
    const user = await storage.getUserByDiscordId(userId);
    if (!user || reservation.userId !== user.id) {
      await interaction.reply({ content: "You can only change your own reservations.", ephemeral: true });
      return;
    }
    
    // Clear the Pokemon fields but keep the category
    await storage.updateReservation(id, { pokemon1: null, pokemon2: null, additionalPokemon: null });
    
    await interaction.reply({ 
      content: `Your Pokemon selection for **${reservation.category}${reservation.subCategory ? ` (${reservation.subCategory})` : ''}** has been cleared. Use **!res** to choose new Pokemon.`, 
      ephemeral: true 
    });
    
    // Update the org embed
    if (interaction.channel instanceof TextChannel) {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
      if (orgMessage) {
        await updateOrgEmbed(interaction.channel, orgMessage.id);
      }
    }
    return;
  }
  
  // Handle admin clear pokemon button (keep category, notify user)
  if (customId.startsWith('admin_clear_pokemon_')) {
    // Verify admin permissions
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();
    const member = interaction.member;
    if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      isAdmin = true;
    } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
      isAdmin = true;
    } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
      isAdmin = true;
    }
    
    if (!isAdmin) {
      await interaction.reply({ content: "Only admins can manage reservations.", ephemeral: true });
      return;
    }
    
    const id = parseInt(customId.replace('admin_clear_pokemon_', ''), 10);
    const reservations = await storage.getReservations();
    const reservation = reservations.find(r => r.id === id);
    
    if (!reservation) {
      await interaction.reply({ content: "Reservation not found.", ephemeral: true });
      return;
    }
    
    // Clear the Pokemon fields but keep the category
    await storage.updateReservation(id, { pokemon1: null, pokemon2: null, additionalPokemon: null });
    
    await interaction.reply({ 
      content: `Cleared Pokemon selection for **${reservation.user.username}** (${reservation.category}). They have been notified to choose new Pokemon.`, 
      ephemeral: true 
    });
    
    // Notify the user in the channel
    if (interaction.channel instanceof TextChannel) {
      await interaction.channel.send(`<@${reservation.user.discordId}> Your reserve for **${reservation.category}${reservation.subCategory ? ` (${reservation.subCategory})` : ''}** has been modified by staff. Please use **!res** to choose a new Pokemon.`);
      
      // Update the org embed
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
      if (orgMessage) {
        await updateOrgEmbed(interaction.channel, orgMessage.id);
      }
    }
    return;
  }
  
  // Handle admin full cancel button
  if (customId.startsWith('admin_full_cancel_')) {
    // Verify admin permissions
    let isAdmin = false;
    const dbAdminRoleId = await storage.getAdminRole();
    const member = interaction.member;
    if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      isAdmin = true;
    } else if (member && member.roles && member.roles.cache && member.roles.cache.has(ADMIN_ROLE_ID)) {
      isAdmin = true;
    } else if (member && dbAdminRoleId && member.roles && member.roles.cache && member.roles.cache.has(dbAdminRoleId)) {
      isAdmin = true;
    }
    
    if (!isAdmin) {
      await interaction.reply({ content: "Only admins can manage reservations.", ephemeral: true });
      return;
    }
    
    const id = parseInt(customId.replace('admin_full_cancel_', ''), 10);
    const reservations = await storage.getReservations();
    const reservation = reservations.find(r => r.id === id);
    
    if (!reservation) {
      await interaction.reply({ content: "Reservation not found.", ephemeral: true });
      return;
    }
    
    await storage.deleteReservation(id);
    await interaction.reply({ 
      content: `Cancelled reservation for **${reservation.user.username}** (${reservation.category}).`, 
      ephemeral: true 
    });
    
    // Update the org embed
    if (interaction.channel instanceof TextChannel) {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
      if (orgMessage) {
        await updateOrgEmbed(interaction.channel, orgMessage.id);
      }
    }
    return;
  }
  
  // Handle user full cancel button (from /cancelres)
  if (customId.startsWith('user_full_cancel_')) {
    const id = parseInt(customId.replace('user_full_cancel_', ''), 10);
    const reservations = await storage.getReservations();
    const reservation = reservations.find(r => r.id === id);
    
    if (!reservation) {
      await interaction.reply({ content: "Reservation not found.", ephemeral: true });
      return;
    }
    
    // Verify ownership
    const userId = interaction.user.id;
    const user = await storage.getUserByDiscordId(userId);
    if (!user || reservation.userId !== user.id) {
      await interaction.reply({ content: "You can only cancel your own reservations.", ephemeral: true });
      return;
    }
    
    await storage.deleteReservation(id);
    await interaction.reply({ 
      content: `Cancelled reservation for **${reservation.category}${reservation.subCategory ? ` (${reservation.subCategory})` : ''}**.`, 
      ephemeral: true 
    });
    
    // Update the org embed
    if (interaction.channel instanceof TextChannel) {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
      if (orgMessage) {
        await updateOrgEmbed(interaction.channel, orgMessage.id);
      }
    }
    return;
  }
}

async function handleSelectMenu(interaction: any) {
  // Handle user manage select menu (from /cancelres)
  if (interaction.customId === 'user_manage_select') {
    const selected = interaction.values && interaction.values[0];
    if (!selected) {
      await interaction.reply({ content: "No reservation selected.", ephemeral: true });
      return;
    }

    const id = parseInt(selected, 10);
    const reservations = await storage.getReservations();
    const reservation = reservations.find(r => r.id === id);
    if (!reservation) {
      await interaction.reply({ content: "Reservation not found or already removed.", ephemeral: true });
      return;
    }

    // Verify the user owns this reservation
    const userId = interaction.user.id;
    const user = await storage.getUserByDiscordId(userId);
    if (!user || reservation.userId !== user.id) {
      await interaction.reply({ content: "You can only manage your own reservations.", ephemeral: true });
      return;
    }

    // Show buttons for change reserve or full cancel
    const hasPokemon = reservation.pokemon1 || reservation.pokemon2 || reservation.additionalPokemon;
    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`user_change_reserve_${id}`)
          .setLabel('Change Reserve')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!hasPokemon), // Disable if no Pokemon to change
        new ButtonBuilder()
          .setCustomId(`user_full_cancel_${id}`)
          .setLabel('Full Cancel')
          .setStyle(ButtonStyle.Danger),
      );

    const pokemonList = [reservation.pokemon1, reservation.pokemon2, reservation.additionalPokemon].filter(Boolean).join(', ');
    await interaction.reply({ 
      content: `**${reservation.category}${reservation.subCategory ? ` (${reservation.subCategory})` : ''}**\nPokemon: ${pokemonList || 'None'}\n\n**Change Reserve** - Clear your Pokemon selection and choose new ones with !res\n**Full Cancel** - Remove your entire reservation`, 
      components: [buttonRow], 
      ephemeral: true 
    });
    return;
  }

  // Handle admin cancel select menu
  if (interaction.customId === 'admin_cancel_select') {
    const selected = interaction.values && interaction.values[0];
    if (!selected) {
      await interaction.reply({ content: "No reservation selected.", ephemeral: true });
      return;
    }

    const id = parseInt(selected, 10);
    const reservations = await storage.getReservations();
    const reservation = reservations.find(r => r.id === id);
    if (!reservation) {
      await interaction.reply({ content: "Reservation not found or already removed.", ephemeral: true });
      return;
    }

    // Show buttons for admin options: Clear Pokemon (keep category) or Full Cancel
    const hasPokemon = reservation.pokemon1 || reservation.pokemon2 || reservation.additionalPokemon;
    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`admin_clear_pokemon_${id}`)
          .setLabel('Clear Pokemon (Keep Category)')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!hasPokemon),
        new ButtonBuilder()
          .setCustomId(`admin_full_cancel_${id}`)
          .setLabel('Full Cancel')
          .setStyle(ButtonStyle.Danger),
      );

    const pokemonList = [reservation.pokemon1, reservation.pokemon2, reservation.additionalPokemon].filter(Boolean).join(', ');
    await interaction.reply({ 
      content: `**${reservation.user.username}** - ${reservation.category}${reservation.subCategory ? ` (${reservation.subCategory})` : ''}\nPokemon: ${pokemonList || 'None'}\n\n**Clear Pokemon** - Remove their Pokemon selection but keep their category. They will be notified.\n**Full Cancel** - Remove their entire reservation.`, 
      components: [buttonRow], 
      ephemeral: true 
    });
    return;
  }
}

async function handleMessage(message: Message) {
  // ------- Pokétwo incense purchase detection -------
  // Detect PokeTwo's response: "You purchased an incense for..."
  const POKETWO_BOT_ID = '716390085896962058';
  const isPokeTwoMessage = message.author.id === POKETWO_BOT_ID;
  const purchasedIncense = /you purchased an incense for/i.test(message.content);
  
  if (isPokeTwoMessage && purchasedIncense) {
    const channelId = message.channel.id;

    // Only update if the channel is registered for a category
    const checks = await storage.getChannelChecks();
    const check = checks.find(c => c.channelId === channelId);

    if (check) {
      // mark as complete for that category/channel
      await storage.updateChannelCheck(check.category, channelId, true);

      // Update the org embed in this channel (if present)
      if (message.channel instanceof TextChannel) {
        const messages = await message.channel.messages.fetch({ limit: 50 });
        const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Operation Incense') || m.embeds[0].title.includes('Buyers Org')));
        if (orgMessage) {
          await updateOrgEmbed(message.channel, orgMessage.id);
        }
      }
    }
    return; // PokeTwo message handled, don't process further
  }
  // ------- end buy detection -------

  // Skip other bot messages
  if (message.author.bot) return;

  // Handle !res command
  if (message.content.startsWith('!res')) {
    const args = message.content.split(' ').slice(1);
    const pokemonNames = args.join(' ').trim();

    if (!pokemonNames) {
      await message.reply("Please specify at least one Pokemon name. Example: `!res vulpix` or `!res vulpix milcery`");
      return;
    }

    const user = await storage.getUserByDiscordId(message.author.id);
    if (!user) {
      await message.reply("Please start by using /startorg and selecting a category.");
      return;
    }

    // Get all user's reservations to find the one we're updating
    const allReservations = await storage.getReservations();
    const userReservations = allReservations.filter(r => r.userId === user.id);
    
    if (userReservations.length === 0) {
      await message.reply("No active reservation found. Use /startorg.");
      return;
    }

    // Check regional sub-categories that don't support !res
    const isNonResRegional = (r: typeof userReservations[0]) => {
      if (r.category !== 'Regionals') return false;
      const sub = r.subCategory?.toLowerCase();
      return sub === 'alolan' || sub === 'hisuian' || sub === 'galarian';
    };

    // Filter out regional sub-categories that don't support !res
    const resEligibleReservations = userReservations.filter(r => !isNonResRegional(r));

    if (resEligibleReservations.length === 0) {
      await message.reply(`None of your current categories use !res. Your reservations are already complete.`);
      return;
    }

    // Pick the reservation that needs !res (doesn't have pokemon1 set), or the most recent one
    let reservation = resEligibleReservations.find(r => !r.pokemon1);
    if (!reservation) reservation = resEligibleReservations[0];

    // Block Alolan/Hisuian/Galarian sub-categories from using !res (they don't get extra reserve)
    if (reservation.category === 'Regionals') {
      const subCat = reservation.subCategory?.toLowerCase();
      if (subCat === 'alolan' || subCat === 'hisuian' || subCat === 'galarian') {
        // Check if they already have their Galarian bird set (for galarian only)
        if (subCat === 'galarian' && reservation.additionalPokemon) {
          await message.reply(`You cannot use !res for Galarian sub-category. Only Standard Regional receives an additional reserve slot.`);
          return;
        } else if (subCat === 'alolan' || subCat === 'hisuian') {
          await message.reply(`You cannot use !res for ${subCat.charAt(0).toUpperCase() + subCat.slice(1)} sub-category. Only Standard Regional receives an additional reserve slot.`);
          return;
        }
      }
    }

    // Parse Pokemon names - split by spaces, but allow for multi-word Pokemon names
    const pokemonArray = pokemonNames.split(' ').filter(p => p.length > 0);

    // For Reserve categories, MissingNo, Choice 1, Choice 2, Staff Reserve allow up to 2 Pokemon
    const isReserveCategory = reservation.category.startsWith('Reserve');
    const isMissingNo = reservation.category === 'MissingNo';
    const isChoice = reservation.category === 'Choice 1' || reservation.category === 'Choice 2';
    const isStaffReserve = reservation.category === 'Staff Reserve';
    const isServerBoosterReserves = reservation.category === 'Server Booster Reserves';
    
    // Check if user is staff (for Server Booster allowing 2 Pokemon)
    let isStaff = false;
    try {
      const guild = message.guild;
      if (guild) {
        const member = await guild.members.fetch(message.author.id);
        isStaff = member.roles.cache.has(ADMIN_ROLE_ID);
      }
    } catch (e) {
      // ignore
    }
    
    // Check if this is a split reservation for Reserves (second person claiming split gets only 1 Pokemon)
    let isSplitReservation = false;
    if (isReserveCategory) {
      const categoryReservations = allReservations.filter(r => r.category === reservation!.category);
      if (categoryReservations.length >= 2) {
        // Find the OTHER reservation in this category (not the current user's)
        const otherReservation = categoryReservations.find(r => r.userId !== reservation!.userId);
        // This user is the split claimant if:
        // 1. There's another person's reservation in this category
        // 2. That person has reserved exactly 1 Pokemon (pokemon1 set, pokemon2 not set)
        // 3. The current reservation doesn't have pokemon1 set yet (they're the split claimant)
        if (otherReservation && otherReservation.pokemon1 && !otherReservation.pokemon2 && !reservation.pokemon1) {
          isSplitReservation = true;
        }
      }
    }
    
    // Check if this is Server Booster non-staff (they only get 1 Pokemon)
    let isBoosterNonStaff = false;
    if (isServerBoosterReserves && !isStaff) {
      isBoosterNonStaff = true;
    }
    
    // Determine max Pokemon
    let maxPokemon = 1;
    if (isSplitReservation || isBoosterNonStaff) {
      maxPokemon = 1;
    } else if (isReserveCategory || isMissingNo || isChoice || isStaffReserve || (isServerBoosterReserves && isStaff)) {
      maxPokemon = 2;
    }

    if (pokemonArray.length > maxPokemon) {
      await message.reply(`You can only reserve up to ${maxPokemon} Pokemon for ${reservation.category}.`);
      return;
    }

    // Check if any of the Pokemon are already reserved by someone else
    try {
      for (const pokemonName of pokemonArray) {
        const normalized = pokemonName.toLowerCase();
        const existing = allReservations.find(r => {
          const candidates = [r.pokemon1, r.pokemon2, r.additionalPokemon].filter(Boolean) as string[];
          return candidates.some(p => p.trim().toLowerCase() === normalized);
        });

        if (existing) {
          if (existing.userId === user.id) {
            await message.reply(`You have already reserved ${pokemonName}.`);
            return;
          } else {
            await message.reply(`${pokemonName} has already been reserved this round.`);
            return;
          }
        }
      }
    } catch (err) {
      console.error("Failed to check existing reservations for duplicates:", err);
    }

  let updated = false;

  // Handle single Pokemon reservation
  if (pokemonArray.length === 1) {
    const pokemonName = pokemonArray[0];

    if (!reservation.pokemon1) {
      await storage.updateReservation(reservation.id, { pokemon1: pokemonName });
      // Show appropriate message based on category and split status
      let extraMsg = '';
      if (isSplitReservation || isBoosterNonStaff) {
        extraMsg = '';
      } else if (isReserveCategory || isMissingNo || isStaffReserve || (isServerBoosterReserves && isStaff)) {
        extraMsg = ' You can add one more Pokemon with !res <pokemon>.';
      } else if (isChoice) {
        extraMsg = '';
      }
      await message.reply(`Reserved ${pokemonName} for ${reservation.category}.${extraMsg}`);
      updated = true;
    } else if (!reservation.pokemon2 && (isReserveCategory || isMissingNo || isChoice || isStaffReserve || (isServerBoosterReserves && isStaff)) && !isSplitReservation && !isBoosterNonStaff) {
      await storage.updateReservation(reservation.id, { pokemon2: pokemonName });
      await message.reply(`Reserved second Pokemon ${pokemonName} for ${reservation.category}.`);
      updated = true;
    } else if (reservation.category === 'Regionals' && reservation.subCategory === 'Galarian' && !reservation.additionalPokemon) {
      // Handle Galarian bird as additionalPokemon
      const normalized = pokemonName.toLowerCase();
      const bird = normalized.includes('articuno') ? 'Galarian Articuno' : 
                  normalized.includes('zapdos') ? 'Galarian Zapdos' : 
                  normalized.includes('moltres') ? 'Galarian Moltres' : null;
      const valueToSave = bird ?? (pokemonName.startsWith('Galarian') ? pokemonName : `Galarian ${pokemonName}`);
      await storage.updateReservation(reservation.id, { additionalPokemon: valueToSave });
      await message.reply(`Added Galarian choice ${valueToSave}.`);
      updated = true;
    } else if (reservation.category === 'Gmax' && !reservation.additionalPokemon) {
      // Handle Gmax rare choice
      await storage.updateReservation(reservation.id, { additionalPokemon: pokemonName });
      await message.reply(`Added Rare Gmax choice ${pokemonName}.`);
      updated = true;
    } else {
      await message.reply(`You already have reservations for this category.`);
    }
  } 
  // Handle double Pokemon reservation (for Reserve categories, MissingNo, Choice, Staff Reserve, Server Booster staff - but NOT for splits or non-staff boosters)
  else if (pokemonArray.length === 2 && (isReserveCategory || isMissingNo || isChoice || isStaffReserve || (isServerBoosterReserves && isStaff)) && !isSplitReservation && !isBoosterNonStaff) {
    const [pokemon1, pokemon2] = pokemonArray;

    if (!reservation.pokemon1) {
      await storage.updateReservation(reservation.id, { pokemon1, pokemon2 });
      await message.reply(`Reserved ${pokemon1} and ${pokemon2} for ${reservation.category}.`);
      updated = true;
    } else if (!reservation.pokemon2) {
      await storage.updateReservation(reservation.id, { pokemon2 });
      await message.reply(`Reserved second Pokemon ${pokemon2} for ${reservation.category}.`);
      updated = true;
    } else {
      await message.reply(`You already have reservations for this category.`);
    }
  }

  // After adding a pokemon for Gmax, prompt them to pick a Gigantamax Rare via buttons (only if not already chosen)
  const updatedReservation = reservation ? await storage.getReservationByUser(reservation.userId) : null;
  if (updated && updatedReservation && updatedReservation.category === 'Gmax' && !updatedReservation.additionalPokemon && message.channel instanceof TextChannel) {
    const choicesRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('gmax_pick_urshifu').setLabel('Urshifu').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('gmax_pick_melmetal').setLabel('Melmetal').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('gmax_pick_eternatus').setLabel('Eternatus').setStyle(ButtonStyle.Primary),
      );
    await message.reply({ content: 'Choose your Gigantamax Rare:', components: [choicesRow] });

    // update org embed as well
    const messages = await message.channel.messages.fetch({ limit: 50 });
    const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
    if (orgMessage) {
      await updateOrgEmbed(message.channel as TextChannel, orgMessage.id);
    }
  }

  // Attempt to update the last known Org embed in this channel for non-Gmax updates
  if (updated && message.channel instanceof TextChannel) {
    // Search for the bot's embed message in the last 50 messages
    const messages = await message.channel.messages.fetch({ limit: 50 });
    const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
    if (orgMessage) {
      await updateOrgEmbed(message.channel, orgMessage.id);
    }
  }
  }
}