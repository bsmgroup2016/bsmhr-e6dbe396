# SMTP runtime correction

Rule: a preview limitation must not appear as a Hostinger credential failure or put working mail servers on cooldown; email is marked sent only after the transport succeeds.

Code-read coverage:
- Settings SMTP Test: `smtp-settings.tsx` displays the endpoint's success/error; `smtp-servers.ts` invokes the shared sender and reports failure without changing delivery counters. Follows the rule through the corrected sender.
- SMTP pool: `smtp.server.ts` now rejects local-preview transport loading before importing the mailer and bypasses provider cooldown for that environment error. Real SMTP failures still follow existing cooldown/failover rules.
- General mail/failover: `email.server.ts` calls the same pool, awaits successful delivery and retains the owner's existing Resend/SMTP preference. Follows the rule through the corrected pool.
- Leave decisions: `notify-leave.ts` awaits general mail and returns failure on rejection; does not undo the leave decision. Follows the rule.
- Daily expiry/leave/invoice digest: `send-alerts.ts` records sent count only after general mail succeeds. Follows the rule.
- Automation expiry/clock-in/IR21/quota/payroll digest: the sending block in `automation-run.server.ts` returns `emailError` and no sent count on failure, without undoing operational work. Follows the rule.
- Repository searches found no direct SMTP sender or socket import outside the shared sender, and no SMTP/email SQL functions in `db/migrations`.

Vite now bundles `worker-mailer` rather than loading its CommonJS entry via Node require. Local SMTP sending remains unavailable; this is an explicit restriction, not a claim that preview mail delivery works.

## Production packaging follow-up

Rule: saved SMTP support must not prevent the app from building for publication.

Nitro replaces the top-level bundler options in its final server environment, so the native socket exception now uses a pre-resolution plugin shared by all bundling passes. Only `cloudflare:sockets` is preserved as a native import; the mailer remains embedded. This correction is shared by Settings SMTP Test, the SMTP pool, general email/failover, leave-decision emails, daily alerts and automation digests. Their call sites were re-read and all use the same sender; there are no separate socket imports or database SMTP functions in the migration search. No additional email-path changes were needed.

Five focused tests pass, including bundling the actual mailer with the production bundler and checking its native socket import and embedded implementation. The latest automatic preview build reports OK. A fresh full production deployment and actual email delivery remain unverified until publication is retried. No credentials, preferences, permissions or previously sent records were changed.

Validation: three runtime-loader tests passed; preview build reports OK; unsigned SMTP Test POST returns 401. No authenticated Hostinger delivery or published-runtime test was performed. Publish and test the saved server on the live site to verify actual delivery. No passwords, server settings, sent records or existing cooldowns were changed.