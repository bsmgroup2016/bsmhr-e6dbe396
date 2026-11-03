# Safe archive and clean — approval required

## Short summary

Keep everyday HR and financial records in Supabase. Move only approved old tracking, chat and audit history into private compressed files in your existing R2 bucket. Delete the original rows only after reading back and verifying the archive.

**Your database is not close to full.** The earlier project-wide measurement today was 35.02 MB of your stated 500 MB allowance. These rules currently cover only **about 0.038 MB of old row content**. This is protection against future growth, not a large immediate saving.

**Nothing has been implemented or deleted.** Only read-only measurements and source checks were performed; this written plan is the only project file added. Approval would permit implementation, not an immediate first deletion: the first real cleanup would follow a dry-run report and separate confirmation.

## 1. Proposed rules

| Records | Proposed rule | Action |
|---|---|---|
| `cron.job_run_details` | Finished runs older than 7 days, using their end date. Never touch running jobs, job definitions or schedules. | Delete only |
| `api_rate_limits` | Expired counter windows older than 7 days. Preserve active windows and the existing rate-limit protection. Existing opportunistic two-hour cleanup remains unchanged. | Delete only |
| `ai_crawl_runs` | Finished runs older than **30 days**, keeping the latest successful run even if older. Never touch running crawls, training settings or knowledge. | Delete only |
| `driver_task_pings` | Location points recorded more than 60 days ago. | Archive, verify, then delete |
| `live_chats` + `live_chat_messages` | **Closed** conversations whose creation, last update and every message are older than 90 days. Archive conversation details and messages together. | Archive, verify, then delete |
| `audit_logs` | Events older than 12 calendar months. | Archive, verify, then delete |

**The 7-day expired-counter rule, 30-day crawl rule and closed-only chat safeguard are proposals for your approval.** An old conversation is not necessarily finished. Your current conversation is marked `human`, not `closed`; it would be preserved. Stale open conversations would be reported, not silently closed or removed.

**Never touch:** employees, companies, profiles, user_roles, payroll_entries, attendance, contracts, claims, invoices, documents or loans. Employee document records, R2 file references, existing uploads and all other unlisted tables are also excluded. No deleting parent tasks or employees to clear location points. No permission changes, destructive schema changes or native-mobile work.

Add an admin “Keep — do not clean” exception for conversations, location records or audit history needed for a dispute, investigation or legal obligation. A held chat protects all its messages. Holds must be checked before both archiving and deleting. Age alone does not establish Singapore legal retention requirements; these periods need your business approval.

## 2. What these rules would save today

Read-only measurements: **3 November 2026, approximately 03:30 UTC**. 1 MB means 1,000,000 bytes.

| Rule | Eligible rows now, before any business holds | Old row content removable | Current whole table footprint, including indexes |
|---|---:|---:|---:|
| Finished cron runs >7 days | 88 | **0.011968 MB** | About 0.074 MB in the earlier measurement today |
| Expired rate counters >7 days | 0 | **0 MB** | 0.082 MB |
| Finished crawl runs >30 days | 0 | **0 MB** | 0.033 MB |
| Driver location points >60 days | 198 | **0.025989 MB** | 0.131 MB |
| Closed chats and their messages >90 days | 0 | **0 MB** | 0.115 MB combined |
| Audit events >12 calendar months | 0 | **0 MB** | 0.205 MB |
| **Total** | **286 rows** | **0.037957 MB** | Not all table space can be removed |

These are measured row-content amounts, **not a promise that the dashboard will drop by that amount**. Deleting old rows normally leaves room that Supabase can reuse for new rows. The database's displayed size may not immediately shrink. Do not add a table rewrite or forced shrink operation; it can interrupt work and is not justified here.

The current main database measured 19.746 MB; the earlier 35.02 MB figure included platform template databases too. Those platform databases are not cleanup targets.

## 3. R2 location, size and privacy

Use the existing **main bucket `hrm`**, not the secondary bucket reserved for time-card scans and attendance selfies. No new bucket or Cloudflare deployment is proposed.

Example private folder layout:

```text
hrm/
  archives/v1/driver_task_pings/2026/11/<run-id>/batch-0001.jsonl.gz
  archives/v1/live-chat/2026/11/<run-id>/batch-0001.jsonl.gz
  archives/v1/audit_logs/2026/11/<run-id>/batch-0001.jsonl.gz
  archives/v1/runs/2026/11/<run-id>/manifest.json
  archives/v1/catalog/2026-11.json
  archives/v1/control/settings.json
```

These are proposals, not files already uploaded. Each compressed file preserves every selected column and original record ID. Chat packages preserve both conversation details and their messages. A small accompanying manifest lists record counts, dates, file names, fingerprints, verification results and deletion progress.

**Measured example:** the 198 eligible driver points produce about **63.7 KB** of uncompressed JSON lines and **8.4 KB (0.0084 MB)** compressed. Final files include a little extra descriptive information. Larger files depend on actual message length and record contents; the dry run will show estimates rather than promise a fixed compression ratio.

Archives stay private and outside ordinary staff file browsing. The existing general file-download checks allow some non-admin staff access, so the archive system must use its own admin-only access checks, not simply expose these files through the normal document viewer. No public URLs, employee data in file names, browser-stored keys or automatic archive expiry.

R2 storage and request usage can cost money according to your account's allowance and pricing. Today's archive would be tiny, but future use is not guaranteed to be free.

## 4. Safety sequence

1. **Dry run first:** report cutoff dates, eligible counts, held/skipped records, estimated file sizes and affected tables. No uploads or deletions in this mode.
2. Fix the run's cutoff dates and prevent another cleanup from running at the same time.
3. Select a small, stable batch — initially at most **250 rows**, with a byte-size limit too. Store its exact record IDs and original content fingerprints.
4. Write a new compressed archive with a unique name. Never overwrite a previously verified archive.
5. Read the saved file back from R2. Decompress it, parse it and confirm **file existence, row counts, record IDs and content fingerprint**. An upload success alone is not enough.
6. Save the verified manifest and progress record successfully **before deletion**. If R2, verification or logging fails, stop; leave Supabase rows untouched.
7. Recheck age, holds, content and related records immediately before deletion. Remove only the exact unchanged archived rows, in a short transaction. Skip changed records and archive them again later if still eligible.
8. Record the confirmed deletion count. On interruption, use the same manifest to reconcile remaining rows; never assume a timed-out deletion succeeded or blindly repeat it.
9. Finish with a small summary: date, table, archived/deleted/skipped counts, R2 file names and status. Alert the admin about failures.

**Chat safeguard:** deleting a conversation automatically deletes its messages in the current database. Archive and explicitly remove verified old messages in bounded batches first. Remove the conversation only when no messages remain and it is still closed and unchanged. If a new message arrives or the conversation reopens, preserve it. Implementation must test concurrent chat writes so no unarchived message can disappear through that automatic deletion.

Delete-only rules still use exact IDs or counter keys, small batches, age/status checks and a saved progress record. They do not produce recovery archives; that is an explicit difference to approve.

## 5. Admin view and old-data retrieval

Proposed location: **Settings → Archive & Clean**, visible and usable only by admins.

- Controls: **Dry run**, **Run now**, monthly on/off, **Pause**, and approved retention settings.
- Preview: eligible rows, estimated size, protected records and latest outcome. Manual cleanup has a confirmation showing the actual proposed counts.
- Archive browser: filter by record type, covered date range and run date; show verified counts and download the compressed original or a readable export.
- Old chats can be viewed as conversations; location and audit records as dated rows. Search by driver/task/chat identifier can read only the selected archive files, without copying everything back into Supabase.
- Downloads require a fresh admin check. Temporary download links expire; staff do not get access.
- No automatic restore into live tables. Any future restore requires a separate review to avoid duplicate records and conflicting relationships.

Keep the detailed progress and manifests in R2, **not a new growing Supabase log table**. Use one compact catalog per month containing counts and file references, not duplicated data. Detailed information can be loaded only when requested. Keep temporary coordination state bounded; verified manifests remain with their archives for recovery.

## 6. Automatic or manual operation

Propose **both**: a manual admin button and an optional monthly run, initially switched off.

Suggested schedule: **first Sunday of each month at 02:00 Singapore time**. Turn it on only after the first dry run, admin confirmation and successful small trial. Only the approved rules run; the scheduled caller must prove it is the authorised scheduler. Changes to retention or held records require admin access.

A monthly run means a “7-day” cleanup rule is a cutoff at each run, not a guarantee of exactly seven retained days. Some logs can remain for roughly five weeks before the next monthly run. The same extra month can apply to other rules. More frequent delete-only cleanup would require separate approval.

Work proceeds in bounded steps, with saved progress between steps; it must not depend on keeping the Settings page open or one enormous request completing. Runs pause on failures and can resume safely.

## 7. Driver ping frequency

**The current browser/WebView app does not automatically save a location every 20 seconds.** It saves a point when the driver taps **Share location** or changes task status.

- Browser actions: `src/routes/_authenticated/driver-dispatch.tsx`, `shareLocation` and `advance`.
- Actual row save: `src/lib/driver-trail.ts`, `recordPing`.
- GPS capture: `src/lib/geo.ts`, `capturePoint`, using a one-off location request.
- The 20-second timer in the driver screen **downloads updates; it does not save GPS points**. Changing it would affect downloads/freshness, not database row growth.

**Proposal:** leave frequency unchanged for now. If repeated manual shares become a problem, separately approve a short cooldown for Share location only. Keep every task-status milestone location. No native-mobile endpoints or driver code changes belong to this archive phase.

## Technical implementation and acceptance checks

- Implement a dedicated server-only archive module using the existing R2 credentials, with a fixed table allowlist; never accept arbitrary table names or deletion conditions from a browser.
- Use Worker-compatible gzip processing, capped payload sizes and resumable steps. Use stable ID/date paging, not offset paging while deleting.
- Verify current live constraints before implementation. Incoming-reference checks currently found the chat-to-message cascade; no other incoming references to the targets were returned.
- Store settings, holds, manifests and compact catalogs under the private R2 archive prefix, avoiding new schema or permission changes. Durable coordination and transaction safeguards must be tested before enabling automation; any necessary schema change outside this design must be presented for approval first.
- Test upload/read-back/count/fingerprint failure: **zero deletion**. Test a changed row, newly added chat message, reopened chat, hold, concurrent runs, partial completion and safe resume.
- Test cutoff boundaries, active counter/crawl protection, latest-success preservation, batches of at most 250 rows and exact-ID deletion.
- Test every protected table remains untouched. Verify non-admins cannot run, browse or download archives; no changes to existing RLS.
- Download and read back a trial archive before a confirmed small cleanup. Verify live rows and manifest counts afterwards, then inspect surviving pages.

## Approval requested

Approve or revise the proposed expired-counter and crawl periods, closed-only chat safeguard, main-bucket folder, 250-row maximum and monthly schedule. No real deletion will run until you have seen the dry-run counts and confirmed the first cleanup.