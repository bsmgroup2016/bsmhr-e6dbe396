# Full-section UI/UX and workflow audit

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