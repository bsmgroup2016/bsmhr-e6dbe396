import { describe, expect, it } from "vitest";
import { splitDutyHours, spanFromTimes } from "./work-hours";

describe("duty hour rule", () => {
  it("07:00-20:00 counts 8 normal + 4 OT", () => {
    expect(splitDutyHours(spanFromTimes("07:00", "20:00")!)).toEqual({ generalHours: 9, normalHours: 8, otHours: 4 });
  });
  it("9-hour duty counts 8 normal, no OT", () => {
    expect(splitDutyHours(9)).toMatchObject({ normalHours: 8, otHours: 0 });
  });
  it("OT starts only after the 9-hour duty", () => {
    expect(splitDutyHours(10).otHours).toBe(1);
  });
});
