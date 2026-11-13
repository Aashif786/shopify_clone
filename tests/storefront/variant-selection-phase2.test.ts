import { describe, it, expect, vi } from "vitest";
import type { ProductOptionDTO } from "@calcart/products";
import {
  buildListingSelection,
  buildProductHref,
  createSingleFlight,
  describeResolution,
  getListingContext,
  getOptionValueState,
  getProductOptionGroups,
  parseSelectionFromSearchParams,
  selectionFromVariant,
  submitSelectedVariant,
  type InventoryAwareVariant,
} from "../../apps/web/src/lib/storefront-variant-selection";

function opt(name: string, position: number, values: string[], isPublishable = false): ProductOptionDTO {
  return { id: `opt-${name}`, productId: "p1", name, position, values, isPublishable };
}

function variant(id: string, o: string[], extra: Partial<InventoryAwareVariant> = {}): InventoryAwareVariant {
  return {
    id,
    productId: "p1",
    title: o.join(" / ") || "Default Title",
    sku: null,
    price: 1000,
    compareAtPrice: null,
    currency: "USD",
    position: 0,
    status: "ACTIVE",
    option1: o[0] ?? null,
    option2: o[1] ?? null,
    option3: o[2] ?? null,
    ...extra,
  } as InventoryAwareVariant;
}

const stock = (n: number) => ({
  availableQuantity: n,
  isOutOfStock: n <= 0,
  effectiveMaxQuantity: n,
});

const sizes = ["S", "M", "L"];
const colors = ["Red", "Blue"];
const fabrics = ["Cotton", "Linen"];
const options = [opt("Size", 0, sizes), opt("Color", 1, colors, true), opt("Fabric", 2, fabrics)];
const variants: InventoryAwareVariant[] = [];
for (const s of sizes)
  for (const c of colors)
    for (const f of fabrics) variants.push(variant(`v-${s}-${c}-${f}`, [s, c, f], { inventory: stock(5) }));

describe("published listing context", () => {
  it("option-level listing exposes its option/value, never the representative variant", () => {
    const ctx = getListingContext({
      listingOptionName: "Color",
      listingOptionValue: "Red",
      variantId: "v-S-Red-Cotton",
      isStandaloneVariant: true,
    });
    expect(ctx).toEqual({ optionName: "Color", optionValue: "Red" });
  });

  it("legacy standalone variant keeps its exact variant identity; normal products have none", () => {
    expect(getListingContext({ variantId: "v1", isStandaloneVariant: true })).toEqual({ variantId: "v1" });
    expect(getListingContext({ variantId: null, isStandaloneVariant: false })).toBeNull();
  });

  it("preselects only the listing's option value and canonicalises it", () => {
    expect(buildListingSelection(options, variants, { optionName: "color", optionValue: "RED" })).toEqual({
      Color: "Red",
    });
    expect(buildListingSelection(options, variants, null)).toEqual({});
    // unknown option/value in the context is ignored, not guessed
    expect(buildListingSelection(options, variants, { optionName: "Color", optionValue: "Green" })).toEqual({});
  });

  it("legacy variant context preselects from the exact variant", () => {
    const plain = [opt("Size", 0, sizes), opt("Color", 1, colors)];
    expect(buildListingSelection(plain, variants, { variantId: "v-M-Red-Cotton" })).toEqual({
      Size: "M",
      Color: "Red",
    });
  });

  it("selectionFromVariant returns every option group of an explicit variant", () => {
    const v = variants.find((x) => x.id === "v-L-Blue-Linen")!;
    expect(selectionFromVariant(options, v)).toEqual({ Size: "L", Color: "Blue", Fabric: "Linen" });
  });
});

describe("product href for cards", () => {
  it("option-level listing links with option[Name]=Value and no representative ?variant=", () => {
    const href = buildProductHref("my store", {
      slug: "tee",
      listingOptionName: "Color",
      listingOptionValue: "Red",
      variantId: "rep-variant",
      isStandaloneVariant: true,
    });
    expect(href).toBe("/stores/my%20store/products/tee?option%5BColor%5D=Red");
    expect(href).not.toContain("rep-variant");
  });

  it("legacy standalone keeps ?variant=; parent products have no query", () => {
    expect(buildProductHref("s", { slug: "t", variantId: "v1", isStandaloneVariant: true })).toBe(
      "/stores/s/products/t?variant=v1",
    );
    expect(buildProductHref("s", { slug: "t", variantId: null, isStandaloneVariant: false })).toBe(
      "/stores/s/products/t",
    );
  });

  it("round-trips through the detail page's query parsing", () => {
    const href = buildProductHref("s", {
      slug: "t",
      listingOptionName: "Color",
      listingOptionValue: "Red",
      isStandaloneVariant: true,
    });
    const params = new URL(`http://x${href}`).searchParams;
    expect(parseSelectionFromSearchParams(params, options)).toEqual({ Color: "Red" });
  });

  it("parse ignores unknown values and accepts plain name=value", () => {
    expect(parseSelectionFromSearchParams(new URLSearchParams("color=Green&size=m"), options)).toEqual({
      Size: "M",
    });
  });
});

describe("getProductOptionGroups", () => {
  it("returns authoritative groups unchanged and derives groups only when none exist", () => {
    expect(getProductOptionGroups(options, variants)).toBe(options);
    const derived = getProductOptionGroups(undefined, [variant("a", ["S", "Red"]), variant("b", ["M", "Red"])], "p");
    expect(derived.map((o) => [o.name, o.values])).toEqual([
      ["Option 1", ["S", "M"]],
      ["Option 2", ["Red"]],
    ]);
  });
});

describe("getOptionValueState", () => {
  it("is nonexistent only when no active variant has that combination", () => {
    const sparse = variants.filter((v) => !(v.option1 === "L" && v.option2 === "Red"));
    expect(getOptionValueState(sparse, options, { Color: "Red" }, "Size", "L")).toBe("nonexistent");
    expect(getOptionValueState(sparse, options, { Color: "Blue" }, "Size", "L")).toBe("available");
    expect(getOptionValueState(sparse, options, {}, "Size", "L")).toBe("available");
  });

  it("is out_of_stock only when known inventory says every candidate is out", () => {
    const vs = variants.map((v) => (v.option1 === "S" ? { ...v, inventory: stock(0) } : v));
    expect(getOptionValueState(vs, options, {}, "Size", "S")).toBe("out_of_stock");
    expect(getOptionValueState(vs, options, {}, "Size", "M")).toBe("available");
  });

  it("does not speculate when inventory is unknown", () => {
    const noInv = variants.map((v) => ({ ...v, inventory: undefined }));
    expect(getOptionValueState(noInv, options, {}, "Size", "S")).toBe("available");
  });
});

describe("submitSelectedVariant", () => {
  const complete = { Size: "M", Color: "Red", Fabric: "Linen" };

  it("adds the exact resolved variant id and quantity", async () => {
    const addItem = vi.fn().mockResolvedValue(undefined);
    const result = await submitSelectedVariant({
      variants, options, selection: complete, quantity: 2, addItem, flight: createSingleFlight(),
    });
    expect(result.status).toBe("added");
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(addItem).toHaveBeenCalledWith("v-M-Red-Linen", 2);
  });

  it("never calls addItem for an incomplete selection and names what is missing", async () => {
    const addItem = vi.fn();
    const result = await submitSelectedVariant({
      variants, options, selection: { Size: "M", Color: "Red" }, quantity: 1, addItem, flight: createSingleFlight(),
    });
    expect(addItem).not.toHaveBeenCalled();
    expect(result.status === "rejected" && result.message).toBe("Select Fabric");
  });

  it("rejects nonexistent combinations without adding anything", async () => {
    const addItem = vi.fn();
    const sparse = variants.filter((v) => v.id !== "v-M-Red-Linen");
    const result = await submitSelectedVariant({
      variants: sparse, options, selection: complete, quantity: 1, addItem, flight: createSingleFlight(),
    });
    expect(addItem).not.toHaveBeenCalled();
    expect(result.status === "rejected" && result.resolution.status).toBe("not_found");
  });

  it("rejects ambiguous combinations without adding anything", async () => {
    const addItem = vi.fn();
    const dup = [...variants, variant("dup", ["M", "Red", "Linen"])];
    const result = await submitSelectedVariant({
      variants: dup, options, selection: complete, quantity: 1, addItem, flight: createSingleFlight(),
    });
    expect(addItem).not.toHaveBeenCalled();
    expect(result.status === "rejected" && result.resolution.status).toBe("ambiguous");
  });

  it("rejects unavailable (out-of-stock) variants without adding anything", async () => {
    const addItem = vi.fn();
    const vs = variants.map((v) => (v.id === "v-M-Red-Linen" ? { ...v, inventory: stock(0) } : v));
    const result = await submitSelectedVariant({
      variants: vs, options, selection: complete, quantity: 1, addItem, flight: createSingleFlight(),
    });
    expect(addItem).not.toHaveBeenCalled();
    expect(result.status === "rejected" && result.resolution.status).toBe("unavailable");
  });

  it("caps quantity at the variant's effective maximum", async () => {
    const addItem = vi.fn().mockResolvedValue(undefined);
    const vs = variants.map((v) => (v.id === "v-M-Red-Linen" ? { ...v, inventory: stock(3) } : v));
    await submitSelectedVariant({
      variants: vs, options, selection: complete, quantity: 10, addItem, flight: createSingleFlight(),
    });
    expect(addItem).toHaveBeenCalledWith("v-M-Red-Linen", 3);
  });

  it("ignores a duplicate submission while one is pending", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const addItem = vi.fn().mockImplementation(() => gate);
    const flight = createSingleFlight();
    const first = submitSelectedVariant({ variants, options, selection: complete, quantity: 1, addItem, flight });
    const second = await submitSelectedVariant({ variants, options, selection: complete, quantity: 1, addItem, flight });
    expect(second.status).toBe("busy");
    release();
    expect((await first).status).toBe("added");
    expect(addItem).toHaveBeenCalledTimes(1);
  });

  it("surfaces backend errors without substituting another variant", async () => {
    const addItem = vi.fn().mockRejectedValue(new Error("Requested quantity exceeds available stock"));
    const result = await submitSelectedVariant({
      variants, options, selection: complete, quantity: 1, addItem, flight: createSingleFlight(),
    });
    expect(result).toEqual({ status: "failed", message: "Requested quantity exceeds available stock" });
    expect(addItem).toHaveBeenCalledTimes(1);
  });

  it("simple product (single variant, no options) is added directly", async () => {
    const addItem = vi.fn().mockResolvedValue(undefined);
    const only = variant("only", []);
    const result = await submitSelectedVariant({
      variants: [only], options: [], selection: {}, quantity: 1, addItem, flight: createSingleFlight(),
    });
    expect(result.status).toBe("added");
    expect(addItem).toHaveBeenCalledWith("only", 1);
  });
});

describe("describeResolution", () => {
  it("returns null only for a resolved variant", () => {
    expect(describeResolution({ status: "resolved", variant: variant("a", []) })).toBeNull();
    expect(describeResolution({ status: "incomplete", missingOptions: ["Size", "Fabric"] })).toBe("Select Size, Fabric");
    expect(describeResolution({ status: "not_found" })).toMatch(/not available/);
  });
});
