import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiscountStatusBadge } from "@/components/merchant/discounts/discount-status-badge";
import { DiscountList } from "@/components/merchant/discounts/discount-list";
import { DiscountActions } from "@/components/merchant/discounts/discount-actions";
import { DiscountForm } from "@/components/merchant/discounts/discount-form";
import {
  formatDiscountSpend,
  formatDiscountUsage,
  formatDiscountValidity,
  formatDiscountValue,
  normalizeDiscountCode,
  validateDiscountFormData,
  formDataToPayload,
  discountToFormData,
  type MerchantDiscountDTO,
  type DiscountFormData,
} from "@/lib/merchant-discount-helpers";
import { ApiClient } from "@/lib/api-client";

describe("Merchant Discounts UI: Formatting & Conversion Helpers", () => {
  it("normalizes discount code properly (uppercase and trimmed)", () => {
    expect(normalizeDiscountCode("  summer2026 ")).toBe("SUMMER2026");
    expect(normalizeDiscountCode("vip-10")).toBe("VIP-10");
    expect(normalizeDiscountCode("")).toBe("");
    expect(normalizeDiscountCode(null)).toBe("");
  });

  it("formats discount values accurately for percentage and fixed amount", () => {
    expect(formatDiscountValue("PERCENTAGE", 15)).toBe("15% off");
    expect(formatDiscountValue("FIXED_AMOUNT", 2000, "USD")).toBe("$20.00 off");
    expect(formatDiscountValue("FIXED_AMOUNT", 1550, "EUR")).toBe("15.50 EUR off");
  });

  it("formats minimum spend thresholds accurately", () => {
    expect(formatDiscountSpend(0)).toBe("No minimum");
    expect(formatDiscountSpend(null)).toBe("No minimum");
    expect(formatDiscountSpend(5000, "USD")).toBe("Min spend $50.00");
  });

  it("formats usage counts and limits accurately", () => {
    expect(formatDiscountUsage(5, 100)).toBe("5 / 100 used");
    expect(formatDiscountUsage(12, null)).toBe("12 used (Unlimited)");
    expect(formatDiscountUsage(0, 0)).toBe("0 used (Unlimited)");
  });

  it("formats validity dates properly", () => {
    expect(formatDiscountValidity(null, null)).toBe("Always active");
    expect(formatDiscountValidity("2026-06-01T00:00:00.000Z", null)).toContain("From");
    expect(formatDiscountValidity(null, "2026-12-31T23:59:59.000Z")).toContain("Until");
    expect(
      formatDiscountValidity("2026-06-01T00:00:00.000Z", "2026-12-31T23:59:59.000Z")
    ).toContain("–");
  });

  it("validates form data client-side and flags invalid fields", () => {
    // Missing code and name
    const invalidData: DiscountFormData = {
      code: "",
      name: "",
      description: "",
      type: "PERCENTAGE",
      value: "",
      currency: "USD",
      status: "ACTIVE",
      minimumSubtotal: "",
      maxDiscountAmount: "",
      usageLimit: "",
      startsAt: "",
      endsAt: "",
    };
    const errors = validateDiscountFormData(invalidData);
    expect(errors.code).toBeDefined();
    expect(errors.name).toBeDefined();
    expect(errors.value).toBeDefined();

    // Invalid percentage (> 100)
    const invalidPercent: DiscountFormData = {
      ...invalidData,
      code: "SUMMER",
      name: "Summer Sale",
      value: "150",
    };
    const percentErrors = validateDiscountFormData(invalidPercent);
    expect(percentErrors.value).toContain("between 1 and 100");

    // Invalid date range (end before start)
    const invalidDates: DiscountFormData = {
      ...invalidData,
      code: "SALE",
      name: "Sale",
      value: "10",
      startsAt: "2026-12-01",
      endsAt: "2026-11-01",
    };
    const dateErrors = validateDiscountFormData(invalidDates);
    expect(dateErrors.endsAt).toContain("after start date");
  });

  it("converts form data to monetary integer minor units (cents)", () => {
    const fixedData: DiscountFormData = {
      code: "SAVE20",
      name: "$20 Off Order",
      description: "Promo description",
      type: "FIXED_AMOUNT",
      value: "20.00",
      currency: "USD",
      status: "ACTIVE",
      minimumSubtotal: "50.00",
      maxDiscountAmount: "",
      usageLimit: "50",
      startsAt: "2026-06-01",
      endsAt: "2026-06-30",
    };

    const payload = formDataToPayload(fixedData);
    expect(payload.code).toBe("SAVE20");
    expect(payload.value).toBe(2000); // 2000 cents
    expect(payload.minimumSubtotal).toBe(5000); // 5000 cents
    expect(payload.usageLimit).toBe(50);
    expect(payload.currency).toBe("USD");
  });

  it("converts discount DTO to form data strings accurately", () => {
    const dto: MerchantDiscountDTO = {
      id: "disc_123",
      storeId: "store_abc",
      code: "SAVE15",
      name: "$15 Off",
      description: "Note",
      type: "FIXED_AMOUNT",
      value: 1500, // 1500 cents
      currency: "USD",
      status: "ACTIVE",
      minimumSubtotal: 4500, // 4500 cents
      maxDiscountAmount: null,
      usageLimit: 25,
      usageCount: 5,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-12-31T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const formData = discountToFormData(dto);
    expect(formData.code).toBe("SAVE15");
    expect(formData.value).toBe("15.00");
    expect(formData.minimumSubtotal).toBe("45.00");
    expect(formData.usageLimit).toBe("25");
  });
});

describe("Merchant Discounts UI: Status Badge Component", () => {
  it("renders status badges correctly for ACTIVE, DISABLED, EXPIRED, and DRAFT", () => {
    const active = renderToStaticMarkup(<DiscountStatusBadge status="ACTIVE" />);
    expect(active).toContain("Active");
    expect(active).toContain('badge--success');

    const disabled = renderToStaticMarkup(<DiscountStatusBadge status="DISABLED" />);
    expect(disabled).toContain("Disabled");
    expect(disabled).toContain('badge--warning');

    const expired = renderToStaticMarkup(<DiscountStatusBadge status="EXPIRED" />);
    expect(expired).toContain("Expired");
    expect(expired).toContain('badge--danger');

    const draft = renderToStaticMarkup(<DiscountStatusBadge status="DRAFT" />);
    expect(draft).toContain("Draft");
    expect(draft).toContain('badge--neutral');
  });
});

describe("Merchant Discounts UI: DiscountList Component", () => {
  const mockDiscounts: MerchantDiscountDTO[] = [
    {
      id: "disc_1",
      storeId: "store_123",
      code: "WELCOME10",
      name: "Welcome 10% Off",
      description: "Storefront welcome",
      type: "PERCENTAGE",
      value: 10,
      currency: null,
      status: "ACTIVE",
      minimumSubtotal: 2000,
      maxDiscountAmount: 5000,
      usageLimit: 100,
      usageCount: 15,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "disc_2",
      storeId: "store_123",
      code: "SAVE20",
      name: "$20 Off Order",
      description: null,
      type: "FIXED_AMOUNT",
      value: 2000,
      currency: "USD",
      status: "DISABLED",
      minimumSubtotal: 5000,
      maxDiscountAmount: null,
      usageLimit: null,
      usageCount: 0,
      startsAt: null,
      endsAt: null,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  it("renders loading state with spinner when initial loading", () => {
    const html = renderToStaticMarkup(
      <DiscountList discounts={[]} storeId="store_123" isLoading={true} />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading discounts...");
  });

  it("renders empty state with call to action when no discounts exist", () => {
    const html = renderToStaticMarkup(
      <DiscountList
        discounts={[]}
        storeId="store_123"
        isLoading={false}
        onCreateDiscount={() => {}}
      />
    );
    expect(html).toContain("No discounts found");
    expect(html).toContain("Create promotional coupons");
    expect(html).toContain("Create Discount");
  });

  it("renders error state with retry button on network failure", () => {
    const testError = new Error("Failed to load discount definitions");
    const html = renderToStaticMarkup(
      <DiscountList
        discounts={[]}
        storeId="store_123"
        error={testError}
        onRetry={() => {}}
      />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Failed to load discounts");
    expect(html).toContain("Failed to load discount definitions");
    expect(html).toContain("Retry");
  });

  it("renders table rows with codes, values, minimum spend, usage, and status badges", () => {
    const html = renderToStaticMarkup(
      <DiscountList discounts={mockDiscounts} storeId="store_123" />
    );
    expect(html).toContain("WELCOME10");
    expect(html).toContain("Welcome 10% Off");
    expect(html).toContain("10% off");
    expect(html).toContain("Min spend $20.00");
    expect(html).toContain("15 / 100 used");

    expect(html).toContain("SAVE20");
    expect(html).toContain("$20.00 off");
    expect(html).toContain("Min spend $50.00");
    expect(html).toContain("0 used (Unlimited)");
  });
});

describe("Merchant Discounts UI: DiscountActions Component", () => {
  const activeDiscount: MerchantDiscountDTO = {
    id: "disc_active",
    storeId: "store_123",
    code: "ACT10",
    name: "Active 10%",
    description: null,
    type: "PERCENTAGE",
    value: 10,
    currency: null,
    status: "ACTIVE",
    minimumSubtotal: 0,
    maxDiscountAmount: null,
    usageLimit: null,
    usageCount: 0,
    startsAt: null,
    endsAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const disabledDiscount: MerchantDiscountDTO = {
    ...activeDiscount,
    id: "disc_disabled",
    code: "DIS10",
    status: "DISABLED",
  };

  it("renders Edit and Deactivate buttons for ACTIVE discount", () => {
    const html = renderToStaticMarkup(
      <DiscountActions discount={activeDiscount} storeId="store_123" />
    );
    expect(html).toContain("Edit");
    expect(html).toContain("Deactivate");
  });

  it("renders Edit and Activate buttons for DISABLED discount", () => {
    const html = renderToStaticMarkup(
      <DiscountActions discount={disabledDiscount} storeId="store_123" />
    );
    expect(html).toContain("Edit");
    expect(html).toContain("Activate");
  });
});

describe("Merchant Discounts UI: DiscountForm Component", () => {
  it("renders all form fields for creating a discount", () => {
    const html = renderToStaticMarkup(<DiscountForm storeId="store_123" />);
    expect(html).toContain("Create Discount");
    expect(html).toContain("Discount Code");
    expect(html).toContain("Discount Name");
    expect(html).toContain("Discount Type");
    expect(html).toContain("Percentage Value (%)");
    expect(html).toContain("Minimum Order Subtotal ($)");
    expect(html).toContain("Usage Limit");
    expect(html).toContain("Start Date");
    expect(html).toContain("End Date");
    expect(html).toContain("Status");
    expect(html).toContain("Create Discount");
  });

  it("renders in edit mode with initial discount values", () => {
    const initial: MerchantDiscountDTO = {
      id: "disc_edit",
      storeId: "store_123",
      code: "EDITVIP",
      name: "Edit VIP Discount",
      description: "Promo description",
      type: "PERCENTAGE",
      value: 25,
      currency: null,
      status: "ACTIVE",
      minimumSubtotal: 5000,
      maxDiscountAmount: 2500,
      usageLimit: 50,
      usageCount: 10,
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-12-31T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const html = renderToStaticMarkup(
      <DiscountForm storeId="store_123" initialDiscount={initial} />
    );
    expect(html).toContain("Edit Discount");
    expect(html).toContain("EDITVIP");
    expect(html).toContain("Edit VIP Discount");
    expect(html).toContain("Save Changes");
  });
});

describe("Merchant Discounts UI: API Client Integration Contracts", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("http://localhost:3000");
    vi.restoreAllMocks();
  });

  it("fetches discounts for active store", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "disc_test",
                storeId: "store_abc",
                code: "API10",
                name: "API Discount",
                type: "PERCENTAGE",
                value: 10,
                status: "ACTIVE",
                minimumSubtotal: 0,
                usageCount: 0,
              },
            ],
            total: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const res = await client.get<{ items: MerchantDiscountDTO[] }>(
      "/api/v1/stores/store_abc/discounts",
      { storeId: "store_abc" }
    );
    expect(capturedUrl).toContain("/api/v1/stores/store_abc/discounts");
    expect(res.items.length).toBe(1);
    expect(res.items[0]?.code).toBe("API10");
  });

  it("activates a discount via POST mutation", async () => {
    let capturedMethod = "";
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedMethod = init?.method || "GET";
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "disc_test",
            status: "ACTIVE",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const res = await client.post<{ id: string; status: string }>(
      "/api/v1/stores/store_abc/discounts/disc_test/activate",
      {},
      { storeId: "store_abc" }
    );
    expect(capturedMethod).toBe("POST");
    expect(res.status).toBe("ACTIVE");
  });

  it("deactivates a discount via POST mutation", async () => {
    let capturedMethod = "";
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedMethod = init?.method || "GET";
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "disc_test",
            status: "DISABLED",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const res = await client.post<{ id: string; status: string }>(
      "/api/v1/stores/store_abc/discounts/disc_test/deactivate",
      {},
      { storeId: "store_abc" }
    );
    expect(capturedMethod).toBe("POST");
    expect(res.status).toBe("DISABLED");
  });
});
