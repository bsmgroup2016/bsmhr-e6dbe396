import { expect, test } from "bun:test";
import { projectBatchIssue } from "./time-card-project-batch";

test("Twenty employees from one project/site pass the batch check", () => {
  expect(projectBatchIssue(Array.from({ length: 20 }, () => ({ projectName: "Project A", siteName: "Site A" })), {}, true)).toBeNull();
});
test("Four workers are not rejected when OCR repeats their identities as projects", () => {
  expect(projectBatchIssue([
    { projectName: "PG-31", employeeCode: "PG-31", siteName: "SITE A" },
    { projectName: "ZAHID", workerName: "ZAHID", siteName: "SITE A" },
    { projectName: "PC 292", employeeCode: "PC-292", siteName: "SITE A" },
    { workerName: "FOURTH WORKER", siteName: "SITE A" },
  ], {}, true)).toBeNull();
});

test("One different project among twenty cards blocks generation", () => {
  const locations = Array.from({ length: 20 }, (_, i) => ({ projectName: i === 19 ? "Project B" : "Project A", siteName: "Site A" }));
  expect(projectBatchIssue(locations)).toContain("Mixed projects detected");
});

test("One different site blocks even when project is the same or optional", () => {
  expect(projectBatchIssue([{ siteName: "Site A" }, { siteName: "Site B" }])).toContain("Mixed sites detected");
  expect(projectBatchIssue([{ projectName: "Project A", siteName: "Site A" }, { projectName: "Project A", siteName: "Site B" }])).toContain("Mixed sites detected");
});

test("Known site code and name resolve to the same site; unknown site is not guessed", () => {
  const lookups = { sites: [{ id: "a", name: "Site A", code: "SA" }] };
  expect(projectBatchIssue([{ siteName: " SA " }, { siteId: "a", siteName: "site a" }], lookups, true)).toBeNull();
  expect(projectBatchIssue([{ siteName: "Site A" }, {}], lookups, true)).toContain("Site is missing");
});

test("A corrected full re-upload clears the mismatch without retaining old identities", () => {
  expect(projectBatchIssue([{ siteName: "Site A" }, { siteName: "Site B" }])).not.toBeNull();
  expect(projectBatchIssue([{ siteName: "Site A" }, { siteName: "Site A" }], {}, true)).toBeNull();
});

test("Different known site IDs cannot be collapsed by identical printed names", () => {
  expect(projectBatchIssue([{ siteId: "a", siteName: "Site A" }, { siteId: "b", siteName: "Site A" }], { sites: [{ id: "a", name: "Site A" }, { id: "b", name: "Site B" }] })).toContain("Mixed sites detected");
});