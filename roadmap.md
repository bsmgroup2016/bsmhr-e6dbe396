# Full-section UI/UX and workflow audit

- [ ] Inventory every section and trace navigation, data dependencies, and connected actions without changing business records.
- [ ] Run existing automated checks and inspect desktop/mobile pages; record what cannot be verified without a signed-in session.
- [ ] Improve confirmed UI/UX problems using shared controls, preserving business calculations, templates, roles and storage.
- [ ] Verify changed interactions and document section coverage, outstanding findings and blockers.

# Claim sheet dated preview

- [x] Add a worker-by-worker, date-ordered preview before generation using the same approved rows as Excel.
- [x] Test holidays, partial-month ranges, approved edits and visibly excluded rows (22 tests passed).
- [x] Verify isolated desktop/mobile preview, sorted Sunday hours, and review/generate controls; real signed-in generation remains unverified because no session is available.

## Claim expansion total correction

- [x] Reproduce the last original worker's range total absorbing added workers.
- [x] Keep per-worker ranges bounded while extending sheet-wide totals.
- [x] Verify generated and saved Excel totals with 15 original slots and 25 workers: each worker totals 11 hours, grand total 275; all 16 related tests pass.