import type { SupabaseClient, User } from "@supabase/supabase-js";

/** How long to wait before the single retry below. Long enough to ride out a
 * dropped connection, short enough not to be felt in a page render. */
const RETRY_DELAY_MS = 150;

/** Runs a Supabase Auth call so that a network failure degrades instead of
 * taking the page down.
 *
 * Worth spelling out, because the two halves of the Supabase client behave
 * differently: PostgREST (`.from(...).select()`) catches fetch failures and
 * hands them back in `error`, so every data query here already degrades to
 * empty. Auth (`auth.getUser`, `auth.admin.*`) only does that for *auth*
 * errors — anything else, a dropped connection or a DNS hiccup included, is
 * re-thrown. Unhandled inside a Server Component that is exactly Next's
 * "This page couldn't load" 500, which is why the site would fail at random
 * while nothing was wrong with the code or the data.
 *
 * One retry first, since these blips are momentary; the fallback is only for
 * when Supabase is genuinely unreachable. */
async function resilientAuthCall<T>(run: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await run();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  try {
    return await run();
  } catch (error) {
    console.error(`[supabase auth] ${label} failed after a retry:`, error);
    return null;
  }
}

/** The signed-in user, or null — including when Supabase can't be reached, so
 * callers treat an outage as "not signed in" rather than crashing. */
export async function getAuthUser(supabase: SupabaseClient): Promise<User | null> {
  const result = await resilientAuthCall(() => supabase.auth.getUser(), "getUser");
  return result?.data.user ?? null;
}

export type AuthIdentity = { id: string; email: string };

/**
 * Who the session belongs to, taken from the session cookie's own token.
 *
 * `getUser()` asks Supabase on every single call — a round trip before the page
 * can even start, on every request, which on this project measures 300-800ms.
 * `getClaims()` instead verifies the token's signature locally against the
 * project's public key (fetched once per server process) and only goes to the
 * network when the token has actually expired and needs refreshing. The
 * signature check is what makes it trustworthy: a forged or edited cookie fails
 * it, exactly as `getUser()` would fail server-side.
 *
 * Use this for "who is this request", and `getAuthUser` only where the full,
 * freshest user record is needed (metadata, email confirmation state).
 */
export async function getAuthIdentity(supabase: SupabaseClient): Promise<AuthIdentity | null> {
  const result = await resilientAuthCall(() => supabase.auth.getClaims(), "getClaims");
  const claims = result?.data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
}

/** One user by id, or null when unreachable. */
export async function getAuthUserById(
  admin: SupabaseClient,
  userId: string
): Promise<User | null> {
  const result = await resilientAuthCall(
    () => admin.auth.admin.getUserById(userId),
    "getUserById"
  );
  return result?.data.user ?? null;
}

/** Every auth user, for joining emails onto the staff/customer/order lists.
 *
 * Pages through explicitly: listUsers() returns only the first 50 by default,
 * so past 50 accounts the tail would silently come back without emails. */
export async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;

  for (let page = 1; ; page++) {
    const result = await resilientAuthCall(
      () => admin.auth.admin.listUsers({ page, perPage }),
      `listUsers(page ${page})`
    );
    const batch = result?.data.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
  }

  return users;
}
