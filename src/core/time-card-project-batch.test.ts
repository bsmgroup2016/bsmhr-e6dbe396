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

test("Different project readings never block twenty cards from the same site", () => {
  const locations = Array.from({ length: 20 }, (_, i) => ({ projectName: i === 19 ? "Project B" : "Project A", siteName: "Site A" }));
  expect(projectBatchIssue(locations)).toBeNull();
});

test("Different sites never block upload, confirmation or generation", () => {
  expect(projectBatchIssue([{ siteName: "JB-1183" }, { siteName: "PCB 31" }])).toBeNull();
  expect(projectBatchIssue([{ projectName: "Project A", siteName: "JB-1183" }, { projectName: "Project A", siteName: "PCB 31" }], {}, true)).toBeNull();
});

test("Known site code and name resolve to the same site; unknown site is not guessed", () => {
  const lookups = { sites: [{ id: "a", name: "Site A", code: "SA" }] };
  expect(projectBatchIssue([{ siteName: " SA " }, { siteId: "a", siteName: "site a" }], lookups, true)).toBeNull();
  expect(projectBatchIssue([{ siteName: "Site A" }, {}], lookups, true)).toContain("Site is missing");
});

test("Both mixed and matching site batches are accepted", () => {
  expect(projectBatchIssue([{ siteName: "Site A" }, { siteName: "Site B" }])).toBeNull();
  expect(projectBatchIssue([{ siteName: "Site A" }, { siteName: "Site A" }], {}, true)).toBeNull();
});

test("Different known site IDs do not block generation", () => {
  expect(projectBatchIssue([{ siteId: "a", siteName: "Site A" }, { siteId: "b", siteName: "Site A" }], { sites: [{ id: "a", name: "Site A" }, { id: "b", name: "Site B" }] }, true)).toBeNull();
});