import type { Database } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
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
     RETURNING id, email, name, password_hash, status, created_at, updated_at`,
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
    `SELECT id, email, name, password_hash, status, created_at, updated_at
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

export { validateSession };
