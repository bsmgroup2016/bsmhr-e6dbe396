export interface CardLocation {
  workerName?: string;
  employeeCode?: string;
  fin?: string;
  projectId?: string;
  projectName?: string;
  siteId?: string;
  siteName?: string;
}

type LocationLookups = {
  projects?: { id: string; name: string; code?: string }[];
  sites?: { id: string; name: string; code?: string }[];
};

const normalize = (value?: string) => (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

/** Require site information when requested; differing sites never block a batch. */
export function projectBatchIssue(locations: CardLocation[], lookups: LocationLookups = {}, requireSite = false): string | null {
  if (requireSite) {
    const items = lookups.sites ?? [];
    for (const location of locations) {
      const id = location.siteId;
      const name = location.siteName;
      const matches = items.filter(item => id ? item.id === id : Boolean(name && [item.name, item.code].some(value => normalize(value) === normalize(name))));
      const item = matches.length === 1 ? matches[0] : undefined;
      const key = item ? `id:${item.id}` : id ? `id:${id}` : normalize(name);
      if (!key) return "Site is missing on a card. Confirm the site before generating the claim sheet.";
    }
  }
  return null;
}