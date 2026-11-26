import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { buildCsp, originOf } from "@/lib/csp";

// Optimistic auth check (Next.js 16 renamed Middleware to Proxy — same
// mechanism). This only checks whether the session cookie is present and
// redirects; it deliberately does NOT touch the database (no cookie
// hashing/lookup here) — that's the job of requireUser()/requireAdmin() in
// src/lib/auth/dal.ts, called at the top of every protected page and Server
// Action. This is the "cheap, runs on every request" layer, not the
// security boundary — a forged/expired/revoked cookie value still gets
// rejected there.
//
// Deliberately one-directional: only redirects an unauthenticated-looking
// request AWAY from a protected page. It does NOT bounce an
// already-cookied visitor away from /login, because cookie presence isn't
// proof the session is still valid (e.g. an admin password reset revokes
// it) — doing that here would bounce a signed-out-but-still-cookied
// visitor from /login straight back to a protected page, which redirects
// straight back to /login, forever. src/app/login/page.tsx does that
// redirect instead, using the real DB-backed getAuthContext() check.
export function proxy(request: NextRequest) {
  // Fresh nonce per request; every page is rendered dynamically, so Next can
  // stamp it onto its own scripts. See src/lib/csp.ts.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    storageOrigin: originOf(process.env.SUPABASE_URL),
    dev: process.env.NODE_ENV === "development",
  });
  const hasSessionCookie = !!request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const path = request.nextUrl.pathname;
  if (!hasSessionCookie && path !== "/login" && path !== "/api/cron/reminders" && path !== "/api/cron/meeting-reminders" && path !== "/api/cron/retention") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", path + request.nextUrl.search);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-workspace-path", path + request.nextUrl.search);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static/|_next/image$|favicon\\.ico$|logo\\.png$).*)"],
};
