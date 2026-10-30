import { afterEach, describe, expect, it } from "vitest";
import {
  AccountDisabledError,
  InvalidCredentialsError,
  SessionExpiredError,
  SessionRevokedError,
  createSession,
  extractSessionIdFromCookie,
  getSessionCookieOptions,
  hashPassword,
  revokeAllUserSessions,
  revokeSession,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  validateSession,
} from "@calcart/auth";
import { generateUuidV7, runMigrations } from "@calcart/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Session handling and cookies", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  describe("Cookie utilities", () => {
    it("generates secure session cookie options", () => {
      const expires = new Date(Date.now() + 10_000);
      const devOptions = getSessionCookieOptions(expires, false);
      expect(devOptions.httpOnly).toBe(true);
      expect(devOptions.secure).toBe(false);
      expect(devOptions.sameSite).toBe("lax");
      expect(devOptions.path).toBe("/");
      expect(devOptions.expires).toBe(expires);

      const prodOptions = getSessionCookieOptions(expires, true);
      expect(prodOptions.secure).toBe(true);
    });

    it("serializes session cookie header", () => {
      const expires = new Date(Date.now() + 3600_000);
      const cookie = serializeSessionCookie("test-session-id", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires,
      });

      expect(cookie).toContain("calcart_session=test-session-id");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain(`Expires=${expires.toUTCString()}`);
    });

    it("serializes expired session cookie for logout", () => {
      const cookie = serializeExpiredSessionCookie();
      expect(cookie).toContain("calcart_session=");
      expect(cookie).toContain("Max-Age=0");
    });

    it("extracts session ID from Cookie header", () => {
      const header = "other=123; calcart_session=abc-123-xyz; theme=dark";
      expect(extractSessionIdFromCookie(header)).toBe("abc-123-xyz");
      expect(extractSessionIdFromCookie("")).toBeNull();
      expect(extractSessionIdFromCookie(null)).toBeNull();
    });
  });

  describe("Session lifecycle in database", () => {
    async function setupTestDb() {
      const isolated = await createIsolatedDatabase();
      close = isolated.close;
      await runMigrations(isolated.database);
      return isolated.database;
    }

    async function seedUser(
      db: Awaited<ReturnType<typeof setupTestDb>>,
      email: string = "merchant@example.com",
      status: string = "ACTIVE"
    ) {
      const userId = generateUuidV7();
      const passwordHash = await hashPassword("secure-password-123");
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, email, "Test Merchant", passwordHash, status]
      );
      return userId;
    }

    it("creates durable session and validates it", async () => {
      const db = await setupTestDb();
      const userId = await seedUser(db);

      const session = await createSession(db, userId);
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.revokedAt).toBeNull();
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const validated = await validateSession(db, session.id);
      expect(validated.session.id).toBe(session.id);
      expect(validated.user.id).toBe(userId);
      expect(validated.user.email).toBe("merchant@example.com");
      expect(validated.user.status).toBe("ACTIVE");
      expect((validated.user as unknown as { password_hash?: string }).password_hash).toBeUndefined();
    });

    it("rejects non-existent session", async () => {
      const db = await setupTestDb();
      await expect(validateSession(db, generateUuidV7())).rejects.toThrowError(
        InvalidCredentialsError
      );
    });

    it("rejects expired session", async () => {
      const db = await setupTestDb();
      const userId = await seedUser(db);

      // Create session with negative TTL (already expired)
      const session = await createSession(db, userId, -1_000);

      await expect(validateSession(db, session.id)).rejects.toThrowError(
        SessionExpiredError
      );
    });

    it("rejects revoked session", async () => {
      const db = await setupTestDb();
      const userId = await seedUser(db);

      const session = await createSession(db, userId);
      await revokeSession(db, session.id);

      await expect(validateSession(db, session.id)).rejects.toThrowError(
        SessionRevokedError
      );
    });

    it("rejects session if user is disabled or suspended", async () => {
      const db = await setupTestDb();
      const userId = await seedUser(db, "suspended@example.com", "SUSPENDED");

      const session = await createSession(db, userId);

      await expect(validateSession(db, session.id)).rejects.toThrowError(
        AccountDisabledError
      );
    });

    it("revokes all sessions for a user", async () => {
      const db = await setupTestDb();
      const userId = await seedUser(db);

      const session1 = await createSession(db, userId);
      const session2 = await createSession(db, userId);

      await revokeAllUserSessions(db, userId);

      await expect(validateSession(db, session1.id)).rejects.toThrowError(
        SessionRevokedError
      );
      await expect(validateSession(db, session2.id)).rejects.toThrowError(
        SessionRevokedError
      );
    });
  });
});
