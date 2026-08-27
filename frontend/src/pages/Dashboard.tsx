import { useMemo, useState } from "react";
import {
  Boxes,
  Database,
  FileCode2,
  FolderGit2,
  Import,
  Layers3,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportRepositoryDialog, type ImportRepositoryFormValues } from "@/components/dashboard/ImportRepositoryDialog";
import { HealthStatus } from "@/components/dashboard/HealthStatus";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/RecentActivity";
import { RepositoryCard } from "@/components/dashboard/RepositoryCard";
import { StatsCard } from "@/components/dashboard/StatisticsCard";
import { useDeleteRepository, useImportRepository, useRepositories } from "@/hooks/useRepositories";
import { useNavigate } from "react-router-dom";
import type { RepositoryListItem } from "@/types/repository";
import type { RepositoryStatusValue } from "@/components/dashboard/RepositoryStatus";

const STATUS_MAP: Record<RepositoryListItem["status"], RepositoryStatusValue> = {
  pending: "importing",
  cloning: "cloning",
  parsing: "indexing",
  embedding: "embedding",
  indexing: "indexing",
  indexed: "ready",
  ready: "ready",
  index_failed: "error",
  failed_import: "error",
  failed: "error",
  deleting: "importing",
};

function repositoryName(repository: RepositoryListItem): string {
  const name = repository.repository_name.trim();
  if (!name.startsWith("https://github.com/")) return name;

  const path = name.replace("https://github.com/", "").replace(/\/$/, "");
  return path.endsWith(".git") ? path.slice(0, -4) : path;
}

function repositoryOwner(repository: RepositoryListItem): string {
  const name = repositoryName(repository);
  return name.includes("/") ? name.split("/")[0] : "GitHub";
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "Not indexed";

  const elapsedSeconds = Math.round((new Date(timestamp).getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, seconds] of units) {
    if (Math.abs(elapsedSeconds) >= seconds) {
      return formatter.format(Math.round(elapsedSeconds / seconds), unit);
    }
  }

  return formatter.format(elapsedSeconds, "second");
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function formatRepositorySize(repository: RepositoryListItem): string {
  return `${formatCount(repository.files_indexed)} files`;
}

function isRepositoryReady(repository: RepositoryListItem): boolean {
  return repository.status === "ready" || repository.status === "indexed";
}

function toActivity(repository: RepositoryListItem): ActivityItem {
  const activityType: ActivityItem["type"] =
    isRepositoryReady(repository) ? "index_updated" : "repository_imported";

  return {
    id: String(repository.id),
    type: activityType,
    title: repositoryName(repository),
    description: isRepositoryReady(repository) ? "Repository indexed" : `Status: ${repository.status}`,
    timestamp: formatRelativeTime(repository.last_indexed_at),
  };
}

export function Dashboard() {
  const navigate = useNavigate();
  const repositoriesQuery = useRepositories();
  const importRepository = useImportRepository();
  const deleteRepository = useDeleteRepository();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const repositories = useMemo(
    () => repositoriesQuery.data?.items ?? [],
    [repositoriesQuery.data?.items],
  );
  const totalFiles = repositories.reduce((sum, repository) => sum + repository.files_indexed, 0);
  const totalChunks = repositories.reduce(
    (sum, repository) => sum + repository.chunks_generated,
    0,
  );
  const totalEmbeddings = repositories.reduce(
    (sum, repository) => sum + repository.embeddings_generated,
    0,
  );
  const indexedRepositories = repositories.filter(isRepositoryReady).length;

  const activities = useMemo(
    () => repositories.slice(0, 5).map(toActivity),
    [repositories],
  );

  const handleImport = async ({ repositoryUrl }: ImportRepositoryFormValues) => {
    setFeedback(null);

    try {
      await importRepository.mutateAsync({ url: repositoryUrl });
      setIsImportDialogOpen(false);
      setFeedback("Repository import started successfully.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Repository import failed.");
    }
  };

  const handleDelete = async (repository: RepositoryListItem) => {
    if (!window.confirm(`Delete ${repositoryName(repository)} and all indexed data?`)) return;
    setFeedback(null);
    try {
      await deleteRepository.mutateAsync(String(repository.id));
      setFeedback("Repository deleted successfully.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Repository deletion failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-cyan-500/5 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            An overview of your repositories, activity, and platform health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void repositoriesQuery.refetch()}
            disabled={repositoriesQuery.isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={repositoriesQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsImportDialogOpen(true)} className="gap-1.5">
            <Import className="h-3.5 w-3.5" />
            Import repository
          </Button>
        </div>
      </div>
      </div>

      {feedback && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{feedback}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatsCard
          icon={FolderGit2}
          title="Repositories"
          value={repositoriesQuery.isLoading ? "—" : formatCount(repositories.length)}
          subtitle={`${formatCount(indexedRepositories)} ready`}
        />
        <StatsCard
          icon={FileCode2}
          title="Indexed files"
          value={repositoriesQuery.isLoading ? "—" : formatCount(totalFiles)}
          subtitle="Across all repositories"
        />
        <StatsCard
          icon={Layers3}
          title="Code chunks"
          value={repositoriesQuery.isLoading ? "—" : formatCount(totalChunks)}
          subtitle="Ready for retrieval"
        />
        <StatsCard
          icon={Database}
          title="Embeddings"
          value={repositoriesQuery.isLoading ? "—" : formatCount(totalEmbeddings)}
          subtitle="Stored vectors"
        />
        <StatsCard
          icon={Boxes}
          title="Active jobs"
          value={repositoriesQuery.isLoading ? "—" : formatCount(repositories.filter((repository) => !isRepositoryReady(repository) && !["failed", "index_failed", "failed_import"].includes(repository.status)).length)}
          subtitle="Currently processing"
        />
      </div>

      {repositoriesQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Unable to load repositories. Please refresh and try again.
          </CardContent>
        </Card>
      ) : repositoriesQuery.isLoading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {["repository-skeleton-1", "repository-skeleton-2", "repository-skeleton-3"].map((key) => (
            <Card key={key}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : repositories.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No repositories yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3 pt-0">
            <p className="text-sm text-muted-foreground">
              Import a GitHub repository to start building your code intelligence workspace.
            </p>
            <Button onClick={() => setIsImportDialogOpen(true)} className="gap-1.5">
              <Import className="h-4 w-4" />
              Import repository
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Repositories</h2>
            <span className="text-xs text-muted-foreground">{formatCount(repositories.length)} total</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {repositories.map((repository) => (
              <RepositoryCard
                key={repository.id}
                name={repositoryName(repository)}
                owner={repositoryOwner(repository)}
                visibility="public"
                defaultBranch={repository.default_branch}
                size={formatRepositorySize(repository)}
                lastUpdated={formatRelativeTime(repository.last_indexed_at)}
                status={STATUS_MAP[repository.status]}
                isLoading={repositoriesQuery.isLoading}
                onOpen={() => navigate(`/repositories/${repository.id}`)}
                onRefresh={() => void repositoriesQuery.refetch()}
                onDelete={() => void handleDelete(repository)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <RecentActivity activities={activities} />
        <HealthStatus />
      </div>

      <ImportRepositoryDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSubmit={handleImport}
        isLoading={importRepository.isPending}
      />
    </div>
  );
}

export default Dashboard;
