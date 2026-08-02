// src/api/query.ts
import type { AxiosResponse } from "axios";
import { apiClient } from "@/api/client";

/**
 * Thin service layer over the `/query` backend endpoint.
 *
 * Generic type parameters default to `unknown` as temporary
 * placeholders until shared request/response types are added under
 * `src/types`. Supplying explicit generics at the call site does not
 * change this service's public API.
 */
export const QueryApi = {
  queryRepository<TPayload = unknown, TResponse = unknown>(
    payload: TPayload,
  ): Promise<AxiosResponse<TResponse>> {
    return apiClient.post<TResponse>("/query", payload);
  },
};