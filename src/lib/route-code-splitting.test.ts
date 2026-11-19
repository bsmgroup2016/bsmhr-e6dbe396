import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

test("permission recovery retains a defined export in the production error chunk", async () => {
  const require = createRequire(import.meta.url);
  const pluginDirectory = dirname(require.resolve("@tanstack/router-plugin"));
  const { compileCodeSplitVirtualRoute } = await import(
    join(pluginDirectory, "../esm/core/code-splitter/compilers.js")
  );
  const filename = new URL("../routes/_authenticated/route.tsx", import.meta.url).pathname;
  const result = compileCodeSplitVirtualRoute({
    code: readFileSync(filename, "utf8"),
    filename,
    splitTargets: ["errorComponent"],
    // The layout also renders this screen, so the router extracts it as shared.
    sharedBindings: new Set(["PermissionRecovery"]),
  });
  // Bun's parser rejects the original output's unbound SplitErrorComponent export.
  const output = new Bun.Transpiler({ loader: "tsx" }).transformSync(result.code);
  expect(output).toContain("SplitErrorComponent");
  expect(output).toMatch(/(?:const|function) SplitErrorComponent\b/);
});