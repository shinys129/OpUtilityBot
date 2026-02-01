import { db } from "./db";
import {
  users, reservations, channelChecks,
  type User, type InsertUser,
  type Reservation, type InsertReservation,
  type ChannelCheck, type InsertChannelCheck
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

  // Channel Check operations
  getChannelChecks(): Promise<ChannelCheck[]>;
  updateChannelCheck(category: string, channelId: string, isComplete: boolean): Promise<ChannelCheck>;
}

export class DatabaseStorage implements IStorage {
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
}

export const storage = new DatabaseStorage();
