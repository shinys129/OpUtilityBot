import { db } from "./db";
import {
  users, reservations, channelChecks, orgState, bannedUsers, userWarnings, auditLogs,
  type User, type InsertUser,
  type Reservation, type InsertReservation,
  type ChannelCheck, type InsertChannelCheck,
  type OrgState, type InsertOrgState,
  type BannedUser, type InsertBannedUser,
  type UserWarning, type InsertUserWarning,
  type AuditLog, type InsertAuditLog
} from "@shared/schema";
import { eq, and, desc, isNotNull, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Reservation operations
  getReservations(): Promise<(Reservation & { user: User })[]>;
  getReservationByUser(userId: number): Promise<Reservation | undefined>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, updates: Partial<Reservation>): Promise<Reservation>;
  deleteReservation(id: number): Promise<void>;
  clearReservations(): Promise<void>;

  // Channel Check operations
  getChannelChecks(): Promise<ChannelCheck[]>;
  updateChannelCheck(category: string, channelId: string, isComplete: boolean): Promise<ChannelCheck>;
  setCategoryChannels(category: string, channelIds: string[]): Promise<void>;
  clearCategoryChannels(category: string): Promise<void>;
  clearChannelChecks(): Promise<void>;

  // Org State operations
  getOrgState(): Promise<OrgState | undefined>;
  setOrgState(channelId: string, messageId: string): Promise<OrgState>;
  clearOrgState(): Promise<void>;

  // Admin Role operations
  getAdminRole(): Promise<string | undefined>;
  setAdminRole(roleId: string): Promise<void>;

  // User Management operations (simplified for production)
  banUser(userId: number, reason: string, bannedBy: number, expiresAt?: Date): Promise<BannedUser>;
  unbanUser(userId: number): Promise<void>;
  isUserBanned(userId: number): Promise<boolean>;
  getBannedUsers(): Promise<BannedUser[]>;
  warnUser(userId: number, reason: string, warnedBy: number): Promise<UserWarning>;
  getUserWarnings(userId: number): Promise<UserWarning[]>;
  createAuditLog(adminId: number, action: string, targetUserId?: number, details?: any): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getAdminRole(): Promise<string | undefined> {
    const [state] = await db.select().from(orgState).limit(1);
    return state?.adminRoleId ?? undefined;
  }

  async setAdminRole(roleId: string): Promise<void> {
    const [existing] = await db.select().from(orgState).limit(1);
    if (existing) {
      await db.update(orgState).set({ adminRoleId: roleId }).where(eq(orgState.id, existing.id));
    } else {
      await db.insert(orgState).values({ channelId: 'temp', messageId: 'temp', adminRoleId: roleId });
    }
  }

  async getOrCreateUser(discordId: string, username: string): Promise<User> {
    const existing = await this.getUserByDiscordId(discordId);
    if (existing) return existing;
    return await this.createUser({ discordId, username });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByDiscordId(discordId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.discordId, discordId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getReservations(): Promise<(Reservation & { user: User })[]> {
    return await db.select({
      id: reservations.id,
      userId: reservations.userId,
      category: reservations.category,
      subCategory: reservations.subCategory,
      pokemon1: reservations.pokemon1,
      pokemon2: reservations.pokemon2,
      additionalPokemon: reservations.additionalPokemon,
      channelRange: reservations.channelRange,
      createdAt: reservations.createdAt,
      user: users
    })
    .from(reservations)
    .innerJoin(users, eq(reservations.userId, users.id))
    .orderBy(desc(reservations.createdAt));
  }

  async getReservationByUser(userId: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select()
      .from(reservations)
      .where(eq(reservations.userId, userId))
      .orderBy(desc(reservations.createdAt))
      .limit(1);
    return reservation;
  }

  async createReservation(insertReservation: InsertReservation): Promise<Reservation> {
    const [reservation] = await db.insert(reservations).values(insertReservation).returning();
    return reservation;
  }

  async updateReservation(id: number, updates: Partial<Reservation>): Promise<Reservation> {
    const [reservation] = await db.update(reservations)
      .set(updates)
      .where(eq(reservations.id, id))
      .returning();
    return reservation;
  }

  async deleteReservation(id: number): Promise<void> {
    await db.delete(reservations).where(eq(reservations.id, id));
  }

  async clearReservations(): Promise<void> {
    await db.delete(reservations);
  }

  async getChannelChecks(): Promise<ChannelCheck[]> {
    return await db.select().from(channelChecks);
  }

  async updateChannelCheck(category: string, channelId: string, isComplete: boolean): Promise<ChannelCheck> {
    const [existing] = await db.select()
      .from(channelChecks)
      .where(and(eq(channelChecks.category, category), eq(channelChecks.channelId, channelId)));

    if (existing) {
      const [updated] = await db.update(channelChecks)
        .set({ isComplete, updatedAt: new Date() })
        .where(eq(channelChecks.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(channelChecks)
        .values({ category, channelId, isComplete })
        .returning();
      return created;
    }
  }

  async setCategoryChannels(category: string, channelIds: string[]): Promise<void> {
    await db.delete(channelChecks).where(eq(channelChecks.category, category));
    if (channelIds.length === 0) return;
    for (const cid of channelIds) {
      await db.insert(channelChecks).values({ category, channelId: cid, isComplete: false });
    }
  }

  async clearCategoryChannels(category: string): Promise<void> {
    await db.delete(channelChecks).where(eq(channelChecks.category, category));
  }

  async clearChannelChecks(): Promise<void> {
    const rows = await db.select({ id: channelChecks.id }).from(channelChecks);
    for (const c of rows) {
      await db.update(channelChecks).set({ isComplete: false, updatedAt: new Date() }).where(eq(channelChecks.id, c.id!));
    }
  }

  async getOrgState(): Promise<OrgState | undefined> {
    const [state] = await db.select()
      .from(orgState)
      .orderBy(desc(orgState.updatedAt))
      .limit(1);
    return state;
  }

  async setOrgState(channelId: string, messageId: string): Promise<OrgState> {
    await db.delete(orgState);
    const [state] = await db.insert(orgState)
      .values({ channelId, messageId })
      .returning();
    return state;
  }

  async clearOrgState(): Promise<void> {
    await db.delete(orgState);
  }

  // Simplified User Management for Production
  async banUser(userId: number, reason: string, bannedBy: number, expiresAt?: Date): Promise<BannedUser> {
    const [ban] = await db.insert(bannedUsers)
      .values({ userId, reason, bannedBy, expiresAt, isActive: true })
      .returning();
    return ban;
  }

  async unbanUser(userId: number): Promise<void> {
    await db.update(bannedUsers)
      .set({ isActive: false })
      .where(and(eq(bannedUsers.userId, userId), eq(bannedUsers.isActive, true)));
  }

  async isUserBanned(userId: number): Promise<boolean> {
    const [ban] = await db.select()
      .from(bannedUsers)
      .where(and(
        eq(bannedUsers.userId, userId),
        eq(bannedUsers.isActive, true),
        // Simplified date check
        sql`(${bannedUsers.expiresAt} IS NULL OR ${bannedUsers.expiresAt} > NOW())`
      ))
      .limit(1);
    return !!ban;
  }

  async getBannedUsers(): Promise<BannedUser[]> {
    return await db.select()
      .from(bannedUsers)
      .where(eq(bannedUsers.isActive, true))
      .orderBy(desc(bannedUsers.bannedAt));
  }

  async warnUser(userId: number, reason: string, warnedBy: number): Promise<UserWarning> {
    const [warning] = await db.insert(userWarnings)
      .values({ userId, reason, warnedBy, isActive: true })
      .returning();
    return warning;
  }

  async getUserWarnings(userId: number): Promise<UserWarning[]> {
    return await db.select()
      .from(userWarnings)
      .where(and(eq(userWarnings.userId, userId), eq(userWarnings.isActive, true)))
      .orderBy(desc(userWarnings.warnedAt));
  }

  async createAuditLog(adminId: number, action: string, targetUserId?: number, details?: any): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs)
      .values({ adminId, action, targetUserId, details })
      .returning();
    return log;
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    return await db.select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
