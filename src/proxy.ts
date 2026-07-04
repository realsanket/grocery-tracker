import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Route guard: only the admin may reach the upload page and write APIs.
 * All read/browse pages and GET APIs are public.
 */
export default async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = token ? await verifySessionToken(token) : false;

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/receipts")) {
    // The public may queue a receipt for review; everything else is admin-only.
    if (pathname === "/api/receipts/submit") {
      return NextResponse.next();
    }
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/upload")) {
    if (!authed) {
      const loginUrl = new URL("/admin", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/upload/:path*", "/upload", "/api/receipts/:path*"],
};
