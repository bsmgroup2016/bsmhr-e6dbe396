import { expect, test } from "bun:test";
import { completeTimeCardReview } from "./time-card-review";

test("Finalize completes review without generating a claim sheet", () => {
  let claims = 0;
  expect(completeTimeCardReview("finalize", () => true, () => { claims += 1; })).toBe(true);
  expect(claims).toBe(0);
});

test("Separate approval generates one claim after successful review", () => {
  let claims = 0;
  expect(completeTimeCardReview("approve", () => true, () => { claims += 1; })).toBe(true);
  expect(claims).toBe(1);
});

test("Unresolved review cannot close successfully or generate a claim", () => {
  let claims = 0;
  for (const action of ["finalize", "approve"] as const) {
    expect(completeTimeCardReview(action, () => false, () => { claims += 1; })).toBe(false);
  }
  expect(claims).toBe(0);
});