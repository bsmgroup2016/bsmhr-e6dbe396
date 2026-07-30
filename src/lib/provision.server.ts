/** Server-only helpers to provision a self-signed-up employee record. */

const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";

function serviceKey() {
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service key missing");
  return key;
}

function headers() {
  const key = serviceKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function rest<T = any>(path: string, init?: RequestInit): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T[]) : [];
}

/** Sequence part is always zero padded to 2 digits — V-01, BS-01, P-01. */
const CODE_PAD = 2;

/** Next sequential P-File Number for a branch prefix (V-01, V-02 …). */
async function nextCode(prefix: string): Promise<string> {
  const rows = await rest<{ employee_code: string }>(
    `employees?select=employee_code&employee_code=like.${encodeURIComponent(`${prefix}%`)}`,
  );
  const re = new RegExp(`^${prefix}[^a-z0-9]*(\\d+)$`, "i");
  let max = 0;
  for (const r of rows) {
    const m = re.exec((r.employee_code ?? "").trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  const p = prefix.toUpperCase();
  return `${p}-${String(max + 1).padStart(CODE_PAD[p] ?? 2, "0")}`;
}

export type ProvisionResult = {
  employeeId: string;
  employeeCode: string;
  created: boolean;
};

/**
 * Idempotently link an auth user to an employees row with
 * status "Pending Profile Completion" and grant the `employee` role.
 */
export async function provisionEmployee(
  userId: string,
  email: string,
  phone: string,
  emailVerified = false,
): Promise<ProvisionResult> {
  const existing = await rest<{ id: string; employee_code: string }>(
    `employees?select=id,employee_code&user_id=eq.${userId}&limit=1`,
  );
  if (existing.length) {
    await grantEmployeeRole(userId);
    return { employeeId: existing[0].id, employeeCode: existing[0].employee_code, created: false };
  }

  // Adopt a pre-existing record created by HR with the same email, but only
  // when Supabase has confirmed the caller actually owns that email address.
  const byEmail = email && emailVerified
    ? await rest<{ id: string; employee_code: string }>(
        `employees?select=id,employee_code&email=eq.${encodeURIComponent(email)}&user_id=is.null&limit=1`,
      )
    : [];
  if (byEmail.length) {
    await rest(`employees?id=eq.${byEmail[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId, phone: phone || undefined }),
    });
    await grantEmployeeRole(userId);
    return { employeeId: byEmail[0].id, employeeCode: byEmail[0].employee_code, created: false };
  }

  const prefixes = await rest<{ code: string }>(
    `branch_prefixes?select=code&code=eq.X&limit=1`,
  );
  const prefix = prefixes[0]?.code ?? "X";
  const employee_code = await nextCode(prefix);

  const inserted = await rest<{ id: string; employee_code: string }>("employees", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      employee_code,
      name: email ? email.split("@")[0] : employee_code,
      email: email || null,
      phone: phone || null,
      user_id: userId,
      status: "Pending Profile Completion",
      branch: "Unassigned",
    }),
  });
  await grantEmployeeRole(userId);
  return {
    employeeId: inserted[0]?.id ?? "",
    employeeCode: inserted[0]?.employee_code ?? employee_code,
    created: true,
  };
}

async function grantEmployeeRole(userId: string) {
  const roles = await rest<{ role: string }>(
    `user_roles?select=role&user_id=eq.${userId}`,
  );
  if (roles.length) return;
  await rest("user_roles", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ user_id: userId, role: "employee" }),
  });
}

/** Validate a Supabase access token and return { id, email } or null. */
export async function verifyToken(
  request: Request,
): Promise<{ id: string; email: string; emailVerified: boolean } | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || serviceKey();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: key, Authorization: auth },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as {
    id?: string;
    email?: string;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
  };
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
  };
}