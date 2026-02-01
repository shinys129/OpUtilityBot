import { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Interaction, Message, TextChannel } from "discord.js";
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
  // In a real production app, this should be done via REST API separately
  // For this lite build, we'll assume it's handled or we can add a basic register function if needed.
  // We'll rely on the /startorg command existence.
  if (client?.application) {
     await client.application.commands.create({
       name: 'startorg',
       description: 'Start the organization process and show category buttons',
     });
  }
}

async function handleSlashCommand(interaction: any) {
  if (interaction.commandName === 'startorg') {
    const embed = new EmbedBuilder()
      .setTitle('Pokemon Reservation Organization')
      .setDescription('Select a category to begin your reservation.')
      .setColor(0x00AE86);

    // Row 1
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('cat_rares').setLabel('Rares (1-23)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cat_regionals').setLabel('Regionals (24-43)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cat_gmax').setLabel('Gmax (44-59)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cat_eevos').setLabel('Eevos (60-67)').setStyle(ButtonStyle.Primary),
      );

    // Row 2
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('cat_choice1').setLabel('Choice 1 (68-74)').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cat_choice2').setLabel('Choice 2 (75-81)').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cat_missingno').setLabel('MissingNo (82-88)').setStyle(ButtonStyle.Secondary),
      );

    // Row 3
    const row3 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('cat_res1').setLabel('Reserve 1 (89-92)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cat_res2').setLabel('Reserve 2 (93-96)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cat_res3').setLabel('Reserve 3 (97-100)').setStyle(ButtonStyle.Success),
      );

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3] });
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

  // Handle Category Selection
  if (customId.startsWith('cat_')) {
    const categoryKey = customId.replace('cat_', '').toUpperCase();
    const categoryName = CATEGORIES[categoryKey as keyof typeof CATEGORIES]?.name || categoryKey;
    const range = CATEGORIES[categoryKey as keyof typeof CATEGORIES]?.range || '';

    // Create a new reservation
    await storage.createReservation({
      userId: user.id,
      category: categoryName,
      channelRange: range,
    });

    if (customId === 'cat_regionals') {
      // Sub-category prompt
      const subRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('sub_galarian').setLabel('Galarian').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('sub_alolan').setLabel('Alolan').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('sub_hisuian').setLabel('Hisuian').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('sub_none').setLabel('Standard Regional').setStyle(ButtonStyle.Secondary),
        );
      await interaction.reply({ content: `You selected ${categoryName}. Choose a sub-category or Standard:`, components: [subRow], ephemeral: true });
    } else {
      await interaction.reply({ content: `You selected ${categoryName}. Use !res (Pokemon) to reserve.`, ephemeral: true });
    }
    return;
  }

  // Handle Sub-category
  if (customId.startsWith('sub_')) {
    const sub = customId.replace('sub_', '');
    const reservation = await storage.getReservationByUser(user.id);
    if (reservation && reservation.category === 'Regionals') {
      await storage.updateReservation(reservation.id, { subCategory: sub === 'none' ? null : sub });
      await interaction.reply({ content: `Updated sub-category to ${sub}. Use !res (Pokemon) to reserve.`, ephemeral: true });
    } else {
      await interaction.reply({ content: "No active Regional reservation found.", ephemeral: true });
    }
  }
}

async function handleMessage(message: Message) {
  if (message.author.bot) return;

  // Handle !res command
  if (message.content.startsWith('!res')) {
    const args = message.content.split(' ').slice(1);
    const pokemonName = args.join(' ');
    
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

    // Logic for updating reservation based on category rules
    // Simply updating pokemon1 or pokemon2 for now
    if (!reservation.pokemon1) {
      await storage.updateReservation(reservation.id, { pokemon1: pokemonName });
      await message.reply(`Reserved ${pokemonName} for ${reservation.category}.`);
    } else if (!reservation.pokemon2 && (reservation.category.startsWith('Reserve') || reservation.category === 'Gmax')) {
      await storage.updateReservation(reservation.id, { pokemon2: pokemonName });
      await message.reply(`Reserved second pokemon ${pokemonName} for ${reservation.category}.`);
    } else {
      // Maybe check for additional logic like Galarian birds
      if (reservation.category === 'Regionals' && reservation.subCategory === 'Galarian' && !reservation.additionalPokemon) {
         // Check if it's a bird? (Simplified logic here)
         await storage.updateReservation(reservation.id, { additionalPokemon: pokemonName });
         await message.reply(`Added Galarian choice ${pokemonName}.`);
      } else {
         await message.reply(`You already have reservations for this category.`);
      }
    }
  }

  // Handle Light/Completion Check
  // "command @Pokétwo#8236 inc buy -y"
  if (message.content.includes('@Pokétwo') && message.content.includes('inc buy -y')) {
    // Identify which category/channel this is.
    // Assuming message.channel.name or topic contains info, or we just map channel ID.
    // For now, we'll try to guess based on user's current reservation or just log it.
    // In a real app, we'd need a mapping of Channel ID -> Category/Slot.
    
    // Simplification: Mark it in general log
    const channelId = message.channel.id;
    await storage.updateChannelCheck('Unknown', channelId, true);
    // await message.react('🟢'); // Indicate seen
  }
}
