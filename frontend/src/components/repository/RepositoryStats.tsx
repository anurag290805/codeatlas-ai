import { motion } from "framer-motion";
import {
  Files,
  FolderTree,
  GitCommitHorizontal,
  Users,
  Languages,
  GitBranch,
  Boxes,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RepositoryStatistics } from "@/types";

interface RepositoryStatsProps {
  stats: RepositoryStatistics;
  className?: string;
}

interface StatDefinition {
  key: keyof RepositoryStatistics;
  label: string;
  icon: LucideIcon;
}

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: "fileCount", label: "Files", icon: Files },
  { key: "directoryCount", label: "Directories", icon: FolderTree },
  { key: "commitCount", label: "Commits", icon: GitCommitHorizontal },
  { key: "contributorCount", label: "Contributors", icon: Users },
  { key: "languageCount", label: "Languages", icon: Languages },
  { key: "branchCount", label: "Branches", icon: GitBranch },
  { key: "chunkCount", label: "AI Chunks", icon: Boxes },
  { key: "embeddingCount", label: "Embeddings", icon: Sparkles },
];

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  delay: number;
}

function StatCard({ label, value, icon: Icon, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut", delay }}
    >
      <Card className="group border-border/60 p-3.5 transition-colors hover:border-border hover:bg-muted/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
        </div>
        <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
          {value.toLocaleString()}
        </p>
      </Card>
    </motion.div>
  );
}

export function RepositoryStats({ stats, className }: RepositoryStatsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8",
        className,
      )}
    >
      {STAT_DEFINITIONS.map((definition, index) => (
        <StatCard
          key={definition.key}
          label={definition.label}
          value={stats[definition.key]}
          icon={definition.icon}
          delay={index * 0.03}
        />
      ))}
    </div>
  );
}