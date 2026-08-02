import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  columns?: number;
  /** Render inside a bordered card surface. Defaults to true. */
  card?: boolean;
}

/**
 * Row-list skeleton that mirrors the light table UI:
 * an avatar/label column plus `columns` value columns.
 */
export function LoadingState({
  rows = 4,
  columns = 3,
  card = true,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn(
        card && "overflow-hidden rounded-xl border bg-card shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-28" />
        <div className="ml-auto flex gap-6">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="hidden h-3 w-16 sm:block" />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-3.5 w-32 sm:w-44" />
              <Skeleton className="h-3 w-20 sm:w-28" />
            </div>
            <div className="ml-auto flex items-center gap-6">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={cn("hidden h-3.5 sm:block", c === 0 ? "w-20" : "w-14")}
                />
              ))}
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Summary/metric card skeletons. */
export function LoadingCards({
  count = 4,
  className,
  ...props
}: { count?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
      {...props}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-5 shadow-sm bg-gradient-surface"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-7 w-20" />
          <Skeleton className="mt-2.5 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Panel skeleton: title, copy lines and an action bar. */
export function LoadingPanel({
  lines = 3,
  className,
  ...props
}: { lines?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}
      {...props}
    >
      <Skeleton className="h-4 w-40" />
      <SkeletonText lines={lines} className="mt-4" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}
