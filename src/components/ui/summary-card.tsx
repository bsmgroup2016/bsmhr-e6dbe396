import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const summaryCardVariants = cva(
  "group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-card hover:border-primary/25 before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
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
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const iconVariants = cva(
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105",
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
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface SummaryCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof summaryCardVariants> {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  caption?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  loading?: boolean;
}

export function SummaryCard({
  title,
  value,
  icon,
  caption,
  trend,
  loading,
  className,
  variant,
  ...props
}: SummaryCardProps) {
  return (
    <div className={cn(summaryCardVariants({ variant }), "min-h-[168px]", className)} {...props}>
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {title}
            </p>
            {loading ? (
              <Skeleton className="mt-3 h-11 w-32" />
            ) : (
              <p className="mt-2.5 text-[2.1rem] font-bold leading-none tracking-tight tabular-nums text-foreground">
                {value}
              </p>
            )}
          </div>
          <div className={cn(iconVariants({ variant }))}>{icon}</div>
        </div>

        {(caption || trend) && !loading && (
          <div className="mt-5 flex items-center gap-2 border-t border-border/60 pt-3 text-xs">
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
