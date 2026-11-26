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

Validation: three runtime-loader tests passed; preview build reports OK; unsigned SMTP Test POST returns 401. No authenticated Hostinger delivery or published-runtime test was performed. Publish and test the saved server on the live site to verify actual delivery. No passwords, server settings, sent records or existing cooldowns were changed.