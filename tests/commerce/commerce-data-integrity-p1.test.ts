import { describe, it, expect, vi } from "vitest";
import {
  evaluateDiscountCode,
  buildDiscountEvaluationItems,
  type StoreDiscountDefinition,
} from "../../apps/web/src/lib/storefront-discount-helpers.js";
import { isOrderCodPayment } from "../../apps/web/src/lib/order-payment-helpers.js";
import { WebhookRepository } from "../../packages/db/src/repositories/webhook-repository.js";

describe("P1 Commerce and Data Integrity Fixes", () => {
  describe("isOrderCodPayment", () => {
    it("returns true when order payment provider is COD (case-insensitive)", async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [{ provider: "COD" }],
        }),
      } as any;

      const result = await isOrderCodPayment(mockDb, "store-1", "order-1", null);
      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT provider FROM payments"),
        ["store-1", "order-1", null],
      );
    });

    it("returns false when order payment provider is razorpay or online", async () => {
      const mockDb = {
        query: vi
          .fn()
          .mockResolvedValueOnce({
            rows: [{ provider: "razorpay" }],
          })
          .mockResolvedValueOnce({
            rows: [{ provider: "razorpay" }],
          }),
      } as any;

      const result = await isOrderCodPayment(mockDb, "store-1", "order-1", null);
      expect(result).toBe(false);
    });

    it("returns false when no payment record exists", async () => {
      const mockDb = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      } as any;

      const result = await isOrderCodPayment(mockDb, "store-1", "order-1", null);
      expect(result).toBe(false);
    });
  });

  describe("Discount Evaluation with Collections", () => {
    const baseDiscount: StoreDiscountDefinition = {
      id: "disc-1",
      storeId: "store-1",
      name: "10% Off Summer Collection",
      code: "SUMMER10",
      type: "PERCENTAGE",
      value: 10,
      status: "ACTIVE",
      usageCount: 0,
      eligibleCollectionIds: ["col-summer"],
    };

    it("applies discount when item belongs to eligibleCollectionIds", () => {
      const result = evaluateDiscountCode(baseDiscount, {
        targetStoreId: "store-1",
        subtotal: 10000,
        currency: "USD",
        items: [
          {
            productId: "prod-1",
            collectionIds: ["col-summer"],
            price: 10000,
            quantity: 1,
          },
        ],
      });

      expect(result.isValid).toBe(true);
      expect(result.discount?.amount).toBe(1000);
    });

    it("rejects discount with NO_ELIGIBLE_PRODUCTS when item belongs to different collection", () => {
      const result = evaluateDiscountCode(baseDiscount, {
        targetStoreId: "store-1",
        subtotal: 10000,
        currency: "USD",
        items: [
          {
            productId: "prod-1",
            collectionIds: ["col-winter"],
            price: 10000,
            quantity: 1,
          },
        ],
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("NO_ELIGIBLE_PRODUCTS");
    });
  });

  describe("buildDiscountEvaluationItems", () => {
    it("queries product_variants, tags, and collection_products to populate collectionIds", async () => {
      const mockDb = {
        query: vi
          .fn()
          // 1. product_variants query
          .mockResolvedValueOnce({
            rows: [
              {
                variant_id: "var-1",
                product_id: "prod-1",
                type_id: "type-a",
                category_id: "cat-a",
              },
            ],
          })
          // 2. product_tag_assignments query
          .mockResolvedValueOnce({
            rows: [{ product_id: "prod-1", tag_id: "tag-summer" }],
          })
          // 3. collection_products query
          .mockResolvedValueOnce({
            rows: [{ product_id: "prod-1", collection_id: "col-summer" }],
          }),
      } as any;

      const items = await buildDiscountEvaluationItems(mockDb, "store-1", [
        { variantId: "var-1", unitPrice: 2500, quantity: 2 },
      ]);

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        productId: "prod-1",
        typeId: "type-a",
        categoryId: "cat-a",
        collectionIds: ["col-summer"],
        tagIds: ["tag-summer"],
        price: 2500,
        quantity: 2,
      });
    });
  });

  describe("WebhookRepository Enqueue Idempotency", () => {
    it("returns existing delivery record when already enqueued", async () => {
      const repo = new WebhookRepository();
      const existingRow = {
        id: "del-1",
        store_id: "store-1",
        subscription_id: "sub-1",
        event_id: "evt-1",
        status: "PENDING",
      };

      const mockDb = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [existingRow],
        }),
      } as any;

      const result = await repo.enqueueDelivery(mockDb, {
        storeId: "store-1",
        subscriptionId: "sub-1",
        eventId: "evt-1",
        eventType: "order.created",
        payload: { test: true },
      });

      expect(result).toBe(existingRow);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});
