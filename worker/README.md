# BSM Storage Worker (Cloudflare R2)

All uploaded files (work permits, ICs, safety certs, time cards) live in R2.
Supabase only stores the resulting URL.

## Deploy

1. Cloudflare dashboard -> R2 -> Create bucket, name it `bsm-files`.
2. Workers & Pages -> Create -> connect this GitHub repo, root directory `worker`
   (or run `npx wrangler deploy` from the `worker/` folder).
3. Worker -> Settings -> Variables:
   - `UPLOAD_TOKEN` (encrypted) — a long random string
   - `PUBLIC_BASE` — your bucket's public/custom domain, e.g. `https://files.yourdomain.com`
     (leave empty to serve files through the Worker at `/file/<key>`)
   - `ALLOWED_ORIGIN` — your app origins, comma separated
4. Worker -> Settings -> Bindings: R2 bucket binding `BUCKET` -> `bsm-files`.

## Connect the app

In the app: Settings -> Storage -> paste the Worker URL
(`https://bsm-storage.<subdomain>.workers.dev`) and the same `UPLOAD_TOKEN`, then Save.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/upload` | form-data `file`, `folder` | `{ url, key, size, contentType }` |
| POST | `/delete` | json `{ key }` | `{ ok: true }` |
| GET | `/file/<key>` | — | file stream (for private buckets) |

Uploads require the `x-upload-token` header.
