import { describe, it, expect } from "vitest";
import type { ProductOptionDTO } from "@calcart/products";
import {
  buildInitialSelection,
  createSingleFlight,
  getMissingOptions,
  getProductCardAction,
  isSelectionComplete,
  requiresOptionSelection,
  resolveExactVariant,
  type SelectableVariant,
} from "../../apps/web/src/lib/storefront-variant-selection";

function opt(name: string, position: number, values: string[], isPublishable = false): ProductOptionDTO {
  return { id: `opt-${name}`, productId: "p1", name, position, values, isPublishable };
}

function variant(
  id: string,
  o: Array<string | undefined>,
  extra: Partial<SelectableVariant> = {},
): SelectableVariant {
  return {
    id,
    productId: "p1",
    title: o.filter(Boolean).join(" / ") || "Default Title",
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
  } as SelectableVariant;
}

const sizes = ["S", "M", "L"];
const colors = ["Red", "Blue"];
const fabrics = ["Cotton", "Linen"];
const options = [opt("Size", 0, sizes), opt("Color", 1, colors, true), opt("Fabric", 2, fabrics)];
const variants: SelectableVariant[] = [];
for (const s of sizes)
  for (const c of colors)
    for (const f of fabrics) variants.push(variant(`v-${s}-${c}-${f}`, [s, c, f]));

describe("getProductCardAction", () => {
  const base = { variantsCount: 1, isOutOfStock: false };

  it("simple product (one purchasable variant) -> direct add with the exact variant id", () => {
    expect(getProductCardAction({ ...base, purchasableVariantCount: 1, purchasableVariantId: "v-1" })).toEqual({
      kind: "add",
      variantId: "v-1",
    });
  });

  it("multiple purchasable variants -> choose options", () => {
    expect(getProductCardAction({ ...base, purchasableVariantCount: 12, purchasableVariantId: null })).toEqual({
      kind: "choose",
    });
  });

  it("publishable listing covering several variants never bypasses selection (variantsCount is 1 for listings)", () => {
    expect(
      getProductCardAction({ variantsCount: 1, purchasableVariantCount: 3, purchasableVariantId: null }),
    ).toEqual({ kind: "choose" });
  });

  it("missing purchasable data is unresolved, never a simple product", () => {
    expect(getProductCardAction({ variantsCount: 1 })).toEqual({ kind: "choose" });
    expect(getProductCardAction({ variantsCount: 3 })).toEqual({ kind: "choose" });
  });

  it("count of 1 without an id cannot add", () => {
    expect(getProductCardAction({ ...base, purchasableVariantCount: 1, purchasableVariantId: null })).toEqual({
      kind: "choose",
    });
  });

  it("out of stock or no variants -> sold out", () => {
    expect(
      getProductCardAction({ variantsCount: 1, isOutOfStock: true, purchasableVariantCount: 1, purchasableVariantId: "v" }),
    ).toEqual({ kind: "sold_out" });
    expect(getProductCardAction({ variantsCount: 0 })).toEqual({ kind: "sold_out" });
    expect(getProductCardAction({ variantsCount: 1, purchasableVariantCount: 0 })).toEqual({ kind: "sold_out" });
  });
});

describe("requiresOptionSelection", () => {
  it("is false only for exactly one active variant", () => {
    expect(requiresOptionSelection([variant("a", [])])).toBe(false);
    expect(requiresOptionSelection([variant("a", ["S"]), variant("b", ["M"])])).toBe(true);
    expect(requiresOptionSelection([variant("a", ["S"]), variant("b", ["M"], { status: "ARCHIVED" })])).toBe(false);
    expect(requiresOptionSelection([])).toBe(true);
  });
});

describe("resolveExactVariant", () => {
  it("simple product with no options resolves its single variant", () => {
    const only = variant("only", []);
    expect(resolveExactVariant([only], [], {})).toEqual({ status: "resolved", variant: only });
  });

  it("one option group with multiple values requires a selection", () => {
    const o = [opt("Size", 0, sizes)];
    const vs = sizes.map((s) => variant(`v-${s}`, [s]));
    expect(resolveExactVariant(vs, o, {})).toEqual({ status: "incomplete", missingOptions: ["Size"] });
    const r = resolveExactVariant(vs, o, { Size: "M" });
    expect(r.status === "resolved" && r.variant.id).toBe("v-M");
  });

  it("multiple option groups: incomplete selections are never resolved", () => {
    expect(resolveExactVariant(variants, options, { Size: "M", Color: "Red" })).toEqual({
      status: "incomplete",
      missingOptions: ["Fabric"],
    });
    expect(isSelectionComplete(options, { Size: "M", Color: "Red" })).toBe(false);
  });

  it("complete selection resolves the exact variant regardless of array order", () => {
    const r = resolveExactVariant([...variants].reverse(), options, { Size: "L", Color: "Blue", Fabric: "Linen" });
    expect(r.status === "resolved" && r.variant.id).toBe("v-L-Blue-Linen");
  });

  it("matching ignores case and whitespace but is otherwise exact", () => {
    const r = resolveExactVariant(variants, options, { size: " m ", COLOR: "red", fabric: "cotton" });
    expect(r.status === "resolved" && r.variant.id).toBe("v-M-Red-Cotton");
  });

  it("nonexistent combination is rejected", () => {
    const sparse = variants.filter((v) => v.id !== "v-M-Red-Linen");
    expect(resolveExactVariant(sparse, options, { Size: "M", Color: "Red", Fabric: "Linen" })).toEqual({
      status: "not_found",
    });
    expect(resolveExactVariant(variants, options, { Size: "XL", Color: "Red", Fabric: "Linen" }).status).toBe(
      "not_found",
    );
  });

  it("ambiguous combination (duplicate variants) is rejected, not first-matched", () => {
    const dup = [...variants, variant("dup", ["M", "Red", "Cotton"])];
    const r = resolveExactVariant(dup, options, { Size: "M", Color: "Red", Fabric: "Cotton" });
    expect(r.status).toBe("ambiguous");
    expect(r.status === "ambiguous" && r.candidates.map((c) => c.id).sort()).toEqual(["dup", "v-M-Red-Cotton"]);
  });

  it("archived variants are not purchasable", () => {
    const vs = variants.map((v) => (v.id === "v-M-Red-Cotton" ? { ...v, status: "ARCHIVED" as const } : v));
    expect(resolveExactVariant(vs, options, { Size: "M", Color: "Red", Fabric: "Cotton" }).status).toBe("not_found");
  });

  it("out-of-stock variants are reported unavailable, not resolved", () => {
    const vs = variants.map((v) =>
      v.id === "v-M-Red-Cotton" ? { ...v, inventory: { availableQuantity: 0, isOutOfStock: true } } : v,
    );
    expect(resolveExactVariant(vs, options, { Size: "M", Color: "Red", Fabric: "Cotton" }).status).toBe(
      "unavailable",
    );
  });

  it("several variants without option groups is ambiguous", () => {
    expect(resolveExactVariant([variant("a", []), variant("b", [])], [], {}).status).toBe("ambiguous");
  });
});

describe("publishable listing context", () => {
  // Representative variant of the Color=Red listing; its Size/Fabric are arbitrary.
  const listing = variants.find((v) => v.id === "v-M-Red-Cotton")!;

  it("preselects only publishable option values, not the representative's other values", () => {
    expect(buildInitialSelection(options, listing)).toEqual({ Color: "Red" });
  });

  it("remaining options stay required; the listing does not bypass selection", () => {
    const selection = buildInitialSelection(options, listing);
    expect(getMissingOptions(options, selection)).toEqual(["Size", "Fabric"]);
    expect(resolveExactVariant(variants, options, selection).status).toBe("incomplete");
  });

  it("preserves Size=M, Color=Red and requires Fabric; resolves only after Fabric is chosen", () => {
    const opts = [opt("Size", 0, sizes, true), opt("Color", 1, colors, true), opt("Fabric", 2, fabrics)];
    const selection = buildInitialSelection(opts, listing);
    expect(selection).toEqual({ Size: "M", Color: "Red" });
    expect(resolveExactVariant(variants, opts, selection)).toEqual({
      status: "incomplete",
      missingOptions: ["Fabric"],
    });
    const done = resolveExactVariant(variants, opts, { ...selection, Fabric: "Linen" });
    expect(done.status === "resolved" && done.variant.id).toBe("v-M-Red-Linen");
  });

  it("legacy standalone variant (no publishable option) is a complete identity", () => {
    const plain = [opt("Size", 0, sizes), opt("Color", 1, colors)];
    expect(buildInitialSelection(plain, listing)).toEqual({ Size: "M", Color: "Red" });
  });

  it("no listing variant -> empty selection", () => {
    expect(buildInitialSelection(options, null)).toEqual({});
  });
});

describe("createSingleFlight", () => {
  it("ignores a second submission while the first is pending, then allows another", async () => {
    const flight = createSingleFlight();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = flight(async () => {
      calls++;
      await gate;
    });
    const second = await flight(async () => {
      calls++;
    });
    expect(second.ran).toBe(false);
    release();
    expect((await first).ran).toBe(true);
    expect(calls).toBe(1);
    expect((await flight(async () => calls++)).ran).toBe(true);
    expect(calls).toBe(2);
  });

  it("releases the lock when the task throws", async () => {
    const flight = createSingleFlight();
    await expect(
      flight(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await flight(async () => 1)).ran).toBe(true);
  });
});
