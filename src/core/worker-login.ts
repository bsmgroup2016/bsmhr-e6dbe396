/** Name-based login IDs retain a full employee UUID to avoid duplicate-name collisions. */
export function workerUsername(name: string, employeeId: string): string {
  const parts = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const firstLast = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] ?? "worker";
  return `${firstLast.slice(0, 22)}.${employeeId.replaceAll("-", "")}`;
}

export function workerLoginEmail(username: string): string {
  return `${username.toLowerCase()}@workers.hrbsm.xyz`;
}

export function loginEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  return value.includes("@") ? value : workerLoginEmail(value);
}