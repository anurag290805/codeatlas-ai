// src/components/dashboard/RepositoryCard.tsx
import { motion } from "framer-motion";
import {
  ExternalLink,
  Globe,
  Lock,
  MoreVertical,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { RepositoryStatus, type RepositoryStatusValue } from "@/components/dashboard/RepositoryStatus";

export type RepositoryVisibility = "public" | "private";

interface RepositoryCardProps {
  name: string;
  owner: string;
  visibility: RepositoryVisibility;
  defaultBranch: string;
  language?: string;
  size: string;
  lastUpdated: string;
  status: RepositoryStatusValue;
  isLoading?: boolean;
  onOpen?: () => void;
  onRefresh?: () => void;
  onDelete?: () => void;
  className?: string;
}

/**
 * Presents a single imported repository — its metadata and current
 * processing status — with quick actions to open, refresh, or delete
 * it. Purely presentational; all data and handlers are supplied via
 * props.
 */
export function RepositoryCard({
  name,
  owner,
  visibility,
  defaultBranch,
  language,
  size,
  lastUpdated,
  status,
  isLoading = false,
  onOpen,
  onRefresh,
  onDelete,
  className,
}: RepositoryCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const VisibilityIcon = visibility === "private" ? Lock : Globe;

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15, ease: "easeOut" }}>
      <Card className={className}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold tracking-tight">{name}</h3>
              <RepositoryStatus status={status} />
            </div>
            <p className="truncate text-xs text-muted-foreground">{owner}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Repository actions"
                />
              }
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpen}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Repository
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1 font-normal">
              <VisibilityIcon className="h-3 w-3" />
              {visibility === "private" ? "Private" : "Public"}
            </Badge>
            {language && (
              <Badge variant="outline" className="font-normal">
                {language}
              </Badge>
            )}
            <Badge variant="outline" className="font-normal">
              {defaultBranch}
            </Badge>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{size}</span>
          <span>Updated {lastUpdated}</span>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
