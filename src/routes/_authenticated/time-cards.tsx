import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, ScanLine, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/time-cards")({
  head: () => ({
    meta: [
      { title: "ClaimSheet Generator — BSM Workforce" },
      { name: "description", content: "Upload time cards and generate project claim sheets." },
      { property: "og:title", content: "ClaimSheet Generator — BSM Workforce" },
      { property: "og:description", content: "Time card upload and claim sheet generation for site workers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimeCardsPage,
});

// Section was reset at the owner's request: UI only, no processing until rebuilt.
const notReady = () => toast.message("ClaimSheet Generator is being rebuilt. This step is not available yet.");

function TimeCardsPage() {
  const steps = ["Upload time cards", "Check OCR results", "Generate claim sheet"];
  return (
    <AppShell>
      <div className="w-full space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">ClaimSheet Generator</h1>
        <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Generate Claim Sheet</h2>
          </div>
          <ol className="grid gap-2 sm:grid-cols-3">
            {steps.map((label, i) => (
              <li key={label} className={`flex min-w-0 items-center gap-3 rounded-lg border p-3 ${i === 0 ? "border-primary bg-primary/10" : "border-border"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                <span className={`truncate text-sm font-medium ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </li>
            ))}
          </ol>
          <div onClick={notReady} className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 text-center hover:bg-primary/10">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground"><Upload className="h-6 w-6" /></span>
            <Button type="button" variant="outline"><Upload aria-hidden="true" />Choose time cards</Button>
            <span className="text-base font-semibold text-foreground">Click or drag time cards here</span>
            <span className="text-sm text-muted-foreground">PDF or photos · select many at once</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className="text-sm text-muted-foreground">0/0 cards approved</span>
            <Button disabled className="gap-2"><FileSpreadsheet className="h-4 w-4" />Generate claim sheet</Button>
          </div>
        </section>

        <Tabs defaultValue="sheets">
          <TabsList>
            <TabsTrigger value="sheets">Claim sheets</TabsTrigger>
            <TabsTrigger value="cards">Time cards</TabsTrigger>
          </TabsList>
          <TabsContent value="sheets" className="mt-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Input aria-label="Claim sheets month" type="month" defaultValue={new Date().toISOString().slice(0, 7)} className="w-44" />
              <span className="text-sm text-muted-foreground">0 worker claim(s)</span>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead>Days</TableHead><TableHead>Normal hrs</TableHead><TableHead>OT hrs</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody><TableRow><TableCell colSpan={7} className="h-32 text-center"><EmptyState className="border-0 bg-transparent" icon={<FileSpreadsheet className="h-5 w-5" />} title="No claim sheets" /></TableCell></TableRow></TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="cards" className="mt-4">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead>File</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody><TableRow><TableCell colSpan={5} className="h-32 text-center"><EmptyState className="border-0 bg-transparent" icon={<ScanLine className="h-5 w-5" />} title="No time cards" /></TableCell></TableRow></TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
