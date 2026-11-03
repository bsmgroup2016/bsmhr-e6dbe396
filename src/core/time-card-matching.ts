export interface TimeCardIdentity {
  workerName?: string; employeeCode?: string; fin?: string; projectName?: string; siteName?: string;
}
const normalize = (value?: string) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export function uniqueCardMatch<T extends { id: string }>(items: T[], value: string | undefined, fields: (item: T) => (string | undefined)[]): string {
  const key = normalize(value);
  if (!key) return "";
  const matches = items.filter((item) => fields(item).some((field) => normalize(field) === key));
  return matches.length === 1 ? matches[0].id : "";
}
export function matchCardWorker<T extends { id: string; employeeCode: string; fin?: string; name: string }>(items: T[], identity: TimeCardIdentity): string {
  // An explicit identifier that does not match must never fall through to a different person's name.
  if (identity.employeeCode) return uniqueCardMatch(items, identity.employeeCode, (item) => [item.employeeCode]);
  if (identity.fin) return uniqueCardMatch(items, identity.fin, (item) => [item.fin]);
  return uniqueCardMatch(items, identity.workerName, (item) => [item.name]);
}