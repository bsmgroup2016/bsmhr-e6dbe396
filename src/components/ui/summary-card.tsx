import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const summaryCardVariants = cva(
  "group relative flex min-w-0 flex-col rounded-xl border bg-card p-5 shadow-sm transition-colors before:absolute before:inset-y-4 before:left-0 before:w-1 before:rounded-r before:content-['']",
  {
    variants: {
      variant: {
        default: "border-border before:bg-border",
        primary: "border-primary/20 before:bg-gradient-primary",
        success: "border-success/20 before:bg-gradient-success",
        warning: "border-warning/20 before:bg-gradient-warning",
        destructive: "border-destructive/20 before:bg-gradient-destructive",
        info: "border-info/20 before:bg-gradient-info",
      },
      compact: {
        true: "min-h-[108px] p-4",
        false: "min-h-[140px]",
      },
    },
    defaultVariants: {
      variant: "default",
      compact: false,
    },
  },
);

const iconVariants = cva(
  "flex shrink-0 items-center justify-center rounded-lg ring-1",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground ring-border",
        primary: "bg-primary/10 text-primary ring-primary/20",
        success: "bg-success/10 text-success ring-success/20",
        warning: "bg-warning/10 text-warning ring-warning/20",
        destructive: "bg-destructive/10 text-destructive ring-destructive/20",
        info: "bg-info/10 text-info ring-info/20",
      },
      compact: {
        true: "h-9 w-9",
        false: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      compact: false,
    },
  },
);

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-border",
        info: "bg-info/10 text-info ring-info/20",
        success: "bg-success/10 text-success ring-success/20",
        warning: "bg-warning/10 text-warning ring-warning/20",
        critical: "bg-destructive/10 text-destructive ring-destructive/20",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type SummaryBadge = {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "critical";
};

interface SummaryCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof summaryCardVariants> {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  caption?: string;
  badges?: SummaryBadge[];
  trend?: {
    value: string;
    positive: boolean;
  };
  loading?: boolean;
  compact?: boolean;
}

export function SummaryCard({
  title,
  value,
  icon,
  caption,
  badges,
  trend,
  loading,
  compact,
  className,
  variant,
  ...props
}: SummaryCardProps) {
  return (
    <div data-ui="summary-metric" className={cn(summaryCardVariants({ variant, compact }), className)} {...props}>
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {title}
            </p>
            {loading ? (
              <Skeleton className="mt-3 h-9 w-28" />
            ) : (
              <p className="mt-2 break-words text-2xl font-semibold leading-snug tabular-nums text-foreground">
                {value}
              </p>
            )}
          </div>
          <div className={cn(iconVariants({ variant, compact }))}>{icon}</div>
        </div>

        {badges && badges.length > 0 && !loading && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {badges.map((b) => (
              <span key={b.label} className={cn(badgeVariants({ tone: b.tone }))}>
                {b.label}
              </span>
            ))}
          </div>
        )}

        {(caption || trend) && !loading && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5 text-xs">
            {trend && (
              <span
                className={cn("font-semibold", {
                  "text-success": trend.positive,
                  "text-destructive": !trend.positive,
                })}
              >
                {trend.positive ? "↑" : "↓"} {trend.value}
              </span>
            )}
            {caption && <span className="text-muted-foreground">{caption}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
