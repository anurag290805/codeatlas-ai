// src/hooks/useHealth.ts
import { useQuery } from "@tanstack/react-query";
import { HealthApi } from "@/api/health";
import type { BackendHealthResponse } from "@/types/health";

/** Retrieves the lightweight FastAPI liveness probe from GET /health. */
export function useHealth() {
  return useQuery<BackendHealthResponse>({
    queryKey: ["health", "liveness"],
    queryFn: () => HealthApi.getLiveness().then((response) => response.data),
  });
}

export function useQueryHealth() {
  return useQuery({
    queryKey: ["health", "query"],
    queryFn: () => HealthApi.getQueryHealth().then((response) => response.data),
    retry: false,
  });
}

export function useVersion() {
  return useQuery({
    queryKey: ["health", "version"],
    queryFn: () => HealthApi.getVersion().then((response) => response.data),
  });
}
