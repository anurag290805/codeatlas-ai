import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, GitBranch, Loader2, RefreshCw, ShieldCheck, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FileExplorer } from "@/components/repository/FileExplorer";
import { RepositoryHeader } from "@/components/repository/RepositoryHeader";
import { RepositoryOverview } from "@/components/repository/RepositoryOverview";
import { RepositoryStats } from "@/components/repository/RepositoryStats";
import { useRepository, useRepositoryFile, useRepositoryFileTree } from "@/hooks/useRepository";
import { useReindexRepository } from "@/hooks/useRepositories";
import type {
  Repository,
  RepositoryDetailResponse,
  RepositoryProcessingStatus,
} from "@/types/repository";
import { useGithubIntelligence } from "@/hooks/useIntelligence";

function repositoryName(data: RepositoryDetailResponse): string {
  const value = data.repository_name.trim();
  if (!value.startsWith("https://github.com/")) return value;
  return value.replace("https://github.com/", "").replace(/\.git\/?$/, "").replace(/\/$/, "");
}

function repositoryOwner(data: RepositoryDetailResponse): string {
  if (data.owner?.trim()) return data.owner;
  return repositoryName(data).split("/")[0] ?? "GitHub";
}

function processingStatus(status: RepositoryDetailResponse["status"]): RepositoryProcessingStatus {
  // Backend uses: ready, indexing, index_failed, failed_import, pending
  // Frontend uses: ready, pending, cloning, parsing, embedding, failed
  switch (status) {
    case "ready":
    case "indexed":
      return "ready";
    case "indexing":
    case "cloning":
    case "parsing":
    case "embedding":
      return "pending";
    case "discovering_files":
    case "chunking":
    case "storing":
      return "pending";
    case "index_failed":
    case "failed_import":
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function stageStatus(stage: RepositoryDetailResponse["stage"]): RepositoryProcessingStatus {
  if (stage === "cloning" || stage === "embedding" || stage === "chunking" || stage === "discovering" || stage === "storing") return stage === "discovering" ? "discovering_files" : stage;
  return "pending";
}

function toRepository(data: RepositoryDetailResponse): Repository {
  const branches = data.branches ?? [];
  const statistics = data.statistics ?? {
    fileCount: data.files_indexed,
    directoryCount: data.directory_count ?? null,
    commitCount: data.commit_count ?? null,
    contributorCount: data.contributor_count ?? null,
    languageCount: data.language_count ?? null,
    branchCount: data.branch_count ?? (branches.length > 0 ? branches.length : null),
    chunkCount: data.chunks_generated,
    embeddingCount: data.embeddings_generated,
  };

  return {
    id: String(data.id),
    name: repositoryName(data),
    fullName: repositoryName(data),
    description: data.description ?? undefined,
    owner: repositoryOwner(data),
    url: data.url,
    htmlUrl: data.url,
    isPrivate: data.visibility === "private",
    defaultBranch: data.default_branch,
    branches,
    status: data.stage && data.status !== "ready" && data.status !== "indexed" && data.status !== "failed" && data.status !== "index_failed" && data.status !== "failed_import"
      ? stageStatus(data.stage)
      : processingStatus(data.status),
    stage: data.stage,
    progress_percent: data.progress_percent,
    processed_files: data.processed_files,
    processed_chunks: data.processed_chunks,
    processed_embeddings: data.processed_embeddings,
    estimated_seconds_remaining: data.estimated_seconds_remaining,
    primaryLanguage: data.primary_language ?? undefined,
    sizeBytes: data.metrics?.sizeBytes ?? 0,
    statistics,
    metrics: data.metrics,
    createdAt: data.created_at ?? undefined,
    updatedAt: data.last_indexed_at ?? data.created_at ?? "",
    lastIndexedAt: data.last_indexed_at ?? undefined,
  };
}

export function Repository() {
  const { repositoryId } = useParams<{ repositoryId: string }>();
  const [searchParams] = useSearchParams();
  const repositoryQuery = useRepository(repositoryId);
  const treeQuery = useRepositoryFileTree(repositoryId);
  const [selection, setSelection] = useState<{ repositoryId: string; path?: string }>({
    repositoryId: repositoryId ?? "",
    path: searchParams.get("file") ?? undefined,
  });
  const selectedPath = selection.repositoryId === repositoryId ? selection.path : undefined;
  const fileQuery = useRepositoryFile(repositoryId, selectedPath);
  const githubQuery = useGithubIntelligence(repositoryId);
  const reindexRepository = useReindexRepository();

  const repository = useMemo(
    () => (repositoryQuery.data ? toRepository(repositoryQuery.data) : undefined),
    [repositoryQuery.data],
  );
  const fileTree = treeQuery.data ?? repositoryQuery.data?.files ?? [];

  if (repositoryQuery.isLoading) {
    return (
      <div className="flex min-h-[32rem] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading repository workspace…
      </div>
    );
  }

  if (repositoryQuery.isError || !repository) {
    return (
      <Card>
        <CardContent className="flex min-h-[20rem] flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-medium">Unable to load this repository</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The repository may not exist or is unavailable right now.
            </p>
          </div>
          <Button variant="outline" onClick={() => void repositoryQuery.refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb repositoryName={repository.name} filePath={selectedPath} />

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" render={<Link to="/repositories" />} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Repositories
        </Button>
      </div>

      <RepositoryHeader
        repository={repository}
        onRefresh={() => void repositoryQuery.refetch()}
        isRefreshing={repositoryQuery.isFetching}
        onRetry={repository.status === "failed" ? () => void reindexRepository.mutateAsync(repositoryId ?? "") : undefined}
      />
      {repositoryQuery.data?.error_message && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {repositoryQuery.data.error_message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center justify-between p-4"><div className="flex items-center gap-3"><GitBranch className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">GitHub stars</p><p className="font-semibold">{githubQuery.data?.available ? githubQuery.data.stars.toLocaleString() : "Unavailable"}</p></div></div></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div className="flex items-center gap-3"><Boxes className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">Dependencies</p><Link className="font-semibold text-primary hover:underline" to={`/repositories/${repositoryId}/dependencies`}>Inspect packages</Link></div></div></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">Security</p><Link className="font-semibold text-primary hover:underline" to={`/repositories/${repositoryId}/security`}>Scan with OSV</Link></div></div></CardContent></Card>
      </div>

      <RepositoryOverview repository={repository} />
      <RepositoryStats stats={repository.statistics!} />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Files</h2>
          <p className="text-sm text-muted-foreground">
            Browse the indexed repository and inspect source files in read-only mode.
          </p>
        </div>
        <FileExplorer
          fileTree={[...fileTree]}
          selectedPath={selectedPath}
          selectedFile={fileQuery.data ?? null}
          isFileLoading={fileQuery.isLoading}
          fileError={fileQuery.error}
          onFileSelect={(path) => setSelection({ repositoryId: repositoryId ?? "", path })}
          className="h-[42rem]"
        />
      </section>
    </div>
  );
}

export default Repository;
