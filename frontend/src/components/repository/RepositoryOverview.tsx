import { motion } from "framer-motion";
import {
  CalendarDays,
  FileStack,
  Sparkles,
  Waypoints,
  CheckCircle2,
  XCircle,
  Loader2,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EmbeddingStatus = "pending" | "in_progress" | "complete" | "failed";

interface RepositoryOverviewProps {
  description?: string | null;
  importedAt: string;
  indexedFileCount: number;
  totalFileCount: number;
  embeddingStatus: EmbeddingStatus;
  graphAvailable: boolean;
  className?: string;
}

interface EmbeddingStatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
  spin?: boolean;
}

const EMBEDDING_STATUS_CONFIG: Record<EmbeddingStatus, EmbeddingStatusConfig> = {
  pending: {
    label: "Not started",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "Generating",
    icon: Loader2,
    className: "bg-blue-500/10 text-blue-500",
    spin: true,
  },
  complete: {
    label: "Up to date",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-500",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive",
  },
};

function formatImportDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

export function RepositoryOverview({
  description,
  importedAt,
  indexedFileCount,
  totalFileCount,
  embeddingStatus,
  graphAvailable,
  className,
}: RepositoryOverviewProps) {
  const embedding = EMBEDDING_STATUS_CONFIG[embeddingStatus];
  const EmbeddingIcon = embedding.icon;
  const indexProgress =
    totalFileCount > 0
      ? Math.min(100, Math.round((indexedFileCount / totalFileCount) * 100))
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
      className={className}
    >
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description?.trim() ? description : "No description provided."}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileStack className="h-3.5 w-3.5" />
                Indexed Files
              </div>
              <p className="text-sm font-semibold text-foreground">
                {indexedFileCount.toLocaleString()} / {totalFileCount.toLocaleString()}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${indexProgress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                AI Embeddings
              </div>
              <Badge
                variant="outline"
                className={cn("gap-1 border-transparent font-normal", embedding.className)}
              >
                <EmbeddingIcon className={cn("h-3 w-3", embedding.spin && "animate-spin")} />
                {embedding.label}
              </Badge>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Waypoints className="h-3.5 w-3.5" />
                Dependency Graph
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 border-transparent font-normal",
                  graphAvailable
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {graphAvailable ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <CircleDashed className="h-3 w-3" />
                )}
                {graphAvailable ? "Available" : "Not generated"}
              </Badge>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Imported
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatImportDate(importedAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}