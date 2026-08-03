import { useEffect, useState } from "react";
import { Landmark, QrCode } from "lucide-react";
import { bankTransferLines, payNowConfigured, payNowQrDataUrl } from "@/lib/paynow";
import type { Company } from "@/lib/types";

/** Manual payment instructions (PayNow QR + bank transfer) shown on an invoice. */
export function PayInvoicePanel({
  company,
  amount,
  reference,
}: {
  company?: Company;
  amount: number;
  reference: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const bank = bankTransferLines(company);
  const hasQr = payNowConfigured(company);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const url = company ? await payNowQrDataUrl(company, { amount, reference, width: 320 }) : null;
      if (!cancelled) setQr(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [company, amount, reference]);

  if (!hasQr && !bank.length && !company?.paymentInstructions) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        No payment details configured yet — add PayNow / bank details in Settings → Payments and they
        will appear here and on the invoice PDF.
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-background/60 p-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          How to pay
        </div>
        {hasQr && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">PayNow</p>
            <p>Scan the QR with any Singapore banking app.</p>
            <p>
              Reference: <span className="font-medium text-foreground">{reference}</span>
            </p>
          </div>
        )}
        {!!bank.length && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Bank transfer</p>
            {bank.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        )}
        {company?.paymentInstructions && (
          <p className="text-xs text-muted-foreground">{company.paymentInstructions}</p>
        )}
      </div>
      {qr && (
        <div className="w-full max-w-[160px] space-y-1">
          <img src={qr} alt="PayNow QR" className="w-full rounded-md bg-white p-2" />
          <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <QrCode className="h-3 w-3" /> PayNow QR
          </p>
        </div>
      )}
    </div>
  );
}
