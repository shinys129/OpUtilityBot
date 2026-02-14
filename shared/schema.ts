import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
});

export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  category: text("category").notNull(), // 'Rares', 'Regionals', 'Gmax', etc.
  subCategory: text("sub_category"), // 'Galarian', 'Alolan', 'Hisuian', etc.
  pokemon1: text("pokemon_1"),
  pokemon2: text("pokemon_2"),
  additionalPokemon: text("additional_pokemon"), // For Galarian birds or Gmax extras
  channelRange: text("channel_range"), // e.g., "1-23"
  createdAt: timestamp("created_at").defaultNow(),
});

export const channelChecks = pgTable("channel_checks", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  channelId: text("channel_id").notNull(), // The discord channel ID or number
  isComplete: boolean("is_complete").default(false), // If the !buy command was used
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orgState = pgTable("org_state", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(), // Discord channel ID where the org embed is
  messageId: text("message_id").notNull(), // Discord message ID of the org embed
  adminRoleId: text("admin_role_id"), // Role ID that can use admin commands
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Management Tables
export const bannedUsers = pgTable("banned_users", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  bannedBy: integer("banned_by").references(() => users.id).notNull(), // Admin who banned
  bannedAt: timestamp("banned_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // null = permanent ban
  isActive: boolean("is_active").default(true),
});

export const userWarnings = pgTable("user_warnings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  warnedBy: integer("warned_by").references(() => users.id).notNull(), // Admin who warned
  warnedAt: timestamp("warned_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  targetUserId: integer("target_user_id").references(() => users.id),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userMutes = pgTable("user_mutes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  mutedBy: integer("muted_by").references(() => users.id).notNull(),
  mutedAt: timestamp("muted_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
});

export const stealLogs = pgTable("steal_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  staffId: integer("staff_id").references(() => users.id).notNull(),
  item: text("item").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertReservationSchema = createInsertSchema(reservations).omit({ id: true, createdAt: true });
export const insertChannelCheckSchema = createInsertSchema(channelChecks).omit({ id: true, updatedAt: true });
export const insertOrgStateSchema = createInsertSchema(orgState).omit({ id: true, updatedAt: true });
export const insertBannedUserSchema = createInsertSchema(bannedUsers).omit({ id: true, bannedAt: true });
export const insertUserWarningSchema = createInsertSchema(userWarnings).omit({ id: true, warnedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertUserMuteSchema = createInsertSchema(userMutes).omit({ id: true, mutedAt: true });
export const insertStealLogSchema = createInsertSchema(stealLogs).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;

export type ChannelCheck = typeof channelChecks.$inferSelect;
export type InsertChannelCheck = z.infer<typeof insertChannelCheckSchema>;

export type OrgState = typeof orgState.$inferSelect;
export type InsertOrgState = z.infer<typeof insertOrgStateSchema>;

export type BannedUser = typeof bannedUsers.$inferSelect;
export type InsertBannedUser = z.infer<typeof insertBannedUserSchema>;

export type UserWarning = typeof userWarnings.$inferSelect;
export type InsertUserWarning = z.infer<typeof insertUserWarningSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type UserMute = typeof userMutes.$inferSelect;
export type InsertUserMute = z.infer<typeof insertUserMuteSchema>;

export type StealLog = typeof stealLogs.$inferSelect;
export type InsertStealLog = z.infer<typeof insertStealLogSchema>;

export type ReservationWithUser = Reservation & { user: User };
export type BannedUserWithUser = BannedUser & { user: User, bannedByUser: User };
export type UserWarningWithUser = UserWarning & { user: User, warnedByUser: User };
export type AuditLogWithAdmin = AuditLog & { admin: User, targetUser?: User };
export type UserMuteWithUser = UserMute & { user: User, mutedByUser: User };
export type StealLogWithUser = StealLog & { user: User, staffUser: User };
