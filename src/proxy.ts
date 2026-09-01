import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isSessionValid, safeRedirectPath } from "@/lib/auth";

function nextWithLoginHeader(request: NextRequest, isLogin: boolean) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-itur-login");
  if (isLogin) requestHeaders.set("x-itur-login", "1");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = await isSessionValid(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === "/login";

  if (isLogin) {
    if (authenticated) {
      const from = safeRedirectPath(request.nextUrl.searchParams.get("from"));
      return NextResponse.redirect(new URL(from, request.url));
    }
    return nextWithLoginHeader(request, true);
  }

  if (authenticated) return nextWithLoginHeader(request, false);

  if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const from = safeRedirectPath(`${pathname}${request.nextUrl.search}`);
  if (from !== "/") loginUrl.searchParams.set("from", from);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
