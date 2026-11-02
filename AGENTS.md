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
