import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Loader2, Network, Server } from "lucide-react";
import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { RepositorySelector } from "@/components/common/RepositorySelector";
import { Card, CardContent } from "@/components/ui/card";
import { useRepositories } from "@/hooks/useRepositories";
import { useGraph } from "@/hooks/useGraph";
import type { RepositoryListItem } from "@/types/repository";

function repositoryLabel(repository: RepositoryListItem): string {
  return repository.repository_name
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\.git\/?$/, "");
}

export function Graph() {
  const navigate = useNavigate();
  const { repositoryId: routeRepositoryId } = useParams<{ repositoryId: string }>();
  const [selectedRepositoryId, setSelectedRepositoryId] = useState(routeRepositoryId ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const repositoriesQuery = useRepositories();
  const graphQuery = useGraph(selectedRepositoryId || undefined);
  const repositories = useMemo(() => repositoriesQuery.data?.items ?? [], [repositoriesQuery.data]);
  const selectedRepository = repositories.find(
    (repository) => String(repository.id) === selectedRepositoryId,
  );

  const handleRepositoryChange = (repositoryId: string) => {
    setSelectedRepositoryId(repositoryId);
    setSearchQuery("");
    if (repositoryId) navigate(`/graph/${repositoryId}`);
  };

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-5">
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-card to-primary/5 p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dependency Graph</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore relationships across files, symbols, and modules.
            </p>
          </div>
        </div>
        <RepositorySelector repositories={repositories} value={selectedRepositoryId} onChange={handleRepositoryChange} isLoading={repositoriesQuery.isLoading} />
      </div></div>

      {repositoriesQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories…
        </div>
      )}

      {repositoriesQuery.isError && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> Unable to load repositories.
          </CardContent>
        </Card>
      )}

      {!repositoriesQuery.isLoading && !repositoriesQuery.isError && repositories.length === 0 && (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            <Server className="h-7 w-7 text-muted-foreground" />
            <p className="font-medium">No repositories are available</p>
            <p className="text-sm text-muted-foreground">
              Import and index a repository before exploring its graph.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedRepository && (
        <section className="min-h-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                {repositoryLabel(selectedRepository)}
              </h2>
              {graphQuery.data && (
                <p className="text-xs text-muted-foreground">
                  {graphQuery.data.nodes.length} nodes · {graphQuery.data.edges.length} relationships
                </p>
              )}
            </div>
          </div>
          <DependencyGraph
            repositoryId={selectedRepositoryId}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onRefresh={() => void graphQuery.refetch()}
            isRefreshing={graphQuery.isFetching}
            className="h-[calc(100vh-15rem)] min-h-[34rem]"
          />
        </section>
      )}
    </div>
  );
}

export default Graph;
