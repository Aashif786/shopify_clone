import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  storeDetailToSettingsFormData,
  validateStoreSettings,
  hasUnsavedSettingsChanges,
  settingsFormDataToUpdatePayload,
  canUserPerformLifecycleAction,
  getAvailableLifecycleActions,
} from "@/lib/merchant-store-helpers";
import { StoreSettingsForm } from "@/components/merchant/settings/store-settings-form";
import { StoreLifecycleCard } from "@/components/merchant/settings/store-lifecycle-card";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import type { StoreDetailDTO } from "@calcart/stores";

const mockDraftStore: StoreDetailDTO = {
  id: "store_draft_1",
  organizationId: "org_test_1",
  name: "Draft Apparel",
  slug: "draft-apparel",
  status: "DRAFT",
  currency: "USD",
  locale: "en-US",
  timezone: "America/New_York",
  settings: {
    contactEmail: "draft@example.com",
    contactPhone: "+1 555-0101",
    description: "New upcoming boutique",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockActiveStore: StoreDetailDTO = {
  id: "store_active_1",
  organizationId: "org_test_1",
  name: "Apex Mountain Gear",
  slug: "apex-gear",
  status: "ACTIVE",
  currency: "USD",
  locale: "en-US",
  timezone: "UTC",
  settings: {
    contactEmail: "support@apexgear.com",
    contactPhone: "+1 555-0199",
    description: "Premium climbing and mountaineering equipment.",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const mockSuspendedStore: StoreDetailDTO = {
  id: "store_suspended_1",
  organizationId: "org_test_1",
  name: "Suspended Store",
  slug: "suspended-store",
  status: "SUSPENDED",
  currency: "EUR",
  locale: "de-DE",
  timezone: "Europe/Berlin",
  settings: {
    contactEmail: "contact@suspended.de",
    contactPhone: null,
    description: null,
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

const mockArchivedStore: StoreDetailDTO = {
  id: "store_archived_1",
  organizationId: "org_test_1",
  name: "Closed Shop",
  slug: "closed-shop",
  status: "ARCHIVED",
  currency: "GBP",
  locale: "en-GB",
  timezone: "UTC",
  settings: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-12-31T00:00:00.000Z",
};

describe("Merchant Store Settings: Domain & Validation Helpers", () => {
  describe("storeDetailToSettingsFormData", () => {
    it("converts complete store detail DTO to form data structure", () => {
      const formData = storeDetailToSettingsFormData(mockActiveStore);
      expect(formData).toEqual({
        name: "Apex Mountain Gear",
        currency: "USD",
        locale: "en-US",
        timezone: "UTC",
        contactEmail: "support@apexgear.com",
        contactPhone: "+1 555-0199",
        description: "Premium climbing and mountaineering equipment.",
      });
    });

    it("handles null or missing settings without throwing", () => {
      const formData = storeDetailToSettingsFormData(mockArchivedStore);
      expect(formData.contactEmail).toBe("");
      expect(formData.contactPhone).toBe("");
      expect(formData.description).toBe("");
      expect(formData.currency).toBe("GBP");
    });
  });

  describe("validateStoreSettings", () => {
    const validInitial = storeDetailToSettingsFormData(mockActiveStore);

    it("accepts valid settings updates", () => {
      const errors = validateStoreSettings(validInitial, "ACTIVE", validInitial);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it("rejects empty store name", () => {
      const errors = validateStoreSettings(
        { ...validInitial, name: "   " },
        "ACTIVE",
        validInitial,
      );
      expect(errors.name).toBe("Store name is required");
    });

    it("rejects store name over 100 characters", () => {
      const errors = validateStoreSettings(
        { ...validInitial, name: "A".repeat(101) },
        "ACTIVE",
        validInitial,
      );
      expect(errors.name).toBe("Store name must not exceed 100 characters");
    });

    it("rejects modifying currency when store is ACTIVE", () => {
      const errors = validateStoreSettings(
        { ...validInitial, currency: "EUR" },
        "ACTIVE",
        validInitial,
      );
      expect(errors.currency).toBe(
        "Store currency cannot be modified once the store has been activated",
      );
    });

    it("rejects modifying currency when store is SUSPENDED", () => {
      const suspendedInitial = storeDetailToSettingsFormData(mockSuspendedStore);
      const errors = validateStoreSettings(
        { ...suspendedInitial, currency: "USD" },
        "SUSPENDED",
        suspendedInitial,
      );
      expect(errors.currency).toBe(
        "Store currency cannot be modified once the store has been activated",
      );
    });

    it("allows modifying currency when store is DRAFT", () => {
      const draftInitial = storeDetailToSettingsFormData(mockDraftStore);
      const errors = validateStoreSettings(
        { ...draftInitial, currency: "EUR" },
        "DRAFT",
        draftInitial,
      );
      expect(errors.currency).toBeUndefined();
    });

    it("validates currency format (3 uppercase letters)", () => {
      const draftInitial = storeDetailToSettingsFormData(mockDraftStore);
      const errors = validateStoreSettings(
        { ...draftInitial, currency: "US" },
        "DRAFT",
        draftInitial,
      );
      expect(errors.currency).toContain("3-letter currency code");
    });

    it("validates locale format", () => {
      const errors = validateStoreSettings(
        { ...validInitial, locale: "invalid_locale" },
        "ACTIVE",
        validInitial,
      );
      expect(errors.locale).toContain("valid locale code");
    });

    it("validates contact email format", () => {
      const errors = validateStoreSettings(
        { ...validInitial, contactEmail: "not-an-email" },
        "ACTIVE",
        validInitial,
      );
      expect(errors.contactEmail).toBe("Contact email must be a valid email address");
    });

    it("validates contact phone length (<= 30 chars)", () => {
      const errors = validateStoreSettings(
        { ...validInitial, contactPhone: "+1".repeat(20) },
        "ACTIVE",
        validInitial,
      );
      expect(errors.contactPhone).toBe("Contact phone must not exceed 30 characters");
    });
  });

  describe("hasUnsavedSettingsChanges", () => {
    const initial = storeDetailToSettingsFormData(mockActiveStore);

    it("returns false when form data is identical to initial", () => {
      expect(hasUnsavedSettingsChanges({ ...initial }, initial)).toBe(false);
    });

    it("returns true when name changes", () => {
      expect(hasUnsavedSettingsChanges({ ...initial, name: "New Name" }, initial)).toBe(true);
    });

    it("returns true when contact phone changes", () => {
      expect(
        hasUnsavedSettingsChanges({ ...initial, contactPhone: "+1 555-9999" }, initial),
      ).toBe(true);
    });

    it("returns true when description changes", () => {
      expect(
        hasUnsavedSettingsChanges({ ...initial, description: "Different text" }, initial),
      ).toBe(true);
    });
  });

  describe("settingsFormDataToUpdatePayload", () => {
    const initial = storeDetailToSettingsFormData(mockActiveStore);

    it("returns empty object when no changes made", () => {
      const payload = settingsFormDataToUpdatePayload({ ...initial }, initial);
      expect(Object.keys(payload)).toHaveLength(0);
    });

    it("includes only changed fields in payload", () => {
      const current = {
        ...initial,
        name: "Renamed Apex Gear",
        contactEmail: "new@apexgear.com",
      };
      const payload = settingsFormDataToUpdatePayload(current, initial);
      expect(payload).toEqual({
        name: "Renamed Apex Gear",
        contactEmail: "new@apexgear.com",
      });
      expect(payload.currency).toBeUndefined();
      expect(payload.locale).toBeUndefined();
      expect(payload.timezone).toBeUndefined();
    });

    it("maps cleared optional contact strings to null", () => {
      const current = {
        ...initial,
        contactEmail: "",
        contactPhone: "",
        description: "",
      };
      const payload = settingsFormDataToUpdatePayload(current, initial);
      expect(payload.contactEmail).toBeNull();
      expect(payload.contactPhone).toBeNull();
      expect(payload.description).toBeNull();
    });
  });
});

describe("Merchant Store Lifecycle: State Transitions & Roles", () => {
  describe("canUserPerformLifecycleAction", () => {
    it("allows owner to perform all actions including archive", () => {
      expect(canUserPerformLifecycleAction("activate", "owner")).toBe(true);
      expect(canUserPerformLifecycleAction("suspend", "owner")).toBe(true);
      expect(canUserPerformLifecycleAction("reactivate", "owner")).toBe(true);
      expect(canUserPerformLifecycleAction("archive", "owner")).toBe(true);
    });

    it("allows admin to activate, suspend, and reactivate but NOT archive", () => {
      expect(canUserPerformLifecycleAction("activate", "admin")).toBe(true);
      expect(canUserPerformLifecycleAction("suspend", "admin")).toBe(true);
      expect(canUserPerformLifecycleAction("reactivate", "admin")).toBe(true);
      expect(canUserPerformLifecycleAction("archive", "admin")).toBe(false);
    });

    it("denies staff members from performing any lifecycle action", () => {
      expect(canUserPerformLifecycleAction("activate", "staff")).toBe(false);
      expect(canUserPerformLifecycleAction("suspend", "staff")).toBe(false);
      expect(canUserPerformLifecycleAction("reactivate", "staff")).toBe(false);
      expect(canUserPerformLifecycleAction("archive", "staff")).toBe(false);
    });

    it("denies unauthenticated or undefined roles", () => {
      expect(canUserPerformLifecycleAction("activate", undefined)).toBe(false);
      expect(canUserPerformLifecycleAction("archive", "")).toBe(false);
    });
  });

  describe("getAvailableLifecycleActions", () => {
    it("returns activate and archive for DRAFT store (owner)", () => {
      const actions = getAvailableLifecycleActions("DRAFT", "owner");
      expect(actions.map((a) => a.action)).toEqual(["activate", "archive"]);
      expect(actions[0]?.disabled).toBe(false);
      expect(actions[1]?.disabled).toBe(false);
    });

    it("disables archive for DRAFT store when user is admin", () => {
      const actions = getAvailableLifecycleActions("DRAFT", "admin");
      expect(actions.map((a) => a.action)).toEqual(["activate", "archive"]);
      expect(actions[0]?.disabled).toBe(false);
      expect(actions[1]?.disabled).toBe(true);
      expect(actions[1]?.disabledReason).toContain("Only the store Owner");
    });

    it("returns suspend and archive for ACTIVE store", () => {
      const actions = getAvailableLifecycleActions("ACTIVE", "owner");
      expect(actions.map((a) => a.action)).toEqual(["suspend", "archive"]);
      expect(actions[0]?.isDestructive).toBe(true);
    });

    it("returns reactivate and archive for SUSPENDED store", () => {
      const actions = getAvailableLifecycleActions("SUSPENDED", "owner");
      expect(actions.map((a) => a.action)).toEqual(["reactivate", "archive"]);
      expect(actions[0]?.variant).toBe("primary");
    });

    it("returns empty list for ARCHIVED store (terminal state)", () => {
      const actions = getAvailableLifecycleActions("ARCHIVED", "owner");
      expect(actions).toEqual([]);
    });

    it("disables all actions for staff users", () => {
      const actions = getAvailableLifecycleActions("ACTIVE", "staff");
      expect(actions).toHaveLength(2);
      expect(actions[0]?.disabled).toBe(true);
      expect(actions[1]?.disabled).toBe(true);
    });
  });
});

describe("Merchant Store Settings UI Component Rendering", () => {
  it("renders StoreSettingsForm with current values and read-only slug", () => {
    const html = renderToStaticMarkup(
      <StoreSettingsForm store={mockActiveStore} userRole="owner" />,
    );

    expect(html).toContain("General Store Settings");
    expect(html).toContain("Store Identity");
    expect(html).toContain("Apex Mountain Gear");
    expect(html).toContain("apex-gear");
    expect(html).toContain("Storefront route:");
    expect(html).toContain("/storefront/apex-gear");
    expect(html).toContain("support@apexgear.com");
    expect(html).toContain("+1 555-0199");
  });

  it("locks currency field when store is ACTIVE", () => {
    const html = renderToStaticMarkup(
      <StoreSettingsForm store={mockActiveStore} userRole="owner" />,
    );

    expect(html).toContain("Base currency is permanently locked");
    expect(html).toContain("disabled");
  });

  it("leaves currency field editable when store is DRAFT", () => {
    const html = renderToStaticMarkup(
      <StoreSettingsForm store={mockDraftStore} userRole="owner" />,
    );

    expect(html).toContain("Base operational currency. Locks permanently once store is activated.");
  });

  it("renders Staff Read-Only Access warning when user has staff role", () => {
    const html = renderToStaticMarkup(
      <StoreSettingsForm store={mockActiveStore} userRole="staff" />,
    );

    expect(html).toContain("Read-Only Access");
    expect(html).toContain("You have Staff membership for this store");
  });

  it("renders Store Archived notice when store is archived", () => {
    const html = renderToStaticMarkup(
      <StoreSettingsForm store={mockArchivedStore} userRole="owner" />,
    );

    expect(html).toContain("Store Archived");
    expect(html).toContain("Settings are preserved for historical records");
  });
});

describe("Merchant Store Lifecycle UI Component Rendering", () => {
  it("renders StoreLifecycleCard with Active badge and permitted transitions", () => {
    const html = renderToStaticMarkup(
      <StoreLifecycleCard store={mockActiveStore} userRole="owner" />,
    );

    expect(html).toContain("Store Lifecycle &amp; Operational Status");
    expect(html).toContain("Active");
    expect(html).toContain("Suspend Store");
    expect(html).toContain("Archive Store");
  });

  it("renders StoreLifecycleCard with Suspended badge and Reactivate button", () => {
    const html = renderToStaticMarkup(
      <StoreLifecycleCard store={mockSuspendedStore} userRole="owner" />,
    );

    expect(html).toContain("Suspended");
    expect(html).toContain("Reactivate Store");
  });

  it("renders terminal message for permanently archived store", () => {
    const html = renderToStaticMarkup(
      <StoreLifecycleCard store={mockArchivedStore} userRole="owner" />,
    );

    expect(html).toContain("Archived");
    expect(html).toContain("This store is permanently archived. No further lifecycle transitions");
  });
});

describe("API Client & End-to-End Store Settings & Lifecycle Integration", () => {
  const mockApiClient = new ApiClient("http://localhost:3000");

  it("successfully calls PATCH /api/v1/stores/[storeId] with updated fields", async () => {
    const updatedStore: StoreDetailDTO = {
      ...mockActiveStore,
      name: "Apex Mountain Gear Co.",
      updatedAt: "2026-01-05T00:00:00.000Z",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: updatedStore,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.patch<StoreDetailDTO>(
      `/api/v1/stores/${mockActiveStore.id}`,
      { name: "Apex Mountain Gear Co." },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe(`http://localhost:3000/api/v1/stores/${mockActiveStore.id}`);
    expect(callInit.method).toBe("PATCH");
    expect(JSON.parse(callInit.body as string)).toEqual({
      name: "Apex Mountain Gear Co.",
    });
    expect(result.name).toBe("Apex Mountain Gear Co.");

    vi.unstubAllGlobals();
  });

  it("handles 400 validation error from PATCH with field-level errors", async () => {
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
            currency: "Store currency cannot be modified once activated",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.patch(`/api/v1/stores/${mockActiveStore.id}`, { name: "" });
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.fields).toBeDefined();
      expect(apiErr.fields?.name).toBe("Store name is required");
      expect(apiErr.fields?.currency).toContain("cannot be modified once activated");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("handles 403 Forbidden when staff user attempts to save settings", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to modify store settings",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.patch(`/api/v1/stores/${mockActiveStore.id}`, { name: "Hacked" });
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.isForbidden).toBe(true);
      expect(apiErr.message).toContain("permission to modify store settings");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("successfully calls POST /api/v1/stores/[storeId]/activate for draft store", async () => {
    const activatedStore: StoreDetailDTO = {
      ...mockDraftStore,
      status: "ACTIVE",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: activatedStore,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.post<StoreDetailDTO>(
      `/api/v1/stores/${mockDraftStore.id}/activate`,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe(`http://localhost:3000/api/v1/stores/${mockDraftStore.id}/activate`);
    expect(callInit.method).toBe("POST");
    expect(result.status).toBe("ACTIVE");

    vi.unstubAllGlobals();
  });

  it("successfully calls POST /api/v1/stores/[storeId]/suspend for active store", async () => {
    const suspendedStore: StoreDetailDTO = {
      ...mockActiveStore,
      status: "SUSPENDED",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: suspendedStore,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.post<StoreDetailDTO>(
      `/api/v1/stores/${mockActiveStore.id}/suspend`,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("SUSPENDED");

    vi.unstubAllGlobals();
  });

  it("successfully calls POST /api/v1/stores/[storeId]/archive (owner only)", async () => {
    const archivedStore: StoreDetailDTO = {
      ...mockActiveStore,
      status: "ARCHIVED",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: archivedStore,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.post<StoreDetailDTO>(
      `/api/v1/stores/${mockActiveStore.id}/archive`,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ARCHIVED");

    vi.unstubAllGlobals();
  });

  it("duplicate submission guard prevents redundant lifecycle post requests", async () => {
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
          data: { ...mockDraftStore, status: "ACTIVE" },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchSpy);

    const p1 = mockApiClient.request(`/api/v1/stores/${mockDraftStore.id}/activate`, {
      method: "POST",
      deduplicateKey: `activate-${mockDraftStore.id}`,
    });
    const p2 = mockApiClient.request(`/api/v1/stores/${mockDraftStore.id}/activate`, {
      method: "POST",
      deduplicateKey: `activate-${mockDraftStore.id}`,
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(callCount).toBe(1);
    expect(r1).toEqual(r2);

    vi.unstubAllGlobals();
  });
});
