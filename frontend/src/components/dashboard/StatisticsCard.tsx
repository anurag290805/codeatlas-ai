// src/components/dashboard/StatsCard.tsx
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTrendDirection = "positive" | "negative" | "neutral";

export interface StatTrend {
  value: string;
  direction: StatTrendDirection;
}

interface StatsCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: StatTrend;
  className?: string;
}

const TREND_STYLES: Record<StatTrendDirection, { icon: LucideIcon; className: string }> = {
  positive: { icon: TrendingUp, className: "text-emerald-600 dark:text-emerald-400" },
  negative: { icon: TrendingDown, className: "text-red-600 dark:text-red-400" },
  neutral: { icon: Minus, className: "text-muted-foreground" },
};

/**
 * Reusable statistics summary card (icon, title, value, optional
 * trend and subtitle) used across the dashboard and other overview
 * surfaces.
 */
export function StatsCard({ icon: Icon, title, value, subtitle, trend, className }: StatsCardProps) {
  const trendStyle = trend ? TREND_STYLES[trend.direction] : null;
  const TrendIcon = trendStyle?.icon;

  return (
    <Card className={cn("transition-colors", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
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