import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Reads/writes the auth session via Next.js cookies, so
 * every caller sees the current request's session automatically.
 *
 * Server Components can't set cookies (Next.js throws), so `setAll` is a
 * no-op there — session refresh writes happen in the proxy instead, which
 * *can* set cookies. See src/proxy.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — ignore, the proxy refreshes
            // the session cookie on the next request instead.
          }
        },
      },
    }
  );
}
