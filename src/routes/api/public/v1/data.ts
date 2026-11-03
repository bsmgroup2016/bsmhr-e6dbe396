import { createFileRoute } from "@tanstack/react-router";
import { TABLE_COLUMNS, UNAVAILABLE_TABLES } from "@/core/data-tables";
import { periodForMonth } from "@/core/data-pagination";
import { fail, listParams, ok, preflight, requireAuth, sbRest } from "@/lib/api-v1.server";

/** Ordinary reads retain the caller's existing RLS; no privileged client. */
export const Route = createFileRoute("/api/public/v1/data")({
  server: { handlers: {
    OPTIONS: preflight,
    GET: async ({ request }) => {
      const auth = await requireAuth(request);
      if ("response" in auth) return auth.response;
      const p = listParams(request);
      const table = p.url.searchParams.get("table") ?? "";
      if (UNAVAILABLE_TABLES.has(table)) return fail(503, "feature_unavailable", `${table.replaceAll("_", " ")} is unavailable: the required table is not present in the connected database.`);
      const columns = TABLE_COLUMNS[table];
      if (!columns) return fail(400, "unknown_collection", "Unknown data collection");
      const q = new URLSearchParams({ select: columns, order: "created_at.desc,id.desc", limit: String(p.limit), offset: String(p.offset) });
      if (table === "attendance") q.set("order", "date.desc,id.desc");
      if (table === "asset_issuances") q.set("order", "issue_date.desc,id.desc");
      // Company filters use actual relationships; these history tables have no company_id.
      if (p.companyId && p.companyId !== "all") {
        if (table === "attendance") {
          q.set("select", `${columns},employees!inner(company_id)`);
          q.set("employees.company_id", `eq.${p.companyId}`);
        } else if (table === "asset_issuances") {
          q.set("select", `${columns},assets!inner(company_id)`);
          q.set("assets.or", `(company_id.eq.${p.companyId},company_id.is.null)`);
        } else if (columns.split(",").includes("company_id")) {
          q.set("or", `(company_id.eq.${p.companyId},company_id.is.null)`);
        }
      }
      let from = p.from, to = p.to;
      const month = p.url.searchParams.get("month");
      if (month) {
        try { ({ from, to } = periodForMonth(month)); }
        catch { return fail(400, "invalid_period", "Month must be YYYY-MM"); }
      }
      if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from) || to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) return fail(400, "invalid_period", "Dates must be YYYY-MM-DD");
      const dateColumn = table === "attendance" ? "date" : table === "asset_issuances" ? "issue_date" : null;
      if (dateColumn && from) q.append(dateColumn, `gte.${from}`);
      if (dateColumn && to) q.append(dateColumn, `lte.${to}`);
      const employee = p.url.searchParams.get("employeeId");
      if (employee && columns.split(",").includes("employee_id")) q.set("employee_id", `eq.${employee}`);
      const ids = p.url.searchParams.get("employeeIds");
      if (ids && columns.split(",").includes("employee_id")) {
        if (!/^[a-f0-9,-]+$/i.test(ids)) return fail(400, "invalid_filter", "Invalid employee filter");
        q.set("employee_id", `in.(${ids})`);
      }
      if (p.status && p.status !== "all" && columns.split(",").includes("status")) q.set("status", `eq.${p.status}`);
      if (table === "attendance" && p.url.searchParams.get("noLocation") === "1") {
        q.set("check_in_lat", "is.null"); q.set("check_out_lat", "is.null");
      }
      if (table === "asset_issuances") {
        if (p.status === "Overdue") { q.set("status", "eq.Issued"); q.set("due_date", `lt.${new Date().toISOString().slice(0, 10)}`); }
        if (p.status === "Unacknowledged") { q.set("status", "eq.Issued"); q.set("acknowledged", "eq.false"); }
        const category = p.url.searchParams.get("category");
        if (category && category !== "all") {
          q.set("select", `${columns},assets!inner(company_id,category)`);
          q.set("assets.category", `eq.${category}`);
        }
      }
      const countOnly = p.url.searchParams.get("countOnly") === "1";
      if (countOnly) { q.set("select", q.get("select")?.includes("!inner") ? q.get("select") ?? "id" : "id"); q.set("limit", "1"); q.set("offset", "0"); }
      const response = await sbRest(auth.ctx, `${table}?${q}`, { prefer: "count=exact", ...(countOnly ? { method: "HEAD" } : {}) });
      if (!response.ok) return fail(502, "data_read_failed", `Could not load ${table.replaceAll("_", " ")}. No cached data was replaced.`);
      const total = Number(response.headers.get("content-range")?.split("/")[1]);
      if (!Number.isFinite(total)) return fail(502, "count_unavailable", "Could not verify the complete record count");
      const rows = countOnly ? [] : await response.json() as Record<string, unknown>[];
      return ok({ rows, total }, { total, limit: p.limit, offset: p.offset, hasMore: p.offset + rows.length < total });
    },
  } },
});