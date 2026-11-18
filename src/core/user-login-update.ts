import { workerLoginEmail } from "./worker-login";

/** Worker alias credentials follow Username even when a form resends its old Email. */
export function userLoginUpdate(currentEmail: string, input: { username?: string | null; email?: string }) {
  if (currentEmail.toLowerCase().endsWith("@workers.hrbsm.xyz") && input.username != null) {
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,58}[a-z0-9]$/.test(username)) {
      throw new Error("Username must be 2–60 characters using letters, numbers, dot, dash or underscore");
    }
    return { email: workerLoginEmail(username), username };
  }
  return { email: input.email?.trim().toLowerCase(), username: input.username };
}