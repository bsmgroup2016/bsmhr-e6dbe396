import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Compact variant for use inside small panels and table bodies. */
  size?: "default" | "sm";
  /** Extra content rendered under the actions (hints, links). */
  children?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  className,
  children,
  ...props
}: EmptyStateProps) {
  const compact = size === "sm";

  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-card text-center",
        "bg-gradient-surface shadow-sm",
        compact ? "p-6" : "px-8 py-12",
        className,
      )}
      {...props}
    >
      {/* soft indigo halo behind the icon */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-16 -z-10 mx-auto h-40 w-40 rounded-full bg-primary/10 blur-3xl"
      />

      {icon && (
        <div
          className={cn(
            "animate-empty-float mb-4 grid shrink-0 place-items-center rounded-2xl",
            "border border-primary/15 bg-primary/8 text-primary shadow-sm",
            "[&_svg]:size-6",
            compact ? "size-11" : "size-14 [&_svg]:size-7",
          )}
        >
          {icon}
        </div>
      )}

      <h3
        className={cn(
          "font-semibold tracking-tight text-foreground",
          compact ? "text-sm" : "text-base",
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            "mt-1.5 text-balance text-muted-foreground",
            compact ? "max-w-xs text-xs" : "max-w-md text-sm leading-relaxed",
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button
              size={compact ? "sm" : "default"}
              className="shadow-sm"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              size={compact ? "sm" : "default"}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
