import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const summaryCardVariants = cva(
  "relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
  {
    variants: {
      variant: {
        default: "border-border",
        primary: "border-primary/20 bg-primary/[0.03]",
        success: "border-success/20 bg-success/[0.03]",
        warning: "border-warning/20 bg-warning/[0.03]",
        destructive: "border-destructive/20 bg-destructive/[0.03]",
        info: "border-info/20 bg-info/[0.03]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const iconVariants = cva(
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-primary/10 text-primary",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        destructive: "bg-destructive/10 text-destructive",
        info: "bg-info/10 text-info",
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
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
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
