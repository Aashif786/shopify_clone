import { createHash, randomBytes } from "node:crypto";
import type { DatabaseClient } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import {
  AccountDisabledError,
  InvalidCredentialsError,
  SessionExpiredError,
  SessionRevokedError,
} from "../errors/auth-errors.js";

export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  token?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  status: string;
  isPlatformAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidatedSession {
  session: Session;
  user: AuthenticatedUser;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  session_created_at: Date;
  session_expires_at: Date;
  session_revoked_at: Date | null;
  email: string;
  name: string;
  status: string;
  is_platform_admin?: boolean | null;
  user_created_at: Date;
  user_updated_at: Date;
}

export async function createSession(
  db: DatabaseClient,
  userId: string,
  ttlMs: number = DEFAULT_SESSION_TTL_MS
): Promise<Session> {
  const id = generateUuidV7();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  const result = await db.query<{
    id: string;
    user_id: string;
    created_at: Date;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `INSERT INTO sessions (id, user_id, expires_at, token_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, created_at, expires_at, revoked_at`,
    [id, userId, expiresAt, tokenHash]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to insert session record");
  }

  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    token,
  };
}

export async function validateSession(
  db: DatabaseClient,
  sessionToken: string,
  nowMs: number = Date.now()
): Promise<ValidatedSession> {
  if (!sessionToken) {
    throw new InvalidCredentialsError();
  }

  const tokenHash = hashToken(sessionToken);
  const isUuid = UUID_REGEX.test(sessionToken);

  const result = await db.query<SessionRow>(
    `SELECT
       s.id AS session_id,
       s.user_id,
       s.created_at AS session_created_at,
       s.expires_at AS session_expires_at,
       s.revoked_at AS session_revoked_at,
       u.email,
       u.name,
       u.status,
       COALESCE(u.is_platform_admin, FALSE) AS is_platform_admin,
       u.created_at AS user_created_at,
       u.updated_at AS user_updated_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE (s.token_hash = $1)
        OR ($2::boolean = TRUE AND s.token_hash IS NULL AND s.id = $3::uuid)`,
    [tokenHash, isUuid, isUuid ? sessionToken : null]
  );

  const row = result.rows[0];
  if (!row) {
    throw new InvalidCredentialsError();
  }

  if (row.session_revoked_at !== null) {
    throw new SessionRevokedError();
  }

  if (new Date(row.session_expires_at).getTime() <= nowMs) {
    throw new SessionExpiredError();
  }

  if (row.status !== "ACTIVE") {
    throw new AccountDisabledError();
  }

  return {
    session: {
      id: row.session_id,
      userId: row.user_id,
      createdAt: row.session_created_at,
      expiresAt: row.session_expires_at,
      revokedAt: row.session_revoked_at,
    },
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      status: row.status,
      isPlatformAdmin: Boolean(row.is_platform_admin),
      createdAt: row.user_created_at,
      updatedAt: row.user_updated_at,
    },
  };
}

export async function revokeSession(
  db: DatabaseClient,
  sessionIdOrToken: string
): Promise<void> {
  if (!sessionIdOrToken) {
    return;
  }

  const tokenHash = hashToken(sessionIdOrToken);
  const isUuid = UUID_REGEX.test(sessionIdOrToken);

  await db.query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE ((token_hash = $1) OR ($2::boolean = TRUE AND id = $3::uuid))
       AND revoked_at IS NULL`,
    [tokenHash, isUuid, isUuid ? sessionIdOrToken : null]
  );
}

export async function revokeAllUserSessions(
  db: DatabaseClient,
  userId: string
): Promise<void> {
  await db.query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

export async function cleanupExpiredSessions(
  db: DatabaseClient,
  nowMs: number = Date.now()
): Promise<number> {
  const result = await db.query(
    `DELETE FROM sessions
     WHERE expires_at <= $1 OR revoked_at IS NOT NULL`,
    [new Date(nowMs)]
  );

  return result.rowCount;
}
