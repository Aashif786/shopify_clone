export const DEFAULT_SESSION_COOKIE_NAME = "shopify_clone_session";

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
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
