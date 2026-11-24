import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface WebhookUrlValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
  resolvedIps?: string[];
}

/**
 * Checks whether an IPv4 address string falls into private, loopback, link-local,
 * shared, multicast, or reserved ranges.
 * Blocked CIDRs:
 * - 0.0.0.0/8 (Current network)
 * - 10.0.0.0/8 (Private)
 * - 100.64.0.0/10 (Carrier-grade NAT)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-local / Cloud metadata)
 * - 172.16.0.0/12 (Private)
 * - 192.0.0.0/24 (IETF protocol assignments)
 * - 192.168.0.0/16 (Private)
 * - 198.18.0.0/15 (Benchmark testing)
 * - 224.0.0.0/4 (Multicast)
 * - 240.0.0.0/4 (Reserved / Future use & Broadcast)
 */
export function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4 treated as blocked
  }
  const [a, b, c] = parts as [number, number, number, number];

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a >= 224 && a <= 239) return true; // 224.0.0.0/4
  if (a >= 240) return true; // 240.0.0.0/4

  return false;
}

/**
 * Parses an IPv6 string into 8 16-bit integers (hextets).
 * Supports standard shorthand notation `::` and trailing IPv4-mapped notation.
 */
export function parseIPv6(ip: string): number[] | null {
  let formatted = ip.toLowerCase().trim();

  // Strip brackets if present, e.g. [::1] -> ::1
  if (formatted.startsWith("[") && formatted.endsWith("]")) {
    formatted = formatted.slice(1, -1);
  }

  // Handle trailing dot-decimal IPv4 in IPv4-mapped address, e.g. ::ffff:192.0.2.1
  const v4Match = formatted.match(/(.*):(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match && v4Match[1] && v4Match[2]) {
    const v4Parts = v4Match[2].split(".").map(Number);
    if (v4Parts.length !== 4 || v4Parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return null;
    }
    const [p0 = 0, p1 = 0, p2 = 0, p3 = 0] = v4Parts;
    const hex1 = ((p0 << 8) | p1).toString(16);
    const hex2 = ((p2 << 8) | p3).toString(16);
    formatted = `${v4Match[1]}:${hex1}:${hex2}`;
  }

  const parts = formatted.split("::");
  if (parts.length > 2) return null;

  const head = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":").filter(Boolean) : [];

  if (parts.length === 1 && head.length !== 8) return null;
  if (head.length + tail.length > 8) return null;

  const fillCount = 8 - head.length - tail.length;
  const middle = fillCount > 0 ? Array(fillCount).fill("0") : [];
  const allHextets = [...head, ...middle, ...tail].map((h) => parseInt(h, 16));

  if (allHextets.length !== 8 || allHextets.some((h) => isNaN(h) || h < 0 || h > 0xffff)) {
    return null;
  }
  return allHextets;
}

/**
 * Checks whether an IPv6 address string falls into:
 * - :: (Unspecified)
 * - ::1 (Loopback)
 * - fc00::/7 (Unique Local Address)
 * - fe80::/10 (Link-Local)
 * - ff00::/8 (Multicast)
 * - IPv4-mapped IPv6 (::ffff:x.x.x.x where x.x.x.x is checked against blocked IPv4 ranges)
 */
export function isBlockedIPv6(ip: string): boolean {
  const hextets = parseIPv6(ip);
  if (!hextets) {
    return true; // Malformed IPv6 treated as blocked
  }

  // 1. :: (Unspecified)
  if (hextets.every((h) => h === 0)) {
    return true;
  }

  // 2. ::1 (Loopback)
  if (hextets.slice(0, 7).every((h) => h === 0) && hextets[7] === 1) {
    return true;
  }

  // 3. IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const h5 = hextets[5];
  const h6 = hextets[6];
  const h7 = hextets[7];
  if (
    hextets.slice(0, 5).every((h) => h === 0) &&
    h5 === 0xffff &&
    h6 !== undefined &&
    h7 !== undefined
  ) {
    const a = (h6 >> 8) & 0xff;
    const b = h6 & 0xff;
    const c = (h7 >> 8) & 0xff;
    const d = h7 & 0xff;
    const v4 = `${a}.${b}.${c}.${d}`;
    return isBlockedIPv4(v4);
  }

  const h0 = hextets[0];
  if (h0 === undefined) {
    return true;
  }

  // 4. fc00::/7 (Unique Local Address - ULA)
  if ((h0 & 0xfe00) === 0xfc00) {
    return true;
  }

  // 5. fe80::/10 (Link-Local)
  if ((h0 & 0xffc0) === 0xfe80) {
    return true;
  }

  // 6. ff00::/8 (Multicast)
  if ((h0 & 0xff00) === 0xff00) {
    return true;
  }

  return false;
}

const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  ".localhost",
  ".local",
  ".internal",
];

/**
 * Synchronous syntax validation for a webhook URL.
 * - Valid URL structure
 * - Protocol: https: in production; http: or https: in non-production
 * - No embedded credentials (username/password must be empty)
 * - Reject hostnames: localhost, *.localhost, *.local, *.internal
 * - Reject raw non-public IP literals
 */
export function validateWebhookUrlSyntax(rawUrl: string): {
  valid: boolean;
  error?: string;
  url?: URL;
} {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "Valid webhook URL is required" };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "Invalid webhook URL format" };
  }

  const isProd = process.env.NODE_ENV === "production";
  if (isProd && parsed.protocol !== "https:") {
    return { valid: false, error: "Webhook URL must use HTTPS in production" };
  }
  if (!isProd && parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { valid: false, error: "Webhook URL protocol must be HTTP or HTTPS" };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "Webhook URL must not contain embedded user credentials",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { valid: false, error: "Webhook URL must have a valid hostname" };
  }

  // Check forbidden hostname patterns
  for (const blocked of BLOCKED_HOST_SUFFIXES) {
    if (hostname === blocked || (blocked.startsWith(".") && hostname.endsWith(blocked))) {
      return {
        valid: false,
        error: `Disallowed webhook target host '${hostname}'`,
      };
    }
  }

  // Check raw IP literals
  const unbracketed = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  const ipFamily = isIP(unbracketed);
  if (ipFamily === 4) {
    if (isBlockedIPv4(unbracketed)) {
      return {
        valid: false,
        error: `Webhook URL targets a blocked or private IPv4 address (${unbracketed})`,
      };
    }
  } else if (ipFamily === 6) {
    if (isBlockedIPv6(unbracketed)) {
      return {
        valid: false,
        error: `Webhook URL targets a blocked or private IPv6 address (${unbracketed})`,
      };
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Full SSRF-safe webhook URL validator with DNS resolution check.
 * Resolves all A and AAAA addresses and verifies none fall into blocked private/internal ranges.
 */
export async function validateWebhookUrl(rawUrl: string): Promise<WebhookUrlValidationResult> {
  const syntax = validateWebhookUrlSyntax(rawUrl);
  if (!syntax.valid || !syntax.url) {
    return syntax;
  }

  const parsedUrl = syntax.url;
  const hostname = parsedUrl.hostname.toLowerCase();
  const unbracketed = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // If already an IP literal, syntax check has already validated it
  if (isIP(unbracketed)) {
    return {
      valid: true,
      url: parsedUrl,
      resolvedIps: [unbracketed],
    };
  }

  // Resolve all A / AAAA addresses via DNS
  try {
    const addresses = await lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return {
        valid: false,
        error: `DNS resolution failed: no addresses resolved for host '${hostname}'`,
        url: parsedUrl,
      };
    }

    const resolvedIps: string[] = [];
    for (const record of addresses) {
      const addr = record.address;
      resolvedIps.push(addr);

      if (record.family === 4) {
        if (isBlockedIPv4(addr)) {
          return {
            valid: false,
            error: `SSRF Protection: Webhook destination '${hostname}' resolves to private/disallowed IPv4 address (${addr})`,
            url: parsedUrl,
            resolvedIps,
          };
        }
      } else if (record.family === 6) {
        if (isBlockedIPv6(addr)) {
          return {
            valid: false,
            error: `SSRF Protection: Webhook destination '${hostname}' resolves to private/disallowed IPv6 address (${addr})`,
            url: parsedUrl,
            resolvedIps,
          };
        }
      }
    }

    return {
      valid: true,
      url: parsedUrl,
      resolvedIps,
    };
  } catch (dnsErr) {
    return {
      valid: false,
      error: `DNS lookup failed for host '${hostname}': ${
        dnsErr instanceof Error ? dnsErr.message : String(dnsErr)
      }`,
      url: parsedUrl,
    };
  }
}
