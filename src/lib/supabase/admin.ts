import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely, and
 * can create/delete Supabase Auth users via `auth.admin.*`.
 *
 * NEVER import this into anything that runs in the browser or returns data
 * straight from a request. Only call it from inside a Server Action, and
 * only after checking the caller is an admin yourself — this client trusts
 * every call unconditionally.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
