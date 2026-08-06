# `src/core` — shared, portable business logic

Everything re-exported from `src/core/index.ts` is **framework-agnostic**:
no React, no DOM, no Supabase client, no `window`. These are the rules that
must behave identically on the web app, on the server (API v1) and inside the
future Flutter Android/iOS apps.

Rules for this layer:

1. Pure functions and types only — input in, value out.
2. No imports from `src/components`, `src/routes`, `src/lib/store.ts`, or
   anything that touches `localStorage` / `document` / `window`.
3. Any calculation a mobile app could also need (payroll, CPF, levy, OT,
   compliance windows, PWM checks) belongs here, never inside a page file.
4. When porting to Dart, this folder is the single source of truth. Keep the
   function names and signatures stable so the Dart port can mirror them 1:1.

Clients never re-implement these rules — they call `/api/public/v1/*`, which
runs this same code on the server.