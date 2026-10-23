import { afterEach, describe, expect, it } from "vitest";
import {
  AccountDisabledError,
  AuthenticationError,
  InvalidCredentialsError,
  InvalidTokenError,
  SessionRevokedError,
  UserAlreadyExistsError,
  changePassword,
  createPasswordResetToken,
  login,
  logout,
  register,
  resetPasswordWithToken,
  resolveAuthContext,
  updateUserProfile,
  validateSession,
} from "@shopify-clone/auth";
import { runMigrations } from "@shopify-clone/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Authentication Service", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupTestDb() {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  describe("Registration", () => {
    it("registers new user and creates an active session", async () => {
      const db = await setupTestDb();

      const result = await register(db, {
        email: "Owner@Store.com",
        password: "secure-master-password",
        name: "Store Owner",
      });

      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe("owner@store.com");
      expect(result.user.name).toBe("Store Owner");
      expect(result.user.status).toBe("ACTIVE");
      expect(result.session.id).toBeDefined();

      const context = await resolveAuthContext(db, result.session.id);
      expect(context.user.id).toBe(result.user.id);
      expect(context.session.id).toBe(result.session.id);
    });

    it("prevents duplicate registration with normalized email", async () => {
      const db = await setupTestDb();

      await register(db, {
        email: "alice@example.com",
        password: "password12345",
        name: "Alice",
      });

      await expect(
        register(db, {
          email: "  ALICE@example.com  ",
          password: "anotherpassword123",
          name: "Alice Duplicate",
        })
      ).rejects.toThrowError(UserAlreadyExistsError);
    });

    it("rejects weak passwords according to policy", async () => {
      const db = await setupTestDb();

      await expect(
        register(db, {
          email: "bob@example.com",
          password: "short",
          name: "Bob",
        })
      ).rejects.toThrowError(AuthenticationError);
    });

    it("rejects invalid email formats", async () => {
      const db = await setupTestDb();

      await expect(
        register(db, {
          email: "not-an-email",
          password: "valid-password-123",
          name: "Invalid",
        })
      ).rejects.toThrowError(AuthenticationError);
    });
  });

  describe("Login", () => {
    it("logs in with valid credentials and creates a new session", async () => {
      const db = await setupTestDb();

      await register(db, {
        email: "merchant@test.com",
        password: "valid-password-1234",
        name: "Merchant",
      });

      const loggedIn = await login(db, {
        email: "  MERCHANT@test.com  ",
        password: "valid-password-1234",
      });

      expect(loggedIn.user.email).toBe("merchant@test.com");
      expect(loggedIn.session.id).toBeDefined();
    });

    it("rejects incorrect password with generic error to prevent enumeration", async () => {
      const db = await setupTestDb();

      await register(db, {
        email: "merchant@test.com",
        password: "valid-password-1234",
        name: "Merchant",
      });

      await expect(
        login(db, {
          email: "merchant@test.com",
          password: "wrong-password",
        })
      ).rejects.toThrowError(InvalidCredentialsError);
    });

    it("rejects nonexistent user with same generic error to prevent enumeration", async () => {
      const db = await setupTestDb();

      await expect(
        login(db, {
          email: "nonexistent@test.com",
          password: "any-password",
        })
      ).rejects.toThrowError(InvalidCredentialsError);
    });

    it("rejects inactive or suspended accounts", async () => {
      const db = await setupTestDb();

      const registered = await register(db, {
        email: "suspended@test.com",
        password: "valid-password-1234",
        name: "Suspended User",
      });

      await db.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [
        registered.user.id,
      ]);

      await expect(
        login(db, {
          email: "suspended@test.com",
          password: "valid-password-1234",
        })
      ).rejects.toThrowError(AccountDisabledError);
    });
  });

  describe("Logout and Password Change", () => {
    it("logs out and revokes the active session", async () => {
      const db = await setupTestDb();

      const { session } = await register(db, {
        email: "logout-user@test.com",
        password: "password12345",
        name: "Logout User",
      });

      await logout(db, session.id);

      await expect(validateSession(db, session.id)).rejects.toThrowError(
        SessionRevokedError
      );
    });

    it("changes password and revokes previous sessions across devices", async () => {
      const db = await setupTestDb();

      const { user, session: oldSession } = await register(db, {
        email: "pwd-change@test.com",
        password: "old-password-1234",
        name: "Password Changer",
      });

      await changePassword(
        db,
        user.id,
        "old-password-1234",
        "new-secure-password-5678"
      );

      // Old session must be revoked
      await expect(validateSession(db, oldSession.id)).rejects.toThrowError(
        SessionRevokedError
      );

      // Old password fails to log in
      await expect(
        login(db, {
          email: "pwd-change@test.com",
          password: "old-password-1234",
        })
      ).rejects.toThrowError(InvalidCredentialsError);

      // New password logs in successfully
      const newLogin = await login(db, {
        email: "pwd-change@test.com",
        password: "new-secure-password-5678",
      });
      expect(newLogin.user.id).toBe(user.id);
    });
  });

  describe("Password Recovery & Reset Tokens", () => {
    it("generates a reset token and successfully resets password", async () => {
      const db = await setupTestDb();

      const { user, session: oldSession } = await register(db, {
        email: "forgot-pwd@test.com",
        password: "original-password-1234",
        name: "Forgot Pwd User",
      });

      const token = await createPasswordResetToken(db, "forgot-pwd@test.com");
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Reset password with token
      await resetPasswordWithToken(db, token!, "brand-new-password-9999");

      // Old session must be invalidated
      await expect(validateSession(db, oldSession.id)).rejects.toThrowError(
        SessionRevokedError
      );

      // Old password fails
      await expect(
        login(db, {
          email: "forgot-pwd@test.com",
          password: "original-password-1234",
        })
      ).rejects.toThrowError(InvalidCredentialsError);

      // New password succeeds
      const newLogin = await login(db, {
        email: "forgot-pwd@test.com",
        password: "brand-new-password-9999",
      });
      expect(newLogin.user.id).toBe(user.id);

      // Re-using the same token fails
      await expect(
        resetPasswordWithToken(db, token!, "another-password-1234")
      ).rejects.toThrowError(InvalidTokenError);
    });

    it("rejects invalid or non-existent reset tokens", async () => {
      const db = await setupTestDb();

      await expect(
        resetPasswordWithToken(db, "nonexistent-token-12345", "new-password-1234")
      ).rejects.toThrowError(InvalidTokenError);
    });

    it("returns null for unknown email without revealing account existence", async () => {
      const db = await setupTestDb();

      const result = await createPasswordResetToken(db, "nonexistent@example.com");
      expect(result).toBeNull();
    });
  });

  describe("User Profile Management", () => {
    it("updates user display name", async () => {
      const db = await setupTestDb();

      const { user } = await register(db, {
        email: "profile-test@example.com",
        password: "password12345",
        name: "Old Name",
      });

      const updated = await updateUserProfile(db, user.id, { name: "Updated Name" });
      expect(updated.name).toBe("Updated Name");
      expect(updated.email).toBe("profile-test@example.com");
    });

    it("rejects empty name update", async () => {
      const db = await setupTestDb();

      const { user } = await register(db, {
        email: "profile-test-2@example.com",
        password: "password12345",
        name: "Initial Name",
      });

      await expect(
        updateUserProfile(db, user.id, { name: "   " })
      ).rejects.toThrowError(AuthenticationError);
    });
  });
});
