# Shared Backend for Web + Flutter (Android / iOS)

The backend is client-agnostic. The React web app is just the first client;
native Flutter apps use the same auth, the same endpoints and the same rules.
No PWA dependency.

## 1. Architecture

Supabase Auth (JWT) + Postgres (RLS)
  -> /api/public/v1/* : versioned HTTP contract
  -> src/core         : pure shared business rules
  -> clients          : React web, Flutter Android/iOS

- `src/core` = pure business rules (payroll, CPF, levy, OT, MOM compliance),
  executed on the server so no client re-implements them.
- `src/routes/api/public/v1/*` = the stable HTTP contract for every client.
- `src/lib/api-client.ts` = the web app's typed client for those endpoints.

## 2. Auth (identical on web and mobile)

Flutter uses `supabase_flutter`:

    await Supabase.initialize(
      url: 'https://thrfyeyqafmdnpexgmlc.supabase.co',
      anonKey: '<publishable anon key>',
    );
    final token = Supabase.instance.client.auth.currentSession!.accessToken;

Then send `Authorization: Bearer <token>` on every request. The server
validates the token with Supabase Auth and queries **as that user**, so RLS
and role checks behave exactly as on web.

## 3. Base URLs

| Environment | Base URL |
| --- | --- |
| Production | `https://hello-world-joy-010.lovable.app/api/public/v1` |
| Preview | `https://project--8a11253f-28d2-4bb4-821d-07f8588d6127-dev.lovable.app/api/public/v1` |

Stable per build flavour, unaffected by project renames.

## 4. Response envelope

Success: `{ "ok": true, "data": ..., "meta": { "total", "limit", "offset", "hasMore" } }`

Failure: `{ "ok": false, "error": { "code": "...", "message": "..." } }`

Codes: `unauthorized`, `forbidden`, `not_found`, `bad_request`,
`upstream_error`, `network_error`.

## 5. Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/meta` | Version + capability discovery (no auth) |
| GET | `/me` | Identity, roles, linked worker profile, companies |
| GET | `/employees` | `limit,offset,search,companyId,status` — staff roles only |
| GET | `/employees/:id` | Workers may read only their own record |
| GET | `/attendance` | `employeeId,from,to` — workers scoped to self |
| POST | `/attendance` | GPS punch in/out (`checkIn`/`checkOut`, `lat`, `lng`) |
| GET | `/leave` | `status,employeeId` |
| POST | `/leave` | Apply for leave |
| GET | `/payroll` | `month,employeeId` — payslip history |
| GET | `/projects` | Staff roles only |
| GET | `/clients` | admin / hr / manager only |
| GET | `/driver/tasks` | Driver app job list. `open=1`, `status`, `from`, `to`, `driverId` (staff only). Drivers scoped to self |
| GET | `/driver/tasks/:id` | Single task; drivers may read only their own |
| PATCH | `/driver/tasks/:id` | Driver progresses the trip: `status`, `note`, `lat`, `lng`, `speedKmh` (a position also writes a breadcrumb) |
| GET | `/driver/pings` | `taskId` — GPS trail for route replay |
| POST | `/driver/pings` | Single ping or offline batch (`pings: [{lat,lng,recordedAt,speedKmh,status}]`, max 500) — also updates the task's last known position |

Every collection endpoint is paginated (`limit` max 200) — essential on mobile.

## 6. Versioning rules

- Never change the meaning of an existing v1 field; add new fields instead.
- Breaking changes go to `/api/public/v2/*`; v1 keeps working until old app
  builds are retired (mobile users cannot be force-updated instantly).
- Bump `API_VERSION` in `src/lib/api-v1.server.ts` and publish the minimum
  supported client in `/meta` so old builds can show "update required".

## 7. Rules for future work (keep mobile viable)

1. New business rule goes into `src/core`, is exposed through v1, then used by
   the UI. Never write the rule inside a page component.
2. New screen needing data extends a v1 endpoint instead of adding another
   browser-only Supabase query path mobile cannot reuse.
3. Files always go through the R2 signed-URL endpoints, which work from any
   HTTP client.
4. PDFs and reports mobile needs are generated server-side and returned as a
   URL, not only in the browser.