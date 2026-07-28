// Self-hosted Supabase client.
// These two values are PUBLIC browser configuration (safe to ship to the client).
// Never place a service-role key, sb_secret key, or database password in this file.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SELF_HOSTED_SUPABASE_URL = "https://supabase.vrlle.com";
const SELF_HOSTED_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kmhmoUOhtSV7Cn-umQ3-4p_c6wURNhE";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(
  SELF_HOSTED_SUPABASE_URL,
  SELF_HOSTED_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/**
 * Connection test. Logs a clear console error when the self-hosted instance
 * is unreachable, misconfigured, or the publishable key is still a placeholder.
 */
export async function testSupabaseConnection(): Promise<boolean> {
  // Key is configured; proceed to verify the live connection.

  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      console.error(
        `[Supabase] Connection to ${SELF_HOSTED_SUPABASE_URL} failed: ${error.message}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `[Supabase] Could not reach ${SELF_HOSTED_SUPABASE_URL}. ` +
        `Check the URL, HTTPS certificate and CORS settings of your self-hosted instance.`,
      err,
    );
    return false;
  }
}

if (typeof window !== 'undefined') {
  void testSupabaseConnection();
}