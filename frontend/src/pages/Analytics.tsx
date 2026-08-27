import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChunkChart } from "@/components/analytics/ChunkChart";
import { CommitActivityChart } from "@/components/analytics/CommitActivityChart";
import { LanguageChart } from "@/components/analytics/LanguageChart";
import { RepositoryMetrics } from "@/components/analytics/RepositoryMetrics";
import { StorageChart } from "@/components/analytics/StorageUsage";
import { useAnalytics } from "@/hooks/useAnalytics";
import { RepositorySelector } from "@/components/common/RepositorySelector";

export function Analytics() {
  const navigate = useNavigate();
  const { repositoryId: routeRepositoryId } = useParams<{ repositoryId: string }>();
  const [selectedRepositoryId, setSelectedRepositoryId] = useState(routeRepositoryId ?? "");
  const analytics = useAnalytics(selectedRepositoryId || undefined);
  const errorMessage = analytics.error instanceof Error
    ? analytics.error.message
    : "Analytics data could not be loaded.";

  const handleRepositoryChange = (value: string) => {
    setSelectedRepositoryId(value);
    navigate(value ? `/analytics/${value}` : "/analytics");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-card to-violet-500/5 p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Understand repository scale, indexing progress, and code structure.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RepositorySelector repositories={analytics.repositories} value={selectedRepositoryId} onChange={handleRepositoryChange} allLabel="All repositories" isLoading={analytics.isLoading} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void analytics.refetch()}
            disabled={analytics.isFetching}
            aria-label="Refresh analytics"
          >
            {analytics.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div></div>

      {analytics.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      )}

      {analytics.isError && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </CardContent>
        </Card>
      )}

      <section aria-label="Repository metrics">
        <RepositoryMetrics data={analytics.data.metrics} isLoading={analytics.isLoading} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <LanguageChart
          data={[...analytics.data.languageDistribution]}
          isLoading={analytics.isLoading}
          error={analytics.isError ? errorMessage : undefined}
        />
        <StorageChart
          data={analytics.data.storageBreakdown}
          isLoading={analytics.isLoading}
          error={analytics.isError ? errorMessage : undefined}
        />
        <ChunkChart
          data={analytics.data.chunkStatistics}
          isLoading={analytics.isLoading}
          error={analytics.isError ? errorMessage : undefined}
        />
        <CommitActivityChart
          data={[...analytics.data.commitActivity]}
          isLoading={analytics.isLoading}
          error={analytics.isError ? errorMessage : undefined}
        />
      </div>
    </div>
  );
}

export default Analytics;
