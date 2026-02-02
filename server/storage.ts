import { db } from "./db";
import {
  users, reservations, channelChecks, orgState,
  type User, type InsertUser,
  type Reservation, type InsertReservation,
  type ChannelCheck, type InsertChannelCheck,
  type OrgState, type InsertOrgState
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Reservation operations
  getReservations(): Promise<(Reservation & { user: User })[]>;
  getReservationByUser(userId: number): Promise<Reservation | undefined>; // Get latest active?
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, updates: Partial<Reservation>): Promise<Reservation>;
  deleteReservation(id: number): Promise<void>;

  // New: clear all reservations (used by /endorg)
  clearReservations(): Promise<void>;

  // Channel Check operations
  getChannelChecks(): Promise<ChannelCheck[]>;
  updateChannelCheck(category: string, channelId: string, isComplete: boolean): Promise<ChannelCheck>;

  // New: set the list of channel IDs that belong to a category
  setCategoryChannels(category: string, channelIds: string[]): Promise<void>;

  // New: clear mappings for a category
  clearCategoryChannels(category: string): Promise<void>;

  // New: clear/reset all channel checks (used by /endorg) — now resets isComplete to false instead of deleting mappings
  clearChannelChecks(): Promise<void>;

  // Org State operations
  getOrgState(): Promise<OrgState | undefined>;
  setOrgState(channelId: string, messageId: string): Promise<OrgState>;
  clearOrgState(): Promise<void>;

  // Admin Role operations
  getAdminRole(): Promise<string | undefined>;
  setAdminRole(roleId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ... existing code ...

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
    // Get the most recent one
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
    // Remove the reservation row so that the slot can be reselected.
    await db.delete(reservations).where(eq(reservations.id, id));
  }

  async clearReservations(): Promise<void> {
    // Delete all reservations directly
    await db.delete(reservations);
  }

  async getChannelChecks(): Promise<ChannelCheck[]> {
    return await db.select().from(channelChecks);
  }

  async updateChannelCheck(category: string, channelId: string, isComplete: boolean): Promise<ChannelCheck> {
    // Check if exists
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
    // Remove any existing mappings for this category, then insert the provided list with isComplete=false
    await db.delete(channelChecks).where(eq(channelChecks.category, category));

    if (channelIds.length === 0) return;

    // Bulk insert - drizzle may not support bulk insert as array in your version, so insert sequentially
    for (const cid of channelIds) {
      await db.insert(channelChecks).values({ category, channelId: cid, isComplete: false });
    }
  }

  async clearCategoryChannels(category: string): Promise<void> {
    await db.delete(channelChecks).where(eq(channelChecks.category, category));
  }

  async clearChannelChecks(): Promise<void> {
    // Instead of deleting mappings, reset their isComplete flag to false so mappings persist.
    const rows = await db.select({ id: channelChecks.id }).from(channelChecks);
    for (const c of rows) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await db.update(channelChecks).set({ isComplete: false, updatedAt: new Date() }).where(eq(channelChecks.id, c.id!));
    }
  }

  async getOrgState(): Promise<OrgState | undefined> {
    // Get the most recent org state
    const [state] = await db.select()
      .from(orgState)
      .orderBy(desc(orgState.updatedAt))
      .limit(1);
    return state;
  }

  async setOrgState(channelId: string, messageId: string): Promise<OrgState> {
    // Delete any existing state and create a new one
    await db.delete(orgState);
    const [state] = await db.insert(orgState)
      .values({ channelId, messageId })
      .returning();
    return state;
  }

  async clearOrgState(): Promise<void> {
    await db.delete(orgState);
  }
}

export const storage = new DatabaseStorage();