import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const AUDIT_PAGE_SIZE = 100;
export type AuditFilters = { page: number; action: string; entity: string; from: string; to: string };
export type LogRow = { id: string; action: string; entity_type: string; entity_id: string | null; user_name: string | null; details: unknown; created_at: string };

export function auditPageRange(page: number): [number, number] {
  const start = Math.max(0, Math.floor(page)) * AUDIT_PAGE_SIZE;
  return [start, start + AUDIT_PAGE_SIZE - 1];
}

export function auditLogsQueryOptions(filters: AuditFilters) {
  return queryOptions({
    queryKey: ["audit-log-page", filters],
    queryFn: async () => {
      const columns: string = "id,action,entity_type,entity_id,user_name,details,created_at";
      let query = supabase.from("audit_logs").select(columns, { count: "exact" })
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(...auditPageRange(filters.page));
      if (filters.action !== "all") query = query.eq("action", filters.action);
      if (filters.entity !== "all") query = query.eq("entity_type", filters.entity);
      if (filters.from) query = query.gte("created_at", new Date(`${filters.from}T00:00:00`).toISOString());
      if (filters.to) query = query.lte("created_at", new Date(`${filters.to}T23:59:59`).toISOString());
      const { data, error, count } = await query.returns<LogRow[]>();
      if (error || count === null) throw new Error("Could not load audit logs.");
      return { rows: data ?? [], total: count };
    },
    staleTime: 0,
  });
}