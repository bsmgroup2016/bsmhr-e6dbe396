# Worker check-in, checkout and returning sessions

## Changes verified by regression tests

- Worker portal subscribes to loaded record changes rather than retaining stale memoized attendance.
- Today's attendance reads through the existing caller-authenticated endpoint, scoped to the account, employee and Singapore day. It refreshes on reopen, focus and reconnection. Punch controls wait for a successful read; failures offer Retry.
- Successful punch notifications use the server-returned saved time, not a device-only optimistic value.
- Existing check-in and checkout times survive repeated submissions. Conditional updates protect against overlapping writes to an existing daily record.
- Checkout requires a saved check-in; overnight rollover is not silently interpreted as a same-day shift. HR must correct an overnight/missed checkout.
- Checkout derives counted normal/OT hours using the existing rule: 07:00–20:00 is 8 normal hours and 4 OT, including the one-hour unpaid lunch in the nine-hour duty.
- Empty write responses and failed read-back never report a confirmed save.
- Auth callbacks no longer await session-dependent queries while holding the auth session lock, avoiding refresh/sign-in request deadlocks.
- GPS remains optional when unavailable or denied; the displayed notice now reflects this. No selfie or geofence requirement was added.

## Expected worker workflow

1. Sign in with the exact administrator-saved login ID and password.
2. On Home, wait for today's saved attendance, then select Check in.
3. Remain online until the saved-time confirmation appears. Closing the screen during an uncertain request is not proof of a save; reopen and read the record before retrying.
4. Closing the website or WebView does not check the worker out and does not intentionally sign them out.
5. Reopen on the same origin/profile: persisted auth normally restores the session; the fresh attendance read shows the saved check-in and enables Check out.
6. Check out online. The same daily row gains checkout and derived hours; the original check-in remains unchanged.
7. Explicit sign-out, deleted app/browser storage, a revoked session or enforced hosted auth limits can require another sign-in. A new login does not delete attendance.
8. Past-day open attendance currently needs HR correction; no automatic checkout or offline punch queue is enabled.

## Evidence and limitations

- 265 regression tests passed across 38 files, including 28 focused attendance/API/hours/portal checks.
- Live unauthenticated GET and POST attendance return 401. Opening /my-portal signed out redirects to /auth with no page errors.
- Preview compilation is clean.
- Real signed-in worker punch, browser/WebView restart and subsequent checkout/read-back are **not verified**: the external account service has no authorized browser test session available. No production worker attendance or credentials were modified for testing.
- Session persistence and automatic token refresh are enabled in the client. Hosted auth inactivity/time-box/single-session settings and the eventual Android wrapper's storage retention remain unverified; no fixed session lifetime is promised.
- No schema, RLS, file storage or native mobile changes were made.