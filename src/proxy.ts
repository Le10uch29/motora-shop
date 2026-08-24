import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { locales, defaultLocale } from "@/i18n/locales";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchedLocale = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!matchedLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Forwarded so the root layout can tell (without its own usePathname, since
  // it's a Server Component) whether it's rendering an /admin route, and skip
  // the public storefront header there.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth session cookie if it's close to expiring.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminPrefix = `/${matchedLocale}/admin`;
  const isAdminRoute = pathname === adminPrefix || pathname.startsWith(`${adminPrefix}/`);
  const isAdminLoginRoute = pathname === `${adminPrefix}/login`;
  const loginRoute = `/${matchedLocale}/login`;
  const isLoginRoute = pathname === loginRoute;

  if (isAdminRoute) {
    if (!isAdminLoginRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = `${adminPrefix}/login`;
      return NextResponse.redirect(url);
    }
  } else if (!isLoginRoute && !user) {
    // The storefront isn't public — only staff and admin-provisioned
    // customers may browse it, so anyone unauthenticated gets sent to login.
    const url = request.nextUrl.clone();
    url.pathname = loginRoute;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
