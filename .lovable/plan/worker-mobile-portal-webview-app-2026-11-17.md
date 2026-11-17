# Worker mobile portal (WebView app)

## What a worker sees today
My Portal already has: Profile, Edit my profile, My leave (apply + list), Payslips, Documents.
Missing: **Attendance**, mobile app-like layout, and a worker-only landing.

## What we will build
1. **Worker home** – a worker who signs in lands straight on My Portal (not the admin dashboard), with no office sidebar.
2. **App-like mobile layout** (phone screens)
   - Top bar with name + photo, bottom tab bar: Home · Attendance · Leave · Payslips · Profile
   - Large touch buttons, cards instead of wide tables, safe-area padding, no zoom/overscroll jank.
3. **Home** – pass expiry, leave balance/taken, latest net pay, today's attendance, alerts (documents expiring).
4. **Attendance** – month picker, daily list (in/out, normal hours, OT, site), monthly totals; read-only.
5. **Leave** – apply (type, dates, reason), status of each request (Pending/Approved/Rejected).
6. **Payslips** – month list, breakdown (basic, OT, allowances, deductions, net), download PDF.
7. **Profile** – full own record: personal, pass/WP, passport, bank, CSOC/training, documents (view/download); editable only for allowed contact fields.
8. Desktop view keeps working as before.

## For the Android app (Android Studio / Expo WebView)
- `docs/WORKER_APP.md`: WebView setup (URL, cookies/localStorage, file upload, downloads, back button, camera permission for selfie punch), Expo + Android Studio snippets.
- `docs/worker-api.postman_collection.json`: login + `/v1/me`, `/v1/me/dashboard`, attendance, leave (list/apply), payslips, documents, notifications.
- No native APIs beyond WebView basics.

## Technical notes
- Reuse existing `/api/public/v1/me*`, leave, payroll and attendance endpoints; add a `me/attendance` read only if missing. Caller RLS only, no schema/RLS changes.
- Role `employee` routing: redirect `/dashboard` → `/my-portal`; access rules unchanged elsewhere.
- Tests: access rule (employee → my-portal only) and attendance monthly totals (8 h + OT rule).
