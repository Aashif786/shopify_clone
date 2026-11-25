import { describe, it, expect, vi } from "vitest";
import type { Database } from "@calcart/db";
import { isOrderCodPayment } from "../../apps/web/src/lib/order-payment-helpers.js";
import { clampIntParam } from "../../apps/web/src/lib/api/pagination.js";
import { parseIntParam } from "../../apps/platform-admin/src/lib/query-params.js";
import { parsePositiveInt } from "../../packages/config/src/index.js";
import { renderAbandonedCartRecoveryEmail } from "../../packages/email/src/templates/abandoned-cart-recovery.js";

describe("P2 Validation, Pagination, and Configuration Tests", () => {
  describe("isOrderCodPayment case-insensitivity", () => {
    it("handles lowercase 'cod', mixed case 'cOd', and trailing spaces", async () => {
      const mockDb1 = {
        query: vi.fn().mockResolvedValueOnce({ rows: [{ provider: "cod" }] }),
      } as unknown as Database;
      expect(await isOrderCodPayment(mockDb1, "s1", "o1")).toBe(true);

      const mockDb2 = {
        query: vi.fn().mockResolvedValueOnce({ rows: [{ provider: "  cOd  " }] }),
      } as unknown as Database;
      expect(await isOrderCodPayment(mockDb2, "s1", "o1")).toBe(true);

      const mockDb3 = {
        query: vi.fn().mockResolvedValueOnce({ rows: [{ provider: "razorpay" }] }).mockResolvedValueOnce({ rows: [] }),
      } as unknown as Database;
      expect(await isOrderCodPayment(mockDb3, "s1", "o1")).toBe(false);
    });
  });

  describe("clampIntParam (apps/web)", () => {
    it("safely handles null, undefined, empty, NaN, and clamps within range", () => {
      expect(clampIntParam(null, 25, 1, 100)).toBe(25);
      expect(clampIntParam(undefined, 25, 1, 100)).toBe(25);
      expect(clampIntParam("", 25, 1, 100)).toBe(25);
      expect(clampIntParam("invalid", 25, 1, 100)).toBe(25);
      expect(clampIntParam("-5", 25, 1, 100)).toBe(1);
      expect(clampIntParam("500", 25, 1, 100)).toBe(100);
      expect(clampIntParam("42", 25, 1, 100)).toBe(42);
    });
  });

  describe("parseIntParam (apps/platform-admin)", () => {
    it("safely handles null, undefined, empty, NaN, and clamps within range", () => {
      expect(parseIntParam(null, 50, 1, 100)).toBe(50);
      expect(parseIntParam("abc", 50, 1, 100)).toBe(50);
      expect(parseIntParam("0", 50, 1, 100)).toBe(1);
      expect(parseIntParam("200", 50, 1, 100)).toBe(100);
      expect(parseIntParam("75", 50, 1, 100)).toBe(75);
    });
  });

  describe("parsePositiveInt (packages/config)", () => {
    it("falls back safely on non-numeric or non-positive values", () => {
      expect(parsePositiveInt(undefined, 3000)).toBe(3000);
      expect(parsePositiveInt("", 3000)).toBe(3000);
      expect(parsePositiveInt("invalid", 3000)).toBe(3000);
      expect(parsePositiveInt("0", 3000)).toBe(3000);
      expect(parsePositiveInt("-100", 3000)).toBe(3000);
      expect(parsePositiveInt("8080", 3000)).toBe(8080);
    });
  });

  describe("renderAbandonedCartRecoveryEmail", () => {
    it("generates an absolute recoveryUrl and avoids duplicate CTA buttons in contentHtml", () => {
      process.env.APP_URL = "https://calcart.com";
      const email = renderAbandonedCartRecoveryEmail({
        to: "customer@example.com",
        storeName: "Artisan Store",
        storeSlug: "artisan-store",
        cartId: "cart-123",
        currency: "USD",
        grandTotal: 5000,
      });

      // recoveryUrl in email layout must be absolute
      expect(email.html).toContain("https://calcart.com/stores/artisan-store/cart");
      expect(email.text).toContain("https://calcart.com/stores/artisan-store/cart");

      // contentHtml should not have the extra duplicate inline complete purchase button
      const buttonMatches = (email.html.match(/Complete Your Purchase/g) || []).length;
      expect(buttonMatches).toBe(1);
    });
  });
});
