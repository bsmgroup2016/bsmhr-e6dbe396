/** Finalizing review never generates a claim; approval is a separate action. */
export function completeTimeCardReview(
  action: "finalize" | "approve",
  verify: () => boolean,
  generate: () => void,
): boolean {
  if (!verify()) return false;
  if (action === "approve") generate();
  return true;
}