import { createHash, randomBytes } from "node:crypto";
import type { Database } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "../credentials/password.js";
import {
  isValidEmailFormat,
  normalizeEmail,
  validatePasswordPolicy,
} from "../credentials/validation.js";
import {
  AccountDisabledError,
  AuthenticationError,
  InvalidCredentialsError,
  InvalidTokenError,
  TokenExpiredError,
  UserAlreadyExistsError,
} from "../errors/auth-errors.js";
import {
  type AuthenticatedUser,
  type Session,
  createSession,
  revokeAllUserSessions,
  revokeSession,
  validateSession,
} from "../sessions/session-service.js";

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: AuthenticatedUser;
  session: Session;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  status: string;
  is_platform_admin?: boolean | null;
  created_at: Date;
  updated_at: Date;
}

export async function register(
  db: Database,
  input: RegisterInput
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmailFormat(email)) {
    throw new AuthenticationError("Invalid email address format", "INVALID_EMAIL");
  }

  const name = input.name?.trim();
  if (!name) {
    throw new AuthenticationError("Name is required", "INVALID_NAME");
  }

  const policyCheck = validatePasswordPolicy(input.password);
  if (!policyCheck.valid) {
    throw new AuthenticationError(
      policyCheck.reason ?? "Password does not meet policy requirements",
      "WEAK_PASSWORD"
    );
  }

  const existing = await db.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing.rowCount > 0) {
    throw new UserAlreadyExistsError();
  }

  const passwordHash = await hashPassword(input.password);
  const userId = generateUuidV7();

  const userResult = await db.query<UserRow>(
    `INSERT INTO users (id, email, name, password_hash, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE')
     RETURNING id, email, name, password_hash, status, COALESCE(is_platform_admin, FALSE) AS is_platform_admin, created_at, updated_at`,
    [userId, email, name, passwordHash]
  );

  const row = userResult.rows[0];
  if (!row) {
    throw new Error("Failed to insert user record");
  }

  const session = await createSession(db, row.id);

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      status: row.status,
      isPlatformAdmin: Boolean(row.is_platform_admin),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    session,
  };
}

export async function login(
  db: Database,
  input: LoginInput
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);

  const userResult = await db.query<UserRow>(
    `SELECT id, email, name, password_hash, status, COALESCE(is_platform_admin, FALSE) AS is_platform_admin, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email]
  );

  const row = userResult.rows[0];

  if (!row) {
    // Constant-time execution against dummy hash to prevent email enumeration timing attacks
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
    throw new InvalidCredentialsError();
  }

  const isPasswordValid = await verifyPassword(input.password, row.password_hash);
  if (!isPasswordValid) {
    throw new InvalidCredentialsError();
  }

  if (row.status !== "ACTIVE") {
    throw new AccountDisabledError();
  }

  const session = await createSession(db, row.id);

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      status: row.status,
      isPlatformAdmin: Boolean(row.is_platform_admin),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    session,
  };
}

export async function logout(
  db: Database,
  sessionId: string
): Promise<void> {
  await revokeSession(db, sessionId);
}

export async function logoutAll(
  db: Database,
  userId: string
): Promise<void> {
  await revokeAllUserSessions(db, userId);
}

export async function changePassword(
  db: Database,
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const userResult = await db.query<UserRow>(
    `SELECT id, password_hash, status
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const row = userResult.rows[0];
  if (!row) {
    throw new InvalidCredentialsError();
  }

  const isCurrentValid = await verifyPassword(currentPassword, row.password_hash);
  if (!isCurrentValid) {
    throw new InvalidCredentialsError();
  }

  const policyCheck = validatePasswordPolicy(newPassword);
  if (!policyCheck.valid) {
    throw new AuthenticationError(
      policyCheck.reason ?? "New password does not meet requirements",
      "WEAK_PASSWORD"
    );
  }

  const newHash = await hashPassword(newPassword);

  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [newHash, userId]
    );

    // Invalidate existing sessions so stolen session tokens cannot persist
    await client.query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  });
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createPasswordResetToken(
  db: Database,
  email: string
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  const userResult = await db.query<UserRow>(
    `SELECT id, email, status FROM users WHERE email = $1`,
    [normalized]
  );
  const user = userResult.rows[0];
  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const tokenId = generateUuidV7();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenId, user.id, tokenHash, expiresAt]
  );

  return rawToken;
}

export async function resetPasswordWithToken(
  db: Database,
  rawToken: string,
  newPassword: string
): Promise<{ id: string; email: string; name: string }> {
  const policyCheck = validatePasswordPolicy(newPassword);
  if (!policyCheck.valid) {
    throw new AuthenticationError(
      policyCheck.reason ?? "New password does not meet requirements",
      "WEAK_PASSWORD"
    );
  }

  const tokenHash = hashToken(rawToken.trim());
  const tokenResult = await db.query<{
    id: string;
    user_id: string;
    expires_at: Date;
    used_at: Date | null;
  }>(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  const tokenRow = tokenResult.rows[0];
  if (!tokenRow || tokenRow.used_at !== null) {
    throw new InvalidTokenError("Password reset token is invalid or has already been used");
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    throw new TokenExpiredError("Password reset token has expired");
  }

  const newHash = await hashPassword(newPassword);

  return await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [tokenRow.id]
    );

    const userResult = await client.query<{ id: string; email: string; name: string }>(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, name`,
      [newHash, tokenRow.user_id]
    );

    await client.query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [tokenRow.user_id]
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new AuthenticationError("User associated with token was not found", "USER_NOT_FOUND");
    }
    return user;
  });
}

export async function updateUserProfile(
  db: Database,
  userId: string,
  input: { name?: string }
): Promise<AuthenticatedUser> {
  const name = input.name?.trim();
  if (name !== undefined) {
    if (!name || name.length > 100) {
      throw new AuthenticationError("Name must be between 1 and 100 characters", "INVALID_NAME");
    }
  }

  const result = await db.query<UserRow>(
    `UPDATE users
     SET name = COALESCE($1, name), updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, name, status, COALESCE(is_platform_admin, FALSE) AS is_platform_admin, created_at, updated_at`,
    [name ?? null, userId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new AuthenticationError("User not found", "USER_NOT_FOUND");
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    isPlatformAdmin: Boolean(row.is_platform_admin),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { validateSession };
