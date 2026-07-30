import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  retry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  retry,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-8 py-10 text-center shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive shadow-sm">
        <AlertTriangle className="size-7" />
      </div>
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-balance text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {retry && (
        <Button className="mt-4" variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
