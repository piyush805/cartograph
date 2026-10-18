import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Sessions belong to Clerk. This client only forwards that session token,
 * which already carries the active organization, and does not keep a session
 * of its own.
 */
export async function createDatabase(): Promise<SupabaseClient> {
  const { getToken } = await auth();
  const { supabaseUrl, supabasePublishableKey } = env();

  return createClient(supabaseUrl, supabasePublishableKey, {
    accessToken: () => getToken(),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
