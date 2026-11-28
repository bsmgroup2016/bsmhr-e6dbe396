import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

/** Bundle worker-mailer against a lazy adapter, so Node never loads native sockets. */
export function smtpNativeImportPlugin() {
  const bridge = "\0smtp-socket-bridge";
  const adapter = fileURLToPath(new URL("../lib/smtp-adapter.server.ts", import.meta.url));
  const mailer = createRequire(import.meta.url).resolve("worker-mailer").replace(/\.js$/, ".mjs");
  return {
    name: "smtp-native-socket-import",
    enforce: "pre" as const,
    resolveId(id: string) {
      if (id === "worker-mailer") return mailer;
      return id === "cloudflare:sockets" ? bridge : null;
    },
    load(id: string) {
      return id === bridge
        ? `import { getWorkerConnect } from ${JSON.stringify(adapter)}; export function connect(...args) { return getWorkerConnect()(...args); }`
        : null;
    },
  };
}