import { describe, expect, it } from "vitest";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  isValidEmailFormat,
  normalizeEmail,
  validatePasswordPolicy,
  verifyPassword,
} from "@shopify-clone/auth";

describe("Password and credential handling", () => {
  it("hashes password with scrypt and a cryptographic salt", async () => {
    const password = "super-secret-password-123";
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(hash).not.toContain(password);
  });

  it("produces unique hashes for identical passwords due to salting", async () => {
    const password = "same-password-different-salt";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it("verifies correct password successfully", async () => {
    const password = "correct-horse-battery-staple";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("rejects incorrect password safely without throwing", async () => {
    const hash = await hashPassword("real-password-123");

    const isValid = await verifyPassword("wrong-password-456", hash);
    expect(isValid).toBe(false);
  });

  it("rejects malformed hashes safely", async () => {
    expect(await verifyPassword("test", "")).toBe(false);
    expect(await verifyPassword("test", "plaintext")).toBe(false);
    expect(await verifyPassword("test", "bcrypt:short:hash")).toBe(false);
    expect(await verifyPassword("test", "scrypt:invalidhex:invalidhex")).toBe(false);
  });

  it("verifies against dummy hash safely without error", async () => {
    const result = await verifyPassword("any-attempt", DUMMY_PASSWORD_HASH);
    expect(result).toBe(false);
  });

  it("normalizes email addresses consistently", () => {
    expect(normalizeEmail("  Merchant@Example.COM  ")).toBe("merchant@example.com");
    expect(normalizeEmail("USER.TEST@DOMAIN.ORG")).toBe("user.test@domain.org");
  });

  it("validates email formats", () => {
    expect(isValidEmailFormat("valid@example.com")).toBe(true);
    expect(isValidEmailFormat("merchant+test@store.co")).toBe(true);
    expect(isValidEmailFormat("invalid-email")).toBe(false);
    expect(isValidEmailFormat("@missing-user.com")).toBe(false);
    expect(isValidEmailFormat("missing-domain@")).toBe(false);
  });

  it("enforces password policy", () => {
    expect(validatePasswordPolicy("short").valid).toBe(false);
    expect(validatePasswordPolicy("").valid).toBe(false);
    expect(validatePasswordPolicy("1234567").valid).toBe(false);
    expect(validatePasswordPolicy("12345678").valid).toBe(true);
    expect(validatePasswordPolicy("a".repeat(128)).valid).toBe(true);
    expect(validatePasswordPolicy("a".repeat(129)).valid).toBe(false);
  });
});
