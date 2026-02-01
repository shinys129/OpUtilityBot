import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useReservations() {
  return useQuery({
    queryKey: [api.reservations.list.path],
    queryFn: async () => {
      const res = await fetch(api.reservations.list.path);
      if (!res.ok) throw new Error("Failed to fetch reservations");
      return api.reservations.list.responses[200].parse(await res.json());
    },
    refetchInterval: 30000, // Refresh every 30s
  });
}

export function useStats() {
  return useQuery({
    queryKey: [api.reservations.stats.path],
    queryFn: async () => {
      const res = await fetch(api.reservations.stats.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.reservations.stats.responses[200].parse(await res.json());
    },
    refetchInterval: 30000,
  });
}

export function useChannelChecks() {
  return useQuery({
    queryKey: [api.channelChecks.list.path],
    queryFn: async () => {
      const res = await fetch(api.channelChecks.list.path);
      if (!res.ok) throw new Error("Failed to fetch channel checks");
      return api.channelChecks.list.responses[200].parse(await res.json());
    },
    refetchInterval: 10000, // Refresh faster for status lights
  });
}
