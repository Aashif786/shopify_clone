export interface ParsedHostname {
  /** The normalized hostname (lowercased, port and protocol stripped, trimmed) */
  normalizedHost: string;
  /** Whether the host is the apex/root platform domain (e.g. calcart.com or localhost) */
  isPlatform: boolean;
  /** Whether the subdomain is a reserved platform name (e.g. www, app, admin, api) */
  isReserved: boolean;
  /** Extracted subdomain string if hostname is <subdomain>.<platformDomain> */
  subdomain: string | null;
  /** Custom domain string if hostname is not a platform domain or subdomain */
  customDomain: string | null;
}

export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "www",
  "app",
  "admin",
  "api",
  "auth",
  "billing",
  "checkout",
  "dashboard",
  "platform",
  "assets",
  "static",
  "cdn",
  "status",
  "help",
  "support",
  "docs",
  "dev",
  "staging",
  "demo",
  "test",
  "mail",
  "email",
  "smtp",
  "calcart",
  "stores",
  "merchant",
]);

const VALID_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Normalizes an arbitrary host header into a clean hostname.
 * Strips protocol, port, trailing dots, and converts to lowercase.
 */
export function normalizeHostname(rawHost: string | null | undefined): string {
  if (!rawHost) return "";
  let host = rawHost.trim().toLowerCase();
  // Strip protocol if mistakenly passed
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      host = host.split("://")[1] || "";
    }
  }
  // Strip port (e.g. localhost:3000 -> localhost)
  if (host.includes(":")) {
    host = host.split(":")[0] || "";
  }
  // Strip trailing dot
  if (host.endsWith(".")) {
    host = host.slice(0, -1);
  }
  return host.trim();
}

/**
 * Parses an incoming Host header against the configured platform domain.
 */
export function parseHostname(
  rawHost: string | null | undefined,
  configuredPlatformDomain: string = "calcart.com",
): ParsedHostname {
  const normalizedHost = normalizeHostname(rawHost);
  if (!normalizedHost) {
    return {
      normalizedHost: "",
      isPlatform: true,
      isReserved: false,
      subdomain: null,
      customDomain: null,
    };
  }

  const platformDomain = normalizeHostname(configuredPlatformDomain) || "calcart.com";

  // 1. Check if it's localhost or an IP address
  const isLocalhostApex =
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1";

  if (isLocalhostApex) {
    return {
      normalizedHost,
      isPlatform: true,
      isReserved: false,
      subdomain: null,
      customDomain: null,
    };
  }

  // Check localhost subdomains (e.g., "souled-store.localhost")
  if (normalizedHost.endsWith(".localhost")) {
    const parts = normalizedHost.split(".");
    const sub = parts[0] || "";
    const isReserved = RESERVED_SUBDOMAINS.has(sub);
    const isValid = VALID_SUBDOMAIN_REGEX.test(sub);

    return {
      normalizedHost,
      isPlatform: false,
      isReserved,
      subdomain: !isReserved && isValid ? sub : null,
      customDomain: null,
    };
  }

  // 2. Check if it matches apex platform domain
  if (normalizedHost === platformDomain) {
    return {
      normalizedHost,
      isPlatform: true,
      isReserved: false,
      subdomain: null,
      customDomain: null,
    };
  }

  // 3. Check if it's a subdomain of the platform domain
  const platformSuffix = `.${platformDomain}`;
  if (normalizedHost.endsWith(platformSuffix)) {
    const prefix = normalizedHost.slice(0, -platformSuffix.length);
    const sub = prefix.split(".")[0] || "";
    const isReserved = RESERVED_SUBDOMAINS.has(sub);
    const isValid = VALID_SUBDOMAIN_REGEX.test(sub);

    return {
      normalizedHost,
      isPlatform: false,
      isReserved,
      subdomain: !isReserved && isValid ? sub : null,
      customDomain: null,
    };
  }

  // 4. Otherwise, it is an external custom domain candidate
  return {
    normalizedHost,
    isPlatform: false,
    isReserved: false,
    subdomain: null,
    customDomain: normalizedHost,
  };
}
