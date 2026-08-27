// src/api/query.ts
import type { AxiosResponse } from "axios";
import { apiClient } from "@/api/client";
import type { QueryRequest, QueryResponse } from "@/types/query";

/**
 * Thin service layer over the `/query` backend endpoint.
 *
 */
export const QueryApi = {
  queryRepository(payload: QueryRequest): Promise<AxiosResponse<QueryResponse>> {
    return apiClient.post<QueryResponse>("/query", payload);
  },
};
