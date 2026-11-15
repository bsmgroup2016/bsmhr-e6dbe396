# Section UI/UX and workflow audit

Date: 15 November 2026

## Card-level OCR status and uncertainty review

- Added per-file queued/reading/read/failed states, attempt counts, extracted worker/date counts, uncertainty totals and individual retry controls. Results remain session-local; no new database table or storage payload is introduced.
- Each confirmed card shows its OCR dates, date-validation result, remaining uncertainty and a direct review action. Failed reads and interruptions remain visible after reload; original File objects still require reselection.
- Low-confidence rows, alternate readings and reader disagreements have explicit manual-check warnings. Header disagreements include both site/identity readings. The worker review offers editable name, staff code, printed site, times and GW/OT hours plus original-card access.
- Each uncertain date requires an explicit checked-against-original acknowledgement. Bulk approval cannot bypass it. Hour edits, changed identity/site and rescans invalidate the acknowledgement. Approval and generation remain separate.
- Controlled browser verification exercised 30 uncertain cards: premature approval was blocked, explicit checks enabled sequential approval, all workers remained in the dated preview, and no page errors occurred. Results and warnings were visually inspected; 224 regression tests passed before the final identity-input addition. Live authenticated provider/storage checks remain unavailable as documented below.

## ClaimSheet Generator: focused batch reliability audit

Scope: this page and its claim/time-card helpers only. No migrations, permission changes, production uploads, template replacements or live business-record writes were performed.

### Confirmed findings and corrections

- Second OCR reader could find a worker omitted by the primary reader. Such workers now remain in the batch, explicitly flagged for original-card review.
- Changing Claim Month could silently discard day 31 or repeated dates. Invalid calendar dates and duplicate worker/date combinations now stop approval/generation with a recoverable explanation.
- Blank card rows could inherit system attendance hours without explicit selection. They now remain zero unless Use System Time is selected; incomplete written times require review or explicit hours.
- Failed pages could be overlooked. Failure warnings block confirmation/generation, retries retain successful cards, and warnings survive reload. Browser File objects cannot survive reload: the interface explicitly requires reselecting all originals in a fresh batch.
- Active batches now show card count, remaining reviews, resume and reset controls. New uploads/imports cannot replace an unfinished batch. Project selection applies to every active card; site edits require approval again.
- Unmatched Excel-import worker codes now reject the import instead of silently losing rows.
- Generated worksheets clear only worker identities and daily input hours, avoiding leftover sample hours. Exact printed site headings stay distinct even with a shared selected project; differing sites are not blocked.
- Extra workers retain paired rows, merges/styles, bounded worker totals, moved absolute-footer references and extended print areas. Quoted formula text and unrelated sheet references are not rewritten.
- Unexpected output workers are included in reconciliation. Reconciliation runs before claim saving; saving awaits caller-authorized returned records and checks their IDs. Stable source-card IDs make retries idempotent.

### Verification and honest limits

- Automated regression suite: large batch, 50-page PDF splitting, weekends/partial months, month-end rejection, duplicate prevention, approval/hour handling, dirty templates, formula boundaries and bidirectional reconciliation are covered.
- Actual bundled template: generated, serialized and reloaded 20-, 30- and 50-worker workbooks. Every case matched approved date/hour inputs, had the expected slot count and zero evaluator formula errors. These are ExcelJS/read-back checks, not visual Microsoft Excel certification.
- Isolated live-served page: 30 synthetic cards approved sequentially; each next worker opened, all 30 appeared in the dated preview, Claim sheets remained the default. Desktop, compact desktop and phone sizes had no document overflow or page errors. This intentionally excluded the authenticated shell and did not save records.
- No authorized browser session for the externally managed account service is available. Real signed-in OCR → storage → approval → persisted claim → download remains unverified. No new real card batch was provided; OCR accuracy cannot be guaranteed from deterministic workbook checks.
- Advanced replacement-template formulas (cross-sheet, external references, named/structured ranges), complex print layouts, embedded objects and exceptionally large real OCR batches need their own controlled sample validation. Human review remains necessary for uncertain OCR.

## Colour contrast follow-up

- Shared secondary text is darker; input/select/outline-button boundaries are more distinct. Success, information and error fills now use deeper semantic colours with readable light labels. Warning fills remain amber with dark labels; standalone warning text uses a separate dark amber ink. Status dots inherit their label colour, fixing pale dots on amber badges. Gradient endpoints were darkened where they carry light labels.
- Browser measurements of the shared palette: secondary text on muted surfaces **6.85:1**; success/information/error badge labels **6.54:1 / 6.67:1 / 5.88:1**; warning labels **7.66:1**; warning text on white **8.29:1**; primary labels **5.43:1**; input boundaries on white **4.13:1**. These sampled text pairs exceed 4.5:1 and the sampled boundary exceeds 3:1; this does not certify every translucent/hover/gradient combination or whole-app WCAG compliance.
- Actual rendered warning text confirmed the dark-ink value. Shared statuses, summary labels and form controls visually inspected at 1280×1800, 1206×682 and 390×844 without overflow or page errors. Public sign-in was captured; signed-in populated pages remain unavailable to the test browser. No business data, permissions or calculations changed; 202 existing tests pass and all 50 content routes retain metadata.

## Accessibility follow-up

### Findings and fixes by severity

- **Critical: unnamed controls in six updated sections.** Attendance daily-sheet status/hour inputs and record menus (`time-management.tsx`), worker filters (`workforce.tsx`), payroll filters/status controls (`payroll.tsx`), client action menus (`clients.tsx`), quotation fields/remove-line controls (`quotations.tsx`) and certification/course/incident forms (`training.tsx`) lacked reliable accessible names. Screen-reader users could not reliably distinguish the control's purpose or worker. Added explicit names or connected visible labels; repeated quotation inputs use stable per-line IDs, and attendance inputs include worker identity.
- **Critical: broken visible-label associations.** Attendance, payroll and client form selectors, Settings branch selection (`settings.tsx`) and billing payment method (`billing.tsx`) now connect labels to their actual trigger IDs. Existing Radix keyboard and focus management remains intact.
- **Warning: inconsistent keyboard focus and small navigation targets.** Global token-based focus outlines cover native links/custom focusable controls, alongside existing primitive rings (`styles.css`). Header sidebar/search/alerts/portal targets are at least 44px (`app-header.tsx`). Other compact record actions still use existing coarse-pointer sizing; this is not a complete touch-target audit.
- **Info: navigation and table semantics.** Mobile navigation has a named landmark and current-page state (`nav/mobile-nav.tsx`); shared table headers have column scope (`ui/table.tsx`). Prefix inputs identify their branch; the active-prefix toggle announces its pressed state. Existing skip-to-content, English document language and Radix tab/menu/dialog semantics were preserved.

### Verification and limitations

- Keyboard-only shared-control checks passed at 1280×1800, 1146×682 and 390×844: Enter switches attendance mode; arrow keys switch tabs; keyboard selection changes company; Tab stays within the dialog; Escape closes it and restores the opener's focus. Screenshots confirm visible focus, with no viewport overflow or page errors.
- Public sign-in Email → Password keyboard navigation passed. Signed-in attendance still redirects to `/auth`; no authorized external-service session is available. Actual populated section interactions and assistive-technology speech output remain unverified. Isolated controls are not authenticated end-to-end evidence.
- 202 existing regression tests passed; all 50 content routes retain leaf metadata; preview compiler reports build OK. No business records, permissions, formulas, template layouts or hosted account settings changed.
- This focused Accessibility Review fixes confirmed issues in updated controls, not a claim of whole-app WCAG compliance; older forms, live announcements and all portal variants require a separate exhaustive audit.

## Visible section-layout rollout

The shared authenticated shell now provides category context for every listed operational section except Attendance & OT, which already owns its category heading. Shared page headings are larger; summary tiles become open metric strips; section tabs use an underlined selected state; data tables have a separate framed surface, distinct headers and alternating rows. These presentation rules are scoped to the workspace, not dialog portals or workbook grids.

Workers, payroll, clients, billing, leave, quotations, training and Settings received additional page-level changes: removed duplicate worker-create action, separated payroll actions from its title, made payroll generation primary, unframed list sections, grouped filters, named invoice/leave controls, converted quotation KPIs to open metrics, matched worker/payroll/training titles to navigation and widened Settings. All existing handlers, amounts, role rules and claim-template generation remain unchanged.

Verification: 202 existing tests passed; 50 content routes retain complete metadata; latest preview compiler entry is build OK. Isolated live-served shared layouts were exercised at 1280×1800, 1146×682 and 390×844, with working tab selection/search and no page errors. Desktop/mobile screenshots confirm open summaries and visibly different tabs/tables. Real authenticated populated pages remain unverified because no authorized session is available in the test browser; this is not a claim of end-to-end verification.

## Second-pass senior design and engineering review

Completed a fresh source review of all sections in the coverage matrix below, plus the assistant, inventory, public account states, shared role dashboard and every Settings child. A supplemental pass inspected the complete dashboard, company pages, organisational panels and all seven Reports tabs, closing the initial delegated review's coverage gaps. There are 50 content route files; the authenticated layout is not a content page. No section is excluded from the inventory; this does not mean every live action has been executed.

### Improvements implemented in this pass

- **Across the application:** restrained solid primary actions, softer card shadows, readable heading line heights, consistent active tabs, clear keyboard focus, wider touch targets, solid form surfaces, invalid-input styling and nonshrinking action buttons. Existing brand colours, Roboto, business rules and claim templates are preserved.
- **Tables:** stronger header hierarchy, tabular numbers, more comfortable row spacing and keyboard-focusable horizontal scrolling; wide content does not widen the whole page.
- **Forms and confirmations:** bounded confirmation dialogs on phones, wrapping footers, larger close targets and accessible icon-action names from existing titles. Controls without a title or explicit accessible name still require a route-specific follow-up; there is no claim of universal accessibility compliance.
- **Navigation:** a keyboard skip-to-content link, a narrower search control at intermediate widths and a shrinking breadcrumb region reduce header crowding.
- **Empty states:** removed decorative halo/animation and nested framing; recovery actions are more prominent.
- **Quotations:** visible company/result scope, labelled search/status filters, clear-filter recovery, distinct empty versus no-match states, keyboard-accessible quote detail link, readable scope text, semantic status colours, Excel download label and record-specific delete confirmation.
- **Available/deployed workers:** labelled filters that stack on phones, filtered/total counts and one-action clearing. Designation selections now use the shared button with a pressed state. Removed the unsupported claim that all nonmatching workers are deployed.
- **Clients/projects/CRM:** clearer search names, reset controls/counts on client/project lists and a recoverable CRM no-match state. Active-client/site captions reflect the actual status/count basis.
- **Staff Attendance:** lunch toast tests are collapsed separately from routine attendance controls; attendance date has an explicit accessible name. Attendance/leave calculations are unchanged.
- **Driver incidents/fuel:** deletion now requires confirmation identifying the date and driver/vehicle; underlying mutations are unchanged and persistence remains unverified.
- **Settings:** invalid temporary JSON has an inline error with input association; record reload prevents repeated clicks and reports a rejected reload. These are still temporary-preview/reload actions, not database backup/import.
- **Dashboard:** removed the literal July 2026 payroll-period badge, unsupported Operational badge and hardcoded attendance-lock state. The panel now shows the actual calendar month used by this page and document alerts. Present Today matches the existing present/half-day count. Recent activity scrolls horizontally; section headings wrap.
- **Companies:** wage values are explicitly basic-wage estimates; annualised values are not presented as settled annual payroll. Company detail has an unframed header, readable long names/contact fields and an expired-or-expiring permit label matching its inclusion of overdue records.
- **Reports:** replaced the misleading Net profit label with Invoiced less paid expenses without changing the calculation. Loaded-record/all-period scope is visible, leave summary says all periods, month controls have names and the government tab warns that cross-company figures using one sector are not an entity-specific statutory submission.
- **PPE/history:** PPE page title matches navigation; deployment remarks remain readable without hover-only truncation.

### Remaining issues, not silently changed

1. **Authenticated workflow assurance:** the external account service offers no managed test session. Actual signed-in saves, approvals, uploads, exports, service delivery and read-back remain unverified. No bypass, credentials request or production record writes were performed.
2. **Persistence:** the original unconfirmed-mutation, approval linkage, document renewal and conversion findings below remain. Adding confirmations does not repair database coordination.
3. **Calendar consistency:** several screens still derive Today/date defaults from UTC while expiry calculations sometimes use Singapore-offset dates. A separate tested date-boundary correction is needed across all sibling screens; this pass does not change reporting/attendance date rules.
4. **Company consistency:** driver scope, organisational employee counts by text, company deployment-derived availability, cross-company MOM quota/sector and cross-user refresh need controlled data checks. Reports now disclose scope rather than pretending these values are entity-specific.
5. **Business-policy confirmation:** staff payroll divisor/half-day rules, inventory/receipt/issuance validation and dormitory uniqueness are not changed by styling. The client's fixed $2,500 manpower-value multiplier is explicitly labelled illustrative, not factual contract revenue.
6. **Navigation depth:** some result/project/client names still lead to directories rather than exact filtered records; company detail project/client rows need clearer drill-down actions. No inaccessible destination was added.
7. **Information completeness:** training records versus employee certifications, missing dormitory tables, department-head options capped at 200, reporting-range/chart scope and durable source-card storage retain their documented limitations.
8. **Visual assurance:** shared controls were exercised in isolation, not by impersonating an authenticated role. Full populated-page, long-content, all-tab and keyboard screen-reader checks remain outstanding.

### Verification for this pass

- **202 tests passed, 0 failed across 27 files**, rerun after the last code edits.
- **50 content route files have complete leaf metadata** (title, description, Open Graph title/description/type and Twitter card); no placeholder index is present, and the existing root alias remains unchanged.
- Public /auth and isolated live-served shared controls checked at **1280×1800, 1146×682 and 390×844**.
- Search entry, status selection, direct tab switching, delete cancellation and delete confirmation all passed; cancellation preserved the harness record. No document-width overflow or page errors in the final runs.
- Screenshots of desktop/mobile controls and mobile confirmation were visually inspected. This sample uses synthetic records and does not claim a real quotation was deleted or saved.
- Latest available preview compiler entry: **build OK**.
- No database, RLS, storage objects, claim templates, statutory rates, payroll formulas or authentication settings changed.

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