export const DEFAULT_SESSION_COOKIE_NAME = "calcart_session";
export const LEGACY_SESSION_COOKIE_NAME = "shopify_clone_session";
export const CUSTOMER_SESSION_COOKIE_NAME = "calcart_customer_session";

export function getStoreCustomerSessionCookieName(storeSlug: string): string {
  const cleanSlug = storeSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `sc_${cleanSlug}_session`;
}

export interface SessionCookieOptions {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  expires?: Date;
  maxAge?: number;
}

export function getSessionCookieOptions(
  expiresAt?: Date,
  isProduction: boolean = process.env.NODE_ENV === "production"
): SessionCookieOptions {
  return {
    name: DEFAULT_SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  };
}

export function serializeSessionCookie(
  sessionId: string,
  options?: Partial<SessionCookieOptions>
): string {
  const merged: SessionCookieOptions = {
    ...getSessionCookieOptions(),
    ...options,
  };

  const parts: string[] = [
    `${merged.name}=${encodeURIComponent(sessionId)}`,
    `Path=${merged.path}`,
  ];

  if (merged.httpOnly) {
    parts.push("HttpOnly");
  }

  if (merged.secure) {
    parts.push("Secure");
  }

  const capitalizedSameSite =
    merged.sameSite.charAt(0).toUpperCase() + merged.sameSite.slice(1);
  parts.push(`SameSite=${capitalizedSameSite}`);

  if (merged.expires) {
    parts.push(`Expires=${merged.expires.toUTCString()}`);
  }

  if (typeof merged.maxAge === "number") {
    parts.push(`Max-Age=${merged.maxAge}`);
  }

  return parts.join("; ");
}

export function serializeExpiredSessionCookie(
  options?: Partial<SessionCookieOptions>
): string {
  return serializeSessionCookie("", {
    ...options,
    expires: new Date(0),
    maxAge: 0,
  });
}

export function serializeCustomerSessionCookie(
  sessionId: string,
  storeSlug?: string,
  options?: Partial<SessionCookieOptions>
): string {
  const cookieName = storeSlug
    ? getStoreCustomerSessionCookieName(storeSlug)
    : CUSTOMER_SESSION_COOKIE_NAME;

  return serializeSessionCookie(sessionId, {
    name: cookieName,
    ...options,
  });
}

export function serializeExpiredCustomerSessionCookie(
  storeSlug?: string,
  options?: Partial<SessionCookieOptions>
): string {
  const cookieName = storeSlug
    ? getStoreCustomerSessionCookieName(storeSlug)
    : CUSTOMER_SESSION_COOKIE_NAME;

  return serializeSessionCookie("", {
    name: cookieName,
    ...options,
    expires: new Date(0),
    maxAge: 0,
  });
}

export function extractSessionIdFromCookie(
  cookieHeader: string | null | undefined,
  cookieName: string = DEFAULT_SESSION_COOKIE_NAME
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const escapedName = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));

  if (!match || !match[1]) {
    if (cookieName === DEFAULT_SESSION_COOKIE_NAME) {
      return extractSessionIdFromCookie(cookieHeader, LEGACY_SESSION_COOKIE_NAME);
    }
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function extractCustomerSessionIdFromCookie(
  cookieHeader: string | null | undefined,
  storeSlug?: string | null
): string | null {
  if (!cookieHeader) {
    return null;
  }

  // 1. Check store-scoped customer cookie if storeSlug provided
  if (storeSlug) {
    const storeCookieName = getStoreCustomerSessionCookieName(storeSlug);
    const storeSession = extractSessionIdFromCookie(cookieHeader, storeCookieName);
    if (storeSession) {
      return storeSession;
    }
  }

  // 2. Check generic customer session cookie
  const customerSession = extractSessionIdFromCookie(cookieHeader, CUSTOMER_SESSION_COOKIE_NAME);
  if (customerSession) {
    return customerSession;
  }

  return null;
}
