import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@calcart/db";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@calcart/auth";
import {
  type PlatformAdminRole,
  type PlatformPermission,
  ROLE_PERMISSIONS,
  isPlatformRole,
} from "../domain/roles.js";
import {
  InvalidCredentialsError,
  AccountLockedError,
  InsufficientPlatformPrivilegesError,
} from "../domain/errors.js";
import { PlatformAuditService } from "./audit-service.js";
import { PlatformSecurityService } from "./security-service.js";

export const PLATFORM_ADMIN_SESSION_COOKIE = "calcart_platform_admin_session";
const SESSION_DURATION_HOURS = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface AuthenticatedPlatformAdmin {
  userId: string;
  email: string;
  name: string;
  role: PlatformAdminRole;
  permissions: PlatformPermission[];
  sessionId: string;
  mfaVerified: boolean;
}

export interface PlatformAdminUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  status: string;
  is_platform_admin: boolean;
  role: string | null;
  mfa_enabled: boolean | null;
  mfa_secret: string | null;
  failed_login_count: number | null;
  locked_until: Date | null;
  last_login_at: Date | null;
}

export class PlatformAuthService {
  private readonly auditService: PlatformAuditService;
  private readonly securityService: PlatformSecurityService;

  constructor(private readonly db: Database) {
    this.auditService = new PlatformAuditService(db);
    this.securityService = new PlatformSecurityService(db);
  }

  private hashSessionToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async login(params: {
    email: string;
    password: string;
    mfaCode?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{
    sessionToken: string;
    admin: AuthenticatedPlatformAdmin;
  }> {
    const normalizedEmail = params.email.trim().toLowerCase();

    // Query user joined with platform_admin_users
    const result = await this.db.query<PlatformAdminUserRow>(
      `SELECT
        u.id,
        u.email,
        u.name,
        u.password_hash,
        u.status,
        COALESCE(u.is_platform_admin, FALSE) as is_platform_admin,
        pau.role,
        pau.mfa_enabled,
        pau.mfa_secret,
        pau.failed_login_count,
        pau.locked_until,
        pau.last_login_at
      FROM users u
      LEFT JOIN platform_admin_users pau ON pau.id = u.id
      WHERE LOWER(u.email) = $1`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    // Constant-time protection against user enumeration
    if (!user || (!user.role && !user.is_platform_admin)) {
      await verifyPassword(params.password, DUMMY_PASSWORD_HASH);
      await this.securityService.record({
        eventType: "PLATFORM_ADMIN_LOGIN_UNKNOWN_ACCOUNT",
        severity: "LOW",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: { attemptedEmail: normalizedEmail },
      });
      throw new InvalidCredentialsError("Invalid platform administrator credentials.");
    }

    // Check account lockout
    const now = new Date();
    if (user.locked_until && new Date(user.locked_until) > now) {
      const remainingMinutes = Math.ceil(
        (new Date(user.locked_until).getTime() - now.getTime()) / 60000
      );
      await this.securityService.record({
        eventType: "PLATFORM_ADMIN_LOGIN_LOCKED_ACCOUNT_ATTEMPT",
        severity: "MEDIUM",
        userId: user.id,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: { email: user.email, remainingMinutes },
      });
      throw new AccountLockedError(remainingMinutes, new Date(user.locked_until));
    }

    // Verify password (exact match or trimmed match for copy-paste safety)
    let isPasswordValid = await verifyPassword(params.password, user.password_hash);
    if (!isPasswordValid && params.password.trim() !== params.password) {
      isPasswordValid = await verifyPassword(params.password.trim(), user.password_hash);
    }
    if (!isPasswordValid) {
      const newFailedCount = (user.failed_login_count ?? 0) + 1;
      let lockedUntil: Date | null = null;
      let isNowLocked = false;

      if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
        isNowLocked = true;
      }

      // Upsert failed count in platform_admin_users
      await this.db.query(
        `INSERT INTO platform_admin_users (id, role, failed_login_count, locked_until, updated_at)
         VALUES ($1, 'support_admin', $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET
           failed_login_count = $2,
           locked_until = $3,
           updated_at = NOW()`,
        [user.id, newFailedCount, lockedUntil]
      );

      await this.securityService.record({
        eventType: isNowLocked
          ? "PLATFORM_ADMIN_ACCOUNT_LOCKED"
          : "PLATFORM_ADMIN_LOGIN_FAILED_PASSWORD",
        severity: isNowLocked ? "HIGH" : "LOW",
        userId: user.id,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: {
          email: user.email,
          failedCount: newFailedCount,
          locked: isNowLocked,
        },
      });

      throw new InvalidCredentialsError("Invalid platform administrator credentials.");
    }

    // If user has is_platform_admin = true but no row in platform_admin_users, provision as super_admin
    let role: PlatformAdminRole;
    if (user.role && isPlatformRole(user.role)) {
      role = user.role;
    } else if (user.is_platform_admin) {
      role = "super_admin";
      await this.db.query(
        `INSERT INTO platform_admin_users (id, role, created_at, updated_at)
         VALUES ($1, 'super_admin', NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET role = 'super_admin', updated_at = NOW()`,
        [user.id]
      );
    } else {
      throw new InsufficientPlatformPrivilegesError("User does not have platform administrative privileges.");
    }

    // Reset failed attempts on success
    await this.db.query(
      `UPDATE platform_admin_users
       SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Create secure platform session
    const rawSessionToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashSessionToken(rawSessionToken);
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600 * 1000);

    await this.db.query(
      `INSERT INTO platform_admin_sessions (
        id, user_id, session_token_hash, mfa_verified, ip_address, user_agent, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
      [
        sessionId,
        user.id,
        tokenHash,
        Boolean(user.mfa_enabled),
        params.ipAddress ?? null,
        params.userAgent ?? null,
        expiresAt,
      ]
    );

    const permissions = Array.from(ROLE_PERMISSIONS[role] ?? []);

    const admin: AuthenticatedPlatformAdmin = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role,
      permissions,
      sessionId,
      mfaVerified: Boolean(user.mfa_enabled),
    };

    await this.securityService.record({
      eventType: "PLATFORM_ADMIN_LOGIN_SUCCESS",
      severity: "INFO",
      userId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: { role, email: user.email },
    });

    await this.auditService.record({
      actorId: user.id,
      actorRole: role,
      action: "auth.login",
      resourceType: "platform_admin_session",
      resourceId: sessionId,
      reason: "Platform administrator login authenticated",
      status: "SUCCESS",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: { role },
    });

    return {
      sessionToken: rawSessionToken,
      admin,
    };
  }

  async validateSessionToken(rawToken: string): Promise<AuthenticatedPlatformAdmin | null> {
    if (!rawToken || rawToken.length < 32) {
      return null;
    }

    const tokenHash = this.hashSessionToken(rawToken);

    const result = await this.db.query<{
      session_id: string;
      user_id: string;
      email: string;
      name: string;
      status: string;
      role: string;
      mfa_verified: boolean;
      expires_at: Date;
      revoked_at: Date | null;
      locked_until: Date | null;
    }>(
      `SELECT
        pas.id as session_id,
        pas.user_id,
        u.email,
        u.name,
        u.status,
        pau.role,
        pas.mfa_verified,
        pas.expires_at,
        pas.revoked_at,
        pau.locked_until
      FROM platform_admin_sessions pas
      JOIN users u ON u.id = pas.user_id
      JOIN platform_admin_users pau ON pau.id = u.id
      WHERE pas.session_token_hash = $1
        AND pas.revoked_at IS NULL
        AND pas.expires_at > NOW()`,
      [tokenHash]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    if (row.status !== "ACTIVE") {
      return null;
    }

    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return null;
    }

    if (!isPlatformRole(row.role)) {
      return null;
    }

    const role = row.role as PlatformAdminRole;
    const permissions = Array.from(ROLE_PERMISSIONS[role] ?? []);

    return {
      userId: row.user_id,
      email: row.email,
      name: row.name,
      role,
      permissions,
      sessionId: row.session_id,
      mfaVerified: row.mfa_verified,
    };
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashSessionToken(rawToken);

    await this.db.query(
      `UPDATE platform_admin_sessions
       SET revoked_at = NOW()
       WHERE session_token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  }

  async revokeSession(
    sessionId: string,
    actorId: string,
    actorRole: PlatformAdminRole,
    reason: string
  ): Promise<void> {
    const sessionRes = await this.db.query<{ user_id: string }>(
      "SELECT user_id FROM platform_admin_sessions WHERE id = $1",
      [sessionId]
    );
    const targetSession = sessionRes.rows[0];
    if (!targetSession) {
      throw new Error("Session not found");
    }

    await this.db.query(
      "UPDATE platform_admin_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL",
      [sessionId]
    );

    await this.auditService.record({
      actorId,
      actorRole,
      action: "auth.session_revoked",
      resourceType: "platform_admin_session",
      resourceId: sessionId,
      reason,
      status: "SUCCESS",
      details: { targetUserId: targetSession.user_id },
    });
  }

  async listActiveSessions(limit = 50): Promise<
    Array<{
      id: string;
      userId: string;
      userName: string;
      userEmail: string;
      role: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
      expiresAt: string;
    }>
  > {
    const result = await this.db.query<{
      id: string;
      user_id: string;
      name: string;
      email: string;
      role: string;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
      expires_at: Date;
    }>(
      `SELECT
        pas.id,
        pas.user_id,
        u.name,
        u.email,
        pau.role,
        pas.ip_address,
        pas.user_agent,
        pas.created_at,
        pas.expires_at
      FROM platform_admin_sessions pas
      JOIN users u ON u.id = pas.user_id
      JOIN platform_admin_users pau ON pau.id = u.id
      WHERE pas.revoked_at IS NULL AND pas.expires_at > NOW()
      ORDER BY pas.created_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.name,
      userEmail: row.email,
      role: row.role,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    }));
  }
}
