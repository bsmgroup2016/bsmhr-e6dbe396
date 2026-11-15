# Section UI/UX and workflow audit

Date: 15 November 2026

## Scope and assurance

All 48 authenticated route files (including the layout and root alias) and the three public account pages were inventoried. Route controls, shared navigation, collection dependencies and key cross-section call chains were inspected. This is a source audit with selected browser and automated checks, **not a certification that all live workflows work**.

The available browser opens signed out. The project uses an external account service; no managed test session is available. No credentials were requested, no authentication was bypassed, and no production business records, schema, roles, policies, storage objects or claim templates were changed. Settings/provider delivery, storage reads, OCR and protected record mutations remain unverified end-to-end.

## Implemented improvements

- Shared operational tabs wrap instead of overflowing a fixed-height strip.
- Shared dialogs have viewport margins, bounded dynamic height, internal scrolling and separated footer actions.
- Main content shrinks independently of wide tables; tables retain horizontal scrolling.
- Roboto is restored as the primary font; letter spacing is consistent; reduced-motion preferences suppress motion.
- Account menu items now lead to My Portal and Settings where permitted, rather than doing nothing.
- Header email truncates on constrained screens. Search uses the shared button control.
- Quick-create reopens a destination form even when already on that page. Removed the misleading standalone Site shortcut; sites are still created inside their parent project.
- Administration navigation can collapse even while an administration page is active.
- Breadcrumbs link directly to Dashboard, avoid a duplicated Dashboard crumb and use operational section names.
- Data-loading failures offer Retry; loading has accessible status text.
- Global search resets previous errors, exposes loading/incomplete results and offers Retry.
- Worker-profile attendance and document links retain employee identity. Documents reads and synchronizes the employee filter.
- MOM directly loads the existing payroll, loan, repayment and medical-claim collections needed by its panels, avoiding visit-order-dependent empty panels.
- Company settings show the selected company's saved details and link to Companies. Unsaved sample UEN text was removed.
- Unwired alert/access preferences are disabled and explicitly marked Unavailable; real password/email controls remain enabled.
- Settings data actions accurately distinguish loaded-record inspection, temporary JSON preview and reload from full backup/import/reset. Notifications is the last tab.
- Staff payroll amounts are labelled estimates before statutory deductions; no monetary formula changed.
- Approval summary captions no longer claim a monthly period when counting all requests.
- Dormitory dormant invoice/inspection controls are disabled; unavailable states are explicit and the duplicate invoice-date cell is removed.
- Dispatch confirms only that an instruction was saved, not unverified phone notification delivery.
- Audit-log search and download explicitly name the current-page scope; pagination wraps on small screens.
- Every content page has its own app-specific title, description, Open Graph title/description, type and Twitter card. No placeholder social image was introduced.

## Coverage by section

| Section | Source paths / connection checked | Outstanding live check |
|---|---|---|
| Dashboard | Role dashboard, alerts, workforce/project/commercial aggregates | Signed-in counts and cross-user freshness |
| Companies and company detail | Create/edit/switch, organizational panels, assignment-derived projects | Save/reload and company isolation |
| Workers and worker profile | Registration/edit/import, identity, documents, attendance/payroll links | IPA upload, save/read-back, profile actions |
| Available/deployed workers, deployment history | Assignment-derived status, filters, shared action dialog | Transfer/off-hire read-back |
| Attendance & OT | Daily/monthly history pagination, imports/exports, profile filter | Add/update, location and full export |
| ClaimSheet Generator | Upload/OCR/review/approval, latest template, expansion, reconciliation/viewer | Real multi-worker upload through downloaded workbook |
| Workforce Payroll | Attendance-derived generation, approvals, payslips, status/export | Saved payroll and payslip download |
| Leave Management | Request, approval helper and attendance updates | Approved leave read-back and company summary |
| MOM Compliance | Missing/expiry records, worker/document links | Actual saved expiry/document reads |
| Levy & Quota | Embedded lifecycle, salary/deductions/loans/claims dependencies | Direct signed-in panel data and edits |
| Training & WSH | Course/record/incident actions, separate certification stores | Save/reload and compliance relationship |
| Quotation Management | Prospect/client, rates and contract conversion chain | Multi-write conversion failure/reload |
| Client Directory and detail | Client/project/deployment/commercial links | Client-scoped details after changes |
| CRM | Leads, activities, client conversion | Persisted conversion and follow-up |
| Projects & Sites | Project create/edit and child-site creation, crew links | Save/read-back and crew refresh |
| Manpower Deployment | Worker/site/project/rates, transfer and availability | Partial-write failure and approval consistency |
| Rate Agreements | Rates, contracts and invoice generation | Saved agreement and contract invoice generation |
| Billing & Invoicing | Attendance/rates, invoices, receipts and payments | Invoice/payment persistence and reversal |
| Dispatch & Live Tracking | Tasks, driver-company filters, map/replay/status | Driver device delivery and actual updates |
| Driver Roster & Licences | Profile, vehicle, incident/fuel relationships | Profile save/reload |
| Daily Duty & Trips | Vehicle/trip/driver assignment and completion | Company-compatible driver assignment |
| Vehicles & Fleet | Vehicle scheduling, trips and driver relationships | Save/reload and schedule links |
| Fuel, Fines & Incidents | Incident/fuel/profile/vehicle handlers | Saved totals and status read-back |
| Staff Directory | Registration/edit/department/designation/documents | Staff save/reload |
| Staff Attendance | Attendance/approved leave derivation, lunch test controls | Existing attendance versus approved leave |
| Staff Payroll | Attendance-derived estimate and Excel, not settled payroll | Approved policy and payroll-ledger reconciliation |
| Foreign Recruitment | Candidate stages, requisitions and employee hand-off | Failed employee insert must not mark Hired |
| Finance & Accounts | Expense/receipt/invoice creation and reversal | Positive-amount validation and persisted totals |
| PPE Management | Catalog and separately paginated issue/return history | Quantity validation and return read-back |
| Inventory | Movement arithmetic, receiving and purchase orders | Quantity bounds and repeated receiving |
| Accommodation | Dorm/bed capacity, allocation and dormant features | Duplicate worker/bed prevention and persisted allocation |
| Approvals | Request rows, decisions, leave/assignment relationships | Decision must update the underlying business record |
| Reports | Cross-section snapshots, report packs, monthly inputs | Full saved-data totals and currency/date scope |
| Users & Permissions | User/role/active controls and existing access rules | Authenticated role changes and policy enforcement |
| Audit Logs | Fixed server pages, filters and current-page export | Full-period search/export if later requested |
| Chatbot Training | Training notes/settings/crawl API wiring | Provider calls, stored notes and scheduled crawl |
| General Settings | Company/branch, security, SMTP, storage, APIs, automation/archive | Authenticated service tests and saved settings |
| My Portal | User/employee matching, self-service profile, leave, documents/payroll | Own-account data and downloads |
| Alerts Centre | Expiry/approval/overdue aggregate and links | Actual alert freshness and dismissed notices |
| QR Attendance | Site/user validation and punch handlers | Real authorized location/selfie/punch flow |
| Account pages | Sign-in, sign-up tab, reset form and expired-link state | Hosted signup/sign-in/email delivery settings |
| Root alias | Redirects / to dashboard, signed-out redirect to auth | Signed-in redirect |

## Important findings not fixed in this UI-focused pass

These need controlled authenticated record tests and incremental business-workflow changes, not a cosmetic rewrite. Source references describe evidence; database triggers/constraints were not verified.

### High priority

1. **Unconfirmed writes:** many `src/lib/store.ts` mutations update memory before unawaited database writes complete. `fail()` only logs errors, while operational pages may already announce success. Finance, approvals, training, claims and other writes need confirmed results and rollback/error handling.
2. **Approval linkage:** `addLeaveRequest` creates a display-text approval payload; `ApprovalsPage.decide` updates only the approval. The separate `approveLeaveRequest` helper updates leave/attendance. Route decisions need explicit record links and durable coordination, without guessing older payload matches.
3. **Document renewal cancellation:** `DocumentsPage.handleRenew` supersedes the original before replacement is submitted. Move the change after a confirmed replacement save, with safe failure handling; cancellation must not alter the original.
4. **Recruitment hand-off:** `convertCandidateToEmployee` marks Hired immediately after optimistic employee creation. Coordinate candidate changes with confirmed employee save and guard repeat actions.
5. **Transfer/conversion partial failures:** old/new assignments and quotation/client/rate/contract conversion are separate optimistic writes, not verified all-or-nothing changes.

### Additional correctness and UX risks

- Finance amount validation rejects zero but accepts negative expenses/receipts; receipt reversal may mark a still-fully-paid invoice Partially Paid.
- Inventory non-adjustment movements accept negative quantities; Damaged is not checked against available stock. Purchase-order receive is not idempotent.
- Asset issuance does not enforce positive quantities in its click handler.
- Dormitory allocation does not guard another active allocation for a worker or duplicate named room/bed in the inspected client/store paths.
- Driver Duty's driver list/counts do not share the vehicle/trip company scope.
- Staff Attendance's computed approved-leave override is discarded when an attendance row already exists.
- Leave's On leave today summary is not company-scoped like the displayed list.
- Some employee/client links still open unfiltered directories; remaining destination filtering should be added consistently.
- Global search returns several nonemployee records to their directory rather than the exact record; deeper linking is a follow-up.
- Store caching has no cross-user live refresh guarantee. Local confirmed-write invalidation does not prove multi-user synchronization.
- Staff payroll's existing 26-day divisor and Half Day policy are unchanged and require business confirmation before changing amounts.
- Training records and employee certifications are separate stores; no automatic synchronization should be assumed.
- Unlinked claim cards are deliberately session-local and sessionStorage-restored, not durable registered employee records. Do not claim they are permanently saved.
- Dorm invoice/inspection/movement tables are on the known-unavailable allowlist; disabling UI does not implement those features.

## Verification

- Existing business-rule suite plus the direct-entry MOM dependency regression: **202 passing, 0 failing across 27 test files**.
- Public browser: / and /dashboard correctly lead to /auth while signed out; /admin and expired /reset-password render without page errors.
- Sign-up tab opens its phone/password form; password recovery opens Account email / Send reset link. No signup or email was submitted.
- Public checks at 1280×1800, 1146×682 and 390×844 found no document-width overflow; screenshots retained under /tmp/browser/ui-audit.
- Isolated shared-control browser checks passed at 1280×1800, 1146×682 and 390×844: the last tab was selectable, long dialogs stayed within the viewport, and the footer Finish button scrolled into view and closed the dialog. No page errors. These are not authenticated business-flow evidence.
- Latest preview compiler result must remain clean before completion.
- **Blocked:** signed-in full-section and real mutation read-back checks require an authorized test session/environment. Hosted authentication settings, service credentials and provider delivery remain unverified.