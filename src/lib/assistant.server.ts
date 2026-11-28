/**
 * In-app AI Assistant — uses its OWN keys, separate from OCR/automation.
 * Fallback chain: Gemini key 1 → Gemini key 2 → Groq → OpenRouter.
 * Data access runs through the caller's own session (row-level security),
 * so the assistant can only see what the signed-in user can see.
 */
const SUPABASE_URL = "https://supabase.bsmengg.com";

export const ASSISTANT_TABLES = [
  "employees", "companies", "clients", "projects", "sites", "assignments", "attendance",
  "payroll_entries", "leave_requests", "medical_claims", "employee_documents", "employee_certifications",
  "employee_loans", "loan_repayments", "approvals", "invoices", "payment_receipts", "expenses",
  "quotations", "client_contracts", "rate_agreements",
  "dormitories", "bed_allocations",
  "vehicles", "trips", "driver_profiles", "driver_fuel_logs", "driver_incidents",
  "assets", "asset_issuances", "inventory_items", "stock_movements", "purchase_orders",
  "training_courses", "training_records", "safety_incidents", "job_requisitions", "candidates",
  "leads", "crm_activities", "time_cards", "claim_sheets", "departments", "designations", "audit_logs",
] as const;

import { activeProviders } from "./api-integrations.server";
import { chatbotCompletion, type ChatCompletion } from "./chatbot-provider.server";
import { HR_BRAIN_BASE_URL, HR_BRAIN_MODEL } from "@/core/hr-brain";

/** Optional engine: admins can route a message through AI Brain instead of the default provider chain. */
export type AssistantEngine = "default" | "hr-brain";

async function hrBrainCompletion(body: Record<string, unknown>): Promise<{ completion: ChatCompletion; provider: { name: string } }> {
  const apiKey = process.env.HR_BRAIN_API_KEY;
  if (!apiKey) throw new Error("AI Brain is not configured (HR_BRAIN_API_KEY secret is missing).");
  const res = await fetch(`${HR_BRAIN_BASE_URL}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: HR_BRAIN_MODEL, stream: false, ...body }),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`AI Brain: HTTP ${res.status}`);
  }
  const completion = (await res.json()) as ChatCompletion;
  const message = completion.choices?.[0]?.message;
  if (!message?.content?.trim() && !message?.tool_calls?.length) throw new Error("AI Brain: empty reply");
  return { completion, provider: { name: "AI Brain" } };
}

/** Chatbot providers come from Settings → API Integration (fallback order, on/off, keys). */
async function providers() {
  return activeProviders("chatbot");
}

export async function assistantStatus() {
  return (await providers()).map((p) => ({ name: p.name, model: p.model }));
}

const tools = [
  {
    type: "function",
    function: {
      name: "query_table",
      description: "Read rows from one table of the HR system. Use filters to narrow results. Call describe_table first if unsure of column names.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", enum: ASSISTANT_TABLES },
          select: { type: "string", description: "Comma-separated columns, or * (default)." },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                op: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is"] },
                value: { type: "string" },
              },
              required: ["column", "op", "value"],
            },
          },
          order: { type: "string", description: "column.asc or column.desc" },
          limit: { type: "number", description: "Max 200, default 50" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_rows",
      description: "Count rows in a table, optionally filtered. Use for 'how many' questions.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", enum: ASSISTANT_TABLES },
          filters: { type: "array", items: { type: "object", properties: { column: { type: "string" }, op: { type: "string" }, value: { type: "string" } }, required: ["column", "op", "value"] } },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "describe_table",
      description: "Return the column names of a table (from one sample row).",
      parameters: { type: "object", properties: { table: { type: "string", enum: ASSISTANT_TABLES } }, required: ["table"] },
    },
  },
  {
    type: "function",
    function: {
      name: "workforce_alerts",
      description: "Live check of everything that needs attention: expired / expiring passports, work permits, passes, insurance, bonds, courses, certificates and uploaded documents, plus today's attendance per project (expected vs present) and absences. Use for questions like 'what is expiring', 'who is absent', 'any problems today'.",
      parameters: { type: "object", properties: { within_days: { type: "number", description: "Expiry look-ahead window, default 30" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_worker_files",
      description: "Create secure download links (valid 1 hour) for a worker's P-File and uploaded documents (passport, work permit, certificates...). Search by worker name, P-File number or FIN. Always give the user the links as markdown links.",
      parameters: {
        type: "object",
        properties: {
          worker: { type: "string", description: "Worker name, P-File number (employee_code) or FIN" },
          document: { type: "string", description: "Optional: only documents whose type/name contains this, e.g. 'passport'. Use 'pfile' for P-File only." },
        },
        required: ["worker"],
      },
    },
  },
];

async function workerFiles(args: Record<string, unknown>, auth: string, anon: string, userId?: string) {
  if (!userId) return { error: "Not available here" };
  const { findWorkerFiles } = await import("./insights.server");
  const { canAccessKey, keyFromRef, presignGet } = await import("./r2.server");
  const found = await findWorkerFiles(String(args.worker ?? ""), auth, anon);
  if ("error" in found) return found;
  const want = String(args.document ?? "").toLowerCase().trim();
  const link = async (ref: string | null | undefined) => {
    const key = keyFromRef(ref ?? "");
    if (!key) return null;
    if (!(await canAccessKey(userId, key))) return "no access";
    try { return await presignGet(key, 3600); } catch { return null; }
  };
  const results = [];
  for (const m of found.matches) {
    const files: { name: string; expiry?: string | null; url: string | null }[] = [];
    if (!want || want.includes("pfile") || want.includes("p-file") || want.includes("p file"))
      files.push({ name: "P-File", url: await link(m.employee.p_file_url) });
    if (want !== "pfile")
      for (const d of m.docs) {
        const n = `${d.doc_type ?? ""} ${d.name ?? ""}`.trim();
        if (want && !want.includes("pfile") && !n.toLowerCase().includes(want)) continue;
        files.push({ name: n || "Document", expiry: d.expiry_date, url: await link(d.file_key || d.file_url) });
      }
    results.push({ worker: m.employee.name, pfile_number: m.employee.employee_code, files: files.map((f) => ({ ...f, url: f.url ?? "not uploaded" })) });
  }
  return { results, note: "Links expire in 1 hour." };
}

type Filter = { column: string; op: string; value: string };
const safeIdent = (s: string) => /^[a-zA-Z0-9_]+$/.test(s);

async function rest(path: string, auth: string, anon: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: anon, Authorization: auth, ...headers } });
  const text = await res.text();
  if (!res.ok) return { error: text.slice(0, 300) };
  return { res, text };
}

function buildQuery(table: string, filters: Filter[] = []) {
  if (!(ASSISTANT_TABLES as readonly string[]).includes(table)) throw new Error("Unknown table");
  const q = new URLSearchParams();
  for (const f of filters.slice(0, 10)) {
    if (!safeIdent(f.column)) continue;
    const op = ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is"].includes(f.op) ? f.op : "eq";
    const v = op === "ilike" && !String(f.value).includes("*") ? `*${f.value}*` : String(f.value);
    q.append(f.column, `${op}.${v}`);
  }
  return q;
}

async function runTool(name: string, args: Record<string, unknown>, auth: string, anon: string, userId?: string): Promise<unknown> {
  try {
    if (name === "get_worker_files") return await workerFiles(args, auth, anon, userId);
    if (name === "workforce_alerts") {
      const { computeInsights } = await import("./insights.server");
      return await computeInsights(auth, anon, Math.min(180, Math.max(1, Number(args.within_days) || 30)));
    }
    const table = String(args.table ?? "");
    if (!(ASSISTANT_TABLES as readonly string[]).includes(table)) return { error: "This data collection is unavailable." };
    if (name === "describe_table") {
      const r = await rest(`${table}?select=*&limit=1`, auth, anon);
      if ("error" in r) return r;
      const rows = JSON.parse(r.text) as Record<string, unknown>[];
      return { columns: rows[0] ? Object.keys(rows[0]) : [], note: rows[0] ? undefined : "table empty" };
    }
    const q = buildQuery(table, args.filters as Filter[]);
    if (name === "count_rows") {
      q.set("select", "id");
      const r = await rest(`${table}?${q}`, auth, anon, { Prefer: "count=exact", Range: "0-0" });
      if ("error" in r) return r;
      return { count: Number(r.res.headers.get("content-range")?.split("/")[1] ?? 0) };
    }
    const sel = String(args.select || "*").split(",").map((s) => s.trim()).filter((s) => s === "*" || safeIdent(s)).join(",") || "*";
    q.set("select", sel);
    const ord = String(args.order || "");
    if (/^[a-zA-Z0-9_]+\.(asc|desc)$/.test(ord)) q.set("order", ord);
    q.set("limit", String(Math.min(200, Math.max(1, Number(args.limit) || 50))));
    const r = await rest(`${table}?${q}`, auth, anon);
    if ("error" in r) return r;
    const rows = JSON.parse(r.text) as unknown[];
    let data = rows;
    while (data.length > 1 && JSON.stringify(data).length > 40000) data = data.slice(0, Math.floor(data.length / 2));
    return { rows: data, returned: data.length, truncated: data.length < rows.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "tool failed" };
  }
}

const SYSTEM =
  "You are the AI Assistant inside BSM Engineering's Workforce & Operations system (Singapore manpower supply; companies BSM, VRL, Pluto). " +
  "You can read live data with the tools: employees (P-File number, designation, pass type/expiry, levy), deployments/assignments, attendance, payroll (CPF, SDL, FWL), leave, " +
  "clients, projects, quotations, invoices, dormitories, vehicles/drivers, inventory/PPE, training, recruitment and more. " +
  "Always look data up with tools before answering factual questions — never guess numbers. Use count_rows for totals. " +
  "If a column name is unknown, call describe_table. For expiries, absences or attendance shortfalls call workforce_alerts. When someone asks for a worker's P-File or documents, call get_worker_files and reply with the download links.  Amounts are SGD. " +
  "ANSWER STYLE (always follow): Reply in the user's language with a polite, professional HR-officer tone. " +
  "Start with a one-line direct answer in **bold**. Then organise details under short headings (### Heading) using bullet points or a Markdown table for lists of workers, dates or amounts. " +
  "Use clear labels (Name, P-File No., Company, Expiry Date), dates as DD MMM YYYY, money as SGD 1,234.50. " +
  "Keep it short and scannable: no filler, no slang, no emojis, no repeated text, never show raw JSON, table names, column names, IDs or tool names. " +
  "If nothing is found, say so clearly and suggest the next step. End with one short 'Next step' line only when an action is needed.";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export async function runAssistant(messages: ChatMsg[], auth: string, anon: string, userId?: string, options: { engine?: AssistantEngine } = {}) {
  const { knowledgePrompt } = await import("./ai-training.server");
  const useBrain = options.engine === "hr-brain";
  const [list, trained] = await Promise.all([useBrain ? Promise.resolve([]) : providers(), knowledgePrompt()]);
  if (!useBrain && list.length === 0) throw new Error("AI Assistant keys are not set yet");
  const today = new Date().toISOString().slice(0, 10);
  const convo: Record<string, unknown>[] = [{ role: "system", content: `${SYSTEM} Today is ${today}.${trained}` }, ...messages];
  let ordered = list;
  let providerName = "";
      for (let step = 0; step < 8; step++) {
        const result = useBrain
          ? await hrBrainCompletion({ messages: convo, tools, tool_choice: "auto" })
          : await chatbotCompletion(ordered, { messages: convo, tools, tool_choice: "auto" });
        const json = result.completion;
        const p = result.provider;
        providerName = p.name;
        if (!useBrain) {
          const won = p as (typeof list)[number];
          ordered = [won, ...list.filter((candidate) => candidate.id !== won.id)];
        }
        const msg = json.choices?.[0]?.message;
        if (!msg) throw new Error(`${p.name}: empty reply`);
        if (!msg.tool_calls?.length) return { reply: msg.content || "", provider: p.name };
        convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        const results = await Promise.all(msg.tool_calls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
          const result = await runTool(tc.function.name, args, auth, anon, userId);
          return { role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result).slice(0, 40000) };
        }));
        convo.push(...results);
      }
      return { reply: "I needed too many lookups for this question — please narrow it down.", provider: providerName };
}
