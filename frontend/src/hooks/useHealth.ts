// src/hooks/useHealth.ts
import { useQuery } from "@tanstack/react-query";
import { HealthApi } from "@/api/health";

/**
 * Retrieves backend health status. Polling is intentionally not
 * enabled yet; a `refetchInterval` can be added here once polling is
 * required.
 */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => HealthApi.getHealth().then((response) => response.data),
  });
}