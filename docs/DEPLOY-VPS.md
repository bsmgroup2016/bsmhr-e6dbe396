# Deploy BSM Workforce on Node.js behind Caddy

The existing `build` command and Lovable/Cloudflare deployment remain the default. Node is an additional deployment target, not a database migration. Use Node.js 22 LTS or newer and keep the existing Supabase and R2 services.

## Environment variable names

Keep secrets in your process manager's protected environment file, outside the repository. Never use `VITE_` for private credentials.

Required for existing privileged features:

- `SB_SERVICE_ROLE_KEY` — the service-role credential for the configured database; server only.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — main file bucket.
- `R2_SCANS_ACCOUNT_ID`, `R2_SCANS_ACCESS_KEY_ID`, `R2_SCANS_SECRET_ACCESS_KEY`, `R2_SCANS_BUCKET_NAME` — preserve the separate scans/selfies bucket.

Optional public connection overrides (current defaults are kept when absent):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — server, read at request time.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — browser, supplied before building.

If changing database endpoints, set both pairs consistently. An anon key is public; a service-role key is never public. Browser configuration is baked into the build and needs a rebuild to change.

Existing integration variables, required only when those integrations are enabled:

- `CRON_SECRET` — authenticated scheduled endpoints.
- `HR_BRAIN_API_KEY`, `HR_BRAIN_BASE_URL` — AI Brain.
- `BREVO_API_KEY` — Brevo delivery checks.
- `RESEND_API_KEY`, `RESEND_FROM` — optional email backup.
- `GOOGLE_MAPS_API_KEY` — existing map/geocoding integration.
- `FCM_SERVICE_ACCOUNT_JSON` — existing optional push integration.
- Any additional names configured in `api_integrations.env_key` — enabled OCR/chatbot/Excel providers; reuse the current secure values.

SMTP hosts, ports, credentials, sender identities, limits and priority remain in the existing protected database settings. No new SMTP environment variables are needed. Node uses Nodemailer; Cloudflare uses the existing Worker mailer. Both share the existing server pool, cooldown and failover logic. Local Vite preview retains its SMTP safety restriction.

Node process variables:

- `NODE_ENV` — production mode.
- `HOST` or `NITRO_HOST` — bind to loopback behind Caddy.
- `PORT` or `NITRO_PORT` — listening port; use port **3000**.
- `NITRO_PRESET` — selected automatically by `build:node`.

## Build and run

From a clean checkout on the VPS (not the Lovable build sandbox):

```sh
npm install
npm run build:node
npm run start:node
```

Supply the protected environment to both the build process (public `VITE_` variables) and the running service (server variables). Set the service to production, loopback, port 3000 using the variable names above. Run `start:node` under systemd or another process supervisor so it restarts on failure and after reboot. The Node entry is `.output/server/index.mjs`; deploy the complete `.output` folder, including public assets. Do not run Vite's development server in production.

`build:node` uses cross-env to set the Node preset on Windows, macOS and Linux. Lovable's sandbox intentionally forces its Cloudflare target: test the Node build on the VPS or in external CI. Ordinary `npm run build` is unchanged.

## Caddy

Use your real application hostname in place of `app.example.com`:

```caddyfile
app.example.com {
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1
    }
}
```

Caddy terminates HTTPS and proxies to Node on port 3000. Do not expose Node directly to the internet. Disable buffering for streaming OCR/chat responses and allow long-lived requests in any additional proxy/load balancer. Preserve Supabase Auth's allowed site/redirect URLs for whichever application hostname is used; no database/RLS changes are required by this deployment support.

## Smoke tests before switching traffic

```sh
curl --fail http://127.0.0.1:3000/api/public/health
curl --fail https://app.example.com/api/public/health
```

Both must return `{"ok":true}` without database access. This is a process health check, not proof that database, email or R2 services are healthy.

Then verify real sign-in, role-restricted Settings, SMTP test and delivery status, attendance check-in/out, R2 upload/download, streamed OCR and Excel exports. Keep the Cloudflare deployment until these pass. Node SMTP requires outbound access to the saved SMTP ports and valid TLS certificates. The runtime adapter does not bypass provider restrictions.

OCR continues to execute while the live heartbeat response is open and stores its existing owner-scoped results in R2. It uses no runtime background context; neither deployment promises durable completion after disconnection or process shutdown. No feature calculations, schema, migrations or RLS policies are changed.
