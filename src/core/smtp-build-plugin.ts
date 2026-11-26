/** Native runtime import; npm packages must still be bundled. */
export function smtpNativeImportPlugin() {
  return {
    name: "smtp-native-socket-import",
    enforce: "pre" as const,
    resolveId(id: string) {
      return id === "cloudflare:sockets" ? { id, external: true } : null;
    },
  };
}