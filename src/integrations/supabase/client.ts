import { getBrowserSupabaseConfig } from "@/lib/supabase-config";
// Supabase client (supabase.com hosted project).
// URL + publishable/anon key are PUBLIC browser config — safe to ship.
// Never place a service-role or secret key in this file.
import { createClient } from '@supabase/supabase-js';

const { url: SUPABASE_URL, anonKey: SUPABASE_PUBLISHABLE_KEY } = getBrowserSupabaseConfig();

// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (typeof window !== "undefined" && response.ok && ["POST", "PATCH", "DELETE"].includes(method) && url.pathname.startsWith("/rest/v1/") && !url.pathname.includes("/rpc/")) {
        const table = url.pathname.split("/").pop();
        window.dispatchEvent(new CustomEvent("bsm:data-write", { detail: table }));
      }
      return response;
    }, { preconnect: fetch.preconnect }),
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;