// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Keep the SMTP package in Vite's ESM graph instead of letting Node
    // require its CommonJS entry (which requires cloudflare:sockets).
    // Production must bundle the mailer; only the native socket stays native.
    ssr: { noExternal: ["worker-mailer"] },
    // This is a runtime-provided built-in, not an npm dependency. Preserve
    // its native import in both the SSR and final server bundle; the preview
    // guard prevents loading it in Node. Keep worker-mailer fully bundled.
    build: { rolldownOptions: { external: ["cloudflare:sockets"] } },
    // Pre-bundle UI deps up front so a late dependency discovery can't reload
    // React mid-session (mixed ?v= hashes => "Cannot read properties of null (reading 'useMemo')").
    optimizeDeps: {
      include: [
        "sonner",
        "@radix-ui/react-popover",
        "@radix-ui/react-dialog",
        "@radix-ui/react-tabs",
        "@radix-ui/react-select",
        "@radix-ui/react-alert-dialog",
      ],
    },
    plugins: [
      VitePWA({
        // Shell-only offline support. Registration happens in src/lib/pwa.ts,
        // which refuses to register in dev/preview contexts.
        strategies: "generateSW",
        registerType: "prompt",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          // Client assets land in dist/client; the SW must be served from its root.
          globDirectory: "dist/client",
          swDest: "dist/client/sw.js",
          globPatterns: ["**/*.{js,css,woff,woff2,png,svg,ico}", "offline.html"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          runtimeCaching: [
            {
              // Never cache navigation responses. Only the static offline page is a fallback.
              urlPattern: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" &&
                !/^\/(?:api(?:\/|$)|_serverFn(?:\/|$)|~oauth(?:\/|$))/.test(url.pathname),
              handler: "NetworkOnly",
              options: {
                precacheFallback: { fallbackURL: "/offline.html" },
              },
            },
          ],
        },
      }),
    ],
  },
});
