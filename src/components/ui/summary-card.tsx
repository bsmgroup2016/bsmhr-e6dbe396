import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const summaryCardVariants = cva(
  "group relative flex flex-col overflow-hidden rounded-xl border bg-gradient-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elegant before:absolute before:inset-x-0 before:top-0 before:h-1 before:content-['']",
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
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-gradient-primary text-primary-foreground shadow-elegant",
        success: "bg-gradient-success text-success-foreground",
        warning: "bg-gradient-warning text-warning-foreground",
        destructive: "bg-gradient-destructive text-destructive-foreground",
        info: "bg-gradient-info text-info-foreground",
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
    <div className={cn(summaryCardVariants({ variant }), className)} {...props}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-28" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          )}
          {(caption || trend) && !loading && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              {trend && (
                <span
                  className={cn("font-medium", {
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
        <div className={cn(iconVariants({ variant }))}>{icon}</div>
      </div>
    </div>
  );
}
