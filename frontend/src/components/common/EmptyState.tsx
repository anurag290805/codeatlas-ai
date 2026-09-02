import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  /** Why this state occurs and / or what data is missing. */
  description?: ReactNode;
  /** A single clear next step. */
  action?: ReactNode;
  className?: string;
}

/**
 * Standard empty state: icon + title + explanation, with an optional
 * primary action that tells the user exactly what to do next. Uses a
 * dashed border rather than a heavy card so it reads as "awaiting
 * content", not as missing data.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/12 text-primary dark:bg-primary/16 dark:border-primary/25 colourful:bg-primary/14">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}