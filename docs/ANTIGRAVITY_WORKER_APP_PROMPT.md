# Prompt for Antigravity — BSM Worker Android App (WebView)

Copy everything below the line into Antigravity together with the GitHub repo link.

---

You are building the **BSM Worker** Android app (APK + AAB) for construction workers of a Singapore manpower company. The web app already exists and is fully functional; the Android app is a **WebView wrapper** around it. Do NOT rebuild screens natively and do NOT change the web code in this repository.

## Read these files from the repo first
- `docs/WORKER_APP.md` — WebView requirements, Expo and Android Studio reference code.
- `docs/MOBILE_API.md` — full REST API (`/api/public/v1/*`), auth, uploads, offline punch sync, notifications.
- `docs/worker-api.postman_collection.json` — Postman collection for every worker endpoint (use it to test).
- `src/routes/_authenticated/my-portal.tsx` — the worker screen the app opens.

## Tech
- Expo (React Native, TypeScript, latest SDK) with `react-native-webview`. Build with EAS (`eas build -p android`) producing an APK (preview profile) and AAB (production profile).
- Package name: `xyz.hrbsm.worker`. App name: `BSM Worker`. All text in English.
- Min Android 8 (API 26), target latest.

## Behaviour
1. Splash screen (blue → sky gradient, #1e3a8a to #38bdf8, white BSM logo centred) → loads `https://hrbsm.xyz/my-portal`.
2. If not signed in the site redirects to `/auth`; the worker signs in once. Keep the session: `domStorageEnabled`, `sharedCookiesEnabled`, `thirdPartyCookiesEnabled`, never clear cache on launch.
3. Only allow navigation inside `hrbsm.xyz` (and `www.hrbsm.xyz`). Open any other link (WhatsApp, tel:, mailto:, maps, external sites) with `Linking.openURL`.
4. Android back button: go back inside the WebView if possible, otherwise ask "Exit BSM Worker?" before closing.
5. Pull-to-refresh enabled. Safe-area aware, status bar light content on royal blue (#1e40af); Android navigation bar white.
6. Offline: when there is no internet, show a native full-screen "You are offline" page with a Retry button (do not show the browser error page). Reload automatically when connection returns (`@react-native-community/netinfo`).
7. Loading: thin progress bar at top while pages load.
8. Permissions (ask at the moment they are needed, with clear English reasons):
   - Camera — selfie attendance punch and document/MC photo upload.
   - Location (fine) — GPS attendance punch. Grant WebView geolocation requests.
   - Photos/files — uploading documents.
   Allow `<input type="file">` (camera + gallery) and `getUserMedia` in the WebView (`mediaCapturePermissionGrantType="grant"`, `allowsInlineMediaPlayback`, `mediaPlaybackRequiresUserAction={false}`).
9. Downloads: payslip PDFs and documents. Handle `onFileDownload` and blob/data downloads: inject JS that converts blob URLs to base64 and posts them to React Native, save with `expo-file-system` and open the share/"Save to Files" sheet with `expo-sharing`. For http(s) file URLs, download and open with the PDF viewer.
10. Push notifications (FCM via `expo-notifications`): after the page signs in, read the Supabase session from `localStorage` key starting with `sb-` and ending with `-auth-token` (via injected JS → `postMessage`). With its `access_token`, call `POST https://hrbsm.xyz/api/public/v1/devices` body `{ token, platform: "android", appVersion, deviceModel }` and header `Authorization: Bearer <access_token>`. On sign-out call `DELETE /api/public/v1/devices` with `{ token }`. Tapping a notification opens `https://hrbsm.xyz/my-portal`.
11. Disable zoom, text selection long-press menu stays enabled; user agent append ` BSMWorkerApp/1.0` so the site can detect the app.
12. App update: check Play Store in-app updates if available (optional).

## What the worker sees (already built in the web app — just wrap it)
- **Login (`/auth`)**: blue→sky gradient design. Worker types a **Login ID** (name only, e.g. `rahmanhasibur`; spaces are converted to dots) and an **8-character password** given by admin. Admin creates/resets these in Users → Worker App. No self sign-up for workers.
- **Home**: "Hello, <name>", big attendance card (date, hours worked, 9h duty progress bar), one big **Check in / Check out** button (sends time + GPS), summary cards (work permit, this month, leave taken, latest net pay), recent attendance and leave.
- **Attendance**: Daily / Weekly / Monthly filter; days worked, normal hours, OT hours, absent, leave/MC; one card per day (In, Out, Hours, OT, status). Rule: 9h duty incl. 1h lunch = 8 counted hours; time after 9h is OT.
- **Leave**: balance per leave type, Year/Month filter, requested/approved/pending/rejected counts, request cards, "Apply for leave" button.
- **Payslips**: From/To month filter + All time, totals (gross, deductions, net), tap a month for full breakdown and **Download payslip PDF**.
- **Profile**: personal and permit details.
- Theme: royal blue + sky blue gradients on a light bluish-white background, white bottom tab bar. The native splash, offline screen and progress bar must use the same colours.

## API (only for push registration and testing — the UI stays in the WebView)
- Base: `https://hrbsm.xyz/api/public/v1`
- Auth: Supabase email/password → `POST https://thrfyeyqafmdnpexgmlc.supabase.co/auth/v1/token?grant_type=password` with header `apikey: <anon key from docs/worker-api.postman_collection.json>`; send `Authorization: Bearer <access_token>` to every API call.
- Worker endpoints: `GET /me`, `GET /me/dashboard`, `GET /attendance?from&to`, `POST /attendance`, `POST /attendance/sync`, `GET|POST /leave`, `PATCH /leave/:id`, `GET /payroll`, `GET /payroll/:id/payslip` (PDF), `POST /uploads`, `GET /uploads?key=`, `GET|PATCH /notifications`, `POST|DELETE /devices`.
- Never put any secret key in the app other than the public anon key.

## Deliverables
1. A new folder `mobile/` (or separate repo) with the Expo project, `app.json`/`app.config.ts`, `eas.json` (preview = APK, production = AAB), icons (adaptive icon) and splash.
2. `mobile/README.md`: how to run (`npx expo start`), build APK/AAB, set up Firebase (`google-services.json`), and sign the release.
3. Test checklist and confirm each passes on a real Android phone:
   - Sign in with a Login ID (e.g. `rahmanhasibur`) + 8-char password.
   - Check in then Check out on Home → times appear and Day complete shows.
   - Sign in once, close the app, reopen → still signed in on My Portal.
   - Bottom tabs work: Home, Attendance, Leave, Payslips, Profile.
   - Apply for leave → appears as Pending.
   - Download payslip → PDF opens/saves.
   - Upload a document photo from camera and from gallery.
   - Selfie/GPS punch asks camera + location permission and succeeds.
   - Airplane mode → offline screen → Retry works when back online.
   - Back button behaviour and external links open outside the app.
   - Push notification received and opens the portal.

Do not modify any file outside `mobile/`.
