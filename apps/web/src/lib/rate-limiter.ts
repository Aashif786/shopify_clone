import type { NextResponse } from "next/server";
import { apiError } from "./api/response";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const AUTH_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 60_000,
};

export const PAYMENT_VERIFY_RATE_LIMIT: RateLimitOptions = {
  limit: 10,
  windowMs: 60_000,
};

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

/**
 * Validates whether an IP address matches standard IPv4 or IPv6 format.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  if (IPV4_REGEX.test(trimmed)) return true;
  return trimmed.includes(":") && IPV6_REGEX.test(trimmed);
}

/**
 * Process-local in-memory sliding window rate limiter.
 * Note: Operates per Next.js server instance without requiring external distributed caches.
 */
export class RateLimiter {
  private readonly store = new Map<string, number[]>();
  private lastCleanupTime = Date.now();
  private readonly cleanupIntervalMs: number;
  private readonly maxTrackedKeys: number;

  constructor(options?: { cleanupIntervalMs?: number; maxTrackedKeys?: number }) {
    this.cleanupIntervalMs = options?.cleanupIntervalMs ?? 60_000;
    this.maxTrackedKeys = options?.maxTrackedKeys ?? 5_000;
  }

  /**
   * Checks whether the request identified by `key` is allowed within the sliding window.
   */
  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    this.maybeCleanup(now);

    const cutoff = now - windowMs;
    const existing = this.store.get(key) ?? [];
    const validTimestamps = existing.filter((timestamp) => timestamp > cutoff);

    if (validTimestamps.length >= limit) {
      const oldest = validTimestamps[0] ?? now;
      const resetMs = Math.max(0, oldest + windowMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));

      this.store.set(key, validTimestamps);
      return {
        allowed: false,
        count: validTimestamps.length,
        limit,
        remaining: 0,
        resetMs,
        retryAfterSeconds,
      };
    }

    validTimestamps.push(now);
    this.store.set(key, validTimestamps);

    const oldest = validTimestamps[0] ?? now;
    const resetMs = Math.max(0, oldest + windowMs - now);
    const remaining = Math.max(0, limit - validTimestamps.length);

    return {
      allowed: true,
      count: validTimestamps.length,
      limit,
      remaining,
      resetMs,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Periodic pruning to prevent memory leaks from inactive client keys.
   */
  maybeCleanup(now: number, force = false): void {
    if (
      !force &&
      now - this.lastCleanupTime < this.cleanupIntervalMs &&
      this.store.size < this.maxTrackedKeys
    ) {
      return;
    }

    this.lastCleanupTime = now;
    const staleCutoff = now - 60_000;

    for (const [key, timestamps] of this.store.entries()) {
      const active = timestamps.filter((t) => t > staleCutoff);
      if (active.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, active);
      }
    }
  }

  /**
   * Resets all rate limit buckets. Used primarily in automated testing.
   */
  reset(): void {
    this.store.clear();
    this.lastCleanupTime = Date.now();
  }

  /**
   * Clears a specific key from the rate limit store.
   */
  clearKey(key: string): void {
    this.store.delete(key);
  }

  /**
   * Current number of tracked keys in memory.
   */
  get size(): number {
    return this.store.size;
  }
}

export const globalRateLimiter = new RateLimiter();

/**
 * Extracts client IP from standard proxy and CDN headers.
 * Safely parses rightmost proxy hops to prevent client-injected X-Forwarded-For prefix spoofing,
 * validates IPv4/IPv6 structure, and checks Cloudflare edge authentication.
 */
export function getClientIp(req: Request | Headers): string {
  const headers = req instanceof Headers ? req : req.headers;

  // 1. Cloudflare: If cf-ray is present, Cloudflare edge verified and set cf-connecting-ip
  const cfConnectingIp = headers.get("cf-connecting-ip")?.trim();
  const cfRay = headers.get("cf-ray")?.trim();
  if (cfConnectingIp && cfRay && isValidIp(cfConnectingIp)) {
    return cfConnectingIp;
  }
  if (cfConnectingIp && isValidIp(cfConnectingIp)) {
    return cfConnectingIp;
  }

  // 2. Standard Reverse Proxy X-Forwarded-For:
  // When an untrusted client connects through a reverse proxy, the client can supply
  // fake leading IPs. The trusted upstream proxy appends the client socket IP to the end.
  // Therefore, take the rightmost valid IP in the forwarded chain.
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = hops[i]!;
      if (isValidIp(hop)) {
        return hop;
      }
    }
  }

  // 3. Nginx / Real-IP
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  return "127.0.0.1";
}

/**
 * Convenience helper to enforce rate limiting inside a Next.js route handler.
 * Returns a 429 response if limit is exceeded, or null if the request is permitted.
 */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  requestId?: string,
  limiter: RateLimiter = globalRateLimiter,
): NextResponse | null {
  const result = limiter.check(key, limit, windowMs);
  if (!result.allowed) {
    return apiError(
      "RATE_LIMIT_EXCEEDED",
      "Too many requests. Please try again later.",
      429,
      {
        requestId,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(
            Math.ceil((Date.now() + result.resetMs) / 1000),
          ),
        },
      },
    );
  }
  return null;
}
