export interface CardLocation {
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

/** Compare every printed location; missing text never inherits another worker's site. */
export function projectBatchIssue(locations: CardLocation[], lookups: LocationLookups = {}, requireSite = false): string | null {
  for (const kind of ["project", "site"] as const) {
    const items = kind === "project" ? lookups.projects ?? [] : lookups.sites ?? [];
    const found = new Map<string, string>();
    for (const location of locations) {
      const id = kind === "project" ? location.projectId : location.siteId;
      const name = kind === "project" ? location.projectName : location.siteName;
      const matches = items.filter(item => id ? item.id === id : Boolean(name && [item.name, item.code].some(value => normalize(value) === normalize(name))));
      const item = matches.length === 1 ? matches[0] : undefined;
      const key = item ? `id:${item.id}` : id ? `id:${id}` : normalize(name);
      if (kind === "site" && requireSite && !key) return "Site is missing on a card. Confirm the site before generating the claim sheet.";
      if (key) found.set(key, name?.trim() || item?.name || id || "Unknown");
    }
    if (found.size > 1) return `Mixed ${kind}s detected: ${[...found.values()].join(" · ")}. Correct the cards and re-upload the complete batch for one project/site. Claim generation is blocked.`;
  }
  return null;
}