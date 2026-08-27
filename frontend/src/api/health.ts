// src/api/health.ts
import type { AxiosResponse } from "axios";
import { apiClient, systemClient } from "@/api/client";
import type {
  BackendHealthResponse,
  QueryHealthResponse,
  VersionResponse,
} from "@/types/health";

/**
 * System and query probes use separate clients because system routes live outside `/api`.
 */
export const HealthApi = {
  getLiveness(): Promise<AxiosResponse<BackendHealthResponse>> {
    return systemClient.get<BackendHealthResponse>("/health");
  },
  getQueryHealth(): Promise<AxiosResponse<QueryHealthResponse>> {
    return apiClient.get<QueryHealthResponse>("/query/health");
  },
  getVersion(): Promise<AxiosResponse<VersionResponse>> {
    return systemClient.get<VersionResponse>("/version");
  },
};
