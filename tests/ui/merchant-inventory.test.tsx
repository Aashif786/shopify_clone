import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  calculateInventoryKpis,
  calculateSignedDelta,
  formatAdjustmentReason,
  getStockStatus,
  validateStockAdjustmentInput,
  type InventoryVariantItem,
  type StockAdjustmentFormData,
} from "@/lib/merchant-inventory-helpers";
import { InventoryTable } from "@/components/merchant/inventory/inventory-table";
import { StockAdjustmentDialog } from "@/components/merchant/inventory/stock-adjustment-dialog";
import { InventoryHistoryDialog } from "@/components/merchant/inventory/inventory-history-dialog";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import type { InventoryItemDTO, InventoryAdjustmentDTO } from "@shopify-clone/inventory";

const mockVariant1: InventoryVariantItem = {
  variantId: "var_111",
  productId: "prod_1",
  productTitle: "Trailhead Fleece Jacket",
  productSlug: "trailhead-fleece",
  variantTitle: "Navy / Medium",
  sku: "TFJ-NVY-M",
  price: 8900,
  currency: "USD",
  availableQuantity: 42,
  reservedQuantity: 3,
  totalQuantity: 45,
  isInitialized: true,
  inventoryItemId: "inv_item_1",
};

const mockVariant2: InventoryVariantItem = {
  variantId: "var_222",
  productId: "prod_1",
  productTitle: "Trailhead Fleece Jacket",
  productSlug: "trailhead-fleece",
  variantTitle: "Black / Small",
  sku: "TFJ-BLK-S",
  price: 8900,
  currency: "USD",
  availableQuantity: 2,
  reservedQuantity: 0,
  totalQuantity: 2,
  isInitialized: true,
  inventoryItemId: "inv_item_2",
};

const mockVariant3: InventoryVariantItem = {
  variantId: "var_333",
  productId: "prod_2",
  productTitle: "Alpine Climber Carabiner",
  productSlug: "alpine-carabiner",
  variantTitle: "Silver",
  sku: null,
  price: 1500,
  currency: "USD",
  availableQuantity: 0,
  reservedQuantity: 0,
  totalQuantity: 0,
  isInitialized: false,
  inventoryItemId: null,
};

describe("Merchant Inventory: Helpers & Validation", () => {
  describe("validateStockAdjustmentInput", () => {
    it("accepts valid positive restock adjustment", () => {
      const data: StockAdjustmentFormData = {
        direction: "add",
        quantity: "15",
        reason: "RESTOCK",
        referenceType: "po",
        referenceId: "PO-4091",
      };
      const errors = validateStockAdjustmentInput(data, 10);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it("rejects non-integer or zero quantity", () => {
      const dataZero: StockAdjustmentFormData = {
        direction: "add",
        quantity: "0",
        reason: "RESTOCK",
        referenceType: "",
        referenceId: "",
      };
      expect(validateStockAdjustmentInput(dataZero, 10).quantity).toBeDefined();

      const dataNegative: StockAdjustmentFormData = {
        direction: "add",
        quantity: "-5",
        reason: "RESTOCK",
        referenceType: "",
        referenceId: "",
      };
      expect(validateStockAdjustmentInput(dataNegative, 10).quantity).toBeDefined();

      const dataDecimal: StockAdjustmentFormData = {
        direction: "add",
        quantity: "3.5",
        reason: "RESTOCK",
        referenceType: "",
        referenceId: "",
      };
      expect(validateStockAdjustmentInput(dataDecimal, 10).quantity).toBeDefined();
    });

    it("rejects removing more units than available stock", () => {
      const data: StockAdjustmentFormData = {
        direction: "remove",
        quantity: "15",
        reason: "DAMAGED",
        referenceType: "",
        referenceId: "",
      };
      const errors = validateStockAdjustmentInput(data, 10);
      expect(errors.quantity).toContain("Cannot remove 15 units: only 10 units currently available");
    });

    it("allows removing units within available stock", () => {
      const data: StockAdjustmentFormData = {
        direction: "remove",
        quantity: "10",
        reason: "DAMAGED",
        referenceType: "",
        referenceId: "",
      };
      const errors = validateStockAdjustmentInput(data, 10);
      expect(errors.quantity).toBeUndefined();
    });

    it("rejects invalid adjustment reason", () => {
      const data: StockAdjustmentFormData = {
        direction: "add" as const,
        quantity: "5",
        reason: "INVALID_REASON" as unknown as StockAdjustmentFormData["reason"],
        referenceType: "",
        referenceId: "",
      };
      const errors = validateStockAdjustmentInput(data, 10);
      expect(errors.reason).toContain("valid adjustment reason");
    });
  });

  describe("calculateSignedDelta", () => {
    it("returns positive integer for add direction", () => {
      expect(calculateSignedDelta("add", 25)).toBe(25);
    });

    it("returns negative integer for remove direction", () => {
      expect(calculateSignedDelta("remove", 25)).toBe(-25);
    });
  });

  describe("getStockStatus", () => {
    it("identifies out of stock when available <= 0", () => {
      expect(getStockStatus(0)).toBe("out_of_stock");
      expect(getStockStatus(-1)).toBe("out_of_stock");
    });

    it("identifies low stock when available is between 1 and 5", () => {
      expect(getStockStatus(1)).toBe("low_stock");
      expect(getStockStatus(5)).toBe("low_stock");
    });

    it("identifies in stock when available > 5", () => {
      expect(getStockStatus(6)).toBe("in_stock");
      expect(getStockStatus(100)).toBe("in_stock");
    });
  });

  describe("calculateInventoryKpis", () => {
    it("calculates accurate aggregate inventory numbers", () => {
      const kpis = calculateInventoryKpis([mockVariant1, mockVariant2, mockVariant3]);
      expect(kpis.totalVariants).toBe(3);
      expect(kpis.totalAvailable).toBe(44); // 42 + 2 + 0
      expect(kpis.totalReserved).toBe(3); // 3 + 0 + 0
      expect(kpis.outOfStockCount).toBe(1); // mockVariant3
      expect(kpis.lowStockCount).toBe(1); // mockVariant2
    });
  });

  describe("formatAdjustmentReason", () => {
    it("formats known reasons to merchant-friendly descriptions", () => {
      expect(formatAdjustmentReason("RESTOCK")).toContain("Restock");
      expect(formatAdjustmentReason("DAMAGED")).toContain("Damaged");
      expect(formatAdjustmentReason("INITIAL_STOCK")).toContain("Initial Stock");
    });
  });
});

describe("Merchant Inventory UI Components Rendering", () => {
  const dummyFn = vi.fn();

  it("renders InventoryTable with KPI cards, variants, SKUs, and stock quantities", () => {
    const html = renderToStaticMarkup(
      <InventoryTable
        items={[mockVariant1, mockVariant2, mockVariant3]}
        onAdjustStock={dummyFn}
        onViewHistory={dummyFn}
        canManage={true}
      />,
    );

    expect(html).toContain("Tracked Variants");
    expect(html).toContain("Available Units");
    expect(html).toContain("Reserved (Checkouts)");
    expect(html).toContain("Trailhead Fleece Jacket");
    expect(html).toContain("TFJ-NVY-M");
    expect(html).toContain("TFJ-BLK-S");
    expect(html).toContain("Alpine Climber Carabiner");
    expect(html).toContain("In Stock");
    expect(html).toContain("Low Stock");
    expect(html).toContain("Out of Stock");
    expect(html).toContain("Adjust");
    expect(html).toContain("History");
  });

  it("renders StockAdjustmentDialog with stock levels and preview", () => {
    const html = renderToStaticMarkup(
      <StockAdjustmentDialog
        storeId="store_123"
        variantItem={mockVariant1}
        isOpen={true}
        onClose={dummyFn}
        onSuccess={dummyFn}
      />,
    );

    expect(html).toContain("Adjust Inventory Stock");
    expect(html).toContain("Trailhead Fleece Jacket");
    expect(html).toContain("Available");
    expect(html).toContain("Reserved");
    expect(html).toContain("Total On-Hand");
    expect(html).toContain("+ Add Stock");
    expect(html).toContain("− Remove Stock");
    expect(html).toContain("Adjustment Reason");
    expect(html).toContain("Confirm Adjustment");
  });

  it("renders InventoryHistoryDialog with audit history container", () => {
    const html = renderToStaticMarkup(
      <InventoryHistoryDialog
        storeId="store_123"
        variantItem={mockVariant1}
        isOpen={true}
        onClose={dummyFn}
      />,
    );

    expect(html).toContain("Inventory Audit History");
    expect(html).toContain("Trailhead Fleece Jacket");
  });
});

describe("API Client & Inventory Operations Integration", () => {
  const mockApiClient = new ApiClient("http://localhost:3000");

  it("successfully calls GET /api/v1/stores/[storeId]/inventory/[variantId]", async () => {
    const inventoryDto: InventoryItemDTO = {
      id: "inv_101",
      storeId: "store_alpha",
      variantId: mockVariant1.variantId,
      availableQuantity: 42,
      reservedQuantity: 3,
      totalQuantity: 45,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: inventoryDto,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.get<InventoryItemDTO>(
      `/api/v1/stores/store_alpha/inventory/${mockVariant1.variantId}`,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe(`http://localhost:3000/api/v1/stores/store_alpha/inventory/${mockVariant1.variantId}`);
    expect(callInit.method).toBe("GET");
    expect(result.availableQuantity).toBe(42);
    expect(result.reservedQuantity).toBe(3);
    expect(result.totalQuantity).toBe(45);

    vi.unstubAllGlobals();
  });

  it("successfully calls POST /api/v1/stores/[storeId]/inventory/[variantId]/adjust", async () => {
    const adjustmentResponse = {
      item: {
        id: "inv_101",
        storeId: "store_alpha",
        variantId: mockVariant1.variantId,
        availableQuantity: 62,
        reservedQuantity: 3,
        totalQuantity: 65,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-05T00:00:00.000Z",
      },
      adjustment: {
        id: "adj_999",
        storeId: "store_alpha",
        inventoryItemId: "inv_101",
        quantityDelta: 20,
        previousQuantity: 42,
        newQuantity: 62,
        reason: "RESTOCK",
        referenceType: "po",
        referenceId: "PO-8888",
        createdBy: "user_test",
        createdAt: "2026-01-05T00:00:00.000Z",
      },
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: adjustmentResponse,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.post<{
      item: InventoryItemDTO;
      adjustment: InventoryAdjustmentDTO;
    }>(`/api/v1/stores/store_alpha/inventory/${mockVariant1.variantId}/adjust`, {
      quantityDelta: 20,
      reason: "RESTOCK",
      referenceType: "po",
      referenceId: "PO-8888",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe(`http://localhost:3000/api/v1/stores/store_alpha/inventory/${mockVariant1.variantId}/adjust`);
    expect(callInit.method).toBe("POST");
    expect(JSON.parse(callInit.body as string)).toEqual({
      quantityDelta: 20,
      reason: "RESTOCK",
      referenceType: "po",
      referenceId: "PO-8888",
    });
    expect(result.item.availableQuantity).toBe(62);
    expect(result.adjustment.quantityDelta).toBe(20);

    vi.unstubAllGlobals();
  });

  it("handles 400 INSUFFICIENT_STOCK when negative adjustment exceeds stock", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "INSUFFICIENT_STOCK",
          message: "Adjustment of -50 would reduce available quantity (42) below zero",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.post(
        `/api/v1/stores/store_alpha/inventory/${mockVariant1.variantId}/adjust`,
        { quantityDelta: -50, reason: "DAMAGED" },
      );
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe("INSUFFICIENT_STOCK");
      expect(apiErr.message).toContain("below zero");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("handles 403 / 404 unauthorized error when staff lacks permissions or outsider visits", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.get("/api/v1/stores/unauthorized_store/inventory/var_111");
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.isNotFound).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("duplicate submission guard prevents redundant adjustment requests", async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 40));
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: {
            item: { id: "inv_1", availableQuantity: 10 },
            adjustment: { id: "adj_1", quantityDelta: 5 },
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchSpy);

    const p1 = mockApiClient.request(
      `/api/v1/stores/store_alpha/inventory/${mockVariant1.variantId}/adjust`,
      {
        method: "POST",
        deduplicateKey: `adjust-${mockVariant1.variantId}`,
      },
    );
    const p2 = mockApiClient.request(
      `/api/v1/stores/store_alpha/inventory/${mockVariant1.variantId}/adjust`,
      {
        method: "POST",
        deduplicateKey: `adjust-${mockVariant1.variantId}`,
      },
    );

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(callCount).toBe(1);
    expect(r1).toEqual(r2);

    vi.unstubAllGlobals();
  });
});
