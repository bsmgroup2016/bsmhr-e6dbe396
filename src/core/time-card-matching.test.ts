import { expect, test } from "bun:test";
import { matchCardWorker, uniqueCardMatch } from "./time-card-matching";
const workers = [{ id: "1", employeeCode: "BS-123", name: "HOSSEN MD DELOWAR", fin: "G123" }, { id: "2", employeeCode: "B-156", name: "MIAH MD RAKIB" }];
test("time card matches normalized P-file identifiers without preselected employee", () => { expect(matchCardWorker(workers, { employeeCode: " BS - 123 " })).toBe("1"); });
test("unknown printed identifier never falls through to a different name", () => { expect(matchCardWorker(workers, { employeeCode: "BS-999", workerName: "MIAH MD RAKIB" })).toBe(""); });
test("ambiguous names require confirmation", () => { expect(matchCardWorker([...workers, { id: "3", employeeCode: "BS-3", name: workers[0].name }], { workerName: workers[0].name })).toBe(""); });
test("missing project text does not guess a project", () => { expect(uniqueCardMatch([{ id: "p1", name: "KELLER" }], undefined, (p) => [p.name])).toBe(""); });