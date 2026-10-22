import type { Database } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import {
  AccountDisabledError,
  InvalidCredentialsError,
  SessionExpiredError,
  SessionRevokedError,
} from "../errors/auth-errors.js";

export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
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
  db: Database,
  userId: string,
  ttlMs: number = DEFAULT_SESSION_TTL_MS
): Promise<Session> {
  const id = generateUuidV7();
  const expiresAt = new Date(Date.now() + ttlMs);

  const result = await db.query<{
    id: string;
    user_id: string;
    created_at: Date;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, created_at, expires_at, revoked_at`,
    [id, userId, expiresAt]
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
  };
}

export async function validateSession(
  db: Database,
  sessionId: string,
  nowMs: number = Date.now()
): Promise<ValidatedSession> {
  if (!sessionId) {
    throw new InvalidCredentialsError();
  }

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
     WHERE s.id = $1`,
    [sessionId]
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
  db: Database,
  sessionId: string
): Promise<void> {
  await db.query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId]
  );
}

export async function revokeAllUserSessions(
  db: Database,
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
  db: Database,
  nowMs: number = Date.now()
): Promise<number> {
  const result = await db.query(
    `DELETE FROM sessions
     WHERE expires_at <= $1 OR revoked_at IS NOT NULL`,
    [new Date(nowMs)]
  );

  return result.rowCount;
}
