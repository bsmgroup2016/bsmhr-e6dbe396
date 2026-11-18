import { expect, test } from "bun:test";
import { userLoginUpdate } from "./user-login-update";
import { loginEmail } from "./worker-login";

test("edited worker username becomes the actual sign-in credential", () => {
  const result = userLoginUpdate("rahman.hasibur@workers.hrbsm.xyz", { username: "rahmanhasibur" });
  expect(result.email).toBe("rahmanhasibur@workers.hrbsm.xyz");
  if (!result.email) throw new Error("Worker login email missing");
  expect(loginEmail("rahmanhasibur")).toBe(result.email);
});
test("resending the old email cannot override a worker username edit", () => {
  expect(userLoginUpdate("rahman.hasibur@workers.hrbsm.xyz", {
    username: "rahmanhasibur", email: "rahman.hasibur@workers.hrbsm.xyz",
  }).email).toBe("rahmanhasibur@workers.hrbsm.xyz");
});
test("worker credentials and stored username use the same normalization", () => {
  expect(userLoginUpdate("old@workers.hrbsm.xyz", { username: " RahmanHasibur " }))
    .toEqual({ email: "rahmanhasibur@workers.hrbsm.xyz", username: "rahmanhasibur" });
});
test("invalid worker identifiers cannot be saved as login credentials", () => {
  expect(() => userLoginUpdate("old@workers.hrbsm.xyz", { username: "rahman hasibur" })).toThrow();
});
test("staff display usernames do not rename their email credential", () => {
  expect(userLoginUpdate("staff@example.com", { username: "staff" }).email).toBeUndefined();
});