/** Singapore attendance day is independent of a worker's device timezone. */
export function singaporeDate(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function singaporeTime(at = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

export function punchTransition(row: { check_in?: unknown; check_out?: unknown } | undefined, checkout: boolean) {
  if (checkout && !row?.check_in) return "missing_check_in";
  if (checkout ? row?.check_out : row?.check_in) return "duplicate";
  return "save";
}