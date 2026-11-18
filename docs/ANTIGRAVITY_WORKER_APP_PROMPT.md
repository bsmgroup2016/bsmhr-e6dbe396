# Updated Antigravity prompt — BSM Worker Android app

Updated: 18 November 2026. Give Antigravity the GitHub repository link and everything below the divider. This is a build brief, not a claim that Android or live worker testing has already passed.

---

Act as a senior Android/React Native engineer, mobile UX engineer and QA engineer. Build a production-quality **BSM Worker** Android app using the existing web application in this GitHub repository. Deliver an installable signed **APK**, a signed Play Store **AAB**, complete mobile source, configuration and honest test results. Implement the app; do not stop at advice, a prototype or mock screens.

## 1. Scope and identity

- App name: **BSM Worker**.
- Android application ID: **xyz.hrbsm.worker**. Confirm before changing an existing release identifier.
- Company context: Singapore manpower/construction workforce operations.
- All app screens, permission reasons and error messages must be **English**.
- This is an **Android WebView wrapper**, not a native rebuild of payroll, attendance or leave.
- Use Expo + React Native + TypeScript + `react-native-webview`, with EAS build profiles. Produce an Android project that can also be opened in Android Studio.
- Create everything inside **mobile/**; do not alter the existing website, root package scripts, server endpoints, database, permissions, R2 configuration or web deployment. If an existing mobile project exists, inspect and update it rather than creating a duplicate.
- Do not install another router into the web app. Its TanStack Start routing must remain intact.
- No duplicate native login, header, sidebar or bottom-tab navigation over the web UI. Native UI is for splash/loading, network errors, Android permissions and download/share handling only.
- No new attendance rules, salary calculations, default credentials or fake records.

## 2. Inspect before building

Read the repository's AGENTS.md instructions, then these sources:

1. `src/routes/_authenticated/my-portal.tsx` — current five worker tabs and actual controls.
2. `src/styles.css` — `.worker-app`, `.wa-*` and auth styles, current blue–sky gradients.
3. `src/routes/auth.tsx`, `src/lib/auth.tsx`, `src/core/access.ts` — login and role-based redirects.
4. `src/core/worker-login.ts`, `src/core/user-login-update.ts` — worker identifiers and admin edits.
5. `src/lib/api-client.ts`, `src/lib/store.ts` — requests, refresh and data reads.
6. `src/lib/pdf.ts`, `src/lib/r2.ts`, `src/components/self-profile-form.tsx` — existing download/upload/profile flows.
7. `src/features/worker-portal/` — attendance and leave/payslip summaries.
8. `src/core/data-tables.ts` — known absent tables and actual table columns.
9. `src/routes/api/public/v1/` — actual request/response contracts.
10. `docs/WORKER_APP.md`, `docs/MOBILE_API.md`, `docs/worker-api.postman_collection.json` — legacy references, not unquestioned implementation truth.
11. Existing PWA registrar, service worker configuration, manifest and brand/logo assets.

**Important corrections to older handoff documents:**
- Use `https://hrbsm.xyz`, not old deployment URLs in MOBILE_API.md.
- Workers now have admin-managed name-based login IDs, not an email-only invitation flow.
- Attendance now has Daily/Weekly/Monthly filters; leave has year/month filters; payslips have From/To month and All time.
- The current web payslip button generates a browser PDF/Blob. Do not assume it simply navigates to the server PDF endpoint.
- `attendance_events`, `notifications` and `device_tokens` are currently marked unavailable in `src/core/data-tables.ts`. Their route files do NOT establish that the features work in production.
- The legacy Postman `anonKey` has trailing source punctuation (`';`) inside its value. Validate the public key against the browser client instead of copying the malformed value. Do not print or copy private configuration.
- Some old WebView sample permissions are too broad and some props are platform-specific. Use current Android library documentation, not those examples verbatim.

Begin with a short verified inventory, then implement. If the published website differs from current repository code, report the mismatch; do not try to publish or change it yourself.

## 3. URLs and launch

```text
Production origin: https://hrbsm.xyz
Start page:        https://hrbsm.xyz/my-portal
Sign-in page:      https://hrbsm.xyz/auth
API base:          https://hrbsm.xyz/api/public/v1
Alternative host:  https://www.hrbsm.xyz
```

- Start at My Portal. Let the website redirect signed-out workers to `/auth` and handle its existing role-based redirect after login.
- Keep one canonical origin for session storage. `www` and non-`www` do not share localStorage; handle canonical redirects deliberately and verify login persists on the final origin.
- No admin credentials in the app. Worker-only accounts should reach My Portal; preserve server-side role restrictions for other accounts.
- The five bottom tabs use React state within `/my-portal`; do not invent `/my-portal/leave` or other nonexistent tab paths.
- Make the production URL configurable at build time; release builds must not open a preview or localhost address.

## 4. Preserve the current worker experience

Use the site's current premium **blue + sky-blue**, light background, gradient attendance card and coordinated Leave/Payslip accents. Reuse the actual BSM logo. Keep typography readable and animations restrained. Do not replace the site with a new colour scheme.

### Home
- Greeting, worker name/ID and sign out.
- Attendance is first: date/time, duty progress, check-in/out times and state.
- Check in before a shift, Check out after check-in, Day complete afterward.
- Existing summary cards and recent attendance/leave below.
- Work permit countdown and expiry information remain the web app's existing values, not native estimates.

### Attendance
- Daily / Weekly / Monthly controls and date/month pickers.
- Days worked, normal hours, OT hours, absent and leave/MC summaries.
- Phone-size day cards with in/out, hours, OT and status.
- Preserve calculations: 9h duty includes 1h lunch, yielding 8 counted normal hours; overtime follows existing server rules. The running elapsed-duty clock is not payroll payable hours.
- The current portal punch requests GPS but can proceed without it if permission/location fails. Do not impose a new mandatory GPS, selfie or geofence policy in the wrapper.

### Leave
- Entitled/taken/balance by available leave type.
- Year and month/whole-year filters.
- Requested, approved, pending, rejected and approved-day summaries.
- Existing Apply for leave dialog, types, dates and reason; request history cards.
- Do not let a worker approve their own leave or fabricate successful saves.
- Do not add MC attachment UI if it is absent from the current web form.

### Payslips
- From month / To month / All time filters and past-month selection.
- Months paid, total gross, deductions and net pay.
- Current breakdown: basic salary, OT/hours, allowances, CPF, accommodation, loans, SHG/other deductions, net pay and paid date when present.
- Download the actual selected month's payslip. No duplicate salary calculations in React Native.
- Only show existing payroll rows; do not claim every historical month is available unless the web data supplies it.

### Profile
- Existing personal/work/pass/passport/bank details, P-File number and documents.
- View documents and preserve the existing Edit my details/HR-verification workflow.
- Upload/camera integration supports existing form controls; it must not introduce new registration fields.
- A missing linked employee must display the existing notice, never another worker's record.

## 5. Login, session and account switching

- Login remains inside the website's updated blue–sky sign-in page.
- Admin manages accounts from Users → Worker App; new worker records are wired to account provisioning, with existing backfill controls. Provisioning can fail and must not be represented as guaranteed.
- Login IDs are short, name-based and admin-editable. Treat the exact current admin-saved ID as authoritative. `rahmanhasibur` and `rahman.hasibur` are different IDs; never silently guess punctuation.
- The current web helper trims/lowercases an identifier, preserves actual email addresses and maps a bare ID to `<id>@workers.hrbsm.xyz`, normalizing spaces/dots as in `loginEmail`.
- Generated temporary passwords are exactly **8 characters**, unique per worker; do not enforce an 8-character maximum on sign-in because an existing/admin-set password can be longer. Do not create shared `1234` passwords.
- Enable JavaScript and DOM storage. Do not clear authentication storage at launch, refresh, backgrounding or update.
- Persist required first-party cookies. Enable third-party cookies only if a verified flow needs them.
- Let the existing web auth client handle token refresh; do not introduce a competing native session.
- Verify close/reopen, long background/resume, expired sessions, wrong passwords, sign out and switching workers on a shared phone.
- Never persist passwords or log credentials, bearer tokens, session JSON, payslip contents or signed file links. No scanning arbitrary `sb-*` storage keys and sending sessions to a native bridge.

## 6. Native shell and Android behaviour

- Use current mutually compatible stable Expo packages; record exact versions and a lockfile. Minimum Android API 26 if supported by that SDK; if the SDK requires higher, document it. Target the current Play-required SDK at build time.
- Expo Go is not release validation. Use an Android development build/emulator and actual Android phone for permission, chooser and downloads testing.
- Splash uses the real logo and coordinated blue background, then transitions smoothly into the WebView. Avoid white flashes, blank frames, indefinite spinners and arbitrary splash delays.
- Show a thin loading progress indicator for main-page navigation; distinguish main-frame failures from failed image/subresource loads.
- Handle Android edge-to-edge, display cutouts, gesture/three-button navigation, keyboard resize and system bars. Avoid applying safe-area spacing twice: the website already has CSS safe-area handling.
- Bottom tabs and submit buttons must remain reachable with the keyboard open/closed. No horizontal clipping at 360, 390 and 412 CSS-pixel widths; test large text and landscape too.
- Do not disable accessibility font scaling/zoom globally. Keep accessible labels, sensible touch targets and text selection/copy.
- Append an app identifier to the normal user agent rather than replacing it.
- Back button: existing web dialogs/selectors should dismiss through supported handling where possible; navigate safe WebView history when available, otherwise confirm exit. Do not invent history for React-state tabs, and never trigger logout or duplicate submission.
- Pull-to-refresh must work on **Android**, not merely set an iOS-only prop. Use a supported implementation/custom native integration if needed; prevent conflicts with scrolling, date pickers, forms and punches. If it cannot be reliable, provide an accessible Refresh control instead and explain it.
- Avoid reloading unsent forms on resume/network reconnect or while attendance is submitting. Reconnect may offer Retry; automatic reload is safe only for the blocked offline/loading state, not active forms.

## 7. Navigation and bridge security

- Parse URLs; only HTTPS and exact approved app hosts can load as top-level pages. Reject lookalike domains, embedded credentials, unapproved ports, HTTP and unsafe `javascript:`, `file:`, arbitrary `data:` or `intent:` navigation.
- Open safe external HTTPS links, telephone, mail, maps and WhatsApp links using Android handlers; validate schemes and handle missing apps. Signed R2 downloads use the download flow, not arbitrary privileged WebView navigation.
- Handle `target="_blank"`/`window.open` document flows explicitly. Do not silently suppress every popup or load all external hosts internally.
- Keep SSL verification enabled and cleartext/mixed content disabled. Never bypass certificate errors or grant every requested WebView permission.
- Keep file/universal-file access disabled unless a proven restricted use needs it. Use the Android picker/content URIs for uploads instead.
- If a download bridge is necessary, expose only typed, schema-validated commands. Verify the trusted top-level origin and message source/frame provenance where supported; inject only on trusted pages. Reject unknown message types, unsafe paths and oversized payloads.
- A bridge command must not accept arbitrary scripts, bearer tokens, API endpoints or filesystem paths. Use current library security guidance and test origin enforcement, not just a payload-supplied `origin` field.

## 8. Permissions and file uploads

- Request permissions at use, not all at first launch.
- Foreground location only for existing attendance GPS. No background location or constant tracking.
- For geolocation requests, validate the requesting origin, request Android coarse/fine permission appropriately, support approximate location and denial, and avoid retry loops.
- Camera permission only when an existing control uses camera capture; no microphone request for still photos.
- Support `<input type="file">`, image capture, gallery/photo picker, PDF/document picker, cancellation and large-file error handling.
- On modern Android prefer the system photo/document picker, not broad media access or `MANAGE_EXTERNAL_STORAGE`.
- Inspect current Android support for WebView capture/permission APIs. Do not use iOS-only props as the Android implementation.
- Normal Home attendance currently sends time/date/GPS; it does not take a selfie. Do not force the legacy selfie/QR flow into this app.

## 9. Reliable payslip and document downloads

This is a release-critical flow. The web payslip button currently invokes `downloadPayslipPdf`, generating a Blob. Test the real button in the Android WebView.

- Support trusted-page `blob:` downloads, ordinary HTTPS attachment URLs and document popup URLs.
- For generated Blobs, use a narrow trusted-page download adapter that transfers bounded/chunked file data to native storage/share handling if needed. Revoke temporary Blob URLs after completion. Never move a complete auth session through this bridge.
- Handle only supported file formats; validate MIME, filename and size. Sanitize filenames and prevent directory traversal. Do not treat HTML/JSON API errors as a PDF.
- Save to private temporary/cache storage first using APIs compatible with the chosen Expo SDK. Offer Open/Share/Save through Android's system chooser or Storage Access Framework; do not require broad storage permissions.
- Opening a payslip must show its correct worker/month and readable content. Verify empty files, invalid PDF headers, cancelled share sheets and unavailable PDF apps.
- Signed R2 URLs expire: obtain a fresh link through the existing authenticated web flow, never store them as permanent public URLs or add bearer tokens to URL queries.
- Prefer adapting the actual web download rather than relying on the server PDF endpoint as a guaranteed fallback. Its route exists but queries `payroll`; the live schema must be checked against `data-tables.ts` and runtime before claiming it works. Report a server mismatch without changing the backend.
- Clean temporary sensitive downloads on a documented lifecycle; user-explicit saved/shared files are outside app control. Do not auto-upload downloaded payslips to any service.

## 10. Offline and safe retries

- Use NetInfo plus real WebView load/error signals; connectivity does not guarantee server reachability.
- Native offline page: logo, "You are offline", concise message and Retry. A server failure needs a distinct "Could not connect" state, not a misleading offline label.
- Do not persist or cache business HTML, API responses, worker records, attendance, payroll, R2 links or leave histories for offline access. Follow the site's static-only PWA policy.
- Preserve the web service worker's consent-based updates and hourly check; never force a reload during work.
- Do not implement an offline punch queue: `attendance_events` is currently unavailable. Offline submission must never show success or replay automatically.
- Following an ambiguous failed POST, read back the worker's latest attendance through the existing authenticated flow before any user-initiated retry. Do not blindly auto-resubmit check-in, check-out or leave.
- Show errors and unavailable states honestly; `502`/HTML/non-JSON response must not cause a blank screen or be treated as a save.

## 11. API/Postman handoff — references, not a native screen rebuild

The WebView normally calls the existing web APIs itself. Do not duplicate those calls in native code. Prepare a corrected **mobile/docs/worker-api.postman_collection.json** and environment template for diagnostic testing only; keep root docs unchanged.

Auth service: `https://thrfyeyqafmdnpexgmlc.supabase.co/auth/v1`.
- Password login: `POST /token?grant_type=password` with `apikey: <validated public browser key>` and JSON `{ "email": "<resolved worker alias or actual email>", "password": "<entered privately>" }`.
- Auth response is the auth provider's JSON, not the application's `{ok,data}` envelope.
- Protected v1 requests use `Authorization: Bearer <access_token>`; success is `{ok:true,data,meta?}`, failure is `{ok:false,error:{code,message}}`. PDF responses are binary, not JSON.
- Never hardcode worker passwords, tokens or private keys. Commit a template with empty password/token fields; local secrets are ignored. Obtain authorized test credentials privately through an owner-approved method, not the handoff prompt or chat logs.

| Request | Purpose / caveat |
| --- | --- |
| GET `/meta` | Inspect actual capability response; do not assume every route is available |
| GET `/me` | Caller, roles, linked employee |
| GET `/me/dashboard` | Existing summary contract; verify against current source |
| GET `/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD` | Own attendance; valid real range, not every month ending in `-31` |
| POST `/attendance` | Direct portal-style punch; test only on authorized test records |
| GET/POST `/leave` | Own history / apply; confirm fields from source |
| GET/PATCH `/leave/:id` | Own request; supported edits/cancellation depend on handler |
| GET `/payroll` | Own payroll history; check current table availability |
| GET `/payroll/:id/payslip` | Binary PDF route; not assumed verified |
| POST `/uploads` | Existing authenticated multipart R2 upload |
| GET `/uploads?key=<encoded-key>` | Authorized short-lived file link |
| POST `/attendance/sync` | Legacy event-based flow; unavailable now, excluded from release |
| GET/PATCH `/notifications` | Unavailable now, not an implemented worker tab |
| GET/POST/DELETE `/devices` | Unavailable now, not required for this release |

Use variables for base, auth URL, public key, login ID/resolved email, password, token, dates, request/payroll IDs and file key. Resolve login IDs exactly as the current helper does. Populate tokens only on successful auth; clear stale values after failed auth. Do not log response tokens. Mark attendance/leave/upload mutation requests as manual opt-in tests, never auto-run them in a production collection runner. Handle all pages of paginated reads rather than assume the first 200 rows are the full history.

Example direct-punch body (derive date/time from the actual web flow; no invented worker ID):

```json
{
  "date": "YYYY-MM-DD",
  "punchedAt": "<ISO timestamp>",
  "checkIn": "HH:mm",
  "lat": 1.3521,
  "lng": 103.8198,
  "accuracyM": 15
}
```

For checkout send `checkOut` instead of `checkIn`. GPS fields are optional in the current direct portal flow. Do not add `clientEventId`, `siteId` or `selfieKey` to this example: they activate event/proof logic which depends on unavailable tables. Do not send editable hours, OT, status, rate or payroll values from a worker wrapper.

## 12. Push notifications are deferred

Do **not** copy the old prompt's automatic FCM registration or session-scraping bridge. `notifications` and `device_tokens` are unavailable in this repository's capability guard, and no authorized live push verification has been supplied.

- Do not block login or the APK build on Firebase.
- Do not add a nonfunctional notification toggle/inbox, request Android notification permission unnecessarily, or claim leave-approval push works.
- Document push as deferred, with future requirements: explicit approval for backend work, working tables/access controls, Firebase Android app configuration, server-only delivery credentials and real-device end-to-end delivery/account-switching tests.
- `google-services.json` is Android Firebase client configuration, not an FCM service-account secret. Neither substitutes for the other; service-account secrets must never ship in the APK.

## 13. Build and deliver

Produce at least:

```text
mobile/
  package.json + lockfile
  app.config.ts (or app.json)
  eas.json
  .gitignore
  .env.example (public build configuration only)
  App.tsx / equivalent Expo entry
  src/ (focused shell, navigation policy, download, permission modules)
  assets/ (logo-based icon, adaptive icon, splash)
  docs/worker-api.postman_collection.json
  docs/worker-api.postman_environment.json
  docs/TEST_REPORT.md
  docs/RELEASE_CHECKLIST.md
  README.md
```

- Lock dependencies to a tested compatible set. Add focused tests for URL allowlisting, bridge validation/size limits, filename sanitization and ambiguous-write retry protection.
- Configure `development` for an Android development client, `preview` for an installable **APK**, and `production` for **AAB**. Make QA and release artifact signatures/build identifiers explicit.
- Provide exact working commands to install, run a development build, generate/open Android with Expo prebuild, build preview APK, build production AAB, and build signed release locally with Android Studio/Gradle.
- Document whether generated `mobile/android/` is supplied or generated with prebuild; native customizations must survive regeneration through supported config plugins.
- EAS access, release keystore/passwords, upload certificate and Play Console belong to the owner. Never invent these or commit them. State what is needed and how to provide it privately. Keep the same release signing identity for future updates.
- Deliver `BSM-Worker-<version>.apk` and `BSM-Worker-<version>.aab` plus SHA-256 checksums when actual builds succeed. An AAB is uploaded to Play Console, not directly installed like an APK.
- If credentials/build resources prevent producing binaries, finish the source and list the exact blocker; do not rename a ZIP as APK/AAB or invent download links.
- Include installation steps, versionCode/versionName update steps, Android Studio troubleshooting and a summary of changed files.
- Include permission inventory, privacy/Data Safety checklist, reviewer-access instructions without passwords in committed docs, and deployment URL dependencies. Do not promise Play Store approval.

## 14. Release acceptance tests

Record **Passed / Failed / Not tested / Blocked**, device + Android/WebView versions and evidence. Repository inspection or mock-data testing does not count as live worker verification. If authorized test access is unavailable, complete public/native checks and identify the blocked flows without weakening auth. No production attendance/leave mutations without explicit permission.

1. Install APK, open splash, load real `/auth`/`my-portal`, no white/blank page.
2. Current admin-saved worker ID logs in; wrong password displays a readable error; no guessed dotted/undotted aliases.
3. Close/reopen and background/resume preserve a valid session; expired session returns safely to sign-in.
4. Worker-only account sees the five tabs, never the staff sidebar or another worker's data.
5. Home check-in and check-out on an approved test account save and read back after reload; repeated taps do not double-submit. Test permission granted, denied and approximate location.
6. Attendance Daily/Weekly/Monthly filters, date pickers, hour totals and empty states remain usable.
7. Leave month/year filters and balances work; authorized test request becomes Pending and remains visible after reload. Failed submissions do not show success.
8. Payslip range/history selection works; a real selected payslip downloads, opens and can be saved/shared with correct worker/month/content.
9. Profile fields/documents open; supported edits/uploads, camera/gallery/document selection and chooser cancellation work. Verify upload read-back on approved test data.
10. No clipped card/button/bottom bar at 360/390/412 widths, Android keyboard, large text, landscape, cutouts and both navigation modes.
11. Back, modal handling, external links, popup documents and Android refresh behave as documented.
12. Airplane mode/server errors show native recovery; reconnect does not replay punches or lose a filled leave form.
13. Sign out and switch workers: old worker data/credentials are not displayed; download temp files follow the cleanup policy.
14. Malicious/lookalike URLs, unsafe schemes, untrusted bridge messages and invalid/oversized downloads are rejected.
15. APK and AAB actually build; inspect release manifest/permissions and ensure no private secrets or debug endpoints ship.

Finish with artifact locations/checksums, exact build/run instructions, test evidence and remaining blockers. **Do not claim this app is fully functional until the real Android and authorized worker flows have passed.**
