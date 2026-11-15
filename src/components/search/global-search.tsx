import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Building,
  FileText,
  HardHat,
  MapPin,
  Truck,
  Users,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  getClients,
  getDormitories,
  getEmployees,
  getInvoices,
  getProjects,
  getSites,
  getVehicles,
  ensureStoreCollections,
  subscribe,
} from "@/lib/store";
import { employeeSlug } from "@/lib/employee-slug";
import { Button } from "@/components/ui/button";

export type SearchHit = {
  id: string;
  group: string;
  label: string;
  hint: string;
  to: string;
  icon: React.ReactNode;
};

function useSearchIndex(revision: number): SearchHit[] {
  return useMemo(() => {
    const hits: SearchHit[] = [];
    for (const e of getEmployees()) {
      hits.push({
        id: `emp-${e.id}`,
        group: "Employees",
        label: e.name,
        hint: [e.employeeCode, e.passportNumber, e.fin, e.trade].filter(Boolean).join(" · "),
        to: `/workforce/${employeeSlug(e)}`,
        icon: <Users className="h-4 w-4" />,
      });
    }
    for (const c of getClients()) {
      hits.push({
        id: `cli-${c.id}`,
        group: "Clients",
        label: c.name,
        hint: [c.code, c.contactPerson].filter(Boolean).join(" · "),
        to: "/clients",
        icon: <Building className="h-4 w-4" />,
      });
    }
    for (const p of getProjects()) {
      hits.push({
        id: `prj-${p.id}`,
        group: "Projects",
        label: p.name,
        hint: [p.code, p.location].filter(Boolean).join(" · "),
        to: "/projects",
        icon: <Briefcase className="h-4 w-4" />,
      });
    }
    for (const s of getSites()) {
      hits.push({
        id: `site-${s.id}`,
        group: "Sites",
        label: s.name,
        hint: [s.code, s.location].filter(Boolean).join(" · "),
        to: "/projects",
        icon: <MapPin className="h-4 w-4" />,
      });
    }
    for (const i of getInvoices()) {
      hits.push({
        id: `inv-${i.id}`,
        group: "Invoices",
        label: i.invoiceNo,
        hint: `${i.status} · $${Number(i.total ?? 0).toLocaleString()}`,
        to: "/billing",
        icon: <FileText className="h-4 w-4" />,
      });
    }
    for (const v of getVehicles()) {
      hits.push({
        id: `veh-${v.id}`,
        group: "Vehicles",
        label: v.plateNo,
        hint: [v.type, v.makeModel].filter(Boolean).join(" · "),
        to: "/transport",
        icon: <Truck className="h-4 w-4" />,
      });
    }
    for (const d of getDormitories()) {
      hits.push({
        id: `dorm-${d.id}`,
        group: "Dormitories",
        label: d.name,
        hint: d.address ?? "",
        to: "/accommodation",
        icon: <HardHat className="h-4 w-4" />,
      });
    }
    return hits;
  }, [revision]);
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => subscribe(() => setRevision((value) => value + 1)), []);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadError("");
    setLoading(true);
    void ensureStoreCollections(["employees", "clients", "projects", "sites", "invoices", "vehicles", "dormitories", "assignments"])
      .catch((error: Error) => { if (alive) setLoadError(error.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, attempt]);
  const index = useSearchIndex(revision);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qc = q.replace(/[^a-z0-9]/g, "");
    const pool = q
      ? index.filter(
          (h) =>
            h.label.toLowerCase().includes(q) ||
            h.hint.toLowerCase().includes(q) ||
            (qc.length > 1 && h.hint.toLowerCase().replace(/[^a-z0-9]/g, "").includes(qc)),
        )
      : index;
    const grouped = new Map<string, SearchHit[]>();
    for (const hit of pool.slice(0, 200)) {
      const list = grouped.get(hit.group) ?? [];
      if (list.length < 6) list.push(hit);
      grouped.set(hit.group, list);
    }
    return [...grouped.entries()];
  }, [index, query]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search employees, clients, projects, invoices..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && <div role="status" className="px-4 py-3 text-sm text-muted-foreground">Loading records…</div>}
        {loadError && <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-destructive"><span>Search records could not load.</span><Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>}
        <CommandEmpty>{loading ? "Searching…" : loadError ? "Results may be incomplete." : "No matches found."}</CommandEmpty>
        {results.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((hit) => (
              <CommandItem
                key={hit.id}
                value={`${hit.label} ${hit.hint} ${hit.group}`}
                onSelect={() => {
                  onOpenChange(false);
                  setQuery("");
                  void navigate({ to: hit.to });
                }}
                className="gap-2"
              >
                <span className="text-muted-foreground">{hit.icon}</span>
                <span className="flex-1 truncate">{hit.label}</span>
                <span className="truncate text-xs text-muted-foreground">{hit.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function useGlobalSearchHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpen]);
}
