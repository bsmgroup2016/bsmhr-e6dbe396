import { expect, it } from "bun:test";
import { createOnboardingDemo, updateOnboardingDemo } from "./onboarding-demo";
import { newOnboarding, ONBOARD_STAGES, readOnboarding, onboardingIncomplete } from "./onboarding";

it("provides six isolated samples covering every onboarding stage", () => {
  const rows = createOnboardingDemo();
  expect(rows.map(row => readOnboarding(row)?.stage)).toEqual([...ONBOARD_STAGES]);
  expect(rows.every(row => row.id.startsWith("demo-onboarding-"))).toBe(true);
  expect(rows.filter(onboardingIncomplete)).toHaveLength(3);
});
it("updates a sample without mutating its source and resets to original samples", () => {
  const row = createOnboardingDemo()[0];
  const updated = updateOnboardingDemo(row, { ...newOnboarding(), stage: "Onboard booked", bookingDate: "2026-11-20" }, {});
  expect(readOnboarding(updated)?.stage).toBe("Onboard booked");
  expect(readOnboarding(row)?.stage).toBe("IPA registered");
  expect(readOnboarding(createOnboardingDemo()[0])?.stage).toBe("IPA registered");
});
it("rejects live worker identities in demo updates", () => {
  expect(() => updateOnboardingDemo({ ...createOnboardingDemo()[0], id: "live-worker" }, newOnboarding(), {})).toThrow("Only sample records");
});