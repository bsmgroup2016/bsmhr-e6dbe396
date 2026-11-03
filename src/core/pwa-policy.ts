export const PWA_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function isPwaPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ((host.endsWith(".lovable.app") || host.endsWith(".gpt-eng.com") || host.endsWith(".gptengineer.run")) &&
    (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(host.split(".")[0]) || /^project--.+-dev$/.test(host.split(".")[0]))) ||
    ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function startPwaUpdateChecks(registration: { update: () => Promise<unknown> }, online: () => boolean,
  schedule: (callback: () => void, interval: number) => ReturnType<typeof setInterval> = setInterval) {
  return schedule(() => { if (online()) void registration.update().catch(() => undefined); }, PWA_UPDATE_INTERVAL_MS);
}