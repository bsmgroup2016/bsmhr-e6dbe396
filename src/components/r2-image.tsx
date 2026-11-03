import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/r2";
import { cn } from "@/lib/utils";

interface R2ImageProps {
  /** Stored reference: an object key or an /api/public/r2-file?key=... link. */
  src?: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Renders an R2-hosted image through a short-lived signed URL so stored links
 * are never publicly readable.
 */
export function R2Image({ src, alt, className, fallback }: R2ImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    if (!src) return;
    getSignedUrl(src)
      .then((u) => active && setUrl(u))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [src]);

  if (!src || failed) return <>{fallback ?? null}</>;
  if (!url) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <img src={url} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}