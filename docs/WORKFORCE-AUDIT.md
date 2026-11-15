# Workforce audit — 15 November 2026

## Coverage and fixes

- Worker list, search, pagination, full filter reset, quick view, profile links, manual/IPA registration, editing and removal were inspected.
- Workforce and profile forms now await a caller-permitted saved-row response before reporting success. Failed edits/removals leave the record visible; failed registration leaves the form open.
- Branch/company selection resolves the actual employee company instead of silently using the current global company. Unknown branches report a recoverable error.
- New Workforce manual/import records default to Construction, preventing unfamiliar site trades from disappearing from the shared worker roster.
- Document registration waits for confirmation. A document-registration failure keeps the registration form and uploaded references; retry uses the already-created worker rather than creating a duplicate. Existing document references are deduplicated.
- Partial employee forms preserve fields not rendered. Partial import rows update supplied fields only, preventing blank salary/status/joining/trade columns from applying default resets.
- Skill level, skill certificate type/number/expiry now appear in Work pass & Certificate, separately from CSOC, and save through the existing employee mapping.
- IPA/document reading exceptions release the reading indicator and offer retry; existing values remain protected by blank-only autofill.
- Directory/profile changes subscribe to employee store updates. Profile editing no longer remounts on every store event, which previously risked discarding unsaved input.
- Expiry summary uses confirmed Work Permit expiry with pass expiry fallback, consistently with list badges. All filter dimensions reset together.
- Workforce Excel/CSV rows include IPA detail fields and company name.
- Particular PDF/ZIP bytes use the authenticated same-origin file read rather than cross-origin signed fetch/fake download fallback. View opens its tab before awaiting the signed link.
- Removal dialogs explicitly warn about related records and point to existing profile Archive for history retention. No business records were deleted during this audit.

## Verification

- 240 tests passed, including controlled create/edit failure, document retry/deduplication, delete failure/success, selected-company resolution, blank import protection, form payload preservation, skill fields, IPA mapping and the existing claim regressions.
- Controlled browser test populated the actual Workforce component without bypassing live permissions: tab-switch edits survived; Particular and ZIP downloads matched controlled source bytes; cancelled/failed deletion retained the worker; confirmed deletion removed it; no page errors.
- Latest preview build passed. Existing Workforce/profile route metadata remains app-specific.

## Not verified / remaining boundaries

- The real browser navigation to `/workforce` redirected to `/auth`; an authorized external account session was unavailable. Controlled component tests are not a live signed-in check.
- Live IPA provider extraction, R2 upload, employee/document read-back through production permissions, cross-section persisted propagation and import project-assignment save are not certified by this audit.
- Existing generic assignment mutations still use optimistic writes. Import employee save is confirmed, but project linking remains an unconfirmed existing path and needs controlled live verification before being called reliable.
- Hard employee deletion may cascade through existing database foreign keys; this audit neither changed schema nor deleted real workers. Use Archive when retaining operational history is required.
- Older global employee mutation callers outside Workforce still use their existing optimistic API. No unrelated sections were rewritten.
- iOS/Safari download behavior and the populated mobile full-screen workflow are not certified by the desktop download test.

These boundaries prevent a defensible claim that the entire section is 100% verified.