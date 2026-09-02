import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  /** One-line supporting copy beneath the title. */
  description?: ReactNode;
  /** Optional small kicker above the title, e.g. "Repository intelligence". */
  eyebrow?: ReactNode;
  /** Optional leading icon rendered in a subtle square chip. */
  icon?: ReactNode;
  /** Right-aligned primary actions (buttons, repository selectors, etc.). */
  actions?: ReactNode;
  className?: string;
}

/**
 * The single page-title treatment across CodeAtlas. Replaces the previous
 * per-page mix of gradient banners and ad-hoc headings with one flat,
 * structured toolbar header. Deliberately free of gradients and large
 * background panels — the emphasis is on a clear reading order:
 * eyebrow → title → description, with actions aligned to the end.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          {eyebrow && (
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}