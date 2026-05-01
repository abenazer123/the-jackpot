/**
 * Edge middleware — gates /admin/* routes behind the admin
 * session cookie. Login page itself is exempt (otherwise the
 * redirect would loop). All other admin paths redirect to
 * /admin/login when the cookie is missing or doesn't match
 * ADMIN_SESSION_TOKEN.
 *
 * The cookie is set/cleared by src/lib/admin/auth.ts; this file
 * only verifies presence + value match.
 */

import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "jp_admin";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page is the one /admin/* path that's always reachable.
  if (pathname === "/admin/login") return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expected = process.env.ADMIN_SESSION_TOKEN;
  if (cookie && expected && cookie === expected) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  if (pathname && pathname !== "/admin") {
    url.searchParams.set("next", pathname);
  } else {
    url.search = "";
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
