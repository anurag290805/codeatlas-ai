// src/hooks/useRepositories.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RepositoryApi } from "@/api/repositories";
import type { RepositoryCreateRequest } from "@/types/repository";

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

/** Creates an import job and refreshes the dashboard repository cache. */
export function useImportRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RepositoryCreateRequest) =>
      RepositoryApi.createRepository(payload).then((response) => response.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

/** Deletes a repository and refreshes the repository list cache. */
export function useDeleteRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repositoryId: string) =>
      RepositoryApi.deleteRepository(repositoryId),
    onSuccess: async (_response, repositoryId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["repositories"] }),
        queryClient.removeQueries({ queryKey: ["repository", repositoryId] }),
        queryClient.removeQueries({ queryKey: ["repository-files", repositoryId] }),
      ]);
    },
  });
}
