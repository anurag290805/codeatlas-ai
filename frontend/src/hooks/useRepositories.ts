// src/hooks/useRepositories.ts
import { useQuery } from "@tanstack/react-query";
import { RepositoryApi } from "@/api/repositories";

/**
 * Fetches all repositories. Thin wrapper around TanStack Query —
 * loading, error, and refetch state come directly from the query
 * result.
 */
export function useRepositories() {
  return useQuery({
    queryKey: ["repositories"],
    queryFn: () => RepositoryApi.getRepositories().then((response) => response.data),
  });
}