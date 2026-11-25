import { describe, expect, test } from "bun:test";
import { buildCrumbs } from "./breadcrumbs";

describe("buildCrumbs", () => {
  test("hides record id segments from the trail", () => {
    expect(
      buildCrumbs("/clients/a297a112-5a82-4c53-b958-a7d6a0a0ab69"),
    ).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Clients", href: undefined },
    ]);
  });

  test("keeps readable slug segments", () => {
    expect(buildCrumbs("/workforce/pluto-engineering")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Workforce", href: "/workforce" },
      { label: "Pluto Engineering", href: undefined },
    ]);
  });

  test("dashboard itself has no link", () => {
    expect(buildCrumbs("/dashboard")).toEqual([{ label: "Dashboard", href: undefined }]);
  });

  test("list pages end on the current page", () => {
    expect(buildCrumbs("/projects")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Projects & Sites", href: undefined },
    ]);
  });
});
