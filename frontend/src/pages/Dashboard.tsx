import { useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  FileCode2,
  Import,
  LayoutDashboard,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionHeader } from "@/components/common/SectionHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ImportRepositoryDialog, type ImportRepositoryFormValues } from "@/components/dashboard/ImportRepositoryDialog";
import { HealthStatus } from "@/components/dashboard/HealthStatus";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/RecentActivity";
import { RepositoryCard } from "@/components/dashboard/RepositoryCard";
import { StatsCard } from "@/components/dashboard/StatisticsCard";
import { WorkspaceReadiness, type ReadinessSegment } from "@/components/dashboard/WorkspaceReadiness";
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
  discovering_files: "indexing",
  chunking: "indexing",
  storing: "embedding",
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

function isRepositoryFailed(repository: RepositoryListItem): boolean {
  return ["failed", "index_failed", "failed_import"].includes(repository.status);
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
  const failedRepositories = repositories.filter(isRepositoryFailed).length;
  const processingRepositories = repositories.length - indexedRepositories - failedRepositories;

  const activities = useMemo(
    () => repositories.slice(0, 5).map(toActivity),
    [repositories],
  );

  const readinessSegments: ReadinessSegment[] = useMemo(
    () => [
      { label: "Ready", count: indexedRepositories, color: "bg-success", icon: CheckCircle2 },
      { label: "Processing", count: processingRepositories, color: "bg-warning", icon: Loader2 },
      { label: "Failed", count: failedRepositories, color: "bg-danger", icon: CircleAlert },
    ],
    [indexedRepositories, processingRepositories, failedRepositories],
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

  const isLoading = repositoriesQuery.isLoading;
  const hasError = repositoriesQuery.isError && repositories.length === 0;
  const isEmpty = !isLoading && !hasError && repositories.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="An overview of your repositories, activity, and platform health."
        actions={
          <>
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
          </>
        }
      />

      {feedback && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{feedback}</CardContent>
        </Card>
      )}

      {hasError ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState
              title="Unable to load repositories"
              description="Refresh and try again."
              action={
                <Button variant="outline" size="sm" onClick={() => void repositoriesQuery.refetch()} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          {isLoading ? (
            <Card>
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : (
            <WorkspaceReadiness total={repositories.length} segments={readinessSegments} />
          )}
          <RecentActivity
            activities={isLoading ? [] : activities}
            className={isLoading ? "opacity-0" : undefined}
          />
        </div>
      )}

      <section aria-label="Indexed data" className="space-y-3">
        <SectionHeader
          title="Indexed data"
          description="Aggregate source files, retrieved chunks, and stored vectors."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatsCard
            icon={FileCode2}
            title="Indexed files"
            value={isLoading ? "—" : formatCount(totalFiles)}
            subtitle="Across all repositories"
            tone="info"
          />
          <StatsCard
            icon={Boxes}
            title="Code chunks"
            value={isLoading ? "—" : formatCount(totalChunks)}
            subtitle="Ready for retrieval"
            tone="primary"
          />
          <StatsCard
            icon={Database}
            title="Embeddings"
            value={isLoading ? "—" : formatCount(totalEmbeddings)}
            subtitle="Stored vectors"
            tone="success"
          />
        </div>
      </section>

      <section aria-label="Repositories" className="space-y-3">
        <SectionHeader
          title="Repositories"
          description="Open, refresh, or delete an imported repository."
          action={
            !isEmpty && (
              <span className="text-xs text-muted-foreground">{formatCount(repositories.length)} total</span>
            )
          }
        />
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={LayoutDashboard}
            title="No repositories yet"
            description="Import a GitHub repository to start building your code intelligence workspace."
            action={
              <Button onClick={() => setIsImportDialogOpen(true)} className="gap-1.5">
                <Import className="h-4 w-4" />
                Import repository
              </Button>
            }
          />
        ) : (
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
                isLoading={false}
                onOpen={() => navigate(`/repositories/${repository.id}`)}
                onRefresh={() => void repositoriesQuery.refetch()}
                onDelete={() => void handleDelete(repository)}
              />
            ))}
          </div>
        )}
      </section>

      <HealthStatus />

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