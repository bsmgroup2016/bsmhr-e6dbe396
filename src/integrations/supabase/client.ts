// Supabase client (supabase.com hosted project).
// URL + publishable/anon key are PUBLIC browser config — safe to ship.
// Never place a service-role or secret key in this file.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://thrfyeyqafmdnpexgmlc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocmZ5ZXlxYWZtZG5wZXhnbWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTMzNTcsImV4cCI6MjEwMDgyOTM1N30.4EGhaZVMSZYI2NPo6mdzBLgKbZJjlVqJ-cdm7VqDvrQ';

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