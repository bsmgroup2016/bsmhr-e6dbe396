import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, MapPinOff } from "lucide-react";
import { getCurrentPosition, reverseGeocode } from "@/lib/geo";

export type CapturedLocation = { lat: number; lng: number; address: string };

/**
 * Capture browser geolocation + a human-readable address (OpenStreetMap Nominatim).
 * Location is optional — attendance can still be saved when it is denied.
 */
export function GeoCapture({
  label,
  prefix,
  value,
  onCapture,
}: {
  label: string;
  /** Hidden input name prefix, e.g. "checkIn" → checkInLat / checkInLng / checkInAddress */
  prefix: string;
  value?: CapturedLocation | null;
  onCapture?: (loc: CapturedLocation | null) => void;
}) {
  const [loc, setLoc] = useState<CapturedLocation | null>(value ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function capture() {
    setBusy(true);
    setError(null);
    try {
      const { lat, lng } = await getCurrentPosition();
      const address = await reverseGeocode(lat, lng);
      const next = { lat, lng, address };
      setLoc(next);
      onCapture?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location unavailable");
      setLoc(null);
      onCapture?.(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={capture} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MapPin className="mr-1 h-4 w-4" />}
          {label}
        </Button>
        {loc ? (
          <Badge variant="secondary" className="max-w-[22rem] truncate">
            {loc.address}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <MapPinOff className="mr-1 h-3 w-3" />
            Location not captured
          </Badge>
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <input type="hidden" name={`${prefix}Lat`} value={loc?.lat ?? ""} />
      <input type="hidden" name={`${prefix}Lng`} value={loc?.lng ?? ""} />
      <input type="hidden" name={`${prefix}Address`} value={loc?.address ?? ""} />
    </div>
  );
}