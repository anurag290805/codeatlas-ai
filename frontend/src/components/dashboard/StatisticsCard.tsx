// src/components/dashboard/StatsCard.tsx
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTrendDirection = "positive" | "negative" | "neutral";

export interface StatTrend {
  value: string;
  direction: StatTrendDirection;
}

/** Accent tone for the leading icon, so the stat reads at a glance. */
export type StatTone = "primary" | "info" | "success" | "warning" | "danger" | "neutral";

const TONE_STYLES: Record<StatTone, { icon: string; chip: string }> = {
  primary: { icon: "text-primary", chip: "bg-primary/18 text-primary border border-primary/30 shadow-sm shadow-primary/15 dark:bg-primary/22 dark:border-primary/35 colourful:bg-primary/20 colourful:shadow-primary/20" },
  info: { icon: "text-info", chip: "bg-info/18 text-info border border-info/30 shadow-sm shadow-info/15 dark:bg-info/22 dark:border-info/35 colourful:bg-info/20 colourful:shadow-info/20" },
  success: { icon: "text-success", chip: "bg-success/18 text-success border border-success/30 shadow-sm shadow-success/15 dark:bg-success/22 dark:border-success/35 colourful:bg-success/20 colourful:shadow-success/20" },
  warning: { icon: "text-warning", chip: "bg-warning/18 text-warning border border-warning/30 shadow-sm shadow-warning/15 dark:bg-warning/22 dark:border-warning/35 colourful:bg-warning/20 colourful:shadow-warning/20" },
  danger: { icon: "text-danger", chip: "bg-danger/18 text-danger border border-danger/30 shadow-sm shadow-danger/15 dark:bg-danger/22 dark:border-danger/35 colourful:bg-danger/20 colourful:shadow-danger/20" },
  neutral: { icon: "text-muted-foreground", chip: "bg-muted/70 text-muted-foreground border border-border/70 shadow-sm shadow-muted/10" },
};

interface StatsCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: StatTrend;
  tone?: StatTone;
  className?: string;
}

const TREND_STYLES: Record<StatTrendDirection, { icon: LucideIcon; className: string }> = {
  positive: { icon: TrendingUp, className: "text-success" },
  negative: { icon: TrendingDown, className: "text-danger" },
  neutral: { icon: Minus, className: "text-muted-foreground" },
};

/**
 * Reusable statistics summary card (icon, title, value, optional
 * trend and subtitle) used across the dashboard and other overview
 * surfaces. The leading icon takes an accent tone so each metric's
 * meaning is distinguishable at a glance.
 */
export function StatsCard({ icon: Icon, title, value, subtitle, trend, tone = "neutral", className }: StatsCardProps) {
  const trendStyle = trend ? TREND_STYLES[trend.direction] : null;
  const TrendIcon = trendStyle?.icon;
  const toneStyle = TONE_STYLES[tone];

  return (
    <Card className={cn("transition-all hover:-translate-y-0.5 hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm", toneStyle.chip)}>
          <Icon className={cn("h-4 w-4", toneStyle.icon)} aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {(trend ?? subtitle) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {trend && trendStyle && TrendIcon && (
              <span className={cn("flex items-center gap-1", trendStyle.className)}>
                <TrendIcon className="h-3 w-3" aria-hidden="true" />
                {trend.value}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
