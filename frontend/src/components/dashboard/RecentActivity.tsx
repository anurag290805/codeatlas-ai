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

/**
 * Displays a chronological feed of recent repository activity. Purely
 * presentational — the activity list is supplied via props.
 *
 * `ActivityItem` is defined here as a temporary placeholder and
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

              return (
                <li key={activity.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
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