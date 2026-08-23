import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Anonymous, cookie-free Supabase client for public read-only storefront
 * queries (brands, products, pages). Unlike `server.ts`'s client, this one
 * doesn't touch `next/headers`, so it's also safe to call from
 * `generateStaticParams` and other places outside request scope.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
