// src/components/dashboard/RecentActivity.tsx
import {
  FolderPlus,
  MessageSquare,
  Network,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ActivityType =
  | "repository_imported"
  | "repository_deleted"
  | "query_executed"
  | "graph_generated"
  | "index_updated";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  className?: string;
}

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  repository_imported: FolderPlus,
  repository_deleted: Trash2,
  query_executed: MessageSquare,
  graph_generated: Network,
  index_updated: RefreshCw,
};

/** Accent tone per activity type so each event reads at a glance. */
const ACTIVITY_TONES: Record<ActivityType, { icon: string; chip: string }> = {
  repository_imported: { icon: "text-primary", chip: "bg-primary/16 dark:bg-primary/20 colourful:bg-primary/22" },
  repository_deleted: { icon: "text-danger", chip: "bg-danger/16 dark:bg-danger/20 colourful:bg-danger/22" },
  query_executed: { icon: "text-info", chip: "bg-info/16 dark:bg-info/20 colourful:bg-info/22" },
  graph_generated: { icon: "text-info", chip: "bg-info/16 dark:bg-info/20 colourful:bg-info/22" },
  index_updated: { icon: "text-success", chip: "bg-success/16 dark:bg-success/20 colourful:bg-success/22" },
};

/**
 * Displays a chronological feed of recent repository activity. Purely
 * presentational — the activity list is supplied via props.
 *
 * `ActivityItem` is defined here as the dashboard activity projection and
 * should move to `src/types` once shared domain types exist.
 */
export function RecentActivity({ activities, className }: RecentActivityProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No recent activity yet.</p>
        ) : (
          <ul className="space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const tone = ACTIVITY_TONES[activity.type];

              return (
                <li key={activity.id} className="flex items-start gap-3">
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", tone.chip)}>
                    <Icon className={cn("h-3.5 w-3.5", tone.icon)} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{activity.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {activity.timestamp}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="truncate text-xs text-muted-foreground">{activity.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
