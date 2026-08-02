// src/hooks/useGraph.ts
import { useQuery } from "@tanstack/react-query";
import { GraphApi } from "@/api/graph";

/**
 * Retrieves the dependency graph for a repository. Automatically
 * disabled when no `repositoryId` is provided.
 */
export function useGraph(repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["graph", repositoryId],
    queryFn: () =>
      GraphApi.getDependencyGraph(repositoryId as string).then((response) => response.data),
    enabled: Boolean(repositoryId),
  });
}