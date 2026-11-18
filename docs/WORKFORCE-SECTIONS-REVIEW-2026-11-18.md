# Workforce sections review

Date: 18 November 2026. Scope: the eight sections listed under Workforce in the desktop sidebar.

## Verdict and evidence

Changes are needed before these sections can be called fully reliable. Existing regression tests pass, but they do not cover every business mutation or prove hosted service delivery.

- **272 tests passed, zero failed across 43 files**, using `bun test` against the current project.
- Browser opened Dashboard and all eight Workforce routes. Each redirected to `/auth`, with the sign-in button visible and no browser page errors. The screenshot was inspected.
- The owner's captured preview telemetry shows an admin session and a successful login-record request; that session is not available to the separate testing browser. Do not confuse the owner's signed-in preview with an authenticated test session.
- **Authenticated path: UNVERIFIED.** No real worker creation, attendance save, leave approval, payroll write, OCR request, storage upload or protected download was executed.
- No application behaviour, records, schema, permissions, templates or storage objects changed. This is a review, not a repair or certification.

## Current confirmed findings

### High: ClaimSheet replacement deletes first; current routed review lacks safeguards

The current `/claim-generator` route uses `src/features/claim-demo`, not all the older audited time-card controls. `pipeline.ts:121–124` deletes matching old claims before awaiting the replacement save; deletion itself is optimistic (`store.ts:2895–2900`). If deletion succeeds and replacement fails, the old claim can be lost. `pipeline.ts:89–92` marks converted entries Accepted and review-approved automatically. The routed review advances without blocking batch validation (`step-review.tsx:111`), and export disables only while busy (`step-export.tsx:46–50`). Failed pages and uncertain readings can therefore reach export without the explicit safeguards described in the older audit.

Also, `src/lib/page-data.ts` has no `claim-generator` dependency entry, although this pipeline reads employees, sites, projects, clients and old claims. A fresh direct entry loads only companies; matching and replacement metadata can depend on previous navigation.

Recommendation: remove delete-before-save replacement, wire the current route to explicit validation/approval, and declare cold-entry dependencies. The existing 272 tests do not certify this routed orchestration.

### High: payroll bonus is calculated but not stored as an earning

`src/routes/_authenticated/payroll.tsx:409–419` includes bonus in gross/net calculations, but the persisted payload (`420–437`) omits bonus. Recalculation (`297–310`) uses basic salary, OT and allowances only. A bonus can disappear from net pay after recalculation and is absent from the payslip earning breakdown. The IRAS annual export (`278–280`) additionally passes all loaded payroll rather than the selected company's annual payroll; this is a scoping defect, not an authorization bypass.

Recommendation: preserve each earning and reuse one calculation across save/recalculate/payslip/export, with explicit company/year scope. Do not silently change historical payroll.

### High: insurance blanks look valid; empty Training company shows other records

`daysUntil` returns 9999 for blank/invalid dates (`src/lib/compliance.ts:37–41`), but `insuranceItems` tests for null (`src/lib/mom.ts:277–285`). Missing insurance/examination dates are therefore classified OK and do not enter the insurance risk total.

Training uses `empIds.size === 0 || empIds.has(...)` for records and alerts (`training.tsx:100,108`). When the selected company has no workers, this includes every loaded company's records instead of none. This is an interface/export scoping failure where other-company records are already accessible, not evidence of an RLS bypass.

Recommendation: represent missing dates explicitly and distinguish no-company-filter from a selected company with zero employees.

### High: several sections report success before the save is confirmed

`src/lib/store.ts:161–163` logs write errors only. Payroll create/update/delete (`698–727`), leave create/update/delete (`795–842`) and training/course/incident mutations (`1868–1975`) update local state before unawaited writes finish. For example, `src/routes/_authenticated/leave.tsx:119–149` closes the form or announces approval/deletion immediately. A rejected request can therefore appear successful and later disappear or revert.

Recommendation: change one mutation family at a time to awaited, caller-authorized write/read-back, preserving the form on failure. Verify create/update/delete failures and successes before announcing success or sending decision notifications. Workers already use a confirmed save path; do not revert it.

### High: leave approvals are not coordinated with the central Approvals page

`src/lib/store.ts:811–819` creates a text-only approval payload without a durable leave request ID. `src/routes/_authenticated/approvals.tsx:86–98` changes the approval row only; `approveLeaveRequest` (`src/lib/store.ts:846–870`) separately changes leave and attendance. Decisions made through the central Approvals page therefore do not invoke the leave update/attendance path in the inspected client code. Hosted triggers were not inspected, so no database-side synchronization is assumed.

Recommendation: link the request explicitly and coordinate both decision surfaces. Do not guess legacy links from worker names or free text.

### High: leave approval can overwrite an existing worked day

`src/lib/store.ts:860–868` upserts every approved date with zero normal/OT hours. Existing attendance is selected by employee/date in `upsertAttendance` (`675–684`). Approval of overlapping leave can consequently change existing worked-day status and hours without a conflict review. Cancellation/rejection must also be evaluated before any new implementation to avoid leaving generated attendance behind.

Recommendation: detect overlapping requests and already-worked days, require an explicit conflict decision, and preserve the original record on failed or cancelled changes.

### Medium: On leave today ignores the selected company

The list uses `matchesCompany` (`src/routes/_authenticated/leave.tsx:92–102`), while the summary uses all loaded leaves (`107–110`). The company-specific list and summary can disagree.

Recommendation: calculate the summary from the same company employee scope, independently of the search/status filter if the intended label is a company-wide total.

### Medium: date defaults do not consistently follow Singapore time

UTC date slicing is used in Attendance (`time-management.tsx:104–105,1026`), Payroll (`payroll.tsx:116`), Leave (`leave.tsx:108,199,323`) and Training (`training.tsx:44`). At `2026-11-18T17:00:00Z`, the UTC default is **18 November**, while Singapore is already **19 November**. This was reproduced without business-record writes. The same boundary affects default month at month-end.

Recommendation: use one tested Singapore calendar-date/month helper across sibling screens; retain UTC timestamps for audit events.

### Medium: training validity uses overflowing month arithmetic

`src/lib/store.ts:1910–1915` uses `Date.setMonth` for automatic expiry. **31 January 2026 + one month produces 3 March 2026**, reproduced locally. Whether validity should end on 28 February or a different date requires the course's actual validity convention.

Recommendation: use tested calendar-month logic matching that convention, rather than silently rolling into the following month.

### Medium: live changes can leave page-level snapshots stale

Leave, Payroll and Training initialize collections with `useState(get…())`; Compliance memoizes employee/document-derived rows using only `companyId` (`compliance.tsx:55–63`). MOM memoizes employees using only company ID (`mom.tsx:62–65`). The shared store can refresh after confirmed writes (`store.ts:228–238`) without those snapshots/memos subscribing to the changed collections. The session cache (`src/lib/session-data-cache.ts`) also has no timer refresh, so another user's write is not guaranteed to arrive.

Recommendation: subscribe page-derived data to the relevant collections and define an explicit refresh policy without returning to navigation-wide reloads.

### Other corrections to schedule

- **Quota arithmetic:** `src/lib/mom.ts:38–43,136–137` uses rounded fractions. Construction's represented 5:1 ratio is stored as 0.8333, making one local worker yield four allowed foreign workers after flooring. Use exact ratios with boundary tests; statutory eligibility/rates still require authoritative validation.
- **Compliance labels:** Passport documents are categorized Work Pass (`src/lib/compliance.ts:166`), and the Within 30 days card counts all critical items even though passport critical thresholds can be 60 days (`compliance.ts:119–134`, `compliance.tsx:141–146`). Filters/export and labels need consistent category/threshold rules.
- **Training completion:** marking a scheduled training completed changes status/date without recomputing its provisional expiry (`training.tsx:333–335`); Completed records count as certified even after expiry (`144–145,312–327`). Training and employee safety certifications remain distinct sources, so their watchlists must not be assumed synchronized.
- **Leave year allocation:** `src/lib/sg-leave.ts:133–142` assigns a cross-year request entirely to its start year instead of allocating dates between years.

## Section coverage

| Section | Reviewed actions | Conclusion |
|---|---|---|
| Workers (Site) | Search/filter, register/edit, documents, removal, import | Confirmed worker save fixes remain wired; import project-assignment writes still lack confirmation. No additional worker defect promoted. |
| Attendance & OT | Paginated daily/monthly reads, create/edit/delete, daily sheet, import/export | Pagination and write invalidation are present; legacy mutation success remains premature and date defaults need correction. |
| Timecard to ClaimSheet | Upload/read, routed review, workbook generation/download, record replacement | High-priority current-route validation, dependency and replacement defects; older helper tests alone do not cover them. |
| Workforce Payroll | Generate/create/import, status, recalculate, payslip and government/bank exports | Premature save success, omitted bonus and annual-export company scoping need repair. |
| Leave Management | Request, approve/reject/delete, balance and attendance sync | Decision linkage, worked-day conflicts/reversal and company/year totals need repair. |
| MOM Compliance | Missing/expiry watchlists, filters, employee/file links, exports | Passport category/threshold labels and reactive data refresh need correction. |
| Levy & Quota (DRC) | Company quotas, simulator, levy/insurance exports and standards panels | Missing-date classification, exact-ratio arithmetic and stale derived rows need correction. |
| Training & WSH Safety | Courses, certifications, complete/delete, incident actions, alerts/export | Empty-company scoping, confirmed saves and expiry/completed validity need correction. |

All rows describe source review, not signed-in end-to-end success.

## Repair order

1. Safe ClaimSheet replacement, explicit current-route approval and direct-entry dependencies.
2. Confirmed payroll/leave/training/attendance writes; linked leave decisions and worked-day conflict/reversal rules.
3. Persisted payroll earnings and company-correct exports; insurance blanks and Training company scoping.
4. Exact quota ratios, Singapore date boundaries, leave-year/training validity and collection subscriptions.
5. Controlled authenticated end-to-end checks for every section, including persisted read-back and actual downloads.

Do not alter statutory rates, payroll policies, historical data, permissions or the owner's Excel layout as part of a cosmetic change.