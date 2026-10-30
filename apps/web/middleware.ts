import { NextResponse, type NextRequest } from "next/server";
import { parseHostname } from "@calcart/tenant";

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

interface CachedDomain {
  storeSlug: string | null;
  expiresAt: number;
}

// In-memory cache for custom domain resolutions to maintain high performance
const customDomainCache = new Map<string, CachedDomain>();

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Never rewrite API routes or uploads - pass them through directly
  if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) {
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
  if (parsed.isPlatform || parsed.isReserved) {
    return NextResponse.next();
  }

  // If merchant dashboard path is accessed, pass through
  if (pathname.startsWith("/merchant")) {
    return NextResponse.next();
  }

  let storeSlug: string | null = null;

  // Case A: Platform Subdomain (<store-slug>.calcart.com)
  if (parsed.subdomain) {
    storeSlug = parsed.subdomain;
  } else if (parsed.customDomain) {
    // Case B: Verified Custom Domain (e.g. shop.brand.com or brand.com)
    const cached = customDomainCache.get(parsed.customDomain);
    const now = Date.now();

    if (cached && now < cached.expiresAt) {
      storeSlug = cached.storeSlug;
    } else {
      try {
        const resolveUrl = new URL(
          `/api/v1/domains/resolve?hostname=${encodeURIComponent(parsed.customDomain)}`,
          req.url,
        );
        const res = await fetch(resolveUrl, {
          headers: { "x-internal-resolve": "1" },
        });

        if (res.ok) {
          const json = await res.json();
          storeSlug = (json?.data?.storeSlug as string) || null;
        } else {
          storeSlug = null;
        }
      } catch {
        storeSlug = null;
      }

      // Cache lookup (60 seconds for verified domain, 10 seconds for unverified)
      customDomainCache.set(parsed.customDomain, {
        storeSlug,
        expiresAt: now + (storeSlug ? 60_000 : 10_000),
      });
    }
  }

  // If domain does not resolve to an active store, pass through
  if (!storeSlug) {
    return NextResponse.next();
  }

  // 4. Cross-store boundary protection:
  // If user is on a tenant host and attempts to visit "/stores/other-store/...",
  // reject cross-tenant access by redirecting to the tenant's own storefront root.
  if (pathname.startsWith("/stores/")) {
    const storePathPrefix = `/stores/${storeSlug}`;
    if (!pathname.startsWith(storePathPrefix)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // If pathname is already "/stores/[storeSlug]/...", pass through with trusted headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-store-slug", storeSlug);
    requestHeaders.set("x-store-subdomain", storeSlug);
    requestHeaders.set("x-matched-host", parsed.normalizedHost);
    if (parsed.customDomain) {
      requestHeaders.set("x-custom-domain", parsed.customDomain);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 5. Merchant storefront rewrite:
  // "https://shop.brand.com/products" -> internal rewrite to "/stores/souled-store/products"
  // "https://shop.brand.com/" -> internal rewrite to "/stores/souled-store"
  const rewritePath = pathname === "/" ? `/stores/${storeSlug}` : `/stores/${storeSlug}${pathname}`;
  const rewriteUrl = new URL(`${rewritePath}${search}`, req.url);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-store-slug", storeSlug);
  requestHeaders.set("x-store-subdomain", storeSlug);
  requestHeaders.set("x-matched-host", parsed.normalizedHost);
  if (parsed.customDomain) {
    requestHeaders.set("x-custom-domain", parsed.customDomain);
  }

  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}
