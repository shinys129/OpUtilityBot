import { db } from "./db";
import {
  users, reservations, channelChecks, orgState, bannedUsers, userWarnings, auditLogs, userMutes, stealLogs,
  type User, type InsertUser,
  type Reservation, type InsertReservation,
  type ChannelCheck, type InsertChannelCheck,
  type OrgState, type InsertOrgState,
  type BannedUser, type InsertBannedUser,
  type UserWarning, type InsertUserWarning,
  type AuditLog, type InsertAuditLog,
  type UserMute, type InsertUserMute,
  type StealLog, type InsertStealLog
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

async function hydrateUsers(ids: number[]): Promise<Map<number, User>> {
  if (ids.length === 0) return new Map();
  const uniqueIds = Array.from(new Set(ids));
  const rows = await db.select().from(users).where(inArray(users.id, uniqueIds));
  const map = new Map<number, User>();
  for (const r of rows) map.set(r.id, r);
  return map;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getOrCreateUser(discordId: string, username: string): Promise<User>;

  getReservations(): Promise<(Reservation & { user: User })[]>;
  getReservationByUser(userId: number): Promise<Reservation | undefined>;
  getReservationsByUser(userId: number): Promise<Reservation[]>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, updates: Partial<Reservation>): Promise<Reservation>;
  deleteReservation(id: number): Promise<void>;
  clearReservations(): Promise<void>;

  getChannelChecks(): Promise<ChannelCheck[]>;
  updateChannelCheck(category: string, channelId: string, isComplete: boolean): Promise<ChannelCheck>;
  setCategoryChannels(category: string, channelIds: string[]): Promise<void>;
  clearCategoryChannels(category: string): Promise<void>;
  clearChannelChecks(): Promise<void>;

  getOrgState(): Promise<OrgState | undefined>;
  setOrgState(channelId: string, messageId: string): Promise<OrgState>;
  clearOrgState(): Promise<void>;

  getAdminRole(): Promise<string | undefined>;
  setAdminRole(roleId: string): Promise<void>;

  banUser(userId: number, reason: string, bannedBy: number, expiresAt?: Date): Promise<BannedUser>;
  unbanUser(userId: number): Promise<void>;
  isUserBanned(userId: number): Promise<boolean>;
  getBannedUsers(): Promise<(BannedUser & { user: User; bannedByUser: User })[]>;

  warnUser(userId: number, reason: string, warnedBy: number): Promise<UserWarning>;
  getUserWarnings(userId: number): Promise<(UserWarning & { user: User; warnedByUser: User })[]>;
  getAllWarnings(): Promise<(UserWarning & { user: User; warnedByUser: User })[]>;

  muteUser(userId: number, reason: string, mutedBy: number, expiresAt?: Date): Promise<UserMute>;
  unmuteUser(userId: number): Promise<void>;
  isUserMuted(userId: number): Promise<boolean>;
  getMutedUsers(): Promise<(UserMute & { user: User; mutedByUser: User })[]>;

  addSteal(userId: number, staffId: number, item: string, paid: boolean, notes?: string): Promise<StealLog>;
  getUserSteals(userId: number): Promise<(StealLog & { user: User; staffUser: User })[]>;
  getAllSteals(): Promise<(StealLog & { user: User; staffUser: User })[]>;

  createAuditLog(adminId: number, action: string, targetUserId?: number, details?: any): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<(AuditLog & { admin: User; targetUser?: User })[]>;
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
    const rows = await db.select().from(reservations).orderBy(desc(reservations.createdAt));
    if (rows.length === 0) return [];
    const userMap = await hydrateUsers(rows.map(r => r.userId));
    return rows.map(r => ({ ...r, user: userMap.get(r.userId)! })).filter(r => r.user);
  }

  async getReservationByUser(userId: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select()
      .from(reservations)
      .where(eq(reservations.userId, userId))
      .orderBy(desc(reservations.createdAt))
      .limit(1);
    return reservation;
  }

  async getReservationsByUser(userId: number): Promise<Reservation[]> {
    return await db.select()
      .from(reservations)
      .where(eq(reservations.userId, userId))
      .orderBy(desc(reservations.createdAt));
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
      .where(and(eq(bannedUsers.userId, userId), eq(bannedUsers.isActive, true)))
      .limit(1);
    return !!ban;
  }

  async getBannedUsers(): Promise<(BannedUser & { user: User; bannedByUser: User })[]> {
    const rows = await db.select().from(bannedUsers)
      .where(eq(bannedUsers.isActive, true))
      .orderBy(desc(bannedUsers.bannedAt));
    if (rows.length === 0) return [];
    const allIds = rows.flatMap(r => [r.userId, r.bannedBy]);
    const userMap = await hydrateUsers(allIds);
    return rows.map(r => ({
      ...r,
      user: userMap.get(r.userId)!,
      bannedByUser: userMap.get(r.bannedBy)!,
    })).filter(r => r.user && r.bannedByUser);
  }

  async warnUser(userId: number, reason: string, warnedBy: number): Promise<UserWarning> {
    const [warning] = await db.insert(userWarnings)
      .values({ userId, reason, warnedBy, isActive: true })
      .returning();
    return warning;
  }

  async getUserWarnings(userId: number): Promise<(UserWarning & { user: User; warnedByUser: User })[]> {
    const rows = await db.select().from(userWarnings)
      .where(eq(userWarnings.userId, userId))
      .orderBy(desc(userWarnings.warnedAt));
    if (rows.length === 0) return [];
    const allIds = rows.flatMap(r => [r.userId, r.warnedBy]);
    const userMap = await hydrateUsers(allIds);
    return rows.map(r => ({
      ...r,
      user: userMap.get(r.userId)!,
      warnedByUser: userMap.get(r.warnedBy)!,
    })).filter(r => r.user && r.warnedByUser);
  }

  async getAllWarnings(): Promise<(UserWarning & { user: User; warnedByUser: User })[]> {
    const rows = await db.select().from(userWarnings)
      .orderBy(desc(userWarnings.warnedAt));
    if (rows.length === 0) return [];
    const allIds = rows.flatMap(r => [r.userId, r.warnedBy]);
    const userMap = await hydrateUsers(allIds);
    return rows.map(r => ({
      ...r,
      user: userMap.get(r.userId)!,
      warnedByUser: userMap.get(r.warnedBy)!,
    })).filter(r => r.user && r.warnedByUser);
  }

  async muteUser(userId: number, reason: string, mutedBy: number, expiresAt?: Date): Promise<UserMute> {
    const [mute] = await db.insert(userMutes)
      .values({ userId, reason, mutedBy, expiresAt, isActive: true })
      .returning();
    return mute;
  }

  async unmuteUser(userId: number): Promise<void> {
    await db.update(userMutes)
      .set({ isActive: false })
      .where(and(eq(userMutes.userId, userId), eq(userMutes.isActive, true)));
  }

  async isUserMuted(userId: number): Promise<boolean> {
    const [mute] = await db.select()
      .from(userMutes)
      .where(and(eq(userMutes.userId, userId), eq(userMutes.isActive, true)))
      .limit(1);
    return !!mute;
  }

  async getMutedUsers(): Promise<(UserMute & { user: User; mutedByUser: User })[]> {
    const rows = await db.select().from(userMutes)
      .where(eq(userMutes.isActive, true))
      .orderBy(desc(userMutes.mutedAt));
    if (rows.length === 0) return [];
    const allIds = rows.flatMap(r => [r.userId, r.mutedBy]);
    const userMap = await hydrateUsers(allIds);
    return rows.map(r => ({
      ...r,
      user: userMap.get(r.userId)!,
      mutedByUser: userMap.get(r.mutedBy)!,
    })).filter(r => r.user && r.mutedByUser);
  }

  async addSteal(userId: number, staffId: number, item: string, paid: boolean, notes?: string): Promise<StealLog> {
    const [steal] = await db.insert(stealLogs)
      .values({ userId, staffId, item, paid, notes })
      .returning();
    return steal;
  }

  async getUserSteals(userId: number): Promise<(StealLog & { user: User; staffUser: User })[]> {
    const rows = await db.select().from(stealLogs)
      .where(eq(stealLogs.userId, userId))
      .orderBy(desc(stealLogs.createdAt));
    if (rows.length === 0) return [];
    const allIds = rows.flatMap(r => [r.userId, r.staffId]);
    const userMap = await hydrateUsers(allIds);
    return rows.map(r => ({
      ...r,
      user: userMap.get(r.userId)!,
      staffUser: userMap.get(r.staffId)!,
    })).filter(r => r.user && r.staffUser);
  }

  async getAllSteals(): Promise<(StealLog & { user: User; staffUser: User })[]> {
    const rows = await db.select().from(stealLogs)
      .orderBy(desc(stealLogs.createdAt));
    if (rows.length === 0) return [];
    const allIds = rows.flatMap(r => [r.userId, r.staffId]);
    const userMap = await hydrateUsers(allIds);
    return rows.map(r => ({
      ...r,
      user: userMap.get(r.userId)!,
      staffUser: userMap.get(r.staffId)!,
    })).filter(r => r.user && r.staffUser);
  }

  async createAuditLog(adminId: number, action: string, targetUserId?: number, details?: any): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs)
      .values({ adminId, action, targetUserId, details })
      .returning();
    return log;
  }

  async getAuditLogs(limit: number = 100): Promise<(AuditLog & { admin: User; targetUser?: User })[]> {
    const rows = await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    if (rows.length === 0) return [];
    const allIds = rows.flatMap(r => [r.adminId, ...(r.targetUserId ? [r.targetUserId] : [])]);
    const userMap = await hydrateUsers(allIds);
    return rows.map(r => ({
      ...r,
      admin: userMap.get(r.adminId)!,
      targetUser: r.targetUserId ? userMap.get(r.targetUserId) : undefined,
    })).filter(r => r.admin);
  }
}

export const storage = new DatabaseStorage();
