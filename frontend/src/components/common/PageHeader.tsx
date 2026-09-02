import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderAccent = "primary" | "info" | "success" | "warning" | "danger";

const ACCENT_CHIP_STYLES: Record<PageHeaderAccent, string> = {
  primary: "border-primary/30 bg-primary/16 text-primary shadow-sm shadow-primary/20 dark:bg-primary/20 dark:border-primary/35 dark:shadow-primary/25 colourful:bg-primary/18 colourful:border-primary/40 colourful:shadow-primary/25",
  info: "border-info/30 bg-info/16 text-info shadow-sm shadow-info/20 dark:bg-info/20 dark:border-info/35 dark:shadow-info/25 colourful:bg-info/18 colourful:border-info/40 colourful:shadow-info/25",
  success: "border-success/30 bg-success/16 text-success shadow-sm shadow-success/20 dark:bg-success/20 dark:border-success/35 dark:shadow-success/25 colourful:bg-success/18 colourful:border-success/40 colourful:shadow-success/25",
  warning: "border-warning/30 bg-warning/16 text-warning shadow-sm shadow-warning/20 dark:bg-warning/20 dark:border-warning/35 dark:shadow-warning/25 colourful:bg-warning/18 colourful:border-warning/40 colourful:shadow-warning/25",
  danger: "border-danger/30 bg-danger/16 text-danger shadow-sm shadow-danger/20 dark:bg-danger/20 dark:border-danger/35 dark:shadow-danger/25 colourful:bg-danger/18 colourful:border-danger/40 colourful:shadow-danger/25",
};

export interface PageHeaderProps {
  title: ReactNode;
  /** One-line supporting copy beneath the title. */
  description?: ReactNode;
  /** Optional small kicker above the title, e.g. "Repository intelligence". */
  eyebrow?: ReactNode;
  /** Optional leading icon rendered in a subtle square chip. */
  icon?: ReactNode;
  /** Accent tone for the leading icon chip. */
  accent?: PageHeaderAccent;
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
  accent = "primary",
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
      <div className="flex min-w-0 items-start gap-3.5">
        {icon && (
          <div
            className={cn(
              "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
              ACCENT_CHIP_STYLES[accent],
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          {eyebrow && (
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
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
