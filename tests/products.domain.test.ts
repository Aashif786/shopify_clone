import { describe, expect, it } from "vitest";
import {
  assertValidProductTransition,
  assertValidVariantTransition,
  isValidProductTransition,
  isValidVariantTransition,
  InvalidPriceError,
  InvalidProductStateTransitionError,
  ProductNotPublishableError,
  isValidSlugFormat,
  normalizeSlug,
  validateCompareAtPrice,
  validatePrice,
  validateProductPublishable,
  validateProductTitle,
  validateSku,
  generateVariantCombinations,
  type Product,
  type ProductVariant,
} from "@calcart/products";

describe("Products Domain Logic", () => {
  describe("Slug Normalization and Validation", () => {
    it("normalizes mixed case, special characters, and consecutive hyphens", () => {
      expect(normalizeSlug("  Classic Leather Jacket!!  ")).toBe("classic-leather-jacket");
      expect(normalizeSlug("Men's T-Shirt (Blue / Large)")).toBe("men-s-t-shirt-blue-large");
      expect(normalizeSlug("café racer 2024")).toBe("cafe-racer-2024");
      expect(normalizeSlug("---multiple---hyphens---")).toBe("multiple-hyphens");
    });

    it("truncates slug exceeding 120 characters", () => {
      const longInput = "a".repeat(150);
      const slug = normalizeSlug(longInput);
      expect(slug.length).toBe(120);
    });

    it("validates slug format with isValidSlugFormat", () => {
      expect(isValidSlugFormat("classic-jacket")).toBe(true);
      expect(isValidSlugFormat("product123")).toBe(true);
      expect(isValidSlugFormat("")).toBe(false);
      expect(isValidSlugFormat("-invalid-leading")).toBe(false);
      expect(isValidSlugFormat("invalid-trailing-")).toBe(false);
      expect(isValidSlugFormat("invalid--consecutive")).toBe(false);
      expect(isValidSlugFormat("INVALID_UPPER")).toBe(false);
    });
  });

  describe("Product Title Validation", () => {
    it("accepts valid non-empty titles and trims whitespace", () => {
      expect(validateProductTitle("  Vintage Watch  ")).toBe("Vintage Watch");
    });

    it("rejects non-string or empty titles", () => {
      expect(() => validateProductTitle("")).toThrow("Product title cannot be empty");
      expect(() => validateProductTitle("   ")).toThrow("Product title cannot be empty");
      expect(() => validateProductTitle(null)).toThrow("Product title must be a string");
    });

    it("rejects titles exceeding 255 characters", () => {
      expect(() => validateProductTitle("a".repeat(256))).toThrow(
        "Product title cannot exceed 255 characters",
      );
    });
  });

  describe("Exact Monetary Representation & Pricing Validation", () => {
    it("accepts valid non-negative integer minor units (cents)", () => {
      expect(validatePrice(0)).toBe(0);
      expect(validatePrice(1999)).toBe(1999);
      expect(validatePrice(100000)).toBe(100000);
    });

    it("strictly rejects floating-point numbers to prevent precision loss", () => {
      expect(() => validatePrice(19.99)).toThrow(InvalidPriceError);
      expect(() => validatePrice(0.5)).toThrow(InvalidPriceError);
    });

    it("rejects negative values and NaN", () => {
      expect(() => validatePrice(-100)).toThrow(InvalidPriceError);
      expect(() => validatePrice(NaN)).toThrow(InvalidPriceError);
      expect(() => validatePrice("1000")).toThrow(InvalidPriceError);
    });

    it("validates compareAtPrice correctly", () => {
      expect(validateCompareAtPrice(null)).toBeNull();
      expect(validateCompareAtPrice(undefined)).toBeNull();
      expect(validateCompareAtPrice(2499)).toBe(2499);
      expect(() => validateCompareAtPrice(24.99)).toThrow(InvalidPriceError);
      expect(() => validateCompareAtPrice(-50)).toThrow(InvalidPriceError);
    });
  });

  describe("SKU Validation", () => {
    it("normalizes empty SKU values to null", () => {
      expect(validateSku(null)).toBeNull();
      expect(validateSku(undefined)).toBeNull();
      expect(validateSku("")).toBeNull();
      expect(validateSku("   ")).toBeNull();
    });

    it("trims valid SKUs and enforces maximum length", () => {
      expect(validateSku("  SKU-12345-BLK  ")).toBe("SKU-12345-BLK");
      expect(() => validateSku("x".repeat(101))).toThrow("SKU cannot exceed 100 characters");
    });
  });

  describe("Product Lifecycle & State Transitions", () => {
    it("permits legal product state transitions", () => {
      expect(isValidProductTransition("DRAFT", "ACTIVE")).toBe(true);
      expect(isValidProductTransition("DRAFT", "ARCHIVED")).toBe(true);
      expect(isValidProductTransition("ACTIVE", "DRAFT")).toBe(true);
      expect(isValidProductTransition("ACTIVE", "ARCHIVED")).toBe(true);
      expect(isValidProductTransition("ARCHIVED", "DRAFT")).toBe(true);
      expect(isValidProductTransition("ACTIVE", "ACTIVE")).toBe(true);
    });

    it("rejects illegal product state transitions", () => {
      // Cannot publish an ARCHIVED product directly without unarchiving to DRAFT first
      expect(isValidProductTransition("ARCHIVED", "ACTIVE")).toBe(false);
      expect(() => assertValidProductTransition("ARCHIVED", "ACTIVE")).toThrow(
        InvalidProductStateTransitionError,
      );
    });

    it("validates variant state transitions", () => {
      expect(isValidVariantTransition("ACTIVE", "INACTIVE")).toBe(true);
      expect(isValidVariantTransition("ACTIVE", "ARCHIVED")).toBe(true);
      expect(isValidVariantTransition("INACTIVE", "ACTIVE")).toBe(true);
      expect(isValidVariantTransition("ARCHIVED", "ACTIVE")).toBe(true);
      expect(() => assertValidVariantTransition("ACTIVE", "ACTIVE")).not.toThrow();
    });
  });

  describe("Product Publication Invariants", () => {
    const baseProduct: Product = {
      id: "018f4a12-0000-7000-8000-000000000001",
      storeId: "018f4a12-0000-7000-8000-000000000002",
      title: "Handmade Ceramic Mug",
      description: "Artisan stoneware",
      slug: "handmade-ceramic-mug",
      status: "DRAFT",
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const baseVariant: ProductVariant = {
      id: "018f4a12-0000-7000-8000-000000000003",
      productId: baseProduct.id,
      storeId: baseProduct.storeId,
      title: "Default Title",
      sku: "MUG-001",
      price: 2500,
      compareAtPrice: null,
      currency: "USD",
      position: 0,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("allows publication when required product and active variant data is present", () => {
      expect(() =>
        validateProductPublishable(baseProduct, [baseVariant]),
      ).not.toThrow();
    });

    it("rejects publication when product title is missing or empty", () => {
      expect(() =>
        validateProductPublishable({ ...baseProduct, title: "" }, [baseVariant]),
      ).toThrow(ProductNotPublishableError);
    });

    it("rejects publication when product has no active variants", () => {
      const inactiveVariant: ProductVariant = {
        ...baseVariant,
        status: "INACTIVE",
      };
      expect(() =>
        validateProductPublishable(baseProduct, [inactiveVariant]),
      ).toThrow(ProductNotPublishableError);
      expect(() => validateProductPublishable(baseProduct, [])).toThrow(
        ProductNotPublishableError,
      );
    });
  });

  describe("Variant Combination Matrix Generation", () => {
    it("returns default single variant when no options provided", () => {
      const combos = generateVariantCombinations([]);
      expect(combos).toHaveLength(1);
      expect(combos[0]).toEqual({
        title: "Default Title",
        option1: null,
        option2: null,
        option3: null,
      });
    });

    it("generates combinations for single option (Size: S, M, L)", () => {
      const combos = generateVariantCombinations([
        { name: "Size", values: ["S", "M", "L"] },
      ]);
      expect(combos).toHaveLength(3);
      expect(combos.map((c) => c.title)).toEqual(["S", "M", "L"]);
      expect(combos[0]).toEqual({
        title: "S",
        option1: "S",
        option2: null,
        option3: null,
      });
      expect(combos[2]).toEqual({
        title: "L",
        option1: "L",
        option2: null,
        option3: null,
      });
    });

    it("generates 2-option Cartesian product (Size x Color)", () => {
      const combos = generateVariantCombinations([
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["Red", "Blue"] },
      ]);
      expect(combos).toHaveLength(4);
      expect(combos.map((c) => c.title)).toEqual([
        "S / Red",
        "S / Blue",
        "M / Red",
        "M / Blue",
      ]);
      expect(combos[0]).toEqual({
        title: "S / Red",
        option1: "S",
        option2: "Red",
        option3: null,
      });
    });

    it("generates 3-option Cartesian product (Size x Color x Material)", () => {
      const combos = generateVariantCombinations([
        { name: "Size", values: ["M", "L"] },
        { name: "Color", values: ["Black"] },
        { name: "Material", values: ["Cotton", "Polyester"] },
      ]);
      expect(combos).toHaveLength(4);
      expect(combos[0]).toEqual({
        title: "M / Black / Cotton",
        option1: "M",
        option2: "Black",
        option3: "Cotton",
      });
      expect(combos[3]).toEqual({
        title: "L / Black / Polyester",
        option1: "L",
        option2: "Black",
        option3: "Polyester",
      });
    });

    it("normalizes and trims whitespace and deduplicates values", () => {
      const combos = generateVariantCombinations([
        { name: "  Size  ", values: [" S ", "S", "M  ", ""] },
      ]);
      expect(combos).toHaveLength(2);
      expect(combos.map((c) => c.title)).toEqual(["S", "M"]);
    });

    it("safeguards to maximum 3 options", () => {
      const combos = generateVariantCombinations([
        { name: "Size", values: ["S"] },
        { name: "Color", values: ["Red"] },
        { name: "Material", values: ["Cotton"] },
        { name: "Style", values: ["Crewneck"] },
      ]);
      expect(combos).toHaveLength(1);
      expect(combos[0]?.title).toBe("S / Red / Cotton");
    });
  });
});
