import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it is used ONLY for Supabase Auth
 * admin operations (creating accounts, resetting passwords, banning users)
 * after the caller's role has been verified with the user-bound client.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
