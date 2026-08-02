// src/api/health.ts
import type { AxiosResponse } from "axios";
import { apiClient } from "@/api/client";

/**
 * Thin service layer over the `/health` backend endpoint.
 *
 * The response generic defaults to `unknown` as a temporary
 * placeholder until a shared health-status type is added under
 * `src/types`. Supplying an explicit generic at the call site does not
 * change this service's public API.
 */
export const HealthApi = {
  getHealth<TResponse = unknown>(): Promise<AxiosResponse<TResponse>> {
    return apiClient.get<TResponse>("/health");
  },
};