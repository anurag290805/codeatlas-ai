import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ReadinessSegment {
  label: string;
  count: number;
  /** Tailwind text/bg colour for the segment. */
  color: string;
  icon: typeof CheckCircle2;
}

interface WorkspaceReadinessProps {
  total: number;
  segments: ReadinessSegment[];
  className?: string;
}

/**
 * Primary dashboard summary showing how many of the workspace's
 * repositories are ready, processing, or failed — the single most useful
 * "what is happening" signal. Replaces a wall of undifferentiated stat
 * cards with one visual readout plus a proportionate status bar.
 */
export function WorkspaceReadiness({
  total,
  segments,
  className,
}: WorkspaceReadinessProps) {
  const ready = segments.find((segment) => segment.label === "Ready")?.count ?? 0;
  const widthFor = (count: number) => (total > 0 ? `${(count / total) * 100}%` : "0%");
  const visible = segments.filter((segment) => segment.count > 0);

  return (
    <Card className={cn("bg-card", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Repository readiness</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Indexing status across your workspace
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          {total > 0 ? <CheckCircle2 className="h-5 w-5" /> : <Loader2 className="h-5 w-5" />}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{total}</span>
          <span className="text-sm text-muted-foreground">repositories</span>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {ready} ready
          </span>
        </div>

        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${ready} of ${total} repositories ready`}
        >
          {total > 0 &&
            segments
              .filter((segment) => segment.count > 0)
              .map((segment) => (
                <div
                  key={segment.label}
                  className={cn("h-full", segment.color)}
                  style={{ width: widthFor(segment.count) }}
                  aria-hidden="true"
                />
              ))}
        </div>

        {visible.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-3">
            {visible.map((segment) => {
              const Icon = segment.icon;
              return (
                <li
                  key={segment.label}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-muted-foreground">{segment.label}</span>
                  <span className="ml-auto font-semibold tabular-nums">{segment.count}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <CircleAlert className="h-3.5 w-3.5" />
            No repositories — import one to begin indexing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}