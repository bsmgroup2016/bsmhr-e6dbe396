import { supabase } from "@/integrations/supabase/client";

async function call(payload: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/public/user-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json;
}

export function recordLogin() {
  return call({ action: "record-login" }).catch(() => undefined);
}

export function createUser(input: {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  role?: string;
}) {
  return call({ action: "create", ...input });
}

export function updateUser(input: { id: string; fullName?: string; phone?: string }) {
  return call({ action: "update", ...input });
}

export function deleteUsers(ids: string[]) {
  return call({ action: "delete", ids });
}
