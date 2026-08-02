import { useState } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  GitBranch,
  Globe,
  Lock,
  MoreVertical,
  RefreshCw,
  Trash2,
  Code2,
  HardDrive,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Repository, RepositoryProcessingStatus } from "@/types";

interface RepositoryHeaderProps {
  repository: Repository;
  onRefresh: () => void;
  onDelete: () => void;
  isRefreshing?: boolean;
  isDeleting?: boolean;
  className?: string;
}

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  badgeClassName: string;
  spin?: boolean;
}

const STATUS_CONFIG: Record<RepositoryProcessingStatus, StatusConfig> = {
  pending: {
    label: "Queued",
    icon: Clock,
    badgeClassName: "bg-muted text-muted-foreground border-transparent",
  },
  cloning: {
    label: "Cloning",
    icon: Loader2,
    badgeClassName: "bg-blue-500/10 text-blue-500 border-transparent",
    spin: true,
  },
  parsing: {
    label: "Parsing",
    icon: Loader2,
    badgeClassName: "bg-blue-500/10 text-blue-500 border-transparent",
    spin: true,
  },
  embedding: {
    label: "Embedding",
    icon: Loader2,
    badgeClassName: "bg-violet-500/10 text-violet-500 border-transparent",
    spin: true,
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    badgeClassName: "bg-emerald-500/10 text-emerald-500 border-transparent",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    badgeClassName: "bg-destructive/10 text-destructive border-transparent",
  },
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatRelativeTime(isoDate: string): string {
  const target = new Date(isoDate).getTime();
  const diffSeconds = Math.round((target - Date.now()) / 1000);
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, secondsInUnit] of divisions) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return formatter.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }
  return formatter.format(diffSeconds, "second");
}

export function RepositoryHeader({
  repository,
  onRefresh,
  onDelete,
  isRefreshing = false,
  isDeleting = false,
  className,
}: RepositoryHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = STATUS_CONFIG[repository.status];
  const StatusIcon = status.icon;
  const VisibilityIcon = repository.isPrivate ? Lock : Globe;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={className}
    >
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                {repository.name}
              </h1>
              <span className="text-sm text-muted-foreground">
                {repository.owner}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn("gap-1 font-normal", status.badgeClassName)}
              >
                <StatusIcon
                  className={cn("h-3 w-3", status.spin && "animate-spin")}
                />
                {status.label}
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                <VisibilityIcon className="h-3 w-3" />
                {repository.isPrivate ? "Private" : "Public"}
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                <GitBranch className="h-3 w-3" />
                {repository.defaultBranch}
              </Badge>
              {repository.primaryLanguage && (
                <Badge variant="outline" className="gap-1 font-normal">
                  <Code2 className="h-3 w-3" />
                  {repository.primaryLanguage}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1 font-normal">
                <HardDrive className="h-3 w-3" />
                {formatBytes(repository.sizeBytes)}
              </Badge>
            </div>

            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Updated {formatRelativeTime(repository.updatedAt)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing || isDeleting}
              className="gap-1.5"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
              Refresh
            </Button>

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Repository actions"
                  />
                }
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  render={
                    <a
                      href={repository.htmlUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex cursor-pointer items-center gap-2"
                    />
                  }
                >
                    <ExternalLink className="h-4 w-4" />
                    Open on GitHub
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isDeleting}
                  onSelect={(event) => {
                    event.preventDefault();
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex cursor-pointer items-center gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Repository
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
