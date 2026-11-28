import { getSupabaseConfig } from "@/lib/supabase-config";
import { createFileRoute } from "@tanstack/react-router";
import { API_VERSION, ok, preflight } from "@/lib/api-v1.server";

/** Public discovery document — lets Flutter clients check compatibility. */
export const Route = createFileRoute("/api/public/v1/meta")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async () =>
        ok({
          api: "bsm-workforce",
          version: API_VERSION,
          minClient: { android: "1.0.0", ios: "1.0.0", web: "1.0.0" },
          auth: {
            type: "supabase",
            url: getSupabaseConfig().url,
            scheme: "Authorization: Bearer <access_token>",
          },
          endpoints: [
            "GET  /api/public/v1/me",
            "GET  /api/public/v1/employees",
            "GET  /api/public/v1/employees/:id",
            "GET  /api/public/v1/attendance",
            "POST /api/public/v1/attendance",
            "GET  /api/public/v1/leave",
            "POST /api/public/v1/leave",
            "GET  /api/public/v1/payroll",
            "GET  /api/public/v1/projects",
            "GET  /api/public/v1/clients",
          ],
        }),
    },
  },
});