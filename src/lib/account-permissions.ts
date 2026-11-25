import { supabase } from "@/integrations/supabase/client";
import { AUTH_ROLES, type AppAuthRole } from "@/core/access";

type RoleResult = { data: { role: string }[] | null; error: { message: string } | null; status: number };

export async function verifyAccountRoles(
  read: () => PromiseLike<RoleResult>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<AppAuthRole[]> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let result: RoleResult;
    try {
      result = await read();
    } catch {
      if (attempt < 2) { await wait(300 * (attempt + 1)); continue; }
      throw new Error("Could not verify account permissions. Please try again.");
    }
    if (!result.error && result.data !== null) {
      return result.data.map((row) => row.role).filter((role): role is AppAuthRole => AUTH_ROLES.some((known) => known === role));
    }
    const transient = result.status === 0 || result.status === 408 || result.status === 429 || result.status >= 500;
    if (!transient || attempt === 2) throw new Error("Could not verify account permissions. Please try again.");
    await wait(300 * (attempt + 1));
  }
  throw new Error("Could not verify account permissions. Please try again.");
}

export function readAccountRoles(userId: string) {
  return verifyAccountRoles(() => supabase.from("user_roles").select("role").eq("user_id", userId).retry(false));
}