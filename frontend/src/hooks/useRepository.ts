// src/hooks/useRepository.ts
import { useQuery } from "@tanstack/react-query";
import { RepositoryApi } from "@/api/repositories";

/**
 * Fetches a single repository by id. Automatically disabled when no
 * `repositoryId` is provided.
 */
export function useRepository(repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["repository", repositoryId],
    queryFn: () =>
      RepositoryApi.getRepository(repositoryId as string).then((response) => response.data),
    enabled: Boolean(repositoryId),
  });
}