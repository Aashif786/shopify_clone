import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServerConfig, getPublicConfig, getDatabaseConfig } from "@shopify-clone/config";
import type { ApiResponse } from "@shopify-clone/types";

describe("Repository Foundation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads server configuration with defaults when required variables are present", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/shopify_test";
    process.env.AUTH_SECRET = "test-secret-value-12345";

    const config = getServerConfig();
    expect(config.app.env).toBeDefined();
    expect(config.app.port).toBe(3000);
    expect(config.app.appUrl).toBe("http://localhost:3000");
    expect(config.database.url).toBe("postgres://localhost:5432/shopify_test");
    expect(config.auth.secret).toBe("test-secret-value-12345");
  });

  it("fails fast when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    process.env.AUTH_SECRET = "test-secret-value-12345";

    expect(() => getServerConfig()).toThrowError(/DATABASE_URL/);
  });

  it("fails fast when AUTH_SECRET is missing", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/shopify_test";
    delete process.env.AUTH_SECRET;

    expect(() => getServerConfig()).toThrowError(/AUTH_SECRET/);
  });

  it("fails fast when required variables are empty strings", () => {
    process.env.DATABASE_URL = "   ";
    process.env.AUTH_SECRET = "";

    expect(() => getServerConfig()).toThrowError(
      "Missing required server configuration: DATABASE_URL, AUTH_SECRET"
    );
  });

  it("does not expose secret values in validation error messages", () => {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;

    try {
      getServerConfig();
      expect.unreachable("Should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toBe(
        "Missing required server configuration: DATABASE_URL, AUTH_SECRET"
      );
      expect(message).not.toContain("password");
      expect(message).not.toContain("secret");
    }
  });

  it("loads database configuration independently of AUTH_SECRET", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/shopify_test";
    delete process.env.AUTH_SECRET;

    expect(getDatabaseConfig()).toEqual({
      url: "postgres://localhost:5432/shopify_test",
    });
  });

  it("loads public configuration", () => {
    const config = getPublicConfig();
    expect(config.appUrl).toBe("http://localhost:3000");
  });

  it("resolves types package correctly", () => {
    const successResponse: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "ok" },
    };
    expect(successResponse.success).toBe(true);
  });
});

