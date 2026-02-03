import { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Interaction, Message, TextChannel, StringSelectMenuBuilder, PermissionFlagsBits, type Collection, type Snowflake } from "discord.js";
import type { Message as DiscordMessage } from "discord.js";
import { storage } from "./storage";

// Helper function to check admin permissions
async function checkAdminPermissions(interaction: any): Promise<any> {
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
    console.log("Error checking admin:", e);
  }

  if (!isAdmin) return null;

  // Get admin user from database
  const adminUser = await storage.getUserByDiscordId(interaction.user.id);
  return adminUser;
}

// Helper function to parse duration strings
function parseDuration(duration: string): Date | null {
  const match = duration.match(/^(\d+)([dwmy])$/);
  if (!match) return null;

  const [, amount, unit] = match;
  const now = new Date();
  const num = parseInt(amount);

  switch (unit) {
    case 'd': return new Date(now.getTime() + num * 24 * 60 * 60 * 1000);
    case 'w': return new Date(now.getTime() + num * 7 * 24 * 60 * 60 * 1000);
    case 'm': return new Date(now.getTime() + num * 30 * 24 * 60 * 60 * 1000);
    case 'y': return new Date(now.getTime() + num * 365 * 24 * 60 * 60 * 1000);
    default: return null;
  }
}

// User Management Command Handlers
export async function handleBanUserCommand(interaction: any) {
  // Check admin permissions
  const adminUser = await checkAdminPermissions(interaction);
  if (!adminUser) {
    await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const duration = interaction.options.getString('duration') || 'permanent';

  if (!targetUser || !reason) {
    await interaction.reply({ content: "Invalid parameters.", ephemeral: true });
    return;
  }

  // Get target user from database
  const targetDbUser = await storage.getUserByDiscordId(targetUser.id);
  if (!targetDbUser) {
    await interaction.reply({ content: "User not found in database.", ephemeral: true });
    return;
  }

  // Check if user is already banned
  const isBanned = await storage.isUserBanned(targetDbUser.id);
  if (isBanned) {
    await interaction.reply({ content: "User is already banned.", ephemeral: true });
    return;
  }

  // Calculate expiration date
  let expiresAt: Date | undefined;
  if (duration !== 'permanent') {
    expiresAt = parseDuration(duration);
    if (!expiresAt) {
      await interaction.reply({ content: "Invalid duration format. Use formats like '1d', '1w', '1m', or 'permanent'.", ephemeral: true });
      return;
    }
  }

  try {
    await storage.banUser(targetDbUser.id, reason, adminUser.id, expiresAt);
    await storage.createAuditLog(adminUser.id, 'ban', targetDbUser.id, { reason, duration, expiresAt });
    
    const expiryText = expiresAt ? ` until ${expiresAt.toLocaleDateString()}` : ' permanently';
    await interaction.reply({ 
      content: `✅ **${targetUser.username}** has been banned${expiryText}.\n**Reason:** ${reason}`, 
      ephemeral: true 
    });
  } catch (error) {
    console.error("Failed to ban user:", error);
    await interaction.reply({ content: "Failed to ban user. Please try again.", ephemeral: true });
  }
}

export async function handleUnbanUserCommand(interaction: any) {
  // Check admin permissions
  const adminUser = await checkAdminPermissions(interaction);
  if (!adminUser) {
    await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  if (!targetUser) {
    await interaction.reply({ content: "Invalid user.", ephemeral: true });
    return;
  }

  // Get target user from database
  const targetDbUser = await storage.getUserByDiscordId(targetUser.id);
  if (!targetDbUser) {
    await interaction.reply({ content: "User not found in database.", ephemeral: true });
    return;
  }

  // Check if user is banned
  const isBanned = await storage.isUserBanned(targetDbUser.id);
  if (!isBanned) {
    await interaction.reply({ content: "User is not currently banned.", ephemeral: true });
    return;
  }

  try {
    await storage.unbanUser(targetDbUser.id);
    await storage.createAuditLog(adminUser.id, 'unban', targetDbUser.id);
    
    await interaction.reply({ 
      content: `✅ **${targetUser.username}** has been unbanned.`, 
      ephemeral: true 
    });
  } catch (error) {
    console.error("Failed to unban user:", error);
    await interaction.reply({ content: "Failed to unban user. Please try again.", ephemeral: true });
  }
}

export async function handleWarnUserCommand(interaction: any) {
  // Check admin permissions
  const adminUser = await checkAdminPermissions(interaction);
  if (!adminUser) {
    await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  if (!targetUser || !reason) {
    await interaction.reply({ content: "Invalid parameters.", ephemeral: true });
    return;
  }

  // Get target user from database
  const targetDbUser = await storage.getUserByDiscordId(targetUser.id);
  if (!targetDbUser) {
    await interaction.reply({ content: "User not found in database.", ephemeral: true });
    return;
  }

  try {
    await storage.warnUser(targetDbUser.id, reason, adminUser.id);
    await storage.createAuditLog(adminUser.id, 'warn', targetDbUser.id, { reason });
    
    // Get warning count
    const warnings = await storage.getUserWarnings(targetDbUser.id);
    
    await interaction.reply({ 
      content: `⚠️ **${targetUser.username}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${warnings.length}`, 
      ephemeral: true 
    });
  } catch (error) {
    console.error("Failed to warn user:", error);
    await interaction.reply({ content: "Failed to warn user. Please try again.", ephemeral: true });
  }
}

export async function handleUserInfoCommand(interaction: any) {
  // Check admin permissions
  const adminUser = await checkAdminPermissions(interaction);
  if (!adminUser) {
    await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  if (!targetUser) {
    await interaction.reply({ content: "Invalid user.", ephemeral: true });
    return;
  }

  // Get target user from database
  const targetDbUser = await storage.getUserByDiscordId(targetUser.id);
  if (!targetDbUser) {
    await interaction.reply({ content: "User not found in database.", ephemeral: true });
    return;
  }

  try {
    // Get user information
    const isBanned = await storage.isUserBanned(targetDbUser.id);
    const warnings = await storage.getUserWarnings(targetDbUser.id);
    const reservation = await storage.getReservationByUser(targetDbUser.id);

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`👤 User Information: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor(isBanned ? 0xFF0000 : 0x0099FF)
      .addFields(
        { name: "Discord ID", value: targetUser.id, inline: true },
        { name: "Username", value: targetUser.username, inline: true },
        { name: "Status", value: isBanned ? "🔴 **BANNED**" : "🟢 **Active**", inline: true }
      )
      .setTimestamp();

    // Add reservation info
    if (reservation) {
      embed.addFields({
        name: "Current Reservation",
        value: `**Category:** ${reservation.category}\n**Pokemon:** ${[reservation.pokemon1, reservation.pokemon2, reservation.additionalPokemon].filter(Boolean).join(', ') || 'None'}`,
        inline: false
      });
    }

    // Add warnings
    if (warnings.length > 0) {
      embed.addFields({
        name: `⚠️ Warnings (${warnings.length})`,
        value: warnings.slice(0, 3).map(w => `• ${w.reason} (${w.warnedAt.toLocaleDateString()})`).join('\n') + (warnings.length > 3 ? `\n... and ${warnings.length - 3} more` : ''),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error("Failed to get user info:", error);
    await interaction.reply({ content: "Failed to retrieve user information.", ephemeral: true });
  }
}

export async function handleAuditLogCommand(interaction: any) {
  // Check admin permissions
  const adminUser = await checkAdminPermissions(interaction);
  if (!adminUser) {
    await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    return;
  }

  const limit = Math.min(interaction.options.getInteger('limit') || 20, 100);

  try {
    const logs = await storage.getAuditLogs(limit);
    
    if (logs.length === 0) {
      await interaction.reply({ content: "No audit logs found.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 Recent Admin Actions")
      .setColor(0x0099FF)
      .setDescription(`Showing ${logs.length} most recent actions`)
      .setTimestamp();

    logs.forEach((log, index) => {
      const targetName = log.targetUser ? log.targetUser.username : 'System';
      const details = log.details ? JSON.stringify(log.details) : '';
      
      embed.addFields({
        name: `${index + 1}. ${log.action.toUpperCase()} - ${log.admin.username}`,
        value: `**Target:** ${targetName}\n**When:** ${log.createdAt.toLocaleString()}\n**Details:** ${details}`,
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error("Failed to get audit logs:", error);
    await interaction.reply({ content: "Failed to retrieve audit logs.", ephemeral: true });
  }
}

// Check if user is banned (to be used in other commands)
export async function checkUserBan(discordId: string): Promise<boolean> {
  const user = await storage.getUserByDiscordId(discordId);
  if (!user) return false;
  
  return await storage.isUserBanned(user.id);
}
