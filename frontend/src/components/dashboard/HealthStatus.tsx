import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Server } from "lucide-react";
import { useQueryHealth } from "@/hooks/useHealth";
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
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    degraded:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
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
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            state === "healthy"
              ? "bg-emerald-500"
              : state === "degraded"
                ? "bg-amber-500"
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

  const backendState: HealthState = query.isSuccess
    ? "healthy"
    : "unavailable";

  const queryState: HealthState = query.isLoading
    ? "unavailable"
    : query.isError
      ? "unavailable"
      : query.data?.status === "healthy"
        ? "healthy"
        : "degraded";

  const queryMessage = query.isError
    ? "AI readiness could not be checked."
    : query.data?.message;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6",
        className,
      )}
      aria-label="Platform health"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Server className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-sm font-semibold">Platform health</h2>
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Signal
            label="Backend"
            value={backendState === "healthy" ? "Available" : "Unavailable"}
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
            label="Ollama"
            value={query.data?.ollama_reachable ? "Reachable" : "Unavailable"}
            state={
              query.data?.ollama_reachable ? "healthy" : "unavailable"
            }
          />

          <Signal
            label="Model"
            value={query.data?.llm_model ?? "Checking…"}
            detail={
              query.data?.model_available ? "Available" : "Not verified"
            }
            state={
              query.data?.model_available ? "healthy" : "degraded"
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
          <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {query.data?.llm_provider} is ready for grounded answers.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {queryMessage ??
              "AI answers may be unavailable until the provider is ready."}
          </p>
        )}
      </div>
    </motion.section>
  );
}

export default HealthStatus;