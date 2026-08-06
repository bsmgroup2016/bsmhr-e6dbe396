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
| POST | `/attendance` | GPS punch in/out (`checkIn`/`checkOut`, `lat`, `lng`, `accuracyM`, `selfieKey`, optional `clientEventId`, `siteId`) |
| POST | `/attendance/sync` | Offline queue flush: `events: [...]` (max 200), idempotent per `clientEventId` |
| GET | `/leave` | `status,employeeId` |
| POST | `/leave` | Apply for leave. Optional `attachments: [key]` (MC / medical report) |
| GET | `/leave/:id` | Single request (workers: own only) |
| PATCH | `/leave/:id` | Attach MC (`attachments`, `replaceAttachments`), edit `reason`, worker `status: "Cancelled"`, staff `status: Approved/Rejected` + `remarks` |
| POST | `/uploads` | `multipart/form-data`: `file`, optional `folder` (`medical`, `leave`, `claims`, `documents`, `attendance`, `safety`, `profile`), `employeeId` (staff only). Returns `{ key, url, size, contentType }` |
| GET | `/uploads?key=` | 5-minute signed download URL for an object the caller may read |
| GET | `/payroll` | `month,employeeId` — payslip history |
| GET | `/payroll/:id/payslip` | Payslip **PDF bytes** (`application/pdf`); workers get only their own |
| GET | `/projects` | Staff roles only |
| GET | `/clients` | admin / hr / manager only |
| GET | `/driver/tasks` | Driver app job list. `open=1`, `status`, `from`, `to`, `driverId` (staff only). Drivers scoped to self |
| GET | `/driver/tasks/:id` | Single task; drivers may read only their own |
| PATCH | `/driver/tasks/:id` | Driver progresses the trip: `status`, `note`, `lat`, `lng`, `speedKmh` (a position also writes a breadcrumb) |
| GET | `/driver/pings` | `taskId` — GPS trail for route replay |
| POST | `/devices` | Register FCM token (`token`, `platform`, `appVersion`, `deviceModel`) — upsert on every app launch |
| DELETE | `/devices` | Unregister the token on logout (`token`) |
| GET | `/notifications` | In-app inbox, `unread=1` filter, paginated |
| PATCH | `/notifications` | Mark read: `ids: [...]` or `all: true` |
| POST | `/notifications` | Staff-only push/broadcast to `userIds` / `employeeIds` |
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

## 8. Medical leave attachment flow (mobile)

1. `POST /api/public/v1/uploads` with the MC photo (`folder=medical`) → `key`.
2. `POST /api/public/v1/leave` with `type: "Medical Leave"` and
   `attachments: [key]`, or `PATCH /api/public/v1/leave/:id` to add the MC later.
3. `GET /api/public/v1/uploads?key=...` returns a short-lived signed URL for
   viewing/downloading the file in the app.

Size and daily-count limits are role-based (worker 10 MB / 50 files per day,
staff 25 MB / 500). Allowed types: pdf, jpg, jpeg, png, webp, gif, heic, doc,
docx, xls, xlsx, csv, txt.
4. PDFs and reports mobile needs are generated server-side and returned as a
   URL, not only in the browser.
## 9. Push notifications (FCM / APNs)

1. Flutter gets an FCM token (`firebase_messaging`; iOS delivery goes through
   APNs automatically once the APNs key is uploaded to Firebase).
2. `POST /api/public/v1/devices` with `{ token, platform, appVersion, deviceModel }`
   on every launch; `DELETE /api/public/v1/devices` on logout.
3. The server stores every notification in `public.notifications`, so the
   in-app inbox (`GET /v1/notifications`) still works when delivery fails.
4. Leave approve/reject already sends a push automatically; staff can send
   announcements with `POST /v1/notifications`.

Server secret required: `FCM_SERVICE_ACCOUNT_JSON` (Firebase service-account
JSON). Without it, notifications are still stored but not delivered.

DB migration: `supabase/migrations/0062_push_notifications.sql`.

## 10. Offline attendance queue (mobile)

1. On punch, the app writes the record to its local DB with a locally
   generated `clientEventId` (uuid) and `punchedAt` (device time).
2. When online, it POSTs the whole queue to
   `POST /api/public/v1/attendance/sync` as `{ events: [...] }`.
3. The server claims each `clientEventId` in `attendance_events` before
   touching `attendance`, so replaying the same queue is safe. Response:
   `{ saved, duplicates, failed, results: [{ clientEventId, status }] }`.
4. The app deletes a local row when its result is `saved` **or** `duplicate`,
   and keeps only `error` rows for the next retry.

Single punches (`POST /v1/attendance`) accept the same `clientEventId` and use
the identical idempotent path, so a flaky network never double-punches.

DB migration: `supabase/migrations/0063_attendance_offline_queue.sql`.

## 11. Selfie + GPS punch verification

Each site can carry a geofence (`lat`, `lng`, `geofence_radius_m`, default
300 m) plus two switches: `geofence_enforced` (reject punches outside the
radius) and `selfie_required`.

Mobile punch flow:

1. Upload the selfie first: `POST /api/public/v1/uploads` with
   `folder=attendance` -> returns `{ key }`.
2. Punch with the proof attached:

       POST /api/public/v1/attendance
       { "siteId": "...", "checkIn": "08:02", "lat": 1.3521, "lng": 103.8198,
         "accuracyM": 12, "selfieKey": "attendance/...jpg",
         "clientEventId": "<uuid>" }

3. The server runs the shared rules in `src/lib/punch-verification.ts`
   (exported from `@/core`, so web and Flutter behave identically):
   - inside radius + selfie + good accuracy -> `verified`
   - outside radius or missing required selfie -> `flagged`
   - no GPS / no site coordinates -> `unverified`
   - `geofence_enforced` breach -> HTTP 422 `punch_rejected` (nothing saved)
4. Response meta: `{ verification, geoStatus, distanceM, flags, notice }`.
   Offline batch results also report `rejected` and `flagged` counts, so the
   app can surface the reason and keep failed rows queued.

Every event is stored in `attendance_events` with `selfie_key`, `accuracy_m`,
`distance_m`, `geo_status`, `verification` and `flags` for HR audit; the day's
`attendance` row keeps the selfie key, verdict and distance for check-in and
check-out.

DB migration: `supabase/migrations/0064_punch_verification.sql`.

## Rate limiting

Every `/api/public/v1/*` endpoint is rate limited. Counters are stored in
Postgres (`public.api_rate_limit`), so limits apply across all server
instances.

Two layers per request:

1. **Per IP (pre-auth)** — 600 requests / minute. Blocks token-guessing floods.
2. **Per user (per endpoint budget)** — see table below.

| Bucket | Limit (per minute) |
| --- | --- |
| default (all list/read endpoints) | 120 |
| `attendance` (punch in/out) | 60 |
| `attendance/sync` (offline batch) | 20 |
| `uploads` | 20 |
| `driver/pings` (GPS trail) | 240 |
| `payroll/:id/payslip` | 30 |
| `notifications` | 120 |
| `devices` | 30 |

Response headers on every call:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 2026-08-06T09:00:00Z
```

When exceeded the API returns HTTP `429` with `Retry-After` (seconds) and:

```json
{ "ok": false, "error": { "code": "rate_limited", "message": "Too many requests..." } }
```

**Flutter guidance:** on `429`, read `Retry-After`, back off exponentially, and
keep queued punches in local storage — the offline queue is idempotent, so
retrying the same `client_event_id` never creates duplicates. If the limiter
itself is unavailable the API fails open (requests are allowed), so a limiter
outage never blocks attendance.
