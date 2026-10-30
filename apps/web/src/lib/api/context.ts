import type { Database } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import {
  type AuthContext,
  extractSessionIdFromCookie,
  resolveAuthContext,
} from "@calcart/auth";
import { getDb } from "../db";
import { extractIdempotencyKey } from "./idempotency";

export interface RequestTiming {
  readonly startTime: number;
  readonly stages: Map<string, number>;
  recordStage(name: string, durationMs: number): void;
  getDuration(): number;
  getServerTimingHeader(): string;
}

export function createRequestTiming(startTime: number = performance.now()): RequestTiming {
  const stages = new Map<string, number>();
  return {
    startTime,
    stages,
    recordStage(name: string, durationMs: number) {
      const current = stages.get(name) ?? 0;
      stages.set(name, current + durationMs);
    },
    getDuration() {
      return performance.now() - startTime;
    },
    getServerTimingHeader() {
      const parts: string[] = [];
      for (const [name, duration] of stages.entries()) {
        parts.push(`${name};dur=${duration.toFixed(1)}`);
      }
      parts.push(`total;dur=${(performance.now() - startTime).toFixed(1)}`);
      return parts.join(", ");
    },
  };
}

export interface RequestContext {
  readonly requestId: string;
  readonly req: Request;
  readonly db: Database;
  readonly sessionId: string | null;
  readonly auth: AuthContext | null;
  readonly idempotencyKey: string | null;
  readonly timing: RequestTiming;
}

export interface ResolveContextOptions {
  db?: Database;
}

export function extractSessionId(req: Request): string | null {
  // 1. From Cookie header
  const cookieHeader = req.headers.get("cookie");
  const cookieSession = extractSessionIdFromCookie(cookieHeader);
  if (cookieSession) {
    return cookieSession;
  }

  // 2. From Authorization: Bearer <sessionId>
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return token;
    }
  }

  return null;
}

export function extractRequestId(req: Request): string {
  const header =
    req.headers.get("x-request-id") || req.headers.get("X-Request-Id");
  if (header) {
    const sanitized = header.trim();
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(sanitized)) {
      return sanitized;
    }
  }
  return generateUuidV7();
}

export async function resolveRequestContext(
  req: Request,
  options?: ResolveContextOptions
): Promise<RequestContext> {
  const timing = createRequestTiming();
  const db = options?.db ?? getDb();
  const requestId = extractRequestId(req);
  const sessionId = extractSessionId(req);
  const idempotencyKey = extractIdempotencyKey(req);

  let auth: AuthContext | null = null;

  if (sessionId) {
    const authStart = performance.now();
    try {
      auth = await resolveAuthContext(db, sessionId);
    } catch {
      // Session invalid, expired, revoked, or disabled
      auth = null;
    } finally {
      timing.recordStage("auth", performance.now() - authStart);
    }
  }

  return {
    requestId,
    req,
    db,
    sessionId,
    auth,
    idempotencyKey,
    timing,
  };
}
