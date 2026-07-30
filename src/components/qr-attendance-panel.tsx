import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Printer, Download, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSites, getAttendance, getEmployees } from "@/lib/store";
import { buildPunchUrl, today } from "@/lib/qr-attendance";

export function QrAttendancePanel() {
  const sites = useMemo(() => getSites(), []);
  const employees = useMemo(() => getEmployees(), []);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [dataUrl, setDataUrl] = useState("");

  const site = sites.find((s) => s.id === siteId);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = site && origin ? buildPunchUrl(origin, site.id) : "";

  useEffect(() => {
    if (!url) return setDataUrl("");
    void QRCode.toDataURL(url, { width: 512, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(""));
  }, [url]);

  const punches = useMemo(
    () =>
      getAttendance()
        .filter((a) => a.date === today() && (a.notes ?? "").startsWith("QR "))
        .slice(0, 25),
    [],
  );

  const print = () => {
    if (!dataUrl || !site) return;
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return toast.error("Allow pop-ups to print the poster.");
    w.document.write(
      `<html><head><title>${site.name} — QR attendance</title></head>
       <body style="font-family:system-ui;text-align:center;padding:40px">
       <h1>${site.name}</h1><p>${site.code} · ${site.location}</p>
       <img src="${dataUrl}" style="width:420px;height:420px" />
       <p>Scan to clock in / clock out · ${today()}</p>
       </body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  if (sites.length === 0) {
    return (
      <EmptyState
        icon={<QrCode className="h-6 w-6" />}
        title="No sites yet"
        description="Create a project site first — each site gets its own QR attendance poster."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3 rounded-lg border border-border/60 p-4">
          <div>
            <Label>Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {dataUrl ? (
            <img src={dataUrl} alt="Site attendance QR code" className="mx-auto w-full max-w-[240px] rounded-lg border bg-white p-2" />
          ) : (
            <div className="h-[240px] rounded-lg border border-dashed" />
          )}
          <p className="text-center text-xs text-muted-foreground">Poster valid for {today()} only.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={print}><Printer className="mr-2 h-4 w-4" /> Print</Button>
            <Button size="sm" variant="outline" asChild disabled={!dataUrl}>
              <a href={dataUrl || "#"} download={`qr-${site?.code ?? "site"}-${today()}.png`}>
                <Download className="mr-2 h-4 w-4" /> PNG
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { void navigator.clipboard.writeText(url); toast.success("Punch link copied."); }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/60 px-4 py-2 text-sm font-medium">
            QR punches today ({punches.length})
          </div>
          {punches.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No QR punches yet today. Workers scan the poster with the phone camera, sign in once,
              then tap Clock in / Clock out.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {punches.map((a) => {
                    const emp = employees.find((e) => e.id === a.employeeId);
                    const s = sites.find((x) => x.id === a.siteId);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{emp?.name ?? "—"}</TableCell>
                        <TableCell className="text-xs">{s?.name ?? "—"}</TableCell>
                        <TableCell className="text-xs">{a.checkIn ?? "—"}</TableCell>
                        <TableCell className="text-xs">{a.checkOut ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {(a.hoursWorked + a.overtimeHours).toFixed(2)}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {a.checkOutAddress ?? a.checkInAddress ?? "Not captured"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
