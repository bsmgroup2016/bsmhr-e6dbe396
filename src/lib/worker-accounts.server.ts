import { workerLoginEmail, workerUsername } from "@/core/worker-login";

type Worker = { id: string; name: string; email: string | null; phone: string | null; user_id: string | null };
const URL = "https://supabase.bsmengg.com";

function headers() {
  const key = process.env["SB_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Worker account service is unavailable");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${URL}/${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!response.ok) throw new Error("Worker account operation failed. Retry from Worker App accounts.");
  return response;
}

async function rows<T>(path: string, init?: RequestInit): Promise<T[]> {
  const response = await request(`rest/v1/${path}`, init);
  const text = await response.text();
  return text ? JSON.parse(text) as T[] : [];
}

export function temporaryWorkerPassword(): string {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$"];
  const alphabet = groups.join("");
  const randomIndex = (length: number) => {
    const limit = 256 - (256 % length);
    let value: number;
    do { value = crypto.getRandomValues(new Uint8Array(1))[0]; } while (value >= limit);
    return value % length;
  };
  const characters = groups.map(group => group[randomIndex(group.length)]);
  while (characters.length < 8) characters.push(alphabet[randomIndex(alphabet.length)]);
  for (let index = characters.length - 1; index > 0; index--) {
    const target = randomIndex(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters.join("");
}

async function availableUsername(worker: Pick<Worker, "id" | "name">, ownUserId?: string): Promise<string> {
  for (let suffix = 1; suffix <= 1000; suffix++) {
    const username = workerUsername(worker.name, suffix);
    const email = workerLoginEmail(username);
    const matches = await rows<{ id: string }>(`profiles?select=id&or=(username.eq.${encodeURIComponent(username)},email.eq.${encodeURIComponent(email)})&limit=2`);
    if (!matches.length || matches.every(profile => profile.id === ownUserId)) return username;
    if (!ownUserId && matches.length === 1) {
      const account = await (await request(`auth/v1/admin/users/${matches[0].id}`)).json() as { user_metadata?: { worker_employee_id?: string } };
      if (account.user_metadata?.worker_employee_id === worker.id) return username;
    }
  }
  throw new Error("Could not allocate a unique worker login name");
}

/** Caller must already have passed role and employee-row access checks. */
export async function ensureWorkerAccount(employeeId: string) {
  const [worker] = await rows<Worker>(`employees?select=id,name,email,phone,user_id&id=eq.${employeeId}&limit=1`);
  if (!worker) throw new Error("Worker not found");
  if (worker.user_id) return { employeeId, userId: worker.user_id, created: false };
  const username = await availableUsername(worker);
  // A dedicated login alias avoids silently taking over an existing office/email account.
  const email = workerLoginEmail(username);
  const password = temporaryWorkerPassword();
  let createdId: string | null = null;
  const response = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: worker.name, worker_employee_id: employeeId, username } }),
  });
  if (response.ok) {
    const created = await response.json() as { id: string };
    createdId = created.id;
  } else {
    // Retries recover only accounts marked for this exact employee, never by name/email alone.
    if (![400, 422].includes(response.status)) throw new Error("Could not create worker login");
    const [profile] = await rows<{ id: string }>(`profiles?select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
    if (!profile) throw new Error("Could not create worker login");
    const account = await (await request(`auth/v1/admin/users/${profile.id}`)).json() as { user_metadata?: { worker_employee_id?: string } };
    if (account.user_metadata?.worker_employee_id !== employeeId) throw new Error("Login identifier is already in use");
    createdId = profile.id;
  }
  await rows("profiles?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: createdId, email, username, full_name: worker.name, phone: worker.phone, is_active: true }) });
  await rows("user_roles?on_conflict=user_id,role", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ user_id: createdId, role: "employee" }) });
  const linked = await rows<Worker>(`employees?id=eq.${employeeId}&user_id=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: createdId }) });
  if (!linked.length) {
    const [current] = await rows<Worker>(`employees?select=user_id&id=eq.${employeeId}`);
    if (current?.user_id !== createdId) throw new Error("Worker login link changed. Refresh the account list.");
  }
  // Passwords are not stored in profiles or returned by automatic provisioning.
  return { employeeId, userId: createdId, username, created: response.ok };
}

export async function resetWorkerPassword(employeeId: string) {
  const [worker] = await rows<Worker>(`employees?select=id,name,user_id&id=eq.${employeeId}&limit=1`);
  if (!worker?.user_id) throw new Error("Create the worker account first");
  const [profile] = await rows<{ username: string; email: string }>(`profiles?select=username,email&id=eq.${worker.user_id}&limit=1`);
  if (!profile) throw new Error("Worker account not found");
  const password = temporaryWorkerPassword();
  // Shorten only app-generated aliases; do not replace manually assigned real-email logins.
  const generated = profile.email.endsWith("@workers.hrbsm.xyz");
  const username = generated ? await availableUsername(worker, worker.user_id) : profile.username || profile.email;
  const email = generated ? workerLoginEmail(username) : profile.email;
  await request(`auth/v1/admin/users/${worker.user_id}`, { method: "PUT", body: JSON.stringify({ password, ...(generated ? { email, email_confirm: true } : {}) }) });
  if (generated) await rows(`profiles?id=eq.${worker.user_id}`, { method: "PATCH", body: JSON.stringify({ username, email }) });
  return { name: worker.name, username, password };
}