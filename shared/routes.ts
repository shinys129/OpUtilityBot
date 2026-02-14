import { z } from 'zod';
import { reservations, channelChecks, users } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  reservations: {
    list: {
      method: 'GET' as const,
      path: '/api/reservations',
      responses: {
        200: z.array(z.custom<typeof reservations.$inferSelect & { user: typeof users.$inferSelect }>()),
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalReservations: z.number(),
          byCategory: z.record(z.number()),
        }),
      },
    }
  },
  channelChecks: {
    list: {
      method: 'GET' as const,
      path: '/api/channel-checks',
      responses: {
        200: z.array(z.custom<typeof channelChecks.$inferSelect>()),
      },
    },
  },
  moderation: {
    auditLogs: {
      method: 'GET' as const,
      path: '/api/moderation/audit-logs',
    },
    warnings: {
      method: 'GET' as const,
      path: '/api/moderation/warnings',
    },
    bans: {
      method: 'GET' as const,
      path: '/api/moderation/bans',
    },
    mutes: {
      method: 'GET' as const,
      path: '/api/moderation/mutes',
    },
  },
  steals: {
    list: {
      method: 'GET' as const,
      path: '/api/steals',
    },
    byUser: {
      method: 'GET' as const,
      path: '/api/steals/user/:discordId',
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
