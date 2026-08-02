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
  | "error";

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
  importing: {
    label: "Importing",
    icon: Download,
    className: "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  cloning: {
    label: "Cloning",
    icon: GitBranch,
    className: "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400",
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
    className: "border-transparent bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

/**
 * Displays backend processing status for a repository as a labeled
 * badge with an icon. Reusable anywhere repository status needs to be
 * surfaced (cards, tables, detail panes).
 *
 * `RepositoryStatusValue` is defined here as a temporary placeholder
 * and should move to `src/types` once shared domain types exist.
 */
export function RepositoryStatus({ status, className }: RepositoryStatusProps) {
  const { label, icon: Icon, className: statusClassName } = STATUS_CONFIG[status];

  return (
    <Badge className={cn("gap-1.5 font-medium", statusClassName, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}