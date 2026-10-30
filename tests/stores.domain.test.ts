import { describe, expect, it } from "vitest";
import {
  assertValidMembershipTransition,
  assertValidStoreTransition,
  CannotRemoveLastOwnerError,
  DuplicateStoreSlugError,
  ImmutableFieldError,
  InvalidStoreStatusTransitionError,
  isValidCurrency,
  isValidLocale,
  isValidMembershipTransition,
  isValidSlugFormat,
  isValidStoreRole,
  isValidStoreTransition,
  isValidTimezone,
  normalizeSlug,
  StoreNotFoundError,
  validateStoreInput,
} from "@calcart/stores";

describe("Stores Domain Logic & Invariants", () => {
  describe("Slug Normalization and Validation", () => {
    it("normalizes human titles into URL-safe slugs", () => {
      expect(normalizeSlug("My Fashion Store!")).toBe("my-fashion-store");
      expect(normalizeSlug("  Coffee & Beans   ")).toBe("coffee-beans");
      expect(normalizeSlug("UPPERCASE---TEST")).toBe("uppercase-test");
    });

    it("validates slug formats according to policy", () => {
      expect(isValidSlugFormat("my-store")).toBe(true);
      expect(isValidSlugFormat("store123")).toBe(true);
      expect(isValidSlugFormat("ab")).toBe(false); // Min 3 chars
      expect(isValidSlugFormat("-leading-hyphen")).toBe(false);
      expect(isValidSlugFormat("trailing-hyphen-")).toBe(false);
      expect(isValidSlugFormat("invalid_underscore")).toBe(false);
      expect(isValidSlugFormat("invalid space")).toBe(false);
      expect(isValidSlugFormat("a".repeat(64))).toBe(false); // Max 63 chars
    });
  });

  describe("Store Attribute Validation", () => {
    it("validates ISO 4217 currency codes", () => {
      expect(isValidCurrency("USD")).toBe(true);
      expect(isValidCurrency("EUR")).toBe(true);
      expect(isValidCurrency("INR")).toBe(true);
      expect(isValidCurrency("usd")).toBe(true);
      expect(isValidCurrency("US")).toBe(false);
      expect(isValidCurrency("USDD")).toBe(false);
      expect(isValidCurrency("123")).toBe(false);
    });

    it("validates locale strings", () => {
      expect(isValidLocale("en-US")).toBe(true);
      expect(isValidLocale("en")).toBe(true);
      expect(isValidLocale("de-DE")).toBe(true);
      expect(isValidLocale("")).toBe(false);
    });

    it("validates IANA timezones using Intl runtime", () => {
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Asia/Kolkata")).toBe(true);
      expect(isValidTimezone("Europe/London")).toBe(true);
      expect(isValidTimezone("Mars/Olympus")).toBe(false);
      expect(isValidTimezone("NotATimezone")).toBe(false);
    });

    it("validates supported store roles", () => {
      expect(isValidStoreRole("owner")).toBe(true);
      expect(isValidStoreRole("admin")).toBe(true);
      expect(isValidStoreRole("staff")).toBe(true);
      expect(isValidStoreRole("customer")).toBe(false);
      expect(isValidStoreRole("superadmin")).toBe(false);
    });

    it("returns explicit validation errors on invalid input", () => {
      const errors = validateStoreInput({
        name: "",
        slug: "ab",
        currency: "INVALID",
        timezone: "Invalid/Zone",
        contactEmail: "not-an-email",
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "name" }),
          expect.objectContaining({ field: "slug" }),
          expect.objectContaining({ field: "currency" }),
          expect.objectContaining({ field: "timezone" }),
          expect.objectContaining({ field: "contactEmail" }),
        ]),
      );
    });
  });

  describe("Store Lifecycle Transitions", () => {
    it("allows legal store lifecycle transitions", () => {
      expect(isValidStoreTransition("DRAFT", "ACTIVE")).toBe(true);
      expect(isValidStoreTransition("DRAFT", "ARCHIVED")).toBe(true);
      expect(isValidStoreTransition("ACTIVE", "SUSPENDED")).toBe(true);
      expect(isValidStoreTransition("ACTIVE", "ARCHIVED")).toBe(true);
      expect(isValidStoreTransition("SUSPENDED", "ACTIVE")).toBe(true);
      expect(isValidStoreTransition("SUSPENDED", "ARCHIVED")).toBe(true);
      expect(isValidStoreTransition("ACTIVE", "ACTIVE")).toBe(true); // No-op
    });

    it("rejects illegal store lifecycle transitions", () => {
      // DRAFT cannot jump directly to SUSPENDED
      expect(isValidStoreTransition("DRAFT", "SUSPENDED")).toBe(false);
      expect(() => assertValidStoreTransition("DRAFT", "SUSPENDED")).toThrow(
        InvalidStoreStatusTransitionError,
      );

      // ARCHIVED is terminal
      expect(isValidStoreTransition("ARCHIVED", "ACTIVE")).toBe(false);
      expect(isValidStoreTransition("ARCHIVED", "DRAFT")).toBe(false);
      expect(isValidStoreTransition("ARCHIVED", "SUSPENDED")).toBe(false);
      expect(() => assertValidStoreTransition("ARCHIVED", "ACTIVE")).toThrow(
        InvalidStoreStatusTransitionError,
      );
    });
  });

  describe("Membership Lifecycle Transitions", () => {
    it("allows legal membership transitions", () => {
      expect(isValidMembershipTransition("INVITED", "ACTIVE")).toBe(true);
      expect(isValidMembershipTransition("ACTIVE", "SUSPENDED")).toBe(true);
      expect(isValidMembershipTransition("SUSPENDED", "ACTIVE")).toBe(true);
      expect(isValidMembershipTransition("ACTIVE", "REMOVED")).toBe(true);
      expect(isValidMembershipTransition("SUSPENDED", "REMOVED")).toBe(true);
    });

    it("rejects illegal membership transitions", () => {
      // REMOVED is terminal
      expect(isValidMembershipTransition("REMOVED", "ACTIVE")).toBe(false);
      expect(() =>
        assertValidMembershipTransition("REMOVED", "ACTIVE"),
      ).toThrow(InvalidStoreStatusTransitionError);
    });
  });

  describe("Domain Error Types", () => {
    it("exposes expected HTTP status codes and codes", () => {
      const notFound = new StoreNotFoundError();
      expect(notFound.status).toBe(404);
      expect(notFound.code).toBe("STORE_NOT_FOUND");

      const duplicateSlug = new DuplicateStoreSlugError("test-slug");
      expect(duplicateSlug.status).toBe(409);
      expect(duplicateSlug.code).toBe("STORE_SLUG_ALREADY_EXISTS");

      const lastOwner = new CannotRemoveLastOwnerError();
      expect(lastOwner.status).toBe(400);
      expect(lastOwner.code).toBe("CANNOT_REMOVE_LAST_OWNER");

      const immutable = new ImmutableFieldError("currency", "cannot change");
      expect(immutable.status).toBe(400);
      expect(immutable.code).toBe("IMMUTABLE_FIELD_ERROR");
    });
  });
});
