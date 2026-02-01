import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { startBot } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // API Routes for Dashboard
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

  // Start the Discord Bot
  startBot().catch(err => console.error("Failed to start bot:", err));

  return httpServer;
}
