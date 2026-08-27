// src/hooks/useQuery.ts
import { useMutation } from "@tanstack/react-query";
import { QueryApi } from "@/api/query";
import type { QueryRequest, QueryResponse } from "@/types/query";

/**
 * Executes AI repository queries. Thin wrapper around TanStack
 * Query's mutation primitive — `mutate`, `mutateAsync`, and
 * loading/error state come directly from the mutation result.
 *
 * Named `useRepositoryQuery` (rather than `useQuery`) to avoid
 * shadowing TanStack Query's own `useQuery` export at call sites.
 */
export function useRepositoryQuery() {
  return useMutation({
    mutationFn: (payload: QueryRequest): Promise<QueryResponse> =>
      QueryApi.queryRepository(payload).then((response) => response.data),
  });
}
