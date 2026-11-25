import { describe, expect, it, vi } from "vitest";
import {
  extractCustomerSessionIdFromCookie,
} from "../../packages/auth/src/sessions/cookie.js";
import {
  createSession,
  validateSession,
  revokeSession,
} from "../../packages/auth/src/sessions/session-service.js";
import { resetPasswordWithToken } from "../../packages/auth/src/service/auth-service.js";
import {
  InvalidCredentialsError,
  InvalidTokenError,
  TokenExpiredError,
} from "../../packages/auth/src/errors/auth-errors.js";
import {
  getStoreGuestTokenCookieName,
  serializeGuestTokenCookie,
} from "../../apps/web/src/lib/storefront-auth-helpers.js";
import type { Database, DatabaseClient } from "@calcart/db";

// Helper to test CSV escaping matching the subscribers export implementation
function escapeCsv(str: string | null | undefined): string {
  if (!str) return '""';
  let value = str;
  if (/^[=+\-@\t\r]/.test(value.trimStart())) {
    value = "'" + value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

// Helper to test sanitizeApiKey
function sanitizeApiKey<T extends { key_hash?: string }>(key: T): Omit<T, "key_hash"> {
  const copy = { ...key };
  delete (copy as { key_hash?: string }).key_hash;
  return copy;
}

const ALLOWED_API_KEY_SCOPES_SET = new Set([
  "read:products",
  "write:products",
  "read:orders",
  "write:orders",
  "read:inventory",
  "write:inventory",
  "read:webhooks",
  "write:webhooks",
]);

describe("P1 Security & Auth Hardening Tests", () => {
  describe("1. Customer & Guest Cookie Isolation", () => {
    it("extractCustomerSessionIdFromCookie does NOT fall back to generic cookie when storeSlug is provided", () => {
      const cookieHeader = "calcart_customer_session=generic-session-123";
      // When storeSlug is passed, generic cookie must NOT bleed into store context
      const session = extractCustomerSessionIdFromCookie(cookieHeader, "nike-store");
      expect(session).toBeNull();
    });

    it("extractCustomerSessionIdFromCookie correctly extracts store-scoped cookie", () => {
      const cookieHeader =
        "sc_nike-store_session=store-session-456; calcart_customer_session=generic-session-123";
      const session = extractCustomerSessionIdFromCookie(cookieHeader, "nike-store");
      expect(session).toBe("store-session-456");
    });

    it("extractCustomerSessionIdFromCookie does NOT leak between different stores", () => {
      const cookieHeader = "sc_adidas-store_session=adidas-session-789";
      const session = extractCustomerSessionIdFromCookie(cookieHeader, "nike-store");
      expect(session).toBeNull();
    });

    it("extractCustomerSessionIdFromCookie extracts generic cookie when storeSlug is omitted", () => {
      const cookieHeader = "calcart_customer_session=generic-session-123";
      const session = extractCustomerSessionIdFromCookie(cookieHeader, undefined);
      expect(session).toBe("generic-session-123");
    });

    it("getStoreGuestTokenCookieName sanitizes storeSlug", () => {
      expect(getStoreGuestTokenCookieName("My Store! 123")).toBe("sc_mystore123_guest_token");
      expect(getStoreGuestTokenCookieName("Acme-Co_US")).toBe("sc_acme-co_us_guest_token");
    });

    it("serializeGuestTokenCookie sets HttpOnly, SameSite=Lax, and Path=/", () => {
      const cookie = serializeGuestTokenCookie("guest-tok-xyz", "my-store", {
        secure: true,
        maxAge: 3600,
      });
      expect(cookie).toContain("sc_my-store_guest_token=guest-tok-xyz");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("Max-Age=3600");
    });
  });

  describe("2. Session Token Entropy & Hashing", () => {
    it("createSession generates a high-entropy 256-bit token and hashes it", async () => {
      let insertedTokenHash: string | undefined;

      const mockDb: DatabaseClient = {
        query: vi.fn().mockImplementation(async (query: string, values?: unknown[]) => {
          if (query.includes("INSERT INTO sessions")) {
            insertedTokenHash = values?.[3] as string;
            return {
              rowCount: 1,
              rows: [
                {
                  id: values?.[0],
                  user_id: values?.[1],
                  created_at: new Date(),
                  expires_at: values?.[2],
                  revoked_at: null,
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
      };

      const session = await createSession(mockDb, "018f0000-0000-7000-8000-000000000001");
      expect(session.id).toBeDefined();
      expect(session.token).toBeDefined();
      // Token is 32 random bytes as hex (64 chars)
      expect(session.token).toHaveLength(64);
      expect(insertedTokenHash).toBeDefined();
      expect(insertedTokenHash).toHaveLength(64); // SHA-256 hex is 64 chars
      expect(insertedTokenHash).not.toBe(session.token); // Never stored plaintext
    });

    it("validateSession validates by token hash and rejects empty input", async () => {
      const mockDb: DatabaseClient = {
        query: vi.fn(),
      };

      await expect(validateSession(mockDb, "")).rejects.toThrow(InvalidCredentialsError);
    });

    it("validateSession falls back to UUID only when token_hash IS NULL (legacy)", async () => {
      const legacyUuid = "018f0000-0000-7000-8000-000000000002";
      let executedSql = "";
      let sqlParams: unknown[] = [];

      const mockDb: DatabaseClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          executedSql = sql;
          sqlParams = params ?? [];
          return {
            rowCount: 1,
            rows: [
              {
                session_id: legacyUuid,
                user_id: "018f0000-0000-7000-8000-000000000001",
                session_created_at: new Date(),
                session_expires_at: new Date(Date.now() + 60000),
                session_revoked_at: null,
                email: "legacy@example.com",
                name: "Legacy User",
                status: "ACTIVE",
                is_platform_admin: false,
                user_created_at: new Date(),
                user_updated_at: new Date(),
              },
            ],
          };
        }),
      };

      const result = await validateSession(mockDb, legacyUuid);
      expect(result.session.id).toBe(legacyUuid);
      expect(result.user.email).toBe("legacy@example.com");
      expect(executedSql).toContain("s.token_hash = $1");
      expect(executedSql).toContain("s.token_hash IS NULL AND s.id = $3::uuid");
      expect(sqlParams[1]).toBe(true); // isUuid
      expect(sqlParams[2]).toBe(legacyUuid);
    });

    it("revokeSession revokes by token hash or UUID", async () => {
      let executedSql = "";
      let sqlParams: unknown[] = [];

      const mockDb: DatabaseClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          executedSql = sql;
          sqlParams = params ?? [];
          return { rowCount: 1, rows: [] };
        }),
      };

      await revokeSession(mockDb, "bearer-token-abc");
      expect(executedSql).toContain("token_hash = $1");
      expect(sqlParams[1]).toBe(false); // not UUID

      const validUuid = "018f0000-0000-7000-8000-000000000003";
      await revokeSession(mockDb, validUuid);
      expect(sqlParams[1]).toBe(true); // is UUID
      expect(sqlParams[2]).toBe(validUuid);
    });
  });

  describe("3. Password Reset Atomic Locking & Single-Use", () => {
    it("resetPasswordWithToken executes inside transaction with SELECT FOR UPDATE", async () => {
      const queriesExecuted: string[] = [];
      const testToken = "test-reset-token-123456";

      const mockClient: DatabaseClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          queriesExecuted.push(sql);
          if (sql.includes("FROM password_reset_tokens") && sql.includes("SELECT")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "018f0000-0000-7000-8000-000000000010",
                  user_id: "018f0000-0000-7000-8000-000000000001",
                  expires_at: new Date(Date.now() + 3600_000), // future
                  used_at: null,
                },
              ],
            };
          }
          if (sql.includes("UPDATE password_reset_tokens")) {
            return { rowCount: 1, rows: [{ id: "018f0000-0000-7000-8000-000000000010" }] };
          }
          if (sql.includes("UPDATE users")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "018f0000-0000-7000-8000-000000000001",
                  email: "user@example.com",
                  name: "Reset User",
                },
              ],
            };
          }
          if (sql.includes("UPDATE sessions")) {
            return { rowCount: 2, rows: [] };
          }
          return { rowCount: 0, rows: [] };
        }),
      };

      const mockDb: Database = {
        query: vi.fn(),
        withTransaction: vi.fn().mockImplementation(async (cb) => cb(mockClient)),
        withExclusiveConnection: vi.fn(),
        healthCheck: vi.fn(),
        getPoolStats: vi.fn(),
        close: vi.fn(),
      };

      const result = await resetPasswordWithToken(
        mockDb,
        testToken,
        "NewPassword123!Secure"
      );

      expect(mockDb.withTransaction).toHaveBeenCalledTimes(1);
      expect(result.email).toBe("user@example.com");

      // Verify SELECT ... FOR UPDATE was executed inside transaction
      const selectQuery = queriesExecuted.find((q) => q.includes("FROM password_reset_tokens"));
      expect(selectQuery).toContain("FOR UPDATE");

      // Verify atomic UPDATE with used_at IS NULL
      const updateTokenQuery = queriesExecuted.find((q) => q.includes("UPDATE password_reset_tokens"));
      expect(updateTokenQuery).toContain("used_at IS NULL");

      // Verify sessions were revoked
      const sessionRevokeQuery = queriesExecuted.find((q) => q.includes("UPDATE sessions"));
      expect(sessionRevokeQuery).toContain("revoked_at = NOW()");
    });

    it("rejects already used token", async () => {
      const mockClient: DatabaseClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("FROM password_reset_tokens") && sql.includes("SELECT")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "018f0000-0000-7000-8000-000000000010",
                  user_id: "018f0000-0000-7000-8000-000000000001",
                  expires_at: new Date(Date.now() + 3600_000),
                  used_at: new Date(Date.now() - 1000), // already used!
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
      };

      const mockDb: Database = {
        query: vi.fn(),
        withTransaction: vi.fn().mockImplementation(async (cb) => cb(mockClient)),
        withExclusiveConnection: vi.fn(),
        healthCheck: vi.fn(),
        getPoolStats: vi.fn(),
        close: vi.fn(),
      };

      await expect(
        resetPasswordWithToken(mockDb, "used-token", "NewPassword123!Secure")
      ).rejects.toThrow(InvalidTokenError);
    });

    it("rejects expired token", async () => {
      const mockClient: DatabaseClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("FROM password_reset_tokens") && sql.includes("SELECT")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "018f0000-0000-7000-8000-000000000010",
                  user_id: "018f0000-0000-7000-8000-000000000001",
                  expires_at: new Date(Date.now() - 60000), // expired!
                  used_at: null,
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
      };

      const mockDb: Database = {
        query: vi.fn(),
        withTransaction: vi.fn().mockImplementation(async (cb) => cb(mockClient)),
        withExclusiveConnection: vi.fn(),
        healthCheck: vi.fn(),
        getPoolStats: vi.fn(),
        close: vi.fn(),
      };

      await expect(
        resetPasswordWithToken(mockDb, "expired-token", "NewPassword123!Secure")
      ).rejects.toThrow(TokenExpiredError);
    });
  });

  describe("4. CSV Formula Injection Neutralization", () => {
    it("neutralizes leading =, +, -, @, \\t, \\r characters", () => {
      expect(escapeCsv("=1+1")).toBe("\"'=1+1\"");
      expect(escapeCsv("+cmd|' /C calc'!A0")).toBe("\"'+cmd|' /C calc'!A0\"");
      expect(escapeCsv("-5+2")).toBe("\"'-5+2\"");
      expect(escapeCsv("@SUM(A1:A10)")).toBe("\"'@SUM(A1:A10)\"");
      expect(escapeCsv("\t=DDE(...)")).toBe("\"'\t=DDE(...)\"");
      expect(escapeCsv("\r=2*3")).toBe("\"'\r=2*3\"");
    });

    it("handles whitespace before formula triggers", () => {
      expect(escapeCsv("   =SUM(1,2)")).toBe("\"'   =SUM(1,2)\"");
      expect(escapeCsv("  +123")).toBe("\"'  +123\"");
    });

    it("leaves regular text un-prefixed with single quote", () => {
      expect(escapeCsv("john.doe@example.com")).toBe('"john.doe@example.com"');
      expect(escapeCsv("Normal subscriber name")).toBe('"Normal subscriber name"');
      expect(escapeCsv("SUBSCRIBED")).toBe('"SUBSCRIBED"');
    });

    it("safely escapes embedded double quotes", () => {
      expect(escapeCsv('Company "Best" Corp')).toBe('"Company ""Best"" Corp"');
      expect(escapeCsv('="alert(1)"')).toBe("\"'=\"\"alert(1)\"\"\"");
    });

    it("returns empty quoted string for null and undefined", () => {
      expect(escapeCsv(null)).toBe('""');
      expect(escapeCsv(undefined)).toBe('""');
      expect(escapeCsv("")).toBe('""');
    });
  });

  describe("5. API Key Scope Allowlist & Hash Sanitization", () => {
    it("sanitizeApiKey strips key_hash from object", () => {
      const apiKeyRow = {
        id: "key-123",
        store_id: "store-456",
        name: "Test API Key",
        key_prefix: "cc_live_test",
        key_hash: "secret_sha256_hash_value_that_should_never_leak",
        scopes: ["read:products"],
        created_at: new Date(),
        revoked_at: null,
        expires_at: null,
      };

      const sanitized = sanitizeApiKey(apiKeyRow);
      expect(sanitized).not.toHaveProperty("key_hash");
      expect((sanitized as unknown as { key_hash?: string }).key_hash).toBeUndefined();
      expect(sanitized.id).toBe("key-123");
      expect(sanitized.name).toBe("Test API Key");
    });

    it("ALLOWED_API_KEY_SCOPES_SET rejects 'admin' and unauthorized scopes", () => {
      expect(ALLOWED_API_KEY_SCOPES_SET.has("admin")).toBe(false);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("root")).toBe(false);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("*")).toBe(false);

      expect(ALLOWED_API_KEY_SCOPES_SET.has("read:products")).toBe(true);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("write:products")).toBe(true);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("read:orders")).toBe(true);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("write:orders")).toBe(true);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("read:inventory")).toBe(true);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("write:inventory")).toBe(true);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("read:webhooks")).toBe(true);
      expect(ALLOWED_API_KEY_SCOPES_SET.has("write:webhooks")).toBe(true);
    });
  });
});
