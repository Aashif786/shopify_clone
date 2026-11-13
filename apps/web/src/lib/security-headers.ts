import type { NextResponse } from "next/server";

export interface SecurityHeaderOptions {
  isDevelopment?: boolean;
}

/**
 * Directives for Content Security Policy (GAP-09).
 * Whitelists trusted first-party sources, Razorpay payment processing (script, iframe, api),
 * YouTube/Vimeo video embeds for landing page components, and configured image CDNs.
 */
export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}): string {
  const isDev = options.isDevelopment ?? process.env.NODE_ENV !== "production";

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://checkout.razorpay.com",
  ];

  const connectSrc = [
    "'self'",
    "https://api.razorpay.com",
    "https://lumberjack.razorpay.com",
    "https://lumberjack-cx.razorpay.com",
  ];

  if (isDev) {
    connectSrc.push("ws:", "wss:");
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://images.unsplash.com",
      "https://images.pexels.com",
      "https://*.razorpay.com",
      "https://cdn.example.com",
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": connectSrc,
    "frame-src": [
      "'self'",
      "https://api.razorpay.com",
      "https://checkout.razorpay.com",
      "https://www.youtube.com",
      "https://player.vimeo.com",
    ],
    "media-src": ["'self'", "https:", "data:", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://api.razorpay.com"],
    "frame-ancestors": ["'self'"],
  };

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")};`)
    .join(" ");
}

/**
 * Returns a dictionary of standard, production-grade security headers.
 */
export function getSecurityHeaders(options: SecurityHeaderOptions = {}): Record<string, string> {
  const isDev = options.isDevelopment ?? process.env.NODE_ENV !== "production";
  const csp = buildContentSecurityPolicy(options);

  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-XSS-Protection": "0",
  };

  if (!isDev) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
}

/**
 * Mutates and returns the response with security headers attached.
 */
export function applySecurityHeaders<T extends Response | NextResponse>(
  response: T,
  options: SecurityHeaderOptions = {},
): T {
  const headers = getSecurityHeaders(options);

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}
