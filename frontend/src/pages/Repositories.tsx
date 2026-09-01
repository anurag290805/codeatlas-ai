import { useMemo, useState } from "react";
import { Import, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportRepositoryDialog, type ImportRepositoryFormValues } from "@/components/dashboard/ImportRepositoryDialog";
import { RepositoryCard } from "@/components/dashboard/RepositoryCard";
import type { RepositoryStatusValue } from "@/components/dashboard/RepositoryStatus";
import { useImportRepository, useRepositories } from "@/hooks/useRepositories";
import type { RepositoryListItem } from "@/types/repository";

function nameOf(repository: RepositoryListItem): string {
  return repository.repository_name.replace(/^https:\/\/github\.com\//, "").replace(/\.git\/?$/, "");
}

function statusOf(repository: RepositoryListItem): RepositoryStatusValue {
  if (repository.status === "ready" || repository.status === "indexed") return "ready";
  if (repository.status === "failed" || repository.status === "index_failed" || repository.status === "failed_import") return "error";
  if (repository.status === "embedding") return "embedding";
  if (repository.status === "cloning") return "cloning";
  return "indexing";
}

export function Repositories() {
  const navigate = useNavigate();
  const repositoriesQuery = useRepositories();
  const importRepository = useImportRepository();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const repositories = useMemo(() => repositoriesQuery.data?.items ?? [], [repositoriesQuery.data]);

  const handleImport = async ({ repositoryUrl }: ImportRepositoryFormValues) => {
    await importRepository.mutateAsync({ url: repositoryUrl });
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage imported codebases and indexing status.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void repositoriesQuery.refetch()} disabled={repositoriesQuery.isFetching} className="gap-1.5">
            <RefreshCw className={repositoriesQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setIsDialogOpen(true)} className="gap-1.5"><Import className="h-3.5 w-3.5" /> Import repository</Button>
        </div>
      </div>

      {repositoriesQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading repositories…</div>
      ) : repositoriesQuery.isError && repositories.length === 0 ? (
        <Card className="border-destructive/30"><CardContent className="p-5 text-sm text-destructive">Unable to load repositories. Try refreshing.</CardContent></Card>
      ) : repositories.length === 0 ? (
        <Card><CardHeader><CardTitle className="text-base">No repositories yet</CardTitle></CardHeader><CardContent className="pt-0"><p className="mb-4 text-sm text-muted-foreground">Import a GitHub repository to start indexing.</p><Button onClick={() => setIsDialogOpen(true)} className="gap-1.5"><Import className="h-4 w-4" /> Import repository</Button></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {repositories.map((repository) => (
            <RepositoryCard key={repository.id} name={nameOf(repository)} owner={nameOf(repository).split("/")[0] ?? "GitHub"} visibility="public" defaultBranch={repository.default_branch} size={`${repository.files_indexed.toLocaleString()} files`} lastUpdated={repository.last_indexed_at ? new Date(repository.last_indexed_at).toLocaleDateString() : "Not indexed"} status={statusOf(repository)} onOpen={() => navigate(`/repositories/${repository.id}`)} onRefresh={() => void repositoriesQuery.refetch()} />
          ))}
        </div>
      )}

      <ImportRepositoryDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onSubmit={handleImport} isLoading={importRepository.isPending} />
    </div>
  );
}

export default Repositories;
