# Full-section UI/UX and workflow audit

## Zenova dashboard presentation

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