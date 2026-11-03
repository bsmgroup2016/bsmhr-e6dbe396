import { expect, test } from "bun:test";
import { canConfirmCardDetails, claimCardLocation, matchCardWorker, uniqueCardMatch } from "./time-card-matching";
const workers = [{ id: "1", employeeCode: "BS-123", name: "HOSSEN MD DELOWAR", fin: "G123" }, { id: "2", employeeCode: "B-156", name: "MIAH MD RAKIB" }];
test("time card matches normalized P-file identifiers without preselected employee", () => { expect(matchCardWorker(workers, { employeeCode: " BS - 123 " })).toBe("1"); });
test("unknown printed identifier never falls through to a different name", () => { expect(matchCardWorker(workers, { employeeCode: "BS-999", workerName: "MIAH MD RAKIB" })).toBe(""); });
test("ambiguous names require confirmation", () => { expect(matchCardWorker([...workers, { id: "3", employeeCode: "BS-3", name: workers[0].name }], { workerName: workers[0].name })).toBe(""); });
test("missing project text does not guess a project", () => { expect(uniqueCardMatch([{ id: "p1", name: "KELLER" }], undefined, (p) => [p.name])).toBe(""); });
test("project is optional when worker, period and printed site are present", () => {
  expect(canConfirmCardDetails("worker-1", "2026-10", "BP Joint Venture")).toBe(true);
});
test("site is required, including when its text contains only spaces", () => {
  expect(canConfirmCardDetails("worker-1", "2026-10", " ")).toBe(false);
});
test("unlisted printed site survives claim generation without demo attribution", () => {
  expect(claimCardLocation({ siteName: "BP Joint Venture" }, [{ id: "demo", name: "Demo Site", projectId: "demo-project" }], [{ id: "demo-project", name: "Demo Project" }], "demo"))
    .toEqual({ site: "BP Joint Venture", siteId: undefined, projectId: undefined, projectName: undefined });
});