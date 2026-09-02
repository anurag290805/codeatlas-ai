// src/components/dashboard/RepositoryStatus.tsx
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Download,
  GitBranch,
  Layers,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RepositoryStatusValue =
  | "idle"
  | "importing"
  | "cloning"
  | "indexing"
  | "embedding"
  | "ready"
  | "error"
  | "index_failed"
  | "failed_import"
  | "deleting";

interface RepositoryStatusProps {
  status: RepositoryStatusValue;
  className?: string;
}

const STATUS_CONFIG: Record<
  RepositoryStatusValue,
  { label: string; icon: LucideIcon; className: string }
> = {
  idle: {
    label: "Idle",
    icon: CircleDot,
    className: "border-transparent bg-muted text-muted-foreground",
  },
  index_failed: {
    label: "Index Failed",
    icon: AlertCircle,
    className:
      "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },

  failed_import: {
    label: "Import Failed",
    icon: AlertCircle,
    className:
      "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },

  deleting: {
    label: "Deleting",
    icon: AlertCircle,
    className:
      "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  importing: {
    label: "Importing",
    icon: Download,
    className: "border-transparent bg-primary/10 text-primary",
  },
  cloning: {
    label: "Cloning",
    icon: GitBranch,
    className: "border-transparent bg-primary/10 text-primary",
  },
  indexing: {
    label: "Indexing",
    icon: Layers,
    className: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  embedding: {
    label: "Embedding",
    icon: Sparkles,
    className: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    className: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    className: "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

/**
 * Displays backend processing status for a repository as a labeled
 * badge with an icon. Reusable anywhere repository status needs to be
 * surfaced (cards, tables, detail panes).
 *
 * `RepositoryStatusValue` is defined here as the presentation status union
 * and should move to `src/types` once shared domain types exist.
 */
export function RepositoryStatus({ status, className }: RepositoryStatusProps) {
  const config =
    STATUS_CONFIG[status] ??
    {
      label: status,
      icon: AlertCircle,
      className:
        "border-transparent bg-muted text-muted-foreground",
    };

  const { label, icon: Icon, className: statusClassName } = config;
  return (
    <Badge className={cn("gap-1.5 font-medium", statusClassName, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
