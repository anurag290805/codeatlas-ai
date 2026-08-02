import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Server,
} from "lucide-react";
import type { HTMLAttributes } from "react";
import { useHealth } from "@/hooks/useHealth";
import { cn } from "@/lib/utils";

interface HealthPayload {
  status?: string;
  version?: string;
  uptime?: number | string;
}

interface HealthStatusProps {
  className?: string;
}

type HealthState = "loading" | "healthy" | "unhealthy" | "unavailable";

const stateStyles: Record<
  Exclude<HealthState, "loading">,
  { label: string; badgeClassName: string; iconClassName: string }
> = {
  healthy: {
    label: "Online",
    badgeClassName:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  unhealthy: {
    label: "Unhealthy",
    badgeClassName: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    iconClassName: "text-red-600 dark:text-red-400",
  },
  unavailable: {
    label: "Unavailable",
    badgeClassName: "border-border bg-muted text-muted-foreground",
    iconClassName: "text-muted-foreground",
  },
};

function Card({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Badge({ className, children }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Separator() {
  return <div role="separator" className="h-px w-full bg-border" />;
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "Not checked yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function formatUptime(uptime: number | string): string {
  if (typeof uptime === "string") return uptime;
  if (!Number.isFinite(uptime) || uptime < 0) return "Unavailable";

  const totalSeconds = Math.floor(uptime);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function HealthStatus({ className }: HealthStatusProps) {
  const { data, error, isError, isLoading, dataUpdatedAt } = useHealth();
  const health = data as HealthPayload | undefined;

  const state: HealthState = isLoading
    ? "loading"
    : isError
      ? "unavailable"
      : health?.status?.toLowerCase() === "healthy"
        ? "healthy"
        : "unhealthy";

  const stateStyle = state === "loading" ? null : stateStyles[state];
  const StatusIcon =
    state === "loading"
      ? Loader2
      : state === "healthy"
        ? CheckCircle2
        : AlertCircle;

  const errorMessage = error instanceof Error ? error.message : "Health check failed.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("w-full", className)}
    >
      <Card>
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Server className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight">Backend health</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Service availability and connectivity
                </p>
              </div>
            </div>

            {stateStyle && (
              <Badge className={cn("shrink-0 gap-1.5", stateStyle.badgeClassName)}>
                <span
                  className={cn("h-1.5 w-1.5 rounded-full bg-current", stateStyle.iconClassName)}
                  aria-hidden="true"
                />
                {stateStyle.label}
              </Badge>
            )}
          </div>

          <Separator />

          {state === "loading" ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Checking backend status…
            </div>
          ) : state === "unavailable" ? (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Backend unavailable</p>
                <p className="mt-0.5 text-xs">{errorMessage}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <StatusIcon
                  className={cn("h-4 w-4", stateStyle?.iconClassName)}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{health?.status ?? "Unknown"}</p>
                </div>
              </div>

              {health?.version && (
                <div>
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="font-medium">{health.version}</p>
                </div>
              )}

              {health?.uptime !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="font-medium">{formatUptime(health.uptime)}</p>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Last successful check: {formatTimestamp(dataUpdatedAt)}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
