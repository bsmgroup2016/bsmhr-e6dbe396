/** Company estimate only; never persist this value in official expiry fields. */
export function estimatedWorkPermitExpiry(issueDate?: string, passType = "Work Permit"): string | undefined {
  if (passType !== "Work Permit" || !issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return undefined;
  const [year, month, day] = issueDate.split("-").map(Number);
  const issue = new Date(Date.UTC(year, month - 1, day));
  if (issue.toISOString().slice(0, 10) !== issueDate) return undefined;
  // Clamp leap day to February 28 in a non-leap target year.
  const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return new Date(Date.UTC(year + 1, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/** Inputs are normalized Excel dates, not inferred dates. */
export function workPermitDatesFromExcel(issueDate: string, expiryDate: string) {
  return {
    workPermitIssueDate: issueDate || undefined,
    workPermitExpiryDate: expiryDate || undefined,
  };
}