import { useEffect, useState } from "react";
import { Landmark, QrCode, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCompanies, updateCompany } from "@/lib/store";
import { payNowQrDataUrl } from "@/lib/paynow";
import type { Company } from "@/lib/types";

/** PayNow + bank transfer details used on invoices (manual reconciliation). */
export function PaymentDetails() {
  const companies = getCompanies();
  const [drafts, setDrafts] = useState<Record<string, Partial<Company>>>({});
  const [preview, setPreview] = useState<Record<string, string | null>>({});

  const value = (c: Company) => ({ ...c, ...(drafts[c.id] ?? {}) });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string | null> = {};
      for (const c of companies) {
        next[c.id] = await payNowQrDataUrl(value(c), { amount: 1000, reference: "INV-SAMPLE" });
      }
      if (!cancelled) setPreview(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(drafts), companies.length]);

  function set(id: string, patch: Partial<Company>) {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } }));
  }

  function save(c: Company) {
    const patch = drafts[c.id];
    if (!patch) return toast.info("Nothing to save");
    updateCompany(c.id, patch);
    setDrafts((d) => {
      const { [c.id]: _drop, ...rest } = d;
      return rest;
    });
    toast.success(`${c.name} payment details saved`);
  }

  if (!companies.length) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Add a company first to configure payment details.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Landmark className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Payment collection (PayNow / bank transfer)</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        These details are printed on invoices together with a PayNow QR code. No payment gateway and
        no transaction fee — once the client pays, mark the invoice as paid in Billing.
      </p>

      <Tabs defaultValue={companies[0].id}>
        <TabsList>
          {companies.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.code}
            </TabsTrigger>
          ))}
        </TabsList>

        {companies.map((c) => {
          const v = value(c);
          return (
            <TabsContent key={c.id} value={c.id} className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>PayNow proxy type</Label>
                      <Select
                        value={v.paynowType ?? "UEN"}
                        onValueChange={(t) => set(c.id, { paynowType: t as Company["paynowType"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UEN">UEN (company)</SelectItem>
                          <SelectItem value="Mobile">Mobile number</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(v.paynowType ?? "UEN") === "UEN" ? (
                      <div className="space-y-2">
                        <Label>PayNow UEN</Label>
                        <Input
                          value={v.paynowUen ?? ""}
                          placeholder={c.uen || "e.g. 201812345KABC"}
                          onChange={(e) => set(c.id, { paynowUen: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>PayNow mobile</Label>
                        <Input
                          value={v.paynowPhone ?? ""}
                          placeholder="+6591234567"
                          onChange={(e) => set(c.id, { paynowPhone: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Let the payer edit the amount</p>
                      <p className="text-xs text-muted-foreground">
                        Off = amount locked to the invoice balance (recommended).
                      </p>
                    </div>
                    <Switch
                      checked={!!v.paynowEditable}
                      onCheckedChange={(on) => set(c.id, { paynowEditable: on })}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Bank name</Label>
                      <Input
                        value={v.bankName ?? ""}
                        placeholder="DBS Bank Ltd"
                        onChange={(e) => set(c.id, { bankName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account holder name</Label>
                      <Input
                        value={v.bankAccountName ?? ""}
                        placeholder={c.legalName}
                        onChange={(e) => set(c.id, { bankAccountName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account number</Label>
                      <Input
                        value={v.bankAccountNo ?? ""}
                        placeholder="003-123456-7"
                        onChange={(e) => set(c.id, { bankAccountNo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bank / branch code</Label>
                      <Input
                        value={v.bankCode ?? ""}
                        placeholder="7171 / 003"
                        onChange={(e) => set(c.id, { bankCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SWIFT code</Label>
                      <Input
                        value={v.bankSwift ?? ""}
                        placeholder="DBSSSGSGXXX"
                        onChange={(e) => set(c.id, { bankSwift: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Extra payment instructions (printed on the invoice)</Label>
                    <Textarea
                      rows={3}
                      value={v.paymentInstructions ?? ""}
                      placeholder="Please quote the invoice number as payment reference and email the remittance advice to accounts@example.com"
                      onChange={(e) => set(c.id, { paymentInstructions: e.target.value })}
                    />
                  </div>

                  <Button onClick={() => save(c)} disabled={!drafts[c.id]}>
                    <Save className="mr-2 h-4 w-4" />
                    Save {c.code} details
                  </Button>
                </div>

                <div className="w-full max-w-[220px] space-y-2 rounded-lg border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                    Sample QR
                  </div>
                  {preview[c.id] ? (
                    <img
                      src={preview[c.id] as string}
                      alt={`${c.name} sample PayNow QR`}
                      className="w-full rounded-md bg-white p-2"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Enter a PayNow UEN or mobile number to preview the QR code.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Preview only — $1,000.00 with reference INV-SAMPLE.
                  </p>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
