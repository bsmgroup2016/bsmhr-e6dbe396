export interface TimeCardIdentity {
  workerName?: string; employeeCode?: string; fin?: string; projectName?: string; siteName?: string;
}
export function canConfirmCardDetails(_workerId: string, month: string, siteName: string): boolean {
  return Boolean(/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && siteName.trim());
}

/** Discard a location only when it repeats an explicitly extracted worker identity. */
export function cardProjectName(identity: TimeCardIdentity): string | undefined {
  const project = normalize(identity.projectName);
  if (project && [identity.workerName, identity.employeeCode, identity.fin].some(value => value && normalize(value) === project)) return undefined;
  return identity.projectName;
}

/** Printed names take precedence; do not infer a demo site from attendance. */
export function claimCardLocation(
  entry: { siteName?: string; siteId?: string; projectName?: string; projectId?: string },
  sites: { id: string; name: string; projectId?: string }[],
  projects: { id: string; name: string }[],
  attendanceSiteId?: string,
) {
  const siteId = entry.siteId ?? (entry.siteName ? undefined : attendanceSiteId);
  const site = sites.find((item) => item.id === siteId);
  const projectId = entry.projectId ?? (entry.siteName || entry.projectName ? undefined : site?.projectId);
  return {
    siteId,
    site: entry.siteName || site?.name,
    projectId,
    projectName: entry.projectName || projects.find((item) => item.id === projectId)?.name,
  };
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