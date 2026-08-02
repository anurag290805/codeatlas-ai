// src/api/graph.ts
import type { AxiosResponse } from "axios";
import { apiClient } from "@/api/client";

/**
 * Thin service layer over the `/graph/{repositoryId}` backend endpoint.
 *
 * The response generic defaults to `unknown` as a temporary
 * placeholder until a shared dependency-graph type is added under
 * `src/types`. Supplying an explicit generic at the call site does not
 * change this service's public API.
 */
export const GraphApi = {
  getDependencyGraph<TResponse = unknown>(repositoryId: string): Promise<AxiosResponse<TResponse>> {
    return apiClient.get<TResponse>(`/graph/${repositoryId}`);
  },
};