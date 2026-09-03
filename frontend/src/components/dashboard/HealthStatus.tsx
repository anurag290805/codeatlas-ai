import { AlertCircle, CheckCircle2, Loader2, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHealth, useQueryHealth } from "@/hooks/useHealth";
import { cn } from "@/lib/utils";

interface HealthStatusProps {
  className?: string;
}

type HealthState = "healthy" | "degraded" | "unavailable";

function StatusPill({
  state,
  label,
}: {
  state: HealthState;
  label: string;
}) {
  const styles = {
    healthy:
      "border-success/35 bg-success/16 text-success dark:bg-success/20 dark:border-success/40 colourful:bg-success/18",
    degraded:
      "border-warning/35 bg-warning/16 text-warning dark:bg-warning/20 dark:border-warning/40 colourful:bg-warning/18",
    unavailable: "border-border bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        styles[state],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function Signal({
  label,
  value,
  detail,
  state,
}: {
  label: string;
  value: string;
  detail?: string;
  state: HealthState;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            state === "healthy"
              ? "bg-success"
              : state === "degraded"
                ? "bg-warning"
                : "bg-muted-foreground",
          )}
        />
      </div>
      <p className="mt-1 text-sm font-medium">{value}</p>
      {detail && (
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}

export function HealthStatus({ className }: HealthStatusProps) {
  const query = useQueryHealth();
  const liveness = useHealth();

  // Derive availability from the last-known-good probe result, not from
  // `isError`. React Query flips a query to `status: "error"` when a
  // background refetch fails (e.g. a transiently blocked request) while
  // still retaining the last successful `data`. Relying on `isError` would
  // therefore report "Backend: Unavailable" even though the most recent
  // /health probe returned 200 and `liveness.data` still holds it.
  const backendState: HealthState = liveness.data?.status === "healthy"
    ? "healthy"
    : liveness.isError
      ? "unavailable"
      : "degraded";

  const queryState: HealthState = query.isLoading
    ? "degraded"
    : query.isError
      ? "unavailable"
      : query.data?.provider_healthy && query.data?.rag_status === "ready"
        ? "healthy"
        : "degraded";

  const queryMessage = query.isError
    ? "AI readiness could not be checked."
    : query.data?.message;

  return (
    <Card className={cn("border-border/60", className)} aria-label="Platform health">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Platform health</CardTitle>
            <p className="text-xs text-muted-foreground">
              Backend health and AI readiness
            </p>
          </div>
        </div>

        <StatusPill
          state={backendState}
          label={
            backendState === "healthy"
              ? "Backend available"
              : "Backend unavailable"
          }
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Signal
            label="Backend"
            value={backendState === "healthy" ? "Available" : backendState === "degraded" ? "Waking up…" : "Unavailable"}
            state={backendState}
          />

          <Signal
            label="AI query"
            value={
              queryState === "healthy"
                ? "Ready"
                : queryState === "degraded"
                  ? "Degraded"
                  : "Unavailable"
            }
            detail={queryMessage}
            state={queryState}
          />

          <Signal
            label="Provider"
            value={query.data?.llm_provider ?? "Checking…"}
            state={
              query.data?.provider_healthy ? "healthy" : "unavailable"
            }
          />

          <Signal
            label="Model"
            value={query.data?.llm_model ?? "Checking…"}
            detail={
              query.data?.model_available ? "Available" : "Not verified"
            }
            state={
              query.data?.provider_healthy ? "healthy" : "degraded"
            }
          />
        </div>

        {query.isLoading ? (
          <div
            className="flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Refreshing platform signals…
          </div>
        ) : queryState === "healthy" ? (
          <p className="flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {query.data?.llm_provider} is ready for grounded answers.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-xs text-warning">
            <AlertCircle className="h-3.5 w-3.5" />
            {queryMessage ??
              "AI answers may be unavailable until the provider is ready."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default HealthStatus;
