import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, MapPin, CheckCircle2, AlertCircle, LogIn, LogOut, Camera, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/lib/auth";
import { getEmployees, getSites, getAttendance, upsertAttendance } from "@/lib/store";
import { capturePoint } from "@/lib/geo";
import { uploadToR2 } from "@/lib/r2";
import { verifyPunch } from "@/lib/punch-verification";
import {
  validatePunchToken, hoursBetween, nowTime, splitHours, today,
} from "@/lib/qr-attendance";

export const Route = createFileRoute("/_authenticated/qr-punch")({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === "string" ? search.site : undefined,
    d: typeof search.d === "string" ? search.d : undefined,
    k: typeof search.k === "string" ? search.k : undefined,
  }),
  head: () => ({
    meta: [
      { title: "QR Attendance — BSM Workforce & Operations" },
      { name: "description", content: "Scan the site QR poster to clock in or out." },
      { property: "og:title", content: "QR Attendance — BSM Workforce & Operations" },
      { property: "og:description", content: "Scan the site QR poster to clock in or out." },
    ],
  }),
  component: QrPunchPage,
});

function QrPunchPage() {
  const { site, d, k } = Route.useSearch();
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? "";
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selfie, setSelfie] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const check = useMemo(() => validatePunchToken(site, d, k), [site, d, k]);
  const employee = useMemo(
    () =>
      getEmployees().find(
        (e) => (user?.id && e.userId === user.id) || (!!email && (e.email ?? "").toLowerCase() === email),
      ),
    [email, user?.id, tick],
  );
  const siteRow = useMemo(() => getSites().find((s) => s.id === site), [site, tick]);
  const record = useMemo(
    () => getAttendance().find((a) => a.employeeId === employee?.id && a.date === today()),
    [employee?.id, tick],
  );

  useEffect(() => {
    if (!check.ok) toast.error(check.reason);
  }, [check]);

  if (!check.ok || !siteRow) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={<AlertCircle className="h-5 w-5" />}
            title="QR code not accepted"
            description={check.ok ? "This site no longer exists." : check.reason}
          />
        </div>
      </AppShell>
    );
  }

  if (!employee) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={<AlertCircle className="h-5 w-5" />}
            title="No employee record linked"
            description={`No employee profile matches ${email || "your account"}. Ask HR to link your work email.`}
          />
        </div>
      </AppShell>
    );
  }

  const punch = async (mode: "in" | "out") => {
    setBusy(true);
    try {
      const point = await capturePoint();

      // Selfie + GPS verification against the site geofence (same rules the
      // mobile apps get from the API).
      const verdict = verifyPunch(
        {
          lat: point?.lat ?? null,
          lng: point?.lng ?? null,
          selfieKey: selfie ? "pending" : null,
        },
        {
          lat: siteRow.lat,
          lng: siteRow.lng,
          radiusM: siteRow.geofenceRadiusM,
          enforced: siteRow.geofenceEnforced,
          selfieRequired: siteRow.selfieRequired,
        },
      );
      if (verdict.rejected) {
        toast.error(verdict.message ?? "Punch rejected by site rules");
        return;
      }

      let selfieKey: string | undefined;
      if (selfie) {
        try {
          const uploaded = await uploadToR2(selfie, "attendance", undefined, employee.id);
          selfieKey = uploaded.key;
        } catch {
          toast.warning("Selfie upload failed — the punch is saved without photo proof.");
        }
      }

      const stamp = nowTime();
      if (mode === "in") {
        upsertAttendance({
          employeeId: employee.id,
          date: today(),
          siteId: siteRow.id,
          status: "Present",
          checkIn: stamp,
          checkOut: record?.checkOut,
          hoursWorked: record?.hoursWorked ?? 0,
          overtimeHours: record?.overtimeHours ?? 0,
          notes: `QR clock-in at ${siteRow.name}`,
          checkInLat: point?.lat,
          checkInLng: point?.lng,
          checkInAddress: point?.address,
          checkInSelfieKey: selfieKey,
          checkInVerification: verdict.verification,
          checkInDistanceM: verdict.distanceM ?? undefined,
        });
        toast.success(`Clocked in at ${stamp}`);
      } else {
        const inAt = record?.checkIn ?? stamp;
        const total = hoursBetween(inAt, stamp);
        const { normal, overtime } = splitHours(total);
        upsertAttendance({
          employeeId: employee.id,
          date: today(),
          siteId: siteRow.id,
          status: "Present",
          checkIn: inAt,
          checkOut: stamp,
          hoursWorked: normal,
          overtimeHours: overtime,
          notes: `QR clock-out at ${siteRow.name}`,
          checkInLat: record?.checkInLat,
          checkInLng: record?.checkInLng,
          checkInAddress: record?.checkInAddress,
          checkOutLat: point?.lat,
          checkOutLng: point?.lng,
          checkOutAddress: point?.address,
          checkOutSelfieKey: selfieKey,
          checkOutVerification: verdict.verification,
          checkOutDistanceM: verdict.distanceM ?? undefined,
        });
        toast.success(`Clocked out at ${stamp} — ${total} h recorded`);
      }
      if (!point) toast.warning("Location not captured — the punch is flagged for review.");
      else if (verdict.verification === "flagged")
        toast.warning(verdict.message ?? "Punch flagged for supervisor review.");
      setSelfie(null);
      if (fileRef.current) fileRef.current.value = "";
      setTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-5">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 to-transparent p-5 text-center">
          <QrCode className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-2 text-xl font-semibold">{siteRow.name}</h1>
          <p className="text-sm text-muted-foreground">
            {siteRow.code} · {siteRow.location}
          </p>
          <p className="mt-2 text-sm">
            {employee.name} · {employee.employeeCode}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Today</span>
            <span>{today()}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Clock in</span>
            <span>{record?.checkIn ?? "—"}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Clock out</span>
            <span>{record?.checkOut ?? "—"}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Hours</span>
            <span>
              {(record?.hoursWorked ?? 0).toFixed(2)} + {(record?.overtimeHours ?? 0).toFixed(2)} OT
            </span>
          </div>
          {record?.checkInAddress && (
            <p className="mt-3 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {record.checkInAddress}
            </p>
          )}
          {record?.checkOut && (
            <div className="mt-3">
              <StatusBadge label="Day complete" variant="success" dot />
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" disabled={busy || !!record?.checkIn} onClick={() => punch("in")}>

            <LogIn className="mr-2 h-4 w-4" /> Clock in
          </Button>
          <Button
            size="lg"
            variant="secondary"
            disabled={busy || !record?.checkIn || !!record?.checkOut}
            onClick={() => punch("out")}
          >
            <LogOut className="mr-2 h-4 w-4" /> Clock out
          </Button>
        </div>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3" /> GPS location is captured with every punch for MOM
          attendance evidence.
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/my-portal">Back to my portal</Link>
        </Button>
      </div>
    </AppShell>
  );
}
