# Full-section UI/UX and workflow audit

## Onboard & Issuence

- [x] Add separate workforce section with IPA registration, Excel/CSV worksheet and positional column mapping, company/stage filters and booking/issuance controls.
- [x] Keep one employee ID and IPA reference throughout; block worker-roster availability until onboarding completes, preserve actual permit data and validate tracking server-side.
- [x] Run 26 focused regression tests; preview build clean and live signed-out access redirects to sign-in without page errors.
- [ ] Verify real signed-in IPA registration, Excel import, status save and read-back. Blocker: no authorized external-account session is available; no production test workers were created.

## Pluto branch prefixes

- [x] Keep Pluto Pte 01 linked to P and add Pluto Pte 02 linked to PC under the existing Pluto company; no employee rows or other branches changed.
- [x] Both branches read back correctly; twelve prefix/company tests pass and preview build is clean. Real signed-in worker creation remains unverified without an authorized account session.

## Permission verification recovery

- [x] Retry transient role-read failures without bypassing permissions; show recoverable errors instead of a blank page or unassigned-user view, with SDK retries disabled to keep attempts bounded.
- [x] Twelve permission/access tests pass; controlled browser failure shows Try again and a successful retry opens Settings without page errors; preview build clean.
- [ ] Verify real account permission recovery. Blocker: no authorized external-account browser session is available.

## Unified storage settings

- [x] Merge Storage, Media and Archive & Clean into one Storage & Media page, with file browsing first; preserve existing admin restrictions and all file actions without deleting files.
- [x] Preview build is clean; 19 media/archive safety tests pass; live Settings redirects to sign-in without page errors.
- [ ] Verify combined-page layout with real account access. Blocker: no authorized external-account browser session.

## Media file management

- [x] Rename the Media folder label to Particulars; delete the exact five screenshot PDFs, verify absence, clear exact employee references and confirm both claim-template objects unchanged.
- [x] Add admin-only bucket-specific upload/delete, preserve claim templates and storage placement, and verify writes before success; seven focused tests pass, unauthenticated GET/POST/DELETE return 401.
- [x] Add all-file browsing, image/PDF/Excel previews, downloads and delete confirmation; controlled upload/CSV preview/cancel/delete and mobile layout pass without page errors; preview build clean.
- [ ] Verify real signed-in upload, preview and deletion. Blocker: external account has no authorized browser session.

## Claim workflow filter bar

- [x] Add one filter bar (claim month, search, company, payroll status) above the three steps; search matches worker name, P-File, project, site or client and narrows the rows inside each company.
- [x] Filters drive the Excel too: combined and salary downloads contain only the filtered rows, and the file name names the selected company. Seven focused filter tests pass; project typecheck is clean.
- [ ] Verify signed-in filter interaction and browser downloads. Blocker: external account has no authorized session; live route redirects to /auth.

## Three-stage claim and salary workflow

- [x] Show company claim summaries, an all-company combined claim sheet, then a salary sheet; remove billing and AP/AR steps.
- [x] Six aggregation/workbook/payroll tests pass; combined Excel recalculates 51 formulas with zero errors, preserving claim templates and saved payroll.
- [ ] Verify signed-in workflow and browser downloads. Blocker: external account has no authorized session; live route redirects to /auth without runtime errors.
- [x] Owner confirmed Salary Sheet uses saved payroll, not recalculated claim-hour pay.
- [x] Show BSM Group followed by every registered company, including companies with no claims; preserve claim-only downloads and salary calculations.

## Dashboard chart placement and compliance overview

- [x] Move all charts and overview sections below operational items; add CSOC, confirmed Work Permit, passport and IPA issuance counts using existing records.
- [x] Seven focused count tests pass; controlled populated desktop/mobile chart rendering has no overflow or page errors and the preview build is clean.
- [ ] Verify real signed-in dashboard counts. Blocker: no authorized external-account browser session is available; the live dashboard redirects to sign-in.

## Dashboard company overview

- [x] Replace the welcome strip with BSM Group and automatically listed company cards sharing scoped issuance, confirmed expiry and recorded annual-wage metrics.
- [x] Connect group/company details; nine focused tests pass, controlled populated desktop/mobile cards and group/company link destinations verified without overflow or browser errors; preview build is clean.
- [ ] Verify real signed-in dashboard and company detail read-back. Blocker: no authorized external-account browser session is available.

## IPA side-by-side verification and duplicate warnings

- [x] Show original IPA pages beside extracted particulars and the editable form; require review confirmation and preserve missing/additional readings without invented confidence.
- [x] Check FIN, passport and P-File against fresh paginated caller-visible employee records before saving; require explicit identity-match acknowledgement and retain the existing unique P-File rule.
- [x] Validate isolated desktop/mobile image and two-page PDF rendering, page navigation and review confirmation with no overflow or page errors; focused matching/mapping/read-failure tests pass.
- [ ] Verify real signed-in IPA upload, source access, duplicate acknowledgement and employee save/read-back. Blocker: no authorized external-account browser session is available.

## Worker punch and returning-session reliability

- [x] Fix stale portal punch state, safe repeated punches, confirmed attendance read-back and auth refresh callback locking; 265 regression tests pass, signed-out portal redirects to /auth and attendance GET/POST return 401 with no browser page errors.
- [ ] Verify a real worker session through check-in, browser restart, checkout and read-back. Blocker: external account service has no authorized test browser session.

## Workforce section review — 18 November 2026

- [x] Review all eight Workforce menu sections, trace their connected actions and identify current defects without changing business records or application behaviour; recorded prioritized findings in docs/WORKFORCE-SECTIONS-REVIEW-2026-11-18.md.
- [x] Run existing regression tests and check live route access: 272 tests passed; all eight routes redirected to sign-in with no browser page errors. Authenticated save/OCR/download checks remain explicitly unverified; no authorized external-account browser session is available.

## Updated Antigravity Android handoff

- [x] Replace the old Android prompt with current worker login, blue–sky UI, attendance/leave/payslip/profile flows, secure WebView requirements and APK/AAB deliverables; distinguish unavailable push/offline-event features and outdated API examples.
- [x] Validate documentation against current source and provide a downloadable copy without modifying application behaviour; 14-section handoff checks passed and preview build is clean.

## Worker attendance submission error

- [x] Investigate the reported pre-handler 502: current direct requests reach the handler; daemon logs contain no underlying transform error.
- [x] Remove the absent event-table/proof-column dependency from direct portal punches only; retain QR/offline safeguards and existing authorization.
- [x] Verify 22 focused punch/data regressions; running endpoint reaches authentication rather than a pre-handler 502.
- [x] Trace captured 502s to gateway HTML, not a logged transform failure; handle non-JSON/malformed/error responses as unconfirmed saves without replaying attendance writes.
- [ ] Verify real signed-in worker check-in/check-out and UI read-back. Blocker: no authorized external-account browser session is available.

## User account lists

- [x] Make worker Username edits authoritative over alias-email fields, require account/profile read-back and show the saved login ID; 12 focused tests pass, preview build is clean and unauthenticated updates return 401. Real worker sign-in remains blocked by unavailable external account session below.

- [x] Shorten worker login IDs to names with collision suffixes, generate exactly 8-character passwords, and convert old generated IDs when admin sets a new password; focused tests cover length, names, collisions and old-ID conversion. Real external-account read-back remains blocked below.

- [x] Replace confusing pending badges with per-worker Create login & password controls; controlled desktop/mobile checks verified creation action and private credential dialog, with 17 tests passing. Real external-account login remains blocked below.

- [x] Show existing workers without logins, add admin-controlled account backfill and name-based login identifiers, and auto-create accounts after confirmed worker saves. Passwords are unique, not shared defaults.
- [x] Verify account retry/link rules, existing-account preservation, login identifiers and desktop/mobile controls with 17 passing tests and a controlled populated browser check; unauthenticated provisioning returns 401.
- [ ] Verify real signed-in account creation and worker login. Blocker: external account service has no authorized browser session; existing worker backfill awaits the admin's Create missing logins action.

- [x] Separate Admin & Staff, Worker App and Unassigned account tabs; preserve existing login and permissions.
- [x] Verify controlled populated tab separation, Employee creation default and desktop/mobile layout; 11 grouping/access tests pass and preview build is clean. Real signed-in account creation/login remains unverified because no authorized external account session is available.

## Navy brand colour

- [x] Replace the pink/rose accent with deep navy across buttons, links, sidebar overlay, charts and dashboard cards; keep semantic status colours (green present/available, red absent, amber leave).
- [x] Verify the isolated dashboard at 1206 and 390px: navy button and card inks measured, no overflow, no page errors, populated pie/bar/area charts intact.

## Colourful full dashboard

- [x] Apply the new SmartHR-inspired dashboard: saturated metric cards, subtle layered overlays, colour-coded operational panels and richer charts; preserve records and calculations.
- [x] Verify isolated populated bar/area/donut charts and empty states at desktop/mobile sizes, with no overflow or page errors; 12 data regression checks pass and preview build is clean. Real signed-in account data remains unverified because no external session is available.

## Zenova dashboard presentation

- [x] Match the newly supplied screenshot colours across sidebar, header and all pages; remove dark sidebar and dashboard-only pink overrides, preserving layouts and business logic.
- [x] Verify the isolated real sidebar is white, collapse/reopen works, and desktop/mobile layouts have no overflow or page errors; 12 data-loading tests pass and preview build is clean. Live account read-back remains unavailable without an authorized session.

- [x] Apply the selected light dashboard reference with compact coloured metrics, pending approvals and prominent charts; preserve all data and navigation.
- [x] Check isolated desktop/mobile layout (1280, 1206 and 390px), with no overflow or page errors; 12 data-loading tests pass and preview build is clean. Real signed-in dashboard remains unverified: no external account session is available.

## Workforce deep audit

- [x] Audit worker create/edit/remove/import, IPA autofill, documents/downloads and shared employee data; record findings in docs/WORKFORCE-AUDIT.md.
- [x] Fix confirmed save/company/partial-import/skill-field/filter/download defects with focused tests; preserve schema and permissions, without production writes.
- [x] Verify controlled populated tab edits, PDF/ZIP downloads, cancellation and failed/successful removal; 240 tests pass.
- [ ] Verify real signed-in IPA → worker/documents → cross-section read-back, import project links and iOS downloads. Blocker: no authorized external account browser session or controlled real test batch/device is available.

## ClaimSheet Generator only: batch reliability and UX

- [x] Add per-card CSV download for original readings, verified revisions, pending corrections and validation result/time; controlled browser download verified 30 CSV rows and exact original/corrected hours and UTC timestamps; 235 tests passed. Live account checks remain blocked below.

- [x] Ensure revalidated corrections reach Excel: 30-card saved-workbook read-back passed; original OCR and timestamped revision history survive entry mapping, manual values survive retry, and controlled desktop/mobile edit/revalidate/reopen checks passed with 232 regression tests. Live account read-back remains blocked below.

- [x] Add in-card manual correction/revalidation and shared filters for errors, retries and uncertain readings; controlled desktop/mobile tests cover edits, invalid dates, rechecking and fresh approval. Live account/OCR checks remain blocked below.

- [x] Add per-card OCR results, validation/retry status and explicit uncertainty confirmation; verify with controlled cards. Live provider/account checks remain blocked below.

- [x] Audit upload, review, approval, restoration, previews and Excel output for 20–30+ workers.
- [x] Fix confirmed page/workbook issues with focused regression tests and clear batch recovery states.
- [x] Verify actual-template 20/30/50-worker workbooks and isolated 30-card sequential review at three sizes; document live OCR/authentication limitations separately.
- [ ] Verify a real signed-in uploaded batch through saved claims and download. Blocker: no authorized external account-service session or controlled real test batch is available.

## Colour contrast

- [x] Improve shared text, control boundaries and semantic status contrast while preserving the palette.
- [x] Measure contrast and actual warning ink, inspect three desktop/mobile sizes and run 202 regression tests; signed-in populated pages remain blocked as documented below.

## Accessibility across updated sections

- [x] Audit keyboard access, accessible names and focus visibility in shared controls and updated pages.
- [x] Fix confirmed presentation issues without changing permissions, records or calculations.
- [x] Verify keyboard flows in shared controls and public pages at three sizes; document signed-in verification limitations in docs/UI-UX-AUDIT.md. 202 tests pass.

## Visible layouts across remaining sections

- [x] Give every operational section a prominent heading and section context, matching the clearer attendance page.
- [x] Replace floating summary tiles with open metric strips and make section tabs and data tables clearly differentiated; add page-specific refinements to workers, payroll, billing, clients, leave, quotations, training and Settings.
- [x] Verify shared layouts and controls at three desktop/mobile sizes; 202 tests pass and 50 routes retain metadata. Business logic, data and Excel templates unchanged; authenticated populated-page checks remain blocked as noted below.

## Second-pass premium usability audit

- [x] Re-audit every content section in three coverage groups plus a dashboard/company/reports deep pass; distinguish source findings from authenticated verification.
- [x] Improve shared visual hierarchy, form/table ergonomics, navigation and page-specific usability without changing business calculations or stored records.
- [x] Apply concrete safe fixes from each coverage group and record remaining functional blockers.
- [x] Run regression tests (202 passing), isolated desktop/mobile browser checks at three sizes and metadata coverage (50 content routes); update docs/UI-UX-AUDIT.md with improvements and remaining functional blockers.

- [x] Inventory all 48 authenticated route files and public account pages; trace section controls, dependencies and connected actions without changing business records.
- [x] Run automated checks: 202 passed; inspect public desktop/mobile pages and isolated shared controls, with no page errors or viewport clipping.
- [x] Improve shared navigation, quick-create, tabs, dialogs, retry/search states, employee links, honest settings/payroll/audit/delivery labels and MOM panel data dependencies; preserve calculations, templates, roles and storage.
- [x] Document coverage and remaining findings in docs/UI-UX-AUDIT.md; latest preview build is clean.
- [ ] Verify signed-in section flows and record read-back, then repair remaining persistence/approval/renewal/conversion/quantity issues under controlled tests. Blocker: external account service has no authorized browser test session or isolated business-record test environment available; no production writes or authentication bypass performed.

# Claim sheet dated preview

- [x] Add a worker-by-worker, date-ordered preview before generation using the same approved rows as Excel.
- [x] Test holidays, partial-month ranges, approved edits and visibly excluded rows (22 tests passed).
- [x] Verify isolated desktop/mobile preview, sorted Sunday hours, and review/generate controls; real signed-in generation remains unverified because no session is available.

## Claim expansion total correction

- [x] Reproduce the last original worker's range total absorbing added workers.
- [x] Keep per-worker ranges bounded while extending sheet-wide totals.
- [x] Verify generated and saved Excel totals with 15 original slots and 25 workers: each worker totals 11 hours, grand total 275; all 16 related tests pass.