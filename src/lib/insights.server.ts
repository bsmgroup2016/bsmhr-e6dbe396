/**
 * Live workforce insights computed with the CALLER's session (row-level security applies):
 * expiries (passport, work permit, documents, other certs) and today's project attendance shortfalls.
 * Used by the assistant tool and by the staff popup alerts.
 */
const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";

async function get<T = Record<string, unknown>>(path: string, auth: string, anon: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: anon, Authorization: auth } });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

/** Singapore calendar date, offset by `days`. */
export function sgDate(days = 0) {
  return new Date(Date.now() + 8 * 3600e3 + days * 864e5).toISOString().slice(0, 10);
}

export type Insight = { id: string; severity: "critical" | "warning" | "info"; title: string; detail: string; names?: string[] };

type Emp = Record<string, string | null> & { id: string; name: string; employee_code: string | null };

const EXPIRY_FIELDS: [string, string][] = [
  ["passport_expiry", "Passport"],
  ["work_permit_expiry_date", "Work permit"],
  ["pass_expiry", "Work pass"],
  ["medical_insurance_expiry", "Medical insurance"],
  ["security_bond_expiry", "Security bond"],
  ["safety_course_expiry", "Safety course"],
  ["skill_cert_expiry", "Skill certificate"],
];

export async function computeInsights(auth: string, anon: string, withinDays = 30): Promise<{ date: string; insights: Insight[] }> {
  const today = sgDate();
  const until = sgDate(withinDays);
  const insights: Insight[] = [];
  const label = (e: Emp) => `${e.name}${e.employee_code ? ` (${e.employee_code})` : ""}`;

  const emps = await get<Emp>(
    `employees?select=id,name,employee_code,status,${EXPIRY_FIELDS.map((f) => f[0]).join(",")}&status=in.(Active,Deployed,On%20Leave)&limit=2000`,
    auth,
    anon,
  );
  const byId = new Map(emps.map((e) => [e.id, e]));

  for (const [field, name] of EXPIRY_FIELDS) {
    const expired = emps.filter((e) => e[field] && e[field]! < today);
    const soon = emps.filter((e) => e[field] && e[field]! >= today && e[field]! <= until);
    if (expired.length)
      insights.push({ id: `${field}-expired-${today}`, severity: "critical", title: `${expired.length} ${name.toLowerCase()} expired`, detail: `${name} already expired for active workers.`, names: expired.slice(0, 15).map(label) });
    if (soon.length)
      insights.push({ id: `${field}-soon-${today}`, severity: "warning", title: `${soon.length} ${name.toLowerCase()} expiring in ${withinDays} days`, detail: `Renew before ${until}.`, names: soon.slice(0, 15).map((e) => `${label(e)} – ${e[field]}`) });
  }

  const docs = await get<{ employee_id: string; doc_type: string | null; name: string | null; expiry_date: string }>(
    `employee_documents?select=employee_id,doc_type,name,expiry_date&expiry_date=lte.${until}&limit=2000`,
    auth,
    anon,
  );
  const activeDocs = docs.filter((d) => byId.has(d.employee_id));
  const dExpired = activeDocs.filter((d) => d.expiry_date < today);
  const dSoon = activeDocs.filter((d) => d.expiry_date >= today);
  const docLabel = (d: (typeof docs)[number]) => `${byId.get(d.employee_id)?.name ?? "?"} – ${d.doc_type || d.name || "document"} ${d.expiry_date}`;
  if (dExpired.length) insights.push({ id: `docs-expired-${today}`, severity: "critical", title: `${dExpired.length} documents expired`, detail: "Uploaded worker documents past their expiry date.", names: dExpired.slice(0, 15).map(docLabel) });
  if (dSoon.length) insights.push({ id: `docs-soon-${today}`, severity: "warning", title: `${dSoon.length} documents expiring in ${withinDays} days`, detail: `Renew before ${until}.`, names: dSoon.slice(0, 15).map(docLabel) });

  // Today's attendance vs. active project assignments.
  const [asg, att, projects] = await Promise.all([
    get<{ employee_id: string; project_id: string | null; start_date: string | null; end_date: string | null }>(
      `assignments?select=employee_id,project_id,start_date,end_date&status=in.(Active,Approved)&limit=5000`, auth, anon),
    get<{ employee_id: string; status: string }>(`attendance?select=employee_id,status&date=eq.${today}&limit=5000`, auth, anon),
    get<{ id: string; name: string; code: string | null }>(`projects?select=id,name,code&limit=1000`, auth, anon),
  ]);
  const attBy = new Map(att.map((a) => [a.employee_id, a.status]));
  const projName = new Map(projects.map((p) => [p.id, p.code ? `${p.name} (${p.code})` : p.name]));
  const perProject = new Map<string, string[]>();
  for (const a of asg) {
    if (!a.project_id || (a.start_date && a.start_date > today) || (a.end_date && a.end_date < today)) continue;
    perProject.set(a.project_id, [...(perProject.get(a.project_id) ?? []), a.employee_id]);
  }
  let totalAbsent = 0;
  if (att.length > 0) {
    for (const [pid, ids] of perProject) {
      const present = ids.filter((id) => attBy.get(id) === "Present").length;
      const missing = ids.filter((id) => attBy.get(id) !== "Present" && attBy.get(id) !== "On Leave");
      totalAbsent += missing.length;
      if (missing.length)
        insights.push({
          id: `att-${pid}-${today}-${present}`,
          severity: "warning",
          title: `${projName.get(pid) ?? "Project"}: ${present} of ${ids.length} workers present`,
          detail: `${missing.length} expected worker(s) have no attendance or are absent today.`,
          names: missing.slice(0, 15).map((id) => (byId.get(id) ? label(byId.get(id)!) : id)),
        });
    }
  }
  const absentMarked = att.filter((a) => a.status === "Absent").length;
  if (absentMarked) insights.push({ id: `absent-${today}-${absentMarked}`, severity: "info", title: `${absentMarked} workers marked absent today`, detail: "From today's attendance records." });
  if (att.length === 0 && perProject.size) insights.push({ id: `no-att-${today}`, severity: "info", title: "No attendance recorded yet today", detail: `${[...perProject.values()].flat().length} workers are assigned to projects.` });
  void totalAbsent;
  return { date: today, insights };
}

/** Find a worker the caller can see and return links to their P-File and documents. */
export async function findWorkerFiles(query: string, auth: string, anon: string) {
  const q = query.trim().replace(/[(),*]/g, " ").slice(0, 60);
  if (!q) return { error: "Give a worker name or P-File number" };
  const enc = encodeURIComponent(`*${q}*`);
  const emps = await get<{ id: string; name: string; employee_code: string | null; p_file_url: string | null; photo_url: string | null; ipa_document_url: string | null }>(
    `employees?select=id,name,employee_code,p_file_url,photo_url,ipa_document_url&or=(name.ilike.${enc},employee_code.ilike.${enc},fin.ilike.${enc})&limit=5`,
    auth,
    anon,
  );
  if (!emps.length) return { error: "No worker found (or you do not have access)." };
  const out = [];
  for (const e of emps) {
    const docs = await get<{ name: string | null; doc_type: string | null; file_key: string | null; file_url: string | null; expiry_date: string | null }>(
      `employee_documents?select=name,doc_type,file_key,file_url,expiry_date&employee_id=eq.${e.id}&limit=50`,
      auth,
      anon,
    );
    out.push({ employee: e, docs });
  }
  return { matches: out };
}
