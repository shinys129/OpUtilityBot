import { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Interaction, Message, TextChannel, StringSelectMenuBuilder, PermissionFlagsBits, type Collection, type Snowflake } from "discord.js";
import type { Message as DiscordMessage } from "discord.js";
import { storage } from "./storage";

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
};

let client: Client | null = null;

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
  }
}

// Helper function to build category buttons with locking (disable if claimed by someone else)
async function buildCategoryButtons(reservations: any[]): Promise<ActionRowBuilder<ButtonBuilder>[]> {
  const claimedCategories = new Map<string, string>();
  for (const r of reservations) {
    // Skip Regionals - handled separately
    if (r.category === 'Regionals') continue;
    claimedCategories.set(r.category.toLowerCase().replace(/\s+/g, ''), r.user.username);
  }

  // Special handling for Regionals
  // Only count reservations that have a subCategory set (user has made their choice)
  const regionalReservations = reservations.filter(r => r.category === 'Regionals' && r.subCategory);
  // Standard Regional is explicitly set as 'standard' or similar, not null
  const hasStandardRegional = regionalReservations.some(r => r.subCategory === 'standard' || r.subCategory === 'none');
  const takenSubcategories = regionalReservations.map(r => r.subCategory?.toLowerCase()).filter(Boolean);
  const allThreeTaken = takenSubcategories.includes('galarian') && 
                        takenSubcategories.includes('alolan') && 
                        takenSubcategories.includes('hisuian');
  const regionalsLocked = hasStandardRegional || allThreeTaken;
  
  // Build label for Regionals showing who has it
  let regionalsLabel = 'Regionals (24-43)';
  if (regionalReservations.length > 0) {
    const names = regionalReservations.map(r => r.user.username).join(', ');
    regionalsLabel = `Regionals (24-43) - ${names}`;
  }

  const isLocked = (catKey: string) => claimedCategories.has(catKey.toLowerCase());
  const getLabel = (catKey: string, baseName: string, range: string) => {
    const owner = claimedCategories.get(catKey.toLowerCase());
    return owner ? `${baseName} (${range}) - ${owner}` : `${baseName} (${range})`;
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
        .setLabel(regionalsLabel)
        .setStyle(regionalsLocked ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(regionalsLocked),
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
        .setStyle(isLocked('choice1') ? ButtonStyle.Secondary : ButtonStyle.Secondary)
        .setDisabled(isLocked('choice1')),
      new ButtonBuilder()
        .setCustomId('cat_choice2')
        .setLabel(getLabel('choice2', 'Choice 2', '75-81'))
        .setStyle(isLocked('choice2') ? ButtonStyle.Secondary : ButtonStyle.Secondary)
        .setDisabled(isLocked('choice2')),
      new ButtonBuilder()
        .setCustomId('cat_missingno')
        .setLabel(getLabel('missingno', 'MissingNo', '82-88'))
        .setStyle(isLocked('missingno') ? ButtonStyle.Secondary : ButtonStyle.Secondary)
        .setDisabled(isLocked('missingno')),
    );

  const row3 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('cat_res1')
        .setLabel(getLabel('reserve1', 'Reserve 1', '89-92'))
        .setStyle(isLocked('reserve1') ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isLocked('reserve1')),
      new ButtonBuilder()
        .setCustomId('cat_res2')
        .setLabel(getLabel('reserve2', 'Reserve 2', '93-96'))
        .setStyle(isLocked('reserve2') ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isLocked('reserve2')),
      new ButtonBuilder()
        .setCustomId('cat_res3')
        .setLabel(getLabel('reserve3', 'Reserve 3', '97-100'))
        .setStyle(isLocked('reserve3') ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isLocked('reserve3')),
    );

  const adminRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder().setCustomId('admin_manage').setLabel('🔧 Manage Reservations').setStyle(ButtonStyle.Danger),
    );

  return [row1, row2, row3, adminRow];
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
      (m.embeds[0].title.includes('Pokemon Reservation') || m.embeds[0].title.includes('Reservation Hub'))
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
  const totalCategories = Object.keys(CATEGORIES).length;
  const filledCategories = new Set(reservations.map(r => r.category)).size;

  const embed = new EmbedBuilder()
    .setTitle('⚡ Pokemon Reservation Hub')
    .setDescription(
      `**Organization Status**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 **${filledCategories}/${totalCategories}** categories filled\n` +
      `👥 **${totalReservations}** active reservations\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Click a category button below to claim it.\nUse \`/cancelres\` to release your slot.`
    )
    .setColor(0x5865F2)
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
  if (interaction.commandName === 'startorg') {
    const reservations = await storage.getReservations();
    const buttons = await buildCategoryButtons(reservations);

    const embed = new EmbedBuilder()
      .setTitle('⚡ Pokemon Reservation Hub')
      .setDescription('Loading status...')
      .setColor(0x5865F2);

    const message = await interaction.reply({ embeds: [embed], components: buttons, fetchReply: true });

    if (interaction.channel instanceof TextChannel) {
      await updateOrgEmbed(interaction.channel, message.id);
      // Save the message ID to database for reliable retrieval
      await storage.setOrgState(interaction.channel.id, message.id);
    }
  }

  if (interaction.commandName === 'refreshorg') {
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "This command only works in text channels.", ephemeral: true });
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

    try {
      // Get current reservations
      const reservations = await storage.getReservations();
      const checks = await storage.getChannelChecks();
      
      const totalReservations = reservations.length;
      const totalCategories = Object.keys(CATEGORIES).length;
      const filledCategories = new Set(reservations.map(r => r.category)).size;

      // Build the full embed with all reservation data
      const embed = new EmbedBuilder()
        .setTitle('⚡ Pokemon Reservation Hub')
        .setDescription(
          `**Organization Status**\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📊 **${filledCategories}/${totalCategories}** categories filled\n` +
          `👥 **${totalReservations}** active reservations\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Click a category button below to claim it.\nUse \`/cancelres\` to release your slot.`
        )
        .setColor(0x5865F2)
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
      await storage.setOrgState(interaction.channel.id, message.id);
      
      // Send a follow-up message to confirm
      await interaction.followUp({ content: "✅ Embed reloaded successfully! All reservation data has been preserved.", ephemeral: true });
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

  // New: /cancelres - cancel the user's latest active reservation
  if (interaction.commandName === 'cancelres') {
    const discordId = interaction.user.id;
    const user = await storage.getUserByDiscordId(discordId);
    if (!user) {
      await interaction.reply({ content: "You have no reservations to cancel.", ephemeral: true });
      return;
    }

    const reservation = await storage.getReservationByUser(user.id);
    if (!reservation) {
      await interaction.reply({ content: "No active reservation found.", ephemeral: true });
      return;
    }

    try {
      await storage.deleteReservation(reservation.id);
      await interaction.reply({ content: `Cancelled reservation for ${reservation.category}.`, ephemeral: true });

      // Attempt to update the main Org embed in this channel
      if (interaction.channel instanceof TextChannel) {
        const messages = await interaction.channel.messages.fetch({ limit: 50 });
        const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Pokemon Reservation') || m.embeds[0].title.includes('Reservation Hub')));
        if (orgMessage) {
          await updateOrgEmbed(interaction.channel, orgMessage.id);
        }
      }
    } catch (err) {
      console.error("Failed to delete reservation:", err);
      await interaction.reply({ content: "Failed to cancel reservation. Try again later.", ephemeral: true });
    }
  }

  // New: /endorg - admin only: close the embed and clear reservations/checks
  if (interaction.commandName === 'endorg') {
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
      await interaction.reply({ content: "You do not have permission to end the organization.", ephemeral: true });
      return;
    }

    // Defer reply immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Find the org message BEFORE clearing data
    let orgMessage: DiscordMessage | null = null;
    if (interaction.channel instanceof TextChannel) {
      orgMessage = await findOrgMessage(interaction.channel);
    }

    // Clear reservations and channel checks (reset isComplete but preserve mappings)
    try {
      await storage.clearReservations();
      await storage.clearChannelChecks();
      await storage.clearOrgState();
    } catch (err) {
      console.error("Failed to clear reservations/checks:", err);
      // Continue anyway - try to close the embed
    }

    // Close the embed if found
    if (orgMessage) {
      try {
        const closedEmbed = new EmbedBuilder()
          .setTitle('Pokemon Reservation Status — CLOSED')
          .setDescription('This organization round has been closed. Use /startorg to begin a fresh round.')
          .setColor(0x808080)
          .setTimestamp();

        await orgMessage.edit({ embeds: [closedEmbed], components: [] });
        await interaction.editReply({ content: "✅ Organization closed and reservations cleared. Use /startorg to begin a fresh round." });
      } catch (err) {
        console.error("Failed to edit org message during endorg:", err);
        await interaction.editReply({ content: "Data cleared but failed to close the embed. You may need to delete it manually." });
      }
    } else {
      await interaction.editReply({ content: "Data cleared. No org embed was found to close." });
    }
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
        const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Pokemon Reservation') || m.embeds[0].title.includes('Reservation Hub')));
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
    await interaction.reply({ content: `Set your Gigantamax Rare choice to ${choice}.`, ephemeral: true });

    // update embed if present
    if (interaction.channel instanceof TextChannel) {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Pokemon Reservation') || m.embeds[0].title?.includes('Reservation Hub')));
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
    await interaction.reply({ content: `Set your Galarian bird choice to ${choice}.`, ephemeral: true });

    // update embed if present
    if (interaction.channel instanceof TextChannel) {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Pokemon Reservation') || m.embeds[0].title?.includes('Reservation Hub')));
      if (orgMessage) {
        await updateOrgEmbed(interaction.channel, orgMessage.id);
      }
    }
    return;
  }

  // Admin manage button
  if (customId === 'admin_manage') {
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

  // Handle Category Selection
  if (customId.startsWith('cat_')) {
    const categoryKey = customId.replace('cat_', '').toUpperCase();
    const categoryName = CATEGORIES[categoryKey as keyof typeof CATEGORIES]?.name || categoryKey;
    const range = CATEGORIES[categoryKey as keyof typeof CATEGORIES]?.range || '';

    // Check if category is already claimed by someone else
    const existingReservations = await storage.getReservations();
    
    // Special handling for Regionals - allow multiple subcategories but not Standard Regional with others
    if (categoryName === 'Regionals') {
      const regionalReservations = existingReservations.filter(r => r.category === 'Regionals');
      const hasStandardRegional = regionalReservations.some(r => !r.subCategory || r.subCategory === 'none');
      
      // Block if someone has Standard Regional
      if (hasStandardRegional) {
        const standardHolder = regionalReservations.find(r => !r.subCategory || r.subCategory === 'none');
        if (standardHolder?.user.discordId === userId) {
          await interaction.reply({ content: `You already have a Standard Regional reservation. Use /cancelres to release it first.`, ephemeral: true });
        } else {
          await interaction.reply({ content: `Regionals is fully claimed by ${standardHolder?.user.username} (Standard Regional). They must use /cancelres first.`, ephemeral: true });
        }
        return;
      }
      
      // Check which subcategories are taken
      const takenSubcategories = regionalReservations.map(r => r.subCategory?.toLowerCase()).filter(Boolean);
      const allThreeTaken = takenSubcategories.includes('galarian') && 
                            takenSubcategories.includes('alolan') && 
                            takenSubcategories.includes('hisuian');
      
      // Block if all 3 subcategories are taken
      if (allThreeTaken) {
        await interaction.reply({ content: `All Regional subcategories are taken. Someone must use /cancelres first.`, ephemeral: true });
        return;
      }
      
      // Check if user already has a Regional reservation
      const userRegional = regionalReservations.find(r => r.user.discordId === userId);
      if (userRegional) {
        await interaction.reply({ content: `You already have a Regional reservation (${userRegional.subCategory || 'Standard'}). Use /cancelres to release it first.`, ephemeral: true });
        return;
      }
      
      // Create reservation and show subcategory options
      await storage.createReservation({
        userId: user.id,
        category: categoryName,
        channelRange: range,
      });
      
      // Build subcategory buttons - hide ones already taken, hide Standard if any subcategory is taken
      const buttons: ButtonBuilder[] = [];
      if (!takenSubcategories.includes('galarian')) {
        buttons.push(new ButtonBuilder().setCustomId('sub_galarian').setLabel('Galarian').setStyle(ButtonStyle.Primary));
      }
      if (!takenSubcategories.includes('alolan')) {
        buttons.push(new ButtonBuilder().setCustomId('sub_alolan').setLabel('Alolan').setStyle(ButtonStyle.Primary));
      }
      if (!takenSubcategories.includes('hisuian')) {
        buttons.push(new ButtonBuilder().setCustomId('sub_hisuian').setLabel('Hisuian').setStyle(ButtonStyle.Primary));
      }
      // Only show Standard Regional if no one has picked any subcategory yet
      if (regionalReservations.length === 0) {
        buttons.push(new ButtonBuilder().setCustomId('sub_none').setLabel('Standard Regional').setStyle(ButtonStyle.Secondary));
      }
      
      const subRow = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
      await interaction.reply({ content: `You selected ${categoryName}. Choose a sub-category:`, components: [subRow], ephemeral: true });
    } else {
      // For all other categories (including Gmax)
      const existingClaim = existingReservations.find(r => r.category === categoryName);
      
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
      
      if (customId === 'cat_gmax') {
        await interaction.reply({ content: `You selected ${categoryName}. Use !res (Pokemon) to reserve your Gmax; after you add your pokemon I'll ask which Gigantamax Rare you want (Urshifu / Melmetal / Eternatus).`, ephemeral: true });
      } else {
        await interaction.reply({ content: `You selected ${categoryName}. Use !res (Pokemon) to reserve.`, ephemeral: true });
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
    const reservation = await storage.getReservationByUser(user.id);
    if (reservation && reservation.category === 'Regionals') {
      // Set 'standard' for Standard Regional so we can detect it (not null)
      await storage.updateReservation(reservation.id, { subCategory: sub === 'none' ? 'standard' : sub });
      // If Galarian, prompt the user immediately to pick which bird (ephemeral)
      if (sub === 'galarian') {
        const birdRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder().setCustomId('galarian_bird_articuno').setLabel('Galarian Articuno').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('galarian_bird_zapdos').setLabel('Galarian Zapdos').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('galarian_bird_moltres').setLabel('Galarian Moltres').setStyle(ButtonStyle.Primary),
          );
        await interaction.reply({ content: `Updated to Galarian Regionals. Please pick which Galarian bird you want (or you can still use !res to type it):`, components: [birdRow], ephemeral: true });
      } else if (sub === 'none') {
        // Standard Regional - also show Galarian bird options
        const birdRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder().setCustomId('galarian_bird_articuno').setLabel('Galarian Articuno').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('galarian_bird_zapdos').setLabel('Galarian Zapdos').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('galarian_bird_moltres').setLabel('Galarian Moltres').setStyle(ButtonStyle.Primary),
          );
        await interaction.reply({ content: `Updated to Standard Regional. You can pick a Galarian bird below, or use !res to add your pokemon:`, components: [birdRow], ephemeral: true });
      } else {
        // For Alolan and Hisuian, we explicitly tell user no extra reserve slot is available
        await interaction.reply({ content: `Updated sub-category to ${sub}. Note: Alolan and Hisuian subcategories do not receive a separate reserve slot. Use !res to add your pokemon.`, ephemeral: true });
      }

      // Update the main embed if we can find it (this is trickier with ephemeral replies, 
      // but usually the interaction message is the one with buttons)
      if (interaction.channel instanceof TextChannel && interaction.message) {
        await updateOrgEmbed(interaction.channel, interaction.message.id);
      }
    } else {
      await interaction.reply({ content: "No active Regional reservation found.", ephemeral: true });
    }
    return;
  }
}

async function handleSelectMenu(interaction: any) {
  if (interaction.customId !== 'admin_cancel_select') return;

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

  try {
    await storage.deleteReservation(id);
    await interaction.reply({ content: `Cancelled reservation for ${reservation.user.username} (${reservation.category}).`, ephemeral: true });

    // Attempt to update the main Org embed in this channel
    if (interaction.channel instanceof TextChannel) {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Pokemon Reservation') || m.embeds[0].title?.includes('Reservation Hub')));
      if (orgMessage) {
        await updateOrgEmbed(interaction.channel, orgMessage.id);
      }
    }
  } catch (err) {
    console.error("Failed to delete reservation via admin select:", err);
    await interaction.reply({ content: "Failed to cancel reservation. Try again later.", ephemeral: true });
  }
}

async function handleMessage(message: Message) {
  if (message.author.bot) return;

  // ------- robust Pokétwo buy detection -------
  const buyRegex = /inc buy -y/i;
  const mentionsPoketwo = message.mentions.users?.some(u => /pok[eé]two/i.test(u.username));
  if (buyRegex.test(message.content) && mentionsPoketwo) {
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
        const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Pokemon Reservation') || m.embeds[0].title.includes('Reservation Hub')));
        if (orgMessage) {
          await updateOrgEmbed(message.channel, orgMessage.id);
        }
      }
    } else {
      // Not a registered channel for any category; ignore or optionally store as Unknown
      // await storage.updateChannelCheck('Unknown', channelId, true);
    }
  }
  // ------- end buy detection -------

  // Handle !gmax quick-choice command (allows typing choice instead of button)
  if (message.content.toLowerCase().startsWith('!gmax')) {
    const args = message.content.split(' ').slice(1);
    const choiceRaw = args.join(' ').trim();
    if (!choiceRaw) {
      await message.reply("Please provide your Gigantamax Rare choice (Urshifu, Melmetal, Eternatus). Example: `!gmax Urshifu`");
      return;
    }
    const normalized = choiceRaw.toLowerCase();
    const map: Record<string, string> = {
      'urshifu': 'Urshifu',
      'melmetal': 'Melmetal',
      'eternatus': 'Eternatus',
    };
    // allow full input like "Galarian Articuno" handled elsewhere
    const matched = Object.keys(map).find(k => normalized.includes(k));
    if (!matched) {
      await message.reply("Unknown Gigantamax choice. Valid options: Urshifu, Melmetal, Eternatus.");
      return;
    }

    const user = await storage.getUserByDiscordId(message.author.id);
    if (!user) {
      await message.reply("Please start by using /startorg and selecting a category.");
      return;
    }
    const reservation = await storage.getReservationByUser(user.id);
    if (!reservation || reservation.category !== 'Gmax') {
      await message.reply("No active Gmax reservation found to set this choice.");
      return;
    }

    await storage.updateReservation(reservation.id, { additionalPokemon: map[matched] });
    await message.reply(`Set your Gigantamax Rare choice to ${map[matched]}.`);

    // update embed if present
    if (message.channel instanceof TextChannel) {
      const messages = await message.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Pokemon Reservation') || m.embeds[0].title?.includes('Reservation Hub')));
      if (orgMessage) {
        await updateOrgEmbed(message.channel, orgMessage.id);
      }
    }
    return;
  }

  // Handle !res command
  if (message.content.startsWith('!res')) {
    const args = message.content.split(' ').slice(1);
    const pokemonNameRaw = args.join(' ');
    const pokemonName = pokemonNameRaw.trim();

    if (!pokemonName) {
      await message.reply("Please specify a Pokemon name.");
      return;
    }

    const user = await storage.getUserByDiscordId(message.author.id);
    if (!user) {
      await message.reply("Please start by using /startorg and selecting a category.");
      return;
    }

    const reservation = await storage.getReservationByUser(user.id);
    if (!reservation) {
      await message.reply("No active reservation found. Use /startorg.");
      return;
    }

    // New: check if pokemon is already reserved by someone else (case-insensitive)
    try {
      const allReservations = await storage.getReservations();
      const normalized = pokemonName.toLowerCase();

      const existing = allReservations.find(r => {
        const candidates = [r.pokemon1, r.pokemon2, r.additionalPokemon].filter(Boolean) as string[];
        return candidates.some(p => p.trim().toLowerCase() === normalized);
      });

      if (existing) {
        // If the existing reservation belongs to the same user, tell them they already reserved it.
        if (existing.user && existing.user.discordId === message.author.id) {
          await message.reply("You have already reserved that Pokemon.");
          return;
        } else {
          await message.reply("This Pokemon has already been reserved this round.");
          return;
        }
      }
    } catch (err) {
      console.error("Failed to check existing reservations for duplicates:", err);
      // Continue — if check fails we still let the user try to reserve (fail-open), but log error.
    }

    let updated = false;
    if (!reservation.pokemon1) {
      await storage.updateReservation(reservation.id, { pokemon1: pokemonName });
      await message.reply(`Reserved ${pokemonName} for ${reservation.category}.`);
      updated = true;
    } else if (!reservation.pokemon2 && (reservation.category.startsWith('Reserve') || reservation.category === 'Gmax')) {
      await storage.updateReservation(reservation.id, { pokemon2: pokemonName });
      await message.reply(`Reserved second pokemon ${pokemonName} for ${reservation.category}.`);
      updated = true;
    } else if (reservation.category === 'Regionals' && reservation.subCategory === 'Galarian' && !reservation.additionalPokemon) {
      // allow Galarian bird as additionalPokemon (users can type Articuno / Zapdos / Moltres or "Galarian Articuno", etc.)
      const normalized = pokemonName.toLowerCase();
      const bird = normalized.includes('articuno') ? 'Galarian Articuno' : normalized.includes('zapdos') ? 'Galarian Zapdos' : normalized.includes('moltres') ? 'Galarian Moltres' : null;
      const valueToSave = bird ?? (pokemonName.startsWith('Galarian') ? pokemonName : `Galarian ${pokemonName}`);
      await storage.updateReservation(reservation.id, { additionalPokemon: valueToSave });
      await message.reply(`Added Galarian choice ${valueToSave}.`);
      updated = true;
    } else if (reservation.category === 'Gmax' && !reservation.additionalPokemon) {
      // Rare Gmax - allow additionalPokemon as their rare choice.
      await storage.updateReservation(reservation.id, { additionalPokemon: pokemonName });
      await message.reply(`Added Rare Gmax choice ${pokemonName}.`);
      updated = true;
    } else {
      await message.reply(`You already have reservations for this category.`);
    }

    // After adding a pokemon for Gmax, prompt them to pick a Gigantamax Rare via buttons (also instruct them about !gmax)
    if (updated && reservation && reservation.category === 'Gmax' && message.channel instanceof TextChannel) {
      const choicesRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder().setCustomId('gmax_pick_urshifu').setLabel('Urshifu').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('gmax_pick_melmetal').setLabel('Melmetal').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('gmax_pick_eternatus').setLabel('Eternatus').setStyle(ButtonStyle.Primary),
        );
      await message.reply({ content: 'Choose your Gigantamax Rare (or type `!gmax <name>`):', components: [choicesRow] });

      // update org embed as well
      const messages = await message.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Pokemon Reservation') || m.embeds[0].title?.includes('Reservation Hub')));
      if (orgMessage) {
        await updateOrgEmbed(message.channel as TextChannel, orgMessage.id);
      }
    }

    // Attempt to update the last known Org embed in this channel for non-Gmax updates
    if (updated && message.channel instanceof TextChannel) {
      // Search for the bot's embed message in the last 50 messages
      const messages = await message.channel.messages.fetch({ limit: 50 });
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Pokemon Reservation') || m.embeds[0].title?.includes('Reservation Hub')));
      if (orgMessage) {
        await updateOrgEmbed(message.channel, orgMessage.id);
      }
    }
  }
}