// src/components/analytics/RepositoryMetrics.tsx

import type { FC } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  FolderTree,
  Code2,
  Languages,
  Boxes,
  Sparkles,
  Waypoints,
  HardDrive,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { RepositoryMetricsData } from "@/types/analytics";

export interface RepositoryMetricsProps {
  /** Summary analytics for the repository. */
  data: RepositoryMetricsData;
  isLoading?: boolean;
  className?: string;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

interface MetricDefinition {
  key: string;
  label: string;
  icon: FC<{ className?: string }>;
  value: string;
}

/**
 * Displays the repository's top-line analytics as a responsive grid of
 * metric cards. Purely presentational - all values arrive through props.
 */
export const RepositoryMetrics: FC<RepositoryMetricsProps> = ({
  data,
  isLoading = false,
  className,
}) => {
  const metrics: MetricDefinition[] = [
    {
      key: "files",
      label: "Total files",
      icon: FileText,
      value: formatCompactNumber(data.totalFiles),
    },
    {
      key: "folders",
      label: "Total folders",
      icon: FolderTree,
      value: formatCompactNumber(data.totalFolders),
    },
    {
      key: "loc",
      label: "Lines of code",
      icon: Code2,
      value: formatCompactNumber(data.linesOfCode),
    },
    {
      key: "languages",
      label: "Languages detected",
      icon: Languages,
      value: formatCompactNumber(data.languagesDetected),
    },
    {
      key: "chunks",
      label: "AI chunks",
      icon: Boxes,
      value: formatCompactNumber(data.aiChunks),
    },
    {
      key: "embeddings",
      label: "Embeddings",
      icon: Sparkles,
      value: formatCompactNumber(data.embeddings),
    },
    {
      key: "nodes",
      label: "Dependency nodes",
      icon: Waypoints,
      value: formatCompactNumber(data.dependencyNodes),
    },
    {
      key: "size",
      label: "Repository size",
      icon: HardDrive,
      value: formatBytes(data.repositorySizeBytes),
    },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {isLoading
        ? metrics.map((metric) => <MetricCardSkeleton key={metric.key} />)
        : metrics.map((metric, index) => (
            <MetricCard key={metric.key} metric={metric} index={index} />
          ))}
    </div>
  );
};

const MetricCard: FC<{ metric: MetricDefinition; index: number }> = ({
  metric,
  index,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, delay: index * 0.03 }}
  >
    <Card className="h-full border-border/60 transition-colors hover:border-border">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">
            {metric.value}
          </p>
        </div>
        <MetricIconBadge icon={metric.icon} />
      </CardContent>
    </Card>
  </motion.div>
);

const MetricIconBadge: FC<{ icon: FC<{ className?: string }> }> = ({
  icon: Icon,
}) => (
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
    <Icon className="h-4 w-4 text-muted-foreground" />
  </div>
);

const MetricCardSkeleton: FC = () => (
  <Card className="border-border/60">
    <CardContent className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-14" />
      </div>
      <Skeleton className="h-8 w-8 rounded-md" />
    </CardContent>
  </Card>
);

export default RepositoryMetrics;