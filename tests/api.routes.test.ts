import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@shopify-clone/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import { GET as getHealth } from "../apps/web/app/api/v1/health/route.js";
import { GET as getOpenApi } from "../apps/web/app/api/v1/openapi/route.js";
import { POST as registerUser } from "../apps/web/app/api/v1/auth/register/route.js";
import { POST as loginUser } from "../apps/web/app/api/v1/auth/login/route.js";
import { POST as logoutUser } from "../apps/web/app/api/v1/auth/logout/route.js";
import { GET as getMe } from "../apps/web/app/api/v1/auth/me/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("API v1 Baseline Routes", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    global.__shopify_clone_web_db = isolated.database;
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  describe("GET /api/v1/health", () => {
    it("returns 200 with healthy database status and x-request-id", async () => {
      const req = new Request("http://localhost:3000/api/v1/health", {
        headers: { "x-request-id": "health-check-001" },
      });

      const res = await getHealth(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-request-id")).toBe("health-check-001");

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("healthy");
      expect(body.data.database).toBe("healthy");
      expect(body.data.timestamp).toBeDefined();
    });
  });

  describe("GET /api/v1/openapi", () => {
    it("returns 200 with OpenAPI 3.1 specification document", async () => {
      const req = new Request("http://localhost:3000/api/v1/openapi");
      const res = await getOpenApi(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.openapi).toBe("3.1.0");
      expect(body.data.paths["/health"]).toBeDefined();
      expect(body.data.paths["/auth/register"]).toBeDefined();
      expect(body.data.paths["/auth/login"]).toBeDefined();
      expect(body.data.components.securitySchemes.cookieAuth).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/register", () => {
    it("rejects invalid request body with 400 VALIDATION_ERROR", async () => {
      const req = new Request("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid-email", password: "short", name: "" }),
      });

      const res = await registerUser(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.fields).toBeDefined();
    });

    it("registers new user, sets session cookie, and returns safe user DTO (no secrets)", async () => {
      const req = new Request("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "merchant@store.com",
          password: "secure-store-password-123",
          name: "Merchant Alice",
        }),
      });

      const res = await registerUser(req);
      expect(res.status).toBe(201);

      const setCookie = res.headers.get("Set-Cookie");
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain("shopify_clone_session=");
      expect(setCookie).toContain("HttpOnly");

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.id).toBeDefined();
      expect(body.data.user.email).toBe("merchant@store.com");
      expect(body.data.user.name).toBe("Merchant Alice");
      expect(body.data.user.status).toBe("ACTIVE");
      expect(body.data.user.password_hash).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("password_hash");
    });

    it("rejects duplicate email registration with 409 USER_ALREADY_EXISTS", async () => {
      const firstReq = new Request("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "secure-password-123",
          name: "User One",
        }),
      });
      await registerUser(firstReq);

      const secondReq = new Request("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "another-secure-password-456",
          name: "User Two",
        }),
      });
      const res = await registerUser(secondReq);
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("USER_ALREADY_EXISTS");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      const regReq = new Request("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "login-test@example.com",
          password: "correct-password-123",
          name: "Test Login User",
        }),
      });
      await registerUser(regReq);
    });

    it("rejects incorrect password with 401 INVALID_CREDENTIALS", async () => {
      const req = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "login-test@example.com",
          password: "wrong-password",
        }),
      });

      const res = await loginUser(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects non-existent email with generic 401 to prevent user enumeration", async () => {
      const req = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "some-password",
        }),
      });

      const res = await loginUser(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("authenticates valid credentials, sets session cookie, and returns user DTO", async () => {
      const req = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "login-test@example.com",
          password: "correct-password-123",
        }),
      });

      const res = await loginUser(req);
      expect(res.status).toBe(200);

      const setCookie = res.headers.get("Set-Cookie");
      expect(setCookie).toContain("shopify_clone_session=");

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe("login-test@example.com");
      expect(body.data.user.name).toBe("Test Login User");
    });
  });

  describe("GET /api/v1/auth/me and POST /api/v1/auth/logout", () => {
    it("rejects unauthenticated request to /auth/me with 401 AUTHENTICATION_REQUIRED", async () => {
      const req = new Request("http://localhost:3000/api/v1/auth/me");
      const res = await getMe(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("returns user profile with valid session cookie", async () => {
      const regReq = new Request("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "me-test@example.com",
          password: "password-for-me-test",
          name: "Session Profile User",
        }),
      });
      const regRes = await registerUser(regReq);
      const cookieHeader = regRes.headers.get("Set-Cookie")!.split(";")[0]!;

      const meReq = new Request("http://localhost:3000/api/v1/auth/me", {
        headers: { Cookie: cookieHeader },
      });
      const meRes = await getMe(meReq);

      expect(meRes.status).toBe(200);
      const body = await meRes.json();
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe("me-test@example.com");
      expect(body.data.user.name).toBe("Session Profile User");
    });

    it("logs out authenticated user, clears cookie, and prevents subsequent access", async () => {
      const regReq = new Request("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "logout-user@example.com",
          password: "password-for-logout",
          name: "Logout User",
        }),
      });
      const regRes = await registerUser(regReq);
      const cookieHeader = regRes.headers.get("Set-Cookie")!.split(";")[0]!;

      // Logout
      const logoutReq = new Request("http://localhost:3000/api/v1/auth/logout", {
        method: "POST",
        headers: { Cookie: cookieHeader },
      });
      const logoutRes = await logoutUser(logoutReq);
      expect(logoutRes.status).toBe(200);

      const expiredCookie = logoutRes.headers.get("Set-Cookie");
      expect(expiredCookie).toContain("Max-Age=0");

      // Verify session is now rejected
      const meReq = new Request("http://localhost:3000/api/v1/auth/me", {
        headers: { Cookie: cookieHeader },
      });
      const meRes = await getMe(meReq);
      expect(meRes.status).toBe(401);
      const meBody = await meRes.json();
      expect(meBody.error.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });
});
