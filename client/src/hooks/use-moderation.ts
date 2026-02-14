import { useQuery } from "@tanstack/react-query";

export function useAuditLogs() {
  return useQuery({
    queryKey: ['/api/moderation/audit-logs'],
    refetchInterval: 30000,
  });
}

export function useWarnings() {
  return useQuery({
    queryKey: ['/api/moderation/warnings'],
    refetchInterval: 30000,
  });
}

export function useBans() {
  return useQuery({
    queryKey: ['/api/moderation/bans'],
    refetchInterval: 30000,
  });
}

export function useMutes() {
  return useQuery({
    queryKey: ['/api/moderation/mutes'],
    refetchInterval: 30000,
  });
}

export function useAllSteals() {
  return useQuery({
    queryKey: ['/api/steals'],
    refetchInterval: 30000,
  });
}

export function useUserSteals(discordId: string | null) {
  return useQuery({
    queryKey: ['/api/steals/user', discordId],
    enabled: !!discordId,
  });
}
