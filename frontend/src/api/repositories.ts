// src/api/repositories.ts
import type { AxiosResponse } from "axios";
import { apiClient } from "@/api/client";

/**
 * Thin service layer over the `/repositories` backend endpoints.
 * Returns raw Axios responses; hooks are responsible for unwrapping
 * data, caching, and error handling.
 *
 * Generic type parameters default to `unknown` as temporary
 * placeholders until shared request/response types are added under
 * `src/types`. Supplying explicit generics at the call site does not
 * change this service's public API.
 */
export const RepositoryApi = {
  getRepositories<TResponse = unknown>(): Promise<AxiosResponse<TResponse>> {
    return apiClient.get<TResponse>("/repositories");
  },

  createRepository<TPayload = unknown, TResponse = unknown>(
    payload: TPayload,
  ): Promise<AxiosResponse<TResponse>> {
    return apiClient.post<TResponse>("/repositories", payload);
  },

  getRepository<TResponse = unknown>(repositoryId: string): Promise<AxiosResponse<TResponse>> {
    return apiClient.get<TResponse>(`/repositories/${repositoryId}`);
  },

  deleteRepository<TResponse = unknown>(repositoryId: string): Promise<AxiosResponse<TResponse>> {
    return apiClient.delete<TResponse>(`/repositories/${repositoryId}`);
  },
};