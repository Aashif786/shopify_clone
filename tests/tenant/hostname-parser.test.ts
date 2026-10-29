import { describe, it, expect } from "vitest";
import {
  parseHostname,
  normalizeHostname,
  RESERVED_SUBDOMAINS,
} from "@shopify-clone/tenant";

describe("Hostname Parser", () => {
  describe("normalizeHostname", () => {
    it("strips port from hostname", () => {
      expect(normalizeHostname("souled-store.calcart.com:3000")).toBe("souled-store.calcart.com");
      expect(normalizeHostname("localhost:3000")).toBe("localhost");
    });

    it("lowercases and trims whitespace", () => {
      expect(normalizeHostname("  Souled-Store.CalCart.COM  ")).toBe("souled-store.calcart.com");
    });

    it("strips trailing dot if present", () => {
      expect(normalizeHostname("souled-store.calcart.com.")).toBe("souled-store.calcart.com");
    });

    it("handles protocol if mistakenly present", () => {
      expect(normalizeHostname("https://souled-store.calcart.com")).toBe("souled-store.calcart.com");
    });

    it("handles empty or null values safely", () => {
      expect(normalizeHostname("")).toBe("");
      expect(normalizeHostname(null)).toBe("");
      expect(normalizeHostname(undefined)).toBe("");
    });
  });

  describe("parseHostname", () => {
    it("identifies apex platform domain", () => {
      const parsed = parseHostname("calcart.com", "calcart.com");
      expect(parsed.isPlatform).toBe(true);
      expect(parsed.isReserved).toBe(false);
      expect(parsed.subdomain).toBeNull();
      expect(parsed.customDomain).toBeNull();
    });

    it("identifies localhost apex domain", () => {
      const parsed = parseHostname("localhost:3000", "calcart.com");
      expect(parsed.isPlatform).toBe(true);
      expect(parsed.subdomain).toBeNull();
    });

    it("extracts merchant subdomain on production platform domain", () => {
      const parsed = parseHostname("souled-store.calcart.com", "calcart.com");
      expect(parsed.isPlatform).toBe(false);
      expect(parsed.isReserved).toBe(false);
      expect(parsed.subdomain).toBe("souled-store");
      expect(parsed.customDomain).toBeNull();
    });

    it("extracts merchant subdomain on localhost in development", () => {
      const parsed = parseHostname("souled-store.localhost:3000", "calcart.com");
      expect(parsed.isPlatform).toBe(false);
      expect(parsed.isReserved).toBe(false);
      expect(parsed.subdomain).toBe("souled-store");
      expect(parsed.customDomain).toBeNull();
    });

    it("flags reserved platform subdomains", () => {
      for (const reserved of ["www", "admin", "app", "api", "checkout", "platform", "mail"]) {
        const parsed = parseHostname(`${reserved}.calcart.com`, "calcart.com");
        expect(parsed.isReserved).toBe(true);
        expect(parsed.subdomain).toBeNull();
      }
    });

    it("flags reserved subdomains on localhost", () => {
      const parsed = parseHostname("api.localhost:3000", "calcart.com");
      expect(parsed.isReserved).toBe(true);
      expect(parsed.subdomain).toBeNull();
    });

    it("identifies external custom domains", () => {
      const parsed = parseHostname("shop.example.com", "calcart.com");
      expect(parsed.isPlatform).toBe(false);
      expect(parsed.isReserved).toBe(false);
      expect(parsed.subdomain).toBeNull();
      expect(parsed.customDomain).toBe("shop.example.com");
    });

    it("rejects invalid subdomain characters safely", () => {
      const parsed = parseHostname("invalid_subdomain!.calcart.com", "calcart.com");
      expect(parsed.subdomain).toBeNull();
    });

    it("supports configurable platform base domains", () => {
      const parsed = parseHostname("store-a.staging.calcart.io", "staging.calcart.io");
      expect(parsed.subdomain).toBe("store-a");
      expect(parsed.isPlatform).toBe(false);
    });
  });
});
