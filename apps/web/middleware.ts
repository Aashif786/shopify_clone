import { NextResponse, type NextRequest } from "next/server";
import { parseHostname } from "@shopify-clone/tenant";

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (uploaded static media)
     * - static file extensions (svg, png, jpg, css, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|webmanifest|map)$).*)",
  ],
};

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Never rewrite API routes - pass them through directly with host tracking
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 2. Extract and parse host header
  const hostHeader =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.hostname;

  const platformDomain =
    process.env.PLATFORM_DOMAIN ||
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ||
    "calcart.com";

  const parsed = parseHostname(hostHeader, platformDomain);

  // 3. If apex platform (e.g. calcart.com, localhost) or reserved subdomain (www, app, admin, api):
  // Do NOT rewrite to a store - let the platform routes handle it normally
  if (parsed.isPlatform || parsed.isReserved || !parsed.subdomain) {
    return NextResponse.next();
  }

  const storeSlug = parsed.subdomain;

  // 4. Cross-store boundary protection on tenant subdomains:
  // If user is on "souled-store.calcart.com" and attempts to visit "/stores/other-store/...",
  // reject cross-tenant access by redirecting to the tenant's own storefront root.
  if (pathname.startsWith("/stores/")) {
    const storePathPrefix = `/stores/${storeSlug}`;
    if (!pathname.startsWith(storePathPrefix)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // If pathname is already "/stores/souled-store/...", pass through with trusted headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-store-slug", storeSlug);
    requestHeaders.set("x-store-subdomain", storeSlug);
    requestHeaders.set("x-matched-host", parsed.normalizedHost);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 5. Merchant subdomain storefront rewrite:
  // "https://souled-store.calcart.com/products" -> internal rewrite to "/stores/souled-store/products"
  // "https://souled-store.calcart.com/" -> internal rewrite to "/stores/souled-store"
  const rewritePath = pathname === "/" ? `/stores/${storeSlug}` : `/stores/${storeSlug}${pathname}`;
  const rewriteUrl = new URL(`${rewritePath}${search}`, req.url);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-store-slug", storeSlug);
  requestHeaders.set("x-store-subdomain", storeSlug);
  requestHeaders.set("x-matched-host", parsed.normalizedHost);

  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}
