# Archive & Clean — implementation status

The approved design is archived under `.lovable/plan/`. The new admin-only Settings tab provides count-only dry runs, explicit first-run confirmation, bounded cleanup steps, pause, holds, and an R2 archive browser/downloads.

## Safety and scope

- Only six named targets are permitted. No employee, payroll, attendance, contract, invoice, document, loan or role records are cleanup targets.
- Private main-bucket prefix: `archives/v1/`. Archives are gzip-compressed JSON envelopes (`.json.gz`) preserving complete original rows and chat messages, rather than JSON-lines files. Delete-only targets use temporary bounded progress files, removed after confirmed completion; there is no permanent recovery archive for these targets.
- Every payload is read back and compared before a deletion call. Short database transactions lock exact records and compare original JSON. Changed or held rows are preserved. Chat parents are locked and deleted only after no messages remain.
- R2 conditional writes coordinate steps. A lost response is reconciled by checking missing IDs; remaining records are skipped, not blindly deleted again. “Missing” can include another authorised deletion; counts are reconciliation results, not proof this run deleted those rows.
- Archive permissions are independent of ordinary document permissions. Only a verified signed-in admin can use actions or download private records. Scheduled responses expose no private data.
- The only database change is the explicitly approved `public.safe_archive_batch` function; its execution is restricted to service role. No tables or existing RLS rules changed.

## Activation gates

No first cleanup or archive upload was run during implementation. Automatic mode defaults to off. No scheduler has been provisioned yet. Before enabling production cleanup:

1. Publish the new controls and run a signed-in dry run.
2. Perform controlled R2 upload/read-back/conditional-write checks and transactional deletion tests with disposable fixtures, including concurrent writes, without touching existing HR records.
3. Confirm the actual first cleanup in Settings after checking holds.
4. Provision an authenticated recurring call to `/api/public/archive-tick` using the existing server-only `CRON_SECRET`; this tick can run every 10 minutes, but starts new runs only during the first Sunday 02:00 Singapore window. It advances bounded steps after a run starts. No scheduler credential belongs in source or browser settings.
5. Enable monthly mode only after a successful trial. Scheduling requires separate provisioning because the app must not claim an unconfigured schedule is operational.

Manual Continue processes one bounded step per click. Failed runs require an admin to review the error and resume; pending uncertain work reconciles rather than repeating deletion. The retained progress supports resumption without growing a Supabase log table.

## Verified checks

- Retention/allowlist/batch/default-off/content-verification tests.
- Live service-role count-only results: 88 finished job logs, 198 old driver pings, zero eligible other targets at the measurement time.
- Signed-out preview: archive download and cron tick both return 401.
- Installed routine preview runs; changed-record test executed in a rollback transaction.
- Existing data/PWA tests passed. Authenticated browser interaction, real R2 archives and deletion trials remain unverified; do not treat this as ready for automatic cleanup yet.

## Changed project files

- `src/core/archive-policy.ts`
- `src/core/archive-policy.test.ts`
- `src/lib/archive.server.ts`
- `src/lib/archive.functions.ts`
- `src/components/settings/archive-settings.tsx`
- `src/routes/_authenticated/settings.tsx`
- `src/routes/api/archive-download.ts`
- `src/routes/api/public/archive-tick.ts`
- `db/migrations/0073_safe_archive_routine.sql`
- `docs/ARCHIVE-CLEAN.md`
- `AGENTS.md`
- `roadmap.md`

The written plan was also added and archived. Existing R2 upload/delete and driver attendance/punch code was not modified.