import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { startBot } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.reservations.list.path, async (req, res) => {
    const reservations = await storage.getReservations();
    res.json(reservations);
  });

  app.get(api.channelChecks.list.path, async (req, res) => {
    const checks = await storage.getChannelChecks();
    res.json(checks);
  });

  app.get(api.reservations.stats.path, async (req, res) => {
    const reservations = await storage.getReservations();
    const stats = {
      totalReservations: reservations.length,
      byCategory: reservations.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
    res.json(stats);
  });

  app.get(api.moderation.auditLogs.path, async (req, res) => {
    const logs = await storage.getAuditLogs(200);
    res.json(logs);
  });

  app.get(api.moderation.warnings.path, async (req, res) => {
    const warnings = await storage.getAllWarnings();
    res.json(warnings);
  });

  app.get(api.moderation.bans.path, async (req, res) => {
    const bans = await storage.getBannedUsers();
    res.json(bans);
  });

  app.get(api.moderation.mutes.path, async (req, res) => {
    const mutes = await storage.getMutedUsers();
    res.json(mutes);
  });

  app.get(api.steals.list.path, async (req, res) => {
    const steals = await storage.getAllSteals();
    res.json(steals);
  });

  app.get('/api/steals/user/:discordId', async (req, res) => {
    const user = await storage.getUserByDiscordId(req.params.discordId);
    if (!user) {
      res.json({ user: null, steals: [], totalSteals: 0 });
      return;
    }
    const steals = await storage.getUserSteals(user.id);
    res.json({ user, steals, totalSteals: steals.length });
  });

  startBot().catch(err => console.error("Failed to start bot:", err));

  return httpServer;
}
