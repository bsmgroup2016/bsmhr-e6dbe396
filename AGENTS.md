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
