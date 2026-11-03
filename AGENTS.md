<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Account security forms live in focused Settings components and use the signed-in browser auth client with current-password verification, so credential changes never require privileged keys in the browser.
- Shared role access rules live in src/core/access.ts and deny unlisted routes by default; web navigation reuses them, while RLS and authenticated API checks enforce data access independently.
- Role assignments use an admin-verified endpoint backed by an atomic database RPC, so a failed replacement cannot silently remove existing permissions.
- Time-card scans and attendance selfies (folders in SCAN_FOLDERS) are written to a secondary R2 bucket (R2_SCANS_*); reads try it first then fall back to the main bucket, so older files keep working.
- OCR and chatbot provider lists (URL, model, key override, on/off, fallback order) live in the service-role-only api_integrations table, edited via admin-only /api/public/api-integrations; keys fall back to platform secrets named in env_key and are never returned to the browser.
- SMTP servers live in the service-role-only smtp_servers table (priority order, daily limit, cooldown) managed via admin-only /api/public/smtp-servers; sending walks ready servers in order and puts failing ones on cooldown so the next takes over, with Resend as optional backup.
- Live chat: tables live_chats/live_chat_messages are service-role-only; all access goes through /api/public/live-chat (agents = admin/manager/hr), AI replies reuse runAssistant with the caller's session.
- Chatbot training: ai_knowledge/ai_crawl_runs/ai_training_settings are service-role-only, managed via admin-only /api/public/ai-training; an hourly pg_cron tick (x-cron-secret) crawls when due, and runAssistant appends enabled notes/skills/table map to its system prompt.
- Assistant insights: src/lib/insights.server.ts computes expiries and project attendance shortfalls with the caller's session; reused by the workforce_alerts tool, get_worker_files (1-hour R2 links after canAccessKey) and the staff popup endpoint /api/public/ai-alerts.
- Staff Excel download controls share one component and CDN-hosted provisional templates; payroll exports remain derived reports, not editable persisted payroll rows.
- Page data uses an explicit collection dependency map and an identity/company browser cache over caller-RLS API v1 reads; only confirmed writes invalidate affected tables, to avoid navigation-wide reloads.
- Attendance and issuance list pages use server pagination and exact counts; derived summaries and exports traverse every page, so the REST response cap cannot truncate totals.
- Known absent tables are guarded and their features hidden or reported unavailable, rather than requested or treated as empty success.
- Chat history uses newest-first timestamp/id cursor reads and chronological deduplicated display; audit logs use fixed-size caller-RLS ranges, preventing repeated growing-list downloads.
- Storage metadata registration must succeed before upload success is returned; P-file references clear only after successful storage deletion, preserving references on failure.
- PWA uses generated static precaching plus NetworkOnly navigation fallback to offline.html, never cached HTML/data responses; one preview-guarded registrar offers consent-based updates and hourly checks to avoid interrupting work.
- Archive cleanup uses a fixed server-side allowlist, private R2 progress and read-back verification followed by exact-row atomic RPC checks; automation stays off until first-run confirmation and controlled end-to-end checks, preventing unverified or cascading deletion.
- Time-card OCR preserves printed identity/site names in structured day entries and claim snapshots; project selection is optional, site text required, and only unique matches attach IDs, preventing demo attribution without schema changes.
- Time-card review uses a modal and separate finalize/approve actions; finalization only verifies the card, so claim creation requires explicit approval afterwards.
- Claim Excel exports fill a sanitized CDN copy of the user's blank TEMPLATE sheet (one sheet per project, fixed worker slots, daily G-HRS/OT rows) via dynamic ExcelJS; unknown values and all rates stay blank and sample workers are never imported, to preserve formatting without contaminating live data.
- Employee creation uses a registration-method wrapper around the existing EmployeeForm; editing uses EmployeeForm directly to preserve existing edit behavior.
- IPA extraction uses one field registry for editable forms, projections and DB mapping; employer/application particulars stay separate from worker contacts and statutory settings. Unmatched details remain in notes and source files in R2. Monthly/weekly/rest-day terms never become operational daily payroll rates/hours; worker daily rates require explicit entry.
- Employee document autofill uses source-specific allowlists and fills only empty editable fields; passport/permit uploads use existing employee_documents records while CSOC uses existing safety-course fields, avoiding new schema and mixed-up expiries.
- Employee OCR understands document abbreviations server-side before source-specific mapping; CSOC uploads retain their source in existing employee_documents and map only safety fields, keeping permit/passport dates isolated.
- Employee photo and document controls opt into FileUpload display modes using signed image reads and authenticated blob downloads; document labels are configurable and replacement retains the previous reference until upload succeeds, without deleting stored files.
- EmployeeForm groups employer fields under Employment and uploads/history under Documents; Bank Card uses existing Bank Letter records with a distinct name, and saved history is read-only to avoid duplicate registrations or destructive replacement.
- Work Permit estimates are derived for display/export from the existing issue date through one shared pure helper; they are never saved or imported as official expiry and never feed confirmed-expiry alerts.

## Permanent data placement rules

- Keep searched, filtered, calculated and operational records in the user's own Supabase database: auth users and roles; employees, companies, departments, designations; attendance, leave, payroll entries, loans and repayments; claims, training, safety incidents; clients, projects, sites, invoices, quotations, payments, contracts; inventory, assets, purchase orders; and settings. These records require live relational queries, not file-based archives.
- Store only file keys/URLs (including file_url, file_key, photo_url and p_file_url) and small storage_objects metadata in Supabase; never persist file contents, base64, large binary payloads or large JSON blobs there. Small structured application data is distinct from file payloads; any large snapshot or raw extraction must be stored in R2 with a database reference to prevent uncontrolled database growth.
- Store photos, logos, selfies, scans, time-card images, P-files, IPA files, contract files, certificates, claim documents, signatures, database backup files, old Excel/PDF exports and approved compressed historical archives in Cloudflare R2. Use the existing secondary scans bucket only for time-card scans and attendance selfies; use the main bucket for other files and archives to preserve the storage split.
- Archive cleanup may touch only explicitly approved historical tracking/chat/audit and expired operational-log rules. Never archive or delete employees, companies, profiles, user_roles, payroll_entries, attendance, contracts, claims, invoices, documents, loans, training or assets in this cleanup scope; all unlisted tables are excluded to protect live business data.
- Age-based archive cleanup must verify uploaded files by read-back, row counts, record identity and contents before bounded exact-row deletion; dry runs do not write or delete. Archive access is admin-only, and existing table RLS/permissions must not change, because cleanup must not weaken data access or destroy unverified records.
