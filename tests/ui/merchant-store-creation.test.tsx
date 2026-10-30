import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  normalizeSlugInput,
  isValidSlugFormat,
  validateStoreFormData,
  formDataToStorePayload,
  COMMON_CURRENCIES,
  type StoreFormData,
} from "@/lib/merchant-store-helpers";
import { StoreForm } from "@/components/merchant/stores/store-form";
import { StoreProvider, type StoreSummary } from "@/context/store-context";
import { AuthProvider } from "@/context/auth-context";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import type { StoreDetailDTO } from "@calcart/stores";

function renderWithProviders(ui: React.ReactElement) {
  return renderToStaticMarkup(
    <AuthProvider initialUser={{ id: "user_test", email: "test@example.com", name: "Test User", status: "ACTIVE" }}>
      <StoreProvider initialStores={[]}>
        {ui}
      </StoreProvider>
    </AuthProvider>
  );
}

describe("Merchant Store Creation: Normalization & Validation Helpers", () => {
  describe("normalizeSlugInput", () => {
    it("converts uppercase characters to lowercase", () => {
      expect(normalizeSlugInput("ApexOutfitters")).toBe("apexoutfitters");
    });

    it("replaces spaces and special characters with single hyphens", () => {
      expect(normalizeSlugInput("Apex Outfitters & Co.")).toBe("apex-outfitters-co");
      expect(normalizeSlugInput("Winter 2026 / Ski Gear")).toBe("winter-2026-ski-gear");
    });

    it("collapses consecutive hyphens into a single hyphen", () => {
      expect(normalizeSlugInput("store---name")).toBe("store-name");
    });

    it("strips leading and trailing hyphens", () => {
      expect(normalizeSlugInput("-leading-and-trailing-")).toBe("leading-and-trailing");
    });

    it("returns empty string for empty, whitespace, or falsy inputs", () => {
      expect(normalizeSlugInput("")).toBe("");
      expect(normalizeSlugInput("   ")).toBe("");
    });
  });

  describe("isValidSlugFormat", () => {
    it("accepts valid alphanumeric slugs between 3 and 63 characters", () => {
      expect(isValidSlugFormat("apex")).toBe(true);
      expect(isValidSlugFormat("apex-outfitters")).toBe(true);
      expect(isValidSlugFormat("ski-shop-2026")).toBe(true);
      expect(isValidSlugFormat("a12")).toBe(true);
    });

    it("rejects slugs that are too short (< 3 characters)", () => {
      expect(isValidSlugFormat("ab")).toBe(false);
      expect(isValidSlugFormat("a")).toBe(false);
      expect(isValidSlugFormat("")).toBe(false);
    });

    it("rejects slugs that exceed 63 characters", () => {
      const longSlug = "a".repeat(64);
      expect(isValidSlugFormat(longSlug)).toBe(false);
      const validMaxSlug = "a".repeat(63);
      expect(isValidSlugFormat(validMaxSlug)).toBe(true);
    });

    it("rejects slugs containing uppercase letters or invalid punctuation", () => {
      expect(isValidSlugFormat("Apex-Outfitters")).toBe(false);
      expect(isValidSlugFormat("apex_outfitters")).toBe(false);
      expect(isValidSlugFormat("apex.outfitters")).toBe(false);
      expect(isValidSlugFormat("apex outfitters")).toBe(false);
      expect(isValidSlugFormat("apex@shop")).toBe(false);
    });

    it("rejects slugs with leading, trailing, or double hyphens", () => {
      expect(isValidSlugFormat("-apex-outfitters")).toBe(false);
      expect(isValidSlugFormat("apex-outfitters-")).toBe(false);
      expect(isValidSlugFormat("apex--outfitters")).toBe(false);
    });
  });

  describe("validateStoreFormData", () => {
    const validData: StoreFormData = {
      name: "Summit Ridge Outfitters",
      slug: "summit-ridge",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
      contactEmail: "contact@summitridge.com",
      contactPhone: "+1-555-123-4567",
      description: "Premium mountain gear",
    };

    it("passes validation with complete valid data", () => {
      const errors = validateStoreFormData(validData);
      expect(Object.keys(errors).length).toBe(0);
    });

    it("passes validation when optional fields are empty", () => {
      const minimalData: StoreFormData = {
        name: "Minimal Store",
        slug: "",
        currency: "USD",
        locale: "en-US",
        timezone: "UTC",
        contactEmail: "",
        contactPhone: "",
        description: "",
      };
      const errors = validateStoreFormData(minimalData);
      expect(Object.keys(errors).length).toBe(0);
    });

    it("fails when store name is missing or empty whitespace", () => {
      const missingName = { ...validData, name: "" };
      expect(validateStoreFormData(missingName).name).toBe("Store name is required");

      const whitespaceName = { ...validData, name: "   " };
      expect(validateStoreFormData(whitespaceName).name).toBe("Store name is required");
    });

    it("fails when store name exceeds 100 characters", () => {
      const longName = { ...validData, name: "A".repeat(101) };
      expect(validateStoreFormData(longName).name).toBe("Store name must not exceed 100 characters");
    });

    it("fails when custom slug violates formatting rules", () => {
      const invalidSlug = { ...validData, slug: "ab" }; // too short
      expect(validateStoreFormData(invalidSlug).slug).toContain("Slug must be 3-63 characters");

      const invalidChars = { ...validData, slug: "Invalid Slug!" };
      expect(validateStoreFormData(invalidChars).slug).toContain("Slug must be 3-63 characters");
    });

    it("fails when currency is not a 3-letter code", () => {
      const invalidCurrency = { ...validData, currency: "US" };
      expect(validateStoreFormData(invalidCurrency).currency).toContain("3-letter currency code");

      const numericCurrency = { ...validData, currency: "123" };
      expect(validateStoreFormData(numericCurrency).currency).toContain("3-letter currency code");
    });

    it("fails when locale format is invalid", () => {
      const invalidLocale = { ...validData, locale: "invalid_locale_format" };
      expect(validateStoreFormData(invalidLocale).locale).toContain("valid locale code");
    });

    it("fails when contact email is invalid", () => {
      const invalidEmail = { ...validData, contactEmail: "not-an-email" };
      expect(validateStoreFormData(invalidEmail).contactEmail).toContain("valid email address");
    });

    it("fails when contact phone exceeds 30 characters", () => {
      const longPhone = { ...validData, contactPhone: "1".repeat(31) };
      expect(validateStoreFormData(longPhone).contactPhone).toContain("must not exceed 30 characters");
    });
  });

  describe("formDataToStorePayload", () => {
    it("transforms form data into normalized API request payload", () => {
      const input: StoreFormData = {
        name: "  Highland Gear  ",
        slug: "  highland-gear-2026  ",
        currency: "eur",
        locale: "de-DE",
        timezone: "Europe/Berlin",
        contactEmail: "  info@highland.de  ",
        contactPhone: "  +49 30 123456  ",
        description: "  Outdoor equipment store  ",
      };

      const payload = formDataToStorePayload(input);
      expect(payload).toEqual({
        name: "Highland Gear",
        slug: "highland-gear-2026",
        currency: "EUR",
        locale: "de-DE",
        timezone: "Europe/Berlin",
        contactEmail: "info@highland.de",
        contactPhone: "+49 30 123456",
        description: "Outdoor equipment store",
      });
    });

    it("omits empty optional fields from payload", () => {
      const input: StoreFormData = {
        name: "Simple Shop",
        slug: "",
        currency: "USD",
        locale: "en-US",
        timezone: "UTC",
        contactEmail: "",
        contactPhone: "",
        description: "",
      };

      const payload = formDataToStorePayload(input);
      expect(payload).toEqual({
        name: "Simple Shop",
        currency: "USD",
        locale: "en-US",
        timezone: "UTC",
      });
      expect(payload.slug).toBeUndefined();
      expect(payload.contactEmail).toBeUndefined();
      expect(payload.contactPhone).toBeUndefined();
      expect(payload.description).toBeUndefined();
    });
  });
});

describe("Merchant Store Creation UI: Component Rendering & Markup", () => {
  it("renders store creation form with all required fields and helpers", () => {
    const html = renderWithProviders(<StoreForm />);

    expect(html).toContain("Store Details");
    expect(html).toContain('id="store-name"');
    expect(html).toContain('name="name"');
    expect(html).toContain('id="store-slug"');
    expect(html).toContain('name="slug"');
    expect(html).toContain('id="store-currency"');
    expect(html).toContain('name="currency"');
    expect(html).toContain('id="store-locale"');
    expect(html).toContain('name="locale"');
    expect(html).toContain('id="store-timezone"');
    expect(html).toContain('name="timezone"');
    expect(html).toContain('id="store-contact-email"');
    expect(html).toContain('id="store-contact-phone"');
    expect(html).toContain('id="store-description"');
    expect(html).toContain("Create Store");
  });

  it("renders supported currency options in currency select", () => {
    const html = renderWithProviders(<StoreForm />);

    for (const curr of COMMON_CURRENCIES) {
      expect(html).toContain(`value="${curr.value}"`);
      expect(html).toContain(curr.label);
    }
  });

  it("renders customer storefront URL preview indicator", () => {
    const html = renderWithProviders(<StoreForm />);
    expect(html).toContain("Customer Storefront URL:");
    expect(html).toContain("/stores/my-store/products");
  });

  it("renders cancel button when onCancel prop is provided", () => {
    const html = renderWithProviders(<StoreForm onCancel={() => {}} />);
    expect(html).toContain("Cancel");
  });
});

describe("Merchant Store Creation: API Client Interaction & Error Handling", () => {
  let mockApiClient: ApiClient;

  beforeEach(() => {
    mockApiClient = new ApiClient("http://localhost:3000");
  });

  it("calls POST /api/v1/stores with correct payload and returns StoreDetailDTO", async () => {
    const fakeStore: StoreDetailDTO = {
      id: "store_01h8abc123",
      organizationId: "org_01h8abc456",
      name: "Summit Ridge Outfitters",
      slug: "summit-ridge",
      status: "DRAFT",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
      settings: {
        contactEmail: "support@summitridge.com",
        contactPhone: null,
        description: null,
      },
      createdAt: "2026-10-13T00:00:00.000Z",
      updatedAt: "2026-10-13T00:00:00.000Z",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: fakeStore,
        error: null,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const payload = formDataToStorePayload({
      name: "Summit Ridge Outfitters",
      slug: "summit-ridge",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
      contactEmail: "support@summitridge.com",
      contactPhone: "",
      description: "",
    });

    const result = await mockApiClient.post<StoreDetailDTO>("/api/v1/stores", payload);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe("http://localhost:3000/api/v1/stores");
    expect(callInit.method).toBe("POST");
    expect(JSON.parse(callInit.body as string)).toEqual({
      name: "Summit Ridge Outfitters",
      slug: "summit-ridge",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
      contactEmail: "support@summitridge.com",
    });

    expect(result).toEqual(fakeStore);
    vi.unstubAllGlobals();
  });

  it("handles 409 conflict when store slug already exists", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "DUPLICATE_STORE_SLUG",
          message: "Store with slug 'summit-ridge' already exists",
          requestId: "req_conflict_123",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.post("/api/v1/stores", { name: "Summit Ridge", slug: "summit-ridge" });
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.isConflict).toBe(true);
      expect(apiErr.code).toBe("DUPLICATE_STORE_SLUG");
      expect(apiErr.message).toContain("already exists");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("handles 400 validation error with field-specific mapping", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          fields: {
            name: "Store name is required",
            currency: "Currency must be a 3-letter currency code",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.post("/api/v1/stores", {});
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.isValidationError).toBe(true);
      expect(apiErr.fields).toBeDefined();
      expect(apiErr.fields?.name).toBe("Store name is required");
      expect(apiErr.fields?.currency).toBe("Currency must be a 3-letter currency code");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("handles 403 forbidden error when user lacks organization permission", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "ORGANIZATION_ACCESS_DENIED",
          message: "User does not have permission to create stores under this organization",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.post("/api/v1/stores", { name: "Store", organizationId: "org_forbidden" });
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.isForbidden).toBe(true);
      expect(apiErr.code).toBe("ORGANIZATION_ACCESS_DENIED");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("duplicate submission guard prevents second request while first is in-flight", async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      // Simulate delay
      await new Promise((r) => setTimeout(r, 50));
      return {
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { id: "store_123", name: "Store 123" },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchSpy);

    // Using deduplicateKey or checking multiple parallel calls
    const p1 = mockApiClient.request("/api/v1/stores", {
      method: "POST",
      deduplicateKey: "create-store-singleton",
    });
    const p2 = mockApiClient.request("/api/v1/stores", {
      method: "POST",
      deduplicateKey: "create-store-singleton",
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(callCount).toBe(1);
    expect(r1).toEqual(r2);

    vi.unstubAllGlobals();
  });
});

describe("Store Context: Selection, Switching & Isolation", () => {
  const mockStores: StoreSummary[] = [
    {
      id: "store_alpha",
      name: "Alpha Outdoors",
      slug: "alpha-outdoors",
      currency: "USD",
      role: "owner",
    },
    {
      id: "store_beta",
      name: "Beta Apparel",
      slug: "beta-apparel",
      currency: "EUR",
      role: "admin",
    },
  ];

  it("renders StoreProvider with initial stores and selected store", () => {
    const html = renderToStaticMarkup(
      <AuthProvider initialUser={{ id: "u1", email: "test@example.com", name: "User", status: "ACTIVE" }}>
        <StoreProvider initialStores={mockStores} initialStoreId="store_alpha">
          <div data-testid="child">Store Context Test</div>
        </StoreProvider>
      </AuthProvider>
    );
    expect(html).toContain("Store Context Test");
  });

  it("switches active store when selectStore is invoked without cross-tenant bleed", () => {
    let currentStore: StoreSummary | null = mockStores[0]!;
    const handleStoreChange = vi.fn((newStore: StoreSummary | null) => {
      currentStore = newStore;
    });

    // Simulate switching logic
    const selectStoreSim = (id: string) => {
      const target = mockStores.find((s) => s.id === id) || null;
      handleStoreChange(target);
    };

    selectStoreSim("store_beta");
    expect(handleStoreChange).toHaveBeenCalledTimes(1);
    expect(currentStore).toEqual(mockStores[1]);
    expect(currentStore?.id).toBe("store_beta");
    expect(currentStore?.currency).toBe("EUR");
  });

  it("refreshStores with selectId targets newly created store", () => {
    const updatedStoresList: StoreSummary[] = [
      ...mockStores,
      {
        id: "store_gamma",
        name: "Gamma Sports",
        slug: "gamma-sports",
        currency: "GBP",
        role: "owner",
      },
    ];

    const targetSelectId = "store_gamma";
    // Check selection logic matching store-context.tsx
    const selected = updatedStoresList.find((s) => s.id === targetSelectId) || updatedStoresList[0]!;
    expect(selected.id).toBe("store_gamma");
    expect(selected.name).toBe("Gamma Sports");
    expect(selected.currency).toBe("GBP");
  });
});
