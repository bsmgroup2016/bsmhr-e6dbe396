import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        primary: "border-transparent bg-primary text-primary-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        info: "border-transparent bg-info text-info-foreground",
        outline: "border-input bg-card text-foreground",
        ghost: "border-transparent bg-transparent text-muted-foreground",
      },
      dot: {
        true: "gap-1.5 pl-2",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      dot: false,
    },
  },
);

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label: string;
}

export function StatusBadge({ label, className, variant, dot, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant, dot }), className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-current"
        />
      )}
      {label}
    </span>
  );
}
