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
  BOOSTER: { name: 'Server Booster Reserves', range: 'N/A' },
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
      // Server Booster allows 2 people with 1 Pokemon each
      const categoryReservations = reservations.filter(r => r.category === 'Server Booster Reserves');
      return categoryReservations.length >= 2;
    }
    return owners.length >= 1;
  };

  const getLabel = (catKey: string, baseName: string, range: string) => {
    const owners = claimedCategories.get(catKey.toLowerCase()) || [];

    if (catKey.toLowerCase() === 'booster') {
      const categoryReservations = reservations.filter(r => r.category === 'Server Booster Reserves');
      // If 2 people have claimed (split taken)
      if (categoryReservations.length >= 2) {
        return `${baseName} - SPLIT TAKEN`;
      }
      // If 1 person has claimed (split available)
      if (categoryReservations.length === 1) {
        return `${baseName} - SPLIT`;
      }
      return baseName;
    }

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
    return `${baseName} (${range}) - ${owners[0]}`;
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
    );

  const adminRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder().setCustomId('admin_manage').setLabel('🔧 Manage Reservations').setStyle(ButtonStyle.Danger),
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
  const totalCategories = Object.keys(CATEGORIES).filter(k => k !== 'BOOSTER').length;
  const filledCategories = new Set(reservations.filter(r => r.category !== 'Server Booster Reserves').map(r => r.category)).size;

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

    const reservations = await storage.getReservations();
    const checks = await storage.getChannelChecks();
    
    const totalReservations = reservations.length;
    const totalCategories = Object.keys(CATEGORIES).filter(k => k !== 'BOOSTER').length;
    const filledCategories = new Set(reservations.filter(r => r.category !== 'Server Booster Reserves').map(r => r.category)).size;

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
    const message = await interaction.reply({ embeds: [embed], components: buttons, fetchReply: true });

    // Send role message if all categories filled
    if (filledCategories === totalCategories) {
      await interaction.channel.send(`Thank you <@&1468236218331562024> all slots have been filled and you can start buying your channels!`);
    }

    if (interaction.channel instanceof TextChannel) {
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
      const totalCategories = Object.keys(CATEGORIES).filter(k => k !== 'BOOSTER').length;
      const filledCategories = new Set(reservations.filter(r => r.category !== 'Server Booster Reserves').map(r => r.category)).size;

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
        const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Operation Incense') || m.embeds[0].title.includes('Buyers Org')));
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
    console.log("[endorg] Command received");
    
    // Authorization: either ManageGuild permission or role id set in database
    let isAdmin = false;
    const adminRoleId = await storage.getAdminRole();

    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        isAdmin = true;
      } else if (member && adminRoleId && member.roles && member.roles.cache && member.roles.cache.has(adminRoleId)) {
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

  // /lock - Revoke SEND_MESSAGES permission from @everyone role (exempt role can still send)
  if (interaction.commandName === 'lock') {
    const EXEMPT_ROLE_ID = '1402994392608018553';
    
    // Check if user has ManageChannels permission or has the exempt role
    let hasPermission = false;
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        hasPermission = true;
      }
      // Also allow exempt role to use the command
      if (member && member.roles && member.roles.cache && member.roles.cache.has(EXEMPT_ROLE_ID)) {
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
      const exemptRole = interaction.guild.roles.cache.get(EXEMPT_ROLE_ID);
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
    const EXEMPT_ROLE_ID = '1402994392608018553';
    
    // Check if user has ManageChannels permission or has the exempt role
    let hasPermission = false;
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        hasPermission = true;
      }
      // Also allow exempt role to use the command
      if (member && member.roles && member.roles.cache && member.roles.cache.has(EXEMPT_ROLE_ID)) {
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
      const exemptRole = interaction.guild.roles.cache.get(EXEMPT_ROLE_ID);
      if (exemptRole) {
        const existingOverwrite = interaction.channel.permissionOverwrites.cache.get(EXEMPT_ROLE_ID);
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
    const EXEMPT_ROLE_ID = '1402994392608018553';
    
    // Check if user has ManageChannels permission or has the exempt role
    let hasPermission = false;
    try {
      const member = interaction.member;
      if (member && member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        hasPermission = true;
      }
      // Also allow exempt role to use the command
      if (member && member.roles && member.roles.cache && member.roles.cache.has(EXEMPT_ROLE_ID)) {
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
      const exemptRole = interaction.guild.roles.cache.get(EXEMPT_ROLE_ID);
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
    await interaction.reply({ content: `Set your Galarian bird choice to ${choice}.`, ephemeral: true });

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
    // Authorization: either ManageGuild permission or role id set in database
    let isAdmin = false;
    const adminRoleId = await storage.getAdminRole();

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
      const hasStandardRegional = regionalReservations.some(r => r.subCategory === 'standard' || r.subCategory === 'none');
      
      // Block if someone has Standard Regional
      if (hasStandardRegional) {
        const standardHolder = regionalReservations.find(r => r.subCategory === 'standard' || r.subCategory === 'none');
        if (standardHolder?.user.discordId === userId) {
          await interaction.reply({ content: `You already have a Standard Regional reservation. Use /cancelres to release it first.`, ephemeral: true });
        } else {
          await interaction.reply({ content: `Regionals is fully claimed by ${standardHolder?.user.username} (Standard Regional). They must use /cancelres first.`, ephemeral: true });
        }
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
      
      // Check if user already has a pending Regional reservation (no subCategory yet)
      const userPendingRegional = regionalReservations.find(r => r.user.discordId === userId && !r.subCategory);
      
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
      if (confirmedRegionals.length === 0) {
        buttons.push(new ButtonBuilder().setCustomId('sub_none').setLabel('Standard Regional').setStyle(ButtonStyle.Secondary));
      }
      
      // If no buttons available, all are taken
      if (buttons.length === 0) {
        await interaction.reply({ content: `All Regional subcategories are taken. Someone must use /cancelres first.`, ephemeral: true });
        return;
      }
      
      // Only create a new reservation if user doesn't have a pending one
      if (!userPendingRegional) {
        await storage.createReservation({
          userId: user.id,
          category: categoryName,
          channelRange: range,
        });
      }
      
      const subRow = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
      await interaction.reply({ content: `You selected ${categoryName}. Choose a sub-category:`, components: [subRow], ephemeral: true });
    } else {
      // For all other categories (including Gmax and Reserves)
      const categoryReservations = existingReservations.filter(r => r.category === categoryName);
      
      // Special logic for Server Booster Reserves: require booster role, allow 2 people with 1 Pokemon each
      if (categoryName === 'Server Booster Reserves') {
        const BOOSTER_ROLE_ID = '1405333965933383772';
        const member = await interaction.guild?.members.fetch(userId);
        if (!member?.roles.cache.has(BOOSTER_ROLE_ID)) {
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
        
        // Create reservation (1 Pokemon allowed per person)
        await storage.createReservation({
          userId: user.id,
          category: categoryName,
          channelRange: range,
        });
        
        if (categoryReservations.length === 0) {
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

          // Someone else can claim the split
          await storage.createReservation({
            userId: user.id,
            category: categoryName,
            channelRange: range,
          });
          await interaction.reply({ content: `You claimed the split for ${categoryName}. **Use !res (Pokemon) to reserve**.`, ephemeral: true });
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
          content: `You selected ${categoryName}. Choose your Gigantamax Rare, then **use !res (Pokemon) to reserve your Gmax**:`, 
          components: [gmaxRow], 
          ephemeral: true 
        });
      } else if (customId === 'cat_missingno') {
        await interaction.reply({ content: `You selected ${categoryName}. **Use !res (Pokemon Pokemon) to reserve your 2 Pokemon**.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `You selected ${categoryName}. **Use !res (Pokemon) to reserve**.`, ephemeral: true });
      }
    }

    // Update the main embed
    if (interaction.channel instanceof TextChannel && interaction.message) {
      await updateOrgEmbed(interaction.channel, interaction.message.id);
      
      // Check if all non-booster categories are filled and send announcement
      const allReservations = await storage.getReservations();
      const totalCategories = Object.keys(CATEGORIES).filter(k => k !== 'BOOSTER').length;
      const filledCategories = new Set(allReservations.filter(r => r.category !== 'Server Booster Reserves').map(r => r.category)).size;
      
      if (filledCategories === totalCategories) {
        await interaction.channel.send(`Thank you <@&1468236218331562024> all slots have been filled and you can start buying your channels!`);
      }
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
        await interaction.reply({ content: `Updated to Standard Regional. You can pick a Galarian bird below, or **use !res to add your pokemon**:`, components: [birdRow], ephemeral: true });
      } else {
        // For Alolan and Hisuian, we explicitly tell user no extra reserve slot is available
        await interaction.reply({ content: `Updated sub-category to ${sub}. Note: Alolan and Hisuian subcategories do not receive a separate reserve slot.`, ephemeral: true });
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
      const orgMessage = messages.find((m: DiscordMessage) => m.author.id === client?.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('Operation Incense') || m.embeds[0].title?.includes('Buyers Org')));
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

    // If user has multiple reservations (e.g. splits or multiple regionals), we need to decide which one to update
    // For now, we'll pick the one that doesn't have pokemon1 set, or the most recent one.
    let reservation = userReservations.find(r => !r.pokemon1);
    if (!reservation) reservation = userReservations[0];

    // Parse Pokemon names - split by spaces, but allow for multi-word Pokemon names
    const pokemonArray = pokemonNames.split(' ').filter(p => p.length > 0);

    // For Reserve categories, allow 1 or 2 Pokemon
    const isReserveCategory = reservation.category.startsWith('Reserve');
    const maxPokemon = isReserveCategory ? 2 : 1;

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
      await message.reply(`Reserved ${pokemonName} for ${reservation.category}.${isReserveCategory ? ' You can add one more Pokemon with !res <pokemon>.' : ''}`);
      updated = true;
    } else if (!reservation.pokemon2 && isReserveCategory) {
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
  // Handle double Pokemon reservation (only for Reserve categories)
  else if (pokemonArray.length === 2 && isReserveCategory) {
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