import { createIsomorphicFn } from "@tanstack/react-start";

// Public connection defaults only. Service-role credentials never belong here.
const DEFAULT_URL = "https://supabase.bsmengg.com";
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1ODUyMTUwLCJleHAiOjE5NTM1MzIxNTB9.oKHcsh1PF5fehDyqcQn7Ja9epYtV44TXHZdq-X28TLM";

export function getBrowserSupabaseConfig() {
  return {
    url: (import.meta.env?.VITE_SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, ""),
    anonKey: import.meta.env?.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY,
  };
}

// The compiler removes the server branch from the browser bundle. Call inside
// request handlers/server helpers, never cache this result at module scope.
export const getSupabaseConfig = createIsomorphicFn()
  .server(() => ({
    url: (process.env["SUPABASE_URL"] || DEFAULT_URL).replace(/\/+$/, ""),
    anonKey: process.env["SUPABASE_ANON_KEY"] || DEFAULT_ANON_KEY,
  }))
  .client(getBrowserSupabaseConfig);
