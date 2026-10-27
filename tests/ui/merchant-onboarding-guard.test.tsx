import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure evaluation function matching the guard in MerchantDashboardPage
function evaluateMerchantDashboardGuard({
  user,
  isAuthLoading,
  stores,
  isStoreLoading,
  hasLoaded,
  storeError,
}: {
  user: { id: string } | null;
  isAuthLoading: boolean;
  stores: Array<{ id: string }>;
  isStoreLoading: boolean;
  hasLoaded: boolean;
  storeError: Error | null;
}): string | null {
  if (isAuthLoading || isStoreLoading || !hasLoaded) {
    return null; // Do not redirect while loading or uninitialized
  }
  if (!user) {
    return "/merchant/login";
  }
  if (stores.length === 0 && !storeError) {
    return "/merchant/onboarding";
  }
  return null;
}

// Pure evaluation function matching the guard in MerchantOnboardingPage
function evaluateMerchantOnboardingGuard({
  user,
  isAuthLoading,
  stores,
  isStoreLoading,
  hasLoaded,
}: {
  user: { id: string } | null;
  isAuthLoading: boolean;
  stores: Array<{ id: string }>;
  isStoreLoading: boolean;
  hasLoaded: boolean;
}): string | null {
  if (isAuthLoading || isStoreLoading || !hasLoaded) {
    return null;
  }
  if (!user) {
    return "/merchant/login?redirect=/merchant/onboarding";
  }
  if (stores.length > 0) {
    return "/merchant";
  }
  return null;
}

describe("Merchant Dashboard & Onboarding Guards", () => {
  describe("Dashboard Guard (evaluateMerchantDashboardGuard)", () => {
    it("does NOT redirect to onboarding while stores are loading (hasLoaded = false), even if stores list is empty", () => {
      const redirect = evaluateMerchantDashboardGuard({
        user: { id: "user_1" },
        isAuthLoading: false,
        stores: [],
        isStoreLoading: true,
        hasLoaded: false,
        storeError: null,
      });

      expect(redirect).toBeNull();
    });

    it("does NOT redirect to onboarding during the initial render race window (auth loaded, stores not yet initialized)", () => {
      // The bug: auth finished, but store provider had not finished fetching stores yet (stores = [], hasLoaded = false)
      const redirect = evaluateMerchantDashboardGuard({
        user: { id: "user_1" },
        isAuthLoading: false,
        stores: [],
        isStoreLoading: false,
        hasLoaded: false,
        storeError: null,
      });

      expect(redirect).toBeNull();
    });

    it("does NOT redirect to onboarding when user has at least one store", () => {
      const redirect = evaluateMerchantDashboardGuard({
        user: { id: "user_1" },
        isAuthLoading: false,
        stores: [{ id: "store_123" }],
        isStoreLoading: false,
        hasLoaded: true,
        storeError: null,
      });

      expect(redirect).toBeNull();
    });

    it("does NOT redirect to onboarding if an API error occurs loading stores", () => {
      const redirect = evaluateMerchantDashboardGuard({
        user: { id: "user_1" },
        isAuthLoading: false,
        stores: [],
        isStoreLoading: false,
        hasLoaded: true,
        storeError: new Error("Network timeout"),
      });

      expect(redirect).toBeNull();
    });

    it("redirects to /merchant/onboarding ONLY when stores have fully loaded, no error, and stores list is truly 0", () => {
      const redirect = evaluateMerchantDashboardGuard({
        user: { id: "user_new" },
        isAuthLoading: false,
        stores: [],
        isStoreLoading: false,
        hasLoaded: true,
        storeError: null,
      });

      expect(redirect).toBe("/merchant/onboarding");
    });

    it("redirects to /merchant/login if user is unauthenticated after auth loading finishes", () => {
      const redirect = evaluateMerchantDashboardGuard({
        user: null,
        isAuthLoading: false,
        stores: [],
        isStoreLoading: false,
        hasLoaded: true,
        storeError: null,
      });

      expect(redirect).toBe("/merchant/login");
    });
  });

  describe("Onboarding Page Guard (evaluateMerchantOnboardingGuard)", () => {
    it("does NOT prematurely redirect an existing merchant back to /merchant before stores load", () => {
      const redirect = evaluateMerchantOnboardingGuard({
        user: { id: "user_1" },
        isAuthLoading: false,
        stores: [],
        isStoreLoading: true,
        hasLoaded: false,
      });

      expect(redirect).toBeNull();
    });

    it("redirects an existing merchant who has stores back to /merchant once stores have loaded", () => {
      const redirect = evaluateMerchantOnboardingGuard({
        user: { id: "user_1" },
        isAuthLoading: false,
        stores: [{ id: "store_1" }],
        isStoreLoading: false,
        hasLoaded: true,
      });

      expect(redirect).toBe("/merchant");
    });

    it("remains on onboarding for genuine new users with 0 stores once loaded", () => {
      const redirect = evaluateMerchantOnboardingGuard({
        user: { id: "user_new" },
        isAuthLoading: false,
        stores: [],
        isStoreLoading: false,
        hasLoaded: true,
      });

      expect(redirect).toBeNull();
    });
  });
});
