import { expect, test } from "bun:test";
import { punchTransition, singaporeDate, singaporeTime } from "./portal-punch";

test("returning worker with a saved check-in can check out", () => {
  expect(punchTransition({ check_in: "07:00", check_out: null }, true)).toBe("save");
});
test("checkout without check-in is rejected", () => {
  expect(punchTransition(undefined, true)).toBe("missing_check_in");
});
test("repeat punches cannot replace original times", () => {
  expect(punchTransition({ check_in: "07:00" }, false)).toBe("duplicate");
  expect(punchTransition({ check_in: "07:00", check_out: "20:00" }, true)).toBe("duplicate");
});
test("Singapore day and time do not depend on device timezone", () => {
  const at = new Date("2026-11-18T18:00:00Z");
  expect(singaporeDate(at)).toBe("2026-11-19");
  expect(singaporeTime(at)).toBe("02:00");
});