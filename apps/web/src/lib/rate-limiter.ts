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

export const REVIEW_REPORT_RATE_LIMIT: RateLimitOptions = {
  limit: 10,
  windowMs: 60_000,
};

/**
 * Identity used when no trusted proxy has supplied a client address.
 * Every direct caller shares this bucket, so spoofed IP headers cannot open a new one.
 */
export const UNVERIFIED_CLIENT_IP = "unverified-client";

const OVERFLOW_KEY = "__rate_limit_overflow__";

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

export type TrustedProxyConfig =
  | { mode: "none" }
  | { mode: "forwarded"; hops: number }
  | { mode: "cloudflare" }
  | { mode: "real-ip" };

/**
 * Shared counter storage. The default memory store is process-local.
 * Two limiters share limits only when they are given the same store.
 */
export interface RateLimitStore {
  get(key: string): readonly number[] | undefined;
  set(key: string, timestamps: readonly number[]): void;
  delete(key: string): void;
  has(key: string): boolean;
  keys(): Iterable<string>;
  readonly size: number;
  clear(): void;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, number[]>();

  get size(): number {
    return this.entries.size;
  }

  get(key: string): readonly number[] | undefined {
    return this.entries.get(key);
  }

  set(key: string, timestamps: readonly number[]): void {
    this.entries.set(key, [...timestamps]);
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  keys(): Iterable<string> {
    return this.entries.keys();
  }

  clear(): void {
    this.entries.clear();
  }
}

export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  if (IPV4_REGEX.test(trimmed)) return true;
  return isValidIpv6(trimmed);
}

function isValidIpv6(value: string): boolean {
  if (!value.includes(":") || !/^[0-9a-fA-F:]+$/.test(value)) return false;
  if (value.includes("::") && value.indexOf("::") !== value.lastIndexOf("::")) return false;
  const groups = value.split(":");
  if (groups.length < 3 || groups.length > 8) return false;
  return groups.every((group) => group.length <= 4);
}

/**
 * `TRUSTED_PROXY` selects which header a deployed edge is known to overwrite.
 * `none` ignores every client IP header.
 * `forwarded:<hops>` reads X-Forwarded-For, counting `hops` trusted appenders from the right.
 * `cloudflare` reads cf-connecting-ip. `real-ip` reads X-Real-IP.
 * Unknown values fail closed to `none`.
 */
export function parseTrustedProxyConfig(raw: string | undefined | null): TrustedProxyConfig {
  const value = raw?.trim().toLowerCase() ?? "";
  if (!value || value === "none") return { mode: "none" };
  if (value === "cloudflare") return { mode: "cloudflare" };
  if (value === "real-ip") return { mode: "real-ip" };
  const forwarded = /^forwarded:(\d+)$/.exec(value);
  if (forwarded) {
    const hops = Number(forwarded[1]);
    if (Number.isInteger(hops) && hops >= 1 && hops <= 8) {
      return { mode: "forwarded", hops };
    }
  }
  return { mode: "none" };
}

export function readTrustedProxyConfig(
  env: NodeJS.ProcessEnv = process.env,
): TrustedProxyConfig {
  return parseTrustedProxyConfig(env.TRUSTED_PROXY);
}

export function getClientIp(
  req: Request | Headers,
  config: TrustedProxyConfig = readTrustedProxyConfig(),
): string {
  const headers = req instanceof Headers ? req : req.headers;

  if (config.mode === "cloudflare") {
    const connectingIp = headers.get("cf-connecting-ip")?.trim() ?? "";
    return isValidIp(connectingIp) ? connectingIp : UNVERIFIED_CLIENT_IP;
  }

  if (config.mode === "real-ip") {
    const realIp = headers.get("x-real-ip")?.trim() ?? "";
    return isValidIp(realIp) ? realIp : UNVERIFIED_CLIENT_IP;
  }

  if (config.mode === "forwarded") {
    const forwarded = headers.get("x-forwarded-for");
    if (!forwarded) return UNVERIFIED_CLIENT_IP;
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    const index = hops.length - config.hops;
    if (index < 0) return UNVERIFIED_CLIENT_IP;
    const selected = hops[index] ?? "";
    return isValidIp(selected) ? selected : UNVERIFIED_CLIENT_IP;
  }

  return UNVERIFIED_CLIENT_IP;
}

export class RateLimiter {
  private readonly store: RateLimitStore;
  private lastCleanupTime = Date.now();
  private readonly cleanupIntervalMs: number;
  private readonly maxTrackedKeys: number;

  constructor(options?: {
    cleanupIntervalMs?: number;
    maxTrackedKeys?: number;
    store?: RateLimitStore;
  }) {
    this.store = options?.store ?? new MemoryRateLimitStore();
    this.cleanupIntervalMs = options?.cleanupIntervalMs ?? 60_000;
    this.maxTrackedKeys = Math.max(1, options?.maxTrackedKeys ?? 5_000);
  }

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    this.maybeCleanup(now);
    const bucket = this.resolveBucket(key);

    const cutoff = now - windowMs;
    const existing = this.store.get(bucket) ?? [];
    const validTimestamps = existing.filter((timestamp) => timestamp > cutoff);

    if (validTimestamps.length >= limit) {
      const oldest = validTimestamps[0] ?? now;
      const resetMs = Math.max(0, oldest + windowMs - now);
      this.store.set(bucket, validTimestamps);
      return {
        allowed: false,
        count: validTimestamps.length,
        limit,
        remaining: 0,
        resetMs,
        retryAfterSeconds: Math.max(1, Math.ceil(resetMs / 1000)),
      };
    }

    validTimestamps.push(now);
    this.store.set(bucket, validTimestamps);
    const oldest = validTimestamps[0] ?? now;
    return {
      allowed: true,
      count: validTimestamps.length,
      limit,
      remaining: Math.max(0, limit - validTimestamps.length),
      resetMs: Math.max(0, oldest + windowMs - now),
      retryAfterSeconds: 0,
    };
  }

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
    for (const key of [...this.store.keys()]) {
      const active = (this.store.get(key) ?? []).filter((timestamp) => timestamp > staleCutoff);
      if (active.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, active);
      }
    }
  }

  reset(): void {
    this.store.clear();
    this.lastCleanupTime = Date.now();
  }

  clearKey(key: string): void {
    this.store.delete(key);
  }

  get size(): number {
    return this.store.size;
  }

  private resolveBucket(key: string): string {
    if (this.store.has(key) || this.store.size < this.maxTrackedKeys) {
      return key;
    }
    return OVERFLOW_KEY;
  }
}

export const globalRateLimiter = new RateLimiter();

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
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + result.resetMs) / 1000)),
        },
      },
    );
  }
  return null;
}
