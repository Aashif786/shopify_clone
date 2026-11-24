import { NextResponse, type NextRequest } from "next/server";

// Exact cookie name from modules/platform-admin/src/application/auth-service.ts
// Kept self-contained to avoid importing Node/DB dependencies into the Edge runtime
const PLATFORM_ADMIN_SESSION_COOKIE = "calcart_platform_admin_session";

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static file extensions (svg, png, jpg, jpeg, gif, webp, ico, css, js, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|webmanifest|map)$).*)",
  ],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow login page and login API route
  if (pathname === "/login" || pathname === "/api/platform/auth/login") {
    return NextResponse.next();
  }

  // 2. Allow API routes to pass through to their handlers
  // (Full DB session validation and RBAC are enforced inside each handler via requirePlatformAdmin)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 3. Page routes require an active platform admin session cookie
  const sessionCookie = req.cookies.get(PLATFORM_ADMIN_SESSION_COOKIE);

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
