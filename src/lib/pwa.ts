/**
 * Guarded service-worker registration.
 *
 * The service worker only caches the app shell (JS/CSS/fonts/icons) plus an
 * offline fallback page. All business data still comes from the network.
 *
 * It must NEVER register in dev or inside Lovable preview, otherwise stale
 * HTML/chunks get served after a deploy.
 */
import { isPwaPreviewHost, startPwaUpdateChecks } from "@/core/pwa-policy";
import { offerPwaUpdate } from "@/lib/pwa-updates";

const SW_URL = "/sw.js";
let started = false;

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.top !== window.self) return true;

  if (isPwaPreviewHost(window.location.hostname)) return true;

  if (new URLSearchParams(window.location.search).has("sw")) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  }
  return false;
}

async function unregisterAppServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const scriptURL =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          "";
        return scriptURL.endsWith(SW_URL);
      })
      .map((registration) => registration.unregister()),
  );
}

export function setupServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  if (isBlockedContext()) {
    void unregisterAppServiceWorker();
    return;
  }
  if (started) return;
  started = true;

  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      let requestedRefresh = false;
      const update = registerSW({
        immediate: true,
        onNeedRefresh: () => offerPwaUpdate(async () => { requestedRefresh = true; await update(true); }),
        // An update activated from another tab must not reload this tab without consent.
        onNeedReload: () => {
          if (requestedRefresh) window.location.reload();
          else offerPwaUpdate(async () => { window.location.reload(); });
        },
        onRegisteredSW: (_url, registration) => {
          if (registration) startPwaUpdateChecks(registration, () => navigator.onLine);
          // Retire only the previous app's HTML cache; never touch local attendance storage.
          if ("caches" in window) void caches.delete("woms-pages");
        },
      });
    })
    .catch(() => {
      /* offline support is optional; ignore failures */
    });
}